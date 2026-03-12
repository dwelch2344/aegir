import { createConnection } from 'node:net'
import { config } from '../config.js'

interface EmailMessage {
  to: string
  subject: string
  body: string
  from?: string
  fromName?: string
}

/**
 * Minimal SMTP client for MailHog (dev) and simple SMTP servers.
 * Uses raw TCP — no TLS or AUTH in dev. For production, swap this
 * for a proper client or use an email service API.
 */
export async function sendEmail(msg: EmailMessage): Promise<{ sent: boolean; messageId: string }> {
  const { host, port, from, fromName } = config.smtp
  const sender = msg.from ?? from
  const senderName = msg.fromName ?? fromName
  const messageId = `<${Date.now()}.${Math.random().toString(36).slice(2)}@healthfirst.local>`

  const headers = [
    `From: ${senderName} <${sender}>`,
    `To: ${msg.to}`,
    `Subject: ${msg.subject}`,
    `Message-ID: ${messageId}`,
    `Date: ${new Date().toUTCString()}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset=utf-8`,
  ].join('\r\n')

  const payload = `${headers}\r\n\r\n${msg.body}`

  await smtpSend(host, port, sender, msg.to, payload)
  return { sent: true, messageId }
}

function smtpSend(host: string, port: number, from: string, to: string, data: string): Promise<void> {
  return new Promise((resolve, reject) => {
    let buffer = ''

    // Sequence: greeting → EHLO → MAIL FROM → RCPT TO → DATA → body → QUIT
    const steps = [
      { expect: 220, send: `EHLO healthfirst.local\r\n` },
      { expect: 250, send: `MAIL FROM:<${from}>\r\n` },
      { expect: 250, send: `RCPT TO:<${to}>\r\n` },
      { expect: 250, send: `DATA\r\n` },
      { expect: 354, send: data + '\r\n.\r\n' },
      { expect: 250, send: `QUIT\r\n`, done: true },
    ]
    let step = 0

    const socket = createConnection({ host, port })

    socket.on('data', (chunk) => {
      buffer += chunk.toString()

      // Process complete lines; multi-line responses use "code-" prefix,
      // final line uses "code " (space). Wait until we see a final line.
      while (true) {
        const lineEnd = buffer.indexOf('\r\n')
        if (lineEnd === -1) break

        const line = buffer.slice(0, lineEnd)
        buffer = buffer.slice(lineEnd + 2)

        // Multi-line: "250-SIZE 1000000" — keep reading
        if (line.length >= 4 && line[3] === '-') continue

        // Final line of response: "250 OK" or "220 MailHog..."
        const code = parseInt(line.slice(0, 3), 10)

        if (step >= steps.length) {
          socket.end()
          resolve()
          return
        }

        const current = steps[step]
        if (code !== current.expect) {
          socket.destroy()
          reject(new Error(`SMTP step ${step} expected ${current.expect}, got ${code}: ${line}`))
          return
        }

        socket.write(current.send)

        if (current.done) {
          socket.end()
          resolve()
          return
        }

        step++
      }
    })

    socket.on('error', reject)
    socket.setTimeout(10000, () => {
      socket.destroy()
      reject(new Error('SMTP connection timeout'))
    })
  })
}
