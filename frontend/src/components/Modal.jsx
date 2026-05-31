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
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div
        ref={ref}
        className="relative w-full max-w-md bg-[#141414] border border-[#2a2a2a] rounded-2xl shadow-2xl"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2a2a2a]">
          <h2 className="text-white font-semibold text-base">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white p-1 rounded-lg hover:bg-[#1a1a1a] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  )
}
