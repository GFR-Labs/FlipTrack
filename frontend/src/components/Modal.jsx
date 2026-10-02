import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'

export default function Modal({ title, onClose, children }) {
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/50" onClick={onClose} />
      <div
        ref={ref}
        className="relative w-full max-w-md bg-sand border border-edge rounded-md shadow-2xl"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-edge">
          <h2 className="text-ink font-semibold text-base">{title}</h2>
          <button
            onClick={onClose}
            className="text-inkmut hover:text-ink p-1 rounded hover:bg-sand transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  )
}
