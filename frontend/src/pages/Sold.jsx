import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { api } from '../api'
import Modal from '../components/Modal'

const today = () => new Date().toISOString().slice(0, 10)
const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n ?? 0)
const fmtDate = (d) => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

function SaleForm({ initial, items, onSubmit, onClose }) {
  const [form, setForm] = useState(
    initial ?? { item_id: items[0]?.id ?? '', sale_price: '', platform_fees: '0', shipping_cost: '0', sold_date: today() }
  )
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const item = items.find((i) => i.id === parseInt(form.item_id))
  const net = item
    ? (parseFloat(form.sale_price) || 0) - (parseFloat(form.platform_fees) || 0) - (parseFloat(form.shipping_cost) || 0) - item.purchase_price
    : null

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSaving(true)
    try {
      await onSubmit({
        ...form,
        item_id: parseInt(form.item_id),
        sale_price: parseFloat(form.sale_price),
        platform_fees: parseFloat(form.platform_fees),
        shipping_cost: parseFloat(form.shipping_cost),
      })
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
        <label className="label block mb-1">Item</label>
        <select className="input" required value={form.item_id} onChange={(e) => set('item_id', e.target.value)}>
          <option value="">Select item…</option>
          {items.map((i) => <option key={i.id} value={i.id}>{i.name} (cost: {fmt(i.purchase_price)})</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label block mb-1">Sale Price</label>
          <input className="input" type="number" step="0.01" min="0" required value={form.sale_price} onChange={(e) => set('sale_price', e.target.value)} placeholder="0.00" />
        </div>
        <div>
          <label className="label block mb-1">Platform Fees</label>
          <input className="input" type="number" step="0.01" min="0" value={form.platform_fees} onChange={(e) => set('platform_fees', e.target.value)} placeholder="0.00" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label block mb-1">Shipping Cost</label>
          <input className="input" type="number" step="0.01" min="0" value={form.shipping_cost} onChange={(e) => set('shipping_cost', e.target.value)} placeholder="0.00" />
        </div>
        <div>
          <label className="label block mb-1">Sold Date</label>
          <input className="input" type="date" required value={form.sold_date} onChange={(e) => set('sold_date', e.target.value)} />
        </div>
      </div>
      {net !== null && (
        <div className={`rounded-xl border px-4 py-3 text-sm font-mono font-medium ${net >= 0 ? 'bg-green-950/30 border-green-800/30 text-green-400' : 'bg-red-950/30 border-red-800/30 text-red-400'}`}>
          Estimated Net Profit: {fmt(net)}
        </div>
      )}
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <div className="flex gap-2 pt-1">
        <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
          {saving ? 'Recording…' : 'Record Sale'}
        </button>
        <button type="button" onClick={onClose} className="btn-ghost flex-1 text-center">Cancel</button>
      </div>
    </form>
  )
}

export default function Sold() {
  const [sales, setSales] = useState([])
  const [items, setItems] = useState([])
  const [modal, setModal] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)

  const load = () => {
    api.getSales().then(setSales).catch(console.error)
    api.getItems().then(setItems).catch(console.error)
  }
  useEffect(() => { load() }, [])

  // Only unsold items are valid targets for a new sale
  const availableItems = items.filter((i) => i.status !== 'Sold')

  const handleAdd = async (data) => { await api.createSale(data); setModal(null); load() }
  const handleEdit = async (data) => { await api.updateSale(modal.id, data); setModal(null); load() }
  const handleDelete = async (id) => { await api.deleteSale(id); setConfirmDelete(null); load() }

  const totalRevenue = sales.reduce((s, sale) => s + sale.sale_price, 0)
  const totalProfit = sales.reduce((s, sale) => s + sale.net_profit, 0)
  const totalFees = sales.reduce((s, sale) => s + sale.platform_fees + sale.shipping_cost, 0)

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-white">Sold</h1>
        <p className="text-sm text-gray-500 mt-0.5">Completed sales and profit tracking</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="card px-4 py-3">
          <div className="text-xs text-gray-500 mb-1">Total Sales</div>
          <div className="text-xl font-bold text-white font-mono">{sales.length}</div>
        </div>
        <div className="card px-4 py-3">
          <div className="text-xs text-gray-500 mb-1">Gross Revenue</div>
          <div className="text-xl font-bold text-blue-400 font-mono">{fmt(totalRevenue)}</div>
        </div>
        <div className="card px-4 py-3">
          <div className="text-xs text-gray-500 mb-1">Net Profit</div>
          <div className={`text-xl font-bold font-mono ${totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}`}>{fmt(totalProfit)}</div>
        </div>
      </div>

      <div className="flex justify-end">
        <button className="btn-primary" onClick={() => setModal('add')}>
          <Plus className="w-4 h-4" /> Record Sale
        </button>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1f1f1f]">
                <th className="label px-4 py-3 text-left">Item</th>
                <th className="label px-4 py-3 text-right">Sale Price</th>
                <th className="label px-4 py-3 text-right hidden sm:table-cell">Fees</th>
                <th className="label px-4 py-3 text-right hidden sm:table-cell">Shipping</th>
                <th className="label px-4 py-3 text-right">Net Profit</th>
                <th className="label px-4 py-3 text-left hidden md:table-cell">Date</th>
                <th className="label px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sales.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-600">No sales recorded yet</td></tr>
              )}
              {sales.map((s) => (
                <tr key={s.id} className="border-b border-[#1a1a1a] hover:bg-[#161616] transition-colors">
                  <td className="px-4 py-3 text-white font-medium">{s.item?.name ?? `Item #${s.item_id}`}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-300">{fmt(s.sale_price)}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-500 hidden sm:table-cell">{fmt(s.platform_fees)}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-500 hidden sm:table-cell">{fmt(s.shipping_cost)}</td>
                  <td className="px-4 py-3 text-right font-mono font-medium">
                    <span className={s.net_profit >= 0 ? 'text-green-400' : 'text-red-400'}>{fmt(s.net_profit)}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 hidden md:table-cell">{fmtDate(s.sold_date)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setModal(s)} className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-[#222] transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setConfirmDelete(s)} className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-950/30 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            {sales.length > 0 && (
              <tfoot>
                <tr className="border-t border-[#2a2a2a] bg-[#161616]">
                  <td className="px-4 py-3 text-gray-500 text-xs font-medium uppercase tracking-wider">Totals</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-300 font-medium">{fmt(totalRevenue)}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-500 hidden sm:table-cell">{fmt(sales.reduce((s, x) => s + x.platform_fees, 0))}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-500 hidden sm:table-cell">{fmt(sales.reduce((s, x) => s + x.shipping_cost, 0))}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold">
                    <span className={totalProfit >= 0 ? 'text-green-400' : 'text-red-400'}>{fmt(totalProfit)}</span>
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {modal === 'add' && (
        <Modal title="Record Sale" onClose={() => setModal(null)}>
          <SaleForm items={availableItems} onSubmit={handleAdd} onClose={() => setModal(null)} />
        </Modal>
      )}
      {modal && modal !== 'add' && (
        <Modal title="Edit Sale" onClose={() => setModal(null)}>
          <SaleForm
            initial={{ item_id: modal.item_id, sale_price: modal.sale_price, platform_fees: modal.platform_fees, shipping_cost: modal.shipping_cost, sold_date: modal.sold_date }}
            items={availableItems}
            onSubmit={handleEdit}
            onClose={() => setModal(null)}
          />
        </Modal>
      )}
      {confirmDelete && (
        <Modal title="Delete Sale" onClose={() => setConfirmDelete(null)}>
          <p className="text-gray-400 text-sm mb-4">Delete sale record for <span className="text-white">{confirmDelete.item?.name}</span>?</p>
          <div className="flex gap-2">
            <button onClick={() => handleDelete(confirmDelete.id)} className="flex-1 bg-red-600 hover:bg-red-500 text-white font-medium py-2 rounded-xl transition-colors">Delete</button>
            <button onClick={() => setConfirmDelete(null)} className="btn-ghost flex-1 text-center">Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
