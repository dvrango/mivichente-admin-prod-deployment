import { notifyOrderSchema } from '@/features/order-notifications/schema'
import { notifyOrderByToken } from '@/features/order-notifications/server'

// The web app (app.vichente.com) calls this from the browser. Open CORS is
// fine: there are no cookies, and the order token is the secret.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS })
}

export async function POST(request: Request) {
  const parsed = notifyOrderSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return Response.json({ error: 'invalid_token' }, { status: 400, headers: CORS })
  }
  try {
    const result = await notifyOrderByToken(parsed.data.token)
    return Response.json(result.body, { status: result.status, headers: CORS })
  } catch (error) {
    console.error('[order-notifications] notify route failed', error)
    return Response.json({ error: 'internal_error' }, { status: 500, headers: CORS })
  }
}
