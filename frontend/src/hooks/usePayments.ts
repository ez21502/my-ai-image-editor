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

// 安全提取错误消息的辅助函数
const extractErrorMessage = (error: any): string => {
  if (!error) return '未知错误'
  
  // 如果是字符串，直接返回
  if (typeof error === 'string') return error
  
  // 如果是 Error 对象，返回 message
  if (error instanceof Error) return error.message
  
  // 如果是对象，尝试提取常见字段
  if (typeof error === 'object') {
    // 尝试提取 details 字段
    if (error.details) {
      const detailsMsg = extractErrorMessage(error.details)
      if (detailsMsg !== '未知错误') return detailsMsg
    }
    
    // 尝试提取 error 字段
    if (error.error) {
      const errorMsg = extractErrorMessage(error.error)
      if (errorMsg !== '未知错误') return errorMsg
    }
    
    // 尝试提取 message 字段
    if (error.message) {
      const message = extractErrorMessage(error.message)
      if (message !== '未知错误') return message
    }
    
    // 尝试提取 description 字段
    if (error.description) {
      const desc = extractErrorMessage(error.description)
      if (desc !== '未知错误') return desc
    }
    
    // 如果都没有，尝试 JSON 序列化（但限制长度）
    try {
      const jsonStr = JSON.stringify(error)
      return jsonStr.length > 200 ? jsonStr.substring(0, 200) + '...' : jsonStr
    } catch {
      return '未知错误（无法解析错误信息）'
    }
  }
  
  // 其他情况，转换为字符串
  return String(error)
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
    
    if (!initData) {
      console.warn('fetchBalance: initData为空，无法获取余额')
      return
    }
    
    console.log('fetchBalance: 开始获取余额', { paymentsBaseUrl, hasInitData: !!initData })
    setIsLoading(true)
    try {
      const url = `${paymentsBaseUrl}/balance?initData=${encodeURIComponent(initData)}`
      console.log('fetchBalance: 请求URL', url)
      const response = await fetch(url)
      const data = await response.json()
      console.log('fetchBalance: 响应数据', data)
      
      if (data.success) {
        setCredits(data.credits)
        console.log('fetchBalance: 余额获取成功', data.credits)
      } else {
        console.error('Failed to fetch balance:', data.error)
        setCredits(0)
      }
    } catch (error) {
      console.error('Error fetching balance:', error)
      setCredits(0)
    } finally {
      setIsLoading(false)
    }
  }, [initData, paymentsBaseUrl])

  const createInvoice = useCallback(async (sku: string, retryCount = 0): Promise<string | null> => {
    const MAX_RETRIES = 2
    const RETRY_DELAY = 1000 // 1秒
    
    if (!paymentsBaseUrl) {
      console.error('createInvoice: paymentsBaseUrl为空', { 
        paymentsBaseUrl, 
        env: import.meta.env.VITE_PAYMENTS_BASE_URL 
      })
      toast.error('支付配置错误：缺少支付基础URL', {
        description: '请检查环境变量 VITE_PAYMENTS_BASE_URL 是否正确配置'
      })
      return null
    }

    if (!initData) {
      toast.error('支付配置错误：需要Telegram认证', {
        description: '请在Telegram环境中使用此功能'
      })
      return null
    }

    try {
      const apiUrl = `${paymentsBaseUrl}/create-invoice`
      console.log('createInvoice: 请求创建发票', { 
        apiUrl, 
        sku, 
        hasInitData: !!initData,
        retryCount
      })

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ initData, sku })
      })

      // 检查响应状态
      if (!response.ok) {
        const errorText = await response.text()
        let errorData
        try {
          errorData = JSON.parse(errorText)
        } catch {
          errorData = { error: errorText || `HTTP ${response.status}` }
        }

        console.error('createInvoice: API返回错误', {
          status: response.status,
          statusText: response.statusText,
          error: errorData
        })

        // 如果是网络错误且还有重试次数，进行重试
        if (response.status >= 500 && retryCount < MAX_RETRIES) {
          console.log(`createInvoice: 服务器错误，${RETRY_DELAY}ms后重试 (${retryCount + 1}/${MAX_RETRIES})`)
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY))
          return createInvoice(sku, retryCount + 1)
        }

        // 安全提取错误消息
        const errorMessage = extractErrorMessage(errorData.details || errorData.error || errorData || `HTTP ${response.status}`)
        const errorDescription = errorData.error && typeof errorData.error === 'string' && errorData.error !== errorMessage 
          ? errorData.error 
          : undefined
        
        console.error('createInvoice: API返回错误详情', {
          status: response.status,
          statusText: response.statusText,
          errorData,
          extractedMessage: errorMessage
        })
        
        toast.error(`创建发票失败: ${errorMessage}`, {
          description: errorDescription
        })
        return null
      }

      const data = await response.json()
      console.log('createInvoice: API响应', { success: data.success, hasInvoiceLink: !!data.invoiceLink })
      
      if (data.success && data.invoiceLink) {
        console.log('createInvoice: 发票创建成功', { invoiceLink: data.invoiceLink.substring(0, 50) + '...' })
        return data.invoiceLink
      } else {
        // 安全提取错误消息
        const errorMessage = extractErrorMessage(data.details || data.error || data || '未知错误')
        console.error('createInvoice: API返回失败', { 
          error: errorMessage, 
          rawData: data,
          extractedMessage: errorMessage
        })
        toast.error(`创建发票失败: ${errorMessage}`)
        return null
      }
    } catch (error) {
      console.error('createInvoice: 网络错误', { 
        error: error instanceof Error ? error.message : String(error),
        sku,
        retryCount
      })

      // 如果是网络错误且还有重试次数，进行重试
      if (retryCount < MAX_RETRIES) {
        console.log(`createInvoice: 网络错误，${RETRY_DELAY}ms后重试 (${retryCount + 1}/${MAX_RETRIES})`)
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY))
        return createInvoice(sku, retryCount + 1)
      }

      const errorMessage = error instanceof Error ? error.message : '网络连接失败'
      toast.error('创建支付链接失败', {
        description: `${errorMessage}。请检查网络连接后重试。`
      })
      return null
    }
  }, [initData, paymentsBaseUrl])

  const consumeCredits = useCallback(async (payload: any): Promise<boolean> => {
    if (!paymentsBaseUrl) {
      toast.error('支付配置错误：缺少支付基础URL')
      return false
    }

    if (!initData) {
      toast.error('支付配置错误：需要Telegram认证')
      return false
    }

    setIsProcessing(true)
    try {
      const response = await fetch(`${paymentsBaseUrl}/consume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, initData })
      })

      const data = await response.json()
      
      if (data.success) {
        // 更新本地余额
        if (credits!==null) {
          setCredits(Math.max(0, credits - 1))
        }
        return true
      } else if (data.error === 'insufficient_credits') {
        toast.error('积分不足，请先充值')
        return false
      } else {
        toast.error(`处理失败: ${data.message || data.error}`)
        return false
      }
    } catch (error) {
      console.error('Error consuming credits:', error)
      toast.error('处理失败')
      return false
    } finally {
      setIsProcessing(false)
    }
  }, [initData, paymentsBaseUrl, credits])

  const openPaymentModal = useCallback(async (sku: string): Promise<boolean> => {
    if (!openInvoice) {
      toast.error('支付功能不可用', {
        description: '请在Telegram环境中使用此功能'
      })
      return false
    }

    console.log('openPaymentModal: 开始创建支付链接', { sku, hasOpenInvoice: !!openInvoice })

    try {
      const invoiceLink = await createInvoice(sku)
      if (!invoiceLink) {
        console.error('openPaymentModal: 创建支付链接失败')
        return false
      }

      console.log('openPaymentModal: 支付链接创建成功', { invoiceLink: invoiceLink.substring(0, 50) + '...' })

      if (!openInvoice) {
        console.error('openPaymentModal: openInvoice函数不可用')
        toast.error('支付功能不可用', {
          description: '无法打开支付窗口，请确保在Telegram环境中使用'
        })
        return false
      }

      // 验证发票链接格式
      if (!invoiceLink || typeof invoiceLink !== 'string' || !invoiceLink.startsWith('https://')) {
        console.error('openPaymentModal: 无效的发票链接格式', { invoiceLink })
        toast.error('支付链接无效', {
          description: '发票链接格式不正确，请重试'
        })
        return false
      }

      return new Promise((resolve) => {
        console.log('openPaymentModal: 打开支付窗口', { 
          invoiceLink: invoiceLink.substring(0, 50) + '...',
          linkLength: invoiceLink.length
        })
        
        try {
          openInvoice(invoiceLink, (status: string) => {
            console.log('openPaymentModal: 支付状态回调', { status })
            
            if (status === 'paid') {
              notificationHaptic('success')
              toast.success('支付成功！', {
                description: '积分已添加到您的账户'
              })
              // 刷新余额
              setTimeout(() => {
                fetchBalance()
              }, 1000) // 延迟一点确保后端已处理
              resolve(true)
            } else if (status === 'cancelled') {
              notificationHaptic('warning')
              toast.info('支付已取消')
              resolve(false)
            } else {
              console.error('openPaymentModal: 支付失败', { status })
              notificationHaptic('error')
              toast.error('支付失败', {
                description: `支付状态: ${status}`
              })
              resolve(false)
            }
          })
        } catch (error) {
          console.error('openPaymentModal: 打开支付窗口时出错', { 
            error: error instanceof Error ? error.message : String(error),
            invoiceLink: invoiceLink.substring(0, 50) + '...'
          })
          notificationHaptic('error')
          toast.error('无法打开支付窗口', {
            description: error instanceof Error ? error.message : '未知错误'
          })
          resolve(false)
        }
      })
    } catch (error) {
      console.error('openPaymentModal: 意外错误', { 
        error: error instanceof Error ? error.message : String(error),
        sku 
      })
      toast.error('支付过程出错', {
        description: error instanceof Error ? error.message : '未知错误'
      })
      return false
    }
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