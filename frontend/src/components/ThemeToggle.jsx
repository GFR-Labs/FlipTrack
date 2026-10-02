import { useState } from 'react'
import { Sun, Moon } from 'lucide-react'

export default function ThemeToggle() {
  const [dark, setDark] = useState(() =>
    document.documentElement.classList.contains('dark')
  )

  const toggle = () => {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
    try {
      localStorage.setItem('fliptrack-theme', next ? 'dark' : 'light')
    } catch {
      /* private browsing — theme just won't persist */
    }
  }

  return (
    <button
      onClick={toggle}
      role="switch"
      aria-checked={dark}
      aria-label={`Switch to ${dark ? 'light' : 'dark'} mode`}
      title={`Switch to ${dark ? 'light' : 'dark'} mode`}
      className="relative flex items-center w-16 h-8 rounded-full border border-edge bg-sand transition-colors"
    >
      {/* Sliding knob */}
      <span
        className={`absolute top-0.5 w-7 h-7 rounded-full bg-cream border border-edge shadow-sm
          transition-transform duration-200 ease-out
          ${dark ? 'translate-x-8' : 'translate-x-0.5'}`}
      />
      <Sun className={`relative z-10 w-4 h-4 ml-2 ${dark ? 'text-inkfaint' : 'text-ochre'}`} />
      <Moon className={`relative z-10 w-4 h-4 ml-auto mr-2 ${dark ? 'text-sea' : 'text-inkfaint'}`} />
    </button>
  )
}
