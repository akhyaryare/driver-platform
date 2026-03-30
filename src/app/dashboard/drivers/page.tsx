import { createClient } from '@/lib/supabase/server'
import { DriversClient } from './drivers-client'

export default async function DriversPage() {
  const supabase = await createClient()

  const [{ data: drivers }, { data: routes }] = await Promise.all([
    supabase
      .from('drivers')
      .select('id, profile_id, name, phone, email, vehicle_plate, status, created_at, updated_at')
      .order('created_at', { ascending: false })
      .limit(500),
    supabase.from('routes').select('id, name, route_number').eq('status', 'active').limit(500),
  ])

  return <DriversClient drivers={drivers ?? []} routes={routes ?? []} />
}
