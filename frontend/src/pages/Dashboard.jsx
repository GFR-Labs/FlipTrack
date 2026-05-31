import { useEffect, useState } from 'react'
import { TrendingUp, DollarSign, Package, Zap } from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { api } from '../api'

function StatCard({ label, value, sub, icon: Icon, iconBg, valueColor }) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between mb-4">
        <span className="text-sm text-gray-500">{label}</span>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${iconBg}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className={`text-3xl font-bold font-mono mb-1 ${valueColor}`}>{value}</div>
      <div className="text-xs text-gray-500">{sub}</div>
    </div>
  )
}

const fmt = (n) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n ?? 0)

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl px-4 py-3 text-sm shadow-xl">
      <p className="text-gray-400 mb-2 font-medium">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }} className="font-mono">
          {p.name}: {fmt(p.value)}
        </p>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const [stats, setStats] = useState(null)
  const [monthly, setMonthly] = useState([])

  useEffect(() => {
    api.dashboardStats().then(setStats).catch(console.error)
    api.dashboardMonthly().then(setMonthly).catch(console.error)
  }, [])

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">Overview of your flipping business</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard
          label="Net Profit"
          value={fmt(stats?.net_profit)}
          sub="After all costs & expenses"
          icon={TrendingUp}
          iconBg="bg-green-900/50"
          valueColor="text-green-400"
        />
        <StatCard
          label="Gross Revenue"
          value={fmt(stats?.gross_revenue)}
          sub={`From ${stats?.items_sold ?? 0} sales`}
          icon={DollarSign}
          iconBg="bg-blue-900/50"
          valueColor="text-blue-400"
        />
        <StatCard
          label="Total Invested"
          value={fmt(stats?.total_invested)}
          sub={`${(stats?.items_in_stock ?? 0) + (stats?.items_listed ?? 0)} items in inventory`}
          icon={Package}
          iconBg="bg-red-900/50"
          valueColor="text-red-400"
        />
        <StatCard
          label="Potential Profit"
          value={fmt(stats?.potential_inventory_value)}
          sub={`${stats?.items_listed ?? 0} active listings`}
          icon={Zap}
          iconBg="bg-green-900/50"
          valueColor="text-green-400"
        />
      </div>

      {/* Monthly chart */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h2 className="text-base font-semibold text-white">Monthly Performance</h2>
            <p className="text-xs text-gray-500">Revenue & profit this year</p>
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" />
              Revenue
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" />
              Profit
            </span>
          </div>
        </div>

        {monthly.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-gray-600 text-sm">
            No sales data yet
          </div>
        ) : (
          <div className="h-56 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly} barGap={4} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="#1f1f1f" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fill: '#6b7280', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#6b7280', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `$${v}`}
                  width={50}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                <Bar dataKey="revenue" name="Revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="profit" name="Profit" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Quick stats row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'In Stock', value: stats?.items_in_stock ?? 0, color: 'text-gray-300' },
          { label: 'Listed', value: stats?.items_listed ?? 0, color: 'text-blue-400' },
          { label: 'Sold', value: stats?.items_sold ?? 0, color: 'text-green-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="card p-4 text-center">
            <div className={`text-2xl font-bold font-mono ${color}`}>{value}</div>
            <div className="text-xs text-gray-500 mt-1">{label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
