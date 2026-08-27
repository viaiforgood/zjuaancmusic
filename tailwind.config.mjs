/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,sgn,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        canvas: '#030712',
        card: '#0f172a',
        elevated: '#1e293b',
      }
    },
  },
  plugins: [],
};
