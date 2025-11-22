import { useState, useCallback } from 'react'
import { Modal } from '@/components/TMAModal'
import { Button } from '@/components/TMAButton'

interface TopUpModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectPackage: (sku: string) => Promise<boolean>
  isProcessing?: boolean
}

const PACKAGES = [
  { sku: 'pack12', xtr: 50, credits: 12, label: '12算力点', popular: false },
  { sku: 'pack30', xtr: 100, credits: 30, label: '30算力点', popular: true },
  { sku: 'pack60', xtr: 180, credits: 60, label: '60算力点', popular: false },
  { sku: 'pack88', xtr: 250, credits: 88, label: '88算力点', popular: false }
]

export const TopUpModal: React.FC<TopUpModalProps> = ({ 
  isOpen, 
  onClose, 
  onSelectPackage, 
  isProcessing = false 
}) => {
  const [selectedPackage, setSelectedPackage] = useState<string>('pack30')
  const [isLoading, setIsLoading] = useState(false)

  const handlePurchase = useCallback(async () => {
    setIsLoading(true)
    try {
      const success = await onSelectPackage(selectedPackage)
      if (success) {
        onClose()
      }
    } catch (error) {
      console.error('Purchase error:', error)
    } finally {
      setIsLoading(false)
    }
  }, [selectedPackage, onSelectPackage, onClose])

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="充值算力点">
      <div className="space-y-4">
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="text-2xl">⭐</span>
            <span className="text-lg font-semibold">使用 Telegram Stars 购买算力点</span>
            <span className="text-2xl">⭐</span>
          </div>
          <p className="text-sm text-gray-400">每次重绘消耗 1 个算力点</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {PACKAGES.map((pkg) => (
            <div
              key={pkg.sku}
              className={`relative p-4 rounded-lg border-2 cursor-pointer transition-all ${
                selectedPackage === pkg.sku
                  ? 'border-blue-500 bg-blue-500/10'
                  : 'border-gray-600 hover:border-gray-500'
              } ${pkg.popular ? 'ring-2 ring-yellow-400' : ''}`}
              onClick={() => setSelectedPackage(pkg.sku)}
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
                <div className="text-sm text-gray-400 mb-2">约 {pkg.credits} 次重绘</div>
                <div className="flex items-center justify-center gap-1">
                  <span className="text-xl">⭐</span>
                  <span className="font-semibold">{pkg.xtr}</span>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  汇率: {Math.round((pkg.xtr / pkg.credits) * 10) / 10} Stars/点
                </div>
              </div>
            </div>
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
            onClick={onClose}
            className="flex-1"
            disabled={isLoading || isProcessing}
          >
            取消
          </Button>
          <Button
            onClick={handlePurchase}
            className="flex-1"
            disabled={isLoading || isProcessing}
          >
            {isLoading || isProcessing ? (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                处理中...
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-lg">⭐</span>
                立即购买
              </div>
            )}
          </Button>
        </div>
      </div>
    </Modal>
  )
}