import React, { useEffect, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

interface TelegramUser { 
  id: number; 
  first_name?: string; 
  last_name?: string; 
  username?: string; 
  language_code?: string; 
  is_premium?: boolean 
}

interface TelegramWebApp { 
  initDataUnsafe: { 
    user?: TelegramUser; 
    query_id?: string; 
    auth_date?: string; 
    hash?: string; 
    start_param?: string 
  }; 
  initData?: string; 
  ready: () => void; 
  expand?: () => void; 
  close: () => void; 
  viewportHeight?: number;
  viewportStableHeight?: number;
  MainButton?: { 
    setText: (text: string) => void; 
    show: () => void; 
    hide: () => void; 
    onClick: (callback: () => void) => void; 
    offClick: (callback: () => void) => void 
  }; 
  BackButton?: { 
    show: () => void; 
    hide: () => void; 
    onClick: (callback: () => void) => void; 
    offClick: (callback: () => void) => void 
  }; 
  HapticFeedback?: { 
    impactOccurred: (style: 'light'|'medium'|'heavy'|'rigid'|'soft') => void; 
    notificationOccurred: (type: 'error'|'success'|'warning') => void; 
    selectionChanged: () => void 
  }; 
  openInvoice?: (link: string, cb?: (status: string) => void) => void; 
  onEvent?: (event: string, cb: (data?: any) => void) => void; 
  offEvent?: (event: string) => void 
}

interface TMAContextType { 
  user: TelegramUser | null; 
  webApp: TelegramWebApp | null; 
  isInTelegram: boolean; 
  platform: string; 
  ready: boolean; 
  initData: string | null; 
  startParam?: string; 
  viewportHeight: number;
  viewportStableHeight: number;
  showMainButton: (text: string, onClick: () => void) => void; 
  hideMainButton: () => void; 
  showBackButton: (onClick: () => void) => void; 
  hideBackButton: () => void; 
  impactHaptic: (style: 'light'|'medium'|'heavy'|'rigid'|'soft') => void; 
  notificationHaptic: (type: 'error'|'success'|'warning') => void; 
  openInvoice: (link: string, cb?: (status: string) => void) => void; 
  onInvoiceClosed: (cb: (data?: any) => void) => void 
}

const TMAContext = React.createContext<TMAContextType | undefined>(undefined)
const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 60 * 1000 } } })

export const TMAProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<TelegramUser | null>(null)
  const [webApp, setWebApp] = useState<TelegramWebApp | null>(null)
  const [isInTelegram, setIsInTelegram] = useState(false)
  const [platform, setPlatform] = useState('web')
  const [ready, setReady] = useState(false)
  const [initData, setInitData] = useState<string | null>(null)
  const [startParam, setStartParam] = useState<string | undefined>(undefined)
  const [viewportHeight, setViewportHeight] = useState<number>(0)
  const [viewportStableHeight, setViewportStableHeight] = useState<number>(0)

  useEffect(() => {
    const initializeTMA = () => {
      // 改进的Telegram环境检测：支持桌面端
      const isTelegramDesktop = () => {
        // 检查Telegram桌面端的特征
        const userAgent = navigator.userAgent.toLowerCase()
        const isTelegramUA = userAgent.includes('telegram') || userAgent.includes('tgwebview')
        
        // 检查URL参数
        const urlParams = new URLSearchParams(window.location.search)
        const hasTelegramParams = urlParams.has('tgWebAppData') || urlParams.has('tgWebAppVersion') || urlParams.has('tgWebAppPlatform')
        
        // 检查window对象中的Telegram相关属性
        const hasTelegramObject = !!window.Telegram?.WebApp
        const hasTelegramProperties = 'TelegramWebviewProxy' in window || 'TelegramWebviewProxyProto' in window
        
        // 检查referrer
        const referrer = document.referrer.toLowerCase()
        const isFromTelegram = referrer.includes('telegram') || referrer.includes('t.me')
        
        // Telegram桌面端通常有window.Telegram对象，即使WebApp可能不完全初始化
        return isTelegramUA || hasTelegramParams || hasTelegramObject || hasTelegramProperties || isFromTelegram
      }

      if (window.Telegram?.WebApp) {
        const tg = window.Telegram.WebApp
        setWebApp(tg)
        setIsInTelegram(true)
        
        if (tg.initDataUnsafe?.user) {
          setUser(tg.initDataUnsafe.user)
        }
        
        try {
          if (tg.initData) {
            setInitData(tg.initData)
          }
        } catch {}
        
        try {
          let sp: string | undefined = undefined
          if (tg.initDataUnsafe && (tg.initDataUnsafe as any).start_param) {
            sp = (tg.initDataUnsafe as any).start_param
          }
          if (!sp && tg.initData) {
            const p = new URLSearchParams(tg.initData)
            const v = p.get('start_param') || p.get('startapp')
            if (v) {
              sp = v
            }
          }
          setStartParam(sp)
        } catch {}
        
        try {
          if ((tg as any).expand && typeof (tg as any).expand === 'function') {
            (tg as any).expand()
          }
        } catch {}
        
        // 获取视口信息
        try {
          const vh = (tg as any).viewportHeight || window.innerHeight
          const vsh = (tg as any).viewportStableHeight || window.innerHeight
          setViewportHeight(vh)
          setViewportStableHeight(vsh)
        } catch {}
        
        // 监听视口变化事件
        try {
          if ((tg as any).onEvent && typeof (tg as any).onEvent === 'function') {
            (tg as any).onEvent('viewportChanged', (data: any) => {
              if (data && typeof data.height === 'number') {
                setViewportHeight(data.height)
                setViewportStableHeight(data.height)
              }
            })
          }
        } catch {}
        
        tg.ready()
        setReady(true)
      } else {
        // 检查是否是Telegram桌面端（可能没有完整的WebApp对象）
        const isTelegramDesktop = () => {
          const userAgent = navigator.userAgent.toLowerCase()
          const isTelegramUA = userAgent.includes('telegram') || userAgent.includes('tgwebview')
          const urlParams = new URLSearchParams(window.location.search)
          const hasTelegramParams = urlParams.has('tgWebAppData') || urlParams.has('tgWebAppVersion') || urlParams.has('tgWebAppPlatform')
          const hasTelegramObject = !!window.Telegram
          const hasTelegramProperties = 'TelegramWebviewProxy' in window || 'TelegramWebviewProxyProto' in window
          const referrer = document.referrer.toLowerCase()
          const isFromTelegram = referrer.includes('telegram') || referrer.includes('t.me')
          return isTelegramUA || hasTelegramParams || hasTelegramObject || hasTelegramProperties || isFromTelegram
        }
        
        if (isTelegramDesktop()) {
          // Telegram桌面端：即使没有完整的WebApp对象，也标记为在Telegram环境中
          console.log('检测到Telegram桌面端环境')
          setIsInTelegram(true)
          setReady(true)
        } else {
          setIsInTelegram(false)
          setReady(true)
        }
      }
    }
    
    if (window.Telegram?.WebApp) {
      initializeTMA()
    } else {
      let checkCount = 0
      const maxChecks = 50
      const checkTelegram = () => {
        checkCount++
        if (window.Telegram?.WebApp) {
          initializeTMA()
        } else if (checkCount < maxChecks) {
          setTimeout(checkTelegram, 100)
        } else {
          // 最终检查：可能是Telegram桌面端
          const isTelegramDesktop = () => {
            const userAgent = navigator.userAgent.toLowerCase()
            const isTelegramUA = userAgent.includes('telegram') || userAgent.includes('tgwebview')
            const urlParams = new URLSearchParams(window.location.search)
            const hasTelegramParams = urlParams.has('tgWebAppData') || urlParams.has('tgWebAppVersion') || urlParams.has('tgWebAppPlatform')
            const hasTelegramObject = !!window.Telegram
            const hasTelegramProperties = 'TelegramWebviewProxy' in window || 'TelegramWebviewProxyProto' in window
            const referrer = document.referrer.toLowerCase()
            const isFromTelegram = referrer.includes('telegram') || referrer.includes('t.me')
            return isTelegramUA || hasTelegramParams || hasTelegramObject || hasTelegramProperties || isFromTelegram
          }
          
          if (isTelegramDesktop()) {
            console.log('检测到Telegram桌面端环境（延迟检测）')
            setIsInTelegram(true)
          } else {
            setIsInTelegram(false)
          }
          setReady(true)
        }
      }
      setTimeout(checkTelegram, 500)
    }
  }, [])

  const showMainButton = (text: string, onClick: () => void) => {
    if (webApp?.MainButton) {
      webApp.MainButton.setText(text)
      webApp.MainButton.onClick(onClick)
      webApp.MainButton.show()
    }
  }

  const hideMainButton = () => {
    if (webApp?.MainButton) {
      webApp.MainButton.hide()
    }
  }

  const showBackButton = (onClick: () => void) => {
    if (webApp?.BackButton) {
      webApp.BackButton.onClick(onClick)
      webApp.BackButton.show()
    }
  }

  const hideBackButton = () => {
    if (webApp?.BackButton) {
      webApp.BackButton.hide()
    }
  }

  const impactHaptic = (style: 'light'|'medium'|'heavy'|'rigid'|'soft') => {
    if (webApp?.HapticFeedback) {
      webApp.HapticFeedback.impactOccurred(style)
    }
  }

  const notificationHaptic = (type: 'error'|'success'|'warning') => {
    if (webApp?.HapticFeedback) {
      webApp.HapticFeedback.notificationOccurred(type)
    }
  }

  const openInvoice = (link: string, cb?: (status: string) => void) => {
    if (webApp?.openInvoice) {
      webApp.openInvoice(link, cb)
    }
  }

  const onInvoiceClosed = (cb: (data?: any) => void) => {
    if (webApp?.onEvent) {
      webApp.onEvent('invoiceClosed', cb)
    }
  }

  const contextValue: TMAContextType = {
    user,
    webApp,
    isInTelegram,
    platform,
    ready,
    initData,
    startParam,
    viewportHeight,
    viewportStableHeight,
    showMainButton,
    hideMainButton,
    showBackButton,
    hideBackButton,
    impactHaptic,
    notificationHaptic,
    openInvoice,
    onInvoiceClosed
  }

  return (
    <TMAContext.Provider value={contextValue}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </TMAContext.Provider>
  )
}

export const useTMA = () => {
  const context = React.useContext(TMAContext)
  if (context === undefined) {
    throw new Error('useTMA must be used within a TMAProvider')
  }
  return context
}