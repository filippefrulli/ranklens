/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './src/**/*.{html,js,svelte,ts}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Poppins', 'ui-sans-serif', 'system-ui', 'sans-serif']
      },
      colors: {
        brand: {
          50: '#eef6ff',
          100: '#d9ecff',
          200: '#bcdfff',
          300: '#8cc9ff',
          400: '#55abff',
          500: '#2a8bff',
          600: '#116ee8',
          700: '#0b55b5',
          800: '#0f4891',
          900: '#113e78',
        }
      },
      boxShadow: {
        'soft': '0 1px 2px 0 rgba(0,0,0,0.04), 0 1px 3px 0 rgba(0,0,0,0.06)'
      },
      borderRadius: {
        'xl': '0.85rem'
      }
    }
  },
  plugins: []
}
