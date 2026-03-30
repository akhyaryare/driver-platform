'use client'
import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { Plus, Pencil, Trash2, MapPin, X, ListOrdered, Loader2, ChevronUp, ChevronDown } from 'lucide-react'

type Route = {
  id: string
  name: string
  route_number: string | null
  description: string | null
  status: 'active' | 'inactive'
  created_at: string
}

type Stop = {
  id: string
  route_id: string
  postcode: string
  label: string | null
  order_index: number
}

type Suggestion = {
  postcode: string
  area: string
}

const emptyForm = { name: '', route_number: '', description: '', status: 'active' as 'active' | 'inactive' }

async function lookupPostcode(postcode: string): Promise<string> {
  try {
    const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode.replace(/\s/g, ''))}`)
    if (!res.ok) return ''
    const json = await res.json()
    const r = json.result
    return [r.admin_ward, r.admin_district, r.admin_county].filter(Boolean).join(', ')
  } catch { return '' }
}

async function autocompletePostcode(query: string): Promise<Suggestion[]> {
  if (query.length < 2) return []
  try {
    const res = await fetch(`https://api.postcodes.io/postcodes?q=${encodeURIComponent(query)}&limit=8`)
    if (!res.ok) return []
    const json = await res.json()
    return (json.result ?? []).map((r: any) => ({
      postcode: r.postcode,
      area: [r.admin_ward, r.admin_district].filter(Boolean).join(', '),
    }))
  } catch { return [] }
}

export function RoutesClient({ routes: initial }: { routes: Route[] }) {
  const [routes, setRoutes] = useState(initial)
  const [modal, setModal] = useState<'create' | 'edit' | 'stops' | null>(null)
  const [selected, setSelected] = useState<Route | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [stops, setStops] = useState<Stop[]>([])
  const [stopsLoading, setStopsLoading] = useState(false)
  const [newPostcode, setNewPostcode] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [suggestLoading, setSuggestLoading] = useState(false)
  const [bulkText, setBulkText] = useState('')
  const [bulkMode, setBulkMode] = useState(false)
  const [bulkLoading, setBulkLoading] = useState(false)
  const suggestTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const router = useRouter()
  const supabase = createClient()

  function openCreate() { setForm(emptyForm); setError(''); setModal('create') }

  function openEdit(route: Route) {
    setSelected(route)
    setForm({ name: route.name, route_number: route.route_number ?? '', description: route.description ?? '', status: route.status })
    setError(''); setModal('edit')
  }

  async function openStops(route: Route) {
    setSelected(route)
    setModal('stops')
    setNewPostcode(''); setNewLabel(''); setBulkText(''); setBulkMode(false); setSuggestions([])
    setStopsLoading(true)
    const { data } = await supabase.from('route_stops').select('*').eq('route_id', route.id).order('order_index')
    setStops(data ?? [])
    setStopsLoading(false)
  }

  async function handleCreate() {
    setLoading(true); setError('')
    const { data, error } = await supabase.from('routes').insert({ name: form.name, route_number: form.route_number || null, description: form.description || null, status: form.status }).select().single()
    setLoading(false)
    if (error) { setError(error.message); return }
    setRoutes(prev => [data as Route, ...prev]); setModal(null); router.refresh()
  }

  async function handleEdit() {
    if (!selected) return
    setLoading(true); setError('')
    const { data, error } = await supabase.from('routes').update({ name: form.name, route_number: form.route_number || null, description: form.description || null, status: form.status }).eq('id', selected.id).select().single()
    setLoading(false)
    if (error) { setError(error.message); return }
    setRoutes(prev => prev.map(r => r.id === selected.id ? data as Route : r)); setModal(null)
  }

  async function handleDelete(route: Route) {
    if (!confirm(`Delete route "${route.name}"? This will also remove all its postcodes.`)) return
    const { error } = await supabase.from('routes').delete().eq('id', route.id)
    if (!error) setRoutes(prev => prev.filter(r => r.id !== route.id))
  }

  // Postcode input change → debounced autocomplete
  function onPostcodeChange(val: string) {
    setNewPostcode(val.toUpperCase())
    setSuggestions([])
    if (suggestTimer.current) clearTimeout(suggestTimer.current)
    if (val.trim().length < 2) return
    setSuggestLoading(true)
    suggestTimer.current = setTimeout(async () => {
      const results = await autocompletePostcode(val)
      setSuggestions(results)
      setSuggestLoading(false)
    }, 300)
  }

  async function selectSuggestion(s: Suggestion) {
    setSuggestions([])
    setNewPostcode(s.postcode)
    setNewLabel(s.area)
  }

  async function addStop() {
    if (!selected || !newPostcode.trim()) return
    const postcode = newPostcode.trim().toUpperCase()
    let label = newLabel.trim()
    if (!label) label = await lookupPostcode(postcode)
    const nextIndex = stops.length
    const { data, error } = await supabase.from('route_stops').insert({ route_id: selected.id, postcode, label: label || null, order_index: nextIndex }).select().single()
    if (!error && data) {
      setStops(prev => [...prev, data as Stop])
      setNewPostcode(''); setNewLabel(''); setSuggestions([])
    }
  }

  async function addBulkStops() {
    if (!selected || !bulkText.trim()) return
    setBulkLoading(true)
    const lines = bulkText.split(/[\n,]+/).map(p => p.trim().toUpperCase()).filter(p => p.length > 0)

    // Look up area for each postcode
    const inserts = await Promise.all(
      lines.map(async (postcode, i) => {
        const area = await lookupPostcode(postcode)
        return { route_id: selected.id, postcode, label: area || null, order_index: stops.length + i }
      })
    )

    const { data, error } = await supabase.from('route_stops').insert(inserts).select()
    setBulkLoading(false)
    if (!error && data) {
      setStops(prev => [...prev, ...(data as Stop[])])
      setBulkText(''); setBulkMode(false)
    }
  }

  async function removeStop(stop: Stop) {
    await supabase.from('route_stops').delete().eq('id', stop.id)
    setStops(prev => prev.filter(s => s.id !== stop.id))
  }

  async function moveStop(index: number, direction: 'up' | 'down') {
    const newStops = [...stops]
    const swapIndex = direction === 'up' ? index - 1 : index + 1
    if (swapIndex < 0 || swapIndex >= newStops.length) return
    ;[newStops[index], newStops[swapIndex]] = [newStops[swapIndex], newStops[index]]
    const updated = newStops.map((s, i) => ({ ...s, order_index: i }))
    setStops(updated)
    await Promise.all([
      supabase.from('route_stops').update({ order_index: updated[index].order_index }).eq('id', updated[index].id),
      supabase.from('route_stops').update({ order_index: updated[swapIndex].order_index }).eq('id', updated[swapIndex].id),
    ])
  }

  const f = (field: keyof typeof form, value: string) => setForm(prev => ({ ...prev, [field]: value }))

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Routes</h1>
          <p className="text-gray-500 mt-1">{routes.length} routes configured</p>
        </div>
        <Button onClick={openCreate}><Plus size={16} /> Add Route</Button>
      </div>

      {routes.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
          <MapPin size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">No routes yet. Add your first route.</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {routes.map(route => (
          <div key={route.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                {route.route_number && (
                  <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded mb-1 inline-block">{route.route_number}</span>
                )}
                <h3 className="font-semibold text-gray-900">{route.name}</h3>
                {route.description && <p className="text-xs text-gray-500 mt-0.5">{route.description}</p>}
              </div>
              <Badge value={route.status} />
            </div>
            <div className="flex gap-2 mt-4">
              <Button size="sm" className="flex-1" onClick={() => openStops(route)}>
                <ListOrdered size={14} /> Postcodes
              </Button>
              <Button variant="ghost" size="sm" onClick={() => openEdit(route)}><Pencil size={14} /></Button>
              <Button variant="ghost" size="sm" onClick={() => handleDelete(route)}><Trash2 size={14} className="text-red-500" /></Button>
            </div>
          </div>
        ))}
      </div>

      {/* Create / Edit Modal */}
      <Modal open={modal === 'create' || modal === 'edit'} onClose={() => setModal(null)} title={modal === 'create' ? 'Add Route' : 'Edit Route'}>
        <div className="space-y-4">
          <Input label="Route Name" value={form.name} onChange={e => f('name', e.target.value)} placeholder="e.g. North London" required />
          <Input label="Route Number" value={form.route_number} onChange={e => f('route_number', e.target.value)} placeholder="e.g. RT-001" />
          <Input label="Description (optional)" value={form.description} onChange={e => f('description', e.target.value)} placeholder="e.g. Morning shift route" />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Status</label>
            <select className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" value={form.status} onChange={e => f('status', e.target.value)}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={() => setModal(null)} className="flex-1">Cancel</Button>
            <Button onClick={modal === 'create' ? handleCreate : handleEdit} loading={loading} className="flex-1">
              {modal === 'create' ? 'Create Route' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Postcodes Modal */}
      <Modal open={modal === 'stops'} onClose={() => setModal(null)} title={`Postcodes — ${selected?.route_number ? `${selected.route_number} ` : ''}${selected?.name ?? ''}`}>
        <div className="space-y-4">
          <div className="flex gap-2">
            <button onClick={() => setBulkMode(false)} className={`flex-1 py-1.5 text-sm rounded-lg border font-medium transition-colors ${!bulkMode ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300'}`}>
              Add One
            </button>
            <button onClick={() => setBulkMode(true)} className={`flex-1 py-1.5 text-sm rounded-lg border font-medium transition-colors ${bulkMode ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300'}`}>
              Paste List
            </button>
          </div>

          {bulkMode ? (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Paste postcodes — one per line or comma separated</label>
              <p className="text-xs text-gray-400">Area names will be looked up automatically for each postcode</p>
              <textarea
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none font-mono text-gray-900"
                rows={6}
                placeholder={"SL1 5BS\nSL2 1AB\nSL3 7CD"}
                value={bulkText}
                onChange={e => setBulkText(e.target.value)}
              />
              <Button onClick={addBulkStops} className="w-full" disabled={!bulkText.trim()} loading={bulkLoading}>
                {bulkLoading ? 'Looking up areas...' : 'Add All Postcodes'}
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="relative">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono uppercase text-gray-900"
                      placeholder="Type postcode e.g. SL1 5BS"
                      value={newPostcode}
                      onChange={e => onPostcodeChange(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addStop()}
                      autoComplete="off"
                    />
                    {suggestLoading && (
                      <Loader2 size={14} className="absolute right-3 top-3 text-gray-400 animate-spin" />
                    )}
                  </div>
                  <Button onClick={addStop} disabled={!newPostcode.trim()}>
                    <Plus size={16} />
                  </Button>
                </div>

                {/* Autocomplete dropdown */}
                {suggestions.length > 0 && (
                  <div className="absolute z-10 left-0 right-10 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                    {suggestions.map(s => (
                      <button
                        key={s.postcode}
                        onClick={() => selectSuggestion(s)}
                        className="w-full flex items-center justify-between px-3 py-2 hover:bg-blue-50 text-left transition-colors"
                      >
                        <span className="font-mono text-sm font-semibold text-gray-900">{s.postcode}</span>
                        <span className="text-xs text-gray-500">{s.area}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {newLabel && (
                <p className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
                  Area: {newLabel}
                </p>
              )}
            </div>
          )}

          {/* Stops list */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-3 py-2 text-xs font-medium text-gray-500 border-b border-gray-200">
              {stops.length} postcode{stops.length !== 1 ? 's' : ''} on this route
            </div>
            {stopsLoading ? (
              <div className="py-6 text-center text-sm text-gray-400 flex items-center justify-center gap-2">
                <Loader2 size={14} className="animate-spin" /> Loading...
              </div>
            ) : stops.length === 0 ? (
              <div className="py-6 text-center text-sm text-gray-400">No postcodes yet</div>
            ) : (
              <div className="divide-y divide-gray-100 max-h-64 overflow-y-auto">
                {stops.map((stop, i) => (
                  <div key={stop.id} className="flex items-center gap-2 px-3 py-2">
                    <div className="flex flex-col flex-shrink-0">
                      <button onClick={() => moveStop(i, 'up')} disabled={i === 0} className="text-gray-300 hover:text-blue-500 disabled:opacity-20 transition-colors">
                        <ChevronUp size={14} />
                      </button>
                      <button onClick={() => moveStop(i, 'down')} disabled={i === stops.length - 1} className="text-gray-300 hover:text-blue-500 disabled:opacity-20 transition-colors">
                        <ChevronDown size={14} />
                      </button>
                    </div>
                    <span className="text-xs font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded w-6 text-center flex-shrink-0">{i + 1}</span>
                    <span className="font-mono text-sm font-semibold text-gray-900 w-24 flex-shrink-0">{stop.postcode}</span>
                    <span className="text-xs text-gray-500 flex-1 truncate">{stop.label ?? ''}</span>
                    <button onClick={() => removeStop(stop)} className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0">
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Button variant="secondary" onClick={() => setModal(null)} className="w-full">Done</Button>
        </div>
      </Modal>
    </div>
  )
}
