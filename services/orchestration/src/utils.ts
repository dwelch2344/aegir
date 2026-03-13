/** Random delay between 1-4 seconds to simulate real processing time */
export function randomDelay(): Promise<void> {
  if (process.env.VITEST || process.env.NODE_ENV === 'test') return Promise.resolve()
  const ms = 1000 + Math.random() * 3000
  return new Promise((r) => setTimeout(r, ms))
}

/** Create a timestamped log entry */
export function log(message: string): { log: string; createdTime: number } {
  return { log: message, createdTime: Date.now() }
}
