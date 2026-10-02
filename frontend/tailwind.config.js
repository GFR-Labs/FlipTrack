/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      // Semantic tokens backed by CSS variables so light ("ledger") and
      // dark (classic) themes swap at runtime via the .dark class.
      colors: {
        paper:    'rgb(var(--c-paper) / <alpha-value>)',
        cream:    'rgb(var(--c-cream) / <alpha-value>)',
        sand:     'rgb(var(--c-sand) / <alpha-value>)',
        edge:     'rgb(var(--c-edge) / <alpha-value>)',
        ink:      'rgb(var(--c-ink) / <alpha-value>)',
        inkmut:   'rgb(var(--c-inkmut) / <alpha-value>)',
        inkfaint: 'rgb(var(--c-inkfaint) / <alpha-value>)',
        moss:     'rgb(var(--c-moss) / <alpha-value>)',
        mossdeep: 'rgb(var(--c-mossdeep) / <alpha-value>)',
        clay:     'rgb(var(--c-clay) / <alpha-value>)',
        ochre:    'rgb(var(--c-ochre) / <alpha-value>)',
        sea:      'rgb(var(--c-sea) / <alpha-value>)',
      },
      fontFamily: {
        display: 'var(--font-display)',
        sans: 'var(--font-sans)',
        mono: 'var(--font-mono)',
      },
    }
  },
  plugins: []
}
