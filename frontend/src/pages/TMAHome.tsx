import { useState, useRef, useCallback, useEffect } from 'react'
import * as fabric from 'fabric'
import { Upload, Image as ImageIcon, Undo2, Trash2, X, Maximize2, Minimize2, ZoomIn, ZoomOut, RotateCcw, Move } from 'lucide-react'
import { Toaster, toast } from 'sonner'
import { promptManager } from '@/utils/promptManager'
import { useTMA } from '@/providers/TMAProvider'
import { usePayments } from '@/hooks/usePayments'
import { Button } from '@/components/TMAButton'
import { Modal } from '@/components/TMAModal'

interface TelegramUser {
  id: number
  first_name?: string
  last_name?: string
  username?: string
}

interface TelegramWebApp {
  initDataUnsafe: {
    user?: TelegramUser
  }
  initData?: string
  ready: () => void
  close: () => void
}

declare global {
  interface Window {
    Telegram: {
      WebApp: TelegramWebApp
    }
  }
}

export default function Home() {
  const { user, isInTelegram, showMainButton, hideMainButton, impactHaptic, notificationHaptic, initData, openInvoice, onInvoiceClosed, viewportHeight, viewportStableHeight } = useTMA()
  
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [brushSize, setBrushSize] = useState(15)
  const [showCreditDeduction, setShowCreditDeduction] = useState(false)
  const [creditDeductionAmount, setCreditDeductionAmount] = useState(0)
  const [previousCredits, setPreviousCredits] = useState<number | null>(null)
  
  // 使用默认提示词，不再提供UI配置
  const currentPrompt = 'professional portrait, high quality, detailed, modern style'
  const [isDrawing, setIsDrawing] = useState(false)
  const [telegramUserId, setTelegramUserId] = useState<number | null>(null)
  const [isCanvasReady, setIsCanvasReady] = useState(false)
  const [isRepaintComplete, setIsRepaintComplete] = useState(false)
  const [maskObjectCount, setMaskObjectCount] = useState(0)
  const [isFullscreenMode, setIsFullscreenMode] = useState(false)
  const [canvasScale, setCanvasScale] = useState(1)
  const [showInstructions, setShowInstructions] = useState(true)
  const [showTopUp, setShowTopUp] = useState(false)
  
  // 缩放和移动状态管理
  const [canvasZoom, setCanvasZoom] = useState(1.0)
  const [canvasPan, setCanvasPan] = useState({ x: 0, y: 0 })
  const [isPanMode, setIsPanMode] = useState(false)
  
  // 开发环境检测 - 必须在其他useEffect之前定义
  const [isDevEnvironment] = useState(() => {
    return import.meta.env.DEV || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  })
  
  // 使用默认后端URL，如果环境变量未设置
  // 注意：生产环境必须设置 VITE_PAYMENTS_BASE_URL 环境变量
  const paymentsBaseUrl = (import.meta.env.VITE_PAYMENTS_BASE_URL as string) || (import.meta.env.DEV ? 'http://localhost:3000/api' : '')
  
  // 检查支付配置
  useEffect(() => {
    if (isInTelegram && paymentsBaseUrl) {
      console.log('支付配置正常', { paymentsBaseUrl, fromEnv: !!import.meta.env.VITE_PAYMENTS_BASE_URL })
    }
  }, [isInTelegram, paymentsBaseUrl])
  
  // 使用统一的支付钩子
  const { credits, isLoading: isPaymentLoading, isProcessing: isPaymentProcessing, fetchBalance, createInvoice, consumeCredits } = usePayments(paymentsBaseUrl)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null)
  const originalImageRef = useRef<HTMLImageElement | null>(null)

  // TMA-enhanced user detection with development mode support
  useEffect(() => {
    if (user) {
      console.log('🎯 TMA User detected:', user)
      setTelegramUserId(user.id)
      notificationHaptic('success')
    } else if (isDevEnvironment && import.meta.env.VITE_ALLOW_NON_TELEGRAM === 'true') {
      // 开发模式下创建模拟用户
      console.log('🔧 Development mode: Creating mock user')
      const mockUser = {
        id: 123456789,
        first_name: '开发用户',
        username: 'dev_user'
      }
      setTelegramUserId(mockUser.id)
      // 余额将通过 fetchBalance() 获取
    }
  }, [user, notificationHaptic, isDevEnvironment])
  
  useEffect(() => { 
    // 在telegram环境中，即使initData暂时为空也尝试获取余额
    // 因为initData可能在组件加载后才可用
    if (isInTelegram || (isDevEnvironment && import.meta.env.VITE_ALLOW_NON_TELEGRAM === 'true')) {
      // 延迟一点执行，确保initData已经准备好
      const timer = setTimeout(() => {
        fetchBalance()
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [isInTelegram, initData, fetchBalance, isDevEnvironment])
  useEffect(() => { onInvoiceClosed(()=>{ fetchBalance(); notificationHaptic('success') }) }, [onInvoiceClosed, notificationHaptic, fetchBalance])

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

  // 充值套餐数据
  const PACKAGES = [
    { sku: 'pack12', xtr: 50, credits: 12, label: '12算力点', popular: false },
    { sku: 'pack30', xtr: 100, credits: 30, label: '30算力点', popular: true },
    { sku: 'pack60', xtr: 180, credits: 60, label: '60算力点', popular: false },
    { sku: 'pack88', xtr: 250, credits: 88, label: '88算力点', popular: false }
  ]
  
  const [selectedPackage, setSelectedPackage] = useState<string>('pack30')
  const [isProcessingPayment, setIsProcessingPayment] = useState(false)

  // 开发环境检测已移至组件顶部

  // 键盘事件处理 - ESC键退出全屏
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isFullscreenMode) {
        console.log('🎹 ESC键按下，退出全屏模式')
        setIsFullscreenMode(false)
        impactHaptic('light')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isFullscreenMode, impactHaptic])

  // 画布初始化 - 最大化利用可用空间
  // 调整canvas尺寸同时保留所有路径对象
  const resizeCanvasPreservingPaths = useCallback((imageUrl: string, imageElement: HTMLImageElement) => {
    if (!canvasRef.current || !fabricCanvasRef.current) return

    const canvas = canvasRef.current
    const fabricCanvas = fabricCanvasRef.current
    
    // 保存当前所有路径对象的引用（不序列化，直接保存引用）
    const existingObjects = fabricCanvas.getObjects().slice() // 创建数组副本
    
    // 保存当前的缩放和pan状态
    const currentZoom = fabricCanvas.getZoom()
    const vpt = fabricCanvas.viewportTransform || [1, 0, 0, 1, 0, 0]
    const currentPan = { x: vpt[4], y: vpt[5] }
    
    // 保存当前canvas尺寸
    const oldWidth = fabricCanvas.width || canvas.width
    const oldHeight = fabricCanvas.height || canvas.height
    
    // 计算新的canvas尺寸（与initializeCanvas相同的逻辑）
    const parentRect = canvas.parentElement?.getBoundingClientRect()
    const effectiveViewportHeight = viewportStableHeight > 0 ? viewportStableHeight : window.innerHeight
    const isMobile = window.innerWidth < 768
    const maxWidth = Math.floor((parentRect?.width || window.innerWidth) - 16)
    const maxHeight = Math.floor(effectiveViewportHeight * (isMobile ? 0.75 : 0.6))
    
    const imgWidth = imageElement.naturalWidth
    const imgHeight = imageElement.naturalHeight
    const aspectRatio = imgWidth / imgHeight
    
    let canvasWidth = imgWidth
    let canvasHeight = imgHeight
    
    if (imgWidth > maxWidth) {
      canvasWidth = maxWidth
      canvasHeight = canvasWidth / aspectRatio
    }
    
    if (canvasHeight > maxHeight) {
      canvasHeight = maxHeight
      canvasWidth = canvasHeight * aspectRatio
    }
    
    canvasWidth = Math.max(canvasWidth, 400)
    canvasHeight = Math.max(canvasHeight, 300)
    
    const newWidth = Math.floor(canvasWidth)
    const newHeight = Math.floor(canvasHeight)
    
    // 计算背景图片的缩放比例（关键！路径坐标应该按照背景图片的显示尺寸来缩放）
    const oldImgWidth = imageElement.naturalWidth
    const oldImgHeight = imageElement.naturalHeight
    const oldBgScale = Math.min(oldWidth / oldImgWidth, oldHeight / oldImgHeight)
    const newBgScale = Math.min(newWidth / oldImgWidth, newHeight / oldImgHeight)
    
    // 背景图片在canvas上的显示尺寸
    const oldBgDisplayWidth = oldImgWidth * oldBgScale
    const oldBgDisplayHeight = oldImgHeight * oldBgScale
    const newBgDisplayWidth = oldImgWidth * newBgScale
    const newBgDisplayHeight = oldImgHeight * newBgScale
    
    // 路径坐标应该按照背景图片显示尺寸的比例来缩放
    const pathScaleX = newBgDisplayWidth / oldBgDisplayWidth
    const pathScaleY = newBgDisplayHeight / oldBgDisplayHeight
    
    // 由于背景图片使用相同的scaleX和scaleY，路径坐标也应该使用相同的缩放比例
    const pathScale = newBgScale / oldBgScale
    
    console.log('Canvas尺寸变化:', oldWidth, 'x', oldHeight, '->', newWidth, 'x', newHeight)
    console.log('背景图片缩放变化:', oldBgScale.toFixed(4), '->', newBgScale.toFixed(4))
    console.log('背景图片显示尺寸变化:', oldBgDisplayWidth.toFixed(0), 'x', oldBgDisplayHeight.toFixed(0), '->', newBgDisplayWidth.toFixed(0), 'x', newBgDisplayHeight.toFixed(0))
    console.log('路径坐标缩放比例:', pathScale.toFixed(4))
    
    // 临时移除所有对象（但不销毁），以便调整canvas尺寸
    existingObjects.forEach(obj => {
      fabricCanvas.remove(obj)
    })
    
    // 设置新的canvas尺寸
    canvas.width = newWidth
    canvas.height = newHeight
    
    // 更新fabric canvas尺寸
    fabricCanvas.setDimensions({ width: newWidth, height: newHeight })
    
    // 重新加载背景图片并调整缩放
    fabric.Image.fromURL(imageUrl).then((img) => {
      if (!fabricCanvas || !img) return
      
      const imgWidth = img.width || 1
      const imgHeight = img.height || 1
      const scale = Math.min(newWidth / imgWidth, newHeight / imgHeight)
      
      try {
        if (typeof img.set === 'function') {
          img.set({
            scaleX: scale,
            scaleY: scale,
            left: 0,
            top: 0,
            selectable: false,
            evented: false,
          })
        } else {
          img.scaleX = scale
          img.scaleY = scale
          img.left = 0
          img.top = 0
          img.selectable = false
          img.evented = false
        }
        
        if (typeof img.setCoords === 'function') {
          img.setCoords()
        }
      } catch (error) {
        console.error('设置图片属性失败:', error)
        return
      }
      
      fabricCanvas.backgroundImage = img
      
      // 恢复所有路径对象，并根据新尺寸调整坐标
      existingObjects.forEach(obj => {
        try {
          // 调整路径坐标以适应新的背景图片显示尺寸
          if (obj.type === 'path') {
            const path = obj as fabric.Path
            // 缩放路径坐标 - 按照背景图片显示尺寸的比例
            if (path.path) {
              const scaledPath = path.path.map((command: any) => {
                const [type, ...coords] = command as any[]
                const scaledCoords = coords.map((coord: any, index: number) => {
                  const num = Number(coord)
                  if (isNaN(num)) return coord
                  // 所有坐标都按照相同的比例缩放（因为背景图片使用相同的scaleX和scaleY）
                  return num * pathScale
                })
                return [type, ...scaledCoords] as any
              })
              // 使用类型断言
              ;(path as any).path = scaledPath
            }
            
            // 调整strokeWidth - 按照背景图片显示尺寸的比例
            if (path.strokeWidth) {
              path.strokeWidth = path.strokeWidth * pathScale
            }
          }
          
          // 调整对象位置和尺寸 - 按照背景图片显示尺寸的比例
          if (obj.left !== undefined) obj.left = obj.left * pathScale
          if (obj.top !== undefined) obj.top = obj.top * pathScale
          if (obj.scaleX !== undefined) obj.scaleX = obj.scaleX * pathScale
          if (obj.scaleY !== undefined) obj.scaleY = obj.scaleY * pathScale
          
          obj.selectable = false
          obj.evented = false
          
          if (typeof obj.setCoords === 'function') {
            obj.setCoords()
          }
          
          // 重新添加到canvas
          fabricCanvas.add(obj)
        } catch (error) {
          console.error('恢复路径对象失败:', error)
        }
      })
      
      // 恢复缩放和pan状态（根据背景图片显示尺寸比例调整）
      fabricCanvas.setZoom(currentZoom)
      fabricCanvas.absolutePan(new fabric.Point(currentPan.x * pathScale, currentPan.y * pathScale))
      
      // 更新状态
      setCanvasZoom(currentZoom)
      setCanvasPan({ x: currentPan.x * pathScale, y: currentPan.y * pathScale })
      setMaskObjectCount(fabricCanvas.getObjects().length)
      
      fabricCanvas.renderAll()
      console.log('Canvas尺寸调整完成，已保留所有路径对象')
    }).catch((error) => {
      console.error('背景图片加载失败:', error)
    })
  }, [viewportStableHeight])

  const initializeCanvas = useCallback((imageUrl: string, imageElement: HTMLImageElement) => {
    if (!canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // 清空画布
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // 基于父容器尺寸进行计算，确保与布局一致
    const parentRect = canvas.parentElement?.getBoundingClientRect()
    // 使用 Telegram 视口信息，如果不可用则使用 window.innerHeight
    const effectiveViewportHeight = viewportStableHeight > 0 ? viewportStableHeight : window.innerHeight
    const isMobile = window.innerWidth < 768
    const maxWidth = Math.floor((parentRect?.width || window.innerWidth) - 16)
    // 移动端使用 75% 的视口高度，桌面端使用 60%
    const maxHeight = Math.floor(effectiveViewportHeight * (isMobile ? 0.75 : 0.6))
    
    // 获取图片原始尺寸
    const imgWidth = imageElement.naturalWidth
    const imgHeight = imageElement.naturalHeight
    const aspectRatio = imgWidth / imgHeight
    
    // 计算适合的canvas尺寸，最大化利用空间
    let canvasWidth = imgWidth
    let canvasHeight = imgHeight
    
    // 优先适应宽度，然后检查高度
    if (imgWidth > maxWidth) {
      canvasWidth = maxWidth
      canvasHeight = canvasWidth / aspectRatio
    }
    
    // 如果高度仍然超出，则按高度缩放
    if (canvasHeight > maxHeight) {
      canvasHeight = maxHeight
      canvasWidth = canvasHeight * aspectRatio
    }
    
    // 确保合理的最小尺寸
    canvasWidth = Math.max(canvasWidth, 400)
    canvasHeight = Math.max(canvasHeight, 300)
    
    // 设置画布尺寸（使用整数像素值）
    canvas.width = Math.floor(canvasWidth)
    canvas.height = Math.floor(canvasHeight)

    console.log('容器宽度:', Math.floor(parentRect?.width || 0), '视口高度:', viewportHeight)
    console.log('可用空间:', maxWidth, 'x', maxHeight)
    console.log('原始图片尺寸:', imgWidth, 'x', imgHeight)
    console.log('最大化Canvas尺寸:', canvas.width, 'x', canvas.height)

    // 创建fabric画布
    if (fabricCanvasRef.current) {
      fabricCanvasRef.current.dispose()
    }

    fabricCanvasRef.current = new fabric.Canvas(canvas, {
      isDrawingMode: true,
      selection: false,
      backgroundColor: 'transparent',
    })

    console.log('Fabric Canvas尺寸:', fabricCanvasRef.current.width, 'x', fabricCanvasRef.current.height)

    // 添加背景图片
    fabric.Image.fromURL(imageUrl).then((img) => {
      if (!fabricCanvasRef.current || !img) {
        console.error('Canvas或图片对象无效')
        return
      }

      console.log('fabric图片创建成功', img)
      console.log('图片对象类型:', typeof img)
      console.log('图片构造函数:', img.constructor?.name)
      console.log('图片属性:', Object.keys(img))
      
      // 缩放图片以适应画布，从(0,0)开始，不居中
      const imgWidth = img.width || 1
      const imgHeight = img.height || 1
      const canvasWidth = fabricCanvasRef.current.width || 1
      const canvasHeight = fabricCanvasRef.current.height || 1
      
      const scale = Math.min(
        canvasWidth / imgWidth,
        canvasHeight / imgHeight
      )
      
      // 背景图片从(0,0)开始，不居中，避免坐标偏移
      // 安全地设置图片属性 - 使用Fabric.js兼容方式
      try {
        // 确保图片对象有效
        if (!img || typeof img !== 'object') {
          console.error('无效的图片对象')
          return
        }
        
        // 设置基本属性
        img.selectable = false
        img.evented = false
        
        // 使用set方法如果存在，否则直接设置
        if (typeof img.set === 'function') {
          img.set({
            scaleX: scale,
            scaleY: scale,
            left: 0,
            top: 0,
          })
        } else {
          img.scaleX = scale
          img.scaleY = scale
          img.left = 0
          img.top = 0
        }
        
        // 强制更新对象
        if (typeof img.setCoords === 'function') {
          img.setCoords()
        }
      } catch (error) {
        console.error('设置图片属性失败:', error)
        console.error('图片对象类型:', typeof img)
        console.error('图片对象:', img)
        return
      }

      fabricCanvasRef.current.backgroundImage = img
      fabricCanvasRef.current.renderAll()
      console.log('背景图片设置完成')

      // 配置画笔属性
      const canvas = fabricCanvasRef.current
      
      // 安全地设置画笔属性
      if (canvas.freeDrawingBrush) {
        canvas.freeDrawingBrush.color = 'rgba(255, 255, 255, 0.8)'
        canvas.freeDrawingBrush.width = brushSize
      } else {
        console.log('创建新的画笔对象')
        const brush = new fabric.PencilBrush(canvas)
        brush.color = 'rgba(255, 255, 255, 0.8)'
        brush.width = brushSize
        canvas.freeDrawingBrush = brush
      }
      
      console.log('画笔配置完成')

      // 监听绘制事件
      canvas.on('path:created', (e) => {
        setIsDrawing(false)
        // 确保路径对象被正确添加到画布并保留
        const path = e.path
        if (path) {
          // 确保路径对象不会被移除
          path.selectable = false
          path.evented = false
          // 确保路径对象在canvas中（显式添加，防止被移除）
          if (!canvas.getObjects().includes(path)) {
            canvas.add(path)
          }
          // 强制渲染以确保路径可见
          canvas.renderAll()
          // 再次确认路径对象存在
          setTimeout(() => {
            if (!canvas.getObjects().includes(path)) {
              console.warn('路径对象丢失，重新添加')
              canvas.add(path)
              canvas.renderAll()
            }
            setMaskObjectCount(canvas.getObjects().length)
          }, 100)
        }
        // 使用setTimeout确保对象计数在下一帧更新
        setTimeout(() => {
          setMaskObjectCount(canvas.getObjects().length)
        }, 0)
        impactHaptic('light')
      })
      
      canvas.on('mouse:down', () => {
        setIsDrawing(true)
      })
      
      canvas.on('mouse:up', () => {
        setIsDrawing(false)
      })
      
      // 监听对象变化（删除等操作）
      canvas.on('object:removed', () => {
        setMaskObjectCount(canvas.getObjects().length)
      })

      // 重置缩放和移动状态
      setCanvasZoom(1.0)
      setCanvasPan({ x: 0, y: 0 })
      setIsPanMode(false)
      canvas.setZoom(1.0)
      canvas.absolutePan(new fabric.Point(0, 0))
      canvas.defaultCursor = 'crosshair'
      canvas.isDrawingMode = true
      
      setIsCanvasReady(true)
      console.log('Canvas初始化完成')
    }).catch((error) => {
      console.error('背景图片加载失败:', error)
      toast.error('背景图片加载失败')
      notificationHaptic('error')
    })
  }, [brushSize, impactHaptic, notificationHaptic])

  // 处理图片上传
  const handleImageUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    console.log('文件信息:', {
      name: file.name,
      type: file.type,
      size: file.size,
      sizeMB: (file.size / 1024 / 1024).toFixed(2) + 'MB'
    })

    // 文件大小验证 (3MB限制)
    const MAX_FILE_SIZE = 3 * 1024 * 1024 // 3MB in bytes
    if (file.size > MAX_FILE_SIZE) {
      const fileSizeMB = file.size / 1024 / 1024
      toast.error(`文件大小超过3MB限制，当前文件${fileSizeMB.toFixed(2)}MB，请选择更小的图片`)
      notificationHaptic('error')
      return
    }

    const reader = new FileReader()
    
    reader.onload = async (e) => {
      const imageUrl = e.target?.result as string
      console.log('✅ 文件验证通过，开始读取...')
      
      if (!imageUrl) {
        toast.error('无法读取图片文件')
        notificationHaptic('error')
        return
      }

      console.log('✅ 文件读取成功，数据长度:', imageUrl.length)
      console.log('✅ 文件数据预览:', imageUrl.substring(0, 100) + '...')

      // 创建图片对象来验证和获取尺寸
      const img = new Image()
      img.onload = () => {
        console.log('设置uploadedImage状态...')
        setUploadedImage(imageUrl)
        originalImageRef.current = img
        notificationHaptic('success')
      }
      
      img.onerror = () => {
        toast.error('图片加载失败，请检查文件格式')
        notificationHaptic('error')
      }
      
      img.src = imageUrl
    }

    reader.onerror = () => {
      toast.error('文件读取失败')
      notificationHaptic('error')
    }

    reader.readAsDataURL(file)
  }, [notificationHaptic])

  // 监听uploadedImage变化并初始化Canvas
  useEffect(() => {
    if (uploadedImage && originalImageRef.current) {
      console.log('uploadedImage状态变化: 已设置')
      console.log('uploadedImage数据长度:', uploadedImage.length)
      initializeCanvas(uploadedImage, originalImageRef.current)
    }
  }, [uploadedImage, initializeCanvas])

  // 监听窗口大小变化和全屏模式切换，重新调整canvas尺寸
  useEffect(() => {
    const handleResize = () => {
      if (uploadedImage && originalImageRef.current && fabricCanvasRef.current) {
        console.log('窗口大小变化，重新调整canvas尺寸')
        initializeCanvas(uploadedImage, originalImageRef.current)
      }
    }

    let resizeTimeout: NodeJS.Timeout
    const debouncedResize = () => {
      clearTimeout(resizeTimeout)
      resizeTimeout = setTimeout(handleResize, 300) // 300ms防抖
    }

    window.addEventListener('resize', debouncedResize)
    return () => {
      window.removeEventListener('resize', debouncedResize)
      clearTimeout(resizeTimeout)
    }
  }, [uploadedImage, initializeCanvas])

  // 监听全屏模式切换，重新计算画布尺寸以修复坐标偏移（保留路径对象）
  useEffect(() => {
    if (uploadedImage && originalImageRef.current && fabricCanvasRef.current) {
      // 延迟一点执行，确保DOM已更新
      const timer = setTimeout(() => {
        console.log('全屏模式切换，重新调整canvas尺寸（保留路径）')
        resizeCanvasPreservingPaths(uploadedImage, originalImageRef.current)
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [isFullscreenMode, uploadedImage, resizeCanvasPreservingPaths])

  // 画笔大小变化处理
  const handleBrushSizeChange = useCallback((size: number) => {
    setBrushSize(size)
    if (fabricCanvasRef.current && fabricCanvasRef.current.freeDrawingBrush) {
      fabricCanvasRef.current.freeDrawingBrush.width = size
    }
    impactHaptic('light')
  }, [impactHaptic])

  // 坐标转换函数 - 处理CSS缩放导致的坐标偏移（简化版本）
  const getCanvasCoordinates = useCallback((event: any) => {
    if (!fabricCanvasRef.current) return { x: 0, y: 0 }
    
    const canvas = fabricCanvasRef.current
    // 使用Fabric.js内置的getPointer，更可靠
    const pointer = canvas.getPointer(event.e || event)
    return { x: pointer.x, y: pointer.y }
  }, [])

  // 撤销功能
  const handleUndo = useCallback(() => {
    if (!fabricCanvasRef.current) return
    
    const canvas = fabricCanvasRef.current
    const objects = canvas.getObjects()
    if (objects.length > 0) {
      canvas.remove(objects[objects.length - 1])
      setMaskObjectCount(canvas.getObjects().length)
      impactHaptic('light')
    }
  }, [impactHaptic])

  // 清空遮罩
  const handleClearMask = useCallback(() => {
    if (!fabricCanvasRef.current) return
    
    const canvas = fabricCanvasRef.current
    const objects = canvas.getObjects()
    objects.forEach(obj => canvas.remove(obj))
    canvas.renderAll()
    setMaskObjectCount(0)
    notificationHaptic('success')
  }, [notificationHaptic])

  // 缩放功能
  const handleZoomIn = useCallback(() => {
    if (fabricCanvasRef.current && canvasZoom < 3.0) {
      const newZoom = Math.min(canvasZoom + 0.25, 3.0)
      fabricCanvasRef.current.setZoom(newZoom)
      setCanvasZoom(newZoom)
      impactHaptic('light')
    }
  }, [canvasZoom, impactHaptic])

  const handleZoomOut = useCallback(() => {
    if (fabricCanvasRef.current && canvasZoom > 0.5) {
      const newZoom = Math.max(canvasZoom - 0.25, 0.5)
      fabricCanvasRef.current.setZoom(newZoom)
      setCanvasZoom(newZoom)
      impactHaptic('light')
    }
  }, [canvasZoom, impactHaptic])

  const handleZoomReset = useCallback(() => {
    if (fabricCanvasRef.current) {
      fabricCanvasRef.current.setZoom(1.0)
      fabricCanvasRef.current.absolutePan(new fabric.Point(0, 0))
      setCanvasZoom(1.0)
      setCanvasPan({ x: 0, y: 0 })
      impactHaptic('medium')
    }
  }, [impactHaptic])

  // 移动模式切换
  const handleTogglePanMode = useCallback(() => {
    if (fabricCanvasRef.current) {
      const newPanMode = !isPanMode
      setIsPanMode(newPanMode)
      const canvas = fabricCanvasRef.current
      
      if (newPanMode) {
        // 切换到移动模式：禁用绘制
        canvas.isDrawingMode = false
        canvas.defaultCursor = 'move'
      } else {
        // 切换回绘制模式：启用绘制，重置pan和zoom确保坐标一致
        canvas.isDrawingMode = true
        canvas.defaultCursor = 'crosshair'
        // 注意：不重置pan和zoom，允许用户继续在当前位置绘制
        // 但确保路径坐标正确转换
      }
      impactHaptic('light')
    }
  }, [isPanMode, impactHaptic])

  // 移动功能实现（拖拽）- 添加边界限制
  useEffect(() => {
    if (!fabricCanvasRef.current || !isPanMode) return

    let isDragging = false
    let lastPos = { x: 0, y: 0 }

    // 获取画布边界限制
    const getPanBounds = () => {
      const canvas = fabricCanvasRef.current!
      const zoom = canvas.getZoom()
      
      // 获取画布和容器的尺寸
      const canvasWidth = canvas.width || 0
      const canvasHeight = canvas.height || 0
      const container = canvas.getElement().parentElement
      const containerWidth = container?.clientWidth || window.innerWidth
      const containerHeight = container?.clientHeight || window.innerHeight
      
      // 计算缩放后的画布尺寸
      const scaledWidth = canvasWidth * zoom
      const scaledHeight = canvasHeight * zoom
      
      // 只有当缩放后的画布大于容器时，才需要限制边界
      // 如果画布小于容器，允许自由移动（但限制在合理范围内）
      if (scaledWidth <= containerWidth && scaledHeight <= containerHeight) {
        // 画布小于容器，允许居中移动，但限制在画布尺寸范围内
        const maxOffsetX = Math.max(0, (containerWidth - scaledWidth) / 2)
        const maxOffsetY = Math.max(0, (containerHeight - scaledHeight) / 2)
        return { 
          minX: -maxOffsetX, 
          maxX: maxOffsetX, 
          minY: -maxOffsetY, 
          maxY: maxOffsetY 
        }
      } else {
        // 画布大于容器，限制在可视区域内
        const minX = containerWidth - scaledWidth
        const maxX = 0
        const minY = containerHeight - scaledHeight
        const maxY = 0
        return { minX, maxX, minY, maxY }
      }
    }

    // 限制pan在边界内
    const constrainPan = (newPanX: number, newPanY: number) => {
      const bounds = getPanBounds()
      const constrainedX = Math.max(bounds.minX, Math.min(bounds.maxX, newPanX))
      const constrainedY = Math.max(bounds.minY, Math.min(bounds.maxY, newPanY))
      return { x: constrainedX, y: constrainedY }
    }

    const handleMouseDown = (e: fabric.TEvent) => {
      isDragging = true
      // 使用屏幕坐标（clientX/clientY）来计算移动距离
      const evt = e.e as MouseEvent
      lastPos = { x: evt.clientX, y: evt.clientY }
    }

    const handleMouseMove = (e: fabric.TEvent) => {
      if (!isDragging) return
      const canvas = fabricCanvasRef.current!
      const evt = e.e as MouseEvent
      
      // 计算屏幕坐标的差值（像素）
      const deltaX = evt.clientX - lastPos.x
      const deltaY = evt.clientY - lastPos.y
      
      // 获取当前pan位置
      const vpt = canvas.viewportTransform || [1, 0, 0, 1, 0, 0]
      const currentPanX = vpt[4]
      const currentPanY = vpt[5]
      
      // 计算新的pan位置（直接加上屏幕像素差值）
      const newPanX = currentPanX + deltaX
      const newPanY = currentPanY + deltaY
      
      // 限制在边界内
      const constrained = constrainPan(newPanX, newPanY)
      
      // 应用限制后的pan
      canvas.absolutePan(new fabric.Point(constrained.x, constrained.y))
      
      // 更新 lastPos 为当前屏幕坐标
      lastPos = { x: evt.clientX, y: evt.clientY }
      
      // 强制重新渲染，确保背景图片正确显示
      canvas.renderAll()
    }

    const handleMouseUp = () => {
      isDragging = false
    }

    // 触摸事件处理 - 使用标准触摸事件
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        isDragging = true
        // 使用屏幕坐标（clientX/clientY）来计算移动距离
        const touch = e.touches[0]
        lastPos = { x: touch.clientX, y: touch.clientY }
        e.preventDefault()
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging || e.touches.length !== 1) return
      e.preventDefault()
      const canvas = fabricCanvasRef.current!
      const touch = e.touches[0]
      
      // 计算屏幕坐标的差值（像素）
      const deltaX = touch.clientX - lastPos.x
      const deltaY = touch.clientY - lastPos.y
      
      // 获取当前pan位置
      const vpt = canvas.viewportTransform || [1, 0, 0, 1, 0, 0]
      const currentPanX = vpt[4]
      const currentPanY = vpt[5]
      
      // 计算新的pan位置（直接加上屏幕像素差值）
      const newPanX = currentPanX + deltaX
      const newPanY = currentPanY + deltaY
      
      // 限制在边界内
      const constrained = constrainPan(newPanX, newPanY)
      
      // 应用限制后的pan
      canvas.absolutePan(new fabric.Point(constrained.x, constrained.y))
      
      // 更新 lastPos 为当前屏幕坐标
      lastPos = { x: touch.clientX, y: touch.clientY }
      
      // 强制重新渲染，确保背景图片正确显示
      canvas.renderAll()
    }

    const handleTouchEnd = () => {
      isDragging = false
    }

    const canvas = fabricCanvasRef.current
    const canvasElement = canvasRef.current
    
    canvas.on('mouse:down', handleMouseDown)
    canvas.on('mouse:move', handleMouseMove)
    canvas.on('mouse:up', handleMouseUp)
    
    // 添加触摸事件监听
    if (canvasElement) {
      canvasElement.addEventListener('touchstart', handleTouchStart, { passive: false })
      canvasElement.addEventListener('touchmove', handleTouchMove, { passive: false })
      canvasElement.addEventListener('touchend', handleTouchEnd)
    }

    return () => {
      canvas.off('mouse:down', handleMouseDown)
      canvas.off('mouse:move', handleMouseMove)
      canvas.off('mouse:up', handleMouseUp)
      if (canvasElement) {
        canvasElement.removeEventListener('touchstart', handleTouchStart)
        canvasElement.removeEventListener('touchmove', handleTouchMove)
        canvasElement.removeEventListener('touchend', handleTouchEnd)
      }
    }
  }, [isPanMode])

  // 重置所有状态
  const handleReset = useCallback(() => {
    setUploadedImage(null)
    setIsProcessing(false)
    setIsCanvasReady(false)
    setMaskObjectCount(0)
    setIsRepaintComplete(false)
    setIsFullscreenMode(false)
    setCanvasZoom(1.0)
    setCanvasPan({ x: 0, y: 0 })
    setIsPanMode(false)
    
    if (fabricCanvasRef.current) {
      fabricCanvasRef.current.dispose()
      fabricCanvasRef.current = null
    }
    
    // 清空文件输入
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    if (fileInput) {
      fileInput.value = ''
    }
    
    notificationHaptic('success')
  }, [notificationHaptic])

  // 开始重绘
  const handleStartRepaint = useCallback(async () => {
    if (!fabricCanvasRef.current || !uploadedImage || !originalImageRef.current) {
      toast.error('请先上传图片并绘制遮罩')
      notificationHaptic('error')
      return
    }

    if (maskObjectCount === 0) {
      toast.error('请先绘制遮罩区域')
      notificationHaptic('error')
      return
    }

    // 提示词验证已移除，使用默认提示词

    // TMA用户验证 - 开发模式下允许无用户测试
    if (!user && !isDevEnvironment && import.meta.env.VITE_ALLOW_NON_TELEGRAM !== 'true') {
      toast.error('请在Telegram环境中使用此应用')
      notificationHaptic('error')
      return
    }

    // 保存扣除前的算力点数量并显示扣除动画
    if (credits !== null) {
      setPreviousCredits(credits)
      setCreditDeductionAmount(1) // 每次消耗1个算力点
      setShowCreditDeduction(true)
      // 延迟一点显示动画，让用户看到效果
      setTimeout(() => {
        setShowCreditDeduction(false)
      }, 2000)
    }
    
    setIsProcessing(true)
    impactHaptic('medium')

    try {
      // 获取原始图片尺寸
      const originalWidth = originalImageRef.current.naturalWidth
      const originalHeight = originalImageRef.current.naturalHeight
      
      // 创建遮罩画布
      const maskCanvas = document.createElement('canvas')
      maskCanvas.width = originalWidth
      maskCanvas.height = originalHeight
      const maskCtx = maskCanvas.getContext('2d')!
      
      // 清空遮罩画布
      maskCtx.clearRect(0, 0, originalWidth, originalHeight)
      
      // 绘制遮罩区域
      const canvas = fabricCanvasRef.current
      const objects = canvas.getObjects()
      
      console.log('遮罩对象数量:', objects.length)
      
      // 计算显示缩放比例
      const displayScale = (canvas.width || 1) / originalWidth
      console.log('显示缩放比例:', displayScale)
      console.log('画布尺寸:', canvas.width, 'x', canvas.height)
      console.log('原始图片尺寸:', originalWidth, 'x', originalHeight)
      
      objects.forEach(obj => {
        if (obj.type === 'path') {
          const path = obj as fabric.Path
          console.log('路径对象:', path)
          console.log('路径位置:', path.left, path.top)
          
          // 保存当前状态
          maskCtx.save()
          
          // 缩放坐标到原始图片尺寸
          maskCtx.scale(1 / displayScale, 1 / displayScale)
          
          // 设置绘制样式
          maskCtx.fillStyle = 'white'
          maskCtx.strokeStyle = 'white'
          maskCtx.lineWidth = (path.strokeWidth || brushSize) / displayScale
          maskCtx.lineCap = 'round'
          maskCtx.lineJoin = 'round'
          
          // 绘制路径
          // 路径对象的path数组中的坐标是相对于路径对象的位置
          // 需要加上路径对象的left和top来得到画布坐标
          const pathData = path.path
          if (pathData && pathData.length > 0) {
            maskCtx.beginPath()
            pathData.forEach((command, index) => {
              const [type, ...coords] = command
              const validCoords = coords.map((coord) => {
                const num = Number(coord)
                return isNaN(num) ? 0 : num
              })
              
              if (type === 'M' && validCoords.length >= 2) {
                // 路径坐标是相对于路径对象的，需要加上路径对象的位置
                const x = validCoords[0] + (path.left || 0)
                const y = validCoords[1] + (path.top || 0)
                maskCtx.moveTo(x, y)
              } else if (type === 'L' && validCoords.length >= 2) {
                const x = validCoords[0] + (path.left || 0)
                const y = validCoords[1] + (path.top || 0)
                maskCtx.lineTo(x, y)
              } else if (type === 'Q' && validCoords.length >= 4) {
                const x1 = validCoords[0] + (path.left || 0)
                const y1 = validCoords[1] + (path.top || 0)
                const x2 = validCoords[2] + (path.left || 0)
                const y2 = validCoords[3] + (path.top || 0)
                maskCtx.quadraticCurveTo(x1, y1, x2, y2)
              } else if (type === 'C' && validCoords.length >= 6) {
                const x1 = validCoords[0] + (path.left || 0)
                const y1 = validCoords[1] + (path.top || 0)
                const x2 = validCoords[2] + (path.left || 0)
                const y2 = validCoords[3] + (path.top || 0)
                const x3 = validCoords[4] + (path.left || 0)
                const y3 = validCoords[5] + (path.top || 0)
                maskCtx.bezierCurveTo(x1, y1, x2, y2, x3, y3)
              } else if (type === 'Z') {
                maskCtx.closePath()
              }
            })
            maskCtx.stroke()
          }
          
          // 恢复状态
          maskCtx.restore()
        }
      })
      
      // 获取遮罩图片数据
      const maskImageData = maskCanvas.toDataURL('image/png')
      console.log('遮罩数据长度:', maskImageData.length)
      
      // 获取原始图片数据
      const originalImageData = uploadedImage
      
      // 准备发送的数据 - 匹配后端期望的格式
      const compositeImage = originalImageData // 使用原始图片作为合成图片
      const chatId = user?.id || (isDevEnvironment && import.meta.env.VITE_ALLOW_NON_TELEGRAM === 'true' ? 123456789 : null)
      
      const requestData = {
        composite_image_base64: compositeImage,
        prompt: currentPrompt,
        chat_id: chatId
      }

      const ok = credits!==null ? await consumeCredits(requestData) : null
      if (ok===true) { toast.success('🎉 任务已提交'); notificationHaptic('success'); setIsRepaintComplete(true); hideMainButton() }
      else if (ok===null) {
        const controller = new AbortController(); const timeoutId = setTimeout(() => controller.abort(), 30000)
        const makeWebhookUrl = import.meta.env.VITE_MAKE_WEBHOOK_URL
        if (!makeWebhookUrl) {
          toast.error('Webhook未配置')
          return
        }
        const response = await fetch(makeWebhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify({ composite_image_base64: compositeImage, prompt: currentPrompt, chat_id: chatId }), signal: controller.signal })
        clearTimeout(timeoutId)
        if (response.ok) { toast.success('🎉 图片处理成功！结果将通过机器人发送给您'); notificationHaptic('success'); setIsRepaintComplete(true); hideMainButton() } else { const responseText = await response.text(); throw new Error(responseText || '处理失败') }
      } else { setShowTopUp(true) }

    } catch (error) {
      console.error('重绘失败:', error)
      
      // 更详细的错误信息
      let errorMessage = '处理失败'
      if (error instanceof Error) {
        errorMessage = error.message
        
        // 特殊处理网络错误
        if (errorMessage.includes('Failed to fetch')) {
          errorMessage = '网络连接失败，请检查网络连接'
        } else if (errorMessage.includes('timeout')) {
          errorMessage = '请求超时，请稍后重试'
        } else if (errorMessage.includes('JSON')) {
          errorMessage = '服务器响应格式错误'
        }
      }
      
      toast.error(`处理失败: ${errorMessage}`)
      notificationHaptic('error')
    } finally {
      setIsProcessing(false)
      // 清理扣除动画状态
      setTimeout(() => {
        setPreviousCredits(null)
      }, 2500)
    }
  }, [uploadedImage, maskObjectCount, user, isDevEnvironment, notificationHaptic, impactHaptic, hideMainButton, brushSize, originalImageRef, currentPrompt, consumeCredits, credits])

  // TMA Main Button integration
  useEffect(() => {
    if (isPanMode) {
      // 在移动模式下，显示"返回绘制"按钮
      showMainButton('返回绘制', handleTogglePanMode)
    } else if (uploadedImage && maskObjectCount > 0 && !isProcessing) {
      showMainButton('开始重绘', handleStartRepaint)
    } else {
      hideMainButton()
    }
  }, [uploadedImage, maskObjectCount, isProcessing, isPanMode, showMainButton, hideMainButton, handleStartRepaint, handleTogglePanMode])

  // 完成状态处理
  const handleComplete = () => {
    setIsRepaintComplete(false)
    handleReset()
    impactHaptic('light')
  }

  // 完成界面
  if (isRepaintComplete) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold mb-2">发送成功</h2>
          <p className="text-gray-300 mb-6">任务已经成功发送，请返回机器人等待重绘结果</p>
          <Button onClick={handleComplete} variant="primary">
            开始新的创作
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Toaster position="top-center" />
      
      {/* 标题 - 在上传图片后隐藏 */}
      {!uploadedImage && (
        <h1 className="text-2xl font-bold text-center mb-8">AI 图像重绘</h1>
      )}
      
      {/* 算力值和充值入口 - 在首页显示 */}
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
      
      {/* 使用说明 - 在上传图片后隐藏 */}
      {!uploadedImage && (
        <div className="max-w-2xl mx-auto mb-8 bg-gray-800 rounded-lg border border-gray-700">
          <div 
            className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-750 transition-colors"
            onClick={() => setShowInstructions(!showInstructions)}
          >
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                <span className="text-white text-sm font-bold">👋</span>
              </div>
              <h2 className="text-lg font-semibold text-white">欢迎来到 AI 图像重绘助手！</h2>
            </div>
            <div className={`transform transition-transform ${showInstructions ? 'rotate-180' : ''}`}>
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
          
          {showInstructions && (
            <div className="px-4 pb-4 space-y-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-white text-xs font-bold">1</span>
                  </div>
                  <div>
                    <h3 className="font-medium text-white">上传图片</h3>
                    <p className="text-gray-300 text-sm">点击上传按钮选择您想要修改的图片（最大3MB）</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-white text-xs font-bold">2</span>
                  </div>
                  <div>
                    <h3 className="font-medium text-white">绘制遮罩</h3>
                    <p className="text-gray-300 text-sm">用画笔在想要重绘的区域涂抹，白色区域将被AI替换</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-white text-xs font-bold">3</span>
                  </div>
                  <div>
                    <h3 className="font-medium text-white">开始重绘</h3>
                    <p className="text-gray-300 text-sm">点击"开始重绘"按钮，AI将自动处理您的图片</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-700 rounded-lg p-3">
                <h4 className="font-medium text-yellow-400 mb-2">💡 小贴士</h4>
                <ul className="text-gray-300 text-sm space-y-1">
                  <li>• 保障网络稳定，图片建议不超过 3MB</li>
                  <li>• 绘制遮罩时尽量精确，效果会更自然</li>
                  <li>• 如果长时间没有结果，请检查网络或重试</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      )}
      
      <div className="container mx-auto px-4 py-6 app-desktop-container">
        {!uploadedImage ? (
          // 上传界面
          <div className="max-w-2xl mx-auto">
            <div className="border-2 border-dashed border-gray-600 rounded-lg p-12 text-center hover:border-gray-500 transition-colors">
              <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <h3 className="text-xl font-semibold mb-2">上传图片开始创作</h3>
              <p className="text-gray-400 mb-6">支持 JPG、PNG 格式，最大 3MB</p>
              <label className="cursor-pointer">
                <span className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg inline-block transition-colors">
                  选择图片
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        ) : (
          // 编辑界面
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-12 gap-4 lg:gap-6">
              <div className="col-span-12 lg:col-span-4">
                <div className="bg-gray-800 rounded-lg p-4 mb-6">
                  <div className="space-y-4">
                    {/* 绘制工具组 */}
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-gray-300">画笔大小:</label>
                      <input
                        type="range"
                        min="5"
                        max="50"
                        value={brushSize}
                        onChange={(e) => handleBrushSizeChange(Number(e.target.value))}
                        className="w-24 sm:w-32 touch-manipulation"
                        disabled={isPanMode}
                      />
                      <span className="text-sm text-gray-400 min-w-[3rem]">{brushSize}px</span>
                    </div>
                    
                    {/* 缩放工具组 */}
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-300">缩放:</span>
                      <div className="flex gap-2 flex-1">
                        <button
                          onClick={handleZoomOut}
                          disabled={canvasZoom <= 0.5}
                          className="p-2 bg-gray-700 hover:bg-gray-600 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] min-w-[44px] flex items-center justify-center"
                          title="缩小"
                        >
                          <ZoomOut className="w-5 h-5" />
                        </button>
                        <button
                          onClick={handleZoomReset}
                          className="p-2 bg-gray-700 hover:bg-gray-600 rounded transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                          title="重置缩放"
                        >
                          <RotateCcw className="w-5 h-5" />
                        </button>
                        <button
                          onClick={handleZoomIn}
                          disabled={canvasZoom >= 3.0}
                          className="p-2 bg-gray-700 hover:bg-gray-600 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] min-w-[44px] flex items-center justify-center"
                          title="放大"
                        >
                          <ZoomIn className="w-5 h-5" />
                        </button>
                        <span className="text-sm text-gray-400 flex items-center min-w-[3rem] justify-center">
                          {Math.round(canvasZoom * 100)}%
                        </span>
                      </div>
                    </div>
                    
                    {/* 移动工具组 */}
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-300">移动:</span>
                      <button
                        onClick={handleTogglePanMode}
                        className={`p-2 rounded transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center flex-1 ${
                          isPanMode 
                            ? 'bg-blue-600 hover:bg-blue-700' 
                            : 'bg-gray-700 hover:bg-gray-600'
                        }`}
                        title={isPanMode ? "退出移动模式" : "进入移动模式"}
                      >
                        <Move className="w-5 h-5" />
                      </button>
                      {isPanMode && (
                        <span className="text-xs text-blue-400">移动模式</span>
                      )}
                    </div>
                    
                    {/* 操作工具组 */}
                    <div className="flex items-center gap-2 flex-wrap">
                      {!isFullscreenMode && (
                        <button
                          onClick={() => setIsFullscreenMode(true)}
                          className="p-2 bg-blue-600 hover:bg-blue-700 rounded transition-colors shadow-lg min-h-[44px] min-w-[44px] flex items-center justify-center"
                          title="进入全屏模式"
                        >
                          <Maximize2 className="w-5 h-5" />
                        </button>
                      )}
                      <button
                        onClick={handleUndo}
                        className="p-2 bg-gray-700 hover:bg-gray-600 rounded transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                        title="撤销"
                      >
                        <Undo2 className="w-5 h-5" />
                      </button>
                      <button
                        onClick={handleClearMask}
                        className="p-2 bg-gray-700 hover:bg-gray-600 rounded transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                        title="清空Mask"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                      <button
                        onClick={handleReset}
                        className="p-2 bg-red-600 hover:bg-red-700 rounded transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                        title="重新上传"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="col-span-12 lg:col-span-8">
                <div className={`${isFullscreenMode ? 'fixed inset-0 bg-gray-900 z-40' : 'mb-6 w-full'} flex justify-center lg:justify-start xl:justify-center items-center`}>
                  <div className={`relative border-2 border-gray-600 rounded-lg overflow-hidden transition-all duration-300 ${
                    isFullscreenMode 
                      ? 'w-full max-w-full h-auto max-h-[90vh]' 
                      : 'w-full max-w-[90%] xl:max-w-[85%] landscape-image-container'
                  }`}>
                    <canvas 
                      ref={canvasRef} 
                      className={`block mx-auto ${isPanMode ? 'cursor-move' : (isDrawing ? 'cursor-crosshair' : 'cursor-default')}`}
                      style={{ 
                        touchAction: isPanMode ? 'pan-x pan-y' : 'none', 
                        backgroundColor: 'transparent',
                        display: 'block',
                        maxWidth: '100%',
                        height: 'auto'
                      }}
                    />
                    <div className="absolute inset-0 pointer-events-none border-2 border-blue-400 rounded-lg opacity-0 hover:opacity-100 transition-opacity duration-200"></div>
                    {isFullscreenMode && (
                      <button
                        onClick={() => setIsFullscreenMode(false)}
                        className="absolute top-4 right-4 p-2 bg-red-600 hover:bg-red-700 rounded-full transition-colors shadow-lg z-10"
                        title="退出全屏模式 (ESC)"
                      >
                        <Minimize2 className="w-6 h-6" />
                      </button>
                    )}
                    {isDrawing && !isPanMode && (
                      <div className="absolute top-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-sm">绘制中...</div>
                    )}
                    {isPanMode && (
                      <div className="absolute top-2 left-2 bg-blue-600 bg-opacity-75 text-white px-2 py-1 rounded text-sm">移动模式 - 拖拽移动画布</div>
                    )}
                    {canvasZoom !== 1.0 && (
                      <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-sm">
                        缩放: {Math.round(canvasZoom * 100)}%
                      </div>
                    )}
                    {!isCanvasReady && uploadedImage && (
                      <div className="absolute inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center">
                        <div className="text-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
                          <p className="text-white text-sm">画布加载中...</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className={`fixed left-0 right-0 bg-gray-800 p-4 border-t border-gray-700 transition-all duration-300 desktop-fixed-bar ${
              isFullscreenMode 
                ? 'bottom-4 left-4 right-4 w-auto rounded-lg z-50 bg-opacity-95 backdrop-blur-sm max-w-md mx-auto' 
                : 'bottom-0'
            }`}>
              {isFullscreenMode && (
                <div className="absolute -top-16 left-0 right-0 flex justify-center gap-2 mb-4">
                  <button onClick={() => setIsFullscreenMode(false)} className="p-3 bg-gray-700 hover:bg-gray-600 rounded-full transition-colors shadow-lg" title="退出全屏模式 (ESC)"><Minimize2 className="w-6 h-6" /></button>
                  <button onClick={handleUndo} className="p-3 bg-gray-700 hover:bg-gray-600 rounded-full transition-colors shadow-lg" title="撤销"><Undo2 className="w-6 h-6" /></button>
                  <button onClick={handleClearMask} className="p-3 bg-gray-700 hover:bg-gray-600 rounded-full transition-colors shadow-lg" title="清空Mask"><Trash2 className="w-6 h-6" /></button>
                </div>
              )}
              <div className={`${isFullscreenMode ? '' : 'max-w-6xl mx-auto'}`}>
                <div className="flex justify-between items-center gap-3">
                  {/* 算力点信息显示 */}
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-2 px-4 py-2 bg-gray-700 rounded-lg relative">
                      <span className="text-2xl">⚡</span>
                      <span className="text-white font-semibold">
                        剩余算力: {isPaymentLoading ? '加载中...' : (credits !== null ? credits : '--')}
                      </span>
                      {/* 扣除算力点动画 */}
                      {showCreditDeduction && previousCredits !== null && (
                        <div className="absolute -top-12 left-1/2 pointer-events-none z-50 animate-credit-deduction">
                          <div className="text-red-400 font-bold text-3xl drop-shadow-2xl">
                            <div className="flex items-center gap-2">
                              <span className="text-4xl animate-pulse">⚡</span>
                              <span className="text-red-500">-{creditDeductionAmount}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    <Button onClick={()=>setShowTopUp(true)} variant="destructive" size="large">充值</Button>
                  </div>
                  {/* 在非Telegram环境或开发环境显示开始重绘按钮 */}
                  {(!isInTelegram || isDevEnvironment) && (
                    <Button
                      onClick={handleStartRepaint}
                      disabled={isProcessing || !isCanvasReady || maskObjectCount === 0 || (!user && !isDevEnvironment)}
                      variant="primary"
                      size="large"
                    >
                      {isProcessing ? '处理中...' : '开始重绘'}
                    </Button>
                  )}
                </div>
                {uploadedImage && isCanvasReady && (
                  <div className="text-center mt-2">
                    {!user && !isDevEnvironment ? (
                      <p className="text-red-400 text-sm">⚠️ 请在Telegram环境中使用此应用</p>
                    ) : maskObjectCount === 0 ? (
                      <p className="text-yellow-400 text-sm">💡 请在图片上绘制遮罩区域后再点击开始重绘</p>
                    ) : (
                      <p className="text-green-400 text-sm">✅ 已绘制 {maskObjectCount} 个遮罩区域</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      {/* 处理中全屏遮罩层 - 锁定页面防止用户操作 */}
      {isProcessing && (
        <div className="fixed inset-0 bg-black bg-opacity-75 z-[9999] flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
            <p className="text-white text-xl font-semibold mb-2">处理中...</p>
            <p className="text-gray-300 text-sm">请稍候，正在处理您的图片</p>
          </div>
        </div>
      )}
      <Modal isOpen={showTopUp} onClose={()=>setShowTopUp(false)} title="选择充值套餐" size="medium">
        <div className="space-y-4">
          <div className="text-center mb-4">
            <div className="flex items-center justify-center gap-2 mb-2">
              <span className="text-2xl">⚡</span>
              <span className="text-lg font-semibold text-gray-900">使用 Telegram Stars 购买算力点</span>
              <span className="text-2xl">⚡</span>
            </div>
            <p className="text-sm text-gray-600">每次重绘消耗 1 个算力点</p>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            {PACKAGES.map((pkg) => (
              <button
                key={pkg.sku}
                onClick={() => setSelectedPackage(pkg.sku)}
                className={`relative p-4 rounded-lg border-2 cursor-pointer transition-all ${
                  selectedPackage === pkg.sku
                    ? 'border-blue-400 bg-blue-700/40 shadow-lg shadow-blue-500/30'
                    : 'border-gray-700 bg-gray-900/80 hover:border-gray-600 hover:bg-gray-900'
                } ${pkg.popular ? 'ring-2 ring-yellow-400' : ''}`}
              >
                {pkg.popular && (
                  <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
                    <span className="bg-yellow-400 text-black text-xs px-2 py-1 rounded-full font-semibold">
                      推荐
                    </span>
                  </div>
                )}
                
                <div className="text-center">
                  <div className="text-lg font-bold text-white">{pkg.label}</div>
                  <div className={`text-sm mb-2 ${
                    selectedPackage === pkg.sku ? 'text-gray-200' : 'text-gray-300'
                  }`}>约 {pkg.credits} 次重绘</div>
                  <div className="flex items-center justify-center gap-1">
                    <span className="text-xl">⭐</span>
                    <span className="font-semibold text-yellow-300">{pkg.xtr}</span>
                  </div>
                  <div className={`text-xs mt-1 ${
                    selectedPackage === pkg.sku ? 'text-gray-300' : 'text-gray-400'
                  }`}>
                    汇率: {Math.round((pkg.xtr / pkg.credits) * 10) / 10} Stars/点
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="bg-gray-800 rounded-lg p-3">
            <div className="flex justify-between items-center text-sm">
              <span>您将获得:</span>
              <span className="font-semibold">
                {PACKAGES.find(p => p.sku === selectedPackage)?.credits} 算力点
              </span>
            </div>
            <div className="flex justify-between items-center text-sm mt-1">
              <span>需要支付:</span>
              <span className="font-semibold flex items-center gap-1">
                <span className="text-lg">⭐</span>
                {PACKAGES.find(p => p.sku === selectedPackage)?.xtr} Stars
              </span>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              variant="secondary"
              onClick={() => setShowTopUp(false)}
              className="flex-1"
              disabled={isProcessingPayment}
            >
              取消
            </Button>
            <Button
              onClick={async () => {
                setIsProcessingPayment(true)
                try {
                  await handleCreateInvoice(selectedPackage)
                } finally {
                  setIsProcessingPayment(false)
                }
              }}
              className="flex-1"
              disabled={isProcessingPayment}
            >
              {isProcessingPayment ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  处理中...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-lg">⭐</span>
                  立即充值
                </div>
              )}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}