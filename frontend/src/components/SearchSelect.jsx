import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Search, X } from 'lucide-react'

/**
 * Searchable dropdown. options: [{ value, label, sublabel? }]
 * value is matched loosely (string/number). allowClear shows an X that
 * calls onChange(null). required renders a hidden input so native form
 * validation still blocks empty submits.
 */
export default function SearchSelect({
  options, value, onChange,
  placeholder = 'Select…', searchPlaceholder = 'Type to search…',
  required = false, allowClear = false, emptyText = 'No matches',
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [hi, setHi] = useState(0)
  const rootRef = useRef(null)
  const searchRef = useRef(null)

  const selected = options.find((o) => String(o.value) === String(value)) ?? null
  const q = query.trim().toLowerCase()
  const filtered = q
    ? options.filter((o) => `${o.label} ${o.sublabel ?? ''}`.toLowerCase().includes(q))
    : options

  useEffect(() => {
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  useEffect(() => {
    if (open) {
      setQuery('')
      setHi(0)
      setTimeout(() => searchRef.current?.focus(), 0)
    }
  }, [open])

  const pick = (o) => { onChange(o.value); setOpen(false) }

  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(h + 1, filtered.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); if (filtered[hi]) pick(filtered[hi]) }
    else if (e.key === 'Escape') { setOpen(false) }
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="input flex items-center justify-between gap-2 text-left"
      >
        <span className={`truncate ${selected ? 'text-ink' : 'text-inkfaint'}`}>
          {selected ? selected.label : placeholder}
          {selected?.sublabel && <span className="text-inkfaint text-xs ml-2">{selected.sublabel}</span>}
        </span>
        <span className="flex items-center gap-1 flex-shrink-0">
          {allowClear && selected && (
            <span
              role="button" tabIndex={0} title="Clear"
              onClick={(e) => { e.stopPropagation(); onChange(null) }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); onChange(null) } }}
              className="p-0.5 rounded text-inkmut hover:text-clay hover:bg-clay/10"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown className={`w-4 h-4 text-inkmut transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </button>

      {required && (
        <input
          tabIndex={-1} aria-hidden="true" required
          value={value ?? ''} onChange={() => {}}
          className="absolute bottom-0 left-4 w-px h-px opacity-0 pointer-events-none"
        />
      )}

      {open && (
        <div className="absolute z-50 mt-1 w-full card shadow-xl max-h-64 flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-edge flex-shrink-0">
            <Search className="w-3.5 h-3.5 text-inkmut flex-shrink-0" />
            <input
              ref={searchRef}
              className="w-full bg-transparent text-sm text-ink placeholder-inkfaint focus:outline-none"
              placeholder={searchPlaceholder}
              value={query}
              onChange={(e) => { setQuery(e.target.value); setHi(0) }}
              onKeyDown={onKey}
            />
          </div>
          <div className="overflow-y-auto">
            {filtered.length === 0 && (
              <div className="px-3 py-4 text-center text-xs text-inkfaint">{emptyText}</div>
            )}
            {filtered.map((o, idx) => (
              <button
                type="button" key={o.value}
                onClick={() => pick(o)}
                onMouseEnter={() => setHi(idx)}
                className={`w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-2 transition-colors
                  ${idx === hi ? 'bg-sand' : ''} ${String(o.value) === String(value) ? 'text-moss font-medium' : 'text-ink'}`}
              >
                <span className="truncate">{o.label}</span>
                {o.sublabel && <span className="text-xs text-inkfaint font-mono flex-shrink-0">{o.sublabel}</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
