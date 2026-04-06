/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./pages/**/*.{js,jsx}', './components/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        masters: {
          green: '#1a6b3a',
          gold: '#c9a227',
          dark: '#0f3d20',
          light: '#e8f5ee',
        }
      }
    }
  },
  plugins: []
}
