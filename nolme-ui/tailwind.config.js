/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Nolme palette — extracted from src/components/demo/view/NolmeDemo.tsx
        // and the Figma variables at node 95:1247.
        'nolme-purple': {
          50: '#f7f5ff',
          100: '#f0eeff',
          200: '#ddd8ff',
          300: '#c4bbff',
          400: '#8470ff',
          500: '#4f3ed6',
          600: '#3c2eb8',
        },
        'nolme-amber': {
          100: '#fff6e7',
          200: '#feefd0',
          300: '#ffd89a',
          400: '#f9a832',
          500: '#e8900a',
        },
        'nolme-emerald': {
          100: '#e9f9f1',
          500: '#10b981',
          700: '#108d61',
        },
        'nolme-neutral': {
          100: '#f8f8fa',
          200: '#f0f0f5',
          400: '#a0a0b4',
          500: '#767690',
          600: '#54546a',
          800: '#22222e',
          900: '#13131a',
        },
        'nolme-lavender': '#cfc6ff',
        'nolme-lavender-bg': '#f3f0ff',
      },
      fontFamily: {
        // Satoshi is loaded at the root via src/styles/nolme-fonts.css
        sans: ['Satoshi', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
