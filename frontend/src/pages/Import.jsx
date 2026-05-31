import { useRef, useState } from 'react'
import { Upload, Download, CheckCircle, AlertCircle, FileText } from 'lucide-react'

const BASE = '/api'

function ResultBox({ result }) {
  if (!result) return null
  const hasErrors = result.errors?.length > 0
  return (
    <div className={`rounded-xl border p-4 space-y-2 ${hasErrors ? 'bg-yellow-950/20 border-yellow-800/30' : 'bg-green-950/20 border-green-800/30'}`}>
      <div className="flex items-center gap-2">
        {hasErrors
          ? <AlertCircle className="w-4 h-4 text-yellow-400 flex-shrink-0" />
          : <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0" />}
        <span className="text-sm font-medium text-white">
          {result.imported} row{result.imported !== 1 ? 's' : ''} imported
          {result.skipped > 0 && `, ${result.skipped} skipped`}
        </span>
      </div>
      {result.errors?.map((e, i) => (
        <p key={i} className="text-xs text-yellow-400 pl-6">{e}</p>
      ))}
    </div>
  )
}

function ImportSection({ title, description, endpoint, templateUrl, columns }) {
  const inputRef = useRef(null)
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const handleFile = (e) => {
    setFile(e.target.files[0] ?? null)
    setResult(null)
    setError('')
  }

  const handleImport = async () => {
    if (!file) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const body = new FormData()
      body.append('file', file)
      const res = await fetch(`${BASE}${endpoint}`, { method: 'POST', body })
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || 'Import failed')
      setResult(data)
      setFile(null)
      if (inputRef.current) inputRef.current.value = ''
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <p className="text-sm text-gray-500 mt-0.5">{description}</p>
        </div>
        <a
          href={`${BASE}${templateUrl}`}
          className="flex items-center gap-1.5 text-xs text-green-400 hover:text-green-300 border border-green-800/40 hover:border-green-700 bg-green-950/20 px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap flex-shrink-0"
        >
          <Download className="w-3.5 h-3.5" />
          Template CSV
        </a>
      </div>

      {/* Column reference */}
      <div className="bg-[#1a1a1a] rounded-xl p-3 border border-[#2a2a2a]">
        <p className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wider">Expected columns</p>
        <div className="flex flex-wrap gap-1.5">
          {columns.map(({ name, required }) => (
            <span
              key={name}
              className={`text-xs px-2 py-0.5 rounded font-mono ${required ? 'bg-green-950/50 text-green-400 border border-green-800/30' : 'bg-[#222] text-gray-500 border border-[#2a2a2a]'}`}
            >
              {name}
              {required && <span className="ml-0.5 opacity-60">*</span>}
            </span>
          ))}
        </div>
        <p className="text-xs text-gray-600 mt-2">* required &nbsp;|&nbsp; Column names are case-insensitive</p>
      </div>

      {/* File picker */}
      <div
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-[#2a2a2a] hover:border-green-700 rounded-xl p-6 flex flex-col items-center gap-2 cursor-pointer transition-colors group"
      >
        <FileText className="w-6 h-6 text-gray-600 group-hover:text-green-500 transition-colors" />
        {file
          ? <span className="text-sm text-white font-medium">{file.name}</span>
          : <span className="text-sm text-gray-500">Click to select a CSV file</span>}
        <input ref={inputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}
      <ResultBox result={result} />

      <button
        onClick={handleImport}
        disabled={!file || loading}
        className="btn-primary w-full justify-center disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Upload className="w-4 h-4" />
        {loading ? 'Importing…' : `Import ${title}`}
      </button>
    </div>
  )
}

export default function Import() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Import</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Bulk import from CSV — export from Supabase, Sheets, or any tool and paste it in
        </p>
      </div>

      <div className="card p-4 border-blue-800/30 bg-blue-950/10">
        <p className="text-sm text-blue-300 font-medium mb-1">Import order matters</p>
        <p className="text-sm text-gray-400">
          Import <span className="text-white">Items</span> first, then <span className="text-white">Sales</span> (sales are matched to items by name), then <span className="text-white">Expenses</span> in any order.
        </p>
      </div>

      <ImportSection
        title="Items"
        description="Your inventory — everything you've purchased to flip"
        endpoint="/import/items"
        templateUrl="/import/template/items"
        columns={[
          { name: 'name', required: true },
          { name: 'purchase_price', required: true },
          { name: 'date_acquired', required: true },
          { name: 'quantity', required: false },
          { name: 'status', required: false },
          { name: 'notes', required: false },
        ]}
      />

      <ImportSection
        title="Sales"
        description="Completed sales — item_name must exactly match an item already in inventory"
        endpoint="/import/sales"
        templateUrl="/import/template/sales"
        columns={[
          { name: 'item_name', required: true },
          { name: 'sale_price', required: true },
          { name: 'sold_date', required: true },
          { name: 'platform_fees', required: false },
          { name: 'shipping_cost', required: false },
        ]}
      />

      <ImportSection
        title="Expenses"
        description="Overhead costs — shipping supplies, eBay fees, mileage, etc."
        endpoint="/import/expenses"
        templateUrl="/import/template/expenses"
        columns={[
          { name: 'category', required: true },
          { name: 'amount', required: true },
          { name: 'date', required: true },
          { name: 'description', required: false },
        ]}
      />
    </div>
  )
}
