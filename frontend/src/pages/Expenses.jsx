import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Paperclip } from 'lucide-react'
import { api } from '../api'
import Modal from '../components/Modal'
import ReceiptModal from '../components/ReceiptModal'

const CATEGORIES = [
  'Shipping Supplies', 'eBay Fees', 'PayPal Fees', 'Mileage', 'Storage',
  'Packaging', 'Tools & Equipment', 'Advertising', 'Software', 'Other',
]
const MILEAGE_RATES = { 2023: 0.655, 2024: 0.67, 2025: 0.70, 2026: 0.725 }
const LATEST_MILEAGE_YEAR = Math.max(...Object.keys(MILEAGE_RATES).map(Number))

function getMileageRate(dateStr) {
  const year = dateStr ? new Date(dateStr + 'T12:00:00').getFullYear() : new Date().getFullYear()
  return { rate: MILEAGE_RATES[year] ?? MILEAGE_RATES[LATEST_MILEAGE_YEAR], year, confirmed: year in MILEAGE_RATES }
}
const today = () => new Date().toISOString().slice(0, 10)
const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n ?? 0)
const fmtDate = (d) => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

function ExpenseForm({ initial, onSubmit, onClose }) {
  const isMileage = (cat) => cat === 'Mileage'

  // Back-calculate miles when editing an existing mileage expense
  const initialMiles = (() => {
    if (!initial || !isMileage(initial.category) || !initial.amount) return ''
    const { rate } = getMileageRate(initial.date)
    const m = initial.amount / rate
    return String(Math.round(m * 10) / 10)
  })()

  const [form, setForm] = useState(initial ?? { category: CATEGORIES[0], amount: '', date: today(), description: '' })
  const [miles, setMiles] = useState(initialMiles)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const { rate, year, confirmed } = getMileageRate(form.date)
  const mileageAmount = miles !== '' && !isNaN(parseFloat(miles)) ? parseFloat(miles) * rate : null

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      const amount = isMileage(form.category) ? parseFloat(miles) * rate : parseFloat(form.amount)
      await onSubmit({ ...form, amount })
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="label block mb-1">Category</label>
        <select className="input" value={form.category} onChange={(e) => set('category', e.target.value)}>
          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {isMileage(form.category) ? (
          <div>
            <label className="label block mb-1">Miles</label>
            <input
              className="input"
              type="number"
              step="0.1"
              min="0"
              required
              value={miles}
              onChange={(e) => setMiles(e.target.value)}
              placeholder="0"
            />
          </div>
        ) : (
          <div>
            <label className="label block mb-1">Amount</label>
            <input className="input" type="number" step="0.01" min="0" required value={form.amount} onChange={(e) => set('amount', e.target.value)} placeholder="0.00" />
          </div>
        )}
        <div>
          <label className="label block mb-1">Date</label>
          <input className="input" type="date" required value={form.date} onChange={(e) => set('date', e.target.value)} />
        </div>
      </div>

      {isMileage(form.category) && (
        <div className={`rounded border px-4 py-3 text-sm ${confirmed ? 'border-sea/40 bg-sea/10' : 'border-yellow-800/30 bg-ochre/10'}`}>
          {mileageAmount !== null ? (
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-inkmut font-mono text-xs">
                {parseFloat(miles).toLocaleString()} mi × ${rate.toFixed(3)}/mi
              </span>
              <span className="text-ink font-mono font-semibold">{fmt(mileageAmount)}</span>
            </div>
          ) : (
            <span className="text-inkmut text-xs">Enter miles to calculate amount</span>
          )}
          <div className={`text-xs mt-1 ${confirmed ? 'text-sea/70' : 'text-ochre/70'}`}>
            {confirmed
              ? `${year} IRS standard mileage rate`
              : `${year} rate not confirmed — using ${LATEST_MILEAGE_YEAR} rate. Verify at IRS.gov`}
          </div>
        </div>
      )}

      <div>
        <label className="label block mb-1">Description</label>
        <input
          className="input"
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
          placeholder={isMileage(form.category) ? 'e.g. Parts run to Goodwill, eBay pickup' : 'e.g. Bubble wrap roll, 200ft'}
        />
      </div>
      {error && <p className="text-clay text-sm">{error}</p>}
      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">{saving ? 'Saving…' : 'Save Expense'}</button>
        <button type="button" onClick={onClose} className="btn-ghost flex-1 text-center">Cancel</button>
      </div>
    </form>
  )
}

export default function Expenses() {
  const [expenses, setExpenses] = useState([])
  const [modal, setModal] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [receiptTarget, setReceiptTarget] = useState(null)

  const load = () => api.getExpenses().then(setExpenses).catch(console.error)
  useEffect(() => { load() }, [])

  const handleAdd = async (data) => { await api.createExpense(data); setModal(null); load() }
  const handleEdit = async (data) => { await api.updateExpense(modal.id, data); setModal(null); load() }
  const handleDelete = async (id) => { await api.deleteExpense(id); setConfirmDelete(null); load() }

  const total = expenses.reduce((s, e) => s + e.amount, 0)

  // Group by category for summary
  const byCategory = expenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] ?? 0) + e.amount
    return acc
  }, {})

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Expenses</h1>
        <p className="text-sm text-inkmut mt-0.5">Overhead costs and business expenses</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="card px-4 py-3">
          <div className="text-xs text-inkmut mb-1">Total Expenses</div>
          <div className="text-xl font-bold text-clay font-mono">{fmt(total)}</div>
        </div>
        <div className="card px-4 py-3">
          <div className="text-xs text-inkmut mb-1">Expense Records</div>
          <div className="text-2xl font-semibold text-ink font-mono">{expenses.length}</div>
        </div>
      </div>

      {/* Category breakdown */}
      {Object.keys(byCategory).length > 0 && (
        <div className="card p-4">
          <h3 className="text-xs text-inkmut uppercase tracking-wider mb-3">By Category</h3>
          <div className="space-y-2">
            {Object.entries(byCategory).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => (
              <div key={cat} className="flex items-center justify-between">
                <span className="text-sm text-ink">{cat}</span>
                <div className="flex items-center gap-3">
                  <div className="w-24 bg-sand rounded-full h-1.5 hidden sm:block">
                    <div className="bg-clay h-1.5 rounded-full" style={{ width: `${(amt / total) * 100}%` }} />
                  </div>
                  <span className="text-sm font-mono text-clay font-medium w-20 text-right">{fmt(amt)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <button className="btn-primary" onClick={() => setModal('add')}>
          <Plus className="w-4 h-4" /> Add Expense
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-edge">
                <th className="label px-4 py-3 text-left">Category</th>
                <th className="label px-4 py-3 text-left hidden md:table-cell">Description</th>
                <th className="label px-4 py-3 text-right">Amount</th>
                <th className="label px-4 py-3 text-left hidden sm:table-cell">Date</th>
                <th className="label px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {expenses.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-inkfaint">No expenses recorded yet</td></tr>
              )}
              {expenses.map((e) => (
                <tr key={e.id} className="border-b border-edge hover:bg-sand transition-colors">
                  <td className="px-4 py-3">
                    <span className="text-xs bg-sand border border-edge text-ink px-2 py-0.5 rounded-md">{e.category}</span>
                  </td>
                  <td className="px-4 py-3 text-inkmut hidden md:table-cell">{e.description || '—'}</td>
                  <td className="px-4 py-3 text-right font-mono font-medium text-clay">{fmt(e.amount)}</td>
                  <td className="px-4 py-3 text-inkmut hidden sm:table-cell">{fmtDate(e.date)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setReceiptTarget({ id: e.id, name: e.description || e.category })}
                        className="p-1.5 rounded text-inkmut hover:text-ochre hover:bg-ochre/10 transition-colors"
                        title="Receipts"
                      >
                        <Paperclip className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setModal(e)} className="p-1.5 rounded text-inkmut hover:text-ink hover:bg-sand transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setConfirmDelete(e)} className="p-1.5 rounded text-inkmut hover:text-clay hover:bg-clay/10 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {receiptTarget && (
        <ReceiptModal
          entityType="expense"
          entityId={receiptTarget.id}
          entityName={receiptTarget.name}
          onClose={() => setReceiptTarget(null)}
        />
      )}

      {modal === 'add' && (
        <Modal title="Add Expense" onClose={() => setModal(null)}>
          <ExpenseForm onSubmit={handleAdd} onClose={() => setModal(null)} />
        </Modal>
      )}
      {modal && modal !== 'add' && (
        <Modal title="Edit Expense" onClose={() => setModal(null)}>
          <ExpenseForm
            initial={{ category: modal.category, amount: modal.amount, date: modal.date, description: modal.description ?? '' }}
            onSubmit={handleEdit}
            onClose={() => setModal(null)}
          />
        </Modal>
      )}
      {confirmDelete && (
        <Modal title="Delete Expense" onClose={() => setConfirmDelete(null)}>
          <p className="text-inkmut text-sm mb-4">Delete <span className="text-ink">{confirmDelete.category}</span> expense of <span className="text-clay">{fmt(confirmDelete.amount)}</span>?</p>
          <div className="flex gap-2">
            <button onClick={() => handleDelete(confirmDelete.id)} className="flex-1 bg-clay hover:bg-clay text-ink font-medium py-2 rounded transition-colors">Delete</button>
            <button onClick={() => setConfirmDelete(null)} className="btn-ghost flex-1 text-center">Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
