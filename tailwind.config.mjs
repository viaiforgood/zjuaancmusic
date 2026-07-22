/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,sgn,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        slate: {
          950: '#f8f5ee', // Warm cream background
          900: '#ffffff', // White surface card
          800: '#e5dfd3', // Soft border color
          500: '#5c667a', // Text muted
          400: '#5c667a', // Text secondary
          200: '#1a2533', // Main text color
        },
        blue: {
          600: '#1a3a5f', // Navy brand color
          500: '#1a3a5f', // Navy brand text
          400: '#b89355', // Rich gold accent color
          950: '#fcfbfa', // Ultra light cream card background
          900: '#e2dac9', // Gold-tinted border
        }
      }
    },
  },
  plugins: [],
};
