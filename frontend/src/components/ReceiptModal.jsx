import { useEffect, useRef, useState } from 'react'
import { X, Upload, Trash2, FileText, ExternalLink, Paperclip } from 'lucide-react'

const BASE = '/api'

function fmtBytes(b) {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / (1024 * 1024)).toFixed(1)} MB`
}

function ReceiptThumb({ receipt, onDelete }) {
  const [confirmDel, setConfirmDel] = useState(false)
  const isImage = receipt.mime_type.startsWith('image/')
  const fileUrl = `${BASE}/receipts/${receipt.id}/file`

  return (
    <div className="relative group bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl overflow-hidden">
      {isImage ? (
        <a href={fileUrl} target="_blank" rel="noopener noreferrer">
          <img
            src={fileUrl}
            alt={receipt.original_name}
            className="w-full h-28 object-cover hover:opacity-90 transition-opacity"
          />
        </a>
      ) : (
        <a
          href={fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-col items-center justify-center h-28 gap-2 hover:bg-[#222] transition-colors"
        >
          <FileText className="w-8 h-8 text-gray-500" />
          <span className="text-xs text-gray-500 px-2 text-center truncate w-full">{receipt.original_name}</span>
        </a>
      )}

      {/* Footer */}
      <div className="px-2 py-1.5 flex items-center justify-between gap-1">
        <span className="text-xs text-gray-600 truncate">{fmtBytes(receipt.size_bytes)}</span>
        <div className="flex items-center gap-1 flex-shrink-0">
          <a
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1 rounded text-gray-600 hover:text-gray-300 transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
          </a>
          {!confirmDel ? (
            <button
              onClick={() => setConfirmDel(true)}
              className="p-1 rounded text-gray-600 hover:text-red-400 transition-colors"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          ) : (
            <div className="flex items-center gap-1">
              <button
                onClick={() => onDelete(receipt.id)}
                className="text-xs text-red-400 hover:text-red-300 px-1"
              >
                Del
              </button>
              <button
                onClick={() => setConfirmDel(false)}
                className="text-xs text-gray-500 hover:text-gray-300 px-1"
              >
                No
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function ReceiptModal({ entityType, entityId, entityName, onClose }) {
  const [receipts, setReceipts] = useState([])
  const [uploading, setUploading] = useState(false)
  const [drag, setDrag] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef(null)

  const load = () =>
    fetch(`${BASE}/receipts/?entity_type=${entityType}&entity_id=${entityId}`)
      .then((r) => r.json())
      .then(setReceipts)
      .catch(console.error)

  useEffect(() => {
    load()
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  const uploadFiles = async (files) => {
    if (!files?.length) return
    setUploading(true)
    setError('')
    for (const file of files) {
      const body = new FormData()
      body.append('file', file)
      const res = await fetch(
        `${BASE}/receipts/?entity_type=${entityType}&entity_id=${entityId}`,
        { method: 'POST', body }
      )
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d.detail || 'Upload failed')
      }
    }
    setUploading(false)
    load()
    window.dispatchEvent(new Event('storage-changed'))
    if (inputRef.current) inputRef.current.value = ''
  }

  const handleDelete = async (id) => {
    await fetch(`${BASE}/receipts/${id}`, { method: 'DELETE' })
    load()
    window.dispatchEvent(new Event('storage-changed'))
  }

  const onDrop = (e) => {
    e.preventDefault()
    setDrag(false)
    uploadFiles(Array.from(e.dataTransfer.files))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-[#141414] border border-[#2a2a2a] rounded-2xl shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a2a] flex-shrink-0">
          <div className="flex items-center gap-2">
            <Paperclip className="w-4 h-4 text-gray-400" />
            <div>
              <h2 className="text-white font-semibold text-sm leading-tight">Receipts</h2>
              <p className="text-xs text-gray-500 truncate max-w-[260px]">{entityName}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white p-1 rounded-lg hover:bg-[#1a1a1a] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Receipt grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {receipts.length === 0 && !uploading && (
            <p className="text-center text-gray-600 text-sm py-6">No receipts attached yet</p>
          )}
          {receipts.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
              {receipts.map((r) => (
                <ReceiptThumb key={r.id} receipt={r} onDelete={handleDelete} />
              ))}
            </div>
          )}

          {/* Upload zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
            onDragLeave={() => setDrag(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-5 flex flex-col items-center gap-2 cursor-pointer transition-colors ${
              drag
                ? 'border-green-500 bg-green-950/20'
                : 'border-[#2a2a2a] hover:border-green-700 hover:bg-[#1a1a1a]'
            }`}
          >
            <Upload className={`w-5 h-5 ${drag ? 'text-green-400' : 'text-gray-600'}`} />
            <p className="text-sm text-gray-500 text-center">
              {uploading ? 'Uploading…' : 'Drop files here or click to upload'}
            </p>
            <p className="text-xs text-gray-700">JPG, PNG, WEBP, PDF · max 15 MB each</p>
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              multiple
              accept="image/jpeg,image/png,image/webp,image/gif,image/heic,application/pdf"
              onChange={(e) => uploadFiles(Array.from(e.target.files))}
            />
          </div>

          {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
        </div>
      </div>
    </div>
  )
}
