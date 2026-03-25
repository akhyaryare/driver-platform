import { createClient } from '@/lib/supabase/server'
import { TrackingMap } from './tracking-map'

export default async function TrackingPage() {
  const supabase = await createClient()

  const { data: drivers } = await supabase
    .from('drivers')
    .select('id, name, status, vehicle_plate')
    .order('name')

  return (
    <div className="h-full">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Live Tracking</h1>
        <p className="text-gray-500 mt-1">Real-time driver locations</p>
      </div>
      <TrackingMap drivers={drivers ?? []} />
    </div>
  )
}
