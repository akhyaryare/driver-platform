'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Send, MessageSquare, Mail, Users } from 'lucide-react'

type NotificationRecord = {
  id: string
  title: string
  message: string
  channel: 'sms' | 'email' | 'both'
  recipients: 'all' | 'active' | 'on_route'
  status: 'pending' | 'sent' | 'failed'
  sent_at: string | null
  created_at: string
}

export function NotificationsClient({ history: initial }: { history: NotificationRecord[] }) {
  const [history, setHistory] = useState(initial)
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [channel, setChannel] = useState<'sms' | 'email' | 'both'>('both')
  const [recipients, setRecipients] = useState<'all' | 'active' | 'on_route'>('all')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ success?: boolean; sent?: number; error?: string } | null>(null)

  async function handleSend() {
    if (!title.trim() || !message.trim()) return
    setLoading(true)
    setResult(null)

    const res = await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, message, channel, recipients }),
    })

    const data = await res.json()
    setLoading(false)

    if (res.ok) {
      setResult({ success: true, sent: data.sent })
      setTitle('')
      setMessage('')
      // Refresh history
      const refreshed = await fetch('/api/notifications/history').catch(() => null)
      if (refreshed?.ok) {
        const { data: newHistory } = await refreshed.json()
        if (newHistory) setHistory(newHistory)
      }
    } else {
      setResult({ error: data.error })
    }
  }

  const channelIcon = { sms: MessageSquare, email: Mail, both: Users }

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
        <p className="text-gray-500 mt-1">Send SMS and email alerts to your drivers</p>
      </div>

      {/* Compose */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Send size={18} />
          Send Notification
        </h2>

        <div className="space-y-4">
          <Input
            label="Subject / Title"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Route Change — Today"
          />

          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Message</label>
            <textarea
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition resize-none"
              rows={4}
              placeholder="Type your message to drivers..."
              value={message}
              onChange={e => setMessage(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Channel</label>
              <div className="flex gap-2">
                {(['sms', 'email', 'both'] as const).map(ch => (
                  <button
                    key={ch}
                    onClick={() => setChannel(ch)}
                    className={`flex-1 px-3 py-2 text-sm rounded-lg border font-medium transition-colors capitalize ${
                      channel === ch
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                    }`}
                  >
                    {ch}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">Recipients</label>
              <select
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={recipients}
                onChange={e => setRecipients(e.target.value as typeof recipients)}
              >
                <option value="all">All Drivers</option>
                <option value="active">Active Drivers Only</option>
                <option value="on_route">On Route Only</option>
              </select>
            </div>
          </div>

          {result?.success && (
            <div className="bg-green-50 text-green-700 px-4 py-3 rounded-lg text-sm">
              Notification sent to {result.sent} driver{result.sent !== 1 ? 's' : ''}.
            </div>
          )}
          {result?.error && (
            <div className="bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm">{result.error}</div>
          )}

          <Button
            onClick={handleSend}
            loading={loading}
            disabled={!title.trim() || !message.trim()}
            size="lg"
          >
            <Send size={16} />
            Send Now
          </Button>
        </div>
      </div>

      {/* History */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Recent Notifications</h2>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[500px]">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {['Title', 'Channel', 'Recipients', 'Status', 'Sent At'].map(h => (
                <th key={h} className="text-left px-4 py-3 font-medium text-gray-600">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {history.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-10 text-gray-400">No notifications sent yet.</td>
              </tr>
            )}
            {history.map(n => {
              const Icon = channelIcon[n.channel]
              return (
                <tr key={n.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{n.title}</p>
                    <p className="text-gray-400 text-xs truncate max-w-xs">{n.message}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 text-gray-600 capitalize">
                      <Icon size={14} /> {n.channel}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 capitalize">{n.recipients.replace('_', ' ')}</td>
                  <td className="px-4 py-3"><Badge value={n.status} /></td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {n.sent_at ? new Date(n.sent_at).toLocaleString('en-GB') : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  )
}
