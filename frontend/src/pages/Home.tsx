import { useState, useRef, useCallback, useEffect } from 'react'
import * as fabric from 'fabric'
import { Upload, Image as ImageIcon, Undo2, Trash2, X, Maximize2, Minimize2, Star } from 'lucide-react'
import { Toaster, toast } from 'sonner'
import { promptManager } from '@/utils/promptManager'
import { useTMA } from '@/providers/TMAProvider'
import { usePayments } from '@/hooks/usePayments'
import { Modal } from '@/components/TMAModal'
import { Button } from '@/components/TMAButton'

interface TelegramUser { id: number; first_name?: string; last_name?: string; username?: string }
interface TelegramWebApp { initDataUnsafe: { user?: TelegramUser }; initData?: string; ready: () => void; close: () => void }
declare global { interface Window { Telegram: { WebApp: TelegramWebApp } } }

export default function Home() {
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [brushSize, setBrushSize] = useState(15)
  const [currentPrompt, setCurrentPrompt] = useState(() => {
    try { const prompt = promptManager.getCurrentPrompt(); return prompt } catch { return 'a beautiful enhancement, high quality, detailed' }
  })
  const [isDrawing, setIsDrawing] = useState(false)
  const [telegramUserId, setTelegramUserId] = useState<number | null>(null)
  const [isCanvasReady, setIsCanvasReady] = useState(false)
  const [isRepaintComplete, setIsRepaintComplete] = useState(false)
  const [maskObjectCount, setMaskObjectCount] = useState(0)
  const [isInTelegram, setIsInTelegram] = useState(false)
  const [showInstructions, setShowInstructions] = useState(true)
  const [isFullscreenMode, setIsFullscreenMode] = useState(false)
  const [canvasScale, setCanvasScale] = useState(1)
  const [isTelegramSDKLoaded, setIsTelegramSDKLoaded] = useState(false)
  const [isDevEnvironment] = useState(() => { return import.meta.env.DEV || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' })
  const { isInTelegram: inTgFromProvider, initData, startParam, openInvoice, onInvoiceClosed, notificationHaptic } = useTMA()
  const [showTopUp, setShowTopUp] = useState(false)
  // 使用默认后端URL，如果环境变量未设置
  // 生产环境默认使用相对路径（同一域名），开发环境使用 localhost
  const paymentsBaseUrl = (import.meta.env.VITE_PAYMENTS_BASE_URL as string) || (import.meta.env.DEV ? 'http://localhost:3000/api' : '/api')
  
  // 使用统一的支付钩子
  const { credits, isLoading: isPaymentLoading, fetchBalance, createInvoice, consumeCredits } = usePayments(paymentsBaseUrl)

  const isTelegramEnvironment = useCallback(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const hasTelegramParams = urlParams.has('tgWebAppData') || urlParams.has('tgWebAppVersion') || urlParams.has('tgWebAppPlatform')
    const userAgent = navigator.userAgent.toLowerCase()
    const isTelegramUA = userAgent.includes('telegram') || userAgent.includes('tgwebview')
    const hasTelegramObject = !!window.Telegram?.WebApp
    const hasTelegramProperties = 'TelegramWebviewProxy' in window || 'TelegramWebviewProxyProto' in window
    const referrer = document.referrer.toLowerCase()
    const isFromTelegram = referrer.includes('telegram') || referrer.includes('t.me')
    const currentUrl = window.location.href.toLowerCase()
    const isTelegramUrl = currentUrl.includes('telegram') || currentUrl.includes('t.me')
    const hostname = window.location.hostname.toLowerCase()
    const isKnownDeployment = hostname.includes('netlify.app') || hostname.includes('vercel.app') || hostname.includes('herokuapp') || hostname.includes('github.io')
    const hasDesktopProperties = 'Telegram' in window || 'TelegramWebview' in window
    const hash = window.location.hash
    const hasTelegramHash = hash.includes('tgWebAppData') || hash.includes('tgWebAppVersion')
    const isProductionTelegramEnv = isKnownDeployment && (isFromTelegram || isTelegramUA || hasTelegramParams || hasTelegramHash || hasTelegramObject || hasDesktopProperties)
    return hasTelegramParams || isTelegramUA || hasTelegramObject || hasTelegramProperties || isFromTelegram || isTelegramUrl || isProductionTelegramEnv || hasDesktopProperties || hasTelegramHash
  }, [])

  useEffect(() => { if (telegramUserId === 123456789) { setTelegramUserId(null) } try { const s = localStorage.getItem('test_telegram_user_id'); if (s) { localStorage.removeItem('test_telegram_user_id') } } catch {} }, [])
  useEffect(() => { if (uploadedImage) {} }, [uploadedImage])
  useEffect(() => { if (inTgFromProvider && initData) { fetchBalance() } }, [inTgFromProvider, initData, fetchBalance])
  useEffect(() => { onInvoiceClosed((data) => { fetchBalance(); notificationHaptic('success') }) }, [onInvoiceClosed, notificationHaptic, fetchBalance])
  useEffect(() => { return () => {} }, [])
  useEffect(() => {
    const handleResize = () => {
      if (fabricCanvasRef.current && originalImageRef.current) {
        const viewportWidth = window.innerWidth
        const viewportHeight = window.innerHeight
        const img = originalImageRef.current
        const isMobile = viewportWidth <= 768
        let maxWidth, maxHeight
        if (isMobile) { maxWidth = Math.min(img.width, viewportWidth - 40); maxHeight = Math.min(img.height, viewportHeight * 0.6) } else { maxWidth = 800; maxHeight = 600 }
        const newScale = Math.min(maxWidth / img.width, maxHeight / img.height)
        const newCanvasWidth = img.width * newScale
        const newCanvasHeight = img.height * newScale
        fabricCanvasRef.current.setDimensions({ width: newCanvasWidth, height: newCanvasHeight })
        if (fabricCanvasRef.current.backgroundImage) { fabricCanvasRef.current.backgroundImage.set({ scaleX: newScale, scaleY: newScale }) }
        setCanvasScale(newScale)
        fabricCanvasRef.current.renderAll()
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape' && isFullscreenMode) { setIsFullscreenMode(false) } }
    window.addEventListener('resize', handleResize)
    window.addEventListener('orientationchange', handleResize)
    window.addEventListener('keydown', handleKeyDown)
    return () => { window.removeEventListener('resize', handleResize); window.removeEventListener('orientationchange', handleResize); window.removeEventListener('keydown', handleKeyDown) }
  }, [isFullscreenMode])

  useEffect(() => {
    const handleTelegramLoaded = () => { checkTelegramSDK() }
    const handleTelegramFailed = () => { setIsTelegramSDKLoaded(false); if (isDevEnvironment) { setIsInTelegram(true) } }
    window.addEventListener('telegram-sdk-loaded', handleTelegramLoaded)
    window.addEventListener('telegram-sdk-failed', handleTelegramFailed)
    checkTelegramSDK()
    return () => { window.removeEventListener('telegram-sdk-loaded', handleTelegramLoaded); window.removeEventListener('telegram-sdk-failed', handleTelegramFailed) }
  }, [isDevEnvironment, isTelegramEnvironment])
  const checkTelegramSDK = useCallback(() => {
    const isInTelegramEnv = isTelegramEnvironment()
    const hostname = window.location.hostname.toLowerCase()
    const isKnownDeployment = hostname.includes('netlify.app') || hostname.includes('vercel.app') || hostname.includes('herokuapp') || hostname.includes('github.io')
    if (isKnownDeployment && !window.Telegram?.WebApp && isInTelegramEnv) {
      const urlParams = new URLSearchParams(window.location.search)
      const hashParams = new URLSearchParams(window.location.hash.replace('#', ''))
      const allParams = new URLSearchParams(); for (const [key, value] of urlParams) { allParams.append(key, value) } for (const [key, value] of hashParams) { allParams.append(key, value) }
      const tgWebAppData = allParams.get('tgWebAppData') || allParams.get('#tgWebAppData')
      if (tgWebAppData) { try { const decodedData = decodeURIComponent(tgWebAppData); const userIdMatch = decodedData.match(/"id"\s*:\s*(\d+)/); const userId = userIdMatch ? parseInt(userIdMatch[1]) : null; if (userId) { window.Telegram = { WebApp: { initDataUnsafe: { user: { id: userId, first_name: 'User', last_name: '', username: 'user' } }, initData: tgWebAppData, ready: () => {}, close: () => {} } } } } catch {} } else { window.Telegram = { WebApp: { initDataUnsafe: { user: { id: 1740576312, first_name: 'NetlifyUser', last_name: '', username: 'netlifyuser' } }, initData: 'netlify_fallback_data', ready: () => {}, close: () => {} } } }
    }
    if (isDevEnvironment && !window.Telegram?.WebApp) { window.Telegram = { WebApp: { initDataUnsafe: { user: { id: 1740576312, first_name: 'DevTest', last_name: 'User', username: 'devtest' } }, initData: 'dev_test_data', ready: () => {}, close: () => {} } } }
    if (window.Telegram?.WebApp) {
      try { window.Telegram.WebApp.ready() } catch {}
      setIsInTelegram(true)
      const userId = window.Telegram.WebApp.initDataUnsafe?.user?.id
      if (userId && typeof userId === 'number' && userId > 0) { if (userId === 123456789) { setTelegramUserId(null) } else { setTelegramUserId(userId) } } else { setTelegramUserId(null) }
    } else {
      if (isInTelegramEnv) { setTimeout(() => { if (window.Telegram?.WebApp) { setIsInTelegram(true); const userId = window.Telegram.WebApp.initDataUnsafe?.user?.id; if (userId && typeof userId === 'number' && userId > 0) { if (userId === 123456789) { setTelegramUserId(null) } else { setTelegramUserId(userId) } } } else { let retryCount = 0; const maxRetries = 5; const pollForWebApp = () => { retryCount++; if (window.Telegram?.WebApp) { setIsInTelegram(true); const userId = window.Telegram.WebApp.initDataUnsafe?.user?.id; if (userId && typeof userId === 'number' && userId > 0) { if (userId === 123456789) { setTelegramUserId(null) } else { setTelegramUserId(userId) } } return } if (retryCount < maxRetries) { setTimeout(pollForWebApp, 500) } }; setTimeout(pollForWebApp, 500) } }, 1000) }
      setIsInTelegram(isInTelegramEnv && !!window.Telegram?.WebApp)
      setTelegramUserId(null)
    }
  }, [isDevEnvironment, isTelegramEnvironment])

  // 创建发票处理函数
  const handleCreateInvoice = useCallback(async (sku: string) => {
    const invoiceLink = await createInvoice(sku)
    if (invoiceLink && openInvoice) {
      openInvoice(invoiceLink, (status) => {
        if (status === 'paid') {
          fetchBalance()
          setShowTopUp(false)
          toast.success('支付成功')
          notificationHaptic('success')
        } else {
          toast.error('支付取消')
          notificationHaptic('error')
        }
      })
    }
  }, [createInvoice, openInvoice, fetchBalance, notificationHaptic])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null)
  const originalImageRef = useRef<HTMLImageElement | null>(null)

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) { return }
    const MAX_FILE_SIZE = 3 * 1024 * 1024
    if (file.size > MAX_FILE_SIZE) { toast.error(`文件大小超过3MB限制`); return }
    if (!file.type.startsWith('image/')) { toast.error('请选择图片文件'); return }
    const reader = new FileReader()
    reader.onload = (e) => { const result = e.target?.result as string; setUploadedImage(result); initializeCanvas(result) }
    reader.onerror = () => { toast.error('文件读取失败') }
    reader.readAsDataURL(file)
  }, [])

  const initializeCanvas = useCallback((imageSrc: string) => {
    const img = new Image(); img.crossOrigin = 'anonymous'
    img.onload = () => {
      if (canvasRef.current && !fabricCanvasRef.current) {
        originalImageRef.current = img
        const viewportWidth = window.innerWidth
        const viewportHeight = window.innerHeight
        const isMobile = viewportWidth <= 768
        const maxWidth = isMobile ? Math.min(img.width, viewportWidth - 40) : 800
        const maxHeight = isMobile ? Math.min(img.height, viewportHeight * 0.6) : 600
        const scale = Math.min(maxWidth / img.width, maxHeight / img.height)
        const canvasWidth = img.width * scale
        const canvasHeight = img.height * scale
        setCanvasScale(scale)
        const canvas = new fabric.Canvas(canvasRef.current, { width: canvasWidth, height: canvasHeight, isDrawingMode: true, selection: false, hoverCursor: 'crosshair' })
        fabricCanvasRef.current = canvas
        fabric.Image.fromURL(imageSrc).then((fabricImg) => { fabricImg.set({ selectable: false, evented: false, scaleX: scale, scaleY: scale }); canvas.backgroundImage = fabricImg; canvas.renderAll() }).catch(() => { toast.error('背景图片设置失败') })
        if (!canvas.freeDrawingBrush) { canvas.freeDrawingBrush = new fabric.PencilBrush(canvas) }
        canvas.freeDrawingBrush.color = 'rgba(255, 100, 100, 0.95)'
        canvas.freeDrawingBrush.width = brushSize
        canvas.freeDrawingBrush.shadow = new fabric.Shadow({ color: 'rgba(255, 50, 50, 0.6)', blur: 3, offsetX: 0, offsetY: 0 })
        canvas.freeDrawingBrush.strokeLineCap = 'round'
        canvas.freeDrawingBrush.strokeLineJoin = 'round'
        canvas.isDrawingMode = true
        canvas.on('path:created', () => { setIsDrawing(false); setMaskObjectCount(canvas.getObjects().length) })
        canvas.on('mouse:down', () => { setIsDrawing(true) })
        canvas.on('mouse:up', () => { setIsDrawing(false) })
        canvas.on('object:removed', () => { setMaskObjectCount(canvas.getObjects().length) })
        setIsCanvasReady(true)
        setMaskObjectCount(0)
      }
    }
    img.onerror = () => { toast.error('图片加载失败，请尝试其他图片') }
    img.src = imageSrc
  }, [brushSize])

  const handleBrushSizeChange = useCallback((size: number) => {
    setBrushSize(size)
    if (fabricCanvasRef.current) {
      if (!fabricCanvasRef.current.freeDrawingBrush) {
        fabricCanvasRef.current.freeDrawingBrush = new fabric.PencilBrush(fabricCanvasRef.current)
        fabricCanvasRef.current.freeDrawingBrush.color = 'rgba(255, 100, 100, 0.95)'
        fabricCanvasRef.current.freeDrawingBrush.shadow = new fabric.Shadow({ color: 'rgba(255, 50, 50, 0.6)', blur: Math.max(1, size / 8), offsetX: 0, offsetY: 0 })
        fabricCanvasRef.current.freeDrawingBrush.strokeLineCap = 'round'
        fabricCanvasRef.current.freeDrawingBrush.strokeLineJoin = 'round'
      }
      fabricCanvasRef.current.freeDrawingBrush.width = size
      if (fabricCanvasRef.current.freeDrawingBrush.shadow) { fabricCanvasRef.current.freeDrawingBrush.shadow.blur = Math.max(1, size / 8) }
    }
  }, [])

  const handleUndo = useCallback(() => { if (fabricCanvasRef.current) { const canvas = fabricCanvasRef.current; const objects = canvas.getObjects(); if (objects.length > 0) { canvas.remove(objects[objects.length - 1]); canvas.renderAll(); setMaskObjectCount(canvas.getObjects().length) } } }, [])
  const handleClearMask = useCallback(() => { if (fabricCanvasRef.current) { const canvas = fabricCanvasRef.current; canvas.clear(); if (uploadedImage && originalImageRef.current) { fabric.Image.fromURL(uploadedImage).then((fabricImg) => { const scale = Math.min(800 / originalImageRef.current!.width, 600 / originalImageRef.current!.height); fabricImg.set({ selectable: false, evented: false, scaleX: scale, scaleY: scale }); canvas.backgroundImage = fabricImg; canvas.renderAll(); setMaskObjectCount(0) }) } } }, [uploadedImage])
  const handleReset = useCallback(() => { setUploadedImage(null); setIsCanvasReady(false); setIsRepaintComplete(false); setMaskObjectCount(0); setCurrentPrompt(promptManager.getCurrentPrompt()); if (fabricCanvasRef.current) { fabricCanvasRef.current.dispose(); fabricCanvasRef.current = null } if (fileInputRef.current) { fileInputRef.current.value = '' } }, [])

  const createCompositeImage = useCallback(async () => {
    if (!uploadedImage || !originalImageRef.current || !fabricCanvasRef.current) { return null }
    return new Promise<string>((resolve, reject) => {
      try {
        const tempCanvas = document.createElement('canvas')
        const ctx = tempCanvas.getContext('2d'); if (!ctx) { reject(new Error('无法获取canvas 2D上下文')); return }
        const originalWidth = originalImageRef.current.width
        const originalHeight = originalImageRef.current.height
        tempCanvas.width = originalWidth; tempCanvas.height = originalHeight
        try { ctx.drawImage(originalImageRef.current, 0, 0) } catch (drawError) { reject(drawError); return }
        const maskCanvas = document.createElement('canvas')
        const maskCtx = maskCanvas.getContext('2d'); if (!maskCtx) { reject(new Error('无法获取mask canvas 2D上下文')); return }
        maskCanvas.width = tempCanvas.width; maskCanvas.height = tempCanvas.height
        const displayScale = fabricCanvasRef.current.width / originalWidth
        const objects = fabricCanvasRef.current.getObjects()
        objects.forEach((obj) => {
          if (obj.type === 'path') {
            const path = obj as fabric.Path
            maskCtx.globalCompositeOperation = 'source-over'
            maskCtx.strokeStyle = 'white'
            maskCtx.lineWidth = (path.strokeWidth || brushSize) / displayScale
            maskCtx.lineCap = 'round'
            maskCtx.lineJoin = 'round'
            const pathData = path.path
            maskCtx.beginPath()
            pathData.forEach((command) => {
              const [type, ...coords] = command
              const validCoords = coords.map((coord) => { const num = Number(coord); return isNaN(num) ? 0 : num })
              switch (type) {
                case 'M': if (validCoords.length >= 2) { maskCtx.moveTo(validCoords[0] / displayScale, validCoords[1] / displayScale) } break
                case 'L': if (validCoords.length >= 2) { maskCtx.lineTo(validCoords[0] / displayScale, validCoords[1] / displayScale) } break
                case 'Q': if (validCoords.length >= 4) { maskCtx.quadraticCurveTo(validCoords[0] / displayScale, validCoords[1] / displayScale, validCoords[2] / displayScale, validCoords[3] / displayScale) } break
                case 'C': if (validCoords.length >= 6) { maskCtx.bezierCurveTo(validCoords[0] / displayScale, validCoords[1] / displayScale, validCoords[2] / displayScale, validCoords[3] / displayScale, validCoords[4] / displayScale, validCoords[5] / displayScale) } break
                case 'Z': maskCtx.closePath(); break
              }
            })
            maskCtx.stroke()
          }
        })
        ctx.globalCompositeOperation = 'destination-out'
        ctx.drawImage(maskCanvas, 0, 0)
        const result = tempCanvas.toDataURL('image/png')
        resolve(result)
      } catch (error) { reject(error) }
    })
  }, [brushSize, uploadedImage])

  const handleStartRepaint = useCallback(async () => {
    if (!currentPrompt.trim()) { toast.error('提示词配置错误'); return }
    if (!uploadedImage) { toast.error('请先上传图片'); return }
    if (!fabricCanvasRef.current) { toast.error('请等待图片加载完成'); return }
    const objects = fabricCanvasRef.current.getObjects(); if (objects.length === 0) { toast.error('请先绘制遮罩区域'); return }
    setIsProcessing(true)
    try {
      let compositeImage
      try { compositeImage = await createCompositeImage() } catch (compositeError: any) { toast.error(`图片处理失败: ${compositeError.message}`); setIsProcessing(false); return }
      if (!compositeImage) { toast.error('图片处理失败：无法创建复合图像'); setIsProcessing(false); return }
      if (window.Telegram?.WebApp) { try { window.Telegram.WebApp.ready() } catch {} }
      const realTimeUserId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id
      const userId = telegramUserId || realTimeUserId
      if (!userId) { toast.error('无法获取用户信息，请确保在Telegram环境中使用此应用'); setIsProcessing(false); return }
      if (typeof userId !== 'number' || userId <= 0) { toast.error(`获取的用户信息无效(${userId})，请重新在Telegram中打开应用`); setIsProcessing(false); return }
      if (userId === 123456789) { toast.error('检测到测试环境ID，请使用真实的Telegram账号'); setIsProcessing(false); return }
      const base64Length = compositeImage.length
      if (base64Length > 5000000) { toast.error('图片数据过大，请上传更小的图片'); return }
      let pureBase64 = compositeImage
      if (compositeImage.includes('data:image/png;base64,')) { pureBase64 = compositeImage.replace('data:image/png;base64,', '') } else if (compositeImage.includes('data:image/jpeg;base64,')) { pureBase64 = compositeImage.replace('data:image/jpeg;base64,', '') } else if (compositeImage.includes('data:image/')) { const commaIndex = compositeImage.indexOf(','); if (commaIndex !== -1) { pureBase64 = compositeImage.substring(commaIndex + 1) } }
      const chatId = String(userId)
      if (!chatId || chatId === '123456789') { toast.error('检测到无效的聊天ID，请使用真实的Telegram账号'); setIsProcessing(false); return }
      const payload = { composite_image_base64: pureBase64, prompt: currentPrompt, chat_id: chatId }
      if (credits !== null) {
        if (credits <= 0) { setShowTopUp(true); setIsProcessing(false); return }
        const ok = await consumeCredits(payload)
        if (ok) { toast.success('任务已提交'); setIsRepaintComplete(true) } else { toast.error('提交失败') }
      } else {
        const controller = new AbortController(); const timeoutId = setTimeout(() => controller.abort(), 30000)
        const makeWebhookUrl = import.meta.env.VITE_MAKE_WEBHOOK_URL
        if (!makeWebhookUrl) {
          toast.error('Webhook未配置')
          return
        }
        const response = await fetch(makeWebhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify(payload), signal: controller.signal })
        clearTimeout(timeoutId)
        if (response.ok) { await response.text(); toast.success('请求已发送，请在Telegram中等待结果！'); setIsRepaintComplete(true) } else { const errorText = await response.text(); toast.error(`请求失败: ${response.status} ${response.statusText}`) }
      }
    } catch (error: any) { if (error.name === 'AbortError') { toast.error('请求超时，请检查网络连接') } else { toast.error(`处理失败: ${error.message}`) } } finally { setIsProcessing(false) }
  }, [currentPrompt, createCompositeImage, telegramUserId])

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Toaster position="top-center" />
      {!isInTelegram && (
        <div className="bg-yellow-600 text-white p-3 text-center">
          <div className="flex items-center justify-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>⚠️ 请在Telegram环境中使用此应用以获得完整功能 (检测到URL: {window.location.hostname})</span>
          </div>
        </div>
      )}
      {isRepaintComplete && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-8 rounded-lg text-center max-w-md mx-4">
            <div className="mb-4">
              <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-xl font-bold text-white mb-2">重绘请求已发送！</h2>
              <p className="text-gray-300 mb-4">您的AI重绘请求已成功发送，请在Telegram中等待结果。处理时间可能需要几分钟。</p>
            </div>
            <div className="space-y-3">
              <button onClick={()=>{setIsRepaintComplete(false);handleReset()}} className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium transition-colors">再来一张</button>
              <button onClick={()=>{if(window.Telegram?.WebApp){window.Telegram.WebApp.close()}else{setIsRepaintComplete(false)}}} className="w-full px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded font-medium transition-colors">关闭应用</button>
            </div>
          </div>
        </div>
      )}
      <div className="container mx-auto px-4 py-6 app-desktop-container">
        {!uploadedImage && (<h1 className="text-2xl font-bold text-center mb-8">AI 图像重绘</h1>)}
        {!uploadedImage && (
          <div className="max-w-2xl mx-auto mb-6 px-4">
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">⚡</span>
                  <div>
                    <div className="text-sm text-gray-400 mb-1">剩余算力</div>
                    <div className="text-xl font-bold text-white">
                      {isPaymentLoading ? (
                        <span className="text-gray-400">加载中...</span>
                      ) : credits !== null ? (
                        <span className={credits > 0 ? 'text-green-400' : 'text-red-400'}>
                          {credits} 点
                        </span>
                      ) : (
                        <span className="text-gray-400">--</span>
                      )}
                    </div>
                  </div>
                </div>
                <Button 
                  onClick={() => setShowTopUp(true)} 
                  variant="primary" 
                  size="medium"
                  className="flex items-center gap-2"
                >
                  <span className="text-lg">⭐</span>
                  充值
                </Button>
              </div>
              {credits !== null && credits <= 5 && (
                <div className="mt-3 pt-3 border-t border-gray-700">
                  <p className="text-xs text-yellow-400 flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    算力不足，建议及时充值
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
        {!uploadedImage && (
          <div className="max-w-2xl mx-auto mb-8 bg-gray-800 rounded-lg border border-gray-700">
            <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-750 transition-colors" onClick={()=>setShowInstructions(!showInstructions)}>
              <div className="flex items-center gap-2"><div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center"><span className="text-white text-sm font-bold">👋</span></div><h2 className="text-lg font-semibold text-white">欢迎来到 AI 图像重绘助手！</h2></div>
              <div className={`transform transition-transform ${showInstructions?'rotate-180':''}`}><svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg></div>
            </div>
            {showInstructions && (
              <div className="px-4 pb-4 space-y-4">
                <div><h3 className="text-sm font-medium text-blue-400 mb-2">🪄 使用步骤：</h3><ol className="text-sm text-gray-300 space-y-1 list-decimal list-inside"><li>点击聊天输入框旁的「开始创作」按钮，打开编辑器。</li><li>上传你想要修改的图片。</li><li>用画笔在画布上涂抹想要重绘的区域，涂抹的区域会被替换。或者圈起你想重绘的区域，圈内的区域会被替换。</li><li>点击「开始重绘」，稍等片刻。</li><li>结果会由机器人自动发回给你。</li></ol></div>
                <div><h3 className="text-sm font-medium text-yellow-400 mb-2">📝 小贴士：</h3><ul className="text-sm text-gray-300 space-y-1 list-disc list-inside"><li>保障网络稳定，图片建议不超过 3MB。</li><li>如果长时间没有结果，大概是爆现存量了，换个小点的图再试一次。</li></ul></div>
              </div>
            )}
          </div>
        )}
        {!uploadedImage ? (
          <div className="max-w-md mx-auto">
            <div className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center cursor-pointer hover:border-gray-400 transition-colors" onClick={()=>fileInputRef.current?.click()}>
              <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-400 mb-2">点击或拖拽上传图片</p>
              <p className="text-xs text-gray-500 mt-2">💡 建议图片大小不超过 3MB</p>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto">
            <div className="mb-6 flex flex-col sm:flex-row lg:flex-col xl:flex-row items-start sm:items-center lg:items-start xl:items-center justify-between gap-4">
              <div className="flex items-center gap-4 w-full">
                <div className="flex items-center gap-2 flex-shrink-0">
                  <label className="text-sm text-gray-400 whitespace-nowrap">画笔大小:</label>
                  <input type="range" min="5" max="50" value={brushSize} onChange={(e)=>handleBrushSizeChange(Number(e.target.value))} className="w-24 sm:w-32 touch-manipulation" />
                  <span className="text-sm text-gray-400 min-w-[3rem]">{brushSize}px</span>
                </div>
                <div className="flex gap-2 flex-wrap justify-end flex-1">
                  {!isFullscreenMode&&uploadedImage&&(<button onClick={()=>setIsFullscreenMode(true)} className="p-2 bg-blue-600 hover:bg-blue-700 rounded transition-colors shadow-lg" title="进入全屏模式"><Maximize2 className="w-5 h-5" /></button>)}
                  {isFullscreenMode&&(<button onClick={()=>setIsFullscreenMode(false)} className="p-2 bg-green-600 hover:bg-green-700 rounded transition-colors shadow-lg" title="退出全屏模式 (ESC)"><Minimize2 className="w-5 h-5" /></button>)}
                  <button onClick={handleUndo} className="p-2 bg-gray-700 hover:bg-gray-600 rounded transition-colors" title="撤销"><Undo2 className="w-5 h-5" /></button>
                  <button onClick={handleClearMask} className="p-2 bg-gray-700 hover:bg-gray-600 rounded transition-colors" title="清空Mask"><Trash2 className="w-5 h-5" /></button>
                  <button onClick={handleReset} className="p-2 bg-red-600 hover:bg-red-700 rounded transition-colors" title="重新上传"><X className="w-5 h-5" /></button>
                </div>
              </div>
            </div>
            <div className={`mb-6 flex justify-center ${isFullscreenMode?'fixed inset-0 bg-gray-900 flex items-center justify-center z-40':''}`}>
              <div className={`relative border-2 border-gray-600 rounded-lg overflow-hidden transition-all duration-300 ${isFullscreenMode?'w-full max-w-full h-auto max-h-[90vh]':'w-full max-w-4xl landscape-image-container'}`}>
                <canvas ref={canvasRef} className={`w-full h-auto block max-w-full ${isDrawing?'cursor-crosshair':'cursor-default'}`} style={{touchAction:'none',maxHeight:isFullscreenMode?'90vh':'70vh',objectFit:'contain',backgroundColor:'transparent'}} />
                <div className="absolute inset-0 pointer-events-none border-2 border-blue-400 rounded-lg opacity-0 hover:opacity-100 transition-opacity duration-200"></div>
                {isFullscreenMode&&(<button onClick={()=>setIsFullscreenMode(false)} className="absolute top-4 right-4 p-2 bg-red-600 hover:bg-red-700 rounded-full transition-colors shadow-lg z-10" title="退出全屏模式 (ESC)"><Minimize2 className="w-6 h-6" /></button>)}
                {isDrawing&&(<div className="absolute top-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-sm">绘制中...</div>)}
                {!isCanvasReady&&uploadedImage&&(<div className="absolute inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center"><div className="text-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div><p className="text-white text-sm">画布加载中...</p></div></div>)}
              </div>
            </div>
            <div className={`fixed left-0 right-0 bg-gray-800 p-4 border-t border-gray-700 transition-all duration-300 desktop-fixed-bar ${isFullscreenMode?'bottom-4 left-4 right-4 w-auto rounded-lg z-50 bg-opacity-95 backdrop-blur-sm max-w-md mx-auto':'bottom-0'}`}> 
              {isFullscreenMode&&(
                <div className="absolute -top-16 left-0 right-0 flex justify-center gap-2 mb-4">
                  <button onClick={()=>setIsFullscreenMode(false)} className="p-3 bg-gray-700 hover:bg-gray-600 rounded-full transition-colors shadow-lg" title="退出全屏模式 (ESC)"><Minimize2 className="w-6 h-6" /></button>
                  <button onClick={handleUndo} className="p-3 bg-gray-700 hover:bg-gray-600 rounded-full transition-colors shadow-lg" title="撤销"><Undo2 className="w-6 h-6" /></button>
                  <button onClick={handleClearMask} className="p-3 bg-gray-700 hover:bg-gray-600 rounded-full transition-colors shadow-lg" title="清空Mask"><Trash2 className="w-6 h-6" /></button>
                </div>
              )}
              <div className={`${isFullscreenMode?'':'max-w-4xl mx-auto'}`}>
                <div className="flex justify-end gap-3">
                  <Button onClick={handleStartRepaint} disabled={isProcessing||!currentPrompt.trim()||!isCanvasReady||maskObjectCount===0||(!isInTelegram&&!isDevEnvironment)} variant="primary" size="large">{isProcessing?'处理中...':'开始重绘'}</Button>
                  <Button onClick={()=>setShowTopUp(true)} variant="destructive" size="large">充值</Button>
                </div>
                {uploadedImage&&isCanvasReady&&(
                  <div className="text-center mt-2">
                    {!isInTelegram&&!isDevEnvironment?(<p className="text-red-400 text-sm">⚠️ 请在Telegram环境中使用此应用</p>):maskObjectCount===0?(<p className="text-yellow-400 text-sm">💡 请在图片上绘制遮罩区域后再点击开始重绘</p>):(<p className="text-green-400 text-sm">✅ 已绘制 {maskObjectCount} 个遮罩区域</p>)}
                  </div>
                )}
                {isDevEnvironment&&(
                  <div className="mt-4 p-4 bg-gray-800 rounded border border-yellow-600">
                    <h3 className="text-sm font-medium mb-2 text-yellow-400">🔧 开发测试工具</h3>
                    <div className="space-y-2">
                      <button onClick={()=>{}} className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded">检查当前状态</button>
                      <button onClick={()=>{const testUserId=1740576312;setTelegramUserId(testUserId);setIsInTelegram(true)}} className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded ml-2">模拟测试账号</button>
                      <button onClick={()=>{setTelegramUserId(null);setIsInTelegram(false)}} className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded ml-2">重置状态</button>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">⚠️ 这些工具仅在开发环境中显示</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      <Modal isOpen={showTopUp} onClose={()=>setShowTopUp(false)} title="选择充值套餐" size="medium">
        <div className="space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <Star className="w-5 h-5 text-yellow-400" />
            <span className="text-sm text-gray-700">使用 Telegram Stars 支付</span>
          </div>
          <Button onClick={()=>handleCreateInvoice('pack12')} size="large"><Star className="w-4 h-4 mr-2 text-yellow-400" />12 点 = 50 XTR</Button>
          <Button onClick={()=>handleCreateInvoice('pack30')} size="large"><Star className="w-4 h-4 mr-2 text-yellow-400" />30 点 = 100 XTR</Button>
          <Button onClick={()=>handleCreateInvoice('pack60')} size="large"><Star className="w-4 h-4 mr-2 text-yellow-400" />60 点 = 180 XTR</Button>
          <Button onClick={()=>handleCreateInvoice('pack88')} size="large"><Star className="w-4 h-4 mr-2 text-yellow-400" />88 点 = 250 XTR</Button>
        </div>
      </Modal>
      {isProcessing && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p>正在处理中...</p>
          </div>
        </div>
      )}
    </div>
  )
}