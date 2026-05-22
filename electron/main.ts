import { app, BrowserWindow, Tray, Menu, nativeImage, ipcMain, Notification } from 'electron'
import path from 'path'
import { initDatabase, saveSessions, loadSessions, saveMessages, loadMessages, saveGroupMessages, loadGroupMessages, searchMessages, clearUserData } from './database'

// 禁用 GPU 加速（可选，解决某些显卡问题）
// app.disableHardwareAcceleration()

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null

// 开发环境判断
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'ChatApp',
    icon: path.join(__dirname, '../public/favicon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    // 去掉原生菜单栏
    autoHideMenuBar: true,
  })

  // 加载页面
  if (isDev) {
    // 开发环境：等待 Vite 服务器启动
    const url = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173'
    mainWindow.loadURL(url)
    // 打开 DevTools
    mainWindow.webContents.openDevTools()
  } else {
    // 生产环境：加载打包后的文件
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  // 关闭窗口时最小化到托盘而不是退出
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function createTray() {
  // 创建托盘图标
  const iconPath = path.join(__dirname, '../public/favicon.ico')
  const icon = nativeImage.createFromPath(iconPath)
  tray = new Tray(icon.resize({ width: 16, height: 16 }))

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示主窗口',
      click: () => {
        mainWindow?.show()
        mainWindow?.focus()
      },
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.isQuitting = true
        app.quit()
      },
    },
  ])

  tray.setToolTip('ChatApp')
  tray.setContextMenu(contextMenu)

  // 点击托盘图标显示窗口
  tray.on('click', () => {
    mainWindow?.show()
    mainWindow?.focus()
  })
}

// 应用准备就绪
app.whenReady().then(() => {
  createWindow()
  createTray()

  // macOS：点击 dock 图标时重新创建窗口
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

// 所有窗口关闭时
app.on('window-all-closed', () => {
  // macOS 以外的平台退出应用
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// IPC 通信：显示通知
ipcMain.handle('show-notification', (_event, title: string, body: string) => {
  new Notification({ title, body }).show()
})

// IPC 通信：获取应用路径
ipcMain.handle('get-app-path', () => {
  return app.getPath('userData')
})

// ============ 数据库 IPC 处理 ============

// 保存会话
ipcMain.handle('db-save-sessions', (_event, userId: number, sessions: any[]) => {
  saveSessions(userId, sessions)
})

// 加载会话
ipcMain.handle('db-load-sessions', (_event, userId: number) => {
  return loadSessions(userId)
})

// 保存私聊消息
ipcMain.handle('db-save-messages', (_event, userId: number, messages: any[]) => {
  saveMessages(userId, messages)
})

// 加载私聊消息
ipcMain.handle('db-load-messages', (_event, userId: number, targetId: number, limit?: number, offset?: number) => {
  return loadMessages(userId, targetId, limit, offset)
})

// 保存群聊消息
ipcMain.handle('db-save-group-messages', (_event, userId: number, messages: any[]) => {
  saveGroupMessages(userId, messages)
})

// 加载群聊消息
ipcMain.handle('db-load-group-messages', (_event, userId: number, groupId: number, limit?: number, offset?: number) => {
  return loadGroupMessages(userId, groupId, limit, offset)
})

// 搜索消息
ipcMain.handle('db-search-messages', (_event, userId: number, keyword: string) => {
  return searchMessages(userId, keyword)
})

// 清除用户数据
ipcMain.handle('db-clear-user-data', (_event, userId: number) => {
  clearUserData(userId)
})

// 声明 app.isQuitting 属性
declare module 'electron' {
  interface App {
    isQuitting?: boolean
  }
}
