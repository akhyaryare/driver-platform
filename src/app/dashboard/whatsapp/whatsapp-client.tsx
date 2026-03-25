'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { Plus, ExternalLink, Trash2, Pencil, MessageCircle } from 'lucide-react'

type Group = {
  id: string
  name: string
  description: string | null
  link: string
  active: boolean
  created_at: string
}

const emptyForm = { name: '', description: '', link: '' }

export function WhatsAppClient({ groups: initial }: { groups: Group[] }) {
  const [groups, setGroups] = useState(initial)
  const [modal, setModal] = useState<'create' | 'edit' | null>(null)
  const [selected, setSelected] = useState<Group | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  function openCreate() { setForm(emptyForm); setError(''); setModal('create') }
  function openEdit(g: Group) {
    setSelected(g)
    setForm({ name: g.name, description: g.description ?? '', link: g.link })
    setError(''); setModal('edit')
  }

  async function handleCreate() {
    setLoading(true); setError('')
    const { data, error } = await supabase
      .from('whatsapp_groups')
      .insert({ ...form, description: form.description || null })
      .select().single()
    setLoading(false)
    if (error) { setError(error.message); return }
    setGroups(prev => [data as Group, ...prev])
    setModal(null)
  }

  async function handleEdit() {
    if (!selected) return
    setLoading(true); setError('')
    const { data, error } = await supabase
      .from('whatsapp_groups')
      .update({ ...form, description: form.description || null })
      .eq('id', selected.id).select().single()
    setLoading(false)
    if (error) { setError(error.message); return }
    setGroups(prev => prev.map(g => g.id === selected.id ? data as Group : g))
    setModal(null)
  }

  async function handleDelete(group: Group) {
    if (!confirm(`Delete group "${group.name}"?`)) return
    const { error } = await supabase.from('whatsapp_groups').delete().eq('id', group.id)
    if (!error) setGroups(prev => prev.filter(g => g.id !== group.id))
  }

  async function toggleActive(group: Group) {
    const { data } = await supabase
      .from('whatsapp_groups')
      .update({ active: !group.active })
      .eq('id', group.id).select().single()
    if (data) setGroups(prev => prev.map(g => g.id === group.id ? data as Group : g))
  }

  const f = (field: keyof typeof form, value: string) => setForm(prev => ({ ...prev, [field]: value }))

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">WhatsApp Groups</h1>
          <p className="text-gray-500 mt-1">Centralized group links for drivers</p>
        </div>
        <Button onClick={openCreate}><Plus size={16} /> Add Group</Button>
      </div>

      {groups.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-12 text-center">
          <MessageCircle size={40} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">No WhatsApp groups yet. Add your first group link.</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {groups.map(group => (
          <div
            key={group.id}
            className={`bg-white rounded-xl border shadow-sm p-5 flex flex-col gap-3 ${
              group.active ? 'border-gray-200' : 'border-gray-100 opacity-60'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <MessageCircle size={18} className="text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 text-sm">{group.name}</h3>
                  {group.description && (
                    <p className="text-xs text-gray-500 mt-0.5">{group.description}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button variant="ghost" size="sm" onClick={() => openEdit(group)}><Pencil size={14} /></Button>
                <Button variant="ghost" size="sm" onClick={() => handleDelete(group)}><Trash2 size={14} className="text-red-500" /></Button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={group.link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <ExternalLink size={14} />
                Open Group
              </a>
              <button
                onClick={() => toggleActive(group)}
                className={`px-3 py-2 text-xs font-medium rounded-lg border transition-colors ${
                  group.active
                    ? 'border-gray-300 text-gray-600 hover:bg-gray-50'
                    : 'border-green-300 text-green-600 hover:bg-green-50'
                }`}
              >
                {group.active ? 'Deactivate' : 'Activate'}
              </button>
            </div>
          </div>
        ))}
      </div>

      <Modal
        open={modal === 'create' || modal === 'edit'}
        onClose={() => setModal(null)}
        title={modal === 'create' ? 'Add WhatsApp Group' : 'Edit Group'}
      >
        <div className="space-y-4">
          <Input label="Group Name" value={form.name} onChange={e => f('name', e.target.value)} placeholder="e.g. London Drivers" required />
          <Input label="Description (optional)" value={form.description} onChange={e => f('description', e.target.value)} placeholder="e.g. Main coordination group" />
          <Input label="WhatsApp Link" value={form.link} onChange={e => f('link', e.target.value)} placeholder="https://chat.whatsapp.com/..." required />
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" onClick={() => setModal(null)} className="flex-1">Cancel</Button>
            <Button onClick={modal === 'create' ? handleCreate : handleEdit} loading={loading} className="flex-1">
              {modal === 'create' ? 'Add Group' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
