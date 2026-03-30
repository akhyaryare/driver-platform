'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { Plus, Pencil, Trash2, UserCheck, Mail } from 'lucide-react'

type Driver = {
  id: string
  name: string
  phone: string
  email: string | null
  vehicle_plate: string | null
  status: 'active' | 'inactive' | 'on_route'
  driver_routes?: { id: string; status: string; date: string; routes: { id: string; name: string } | null }[]
}

type Route = { id: string; name: string; route_number: string | null }

const emptyForm = { name: '', phone: '', email: '', vehicle_plate: '', status: 'active' as 'active' | 'inactive' | 'on_route' }

export function DriversClient({ drivers: initial, routes }: { drivers: Driver[]; routes: Route[] }) {
  const [drivers, setDrivers] = useState(initial)
  const [modal, setModal] = useState<'create' | 'edit' | 'assign' | 'invite' | null>(null)
  const [selected, setSelected] = useState<Driver | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [assignRouteId, setAssignRouteId] = useState('')
  const [assignDate, setAssignDate] = useState(new Date().toISOString().split('T')[0])
  const [inviteEmail, setInviteEmail] = useState('')
  const [invitePassword, setInvitePassword] = useState('')
  const [inviteSuccess, setInviteSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  function openCreate() {
    setForm(emptyForm)
    setError('')
    setModal('create')
  }

  function openEdit(driver: Driver) {
    setSelected(driver)
    setForm({
      name: driver.name,
      phone: driver.phone,
      email: driver.email ?? '',
      vehicle_plate: driver.vehicle_plate ?? '',
      status: driver.status,
    })
    setError('')
    setModal('edit')
  }

  function openInvite(driver: Driver) {
    setSelected(driver)
    setInviteEmail(driver.email ?? '')
    setInvitePassword('')
    setInviteSuccess(false)
    setError('')
    setModal('invite')
  }

  function openAssign(driver: Driver) {
    setSelected(driver)
    setAssignRouteId(routes[0]?.id ?? '')
    setModal('assign')
  }

  async function handleCreate() {
    setLoading(true)
    setError('')
    const { data, error } = await supabase
      .from('drivers')
      .insert({ ...form, email: form.email || null, vehicle_plate: form.vehicle_plate || null })
      .select()
      .single()
    setLoading(false)
    if (error) { setError(error.message); return }
    setDrivers(prev => [data as Driver, ...prev])
    setModal(null)
    router.refresh()
  }

  async function handleEdit() {
    if (!selected) return
    setLoading(true)
    setError('')
    const { data, error } = await supabase
      .from('drivers')
      .update({ ...form, email: form.email || null, vehicle_plate: form.vehicle_plate || null })
      .eq('id', selected.id)
      .select()
      .single()
    setLoading(false)
    if (error) { setError(error.message); return }
    setDrivers(prev => prev.map(d => d.id === selected.id ? { ...d, ...(data as Driver) } : d))
    setModal(null)
  }

  async function handleDelete(driver: Driver) {
    if (!confirm(`Delete ${driver.name}? This cannot be undone.`)) return
    const { error } = await supabase.from('drivers').delete().eq('id', driver.id)
    if (!error) setDrivers(prev => prev.filter(d => d.id !== driver.id))
  }

  async function handleInvite() {
    if (!selected || !inviteEmail || !invitePassword) {
      setError('Email and password are required.')
      return
    }
    setLoading(true)
    setError('')
    const res = await fetch('/api/invite-driver', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ driverId: selected.id, email: inviteEmail, password: invitePassword }),
    })
    const json = await res.json()
    setLoading(false)
    if (!res.ok) { setError(json.error); return }
    setInviteSuccess(true)
  }

  async function handleAssign() {
    if (!selected || !assignRouteId) return
    setLoading(true)
    setError('')
    const { error } = await supabase.from('driver_routes').upsert({
      driver_id: selected.id,
      route_id: assignRouteId,
      date: assignDate,
      status: 'pending',
    })
    setLoading(false)
    if (error) { setError(error.message); return }
    setModal(null)
    router.refresh()
  }

  const f = (field: keyof typeof form, value: string) => setForm(prev => ({ ...prev, [field]: value }))

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Drivers</h1>
          <p className="text-gray-500 mt-1">{drivers.length} drivers registered</p>
        </div>
        <Button onClick={openCreate}>
          <Plus size={16} />
          Add Driver
        </Button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Name', 'Phone', 'Email', 'Vehicle', 'Status', 'Actions'].map(h => (
                <th key={h} className="text-left px-4 py-3 font-medium text-gray-600">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {drivers.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-12 text-gray-400">
                  No drivers yet. Add your first driver.
                </td>
              </tr>
            )}
            {drivers.map(driver => (
              <tr key={driver.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-medium text-gray-900">{driver.name}</td>
                <td className="px-4 py-3 text-gray-600">{driver.phone}</td>
                <td className="px-4 py-3 text-gray-600">{driver.email ?? '—'}</td>
                <td className="px-4 py-3 text-gray-600">{driver.vehicle_plate ?? '—'}</td>
                <td className="px-4 py-3"><Badge value={driver.status} /></td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openInvite(driver)} title="Give login">
                      <Mail size={15} className="text-blue-500" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => openAssign(driver)} title="Assign route">
                      <UserCheck size={15} />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => openEdit(driver)} title="Edit">
                      <Pencil size={15} />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(driver)} title="Delete">
                      <Trash2 size={15} className="text-red-500" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {/* Create / Edit Modal */}
      <Modal
        open={modal === 'create' || modal === 'edit'}
        onClose={() => setModal(null)}
        title={modal === 'create' ? 'Add Driver' : 'Edit Driver'}
      >
        <div className="space-y-4">
          <Input label="Full Name" value={form.name} onChange={e => f('name', e.target.value)} placeholder="John Smith" required />
          <Input label="Phone" value={form.phone} onChange={e => f('phone', e.target.value)} placeholder="+44 7700 900000" required />
          <Input label="Email" type="email" value={form.email} onChange={e => f('email', e.target.value)} placeholder="john@example.com" />
          <Input label="Vehicle Plate" value={form.vehicle_plate} onChange={e => f('vehicle_plate', e.target.value)} placeholder="AB12 CDE" />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Status</label>
            <select
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={form.status}
              onChange={e => f('status', e.target.value)}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="on_route">On Route</option>
            </select>
          </div>
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={() => setModal(null)} className="flex-1">Cancel</Button>
            <Button onClick={modal === 'create' ? handleCreate : handleEdit} loading={loading} className="flex-1">
              {modal === 'create' ? 'Create Driver' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Invite Driver Modal */}
      <Modal open={modal === 'invite'} onClose={() => setModal(null)} title={`Give Login — ${selected?.name}`}>
        <div className="space-y-4">
          {inviteSuccess ? (
            <div className="bg-green-50 text-green-700 px-4 py-3 rounded-lg text-sm font-medium">
              Login created! The driver can now sign in at driver-platform.vercel.app/login
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-500">Create a username and password for this driver. Share these with them directly.</p>
              <Input label="Email" type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="driver@example.com" />
              <Input label="Password" type="text" value={invitePassword} onChange={e => setInvitePassword(e.target.value)} placeholder="e.g. their phone number" />
              {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
              <div className="flex gap-3 pt-2">
                <Button variant="secondary" onClick={() => setModal(null)} className="flex-1">Cancel</Button>
                <Button onClick={handleInvite} loading={loading} className="flex-1">Create Login</Button>
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Assign Route Modal */}
      <Modal open={modal === 'assign'} onClose={() => setModal(null)} title={`Assign Route — ${selected?.name}`}>
        <div className="space-y-4">
          {routes.length === 0 ? (
            <p className="text-sm text-gray-500">No active routes available. Create a route first.</p>
          ) : (
            <>
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-gray-700">Route</label>
                <select
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={assignRouteId}
                  onChange={e => setAssignRouteId(e.target.value)}
                >
                  {routes.map(r => <option key={r.id} value={r.id}>{r.route_number ? `${r.route_number} — ${r.name}` : r.name}</option>)}
                </select>
              </div>
              <Input
                label="Date"
                type="date"
                value={assignDate}
                onChange={e => setAssignDate(e.target.value)}
              />
              {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
              <div className="flex gap-3 pt-2">
                <Button variant="secondary" onClick={() => setModal(null)} className="flex-1">Cancel</Button>
                <Button onClick={handleAssign} loading={loading} className="flex-1">Assign Route</Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  )
}
