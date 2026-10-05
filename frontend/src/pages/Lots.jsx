import { useEffect, useState } from 'react'
import { Plus, Paperclip, Pencil, Trash2, ChevronDown, ChevronRight, Scale, SplitSquareHorizontal } from 'lucide-react'
import { api } from '../api'
import Modal from '../components/Modal'
import ReceiptModal from '../components/ReceiptModal'
import StatusBadge from '../components/StatusBadge'

const fmt = (n) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n ?? 0)
const fmtDate = (d) =>
  new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
const today = () => new Date().toISOString().slice(0, 10)
const r2 = (n) => Math.round(n * 100) / 100

function LotForm({ initial, onSubmit, onClose }) {
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    total_cost: initial?.total_cost ?? '',
    date_acquired: initial?.date_acquired ?? today(),
    notes: initial?.notes ?? '',
  })
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const submit = (e) => {
    e.preventDefault()
    onSubmit({
      name: form.name,
      total_cost: parseFloat(form.total_cost),
      date_acquired: form.date_acquired,
      notes: form.notes || null,
    })
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="label block mb-1">Name</label>
        <input className="input" required value={form.name} onChange={set('name')}
          placeholder="e.g. MacBook teardown, Estate sale box" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label block mb-1">Total Cost</label>
          <input className="input" required type="number" step="0.01" min="0"
            value={form.total_cost} onChange={set('total_cost')} placeholder="100.00" />
        </div>
        <div>
          <label className="label block mb-1">Date Acquired</label>
          <input className="input" required type="date" value={form.date_acquired} onChange={set('date_acquired')} />
        </div>
      </div>
      <div>
        <label className="label block mb-1">Notes (optional)</label>
        <input className="input" value={form.notes} onChange={set('notes')}
          placeholder="Where it came from, what's inside…" />
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn-primary">Save Lot</button>
      </div>
    </form>
  )
}

function AllocationEditor({ lot, onSaved }) {
  // Draft costs as strings so partially-typed numbers don't fight the user
  const [costs, setCosts] = useState(() =>
    Object.fromEntries(lot.items.map((i) => [i.id, String(i.purchase_price)])))
  const [personal, setPersonal] = useState(String(lot.personal_use_cost ?? 0))
  const [personalNote, setPersonalNote] = useState(lot.personal_use_note ?? '')
  const [newItem, setNewItem] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const num = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n }
  const allocated = lot.items.reduce((s, i) => s + num(costs[i.id]), 0)
  const remaining = r2(lot.total_cost - allocated - num(personal))

  const setCost = (id, v) => setCosts({ ...costs, [id]: v })
  const setPct = (id, v) => {
    const pct = parseFloat(v)
    setCosts({ ...costs, [id]: isNaN(pct) ? '' : String(r2((pct / 100) * lot.total_cost)) })
  }
  const pctOf = (id) =>
    lot.total_cost > 0 && costs[id] !== '' ? r2((num(costs[id]) / lot.total_cost) * 100) : ''

  const splitEvenly = () => {
    const n = lot.items.length
    if (!n) return
    const pool = r2(lot.total_cost - num(personal))
    const per = Math.floor((pool / n) * 100) / 100
    const next = {}
    lot.items.forEach((i, idx) => {
      // last item absorbs the rounding remainder so the split foots exactly
      next[i.id] = String(idx === n - 1 ? r2(pool - per * (n - 1)) : per)
    })
    setCosts(next)
  }

  const save = async () => {
    setBusy(true); setError('')
    try {
      await api.allocateLot(lot.id, {
        items: Object.fromEntries(lot.items.map((i) => [i.id, num(costs[i.id])])),
        personal_use_cost: num(personal),
        personal_use_note: personalNote || null,
      })
      onSaved()
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  const addItem = async (e) => {
    e.preventDefault()
    if (!newItem.trim()) return
    setBusy(true); setError('')
    try {
      await api.createItem({
        name: newItem.trim(), purchase_price: 0,
        date_acquired: lot.date_acquired, lot_id: lot.id,
      })
      setNewItem('')
      onSaved()
    } catch (err) { setError(err.message) } finally { setBusy(false) }
  }

  return (
    <div className="border-t border-edge px-4 py-4 space-y-3">
      {lot.items.length > 0 && (
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="label text-left pb-2">Item</th>
              <th className="label text-left pb-2 hidden sm:table-cell">Status</th>
              <th className="label text-right pb-2 w-28">Cost $</th>
              <th className="label text-right pb-2 w-20">%</th>
            </tr>
          </thead>
          <tbody>
            {lot.items.map((i) => (
              <tr key={i.id}>
                <td className="py-1 pr-2 text-ink">{i.name}</td>
                <td className="py-1 pr-2 hidden sm:table-cell"><StatusBadge status={i.status} /></td>
                <td className="py-1">
                  <input className="input text-right py-1" type="number" step="0.01" min="0"
                    value={costs[i.id]} onChange={(e) => setCost(i.id, e.target.value)} />
                </td>
                <td className="py-1 pl-2">
                  <input className="input text-right py-1" type="number" step="0.1" min="0"
                    value={pctOf(i.id)} onChange={(e) => setPct(i.id, e.target.value)} />
                </td>
              </tr>
            ))}
            <tr>
              <td className="py-1 pr-2 text-inkmut italic">Personal use (kept, not deducted)</td>
              <td className="py-1 pr-2 hidden sm:table-cell">
                <input className="input py-1 text-xs" placeholder="e.g. MacBook kept after repair"
                  value={personalNote} onChange={(e) => setPersonalNote(e.target.value)} />
              </td>
              <td className="py-1">
                <input className="input text-right py-1" type="number" step="0.01" min="0"
                  value={personal} onChange={(e) => setPersonal(e.target.value)} />
              </td>
              <td className="py-1 pl-2 text-right text-inkmut text-xs">
                {lot.total_cost > 0 ? `${r2((num(personal) / lot.total_cost) * 100)}%` : ''}
              </td>
            </tr>
          </tbody>
        </table>
      )}

      <div className={`flex items-center justify-between rounded border px-3 py-2 text-sm
        ${remaining < 0 ? 'border-clay/40 bg-clay/10 text-clay' : remaining === 0 ? 'border-moss/40 bg-moss/10 text-moss' : 'border-edge bg-sand text-ink'}`}>
        <span className="flex items-center gap-2">
          <Scale className="w-4 h-4" />
          {remaining < 0 ? `Over-allocated by ${fmt(-remaining)}` : `Remaining to allocate: ${fmt(remaining)}`}
        </span>
        <span className="text-xs opacity-80">{fmt(allocated)} items + {fmt(num(personal))} personal of {fmt(lot.total_cost)}</span>
      </div>

      {error && <p className="text-clay text-sm">{error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <form onSubmit={addItem} className="flex items-center gap-2 flex-1 min-w-48">
          <input className="input py-1.5" placeholder="Add item pulled from this lot…"
            value={newItem} onChange={(e) => setNewItem(e.target.value)} />
          <button type="submit" className="btn-ghost border border-edge whitespace-nowrap" disabled={busy}>
            <Plus className="w-4 h-4 inline" /> Add
          </button>
        </form>
        {lot.items.length > 1 && (
          <button className="btn-ghost border border-edge" onClick={splitEvenly} disabled={busy}>
            <SplitSquareHorizontal className="w-4 h-4 inline mr-1" /> Split evenly
          </button>
        )}
        {lot.items.length > 0 && (
          <button className="btn-primary" onClick={save} disabled={busy}>
            {busy ? 'Saving…' : 'Save Allocation'}
          </button>
        )}
      </div>
    </div>
  )
}

export default function Lots() {
  const [lots, setLots] = useState([])
  const [modal, setModal] = useState(null)        // 'add' | lot object
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [deleteError, setDeleteError] = useState('')
  const [receiptTarget, setReceiptTarget] = useState(null)
  const [expanded, setExpanded] = useState(null)

  const load = () => api.getLots().then(setLots).catch(console.error)
  useEffect(() => { load() }, [])

  const handleAdd = async (data) => { await api.createLot(data); setModal(null); load() }
  const handleEdit = async (data) => { await api.updateLot(modal.id, data); setModal(null); load() }
  const handleDelete = async (id) => {
    setDeleteError('')
    try { await api.deleteLot(id); setConfirmDelete(null); load() }
    catch (err) { setDeleteError(err.message) }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Lots / Part-Outs</h1>
        <p className="text-sm text-inkmut mt-0.5">
          Sourcing buys split across items — allocate the cost, keep one receipt
        </p>
      </div>

      <div className="flex justify-end">
        <button className="btn-primary" onClick={() => setModal('add')}>
          <Plus className="w-4 h-4" /> Add Lot
        </button>
      </div>

      {lots.length === 0 && (
        <div className="card px-4 py-10 text-center text-inkfaint text-sm">
          No lots yet. A lot is one sourcing purchase — a box at an estate sale, a broken
          MacBook to part out — whose cost you split across the items that come out of it.
        </div>
      )}

      {lots.map((lot) => (
        <div key={lot.id} className="card overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-sand transition-colors"
            onClick={() => setExpanded(expanded === lot.id ? null : lot.id)}>
            {expanded === lot.id
              ? <ChevronDown className="w-4 h-4 text-inkmut flex-shrink-0" />
              : <ChevronRight className="w-4 h-4 text-inkmut flex-shrink-0" />}
            <div className="flex-1 min-w-0">
              <div className="text-ink font-medium truncate">{lot.name}</div>
              <div className="text-xs text-inkmut">
                {fmtDate(lot.date_acquired)} · {lot.item_count} item{lot.item_count === 1 ? '' : 's'}
                {lot.personal_use_cost > 0 && ` · ${fmt(lot.personal_use_cost)} personal use`}
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono font-medium text-ink">{fmt(lot.total_cost)}</div>
              <div className={`text-xs font-mono ${lot.remaining < 0 ? 'text-clay font-semibold' : lot.remaining === 0 ? 'text-moss' : 'text-ochre'}`}>
                {lot.remaining < 0 ? `over by ${fmt(-lot.remaining)}` : lot.remaining === 0 ? 'fully allocated' : `${fmt(lot.remaining)} unallocated`}
              </div>
            </div>
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setReceiptTarget(lot)}
                className="p-1.5 rounded text-inkmut hover:text-ochre hover:bg-ochre/10 transition-colors" title="Receipts">
                <Paperclip className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setModal(lot)}
                className="p-1.5 rounded text-inkmut hover:text-ink hover:bg-sand transition-colors" title="Edit">
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => { setDeleteError(''); setConfirmDelete(lot) }}
                className="p-1.5 rounded text-inkmut hover:text-clay hover:bg-clay/10 transition-colors" title="Delete">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          {expanded === lot.id && <AllocationEditor lot={lot} onSaved={load} />}
        </div>
      ))}

      {receiptTarget && (
        <ReceiptModal entityType="lot" entityId={receiptTarget.id} entityName={receiptTarget.name}
          onClose={() => setReceiptTarget(null)} />
      )}

      {modal === 'add' && (
        <Modal title="Add Lot" onClose={() => setModal(null)}>
          <LotForm onSubmit={handleAdd} onClose={() => setModal(null)} />
        </Modal>
      )}
      {modal && modal !== 'add' && (
        <Modal title="Edit Lot" onClose={() => setModal(null)}>
          <LotForm initial={modal} onSubmit={handleEdit} onClose={() => setModal(null)} />
        </Modal>
      )}
      {confirmDelete && (
        <Modal title="Delete Lot" onClose={() => setConfirmDelete(null)}>
          <p className="text-sm text-inkmut mb-3">
            Delete <span className="text-ink font-medium">{confirmDelete.name}</span>? This cannot be undone.
          </p>
          {deleteError && <p className="text-clay text-sm mb-3">{deleteError}</p>}
          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setConfirmDelete(null)}>Cancel</button>
            <button className="bg-clay hover:bg-clay/80 text-white font-medium px-4 py-2 rounded transition-colors"
              onClick={() => handleDelete(confirmDelete.id)}>Delete</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
