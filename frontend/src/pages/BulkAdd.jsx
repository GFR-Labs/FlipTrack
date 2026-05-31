import { useState } from 'react'
import { Plus, Trash2, CheckCircle, ChevronDown, ChevronUp } from 'lucide-react'

const PLATFORMS = ['eBay', 'Facebook Marketplace', 'Craigslist', 'OfferUp', 'Amazon', 'Other']
const today = () => new Date().toISOString().slice(0, 10)

const emptyRow = () => ({
  _id: Math.random(),
  name: '',
  purchase_price: '',
  quantity: '1',
  date_acquired: today(),
  notes: '',
  asking_price: '',
  platform: 'eBay',
  listed_date: '',
  sale_price: '',
  platform_fees: '',
  shipping_cost: '',
  sold_date: '',
  _expanded: false,
})

function rowStatus(r) {
  if (r.sale_price !== '') return 'Sold'
  if (r.asking_price !== '') return 'Listed'
  return 'In Stock'
}

const STATUS_STYLE = {
  'In Stock': 'bg-[#1a1a1a] text-gray-400 border-[#333]',
  'Listed':   'bg-blue-950/60 text-blue-300 border-blue-800/40',
  'Sold':     'bg-green-950/60 text-green-400 border-green-800/40',
}

const fmt = (n) =>
  n === '' || isNaN(parseFloat(n))
    ? '—'
    : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(parseFloat(n))

function NetPreview({ row }) {
  if (row.sale_price === '') return null
  const net =
    parseFloat(row.sale_price || 0) -
    parseFloat(row.platform_fees || 0) -
    parseFloat(row.shipping_cost || 0) -
    parseFloat(row.purchase_price || 0)
  const color = isNaN(net) ? 'text-gray-500' : net >= 0 ? 'text-green-400' : 'text-red-400'
  return (
    <span className={`text-xs font-mono ${color}`}>
      Net: {isNaN(net) ? '—' : fmt(net)}
    </span>
  )
}

function Row({ row, onChange, onRemove }) {
  const set = (k, v) => onChange({ ...row, [k]: v })
  const status = rowStatus(row)
  const showListing = row.asking_price !== '' || row._expanded
  const showSale    = row.sale_price !== ''    || row._expanded

  return (
    <div className="card p-4 space-y-3">
      {/* Header row */}
      <div className="flex items-center gap-2">
        <span className={`text-xs px-2 py-0.5 rounded border font-medium ${STATUS_STYLE[status]}`}>
          {status}
        </span>
        <NetPreview row={row} />
        <div className="flex-1" />
        <button
          type="button"
          onClick={() => set('_expanded', !row._expanded)}
          className="text-gray-600 hover:text-gray-300 p-1 rounded transition-colors"
          title="Toggle optional fields"
        >
          {row._expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="text-gray-600 hover:text-red-400 p-1 rounded transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Base fields */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="sm:col-span-2">
          <label className="label block mb-1">Item Name *</label>
          <input
            className="input"
            required
            placeholder="e.g. Samsung 128gb NVMe"
            value={row.name}
            onChange={(e) => set('name', e.target.value)}
          />
        </div>
        <div>
          <label className="label block mb-1">Buy Price *</label>
          <input
            className="input"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            value={row.purchase_price}
            onChange={(e) => set('purchase_price', e.target.value)}
          />
        </div>
        <div>
          <label className="label block mb-1">Qty</label>
          <input
            className="input"
            type="number"
            min="1"
            value={row.quantity}
            onChange={(e) => set('quantity', e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="label block mb-1">Date Acquired *</label>
          <input
            className="input"
            type="date"
            value={row.date_acquired}
            onChange={(e) => set('date_acquired', e.target.value)}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="label block mb-1">Notes</label>
          <input
            className="input"
            placeholder="Optional"
            value={row.notes}
            onChange={(e) => set('notes', e.target.value)}
          />
        </div>
      </div>

      {/* Listing fields — shown when asking price filled or expanded */}
      {(showListing || row._expanded) && (
        <div className="border-t border-[#1f1f1f] pt-3 space-y-2">
          <p className="text-xs text-blue-400 font-medium uppercase tracking-wider">
            Listing info <span className="text-gray-600 normal-case font-normal">— fills Asking Price → status becomes Listed</span>
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <div>
              <label className="label block mb-1">Asking Price</label>
              <input
                className="input"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={row.asking_price}
                onChange={(e) => set('asking_price', e.target.value)}
              />
            </div>
            <div>
              <label className="label block mb-1">Platform</label>
              <select className="input" value={row.platform} onChange={(e) => set('platform', e.target.value)}>
                {PLATFORMS.map((p) => <option key={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="label block mb-1">Listed Date</label>
              <input
                className="input"
                type="date"
                value={row.listed_date}
                onChange={(e) => set('listed_date', e.target.value)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Sale fields — shown when sale price filled or expanded */}
      {(showSale || row._expanded) && (
        <div className="border-t border-[#1f1f1f] pt-3 space-y-2">
          <p className="text-xs text-green-400 font-medium uppercase tracking-wider">
            Sale info <span className="text-gray-600 normal-case font-normal">— fills Sale Price → status becomes Sold</span>
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div>
              <label className="label block mb-1">Sale Price</label>
              <input
                className="input"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={row.sale_price}
                onChange={(e) => set('sale_price', e.target.value)}
              />
            </div>
            <div>
              <label className="label block mb-1">Platform Fees</label>
              <input
                className="input"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={row.platform_fees}
                onChange={(e) => set('platform_fees', e.target.value)}
              />
            </div>
            <div>
              <label className="label block mb-1">Shipping</label>
              <input
                className="input"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={row.shipping_cost}
                onChange={(e) => set('shipping_cost', e.target.value)}
              />
            </div>
            <div>
              <label className="label block mb-1">Sold Date</label>
              <input
                className="input"
                type="date"
                value={row.sold_date}
                onChange={(e) => set('sold_date', e.target.value)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function BulkAdd() {
  const [rows, setRows] = useState([emptyRow()])
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const updateRow = (id, updated) =>
    setRows((rs) => rs.map((r) => (r._id === id ? updated : r)))

  const removeRow = (id) =>
    setRows((rs) => (rs.length > 1 ? rs.filter((r) => r._id !== id) : rs))

  const addRow = () => setRows((rs) => [...rs, emptyRow()])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setResult(null)

    const payload = rows
      .filter((r) => r.name.trim() && r.purchase_price !== '')
      .map((r) => ({
        name: r.name.trim(),
        purchase_price: parseFloat(r.purchase_price),
        quantity: parseInt(r.quantity) || 1,
        date_acquired: r.date_acquired,
        notes: r.notes.trim() || null,
        asking_price: r.asking_price !== '' ? parseFloat(r.asking_price) : null,
        platform: r.asking_price !== '' ? r.platform : null,
        listed_date: r.listed_date || null,
        sale_price: r.sale_price !== '' ? parseFloat(r.sale_price) : null,
        platform_fees: parseFloat(r.platform_fees) || 0,
        shipping_cost: parseFloat(r.shipping_cost) || 0,
        sold_date: r.sold_date || null,
      }))

    if (payload.length === 0) {
      setError('Fill in at least one row with a name and buy price.')
      setLoading(false)
      return
    }

    try {
      const res = await fetch('/api/bulk-add/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Failed')
      setResult(data)
      setRows([emptyRow()])
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const statusCounts = rows.reduce((acc, r) => {
    const s = rowStatus(r)
    acc[s] = (acc[s] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-white">Bulk Add</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Add multiple items at once — status is set automatically based on what you fill in
        </p>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-gray-500" /> No extras → <strong className="text-gray-300">In Stock</strong>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-blue-500" /> Asking price filled → <strong className="text-blue-300">Listed</strong>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-green-500" /> Sale price filled → <strong className="text-green-400">Sold</strong>
        </span>
      </div>

      {result && (
        <div className="card p-4 border-green-800/30 bg-green-950/10 flex items-start gap-3">
          <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-white font-medium">{result.added} item{result.added !== 1 ? 's' : ''} added</p>
            <div className="flex flex-wrap gap-2 mt-1">
              {result.items.map((item, i) => (
                <span key={i} className={`text-xs px-2 py-0.5 rounded border ${STATUS_STYLE[item.status]}`}>
                  {item.name}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        {rows.map((row) => (
          <Row
            key={row._id}
            row={row}
            onChange={(updated) => updateRow(row._id, updated)}
            onRemove={() => removeRow(row._id)}
          />
        ))}

        <button
          type="button"
          onClick={addRow}
          className="w-full py-2.5 border border-dashed border-[#2a2a2a] hover:border-green-700 text-gray-500 hover:text-green-400 rounded-xl text-sm flex items-center justify-center gap-2 transition-colors"
        >
          <Plus className="w-4 h-4" /> Add another item
        </button>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <div className="flex items-center gap-3 pt-1">
          <button type="submit" disabled={loading} className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed">
            {loading ? 'Saving…' : `Save ${rows.filter(r => r.name && r.purchase_price).length || ''} Item${rows.length !== 1 ? 's' : ''}`}
          </button>
          <div className="text-xs text-gray-600 flex gap-3">
            {Object.entries(statusCounts).map(([s, n]) => (
              <span key={s}>{n} {s}</span>
            ))}
          </div>
        </div>
      </form>
    </div>
  )
}
