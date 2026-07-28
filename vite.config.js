import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
});/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  distDir: 'dist',
  images: { unoptimized: true }
}
module.exports = nextConfig
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        surface: { DEFAULT: '#0f0f1a', elevated: '#1a1a2e', card: '#16162a' },
        accent: { cyan: '#4ecdc4', gold: '#d4a853', purple: '#a78bfa', green: '#34d399' }
      }
    }
  },
  plugins: []
}

