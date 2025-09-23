/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f5f8ff',
          100: '#e4ecff',
          200: '#d1e0ff',
          300: '#a6c1ff',
          400: '#7b9fff',
          500: '#4d7dff',
          600: '#2e5eff',
          700: '#0037ff',
          800: '#002ed4',
          900: '#0024a6',
        },
      },
    },
  },
  plugins: [],
}
