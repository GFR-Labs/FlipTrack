import { useState } from 'react'
import { Download, FileText } from 'lucide-react'
import { api } from '../api'

const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n ?? 0)

function firstOfYear() {
  return new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10)
}
function today() {
  return new Date().toISOString().slice(0, 10)
}

export default function Business() {
  const [start, setStart] = useState(firstOfYear())
  const [end, setEnd] = useState(today())
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const loadSummary = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await api.businessSummary(start, end)
      setSummary(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleExport = () => {
    window.location.href = api.exportZip(start, end)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Business / CPA Export</h1>
        <p className="text-sm text-inkmut mt-0.5">Generate income & expense summaries for your accountant</p>
      </div>

      {/* Date range picker */}
      <div className="card p-5 space-y-4">
        <h2 className="text-sm font-semibold text-ink">Select Date Range</h2>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label block mb-1">Start Date</label>
            <input className="input" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div>
            <label className="label block mb-1">End Date</label>
            <input className="input" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
        </div>

        {/* Quick presets */}
        <div className="flex flex-wrap gap-2">
          {[
            { label: 'This Year', s: firstOfYear(), e: today() },
            { label: 'Last Quarter', s: (() => { const d = new Date(); const q = Math.floor(d.getMonth() / 3); return new Date(d.getFullYear(), (q - 1) * 3, 1).toISOString().slice(0, 10) })(), e: (() => { const d = new Date(); const q = Math.floor(d.getMonth() / 3); return new Date(d.getFullYear(), q * 3, 0).toISOString().slice(0, 10) })() },
            { label: 'Last 30 Days', s: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10), e: today() },
            { label: 'Last 90 Days', s: new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10), e: today() },
          ].map(({ label, s, e }) => (
            <button
              key={label}
              onClick={() => { setStart(s); setEnd(e); setSummary(null) }}
              className="text-xs px-3 py-1.5 rounded bg-sand border border-edge text-inkmut hover:text-ink hover:border-moss/40 transition-colors"
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <button onClick={loadSummary} disabled={loading} className="btn-primary">
            <FileText className="w-4 h-4" />
            {loading ? 'Loading…' : 'Generate Summary'}
          </button>
          <button onClick={handleExport} className="flex items-center gap-2 bg-sand hover:bg-sand border border-edge hover:border-moss/40 text-ink hover:text-ink font-medium px-4 py-2 rounded transition-colors">
            <Download className="w-4 h-4" />
            Download Report (.xlsx + receipts)
          </button>
        </div>

        {error && <p className="text-clay text-sm">{error}</p>}
      </div>

      {/* Summary */}
      {summary && (
        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-ink mb-4">
              Summary: {summary.period.start} → {summary.period.end}
            </h2>

            <div className="grid grid-cols-2 gap-3 mb-4">
              {[
                { label: 'Total Sales', value: summary.sales_count, mono: false, color: 'text-ink' },
                { label: 'Gross Revenue', value: fmt(summary.gross_revenue), mono: true, color: 'text-sea' },
                { label: 'Platform Fees', value: fmt(summary.total_fees), mono: true, color: 'text-inkmut' },
                { label: 'Net Sales Profit', value: fmt(summary.net_sales_profit), mono: true, color: summary.net_sales_profit >= 0 ? 'text-moss' : 'text-clay' },
                { label: 'Total Expenses', value: fmt(summary.total_expenses), mono: true, color: 'text-clay' },
                { label: 'Net Income', value: fmt(summary.net_income), mono: true, color: summary.net_income >= 0 ? 'text-moss' : 'text-clay' },
              ].map(({ label, value, mono, color }) => (
                <div key={label} className="bg-sand rounded p-3 border border-edge">
                  <div className="text-xs text-inkmut mb-1">{label}</div>
                  <div className={`text-lg font-bold ${mono ? 'font-mono' : ''} ${color}`}>{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Expenses by category */}
          {Object.keys(summary.expenses_by_category).length > 0 && (
            <div className="card p-5">
              <h3 className="text-sm font-semibold text-ink mb-3">Expenses by Category</h3>
              <div className="space-y-2">
                {Object.entries(summary.expenses_by_category).map(([cat, amt]) => (
                  <div key={cat} className="flex justify-between items-center py-2 border-b border-edge last:border-0">
                    <span className="text-sm text-ink">{cat}</span>
                    <span className="text-sm font-mono font-medium text-clay">{fmt(amt)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <button onClick={handleExport} className="flex items-center gap-2 btn-primary">
              <Download className="w-4 h-4" />
              Download Report (.xlsx + receipts)
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
