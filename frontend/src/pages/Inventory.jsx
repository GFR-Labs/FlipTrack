import { useEffect, useRef, useState } from 'react'
import { Plus, Search, Pencil, Trash2, Paperclip, Tag, DollarSign } from 'lucide-react'
import { api } from '../api'
import Modal from '../components/Modal'
import StatusBadge from '../components/StatusBadge'
import ReceiptModal from '../components/ReceiptModal'

const STATUSES = ['In Stock', 'Listed', 'Sold']
const PLATFORMS = ['eBay', 'Facebook Marketplace', 'Craigslist', 'OfferUp', 'Amazon', 'Other']
const today = () => new Date().toISOString().slice(0, 10)
const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n ?? 0)
const fmtDate = (d) => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

function QuickListForm({ item, onSubmit, onClose }) {
  const [form, setForm] = useState({ platform: 'eBay', asking_price: '', listed_date: today(), url: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const submitting = useRef(false)

  const handle = async (e) => {
    e.preventDefault()
    if (submitting.current) return
    submitting.current = true
    setSaving(true)
    setError('')
    try {
      await onSubmit({ item_id: item.id, platform: form.platform, asking_price: parseFloat(form.asking_price), listed_date: form.listed_date, url: form.url })
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      submitting.current = false
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handle} className="space-y-3">
      <p className="text-sm text-gray-400">Listing <span className="text-white font-medium">{item.name}</span></p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label block mb-1">Asking Price</label>
          <input className="input" type="number" step="0.01" min="0" required value={form.asking_price} onChange={e => set('asking_price', e.target.value)} placeholder="0.00" />
        </div>
        <div>
          <label className="label block mb-1">Platform</label>
          <select className="input" value={form.platform} onChange={e => set('platform', e.target.value)}>
            {PLATFORMS.map(p => <option key={p}>{p}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="label block mb-1">Listed Date</label>
        <input className="input" type="date" value={form.listed_date} onChange={e => set('listed_date', e.target.value)} />
      </div>
      <div>
        <label className="label block mb-1">URL (optional)</label>
        <input className="input" type="url" value={form.url} onChange={e => set('url', e.target.value)} placeholder="https://..." />
      </div>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">{saving ? 'Listing…' : 'Create Listing'}</button>
        <button type="button" onClick={onClose} className="btn-ghost flex-1 text-center">Cancel</button>
      </div>
    </form>
  )
}

function QuickSellForm({ item, onSubmit, onClose }) {
  const [form, setForm] = useState({ sale_price: '', platform_fees: '0', shipping_cost: '0', sold_date: today() })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const submitting = useRef(false)

  const net = form.sale_price !== ''
    ? (parseFloat(form.sale_price) || 0) - (parseFloat(form.platform_fees) || 0) - (parseFloat(form.shipping_cost) || 0) - item.purchase_price
    : null

  const handle = async (e) => {
    e.preventDefault()
    if (submitting.current) return
    submitting.current = true
    setSaving(true)
    setError('')
    try {
      await onSubmit({ item_id: item.id, sale_price: parseFloat(form.sale_price), platform_fees: parseFloat(form.platform_fees) || 0, shipping_cost: parseFloat(form.shipping_cost) || 0, sold_date: form.sold_date })
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      submitting.current = false
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handle} className="space-y-3">
      <p className="text-sm text-gray-400">Recording sale for <span className="text-white font-medium">{item.name}</span> <span className="text-gray-600 font-mono">(cost: {fmt(item.purchase_price)})</span></p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label block mb-1">Sale Price</label>
          <input className="input" type="number" step="0.01" min="0" required value={form.sale_price} onChange={e => set('sale_price', e.target.value)} placeholder="0.00" />
        </div>
        <div>
          <label className="label block mb-1">Platform Fees</label>
          <input className="input" type="number" step="0.01" min="0" value={form.platform_fees} onChange={e => set('platform_fees', e.target.value)} placeholder="0.00" />
        </div>
        <div>
          <label className="label block mb-1">Shipping Cost</label>
          <input className="input" type="number" step="0.01" min="0" value={form.shipping_cost} onChange={e => set('shipping_cost', e.target.value)} placeholder="0.00" />
        </div>
        <div>
          <label className="label block mb-1">Sold Date</label>
          <input className="input" type="date" value={form.sold_date} onChange={e => set('sold_date', e.target.value)} />
        </div>
      </div>
      {net !== null && (
        <div className={`rounded-xl border px-4 py-3 text-sm font-mono font-medium ${net >= 0 ? 'bg-green-950/30 border-green-800/30 text-green-400' : 'bg-red-950/30 border-red-800/30 text-red-400'}`}>
          Net Profit: {fmt(net)}
        </div>
      )}
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">{saving ? 'Recording…' : 'Record Sale'}</button>
        <button type="button" onClick={onClose} className="btn-ghost flex-1 text-center">Cancel</button>
      </div>
    </form>
  )
}

function ItemForm({ initial, onSubmit, onClose }) {
  const isEdit = !!initial
  const [form, setForm] = useState({
    name: '', purchase_price: '', quantity: 1, status: 'In Stock',
    date_acquired: today(), notes: '',
    // listing extras
    asking_price: '', platform: 'eBay', listed_date: today(),
    // sale extras
    sale_price: '', platform_fees: '0', shipping_cost: '0', sold_date: today(),
    ...initial,
  })
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const submitting = useRef(false)

  const net = form.status === 'Sold' && form.sale_price !== ''
    ? (parseFloat(form.sale_price) || 0) - (parseFloat(form.platform_fees) || 0) - (parseFloat(form.shipping_cost) || 0) - (parseFloat(form.purchase_price) || 0)
    : null

  const handle = async (e) => {
    e.preventDefault()
    if (submitting.current) return
    submitting.current = true
    setError('')
    setSaving(true)
    try {
      await onSubmit({ ...form, purchase_price: parseFloat(form.purchase_price), quantity: parseInt(form.quantity) })
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
      submitting.current = false
      setSaving(false)
    }
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

      {/* Listing fields */}
      {form.status === 'Listed' && (
        <div className="border-t border-[#1f1f1f] pt-3 space-y-2">
          <p className="text-xs text-blue-400 font-medium uppercase tracking-wider">Listing Details</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label block mb-1">Asking Price</label>
              <input className="input" type="number" step="0.01" min="0" required={!isEdit} value={form.asking_price} onChange={(e) => set('asking_price', e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <label className="label block mb-1">Platform</label>
              <select className="input" value={form.platform} onChange={(e) => set('platform', e.target.value)}>
                {PLATFORMS.map((p) => <option key={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="label block mb-1">Listed Date</label>
            <input className="input" type="date" value={form.listed_date} onChange={(e) => set('listed_date', e.target.value)} />
          </div>
        </div>
      )}

      {/* Sale fields */}
      {form.status === 'Sold' && (
        <div className="border-t border-[#1f1f1f] pt-3 space-y-2">
          <p className="text-xs text-green-400 font-medium uppercase tracking-wider">Sale Details</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label block mb-1">Sale Price</label>
              <input className="input" type="number" step="0.01" min="0" required={!isEdit} value={form.sale_price} onChange={(e) => set('sale_price', e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <label className="label block mb-1">Platform Fees</label>
              <input className="input" type="number" step="0.01" min="0" value={form.platform_fees} onChange={(e) => set('platform_fees', e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <label className="label block mb-1">Shipping Cost</label>
              <input className="input" type="number" step="0.01" min="0" value={form.shipping_cost} onChange={(e) => set('shipping_cost', e.target.value)} placeholder="0.00" />
            </div>
            <div>
              <label className="label block mb-1">Sold Date</label>
              <input className="input" type="date" value={form.sold_date} onChange={(e) => set('sold_date', e.target.value)} />
            </div>
          </div>
          {net !== null && (
            <div className={`rounded-xl border px-4 py-3 text-sm font-mono font-medium ${net >= 0 ? 'bg-green-950/30 border-green-800/30 text-green-400' : 'bg-red-950/30 border-red-800/30 text-red-400'}`}>
              Estimated Net Profit: {fmt(net)}
            </div>
          )}
        </div>
      )}

      {error && <p className="text-red-400 text-sm">{error}</p>}
      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">{saving ? 'Saving…' : 'Save Item'}</button>
        <button type="button" onClick={onClose} className="btn-ghost flex-1 text-center">Cancel</button>
      </div>
    </form>
  )
}

export default function Inventory() {
  const [items, setItems] = useState([])
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState(null) // null | 'add' | {item}
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [receiptTarget, setReceiptTarget] = useState(null) // {id, name}
  const [listTarget, setListTarget] = useState(null) // item for quick-list
  const [sellTarget, setSellTarget] = useState(null) // item for quick-sell

  const load = () => api.getItems().then(setItems).catch(console.error)
  useEffect(() => {
    load()
    const onVisible = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onVisible)
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
    const { asking_price, platform, listed_date, sale_price, platform_fees, shipping_cost, sold_date, ...itemData } = data
    const item = await api.createItem(itemData)
    if (itemData.status === 'Listed' && asking_price) {
      await api.createListing({ item_id: item.id, platform: platform || 'eBay', asking_price: parseFloat(asking_price), listed_date: listed_date || today(), url: '' })
    } else if (itemData.status === 'Sold' && sale_price) {
      await api.createSale({ item_id: item.id, sale_price: parseFloat(sale_price), platform_fees: parseFloat(platform_fees) || 0, shipping_cost: parseFloat(shipping_cost) || 0, sold_date: sold_date || today() })
    }
    setModal(null)
    load()
  }

  const handleEdit = async (data) => {
    const { asking_price, platform, listed_date, sale_price, platform_fees, shipping_cost, sold_date, ...itemData } = data
    await api.updateItem(modal.id, itemData)
    const prevStatus = modal.status
    if (itemData.status === 'Listed' && prevStatus !== 'Listed' && asking_price) {
      await api.createListing({ item_id: modal.id, platform: platform || 'eBay', asking_price: parseFloat(asking_price), listed_date: listed_date || today(), url: '' })
    } else if (itemData.status === 'Sold' && prevStatus !== 'Sold' && sale_price) {
      await api.createSale({ item_id: modal.id, sale_price: parseFloat(sale_price), platform_fees: parseFloat(platform_fees) || 0, shipping_cost: parseFloat(shipping_cost) || 0, sold_date: sold_date || today() })
    }
    setModal(null)
    load()
  }

  const handleDelete = async (id) => {
    setDeleting(true)
    setDeleteError('')
    try {
      await api.deleteItem(id)
      setConfirmDelete(null)
      load()
    } catch (err) {
      setDeleteError(err.message)
    } finally {
      setDeleting(false)
    }
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
                      {item.status !== 'Listed' && (
                        <button
                          onClick={() => setListTarget(item)}
                          className="p-1.5 rounded-lg text-gray-500 hover:text-blue-400 hover:bg-blue-950/30 transition-colors"
                          title="List this item"
                        >
                          <Tag className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => setSellTarget(item)}
                        className="p-1.5 rounded-lg text-gray-500 hover:text-green-400 hover:bg-green-950/30 transition-colors"
                        title="Record sale"
                      >
                        <DollarSign className="w-3.5 h-3.5" />
                      </button>
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
                        title="Edit"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => { setConfirmDelete(item); setDeleteError('') }}
                        className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-950/30 transition-colors"
                        title="Delete"
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

      {listTarget && (
        <Modal title="List Item" onClose={() => setListTarget(null)}>
          <QuickListForm
            item={listTarget}
            onSubmit={async (data) => { await api.createListing(data); setListTarget(null); load() }}
            onClose={() => setListTarget(null)}
          />
        </Modal>
      )}

      {sellTarget && (
        <Modal title="Record Sale" onClose={() => setSellTarget(null)}>
          <QuickSellForm
            item={sellTarget}
            onSubmit={async (data) => { await api.createSale(data); setSellTarget(null); load() }}
            onClose={() => setSellTarget(null)}
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
        <Modal title="Delete Item" onClose={() => { if (!deleting) { setConfirmDelete(null); setDeleteError('') } }}>
          <p className="text-gray-400 text-sm mb-4">
            Are you sure you want to delete <span className="text-white font-medium">{confirmDelete.name}</span>? This cannot be undone.
          </p>
          {deleteError && <p className="text-red-400 text-sm mb-3">{deleteError}</p>}
          <div className="flex gap-2">
            <button
              onClick={() => handleDelete(confirmDelete.id)}
              disabled={deleting}
              className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium py-2 rounded-xl transition-colors"
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
            <button onClick={() => { setConfirmDelete(null); setDeleteError('') }} disabled={deleting} className="btn-ghost flex-1 text-center disabled:opacity-50">
              Cancel
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
