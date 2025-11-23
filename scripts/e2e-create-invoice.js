const crypto = require('crypto')

async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) throw new Error('Missing TELEGRAM_BOT_TOKEN')
  const user = { id: Number(process.env.TEST_USER_ID || 1740576312), first_name: 'Test', username: 'test_user' }
  const params = new URLSearchParams()
  params.set('auth_date', String(Math.floor(Date.now() / 1000)))
  params.set('query_id', 'AAEAAA')
  params.set('user', JSON.stringify(user))
  const keys = Array.from(params.keys()).sort()
  const dataCheckString = keys.map(k => `${k}=${params.get(k)}`).join('\n')
  const secret = crypto.createHmac('sha256', 'WebAppData').update(token).digest()
  const hmac = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex')
  params.set('hash', hmac)
  const initData = params.toString()

  const payload = { initData, sku: process.env.TEST_SKU || 'pack12' }
  const apiUrl = process.env.API_BASE_URL || 'http://localhost:3000/api/create-invoice'
  const res = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
  const text = await res.text()
  console.log('STATUS', res.status)
  console.log('BODY', text)
}

main().catch(err => { console.error('ERROR', err.message); process.exit(1) })
