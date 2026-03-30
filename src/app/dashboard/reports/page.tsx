import { createClient } from '@/lib/supabase/server'
import { ReportsClient } from './reports-client'

export default async function ReportsPage() {
  const supabase = await createClient()

  // Load last 90 days of reports to keep page fast
  const since = new Date()
  since.setDate(since.getDate() - 90)
  const sinceDate = since.toISOString().split('T')[0]

  const { data: reports } = await supabase
    .from('delivery_reports')
    .select('id, date, parcels_taken, parcels_delivered, parcels_failed, notes, created_at, driver_id, route_id')
    .gte('date', sinceDate)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1000)

  const { data: drivers } = await supabase
    .from('drivers')
    .select('id, name')
    .order('name')

  const { data: routes } = await supabase
    .from('routes')
    .select('id, name, route_number')
    .order('name')

  return (
    <ReportsClient
      reports={reports ?? []}
      drivers={drivers ?? []}
      routes={routes ?? []}
    />
  )
}
