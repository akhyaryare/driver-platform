'use client'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Badge } from '@/components/ui/badge'
import { Navigation, Clock } from 'lucide-react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

type DriverInfo = {
  id: string
  name: string
  status: string
  vehicle_plate: string | null
}

type DriverLocation = {
  driver_id: string
  driver_name: string
  driver_status: string
  lat: number
  lng: number
  heading: number | null
  speed: number | null
  recorded_at: string
}

export function TrackingMap({ drivers }: { drivers: DriverInfo[] }) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<mapboxgl.Map | null>(null)
  const markers = useRef<Record<string, mapboxgl.Marker>>({})
  const [locations, setLocations] = useState<Record<string, DriverLocation>>({})
  const [selectedDriver, setSelectedDriver] = useState<string | null>(null)
  const supabase = createClient()

  // Init map
  useEffect(() => {
    if (!mapContainer.current || map.current) return
    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [-0.1276, 51.5074], // Default: London
      zoom: 10,
    })

    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right')

    return () => {
      map.current?.remove()
      map.current = null
    }
  }, [])

  // Load initial locations
  useEffect(() => {
    async function fetchLocations() {
      const { data } = await supabase.from('driver_latest_locations').select('*')
      if (!data) return
      const map: Record<string, DriverLocation> = {}
      data.forEach(loc => { map[loc.driver_id] = loc as DriverLocation })
      setLocations(map)
    }
    fetchLocations()
  }, [])

  // Subscribe to realtime location updates
  useEffect(() => {
    const channel = supabase
      .channel('driver-locations')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'driver_locations' },
        async (payload) => {
          const loc = payload.new as { driver_id: string; lat: number; lng: number; heading: number | null; speed: number | null; recorded_at: string }
          const driver = drivers.find(d => d.id === loc.driver_id)
          if (!driver) return

          const newLoc: DriverLocation = {
            driver_id: loc.driver_id,
            driver_name: driver.name,
            driver_status: driver.status,
            lat: loc.lat,
            lng: loc.lng,
            heading: loc.heading,
            speed: loc.speed,
            recorded_at: loc.recorded_at,
          }
          setLocations(prev => ({ ...prev, [loc.driver_id]: newLoc }))
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [drivers])

  // Update markers on map
  useEffect(() => {
    if (!map.current) return
    Object.values(locations).forEach(loc => {
      const lngLat: [number, number] = [loc.lng, loc.lat]

      if (markers.current[loc.driver_id]) {
        markers.current[loc.driver_id].setLngLat(lngLat)
      } else {
        const el = document.createElement('div')
        el.className = 'driver-marker'
        el.innerHTML = `
          <div style="
            width: 36px; height: 36px; border-radius: 50%;
            background: #2563eb; border: 3px solid white;
            box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            display: flex; align-items: center; justify-content: center;
            cursor: pointer; transition: transform 0.2s;
          ">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
              <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9L18.4 10 16.7 6.4C16.3 5.5 15.4 5 14.5 5H5c-1.1 0-2 .9-2 2v10h2c0 1.7 1.3 3 3 3s3-1.3 3-3h4c0 1.7 1.3 3 3 3s3-1.3 3-3zm-9 3c-.6 0-1-.4-1-1s.4-1 1-1 1 .4 1 1-.4 1-1 1zm10 0c-.6 0-1-.4-1-1s.4-1 1-1 1 .4 1 1-.4 1-1 1z"/>
            </svg>
          </div>
          <div style="
            position: absolute; bottom: 40px; left: 50%; transform: translateX(-50%);
            background: rgba(0,0,0,0.75); color: white; font-size: 11px; font-weight: 600;
            padding: 2px 6px; border-radius: 4px; white-space: nowrap; pointer-events: none;
          ">${loc.driver_name}</div>
        `
        el.style.position = 'relative'

        const marker = new mapboxgl.Marker({ element: el })
          .setLngLat(lngLat)
          .addTo(map.current!)

        markers.current[loc.driver_id] = marker
      }

      if (loc.heading !== null) {
        const el = markers.current[loc.driver_id].getElement().querySelector('div')
        if (el) el.style.transform = `rotate(${loc.heading}deg)`
      }
    })
  }, [locations])

  function focusDriver(driverId: string) {
    const loc = locations[driverId]
    if (loc && map.current) {
      map.current.flyTo({ center: [loc.lng, loc.lat], zoom: 15, duration: 1000 })
      setSelectedDriver(driverId)
    }
  }

  function formatTime(iso: string) {
    return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  return (
    <div className="flex gap-4" style={{ height: 'calc(100vh - 220px)' }}>
      {/* Driver list panel */}
      <div className="w-64 bg-white rounded-xl border border-gray-200 shadow-sm overflow-y-auto">
        <div className="px-4 py-3 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-700">Drivers ({drivers.length})</p>
        </div>
        <div className="divide-y divide-gray-50">
          {drivers.map(driver => {
            const loc = locations[driver.id]
            const isSelected = selectedDriver === driver.id
            return (
              <button
                key={driver.id}
                onClick={() => focusDriver(driver.id)}
                className={`w-full text-left px-4 py-3 transition-colors hover:bg-gray-50 ${isSelected ? 'bg-blue-50' : ''}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-900 truncate">{driver.name}</span>
                  <Badge value={driver.status} />
                </div>
                {loc ? (
                  <div className="flex items-center gap-1 text-xs text-gray-400">
                    <Clock size={11} />
                    {formatTime(loc.recorded_at)}
                    {loc.speed !== null && (
                      <span className="ml-1">{Math.round(loc.speed)} km/h</span>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-xs text-gray-400">
                    <Navigation size={11} />
                    No location yet
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 rounded-xl overflow-hidden border border-gray-200 shadow-sm">
        <div ref={mapContainer} className="w-full h-full" />
      </div>
    </div>
  )
}
