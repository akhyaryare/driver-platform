import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const caller = await createClient()
  const { data: { user }, error: authError } = await caller.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: profile, error: profileError } = await caller
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profileError || profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date') || new Date().toISOString().split('T')[0]

  const supabase = createAdminClient()

  const { data: reports } = await supabase
    .from('delivery_reports')
    .select('*, drivers(name)')
    .eq('date', date)

  if (!reports || reports.length === 0) {
    return NextResponse.json({ summary: null })
  }

  const totalTaken = reports.reduce((s, r) => s + r.parcels_taken, 0)
  const totalDelivered = reports.reduce((s, r) => s + r.parcels_delivered, 0)
  const totalFailed = reports.reduce((s, r) => s + r.parcels_failed, 0)
  const rate = totalTaken > 0 ? Math.round((totalDelivered / totalTaken) * 100) : 0

  const sorted = [...reports].sort((a, b) => b.parcels_delivered - a.parcels_delivered)
  const mvp = sorted[0]
  const mvpName = (mvp as any)?.drivers?.name ?? 'Unknown'
  const worstDriver = sorted[sorted.length - 1]
  const worstName = (worstDriver as any)?.drivers?.name ?? 'Unknown'

  const formattedDate = new Date(date).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

  let sentence1 = `On ${formattedDate}, ${reports.length} driver${reports.length > 1 ? 's' : ''} completed their routes with a ${rate}% success rate — ${totalDelivered} out of ${totalTaken} parcels delivered.`

  let sentence2 = `${mvpName} was the top performer today, delivering ${mvp.parcels_delivered} parcels`
  if (reports.length > 1) {
    sentence2 += `, with ${worstName} completing ${worstDriver.parcels_delivered} deliveries.`
  } else {
    sentence2 += '.'
  }

  let sentence3 = ''
  if (totalFailed === 0) {
    sentence3 = 'Outstanding performance — no failed deliveries today.'
  } else if (rate >= 95) {
    sentence3 = `Only ${totalFailed} unsuccessful deliveries — an excellent day for the fleet.`
  } else if (rate >= 85) {
    sentence3 = `${totalFailed} parcels were unsuccessful — within acceptable range, but worth reviewing tomorrow.`
  } else {
    sentence3 = `${totalFailed} parcels were unsuccessful — this is above average and should be reviewed with the drivers.`
  }

  const summary = `${sentence1} ${sentence2} ${sentence3}`

  return NextResponse.json({ summary, stats: { totalTaken, totalDelivered, totalFailed, rate, drivers: reports.length } })
}
