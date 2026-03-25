'use client'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MapPin, Navigation, MessageCircle, LogOut, Wifi, WifiOff } from 'lucide-react'

type Driver = { id: string; name: string; status: string; vehicle_plate: string | null }
type Assignment = {
  id: string
  status: string
  date: string
  routes: { id: string; name: string; description: string | null; waypoints: unknown } | null
}
type Group = { id: string; name: string; link: string }

export function DriverView({
  driver,
  assignments,
  groups,
}: {
  driver: Driver | null
  assignments: Assignment[]
  groups: Group[]
}) {
  const [tracking, setTracking] = useState(false)
  const [gpsError, setGpsError] = useState<string | null>(null)
  const [lastUpdate, setLastUpdate] = useState<string | null>(null)
  const watchId = useRef<number | null>(null)
  const router = useRouter()
  const supabase = createClient()

  async function startTracking() {
    if (!driver) return
    if (!('geolocation' in navigator)) {
      setGpsError('GPS not supported on this device.')
      return
    }

    setGpsError(null)
    setTracking(true)

    // Update driver status to on_route
    await supabase.from('drivers').update({ status: 'on_route' }).eq('id', driver.id)

    watchId.current = navigator.geolocation.watchPosition(
      async (position) => {
        const { coords } = position
        await supabase.from('driver_locations').insert({
          driver_id: driver.id,
          lat: coords.latitude,
          lng: coords.longitude,
          accuracy: coords.accuracy,
          heading: coords.heading ?? null,
          speed: coords.speed ? coords.speed * 3.6 : null, // m/s → km/h
        })
        setLastUpdate(new Date().toLocaleTimeString('en-GB'))
      },
      (err) => {
        setGpsError(err.message)
        setTracking(false)
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 10000,
      }
    )
  }

  async function stopTracking() {
    if (watchId.current !== null) {
      navigator.geolocation.clearWatch(watchId.current)
      watchId.current = null
    }
    setTracking(false)
    if (driver) {
      await supabase.from('drivers').update({ status: 'active' }).eq('id', driver.id)
    }
  }

  useEffect(() => {
    return () => {
      if (watchId.current !== null) {
        navigator.geolocation.clearWatch(watchId.current)
      }
    }
  }, [])

  async function handleLogout() {
    await stopTracking()
    await supabase.auth.signOut()
    router.push('/login')
  }

  async function updateAssignmentStatus(assignmentId: string, status: 'in_progress' | 'completed') {
    await supabase.from('driver_routes').update({ status }).eq('id', assignmentId)
    router.refresh()
  }

  if (!driver) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-gray-200 max-w-sm w-full">
          <MapPin size={40} className="mx-auto text-gray-300 mb-3" />
          <h2 className="font-semibold text-gray-900 mb-2">Account Not Linked</h2>
          <p className="text-sm text-gray-500">Your account hasn&apos;t been linked to a driver profile yet. Contact your administrator.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center">
            <Navigation size={18} className="text-white" />
          </div>
          <div>
            <p className="font-semibold text-gray-900 text-sm">{driver.name}</p>
            <p className="text-xs text-gray-500">{driver.vehicle_plate ?? 'No vehicle'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge value={driver.status} />
          <button onClick={handleLogout} className="text-gray-400 hover:text-gray-600 p-1">
            <LogOut size={18} />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4 max-w-lg mx-auto">
        {/* GPS Tracking Card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <MapPin size={18} className="text-blue-600" />
            <h2 className="font-semibold text-gray-900">Location Sharing</h2>
          </div>

          <div className="flex items-center gap-3 mb-4">
            <div className={`flex items-center gap-1.5 text-sm ${tracking ? 'text-green-600' : 'text-gray-400'}`}>
              {tracking ? <Wifi size={16} /> : <WifiOff size={16} />}
              {tracking ? 'Live — sharing location' : 'Not sharing'}
            </div>
            {lastUpdate && tracking && (
              <span className="text-xs text-gray-400">Last: {lastUpdate}</span>
            )}
          </div>

          {gpsError && (
            <div className="bg-red-50 text-red-700 text-sm px-3 py-2 rounded-lg mb-3">{gpsError}</div>
          )}

          {tracking ? (
            <Button variant="danger" onClick={stopTracking} className="w-full">
              Stop Sharing Location
            </Button>
          ) : (
            <Button onClick={startTracking} className="w-full">
              <Navigation size={16} />
              Start Sharing Location
            </Button>
          )}
        </div>

        {/* Today's Routes */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <h2 className="font-semibold text-gray-900 mb-3">
            Today&apos;s Routes
            {assignments.length > 0 && (
              <span className="ml-2 text-xs font-normal text-gray-500">({assignments.length})</span>
            )}
          </h2>

          {assignments.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">No routes assigned for today.</p>
          ) : (
            <div className="space-y-3">
              {assignments.map(a => (
                <div key={a.id} className="border border-gray-100 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="font-medium text-sm text-gray-900">{a.routes?.name ?? 'Unknown Route'}</p>
                    <Badge value={a.status} />
                  </div>
                  {a.routes?.description && (
                    <p className="text-xs text-gray-500 mb-2">{a.routes.description}</p>
                  )}
                  <div className="flex gap-2">
                    {a.status === 'pending' && (
                      <Button size="sm" onClick={() => updateAssignmentStatus(a.id, 'in_progress')} className="flex-1">
                        Start Route
                      </Button>
                    )}
                    {a.status === 'in_progress' && (
                      <Button size="sm" variant="secondary" onClick={() => updateAssignmentStatus(a.id, 'completed')} className="flex-1">
                        Mark Complete
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* WhatsApp Groups */}
        {groups.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
            <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <MessageCircle size={18} className="text-green-600" />
              Group Chats
            </h2>
            <div className="space-y-2">
              {groups.map(group => (
                <a
                  key={group.id}
                  href={group.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 px-3 py-2.5 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
                >
                  <MessageCircle size={16} className="text-green-600 flex-shrink-0" />
                  <span className="text-sm font-medium text-green-800">{group.name}</span>
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
