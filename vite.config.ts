import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import { copyFileSync, mkdirSync, existsSync } from 'fs'
import path from 'path'

// 复制 sql.js WASM 文件到 dist-electron
function copySqlWasm() {
  return {
    name: 'copy-sql-wasm',
    closeBundle() {
      const src = path.resolve(__dirname, 'node_modules/sql.js/dist/sql-wasm.wasm')
      const dest = path.resolve(__dirname, 'dist-electron/sql-wasm.wasm')
      if (existsSync(src)) {
        mkdirSync(path.dirname(dest), { recursive: true })
        copyFileSync(src, dest)
        console.log('✓ 复制 sql-wasm.wasm 到 dist-electron')
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    // Electron 插件
    electron([
      {
        // 主进程入口
        entry: 'electron/main.ts',
        vite: {
          plugins: [copySqlWasm()],
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: ['sql.js'],
            },
          },
        },
      },
      {
        // 预加载脚本
        entry: 'electron/preload.ts',
        onstart(args) {
          args.reload()
        },
        vite: {
          build: {
            outDir: 'dist-electron',
          },
        },
      },
    ]),
    renderer(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
  },
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
})
