import { contextBridge, ipcRenderer } from 'electron'

// 暴露 API 给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 显示通知
  showNotification: (title: string, body: string) => {
    ipcRenderer.invoke('show-notification', title, body)
  },

  // 获取应用路径
  getAppPath: () => ipcRenderer.invoke('get-app-path'),

  // 平台信息
  platform: process.platform,

  // 是否是 Electron 环境
  isElectron: true,

  // ============ 数据库操作 ============

  // 会话
  db: {
    saveSessions: (userId: number, sessions: any[]) =>
      ipcRenderer.invoke('db-save-sessions', userId, sessions),

    loadSessions: (userId: number) =>
      ipcRenderer.invoke('db-load-sessions', userId),

    // 私聊消息
    saveMessages: (userId: number, messages: any[]) =>
      ipcRenderer.invoke('db-save-messages', userId, messages),

    loadMessages: (userId: number, targetId: number, limit?: number, offset?: number) =>
      ipcRenderer.invoke('db-load-messages', userId, targetId, limit, offset),

    // 群聊消息
    saveGroupMessages: (userId: number, messages: any[]) =>
      ipcRenderer.invoke('db-save-group-messages', userId, messages),

    loadGroupMessages: (userId: number, groupId: number, limit?: number, offset?: number) =>
      ipcRenderer.invoke('db-load-group-messages', userId, groupId, limit, offset),

    // 搜索
    searchMessages: (userId: number, keyword: string) =>
      ipcRenderer.invoke('db-search-messages', userId, keyword),

    // 清除数据
    clearUserData: (userId: number) =>
      ipcRenderer.invoke('db-clear-user-data', userId),
  },
})
