import { after } from 'next/server'
import { receiveWebhook, verifySubscription } from '@/features/order-notifications/server'

/** Meta checks the URL once, when it is registered in the app. */
export function GET(request: Request) {
  const result = verifySubscription(new URL(request.url).searchParams)
  return new Response(result.body, {
    status: result.status,
    headers: { 'Content-Type': 'text/plain' },
  })
}

/** Button taps, messages to the number and delivery statuses. */
export async function POST(request: Request) {
  const receipt = receiveWebhook(await request.text(), request.headers.get('x-hub-signature-256'))
  if (receipt.status === 200 && receipt.events.length > 0) after(receipt.process)
  return new Response(null, { status: receipt.status })
}
