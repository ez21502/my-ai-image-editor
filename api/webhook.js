const { SUPABASE, addCredits, ensureUserWithWelcomeCredit } = require('./_shared')
const { createLogger, logAudit } = require('./_shared')
const { corsMiddleware, handleOptions } = require('./_cors')

module.exports = async (req, res) => {
  const requestId = Math.random().toString(36).substr(2, 9)
  const logger = createLogger('webhook', requestId)
  corsMiddleware(req, res, () => {})
  if (req.method === 'OPTIONS') {
    return handleOptions(req, res)
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  const update = req.body
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  res.status(200).json({ ok: true })
  ;(async () => {
    try {
      if (botToken && update?.pre_checkout_query?.id) {
        try {
          await fetch(`https://api.telegram.org/bot${botToken}/answerPreCheckoutQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pre_checkout_query_id: update.pre_checkout_query.id, ok: true })
          })
        } catch {}
      }
      const payment = update?.successful_payment
      if (!payment) {
        return
      }
      let payload = {}
      try { payload = JSON.parse(payment.invoice_payload || '{}') } catch {}
      const userId = payload.userId
      const sku = payload.sku
      if (!userId || !sku) {
        return
      }
      const mapping = require('./_shared').SKU_MAP[sku]
      if (!mapping) {
        return
      }
      const { data: existingPayment } = await SUPABASE
        .from('payments')
        .select('id')
        .eq('payment_ref', payment.telegram_payment_charge_id)
        .limit(1)
        .maybeSingle()
      if (existingPayment) {
        return
      }
      if (payment.total_amount !== mapping.xtr) {
        return
      }
      if (payment.currency !== 'XTR') {
        return
      }
      if (payment.provider_token !== '' && payment.provider_token !== undefined) {
        return
      }
      let newBalance = null
      try {
        const { error: paymentError } = await SUPABASE.from('payments').insert({
          telegram_user_id: userId,
          xtr_amount: mapping.xtr,
          credits_added: mapping.credits,
          paid_at: new Date().toISOString(),
          payment_ref: payment.telegram_payment_charge_id,
          payload: payment,
          status: 'completed'
        })
        if (paymentError) {
          throw new Error(paymentError.message)
        }
        await ensureUserWithWelcomeCredit(userId)
        newBalance = await addCredits(userId, mapping.credits)
        logAudit({ userId, action: 'payment_processed', details: { creditsAdded: mapping.credits, xtrAmount: mapping.xtr, sku, paymentChargeId: payment.telegram_payment_charge_id, newBalance } })
      } catch (e) {
        await SUPABASE.from('payments').update({ status: 'failed', error: e.message }).eq('payment_ref', payment.telegram_payment_charge_id).catch(() => {})
        return
      }
      if (botToken && update.message?.chat?.id) {
        const messageText = `✅ 支付成功！\n\n您已成功购买 ${mapping.credits} 算力点。\n当前余额：${newBalance} 算力点\n\n感谢您的支持！🎉`
        try {
          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: update.message.chat.id, text: messageText, parse_mode: 'HTML' }) })
        } catch {}
      }
    } catch {}
  })()
}
