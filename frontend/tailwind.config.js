/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        mplads: {
          blue: '#1e3a8a',
          navy: '#0f172a',
          gold: '#d97706',
          bg: '#f8fafc',
        }
      }
    },
  },
  plugins: [],
}
