import { useEffect, useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Package, Tag, DollarSign, Receipt, BarChart3, X, PlusSquare, HardDrive
} from 'lucide-react'
import ThemeToggle from './ThemeToggle'

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/inventory', label: 'Inventory', icon: Package },
  { to: '/listings', label: 'Listings', icon: Tag },
  { to: '/sold', label: 'Sold', icon: DollarSign },
  { to: '/expenses', label: 'Expenses', icon: Receipt },
  { to: '/business', label: 'Business', icon: BarChart3 },
  { to: '/bulk-add', label: 'Bulk Add', icon: PlusSquare },
]

function StorageIndicator() {
  const [info, setInfo] = useState(null)

  useEffect(() => {
    const fetch_ = () =>
      fetch('/api/system/storage')
        .then((r) => r.json())
        .then(setInfo)
        .catch(() => {})
    fetch_()
    const t = setInterval(fetch_, 30_000)
    window.addEventListener('storage-changed', fetch_)
    return () => {
      clearInterval(t)
      window.removeEventListener('storage-changed', fetch_)
    }
  }, [])

  if (!info) return null

  const gb = info.bytes / (1024 ** 3)
  const color =
    gb > 5 ? 'text-clay' :
    gb > 1 ? 'text-ochre' :
    'text-inkfaint'

  return (
    <div className="px-4 py-3 border-t border-edge flex items-center gap-2">
      <HardDrive className={`w-3.5 h-3.5 flex-shrink-0 ${color}`} />
      <span className={`text-xs ${color}`}>{info.human} used</span>
    </div>
  )
}

export default function Sidebar({ open, onClose }) {
  return (
    <>
      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-ink/40 z-30 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={`
          fixed top-0 left-0 h-full w-64 bg-paper border-r border-edge z-40
          flex flex-col transition-transform duration-200 ease-in-out
          ${open ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 lg:static lg:z-auto
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-edge">
          <div className="flex items-baseline gap-2">
            <span className="font-display font-semibold text-[22px] text-ink leading-none">FlipTrack</span>
            <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-moss">est. 2026</span>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden text-inkmut hover:text-ink p-1 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-sm text-sm transition-colors border-l-2 ${
                  isActive
                    ? 'border-moss bg-cream text-ink font-semibold'
                    : 'border-transparent text-inkmut hover:text-ink hover:bg-sand font-medium'
                }`
              }
            >
              <Icon className="w-4 h-4 flex-shrink-0" strokeWidth={1.75} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Theme toggle */}
        <div className="px-4 py-3 border-t border-edge flex items-center justify-between">
          <span className="label">Theme</span>
          <ThemeToggle />
        </div>

        {/* Storage indicator */}
        <StorageIndicator />
      </aside>
    </>
  )
}
