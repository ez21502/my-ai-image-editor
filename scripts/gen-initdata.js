const crypto = require('crypto')

const token = process.env.TELEGRAM_BOT_TOKEN
if (!token) {
  console.error('Missing TELEGRAM_BOT_TOKEN in env')
  process.exit(1)
}

const user = {
  id: Number(process.env.TEST_USER_ID || 1740576312),
  first_name: 'Test',
  username: 'test_user'
}

const params = new URLSearchParams()
params.set('auth_date', String(Math.floor(Date.now() / 1000)))
params.set('query_id', 'AAEAAA')
params.set('user', JSON.stringify(user))

const keys = Array.from(params.keys()).sort()
const dataCheckString = keys.map(k => `${k}=${params.get(k)}`).join('\n')
const secret = crypto.createHmac('sha256', 'WebAppData').update(token).digest()
const hmac = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex')
params.set('hash', hmac)

console.log(params.toString())
