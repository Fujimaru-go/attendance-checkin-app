'use client'

import { useEffect, useRef } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { X } from 'lucide-react'

interface Props {
  onScan: (value: string) => void
  onClose: () => void
}

const SCANNER_ID = 'qr-scanner-container'

export default function QrScanner({ onScan, onClose }: Props) {
  const scannerRef = useRef<Html5Qrcode | null>(null)
  const didStart = useRef(false)

  useEffect(() => {
    if (didStart.current) return
    didStart.current = true

    const scanner = new Html5Qrcode(SCANNER_ID)
    scannerRef.current = scanner

    scanner
      .start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          stop().then(() => onScan(decodedText))
        },
        undefined,
      )
      .catch((err) => {
        console.error('QR scanner start error:', err)
      })

    async function stop() {
      if (scannerRef.current?.isScanning) {
        await scannerRef.current.stop()
      }
    }

    return () => {
      stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleClose = async () => {
    if (scannerRef.current?.isScanning) {
      await scannerRef.current.stop()
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="relative w-full max-w-sm mx-4 bg-white rounded-2xl overflow-hidden shadow-2xl">
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <span className="font-bold text-gray-700 text-lg">QRコードをかざしてください</span>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* カメラビュー */}
        <div className="p-4">
          <div id={SCANNER_ID} className="w-full rounded-xl overflow-hidden" />
        </div>
      </div>
    </div>
  )
}
