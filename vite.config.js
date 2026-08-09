import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // jsPDF zieht html2canvas nur für jsPDF.html() (nutzen wir nicht) —
      // ohne dieses Alias landen 200 KB ungenutzt im Bundle.
      html2canvas: path.resolve(__dirname, 'src/html2canvas-stub.js'),
    },
  },
})
