import { defineConfig } from 'vite'
import { resolve } from 'path'
import { existsSync, renameSync, rmSync } from 'fs'

export default defineConfig({
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        sidepanel: resolve(__dirname, 'src/sidepanel.html'),
        content: resolve(__dirname, 'src/content.ts'),
        background: resolve(__dirname, 'src/background.ts'),
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
      name: 'move-sidepanel-html',
      writeBundle() {
        const sidepanelSrcPath = resolve(__dirname, 'dist/src/sidepanel.html')
        const sidepanelDestPath = resolve(__dirname, 'dist/sidepanel.html')
        
        if (existsSync(sidepanelSrcPath)) {
          renameSync(sidepanelSrcPath, sidepanelDestPath)
        }
        
        if (existsSync(resolve(__dirname, 'dist/src'))) {
          rmSync(resolve(__dirname, 'dist/src'), { recursive: true, force: true })
        }
      }
    }
  ]
})