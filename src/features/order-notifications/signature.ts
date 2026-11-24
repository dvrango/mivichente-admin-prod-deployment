import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Meta signs every webhook call with the app secret: `X-Hub-Signature-256` is
 * `sha256=` plus the hex HMAC-SHA256 of the raw body. Without this check,
 * anyone who knows the URL could mark orders as accepted.
 *
 * It has to run on the raw body, byte for byte: re-serializing the parsed
 * JSON changes escapes (Meta escapes non-ASCII as \uXXXX) and breaks it.
 */
export function verifyMetaSignature(
  rawBody: string,
  header: string | null | undefined,
  appSecret: string,
): boolean {
  if (!header || !appSecret || !header.startsWith('sha256=')) return false
  const received = Buffer.from(header.slice('sha256='.length), 'hex')
  const expected = createHmac('sha256', appSecret).update(rawBody, 'utf8').digest()
  return received.length === expected.length && timingSafeEqual(received, expected)
}

/** Constant-time comparison for the verify token of the subscription check. */
export function sameSecret(a: string | null | undefined, b: string): boolean {
  if (!a || !b) return false
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}
