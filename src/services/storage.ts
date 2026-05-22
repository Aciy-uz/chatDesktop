/**
 * 存储适配器
 *
 * 根据运行环境自动选择存储方式：
 * - Electron: 使用 SQLite 数据库
 * - 浏览器: 使用 localStorage
 */

// 检测是否在 Electron 环境中
const isElectron = () => typeof window !== 'undefined' && !!window.electronAPI

// ============ 会话存储 ============

export async function saveSessions(userId: number, sessions: any[]): Promise<void> {
  if (isElectron()) {
    await window.electronAPI!.db.saveSessions(userId, sessions)
  } else {
    const key = `chat_sessions_${userId}`
    localStorage.setItem(key, JSON.stringify({
      sessions,
      activeSessionId: null,
    }))
  }
}

export async function loadSessions(userId: number): Promise<any[]> {
  if (isElectron()) {
    return await window.electronAPI!.db.loadSessions(userId)
  } else {
    const key = `chat_sessions_${userId}`
    const saved = localStorage.getItem(key)
    if (!saved) return []
    try {
      const data = JSON.parse(saved)
      return data.sessions || []
    } catch {
      return []
    }
  }
}

// ============ 私聊消息存储 ============

export async function saveMessages(userId: number, messages: any[]): Promise<void> {
  if (isElectron()) {
    await window.electronAPI!.db.saveMessages(userId, messages)
  } else {
    // 浏览器环境下不持久化消息（内存中）
  }
}

export async function loadMessages(userId: number, targetId: number, limit?: number, offset?: number): Promise<any[]> {
  if (isElectron()) {
    return await window.electronAPI!.db.loadMessages(userId, targetId, limit, offset)
  } else {
    return []
  }
}

// ============ 群聊消息存储 ============

export async function saveGroupMessages(userId: number, messages: any[]): Promise<void> {
  if (isElectron()) {
    await window.electronAPI!.db.saveGroupMessages(userId, messages)
  } else {
    // 浏览器环境下不持久化消息（内存中）
  }
}

export async function loadGroupMessages(userId: number, groupId: number, limit?: number, offset?: number): Promise<any[]> {
  if (isElectron()) {
    return await window.electronAPI!.db.loadGroupMessages(userId, groupId, limit, offset)
  } else {
    return []
  }
}

// ============ 消息搜索 ============

export async function searchMessages(userId: number, keyword: string): Promise<any[]> {
  if (isElectron()) {
    return await window.electronAPI!.db.searchMessages(userId, keyword)
  } else {
    return []
  }
}

// ============ 清除用户数据 ============

export async function clearUserData(userId: number): Promise<void> {
  if (isElectron()) {
    await window.electronAPI!.db.clearUserData(userId)
  } else {
    // 清除 localStorage 中的会话数据
    localStorage.removeItem(`chat_sessions_${userId}`)
  }
}

// ============ 通知 ============

export function showNotification(title: string, body: string): void {
  if (isElectron()) {
    window.electronAPI!.showNotification(title, body)
  } else if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body })
  }
}
