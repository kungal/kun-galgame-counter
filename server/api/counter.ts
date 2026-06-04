import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { dirname, join } from 'node:path'
import { defineEventHandler, readBody, createError } from 'h3'
import { getRemoteIp } from '~~/server/utils/ip'

// The three things one can feel about 莲. Kept server-side as the source of
// truth so a forged POST body can't invent new option keys.
const OPTION_VALUES = ['cute', 'adorable', 'both'] as const
type OptionValue = (typeof OPTION_VALUES)[number]
const isOptionValue = (value: unknown): value is OptionValue =>
  typeof value === 'string' && (OPTION_VALUES as readonly string[]).includes(value)

type CounterData = {
  total: number
  options: Record<OptionValue, number>
  // hashed ip -> the option value that ip voted for
  ips: Record<string, string>
}

const dataPath = join(process.cwd(), 'server', 'data', 'counter.json')
const emptyOptions = (): Record<OptionValue, number> => ({
  cute: 0,
  adorable: 0,
  both: 0,
})
const defaultData = (): CounterData => ({
  total: 0,
  options: emptyOptions(),
  ips: {},
})

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
    await writeFile(dataPath, JSON.stringify(defaultData(), null, 2), 'utf-8')
  }
}

async function readData(): Promise<CounterData> {
  await ensureDataFile()
  const raw = await readFile(dataPath, 'utf-8')
  try {
    const parsed = JSON.parse(raw) as Partial<CounterData>
    return {
      total: parsed.total ?? 0,
      options: {
        cute: parsed.options?.cute ?? 0,
        adorable: parsed.options?.adorable ?? 0,
        both: parsed.options?.both ?? 0,
      },
      ips: parsed.ips ?? {},
    }
  } catch {
    const fresh = defaultData()
    await writeFile(dataPath, JSON.stringify(fresh, null, 2), 'utf-8')
    return fresh
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

  const toResponse = (data: CounterData) => {
    const selected = ipKey ? data.ips[ipKey] : undefined
    return {
      total: data.total,
      options: data.options,
      clicked: Boolean(selected),
      selected: isOptionValue(selected) ? selected : null,
    }
  }

  if (event.method === 'GET') {
    const data = await withLock(readData)
    return toResponse(data)
  }

  if (event.method === 'POST') {
    if (!ipKey) {
      throw createError({
        statusCode: 400,
        statusMessage: '无法识别 IP，无法更新计数器',
      })
    }

    const body = await readBody<{ option?: unknown }>(event)
    if (!isOptionValue(body?.option)) {
      throw createError({ statusCode: 400, statusMessage: '未知的投票选项' })
    }
    const option = body.option

    return withLock(async () => {
      const data = await readData()
      if (data.ips[ipKey]) {
        // Already voted: report their existing choice, don't double count.
        return toResponse(data)
      }

      data.total += 1
      data.options[option] += 1
      data.ips[ipKey] = option
      await writeData(data)

      return toResponse(data)
    })
  }

  throw createError({
    statusCode: 405,
    statusMessage: 'Method Not Allowed',
  })
})
