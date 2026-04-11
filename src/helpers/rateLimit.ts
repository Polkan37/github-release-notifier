export function parseRateLimit(headers: Headers) {
  return {
    remaining: Number(headers.get('x-ratelimit-remaining') || 0),
    reset: Number(headers.get('x-ratelimit-reset') || 0),
  }
}

export function getSleepMs(resetEpoch: number) {
  const now = Math.floor(Date.now() / 1000)
  return Math.max((resetEpoch - now) * 1000, 0)
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}