'use client'

import { useState } from 'react'
import { Camera, CheckCircle2, Lock } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import CameraModal from '@/components/CameraModal'

/** timestamptz として返される ISO 8601 文字列を日本時間で整形する */
function formatJST(timestamptz: string): string {
  // タイムゾーン情報がない場合は UTC として扱う（Supabase が '+00:00' や 'Z' を省略するケース対策）
  const normalized =
    timestamptz.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(timestamptz)
      ? timestamptz
      : timestamptz + 'Z'
  return new Date(normalized).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })
}

type StatusType = 'success' | 'error' | 'warn'
type Status = { type: StatusType; message: string } | null

type Student = { name: string; class_name: string }

export default function Home() {
  const [status, setStatus] = useState<Status>(null)
  const [loading, setLoading] = useState<'checkin' | 'checkout' | null>(null)
  const [scannedId, setScannedId] = useState<string | null>(null)
  const [rawQr, setRawQr] = useState<string | null>(null)       // trim 前の生の値
  const [qrError, setQrError] = useState<string | null>(null)  // Supabase エラー詳細
  const [student, setStudent] = useState<Student | null>(null)
  const [studentNotFound, setStudentNotFound] = useState(false)
  const [showCamera, setShowCamera] = useState(false)

  // QR読み取り後に呼ばれる。student_id を受け取り students テーブルを照会する
  const handleScan = async (value: string) => {
    // trim → 先頭末尾の " を除去（QRコードがダブルクォーテーションで囲まれているケース対策）
    const trimmed = value.trim().replace(/^"+|"+$/g, '')

    // 先頭・末尾5文字の文字コード（不可視文字の検出用）
    const charCodes = (s: string) =>
      [...s].map((c) => `U+${c.charCodeAt(0).toString(16).padStart(4, '0')}`).join(' ')

    console.log('[debug] QR raw value      :', JSON.stringify(value))
    console.log('[debug] QR raw length     :', value.length)
    console.log('[debug] QR normalized     :', JSON.stringify(trimmed))
    console.log('[debug] QR normalized len :', trimmed.length)
    console.log('[debug] char codes (head) :', charCodes(trimmed.slice(0, 5)))
    console.log('[debug] char codes (tail) :', charCodes(trimmed.slice(-5)))
    console.log('[debug] students query id :', trimmed)

    setRawQr(value)
    setScannedId(trimmed)
    setQrError(null)
    setStatus(null)
    setStudent(null)
    setStudentNotFound(false)

    const { data, error } = await supabase
      .from('students')
      .select('name, class_name')
      .eq('id', trimmed)
      .single()

    if (error || !data) {
      const errMsg = error ? `code=${error.code} / ${error.message}` : 'data=null'
      console.warn('[debug] student not found. error:', errMsg)
      setQrError(errMsg)
      setStudentNotFound(true)
    } else {
      console.log('[debug] student found:', data)
      setStudent(data)
    }
  }

  const handleCameraOpen = () => {
    console.log('[debug] カメラを起動 tapped')
    setShowCamera(true)
  }

  const handleReset = () => {
    setScannedId(null)
    setRawQr(null)
    setQrError(null)
    setStudent(null)
    setStudentNotFound(false)
    setStatus(null)
  }

  const handleCheckin = async () => {
    console.log('[debug] きたよ！ tapped, scannedId:', scannedId)
    if (loading !== null) return

    if (!scannedId) {
      setStatus({ type: 'warn', message: '先にQRコードを読み取ってください' })
      return
    }

    setLoading('checkin')
    setStatus(null)

    const { data, error } = await supabase
      .from('attendance_logs')
      .insert({ student_id: scannedId, type: 'checkin' })
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
    console.log('[debug] かえる！ tapped, scannedId:', scannedId)
    if (loading !== null) return

    if (!scannedId) {
      setStatus({ type: 'warn', message: '先にQRコードを読み取ってください' })
      return
    }

    setLoading('checkout')
    setStatus(null)

    const { data, error } = await supabase
      .from('attendance_logs')
      .insert({ student_id: scannedId, type: 'checkout' })
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
      <div className="w-[90vw] max-w-2xl bg-gray-50 rounded-3xl shadow-xl p-8 sm:p-12 flex flex-col gap-6">

        {/* タイトル */}
        <h1 className="text-3xl sm:text-4xl font-extrabold text-gray-700 text-center tracking-wide">
          登室・退室記録アプリ
        </h1>

        {/* 生徒情報 / QR未読取表示 */}
        {scannedId ? (
          <div className={`rounded-xl px-5 py-4 border ${
            studentNotFound
              ? 'bg-red-50 border-red-200'
              : student
              ? 'bg-green-50 border-green-200'
              : 'bg-blue-50 border-blue-200'
          }`}>
            {studentNotFound ? (
              <div className="flex items-center justify-between">
                <p className="text-red-600 font-bold text-base">未登録のQRコードです</p>
                <button
                  type="button"
                  onClick={handleReset}
                  className="ml-3 text-red-400 hover:text-red-600 text-sm font-bold shrink-0 cursor-pointer [touch-action:manipulation]"
                >
                  リセット
                </button>
              </div>
            ) : student ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-700 font-extrabold text-xl">{student.name}</p>
                  <p className="text-green-600 text-sm mt-0.5">{student.class_name}</p>
                </div>
                <button
                  type="button"
                  onClick={handleReset}
                  className="ml-3 text-green-400 hover:text-green-600 text-sm font-bold shrink-0 cursor-pointer [touch-action:manipulation]"
                >
                  リセット
                </button>
              </div>
            ) : (
              <p className="text-blue-600 text-sm">生徒情報を取得中…</p>
            )}
          </div>
        ) : null}

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

        {/* QRデバッグ表示 */}
        {rawQr !== null && (
          <div className="rounded-lg bg-gray-100 border border-gray-300 px-4 py-3 text-xs text-gray-600 font-mono space-y-1 break-all">
            <p><span className="font-bold text-gray-800">raw QR value:</span> {JSON.stringify(rawQr)}</p>
            <p><span className="font-bold text-gray-800">raw length:</span> {rawQr.length}</p>
            <p><span className="font-bold text-gray-800">normalized student_id:</span> {JSON.stringify(scannedId)}</p>
            <p><span className="font-bold text-gray-800">normalized length:</span> {scannedId?.length ?? 0}</p>
            {qrError && (
              <p className="text-red-600"><span className="font-bold">supabase error:</span> {qrError}</p>
            )}
          </div>
        )}

        {/* バージョン */}
        <p className="text-xs text-black text-right">ver_0.0.2</p>

        {/* ステータスメッセージ */}
        {status && (
          <div className={`text-center text-lg font-bold py-4 rounded-2xl ${
            status.type === 'success' ? 'bg-green-100 text-green-700' :
            status.type === 'warn'    ? 'bg-yellow-100 text-yellow-700' :
                                        'bg-red-100 text-red-600'
          }`}>
            {status.message}
          </div>
        )}
      </div>

      {/* カメラモーダル */}
      {showCamera && (
        <CameraModal
          onScan={handleScan}
          onClose={() => setShowCamera(false)}
        />
      )}
    </div>
  )
}
