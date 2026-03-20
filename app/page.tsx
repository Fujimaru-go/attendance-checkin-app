'use client'

import { useState } from 'react'
import { Camera, CheckCircle2, Lock } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import CameraModal from '@/components/CameraModal'

const FALLBACK_STUDENT_ID = '123a6d33-c1d4-4a29-919a-f016467d00a5'

/** timestamptz として返される ISO 8601 文字列を日本時間で整形する */
function formatJST(timestamptz: string): string {
  // タイムゾーン情報がない場合は UTC として扱う（Supabase が '+00:00' や 'Z' を省略するケース対策）
  const normalized =
    timestamptz.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(timestamptz)
      ? timestamptz
      : timestamptz + 'Z'
  return new Date(normalized).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
}

type Status = { type: 'success' | 'error'; message: string } | null

export default function Home() {
  const [status, setStatus] = useState<Status>(null)
  const [loading, setLoading] = useState<'checkin' | 'checkout' | null>(null)
  const [scannedId, setScannedId] = useState<string | null>(null)
  const [showCamera, setShowCamera] = useState(false)

  const studentId = scannedId ?? FALLBACK_STUDENT_ID

  const handleCameraOpen = () => {
    console.log('[debug] カメラを起動 tapped')
    setShowCamera(true)
  }

  const handleCheckin = async () => {
    console.log('[debug] きたよ！ tapped, studentId:', studentId)
    if (loading !== null) return
    setLoading('checkin')
    setStatus(null)

    const { data, error } = await supabase
      .from('attendance_logs')
      .insert({ student_id: studentId, type: 'checkin' })
      .select('created_at')
      .single()

    if (error) {
      console.error('[debug] checkin error:', error)
      setStatus({ type: 'error', message: error.message })
    } else {
      const jst = formatJST(data.created_at)
      console.log('[debug] checkin success, created_at:', data.created_at)
      setStatus({ type: 'success', message: `記録しました（${jst}）` })
    }
    setLoading(null)
  }

  const handleCheckout = async () => {
    console.log('[debug] かえる！ tapped, studentId:', studentId)
    if (loading !== null) return
    setLoading('checkout')
    setStatus(null)

    const { data, error } = await supabase
      .from('attendance_logs')
      .insert({ student_id: studentId, type: 'checkout' })
      .select('created_at')
      .single()

    if (error) {
      console.error('[debug] checkout error:', error)
      setStatus({ type: 'error', message: error.message })
    } else {
      const jst = formatJST(data.created_at)
      console.log('[debug] checkout success, created_at:', data.created_at)
      setStatus({ type: 'success', message: `記録しました（${jst}）` })
    }
    setLoading(null)
  }

  return (
    <div className="min-h-screen bg-gray-200 flex items-center justify-center p-4">
      <div
        className="
          w-[90vw] max-w-2xl bg-gray-50 rounded-3xl shadow-xl
          p-8 sm:p-12
          flex flex-col gap-6
        "
      >
        {/* タイトル */}
        <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-700 text-center tracking-wide">
          登室・退室記録アプリ
        </h1>

        {/* スキャン済みID表示 */}
        {scannedId && (
          <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-xl px-5 py-3">
            <span className="text-base text-blue-700 font-medium truncate">
              QR読取済: {scannedId}
            </span>
            <button
              type="button"
              onClick={() => { setScannedId(null); setStatus(null) }}
              className="ml-3 text-blue-400 hover:text-blue-600 text-sm font-bold shrink-0 cursor-pointer [touch-action:manipulation]"
            >
              リセット
            </button>
          </div>
        )}

        {/* カメラボタン */}
        <button
          type="button"
          onClick={handleCameraOpen}
          className="
            w-full flex items-center justify-center gap-3
            py-6 rounded-2xl
            font-bold text-xl text-white
            bg-[#5aade8] hover:bg-[#4a9fd8]
            shadow-[0_5px_0_#3a86c0]
            active:shadow-none active:translate-y-px
            cursor-pointer [touch-action:manipulation]
            transition-transform
          "
        >
          <Camera size={28} strokeWidth={2.5} />
          カメラを起動
        </button>

        {/* きたよ / かえる */}
        <div className="grid grid-cols-2 gap-5">
          <button
            type="button"
            onClick={handleCheckin}
            disabled={loading !== null}
            className="
              flex flex-col items-center justify-center gap-3
              h-44 sm:h-52 rounded-2xl font-extrabold text-3xl text-white
              bg-[#5bc85b] hover:bg-[#4db84d]
              shadow-[0_6px_0_#3a963a]
              active:shadow-none active:translate-y-px
              disabled:opacity-60
              cursor-pointer [touch-action:manipulation]
              transition-transform
            "
          >
            <CheckCircle2 size={52} strokeWidth={2.5} />
            {loading === 'checkin' ? '記録中…' : 'きたよ！'}
          </button>

          <button
            type="button"
            onClick={handleCheckout}
            disabled={loading !== null}
            className="
              flex flex-col items-center justify-center gap-3
              h-44 sm:h-52 rounded-2xl font-extrabold text-3xl text-white
              bg-[#f5a623] hover:bg-[#e89615]
              shadow-[0_6px_0_#c47a10]
              active:shadow-none active:translate-y-px
              disabled:opacity-60
              cursor-pointer [touch-action:manipulation]
              transition-transform
            "
          >
            <Lock size={52} strokeWidth={2.5} />
            {loading === 'checkout' ? '記録中…' : 'かえる！'}
          </button>
        </div>

        {/* ステータスメッセージ */}
        {status && (
          <div
            className={`text-center text-lg font-bold py-4 rounded-2xl ${
              status.type === 'success'
                ? 'bg-green-100 text-green-700'
                : 'bg-red-100 text-red-600'
            }`}
          >
            {status.message}
          </div>
        )}
      </div>

      {/* カメラモーダル */}
      {showCamera && (
        <CameraModal onClose={() => setShowCamera(false)} />
      )}
    </div>
  )
}
