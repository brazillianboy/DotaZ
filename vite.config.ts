import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Общий конфиг Vite и Vitest.
// Секция `test.css` нужна только тестам: она позволяет читать стили (`?raw`) и проверять
// требования владельца к отступам секций и размерам иконок предметов. Продовая сборка
// (`vite build`) этим не затрагивается.
export default defineConfig({
  plugins: [react()],
  test: {
    css: true,
  },
})