import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DriverView } from './driver-view'

export const dynamic = 'force-dynamic'

export default async function DriverPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Get driver record linked to this user
  const { data: driver } = await supabase
    .from('drivers')
    .select('id, name, status, vehicle_plate')
    .eq('profile_id', user.id)
    .single()

  // Get today's assignments
  const today = new Date().toISOString().split('T')[0]
  const { data: assignments } = driver
    ? await supabase
        .from('driver_routes')
        .select('id, status, date, routes(id, name, description, waypoints)')
        .eq('driver_id', driver.id)
        .eq('date', today)
    : { data: [] }

  // Get WhatsApp groups
  const { data: groups } = await supabase
    .from('whatsapp_groups')
    .select('id, name, link')
    .eq('active', true)

  return (
    <DriverView
      driver={driver ?? null}
      assignments={assignments ?? []}
      groups={groups ?? []}
    />
  )
}
