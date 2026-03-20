'use client'

/**
 * CameraModal — getUserMedia を使ったカメラ表示モーダル
 *
 * ⚠️ Secure Context の制約について
 * getUserMedia() は Secure Context（HTTPS または localhost）でのみ動作します。
 * http://192.168.x.x:3000 のような HTTP のローカルIPでアクセスした場合、
 * iPad/Safari を含むほぼすべてのブラウザでカメラが起動しません。
 *
 * 開発中の回避策:
 *   1. next dev --experimental-https  （Next.js 14.1+ の組み込みHTTPS）
 *   2. ngrok / Cloudflare Tunnel でHTTPS URLを取得する
 *   3. mkcert でローカル自己署名証明書を作成する
 */

import { useEffect, useRef, useState } from 'react'
import { X, CameraOff } from 'lucide-react'

interface Props {
  onClose: () => void
}

export default function CameraModal({ onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const startCamera = async () => {
    console.log('[camera] startCamera called, isSecureContext:', window.isSecureContext)
    setError(null)

    // HTTP ローカルIP では Secure Context でないためカメラが使えない
    if (!window.isSecureContext) {
      setError(
        'カメラを使用するにはHTTPS接続が必要です。\n' +
        '現在 HTTP でアクセスしているためカメラが起動できません。\n' +
        '開発時は next dev --experimental-https をお試しください。'
      )
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' }, // リアカメラ優先
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        // iOS Safari では play() を明示的に呼ぶ必要がある
        await videoRef.current.play()
      }
      setIsRunning(true)
      console.log('[camera] camera started successfully')
    } catch (err) {
      const e = err as DOMException
      console.error('[camera] getUserMedia error:', e.name, e.message)
      if (e.name === 'NotAllowedError') {
        setError('カメラの使用が拒否されました。\nブラウザの設定でカメラのアクセスを許可してください。')
      } else if (e.name === 'NotFoundError') {
        setError('カメラが見つかりません。')
      } else if (e.name === 'NotSupportedError') {
        setError('このブラウザ・環境ではカメラがサポートされていません。')
      } else {
        setError(`カメラの起動に失敗しました。\n(${e.name}: ${e.message})`)
      }
    }
  }

  const stopCamera = () => {
    console.log('[camera] stopCamera called')
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setIsRunning(false)
  }

  const handleClose = () => {
    stopCamera()
    onClose()
  }

  // モーダルを開いたら自動でカメラ起動
  useEffect(() => {
    startCamera()
    return () => stopCamera()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75">
      <div className="relative w-[90vw] max-w-lg bg-white rounded-2xl overflow-hidden shadow-2xl">

        {/* ヘッダー */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <span className="font-bold text-gray-700 text-lg">カメラ</span>
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

          {!isRunning && !error && (
            <div className="absolute inset-0 flex items-center justify-center text-white text-sm">
              カメラ起動中…
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 bg-gray-900">
              <CameraOff size={44} className="text-gray-400" />
              <p className="text-white text-sm text-center whitespace-pre-line leading-relaxed">
                {error}
              </p>
            </div>
          )}
        </div>

        {/* フッター：Start/Stop 切り替え */}
        <div className="flex gap-3 px-5 py-4">
          {isRunning ? (
            <button
              type="button"
              onClick={stopCamera}
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
