import { useEffect, useState } from 'react'
import { Plus, Search, Pencil, Trash2, Paperclip } from 'lucide-react'
import { api } from '../api'
import Modal from '../components/Modal'
import StatusBadge from '../components/StatusBadge'
import ReceiptModal from '../components/ReceiptModal'

const STATUSES = ['In Stock', 'Listed', 'Sold']
const today = () => new Date().toISOString().slice(0, 10)

function ItemForm({ initial, onSubmit, onClose }) {
  const [form, setForm] = useState(
    initial ?? { name: '', purchase_price: '', quantity: 1, status: 'In Stock', date_acquired: today(), notes: '' }
  )
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const handle = (e) => {
    e.preventDefault()
    onSubmit({ ...form, purchase_price: parseFloat(form.purchase_price), quantity: parseInt(form.quantity) })
  }

  return (
    <form onSubmit={handle} className="space-y-3">
      <div>
        <label className="label block mb-1">Item Name</label>
        <input className="input" required value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Dell 512gb NVMe" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label block mb-1">Purchase Price</label>
          <input className="input" type="number" step="0.01" min="0" required value={form.purchase_price} onChange={(e) => set('purchase_price', e.target.value)} placeholder="0.00" />
        </div>
        <div>
          <label className="label block mb-1">Quantity</label>
          <input className="input" type="number" min="1" required value={form.quantity} onChange={(e) => set('quantity', e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label block mb-1">Status</label>
          <select className="input" value={form.status} onChange={(e) => set('status', e.target.value)}>
            {STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="label block mb-1">Date Acquired</label>
          <input className="input" type="date" required value={form.date_acquired} onChange={(e) => set('date_acquired', e.target.value)} />
        </div>
      </div>
      <div>
        <label className="label block mb-1">Notes</label>
        <textarea className="input resize-none" rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Optional notes..." />
      </div>
      <div className="flex gap-2 pt-1">
        <button type="submit" className="btn-primary flex-1 justify-center">Save Item</button>
        <button type="button" onClick={onClose} className="btn-ghost flex-1 text-center">Cancel</button>
      </div>
    </form>
  )
}

const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n ?? 0)
const fmtDate = (d) => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

export default function Inventory() {
  const [items, setItems] = useState([])
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null) // null | 'add' | {item}
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [receiptTarget, setReceiptTarget] = useState(null) // {id, name}

  const load = () => api.getItems().then(setItems).catch(console.error)
  useEffect(() => {
    load()
    // Refresh when the browser tab becomes visible (handles switching back from Sold page)
    const onVisible = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onVisible)
    // Poll every 30s so sold items disappear even without navigating away
    const interval = setInterval(load, 30000)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      clearInterval(interval)
    }
  }, [])

  // Sold items live only in the Sold tab — inventory shows active items only
  const activeItems = items.filter((i) => i.status !== 'Sold')
  const filtered = activeItems.filter((i) =>
    i.name.toLowerCase().includes(search.toLowerCase())
  )

  const totalInvested = activeItems.reduce((s, i) => s + i.purchase_price * i.quantity, 0)
  const inStock = activeItems.filter((i) => i.status === 'In Stock').length
  const listed = activeItems.filter((i) => i.status === 'Listed').length

  const handleAdd = async (data) => {
    await api.createItem(data)
    setModal(null)
    load()
  }

  const handleEdit = async (data) => {
    await api.updateItem(modal.id, data)
    setModal(null)
    load()
  }

  const handleDelete = async (id) => {
    await api.deleteItem(id)
    setConfirmDelete(null)
    load()
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-white">Inventory</h1>
        <p className="text-sm text-gray-500 mt-0.5">Track all items you've acquired</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Active Items', value: activeItems.length },
          { label: 'In Stock', value: inStock },
          { label: 'Listed', value: listed },
          { label: 'Total Invested', value: fmt(totalInvested) },
        ].map(({ label, value }) => (
          <div key={label} className="card px-4 py-3">
            <div className="text-xs text-gray-500 mb-1">{label}</div>
            <div className="text-xl font-bold text-white font-mono">{value}</div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
          <input
            className="input pl-9"
            placeholder="Search inventory..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button className="btn-primary" onClick={() => setModal('add')}>
          <Plus className="w-4 h-4" /> Add Item
        </button>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1f1f1f]">
                <th className="label px-4 py-3 text-left">Name</th>
                <th className="label px-4 py-3 text-left">Status</th>
                <th className="label px-4 py-3 text-right">Qty</th>
                <th className="label px-4 py-3 text-right hidden sm:table-cell">Cost</th>
                <th className="label px-4 py-3 text-left hidden md:table-cell">Date Acquired</th>
                <th className="label px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-gray-600">
                    {search ? 'No items match your search' : 'No active inventory — add your first item'}
                  </td>
                </tr>
              )}
              {filtered.map((item) => (
                <tr key={item.id} className="border-b border-[#1a1a1a] hover:bg-[#161616] transition-colors">
                  <td className="px-4 py-3 text-white font-medium">{item.name}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={item.status} />
                  </td>
                  <td className="px-4 py-3 text-right text-gray-300">{item.quantity}</td>
                  <td className="px-4 py-3 text-right text-gray-300 hidden sm:table-cell font-mono">{fmt(item.purchase_price)}</td>
                  <td className="px-4 py-3 text-gray-400 hidden md:table-cell">{fmtDate(item.date_acquired)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setReceiptTarget({ id: item.id, name: item.name })}
                        className="p-1.5 rounded-lg text-gray-500 hover:text-yellow-400 hover:bg-yellow-950/30 transition-colors"
                        title="Receipts"
                      >
                        <Paperclip className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setModal(item)}
                        className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-[#222] transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setConfirmDelete(item)}
                        className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-950/30 transition-colors"
                      >
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

      {/* Add modal */}
      {modal === 'add' && (
        <Modal title="Add Item" onClose={() => setModal(null)}>
          <ItemForm onSubmit={handleAdd} onClose={() => setModal(null)} />
        </Modal>
      )}

      {/* Edit modal */}
      {modal && modal !== 'add' && (
        <Modal title="Edit Item" onClose={() => setModal(null)}>
          <ItemForm
            initial={{
              name: modal.name,
              purchase_price: modal.purchase_price,
              quantity: modal.quantity,
              status: modal.status,
              date_acquired: modal.date_acquired,
              notes: modal.notes ?? '',
            }}
            onSubmit={handleEdit}
            onClose={() => setModal(null)}
          />
        </Modal>
      )}

      {receiptTarget && (
        <ReceiptModal
          entityType="item"
          entityId={receiptTarget.id}
          entityName={receiptTarget.name}
          onClose={() => setReceiptTarget(null)}
        />
      )}

      {/* Delete confirm */}
      {confirmDelete && (
        <Modal title="Delete Item" onClose={() => setConfirmDelete(null)}>
          <p className="text-gray-400 text-sm mb-4">
            Are you sure you want to delete <span className="text-white font-medium">{confirmDelete.name}</span>? This cannot be undone.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => handleDelete(confirmDelete.id)}
              className="flex-1 bg-red-600 hover:bg-red-500 text-white font-medium py-2 rounded-xl transition-colors"
            >
              Delete
            </button>
            <button onClick={() => setConfirmDelete(null)} className="btn-ghost flex-1 text-center">
              Cancel
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
