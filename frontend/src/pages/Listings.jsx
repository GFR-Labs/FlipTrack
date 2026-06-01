import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, ExternalLink, DollarSign } from 'lucide-react'
import { api } from '../api'
import Modal from '../components/Modal'

const PLATFORMS = ['eBay', 'Facebook Marketplace', 'Craigslist', 'OfferUp', 'Amazon', 'Other']
const today = () => new Date().toISOString().slice(0, 10)
const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n ?? 0)
const fmtDate = (d) => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

function QuickSellForm({ item, onSubmit, onClose }) {
  const [form, setForm] = useState({ sale_price: '', platform_fees: '0', shipping_cost: '0', sold_date: today() })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const net = form.sale_price !== ''
    ? (parseFloat(form.sale_price) || 0) - (parseFloat(form.platform_fees) || 0) - (parseFloat(form.shipping_cost) || 0) - item.purchase_price
    : null

  const handle = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      await onSubmit({ item_id: item.id, sale_price: parseFloat(form.sale_price), platform_fees: parseFloat(form.platform_fees) || 0, shipping_cost: parseFloat(form.shipping_cost) || 0, sold_date: form.sold_date })
      onClose()
    } catch (err) {
      setError(err.message)
    } finally {
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

function ListingForm({ initial, items, onSubmit, onClose }) {
  const [form, setForm] = useState(
    initial ?? { item_id: items[0]?.id ?? '', platform: 'eBay', asking_price: '', listed_date: today(), url: '' }
  )
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit({ ...form, item_id: parseInt(form.item_id), asking_price: parseFloat(form.asking_price) }) }} className="space-y-3">
      <div>
        <label className="label block mb-1">Item</label>
        <select className="input" required value={form.item_id} onChange={(e) => set('item_id', e.target.value)}>
          <option value="">Select item…</option>
          {items.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label block mb-1">Platform</label>
          <select className="input" value={form.platform} onChange={(e) => set('platform', e.target.value)}>
            {PLATFORMS.map((p) => <option key={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="label block mb-1">Asking Price</label>
          <input className="input" type="number" step="0.01" min="0" required value={form.asking_price} onChange={(e) => set('asking_price', e.target.value)} placeholder="0.00" />
        </div>
      </div>
      <div>
        <label className="label block mb-1">Listed Date</label>
        <input className="input" type="date" required value={form.listed_date} onChange={(e) => set('listed_date', e.target.value)} />
      </div>
      <div>
        <label className="label block mb-1">URL (optional)</label>
        <input className="input" type="url" value={form.url} onChange={(e) => set('url', e.target.value)} placeholder="https://..." />
      </div>
      <div className="flex gap-2 pt-1">
        <button type="submit" className="btn-primary flex-1 justify-center">Save Listing</button>
        <button type="button" onClick={onClose} className="btn-ghost flex-1 text-center">Cancel</button>
      </div>
    </form>
  )
}

export default function Listings() {
  const [listings, setListings] = useState([])
  const [items, setItems] = useState([])
  const [modal, setModal] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [sellTarget, setSellTarget] = useState(null) // listing for quick-sell

  const load = () => {
    api.getListings().then(setListings).catch(console.error)
    api.getItems().then(setItems).catch(console.error)
  }
  useEffect(() => { load() }, [])

  const availableItems = items.filter((i) => i.status !== 'Sold')
  // Hide listings whose item has since been sold
  const activeListings = listings.filter(l => !l.item || l.item.status !== 'Sold')

  const handleAdd = async (data) => {
    await api.createListing(data)
    setModal(null)
    load()
  }

  const handleEdit = async (data) => {
    await api.updateListing(modal.id, data)
    setModal(null)
    load()
  }

  const handleDelete = async (id) => {
    await api.deleteListing(id)
    setConfirmDelete(null)
    load()
  }

  const totalAskingValue = activeListings.reduce((s, l) => s + l.asking_price, 0)

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-white">Listings</h1>
        <p className="text-sm text-gray-500 mt-0.5">Items currently listed for sale</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="card px-4 py-3">
          <div className="text-xs text-gray-500 mb-1">Active Listings</div>
          <div className="text-xl font-bold text-white font-mono">{activeListings.length}</div>
        </div>
        <div className="card px-4 py-3">
          <div className="text-xs text-gray-500 mb-1">Total Asking Value</div>
          <div className="text-xl font-bold text-blue-400 font-mono">{fmt(totalAskingValue)}</div>
        </div>
      </div>

      <div className="flex justify-end">
        <button className="btn-primary" onClick={() => setModal('add')}>
          <Plus className="w-4 h-4" /> Add Listing
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1f1f1f]">
                <th className="label px-4 py-3 text-left">Item</th>
                <th className="label px-4 py-3 text-left hidden sm:table-cell">Platform</th>
                <th className="label px-4 py-3 text-right">Asking Price</th>
                <th className="label px-4 py-3 text-left hidden md:table-cell">Listed</th>
                <th className="label px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {activeListings.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-gray-600">No listings yet</td>
                </tr>
              )}
              {activeListings.map((l) => (
                <tr key={l.id} className="border-b border-[#1a1a1a] hover:bg-[#161616] transition-colors">
                  <td className="px-4 py-3">
                    <div className="text-white font-medium">{l.item?.name ?? `Item #${l.item_id}`}</div>
                    <div className="text-xs text-gray-500 sm:hidden">{l.platform}</div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className="text-xs bg-[#1a1a1a] border border-[#2a2a2a] text-gray-300 px-2 py-0.5 rounded-md">{l.platform}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-green-400 font-medium">{fmt(l.asking_price)}</td>
                  <td className="px-4 py-3 text-gray-400 hidden md:table-cell">{fmtDate(l.listed_date)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {l.item && (
                        <button onClick={() => setSellTarget(l)} className="p-1.5 rounded-lg text-gray-500 hover:text-green-400 hover:bg-green-950/30 transition-colors" title="Record sale">
                          <DollarSign className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {l.url && (
                        <a href={l.url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg text-gray-500 hover:text-blue-400 hover:bg-[#222] transition-colors">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <button onClick={() => setModal(l)} className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-[#222] transition-colors" title="Edit">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setConfirmDelete(l)} className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-950/30 transition-colors" title="Delete">
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

      {modal === 'add' && (
        <Modal title="Add Listing" onClose={() => setModal(null)}>
          <ListingForm items={availableItems} onSubmit={handleAdd} onClose={() => setModal(null)} />
        </Modal>
      )}
      {modal && modal !== 'add' && (
        <Modal title="Edit Listing" onClose={() => setModal(null)}>
          <ListingForm
            initial={{ item_id: modal.item_id, platform: modal.platform, asking_price: modal.asking_price, listed_date: modal.listed_date, url: modal.url ?? '' }}
            items={availableItems}
            onSubmit={handleEdit}
            onClose={() => setModal(null)}
          />
        </Modal>
      )}
      {confirmDelete && (
        <Modal title="Delete Listing" onClose={() => setConfirmDelete(null)}>
          <p className="text-gray-400 text-sm mb-4">Delete listing for <span className="text-white">{confirmDelete.item?.name}</span>?</p>
          <div className="flex gap-2">
            <button onClick={() => handleDelete(confirmDelete.id)} className="flex-1 bg-red-600 hover:bg-red-500 text-white font-medium py-2 rounded-xl transition-colors">Delete</button>
            <button onClick={() => setConfirmDelete(null)} className="btn-ghost flex-1 text-center">Cancel</button>
          </div>
        </Modal>
      )}

      {sellTarget && (
        <Modal title="Record Sale" onClose={() => setSellTarget(null)}>
          <QuickSellForm
            item={sellTarget.item}
            onSubmit={async (data) => {
              await api.createSale(data)
              await api.deleteListing(sellTarget.id)
              setSellTarget(null)
              load()
            }}
            onClose={() => setSellTarget(null)}
          />
        </Modal>
      )}
    </div>
  )
}
