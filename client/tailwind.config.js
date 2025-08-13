/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        discord: {
          dark: '#2f3136',
          darker: '#202225',
          light: '#36393f',
          blue: '#5865f2',
          green: '#57f287',
          red: '#ed4245'
        }
      }
    },
  },
  plugins: [],
}