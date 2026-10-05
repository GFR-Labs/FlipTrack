import { useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Menu } from 'lucide-react'
import Sidebar from './components/Sidebar'
import Dashboard from './pages/Dashboard'
import Inventory from './pages/Inventory'
import Lots from './pages/Lots'
import Listings from './pages/Listings'
import Sold from './pages/Sold'
import Expenses from './pages/Expenses'
import Business from './pages/Business'
import BulkAdd from './pages/BulkAdd'

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <BrowserRouter>
      <div className="flex h-screen overflow-hidden bg-paper">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Mobile topbar */}
          <header className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-edge bg-paper flex-shrink-0">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-1.5 rounded text-inkmut hover:text-ink hover:bg-sand transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="text-ink font-bold">FlipTrack</span>
          </header>

          <main className="flex-1 overflow-y-auto px-4 py-6 lg:px-8 lg:py-8">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/lots" element={<Lots />} />
              <Route path="/listings" element={<Listings />} />
              <Route path="/sold" element={<Sold />} />
              <Route path="/expenses" element={<Expenses />} />
              <Route path="/business" element={<Business />} />
              <Route path="/bulk-add" element={<BulkAdd />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  )
}
