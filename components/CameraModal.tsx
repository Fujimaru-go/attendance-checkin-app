'use client'

/**
 * CameraModal — getUserMedia + jsQR によるQRコード読み取りモーダル
 *
 * ⚠️ Secure Context の制約について
 * getUserMedia() は Secure Context（HTTPS または localhost）でのみ動作します。
 * http://192.168.x.x:3000 のような HTTP のローカルIPでアクセスした場合、
 * iPad/Safari を含むほぼすべてのブラウザでカメラが起動しません。
 *
 * 開発中の回避策:
 *   1. npx next dev --experimental-https  （Next.js 14.1+ の組み込みHTTPS）
 *   2. ngrok / Cloudflare Tunnel でHTTPS URLを取得する
 *   3. mkcert でローカル自己署名証明書を作成する
 */

import { useEffect, useRef, useState } from 'react'
import { X, CameraOff } from 'lucide-react'
import jsQR from 'jsqr'

interface Props {
  onScan: (value: string) => void
  onClose: () => void
}

export default function CameraModal({ onScan, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const rafRef = useRef<number | null>(null)

  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [scannedValue, setScannedValue] = useState<string | null>(null)

  // ----- スキャンループ -----

  const stopScanLoop = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }

  const startScanLoop = () => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const tick = () => {
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        // 解析サイズを 640px 幅に抑えてモバイルの処理負荷を軽減
        const scale = Math.min(1, 640 / video.videoWidth)
        canvas.width = video.videoWidth * scale
        canvas.height = video.videoHeight * scale
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const result = jsQR(imageData.data, imageData.width, imageData.height)

        if (result) {
          console.log('[qr] detected:', result.data)
          stopScanLoop()
          stopCameraStream() // QR検出後はカメラストリームも停止
          setScannedValue(result.data)
          onScan(result.data)
          return
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
  }

  // ----- カメラ制御 -----

  const stopCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setIsRunning(false)
  }

  const startCamera = async () => {
    console.log('[camera] startCamera called, isSecureContext:', window.isSecureContext)
    setError(null)
    setScannedValue(null)

    if (!window.isSecureContext) {
      setError(
        'カメラを使用するにはHTTPS接続が必要です。\n' +
        '現在 HTTP でアクセスしているためカメラが起動できません。\n' +
        '開発時は npx next dev --experimental-https をお試しください。'
      )
      return
    }

    // 前面カメラ（user）を優先し、失敗したら制約なし（video: true）でフォールバック
    const constraints: MediaStreamConstraints[] = [
      { video: { facingMode: 'user' }, audio: false },
      { video: true, audio: false },
    ]

    let stream: MediaStream | null = null
    let lastError: DOMException | null = null

    for (const constraint of constraints) {
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraint)
        console.log('[camera] started with constraint:', JSON.stringify(constraint))
        break
      } catch (err) {
        lastError = err as DOMException
        console.warn('[camera] getUserMedia failed:', lastError.name, '/ retrying...')
      }
    }

    if (!stream) {
      const e = lastError!
      console.error('[camera] all constraints failed:', e.name, e.message)
      if (e.name === 'NotAllowedError') {
        setError('カメラの使用が拒否されました。\nブラウザの設定でカメラのアクセスを許可してください。')
      } else if (e.name === 'NotFoundError') {
        setError('カメラが見つかりません。')
      } else if (e.name === 'NotSupportedError') {
        setError('このブラウザ・環境ではカメラがサポートされていません。')
      } else {
        setError(`カメラの起動に失敗しました。\n(${e.name}: ${e.message})`)
      }
      return
    }

    try {
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        // iOS Safari では play() を明示的に呼ぶ必要がある
        await videoRef.current.play()
      }
      setIsRunning(true)
      startScanLoop()
    } catch (err) {
      const e = err as DOMException
      console.error('[camera] video.play() failed:', e.name, e.message)
      setError(`映像の再生に失敗しました。\n(${e.name}: ${e.message})`)
    }
  }

  const handleRescan = () => {
    setScannedValue(null)
    startCamera()
  }

  const handleClose = () => {
    stopScanLoop()
    stopCameraStream()
    onClose()
  }

  useEffect(() => {
    startCamera()
    return () => {
      stopScanLoop()
      stopCameraStream()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ----- UI -----

  const headerText = scannedValue
    ? 'QRコード読み取り完了'
    : 'QRコードをかざしてください'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75">
      <div className="relative w-[90vw] max-w-lg bg-white rounded-2xl overflow-hidden shadow-2xl">

        {/* ヘッダー */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <span className="font-bold text-gray-700 text-lg">{headerText}</span>
          <button
            type="button"
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 cursor-pointer [touch-action:manipulation]"
          >
            <X size={28} />
          </button>
        </div>

        {/* カメラ映像エリア */}
        <div className="relative bg-black aspect-video">
          {/* playsInline は iOS Safari でページ内再生に必須 */}
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            muted
            autoPlay
          />
          {/* jsQR が読み取るための非表示 canvas */}
          <canvas ref={canvasRef} className="hidden" />

          {/* 起動中 */}
          {!isRunning && !error && !scannedValue && (
            <div className="absolute inset-0 flex items-center justify-center text-white text-sm">
              カメラ起動中…
            </div>
          )}

          {/* スキャン中のガイド枠 */}
          {isRunning && !scannedValue && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-48 h-48 border-4 border-white/70 rounded-xl" />
            </div>
          )}

          {/* QR検出成功オーバーレイ */}
          {scannedValue && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/60">
              <div className="text-green-400 text-6xl font-bold">✓</div>
              <p className="text-white font-bold text-base">読み取り成功</p>
            </div>
          )}

          {/* エラー */}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 bg-gray-900">
              <CameraOff size={44} className="text-gray-400" />
              <p className="text-white text-sm text-center whitespace-pre-line leading-relaxed">
                {error}
              </p>
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="flex gap-3 px-5 py-4">
          {scannedValue ? (
            <button
              type="button"
              onClick={handleRescan}
              className="flex-1 py-4 rounded-xl font-bold text-white text-lg
                bg-[#5aade8] hover:bg-[#4a9fd8]
                cursor-pointer [touch-action:manipulation] transition-colors"
            >
              もう一度読み取る
            </button>
          ) : isRunning ? (
            <button
              type="button"
              onClick={() => { stopScanLoop(); stopCameraStream() }}
              className="flex-1 py-4 rounded-xl font-bold text-white text-lg
                bg-red-500 hover:bg-red-600
                cursor-pointer [touch-action:manipulation] transition-colors"
            >
              停止
            </button>
          ) : (
            <button
              type="button"
              onClick={startCamera}
              className="flex-1 py-4 rounded-xl font-bold text-white text-lg
                bg-[#5aade8] hover:bg-[#4a9fd8]
                cursor-pointer [touch-action:manipulation] transition-colors"
            >
              再試行
            </button>
          )}
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 py-4 rounded-xl font-bold text-gray-600 text-lg
              bg-gray-100 hover:bg-gray-200
              cursor-pointer [touch-action:manipulation] transition-colors"
          >
            閉じる
          </button>
        </div>

      </div>
    </div>
  )
}
