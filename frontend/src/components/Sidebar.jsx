import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Package, Tag, DollarSign, Receipt, BarChart3, TrendingUp, X, PlusSquare
} from 'lucide-react'

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/inventory', label: 'Inventory', icon: Package },
  { to: '/listings', label: 'Listings', icon: Tag },
  { to: '/sold', label: 'Sold', icon: DollarSign },
  { to: '/expenses', label: 'Expenses', icon: Receipt },
  { to: '/business', label: 'Business', icon: BarChart3 },
  { to: '/bulk-add', label: 'Bulk Add', icon: PlusSquare },
]

export default function Sidebar({ open, onClose }) {
  return (
    <>
      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 bg-black/60 z-30 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={`
          fixed top-0 left-0 h-full w-64 bg-[#0f0f0f] border-r border-[#1f1f1f] z-40
          flex flex-col transition-transform duration-200 ease-in-out
          ${open ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 lg:static lg:z-auto
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-[#1f1f1f]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-green-500 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-black" />
            </div>
            <span className="text-white font-bold text-lg tracking-tight">FlipTrack</span>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden text-gray-500 hover:text-white p-1 rounded-lg"
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
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-green-900/40 text-green-400 border border-green-800/30'
                    : 'text-gray-400 hover:text-white hover:bg-[#1a1a1a]'
                }`
              }
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  )
}
