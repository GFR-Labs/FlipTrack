import { useEffect, useState } from 'react'
import { Search, FileText, Image, ExternalLink, AlertTriangle, Check, Trash2 } from 'lucide-react'
import Modal from '../components/Modal'
import { api } from '../api'
import { RECEIPT_KINDS } from '../components/ReceiptModal'

const fmtDate = (d) =>
  new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

function fmtBytes(b) {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
  return `${(b / (1024 * 1024)).toFixed(1)} MB`
}

const ENTITY_LABELS = { item: 'Item', sale: 'Sale', expense: 'Expense', lot: 'Lot' }

function KindSelect({ receipt, onSaved }) {
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  const change = async (kind) => {
    setSaving(true); setError(''); setSaved(false)
    try {
      await api.updateReceipt(receipt.id, { kind })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <select
        className="input py-1 text-xs w-36"
        value={receipt.kind}
        disabled={saving}
        onChange={(e) => change(e.target.value)}
      >
        {RECEIPT_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
      </select>
      {saving && <span className="text-xs text-inkfaint">…</span>}
      {saved && <Check className="w-3.5 h-3.5 text-moss" />}
      {error && <span className="text-xs text-clay" title={error}>!</span>}
    </div>
  )
}

export default function Attachments() {
  const [receipts, setReceipts] = useState([])
  const [search, setSearch] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [deleteError, setDeleteError] = useState('')

  const handleDelete = async (id) => {
    setDeleteError('')
    try {
      await api.deleteReceipt(id)
      setConfirmDelete(null)
      load()
      window.dispatchEvent(new Event('storage-changed'))
    } catch (err) {
      setDeleteError(err.message)
    }
  }

  const load = () => api.getAllReceipts().then(setReceipts).catch(console.error)
  useEffect(() => { load() }, [])

  const q = search.toLowerCase()
  const filtered = receipts.filter((r) =>
    `${r.original_name} ${r.entity_label} ${r.kind} ${r.filename}`.toLowerCase().includes(q)
  )
  const missing = receipts.filter((r) => r.file_missing).length

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Attachments</h1>
        <p className="text-sm text-inkmut mt-0.5">
          Every receipt in one place — change what a file is and it's renamed to match
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="card px-4 py-3">
          <div className="text-xs text-inkmut mb-1">Files</div>
          <div className="text-2xl font-semibold text-ink font-mono">{receipts.length}</div>
        </div>
        <div className="card px-4 py-3">
          <div className="text-xs text-inkmut mb-1">Missing From Disk</div>
          <div className={`text-2xl font-semibold font-mono ${missing ? 'text-clay' : 'text-moss'}`}>{missing}</div>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-inkfaint" />
        <input
          className="input pl-9"
          placeholder="Search by file name, item, lot, expense…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-edge">
                <th className="label px-4 py-3 text-left">File</th>
                <th className="label px-4 py-3 text-left">Type</th>
                <th className="label px-4 py-3 text-left">Attached To</th>
                <th className="label px-4 py-3 text-right hidden sm:table-cell">Size</th>
                <th className="label px-4 py-3 text-left hidden md:table-cell">Uploaded</th>
                <th className="label px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-inkfaint">
                    {search ? 'No attachments match your search' : 'No receipts uploaded yet'}
                  </td>
                </tr>
              )}
              {filtered.map((r) => (
                <tr key={r.id} className="border-b border-edge hover:bg-sand transition-colors">
                  <td className="px-4 py-3">
                    <a
                      href={`/api/receipts/${r.id}/file`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`flex items-center gap-2 group ${r.file_missing ? 'pointer-events-none' : ''}`}
                    >
                      {r.mime_type.startsWith('image/')
                        ? <Image className="w-4 h-4 text-inkmut flex-shrink-0" />
                        : <FileText className="w-4 h-4 text-inkmut flex-shrink-0" />}
                      <span className="text-ink group-hover:underline truncate max-w-[220px]" title={r.filename}>
                        {r.original_name}
                      </span>
                      {r.file_missing ? (
                        <span className="flex items-center gap-1 text-xs text-clay flex-shrink-0">
                          <AlertTriangle className="w-3 h-3" /> missing
                        </span>
                      ) : (
                        <ExternalLink className="w-3 h-3 text-inkfaint opacity-0 group-hover:opacity-100 flex-shrink-0" />
                      )}
                    </a>
                  </td>
                  <td className="px-4 py-3">
                    <KindSelect receipt={r} onSaved={load} />
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-ink">{r.entity_label}</span>
                    <span className="ml-2 text-[10px] uppercase tracking-wide bg-sand border border-edge text-inkmut px-1.5 py-0.5 rounded-sm">
                      {ENTITY_LABELS[r.entity_type] ?? r.entity_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-inkmut font-mono hidden sm:table-cell">{fmtBytes(r.size_bytes)}</td>
                  <td className="px-4 py-3 text-inkmut hidden md:table-cell">{fmtDate(r.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => { setDeleteError(''); setConfirmDelete(r) }}
                      className="p-1.5 rounded text-inkmut hover:text-clay hover:bg-clay/10 transition-colors"
                      title="Delete attachment"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {confirmDelete && (
        <Modal title="Delete Attachment" onClose={() => setConfirmDelete(null)}>
          <p className="text-sm text-inkmut mb-2">
            Delete <span className="text-ink font-medium">{confirmDelete.original_name}</span>
            {' '}(attached to <span className="text-ink">{confirmDelete.entity_label}</span>)?
          </p>
          <p className="text-xs text-inkfaint mb-3">
            This removes the record{confirmDelete.file_missing ? '' : ' and the file on disk'} permanently.
          </p>
          {deleteError && <p className="text-clay text-sm mb-3">{deleteError}</p>}
          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setConfirmDelete(null)}>Cancel</button>
            <button
              className="bg-clay hover:bg-clay/80 text-white font-medium px-4 py-2 rounded transition-colors"
              onClick={() => handleDelete(confirmDelete.id)}
            >
              Delete
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
