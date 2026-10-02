import { useEffect, useState } from 'react'
import { TrendingUp, DollarSign, Package, Zap } from 'lucide-react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { api } from '../api'

function StatCard({ label, value, sub, valueColor }) {
  return (
    <div className="card p-5">
      <div className="label mb-3">{label}</div>
      <div className={`text-[32px] leading-none font-display font-semibold mb-2 tabular-nums ${valueColor}`}>
        {value}
      </div>
      <div className="text-xs text-inkfaint border-t border-edge pt-2">{sub}</div>
    </div>
  )
}

const fmt = (n) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n ?? 0)

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-cream border border-edge rounded px-4 py-3 text-sm shadow-md">
      <p className="text-inkmut mb-2 font-medium">{label}</p>
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
    const load = () => {
      api.dashboardStats().then(setStats).catch(console.error)
      api.dashboardMonthly().then(setMonthly).catch(console.error)
    }
    load()
    const onVisible = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onVisible)
    const interval = setInterval(load, 30_000)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      clearInterval(interval)
    }
  }, [])

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Dashboard</h1>
        <p className="text-sm text-inkmut mt-0.5">Overview of your flipping business</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard
          label="Net Profit"
          value={fmt(stats?.net_profit)}
          sub="After all costs & expenses"
          icon={TrendingUp}
          iconBg="bg-moss/10"
          valueColor="text-moss"
        />
        <StatCard
          label="Gross Revenue"
          value={fmt(stats?.gross_revenue)}
          sub={`From ${stats?.items_sold ?? 0} sales`}
          icon={DollarSign}
          iconBg="bg-sea/10"
          valueColor="text-sea"
        />
        <StatCard
          label="Total Invested"
          value={fmt(stats?.total_invested)}
          sub={`${(stats?.items_in_stock ?? 0) + (stats?.items_listed ?? 0)} items in inventory`}
          icon={Package}
          iconBg="bg-clay/10"
          valueColor="text-clay"
        />
        <StatCard
          label="Potential Profit"
          value={fmt(stats?.potential_profit)}
          sub={`${stats?.active_listings_count ?? 0} active listings`}
          icon={Zap}
          iconBg="bg-moss/10"
          valueColor="text-moss"
        />
      </div>

      {/* Monthly chart */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-1">
          <div>
            <h2 className="text-base font-semibold text-ink">Monthly Performance</h2>
            <p className="text-xs text-inkmut">Revenue & profit this year</p>
          </div>
          <div className="flex items-center gap-4 text-xs text-inkmut">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-sea inline-block" />
              Revenue
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-moss inline-block" />
              Profit
            </span>
          </div>
        </div>

        {monthly.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-inkfaint text-sm">
            No sales data yet
          </div>
        ) : (
          <div className="h-56 mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly} barGap={4} barCategoryGap="30%">
                <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
                <XAxis
                  dataKey="month"
                  tick={{ fill: 'var(--chart-tick)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: 'var(--chart-tick)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `$${v}`}
                  width={50}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--chart-cursor)' }} />
                <Bar dataKey="revenue" name="Revenue" fill="var(--chart-revenue)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="profit" name="Profit" fill="var(--chart-profit)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Quick stats row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'In Stock', value: stats?.items_in_stock ?? 0, color: 'text-ink' },
          { label: 'Listed', value: stats?.items_listed ?? 0, color: 'text-sea' },
          { label: 'Sold', value: stats?.items_sold ?? 0, color: 'text-moss' },
        ].map(({ label, value, color }) => (
          <div key={label} className="card p-4 text-center">
            <div className={`text-2xl font-bold font-mono ${color}`}>{value}</div>
            <div className="text-xs text-inkmut mt-1">{label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
