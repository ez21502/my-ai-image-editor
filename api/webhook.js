const { SUPABASE, verifyInitData, getUserIdFromInitData, addCredits } = require('./_shared')
const { createLogger, logAudit } = require('./_shared')
const { corsMiddleware, handleOptions } = require('./_cors')

module.exports = async (req, res) => {
  const requestId = Math.random().toString(36).substr(2, 9)
  const logger = createLogger('webhook', requestId)
  
  // 应用 CORS 中间件
  corsMiddleware(req, res, () => {})
  
  // 处理 OPTIONS 预检请求
  if (req.method === 'OPTIONS') {
    return handleOptions(req, res)
  }
  
  if (req.method !== 'POST') {
    logger.warn('Method not allowed', { method: req.method })
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // 获取 Telegram 发送的更新数据
    const update = req.body
    
    if (!update || !update.successful_payment) {
      logger.warn('Missing payment data in webhook', { update: update ? 'present' : 'missing' })
      return res.status(400).json({ error: 'Missing payment data' })
    }

    // 验证支付来源 - 确保是来自正确的Telegram Bot
    const botToken = process.env.TELEGRAM_BOT_TOKEN
    if (!botToken) {
      logger.error('Missing TELEGRAM_BOT_TOKEN configuration')
      return res.status(500).json({ error: 'Server configuration error' })
    }

    const payment = update.successful_payment
    const payload = JSON.parse(payment.invoice_payload || '{}')
    const userId = payload.userId
    const sku = payload.sku

    if (!userId || !sku) {
      logger.error('Invalid payment payload', { 
        userId, 
        sku, 
        invoicePayload: payment.invoice_payload 
      })
      return res.status(400).json({ error: 'Invalid payment payload' })
    }

    // 验证支付用户信息 - 确保支付的用户与invoice_payload中的userId一致
    const payingUserId = update.message?.from?.id
    if (payingUserId && payingUserId !== userId) {
      logger.error('Payment user mismatch', { 
        payingUserId, 
        invoiceUserId: userId,
        message: 'User ID in payment does not match invoice payload' 
      })
      return res.status(400).json({ error: 'Payment user mismatch' })
    }

    logger.info('Processing payment webhook', { 
      userId, 
      sku, 
      paymentChargeId: payment.telegram_payment_charge_id,
      xtrAmount: payment.total_amount 
    })

    // 验证支付信息
    const mapping = require('./_shared').SKU_MAP[sku]
    if (!mapping) {
      logger.error('Invalid SKU in payment', { sku, availableSkus: Object.keys(require('./_shared').SKU_MAP) })
      return res.status(400).json({ error: 'Invalid SKU' })
    }

    // 检查是否已经处理过这个支付（防止重复处理）
    const { data: existingPayment } = await SUPABASE
      .from('payments')
      .select('id')
      .eq('payment_ref', payment.telegram_payment_charge_id)
      .limit(1)
      .maybeSingle()

    if (existingPayment) {
      logger.info('Payment already processed', { paymentChargeId: payment.telegram_payment_charge_id })
      return res.status(200).json({ success: true, message: 'Payment already processed' })
    }

    // 验证支付金额与SKU是否匹配
    const expectedAmount = mapping.xtr // Telegram Stars use direct amount, not smallest unit
    if (payment.total_amount !== expectedAmount) {
      logger.error('Payment amount mismatch', { 
        expectedAmount, 
        actualAmount: payment.total_amount,
        sku,
        expectedXTR: mapping.xtr
      })
      return res.status(400).json({ error: 'Payment amount mismatch' })
    }

    // 验证货币 - 确保是 Telegram Stars
    if (payment.currency !== 'XTR') {
      logger.error('Invalid payment currency', { 
        currency: payment.currency,
        expected: 'XTR'
      })
      return res.status(400).json({ error: 'Invalid payment currency' })
    }

    // 验证支付提供商 - Stars 支付使用空字符串
    if (payment.provider_token !== '' && payment.provider_token !== undefined) {
      logger.error('Invalid payment provider for Stars', { 
        provider: payment.provider_token,
        expected: 'empty string for Stars payments'
      })
      return res.status(400).json({ error: 'Invalid payment provider for Stars' })
    }

    // 记录支付信息 - 使用事务式处理
    let paymentRecorded = false
    let creditsAdded = false
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
        throw new Error(`Payment recording failed: ${paymentError.message}`)
      }
      
      paymentRecorded = true
      logger.info('Payment recorded successfully', { userId, creditsAdded: mapping.credits, xtrAmount: mapping.xtr })

      // 为用户添加积分
      newBalance = await addCredits(userId, mapping.credits)
      creditsAdded = true

      logAudit({
        userId,
        action: 'payment_processed',
        details: { 
          creditsAdded: mapping.credits, 
          xtrAmount: mapping.xtr, 
          sku,
          paymentChargeId: payment.telegram_payment_charge_id,
          newBalance
        }
      })

    } catch (error) {
      // 如果支付记录成功但积分添加失败，需要回滚
      if (paymentRecorded && !creditsAdded) {
        logger.error('Payment processing failed after recording payment - manual intervention required', {
          userId,
          paymentChargeId: payment.telegram_payment_charge_id,
          creditsToAdd: mapping.credits,
          error: error.message
        })
        
        // 标记支付为失败状态以便后续处理
        await SUPABASE.from('payments')
          .update({ status: 'failed', error: error.message })
          .eq('payment_ref', payment.telegram_payment_charge_id)
          .catch(rollbackError => {
            logger.error('Failed to rollback payment status', {
              userId,
              paymentChargeId: payment.telegram_payment_charge_id,
              rollbackError: rollbackError.message
            })
          })
      }
      
      logger.error('Payment processing failed', { 
        userId, 
        paymentChargeId: payment.telegram_payment_charge_id, 
        error: error.message 
      })
      return res.status(500).json({ error: 'Payment processing failed' })
    }

    // 处理推荐奖励
    const startParam = update.message?.text || ''
    if (startParam && startParam.startsWith('/start ref_')) {
      const inviterId = parseInt(startParam.replace('/start ref_', ''))
      if (inviterId && inviterId !== userId) {
        logger.info('Processing referral from payment webhook', { userId, inviterId, startParam })
        
        try {
          // 检查是否已经记录过推荐关系
          const { data: existingReferral } = await SUPABASE
            .from('referrals')
            .select('id')
            .eq('invitee_id', userId)
            .limit(1)
            .maybeSingle()

          if (!existingReferral) {
            // 记录推荐关系
            await SUPABASE.from('referrals').insert({
              inviter_id: inviterId,
              invitee_id: userId
            })

            // 为推荐人添加奖励积分
            const inviterNewBalance = await addCredits(inviterId, 1)
            
            logAudit({
              userId: inviterId,
              action: 'referral_reward_from_payment_webhook',
              details: { 
                inviteeId: userId, 
                creditsAdded: 1,
                newBalance: inviterNewBalance
              }
            })
            
            logger.info('Referral reward granted from payment webhook', { userId: inviterId, inviteeId: userId, rewardCredits: 1 })
          } else {
            logger.info('Referral already exists', { userId, inviterId })
          }
        } catch (referralError) {
          logger.error('Failed to process referral from payment webhook', { userId, inviterId, error: referralError.message })
          // 继续处理，不因推荐失败而影响主支付流程
        }
      }
    }

    // 发送成功消息给用户
    if (update.message?.chat?.id) {
      const messageText = `✅ 支付成功！\n\n您已成功购买 ${mapping.credits} 算力点。\n当前余额：${newBalance} 算力点\n\n感谢您的支持！🎉`
      
      try {
        const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: update.message.chat.id,
            text: messageText,
            parse_mode: 'HTML'
          })
        })
        
        if (!response.ok) {
          const errorData = await response.text()
          logger.error('Failed to send success message', { 
            userId, 
            chatId: update.message.chat.id, 
            status: response.status,
            error: errorData 
          })
        } else {
          logger.info('Success message sent to user', { userId, chatId: update.message.chat.id })
        }
      } catch (err) {
        logger.error('Exception while sending success message', { userId, chatId: update.message.chat.id, error: err.message })
      }
    } else {
      logger.warn('Cannot send success message - missing bot token or chat ID', { 
        hasBotToken: !!botToken, 
        hasChatId: !!update.message?.chat?.id 
      })
    }

    logger.info('Payment webhook completed successfully', { 
      userId, 
      creditsAdded: mapping.credits, 
      newBalance: newBalance || 'unknown', 
      paymentChargeId: payment.telegram_payment_charge_id 
    })

    return res.status(200).json({ 
      success: true, 
      message: 'Payment processed successfully',
      credits_added: mapping.credits,
      new_balance: newBalance
    })

  } catch (error) {
    logger.error('Payment webhook failed', { userId, error: error.message, stack: error.stack })
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    })
  }
}
