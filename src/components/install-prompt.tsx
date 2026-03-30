'use client'
import { useEffect, useState } from 'react'
import { Download, X, Share } from 'lucide-react'

export function InstallPrompt() {
  const [prompt, setPrompt] = useState<any>(null)
  const [show, setShow] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // Don't show if already installed (standalone mode)
    if (window.matchMedia('(display-mode: standalone)').matches) return
    // Don't show if dismissed this session
    if (sessionStorage.getItem('install-dismissed')) return

    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window.navigator as any).standalone
    setIsIOS(ios)
    if (ios) { setShow(true); return }

    const handler = (e: Event) => {
      e.preventDefault()
      setPrompt(e)
      setShow(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  function dismiss() {
    sessionStorage.setItem('install-dismissed', '1')
    setShow(false)
    setDismissed(true)
  }

  async function install() {
    if (!prompt) return
    prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') setShow(false)
  }

  if (!show || dismissed) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 pb-6">
      <div className="bg-gray-900 text-white rounded-2xl p-4 shadow-2xl max-w-sm mx-auto">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
              <Download size={20} />
            </div>
            <div>
              <p className="font-bold text-sm">Add {process.env.NEXT_PUBLIC_APP_NAME ?? 'DriverOps'} to Home Screen</p>
              <p className="text-xs text-gray-400">Access your routes instantly</p>
            </div>
          </div>
          <button onClick={dismiss} className="text-gray-500 hover:text-white ml-2 flex-shrink-0">
            <X size={18} />
          </button>
        </div>

        {isIOS ? (
          <div className="bg-gray-800 rounded-xl p-3">
            <p className="text-xs text-gray-300 leading-relaxed">
              Tap <span className="inline-flex items-center gap-1 text-blue-400 font-medium"><Share size={12} /> Share</span> at the bottom of your browser, then tap <span className="font-medium text-white">"Add to Home Screen"</span>
            </p>
          </div>
        ) : (
          <button
            onClick={install}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
          >
            Install App
          </button>
        )}
      </div>
    </div>
  )
}
