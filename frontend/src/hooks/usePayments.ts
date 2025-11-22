import { useState, useCallback } from 'react'
import { toast } from 'sonner'
import { useTMA } from '@/providers/TMAProvider'

export interface PaymentHook {
  credits: number | null
  isLoading: boolean
  isProcessing: boolean
  fetchBalance: () => Promise<void>
  createInvoice: (sku: string) => Promise<string | null>
  consumeCredits: (payload: any) => Promise<boolean>
  openPaymentModal: (sku: string) => Promise<boolean>
}

export const usePayments = (paymentsBaseUrl: string): PaymentHook => {
  const { initData, openInvoice, notificationHaptic } = useTMA()
  const [credits, setCredits] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)

  const fetchBalance = useCallback(async () => {
    if (!paymentsBaseUrl) {
      console.warn('fetchBalance: paymentsBaseUrl为空，无法获取余额')
      return
    }
    
    // 开发模式下允许无initData测试
    const isDevMode = import.meta.env.VITE_DEV_MODE === 'true' || import.meta.env.VITE_ALLOW_NON_TELEGRAM === 'true'
    const testInitData = isDevMode ? 'dev_test_init_data_123456789' : initData
    
    if (!testInitData) {
      console.warn('fetchBalance: initData为空，无法获取余额', { isDevMode, initData })
      return
    }
    
    console.log('fetchBalance: 开始获取余额', { paymentsBaseUrl, hasInitData: !!testInitData })
    setIsLoading(true)
    try {
      const url = `${paymentsBaseUrl}/api/balance?initData=${encodeURIComponent(testInitData)}`
      console.log('fetchBalance: 请求URL', url)
      const response = await fetch(url)
      const data = await response.json()
      console.log('fetchBalance: 响应数据', data)
      
      if (data.success) {
        setCredits(data.credits)
        console.log('fetchBalance: 余额获取成功', data.credits)
      } else {
        console.error('Failed to fetch balance:', data.error)
        // 开发模式下设置默认积分
        setCredits(isDevMode ? 10 : 0)
      }
    } catch (error) {
      console.error('Error fetching balance:', error)
      // 开发模式下设置默认积分
      setCredits(isDevMode ? 10 : 0)
    } finally {
      setIsLoading(false)
    }
  }, [initData, paymentsBaseUrl])

  const createInvoice = useCallback(async (sku: string): Promise<string | null> => {
    if (!paymentsBaseUrl) {
      console.error('createInvoice: paymentsBaseUrl为空', { paymentsBaseUrl, env: import.meta.env.VITE_PAYMENTS_BASE_URL })
      toast.error('支付配置错误：缺少支付基础URL')
      return null
    }

    // 开发模式下允许无initData测试
    const isDevMode = import.meta.env.VITE_DEV_MODE === 'true' || import.meta.env.VITE_ALLOW_NON_TELEGRAM === 'true'
    const testInitData = isDevMode ? 'dev_test_init_data_123456789' : initData
    
    if (!testInitData) {
      toast.error('支付配置错误：需要Telegram认证')
      return null
    }

    try {
      const response = await fetch(`${paymentsBaseUrl}/api/create-invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: testInitData, sku })
      })

      const data = await response.json()
      
      if (data.success) {
        return data.invoiceLink
      } else {
        // 开发模式下模拟支付链接
        if (isDevMode && data.error === 'Invalid initData') {
          toast.success('开发模式：模拟支付链接创建成功')
          return `https://t.me/${import.meta.env.VITE_TELEGRAM_BOT_USERNAME || '@test_bot'}?start=invoice_${Date.now()}`
        }
        toast.error(`创建发票失败: ${data.error}`)
        return null
      }
    } catch (error) {
      console.error('Error creating invoice:', error)
      toast.error('创建支付链接失败')
      return null
    }
  }, [initData, paymentsBaseUrl])

  const consumeCredits = useCallback(async (payload: any): Promise<boolean> => {
    if (!paymentsBaseUrl) {
      toast.error('支付配置错误：缺少支付基础URL')
      return false
    }

    // 开发模式下允许无initData测试
    const isDevMode = import.meta.env.VITE_DEV_MODE === 'true' || import.meta.env.VITE_ALLOW_NON_TELEGRAM === 'true'
    const testInitData = isDevMode ? 'dev_test_init_data_123456789' : initData
    
    if (!testInitData) {
      toast.error('支付配置错误：需要Telegram认证')
      return false
    }

    setIsProcessing(true)
    try {
      const response = await fetch(`${paymentsBaseUrl}/api/consume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, initData: testInitData })
      })

      const data = await response.json()
      
      if (data.success) {
        // 更新本地余额
        if (credits!==null) {
          setCredits(Math.max(0, credits - 1))
        }
        return true
      } else if (data.error === 'insufficient_credits') {
        // 开发模式下模拟积分消耗
        if (isDevMode && data.error === 'Invalid initData') {
          toast.warning('开发模式：积分不足，将使用webhook模式')
          return null // 返回null表示使用webhook模式
        }
        toast.error('积分不足，请先充值')
        return false
      } else {
        // 开发模式下模拟处理成功
        if (isDevMode && data.error === 'Invalid initData') {
          toast.success('开发模式：模拟处理成功')
          if (credits!==null) {
            setCredits(Math.max(0, credits - 1))
          }
          return true
        }
        toast.error(`处理失败: ${data.message || data.error}`)
        return false
      }
    } catch (error) {
      console.error('Error consuming credits:', error)
      // 开发模式下模拟处理成功
      if (isDevMode) {
        toast.success('开发模式：模拟处理成功（网络错误）')
        if (credits!==null) {
          setCredits(Math.max(0, credits - 1))
        }
        return true
      }
      toast.error('处理失败')
      return false
    } finally {
      setIsProcessing(false)
    }
  }, [initData, paymentsBaseUrl, credits])

  const openPaymentModal = useCallback(async (sku: string): Promise<boolean> => {
    const isDevMode = import.meta.env.VITE_DEV_MODE === 'true' || import.meta.env.VITE_ALLOW_NON_TELEGRAM === 'true'
    
    if (!openInvoice && !isDevMode) {
      toast.error('支付功能不可用')
      return false
    }

    const invoiceLink = await createInvoice(sku)
    if (!invoiceLink) {
      return false
    }

    // 开发模式下模拟支付过程
    if (isDevMode && !openInvoice) {
      toast.success('开发模式：模拟支付成功！')
      // 模拟支付成功，增加积分
      setCredits((prev) => (prev || 0) + parseInt(sku.replace('pack', '')))
      return Promise.resolve(true)
    }

    return new Promise((resolve) => {
      if (!openInvoice) {
        resolve(false)
        return
      }
      
      openInvoice(invoiceLink, (status: string) => {
        notificationHaptic('success')
        
        if (status === 'paid') {
          toast.success('支付成功！')
          // 刷新余额
          fetchBalance()
          resolve(true)
        } else if (status === 'cancelled') {
          toast.info('支付已取消')
          resolve(false)
        } else {
          toast.error('支付失败')
          resolve(false)
        }
      })
    })
  }, [openInvoice, createInvoice, notificationHaptic, fetchBalance])

  return {
    credits,
    isLoading,
    isProcessing,
    fetchBalance,
    createInvoice,
    consumeCredits,
    openPaymentModal
  }
}