import type { H3Event } from 'h3'

export const getRemoteIp = (event: H3Event) => {
  const ipForwarded = () => {
    const ip = event.node.req.headers['x-forwarded-for']
    if (Array.isArray(ip)) {
      return ip[0]!
    } else {
      return ip?.split(',')[0]!.trim()
    }
  }

  const xRealIp = event.node.req.headers['x-real-ip']
  // Node lowercases all incoming header names, so this must be lowercase
  // or Cloudflare's real client IP is never read.
  const cfConnectingIp = event.node.req.headers['cf-connecting-ip']

  return cfConnectingIp || ipForwarded() || xRealIp || ''
}
