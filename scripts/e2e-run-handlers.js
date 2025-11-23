const path = require('path')

function makeReq({ method='GET', url='/', headers={}, body={}, query={} }={}) {
  return { method, url, headers: { 'user-agent': 'E2E', ...headers }, body, query, connection: { remoteAddress: '127.0.0.1' } }
}

function makeRes() {
  return {
    statusCode: 200,
    headers: {},
    _json: null,
    setHeader(name, value) { this.headers[name] = value },
    status(code) { this.statusCode = code; return this },
    json(data) { this._json = data; return this },
    send(data) { this._json = data; return this }
  }
}

async function run() {
  // Mock fetch for external services
  const realFetch = global.fetch
  global.fetch = async (url, opts) => {
    if (String(url).includes('api.telegram.org')) {
      return { ok: true, json: async () => ({ ok: true, result: 'https://t.me/invoice/mock_link' }), text: async () => '{}' }
    }
    if (String(url).startsWith('https://hook.us2.make.com')) {
      return { ok: true, json: async () => ({ ok: true }), text: async () => '{}' }
    }
    if (String(url).startsWith('http://localhost:3000')) {
      return realFetch(url, opts)
    }
    return { ok: true, json: async () => ({}), text: async () => '{}' }
  }

  // Generate initData (same as scripts/gen-initdata.js)
  const crypto = require('crypto')
  const token = process.env.TELEGRAM_BOT_TOKEN
  const user = { id: Number(process.env.TEST_USER_ID || 1740576312), first_name: 'Test', username: 'test_user' }
  const params = new URLSearchParams()
  params.set('auth_date', String(Math.floor(Date.now() / 1000)))
  params.set('query_id', 'AAEAAA')
  params.set('user', JSON.stringify(user))
  const dataCheckString = Array.from(params.keys()).sort().map(k => `${k}=${params.get(k)}`).join('\n')
  const secret = crypto.createHmac('sha256', 'WebAppData').update(token).digest()
  const hmac = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex')
  params.set('hash', hmac)
  const initData = params.toString()

  // Handlers
  const balance = require(path.join(__dirname, '..', 'api', 'balance.js'))
  const createInvoice = require(path.join(__dirname, '..', 'api', 'create-invoice.js'))
  const consume = require(path.join(__dirname, '..', 'api', 'consume.js'))
  const webhook = require(path.join(__dirname, '..', 'api', 'webhook.js'))

  // 1. Balance
  let req = makeReq({ method: 'GET', url: '/api/balance', query: { initData }})
  let res = makeRes()
  await balance(req, res)
  console.log('BALANCE', res.statusCode, res._json)

  // 2. Create invoice
  req = makeReq({ method: 'POST', url: '/api/create-invoice', body: { initData, sku: 'pack12' } })
  res = makeRes()
  await createInvoice(req, res)
  console.log('INVOICE', res.statusCode, res._json)

  // 3. Simulate webhook payment
  const payment = {
    successful_payment: {
      total_amount: 50,
      currency: 'XTR',
      provider_token: '',
      telegram_payment_charge_id: `test_charge_${Date.now()}`,
      invoice_payload: JSON.stringify({ userId: user.id, sku: 'pack12' })
    },
    message: { from: { id: user.id }, chat: { id: user.id }, text: '/start' }
  }
  req = makeReq({ method: 'POST', url: '/api/webhook', body: payment })
  res = makeRes()
  await webhook(req, res)
  console.log('WEBHOOK', res.statusCode, res._json)

  // 4. Consume 1 credit
  const tinyPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z/C/HwAF/gKxv2KfZwAAAABJRU5ErkJggg=='
  req = makeReq({ method: 'POST', url: '/api/consume', body: { initData, composite_image_base64: tinyPng, prompt: 'test', chat_id: String(user.id) } })
  res = makeRes()
  await consume(req, res)
  console.log('CONSUME', res.statusCode, res._json)

  // 5. Balance again
  req = makeReq({ method: 'GET', url: '/api/balance', query: { initData }})
  res = makeRes()
  await balance(req, res)
  console.log('BALANCE_AFTER', res.statusCode, res._json)
}

run().catch(err => { console.error('E2E ERROR', err); process.exit(1) })
