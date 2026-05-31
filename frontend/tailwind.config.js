/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          green: '#22c55e',
          'green-dark': '#16a34a',
          'green-dim': '#166534',
        },
        surface: {
          bg: '#0a0a0a',
          card: '#111111',
          elevated: '#1a1a1a',
          border: '#2a2a2a',
          hover: '#222222',
        }
      }
    }
  },
  plugins: []
}
