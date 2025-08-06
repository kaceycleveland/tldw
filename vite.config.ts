import { defineConfig } from 'vite'
import { resolve } from 'path'
import { existsSync, renameSync, rmSync } from 'fs'

export default defineConfig({
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup.html'),
        content: resolve(__dirname, 'src/content.ts'),
        background: resolve(__dirname, 'src/background.ts')
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]'
      }
    },
    copyPublicDir: true
  },
  publicDir: 'public',
  plugins: [
    {
      name: 'move-popup-html',
      writeBundle() {
        const srcPath = resolve(__dirname, 'dist/src/popup.html')
        const destPath = resolve(__dirname, 'dist/popup.html')
        
        if (existsSync(srcPath)) {
          renameSync(srcPath, destPath)
          rmSync(resolve(__dirname, 'dist/src'), { recursive: true, force: true })
        }
      }
    }
  ]
})