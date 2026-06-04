import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { dirname, join } from 'node:path'
import { defineEventHandler, createError } from 'h3'
import { getRemoteIp } from '~~/server/utils/ip'

type CounterData = {
  total: number
  ips: Record<string, string>
}

const dataPath = join(process.cwd(), 'server', 'data', 'counter.json')
const defaultData: CounterData = {
  total: 0,
  ips: {},
}

// Visitor IPs are never stored in plaintext. We keep a salted hash only so we
// can dedupe repeat votes without committing raw IPs to disk / git.
const ipSalt = process.env.COUNTER_IP_SALT ?? 'kun-galgame-counter'
const hashIp = (ip: string) =>
  createHash('sha256').update(`${ipSalt}:${ip}`).digest('hex')

// Reads and writes are serialized through this promise chain. Without it,
// concurrent POSTs would read the same total, both increment, and the second
// write would clobber the first (lost votes). instances:1 in pm2 means a single
// process, so an in-process mutex is enough.
let lock: Promise<unknown> = Promise.resolve()
const withLock = <T>(fn: () => Promise<T>): Promise<T> => {
  const run = lock.then(fn, fn)
  lock = run.then(
    () => undefined,
    () => undefined
  )
  return run
}

async function ensureDataFile() {
  await mkdir(dirname(dataPath), { recursive: true })
  try {
    await access(dataPath)
  } catch {
    await writeFile(dataPath, JSON.stringify(defaultData, null, 2), 'utf-8')
  }
}

async function readData(): Promise<CounterData> {
  await ensureDataFile()
  const raw = await readFile(dataPath, 'utf-8')
  try {
    const parsed = JSON.parse(raw) as CounterData
    return {
      total: parsed.total ?? 0,
      ips: parsed.ips ?? {},
    }
  } catch {
    await writeFile(dataPath, JSON.stringify(defaultData, null, 2), 'utf-8')
    return { ...defaultData, ips: {} }
  }
}

async function writeData(data: CounterData) {
  await ensureDataFile()
  await writeFile(dataPath, JSON.stringify(data, null, 2), 'utf-8')
}

export default defineEventHandler(async (event) => {
  const ipData = getRemoteIp(event)
  const ip = Array.isArray(ipData) ? ipData[0] : ipData
  const ipKey = ip ? hashIp(ip) : ''

  if (event.method === 'GET') {
    const data = await withLock(readData)
    return {
      total: data.total,
      clicked: Boolean(ipKey && data.ips[ipKey]),
    }
  }

  if (event.method === 'POST') {
    if (!ipKey) {
      throw createError({
        statusCode: 400,
        statusMessage: '无法识别 IP，无法更新计数器',
      })
    }

    return withLock(async () => {
      const data = await readData()
      if (data.ips[ipKey]) {
        return { total: data.total, clicked: true }
      }

      data.total += 1
      data.ips[ipKey] = new Date().toISOString()
      await writeData(data)

      return { total: data.total, clicked: true }
    })
  }

  throw createError({
    statusCode: 405,
    statusMessage: 'Method Not Allowed',
  })
})
