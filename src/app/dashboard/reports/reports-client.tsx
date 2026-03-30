'use client'
import { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { ClipboardList, TrendingUp, TrendingDown, Package, Sparkles, Loader2, FileText } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type Report = {
  id: string
  driver_id: string
  route_id: string | null
  date: string
  parcels_taken: number
  parcels_delivered: number
  parcels_failed: number
  notes: string | null
  created_at: string
}

type Driver = { id: string; name: string }
type Route = { id: string; name: string; route_number: string | null }

export function ReportsClient({
  reports,
  drivers,
  routes,
}: {
  reports: Report[]
  drivers: Driver[]
  routes: Route[]
}) {
  const [liveReports, setLiveReports] = useState(reports)
  const [filterDriver, setFilterDriver] = useState('all')
  const [filterDate, setFilterDate] = useState('')
  const [payPeriodStart, setPayPeriodStart] = useState(() => {
    // Default: 28 days ago
    const d = new Date()
    d.setDate(d.getDate() - 27)
    return d.toISOString().split('T')[0]
  })
  const [view, setView] = useState<'daily' | 'monthly'>('daily')
  const [aiSummary, setAiSummary] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    const channel = supabase
      .channel('delivery_reports_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_reports' }, payload => {
        if (payload.eventType === 'INSERT') {
          setLiveReports(prev => [payload.new as Report, ...prev])
        } else if (payload.eventType === 'UPDATE') {
          setLiveReports(prev => prev.map(r => r.id === (payload.new as Report).id ? payload.new as Report : r))
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [])

  async function generateSummary() {
    setAiLoading(true)
    setAiSummary('')
    const date = filterDate || new Date().toISOString().split('T')[0]
    const res = await fetch(`/api/reports/summary?date=${date}`)
    const data = await res.json()
    setAiSummary(data.summary ?? 'No reports found for this date.')
    setAiLoading(false)
  }

  function generateMonthlySummary() {
    if (monthlyReports.length === 0) return ''
    const driverName = driverMap[filterDriver] ?? 'This driver'
    const endDate = new Date(payPeriodStart)
    endDate.setDate(endDate.getDate() + 27)
    const monthLabel = `${new Date(payPeriodStart).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} – ${endDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
    const avgPerDay = monthlyTaken > 0 ? Math.round(monthlyDelivered / monthlyReports.length) : 0
    const bestDayFormatted = bestDay ? new Date(bestDay.date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }) : ''
    const worstDay = [...monthlyReports].sort((a, b) => {
      const rateA = a.parcels_taken > 0 ? a.parcels_delivered / a.parcels_taken : 0
      const rateB = b.parcels_taken > 0 ? b.parcels_delivered / b.parcels_taken : 0
      return rateA - rateB
    })[0]
    const worstDayFormatted = worstDay ? new Date(worstDay.date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }) : ''
    const worstRate = worstDay?.parcels_taken > 0 ? Math.round((worstDay.parcels_delivered / worstDay.parcels_taken) * 100) : 0

    let s1 = `In ${monthLabel}, ${driverName} worked ${monthlyReports.length} day${monthlyReports.length > 1 ? 's' : ''}, delivering ${monthlyDelivered} out of ${monthlyTaken} parcels with a ${monthlyRate}% success rate.`

    let s2 = bestDay
      ? `Best performance was on ${bestDayFormatted} with ${bestDay.parcels_delivered} deliveries`
      + (monthlyReports.length > 1 ? ` — worst was ${worstDayFormatted} at ${worstRate}%.` : '.')
      : ''

    let s3 = ''
    if (monthlyRate >= 95) {
      s3 = `Outstanding month — ${driverName} is a top performer and should be recognised.`
    } else if (monthlyRate >= 88) {
      s3 = `Good overall performance with ${monthlyFailed} failed deliveries across the month — consistent and reliable.`
    } else if (monthlyRate >= 75) {
      s3 = `${monthlyFailed} failed deliveries this month — worth a conversation to identify any recurring issues.`
    } else {
      s3 = `High failure rate of ${100 - monthlyRate}% this month (${monthlyFailed} parcels) — this needs to be addressed directly with ${driverName}.`
    }

    return `${s1} ${s2} ${s3}`
  }

  function calcPay(delivered: number): number {
    return delivered >= 100 ? delivered * 1 : 100
  }

  function generateInvoice() {
    const appName = process.env.NEXT_PUBLIC_APP_NAME ?? 'DriverOps'
    const driverName = driverMap[filterDriver] ?? 'Unknown Driver'
    const monthLabel = payPeriodLabel
    const invoiceNum = `INV-${payPeriodStart.replace(/-/g, '')}-${filterDriver.slice(0, 6).toUpperCase()}`
    const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })
    const sorted = [...monthlyReports].sort((a, b) => a.date.localeCompare(b.date))

    const rows = sorted.map(r => {
      const routeNum = r.route_id ? routeNumberMap[r.route_id] : r.notes?.match(/^\[Route: (.+?)\]/)?.[1] ?? '—'
      const pay = calcPay(r.parcels_delivered)
      const payMode = r.parcels_delivered >= 100 ? 'Per delivery' : 'Flat rate'
      const dateStr = new Date(r.date).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
      return `<tr>
        <td>${dateStr}</td>
        <td>${routeNum ?? '—'}</td>
        <td>${r.parcels_taken}</td>
        <td>${r.parcels_delivered}</td>
        <td>${r.parcels_failed}</td>
        <td style="color:#16a34a;font-weight:600">£${pay}</td>
        <td style="color:#6b7280;font-size:11px">${payMode}</td>
      </tr>`
    }).join('')

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Invoice ${invoiceNum}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #111; background: #fff; padding: 40px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
    .brand { font-size: 22px; font-weight: 800; color: #1d4ed8; }
    .invoice-meta { text-align: right; }
    .invoice-meta h2 { font-size: 28px; font-weight: 800; color: #111; margin-bottom: 4px; }
    .invoice-meta p { font-size: 13px; color: #6b7280; }
    .divider { border: none; border-top: 2px solid #e5e7eb; margin: 24px 0; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 32px; }
    .info-box label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; display: block; margin-bottom: 4px; }
    .info-box p { font-size: 15px; font-weight: 600; color: #111; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 24px; }
    thead tr { background: #f3f4f6; }
    th { text-align: left; padding: 10px 12px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; border-bottom: 2px solid #e5e7eb; }
    td { padding: 10px 12px; border-bottom: 1px solid #f3f4f6; color: #374151; }
    tr:last-child td { border-bottom: none; }
    .total-row { background: #eff6ff; }
    .total-row td { padding: 14px 12px; font-weight: 700; font-size: 15px; border-top: 2px solid #bfdbfe; }
    .footer { margin-top: 48px; text-align: center; font-size: 11px; color: #9ca3af; }
    @media print {
      body { padding: 20px; }
      button { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand">${appName}</div>
    <div class="invoice-meta">
      <h2>INVOICE</h2>
      <p>${invoiceNum}</p>
      <p>Issued: ${today}</p>
    </div>
  </div>
  <hr class="divider">
  <div class="info-grid">
    <div class="info-box">
      <label>Invoice To</label>
      <p>${driverName}</p>
    </div>
    <div class="info-box">
      <label>Pay Period</label>
      <p>${monthLabel}</p>
    </div>
    <div class="info-box">
      <label>Total Days Worked</label>
      <p>${monthlyReports.length} day${monthlyReports.length !== 1 ? 's' : ''}</p>
    </div>
    <div class="info-box">
      <label>Total Parcels Delivered</label>
      <p>${monthlyDelivered} parcels</p>
    </div>
  </div>
  <hr class="divider">
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Route</th>
        <th>Taken</th>
        <th>Delivered</th>
        <th>Failed</th>
        <th>Pay</th>
        <th>Pay Type</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
      <tr class="total-row">
        <td colspan="5" style="text-align:right">Total Earnings</td>
        <td style="color:#1d4ed8">£${monthlyPay}</td>
        <td></td>
      </tr>
    </tbody>
  </table>
  <div style="font-size:12px;color:#6b7280;margin-top:8px">
    <strong>Pay rates:</strong> £1 per delivery if ≥100 delivered. £100 flat rate if &lt;100 delivered.
  </div>
  <div class="footer">Generated by ${appName} · ${today}</div>
  <script>window.onload = function() { window.print(); }<\/script>
</body>
</html>`

    const w = window.open('', '_blank')
    if (w) { w.document.write(html); w.document.close() }
  }

  const driverMap = Object.fromEntries(drivers.map(d => [d.id, d.name]))
  const routeNumberMap = Object.fromEntries(routes.map(r => [r.id, r.route_number ?? null]))
  const routeNameMap = Object.fromEntries(routes.map(r => [r.id, r.name]))

  const filtered = liveReports.filter(r => {
    if (filterDriver !== 'all' && r.driver_id !== filterDriver) return false
    if (filterDate && r.date !== filterDate) return false
    return true
  })

  // Pay period end date (start + 27 days = 28-day window)
  const payPeriodEnd = (() => {
    const d = new Date(payPeriodStart)
    d.setDate(d.getDate() + 27)
    return d.toISOString().split('T')[0]
  })()

  const payPeriodLabel = `${new Date(payPeriodStart).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} – ${new Date(payPeriodEnd).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`

  // Monthly filtered (28-day pay period)
  const monthlyReports = liveReports.filter(r => {
    if (filterDriver === 'all') return false
    if (r.driver_id !== filterDriver) return false
    return r.date >= payPeriodStart && r.date <= payPeriodEnd
  })

  const monthlyTaken = monthlyReports.reduce((s, r) => s + r.parcels_taken, 0)
  const monthlyDelivered = monthlyReports.reduce((s, r) => s + r.parcels_delivered, 0)
  const monthlyFailed = monthlyReports.reduce((s, r) => s + r.parcels_failed, 0)
  const monthlyRate = monthlyTaken > 0 ? Math.round((monthlyDelivered / monthlyTaken) * 100) : 0
  const monthlyPay = monthlyReports.reduce((s, r) => s + calcPay(r.parcels_delivered), 0)
  const bestDay = monthlyReports.length > 0 ? [...monthlyReports].sort((a, b) => b.parcels_delivered - a.parcels_delivered)[0] : null

  // Summary stats
  const totalTaken = filtered.reduce((s, r) => s + r.parcels_taken, 0)
  const totalDelivered = filtered.reduce((s, r) => s + r.parcels_delivered, 0)
  const totalFailed = filtered.reduce((s, r) => s + r.parcels_failed, 0)
  const successRate = totalTaken > 0 ? Math.round((totalDelivered / totalTaken) * 100) : 0

  return (
    <div>
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Daily Reports</h1>
          <p className="text-gray-500 mt-1">Driver delivery summaries by day</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setView('daily')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${view === 'daily' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}>Daily View</button>
          <button onClick={() => setView('monthly')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${view === 'monthly' ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'}`}>Monthly View</button>
        </div>
      </div>

      {/* Monthly View */}
      {view === 'monthly' && (
        <div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-6 flex gap-4 flex-wrap items-end">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500">Select Driver</label>
              <select className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" value={filterDriver} onChange={e => setFilterDriver(e.target.value)}>
                <option value="all">Choose driver...</option>
                {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500">Pay Period Start (Cut Day)</label>
              <input
                type="date"
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={payPeriodStart}
                onChange={e => setPayPeriodStart(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500">Pay Period End</label>
              <div className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-600 min-w-[120px]">
                {new Date(payPeriodEnd).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500 opacity-0">Reset</label>
              <button
                onClick={() => {
                  const d = new Date(); d.setDate(d.getDate() - 27)
                  setPayPeriodStart(d.toISOString().split('T')[0])
                }}
                className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Reset to last 28 days
              </button>
            </div>
          </div>

          {filterDriver !== 'all' && monthlyReports.length > 0 && (
            <div className="flex justify-end mb-4">
              <button
                onClick={generateInvoice}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors shadow-sm"
              >
                <FileText size={15} />
                Download Invoice
              </button>
            </div>
          )}

          {filterDriver === 'all' ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">Select a driver above to see their pay period summary.</div>
          ) : monthlyReports.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">No reports found for this driver in the period {payPeriodLabel}.</div>
          ) : (
            <div>
              {/* Monthly stats */}
              <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
                {[
                  { label: 'Days Worked', value: monthlyReports.length, color: 'blue' },
                  { label: 'Parcels Taken', value: monthlyTaken, color: 'gray' },
                  { label: 'Delivered', value: monthlyDelivered, color: 'green' },
                  { label: 'Failed', value: monthlyFailed, color: 'red' },
                  { label: 'Success Rate', value: `${monthlyRate}%`, color: 'purple' },
                  { label: 'Est. Pay', value: `£${monthlyPay}`, color: 'amber' },
                ].map(({ label, value, color }) => (
                  <div key={label} className={`rounded-xl border shadow-sm p-4 ${color === 'amber' ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-200'}`}>
                    <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
                    <p className={`text-2xl font-bold ${color === 'green' ? 'text-green-600' : color === 'red' ? 'text-red-500' : color === 'purple' ? 'text-purple-600' : color === 'blue' ? 'text-blue-600' : color === 'amber' ? 'text-amber-700' : 'text-gray-900'}`}>{value}</p>
                  </div>
                ))}
              </div>

              {/* Monthly AI Summary */}
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-4 mb-6 text-white">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles size={16} />
                  <span className="font-semibold text-sm">Pay Period Summary — {driverMap[filterDriver]} · {payPeriodLabel}</span>
                </div>
                <p className="text-sm text-blue-50 leading-relaxed">{generateMonthlySummary()}</p>
              </div>

              {/* Best day */}
              {bestDay && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
                  <p className="text-sm font-semibold text-green-800">Best Day: {new Date(bestDay.date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
                  <p className="text-sm text-green-700">{bestDay.parcels_delivered} delivered out of {bestDay.parcels_taken} taken — {bestDay.parcels_taken > 0 ? Math.round((bestDay.parcels_delivered / bestDay.parcels_taken) * 100) : 0}% success rate</p>
                </div>
              )}

              {/* Day by day table */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100">
                  <h3 className="font-semibold text-gray-900 text-sm">Day-by-Day Breakdown — {driverMap[filterDriver]} · {payPeriodLabel}</h3>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      {['Date', 'Route No.', 'Taken', 'Delivered', 'Failed', 'Rate', 'Pay', 'Notes'].map(h => (
                        <th key={h} className="text-left px-4 py-3 font-medium text-gray-600">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {[...monthlyReports].sort((a, b) => a.date.localeCompare(b.date)).map(r => {
                      const rate = r.parcels_taken > 0 ? Math.round((r.parcels_delivered / r.parcels_taken) * 100) : 0
                      const routeNum = r.route_id ? routeNumberMap[r.route_id] : r.notes?.match(/^\[Route: (.+?)\]/)?.[1] ?? null
                      return (
                        <tr key={r.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900">{new Date(r.date).toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' })}</td>
                          <td className="px-4 py-3">{routeNum ? <span className="text-xs font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{routeNum}</span> : <span className="text-gray-400">—</span>}</td>
                          <td className="px-4 py-3 font-semibold text-gray-900">{r.parcels_taken}</td>
                          <td className="px-4 py-3 font-semibold text-green-600">{r.parcels_delivered}</td>
                          <td className="px-4 py-3 font-semibold text-red-500">{r.parcels_failed}</td>
                          <td className="px-4 py-3"><span className={`text-xs font-bold px-2 py-0.5 rounded-full ${rate >= 90 ? 'bg-green-100 text-green-700' : rate >= 75 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-600'}`}>{rate}%</span></td>
                          <td className="px-4 py-3">
                            <span className={`text-sm font-bold ${r.parcels_delivered >= 100 ? 'text-green-600' : 'text-amber-600'}`}>£{calcPay(r.parcels_delivered)}</span>
                            <span className="text-xs text-gray-400 ml-1">{r.parcels_delivered >= 100 ? '(per delivery)' : '(flat rate)'}</span>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500">{r.notes?.replace(/^\[Route: .+?\]\s*/, '') || '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {view === 'daily' && (
      <div>
      {/* AI Summary */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-4 mb-6 text-white">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Sparkles size={18} />
            <span className="font-semibold text-sm">Daily Summary</span>
          </div>
          <button
            onClick={generateSummary}
            disabled={aiLoading}
            className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60"
          >
            {aiLoading ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
            {aiLoading ? 'Loading...' : 'Generate Summary'}
          </button>
        </div>
        {aiSummary ? (
          <p className="text-sm text-blue-50 leading-relaxed">{aiSummary}</p>
        ) : (
          <p className="text-sm text-blue-200">Click "Generate Summary" to see today's performance breakdown.</p>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Parcels Taken', value: totalTaken, icon: Package, color: 'blue' },
          { label: 'Delivered', value: totalDelivered, icon: TrendingUp, color: 'green' },
          { label: 'Unsuccessful', value: totalFailed, icon: TrendingDown, color: 'red' },
          { label: 'Success Rate', value: `${successRate}%`, icon: ClipboardList, color: 'purple' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-gray-500">{label}</span>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center
                ${color === 'blue' ? 'bg-blue-50 text-blue-600' : ''}
                ${color === 'green' ? 'bg-green-50 text-green-600' : ''}
                ${color === 'red' ? 'bg-red-50 text-red-600' : ''}
                ${color === 'purple' ? 'bg-purple-50 text-purple-600' : ''}
              `}>
                <Icon size={16} />
              </div>
            </div>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-4 flex gap-4 flex-wrap">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500">Filter by Driver</label>
          <select
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={filterDriver}
            onChange={e => setFilterDriver(e.target.value)}
          >
            <option value="all">All Drivers</option>
            {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-gray-500">Filter by Date</label>
          <input
            type="date"
            className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={filterDate}
            onChange={e => setFilterDate(e.target.value)}
          />
        </div>
        {(filterDriver !== 'all' || filterDate) && (
          <div className="flex items-end">
            <button
              onClick={() => { setFilterDriver('all'); setFilterDate('') }}
              className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-800 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Date', 'Driver', 'Route No.', 'Taken', 'Delivered', 'Failed', 'Rate', 'Pay', 'Notes'].map(h => (
                <th key={h} className="text-left px-4 py-3 font-medium text-gray-600">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-12 text-gray-400">
                  No reports yet. Drivers submit reports from their app.
                </td>
              </tr>
            )}
            {filtered.map(report => {
              const rate = report.parcels_taken > 0
                ? Math.round((report.parcels_delivered / report.parcels_taken) * 100)
                : 0
              return (
                <tr key={report.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {new Date(report.date).toLocaleDateString('en-GB', {
                      day: '2-digit', month: 'short', year: 'numeric'
                    })}
                  </td>
                  <td className="px-4 py-3 font-semibold text-gray-900">{driverMap[report.driver_id] ?? '—'}</td>
                  <td className="px-4 py-3">
                    {(() => {
                      const routeNum = report.route_id
                        ? routeNumberMap[report.route_id]
                        : report.notes?.match(/^\[Route: (.+?)\]/)?.[1] ?? null
                      return routeNum
                        ? <span className="text-xs font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{routeNum}</span>
                        : <span className="text-gray-400">—</span>
                    })()}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-semibold text-gray-900">{report.parcels_taken}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-semibold text-green-600">{report.parcels_delivered}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-semibold text-red-500">{report.parcels_failed}</span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      value={rate >= 90 ? 'completed' : rate >= 70 ? 'in_progress' : 'failed'}
                      label={`${rate}%`}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-sm font-bold ${report.parcels_delivered >= 100 ? 'text-green-600' : 'text-amber-600'}`}>£{calcPay(report.parcels_delivered)}</span>
                    <div className="text-xs text-gray-400">{report.parcels_delivered >= 100 ? 'per delivery' : 'flat rate'}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate">
                    {report.notes?.replace(/^\[Route: .+?\]\s*/, '') || '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        </div>
      </div>
      </div>
      )}
    </div>
  )
}
