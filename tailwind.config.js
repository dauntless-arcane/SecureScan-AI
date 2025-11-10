/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        lilac: {
          50: '#faf8fa',
          100: '#f4f0f4',
          200: '#e8dde8',
          300: '#d7c5d7',
          400: '#C8A2C8', // Main lilac color
          500: '#b688b6',
          600: '#9d6f9d',
          700: '#7e5a7e',
          800: '#654a65',
          900: '#4a374a',
        },
        darkpurple: {
          50: '#f8f7fa',
          100: '#f1eef4',
          200: '#e0dae8',
          300: '#cabdd7',
          400: '#ae97c0',
          500: '#9474a6',
          600: '#7a5a8a',
          700: '#634970',
          800: '#523c5e',
          900: '#3B0A45', // Main dark purple color
        },
        deepblack: '#0B0B0B', // Main black color
      },
    },
  },
  plugins: [],
};