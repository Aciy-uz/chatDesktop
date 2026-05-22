/**
 * Socket Service - WebSocket 通信封装
 *
 * 负责与服务器的实时双向通信。
 *
 * ## Electron 迁移说明
 *
 * 1. **连接管理**
 *    - 当前：浏览器 WebSocket
 *    - Electron：原生 WebSocket，连接更稳定
 *    - 可实现后台保活（应用最小化时保持连接）
 *
 * 2. **断线重连**
 *    - 当前：Socket.io 内置重连机制
 *    - Electron：可增加指数退避重连策略
 *    - 可实现消息队列，离线时缓存发送
 *
 * 3. **通知集成**
 *    - 当前：仅在页面内显示消息
 *    - Electron：可调用系统通知 API
 *    - 支持消息提示音、角标、托盘闪烁
 *
 * 4. **性能优化**
 *    - 消息批量处理（防抖）
 *    - 大群消息降频处理
 *    - 二进制消息支持（图片直传）
 */

import { io, Socket } from 'socket.io-client'
import type { WSMessage, WSGroupMessage } from '@/types'

// ============================================================
// WebSocket 配置
// Electron 迁移时：可在应用设置中动态配置
// ============================================================
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3000'

type EventCallback = (...args: any[]) => void

class SocketService {
  private socket: Socket | null = null
  private listeners: Map<string, Set<EventCallback>> = new Map()

  /**
   * 建立 WebSocket 连接
   *
   * Electron 迁移时：
   * - 可添加代理支持
   * - 可添加连接超时处理
   * - 可实现连接池（多服务器支持）
   */
  connect(token: string): void {
    if (this.socket?.connected) {
      return
    }

    this.socket = io(SOCKET_URL, {
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      // Electron 迁移时可调整：
      // reconnectionDelayMax: 30000,  // 最大重连延迟
      // timeout: 20000,               // 连接超时
    })

    this.socket.on('connect', () => {
      console.log('[Socket] WebSocket 已连接, socketId:', this.socket?.id)
      this.emit('_connected')

      // Electron 迁移时：
      // - 更新托盘图标为在线状态
      // - 触发系统通知（可选）
    })

    this.socket.on('disconnect', (reason) => {
      console.log('WebSocket 已断开:', reason)
      this.emit('_disconnected', reason)

      // Electron 迁移时：
      // - 更新托盘图标为离线状态
      // - 显示断线提示（可选）
    })

    this.socket.on('connect_error', (err) => {
      console.error('[Socket] 连接失败:', err.message)
      this.emit('_error', err.message)

      // Electron 迁移时：
      // - 显示连接错误对话框
      // - 提供重新连接按钮
    })

    // 注册服务端事件
    const serverEvents = [
      'online_users',      // 在线用户列表
      'user_online',       // 用户上线
      'user_offline',      // 用户下线
      'private_message',   // 私聊消息
      'group_message',     // 群聊消息
      'unread_messages',   // 未读消息推送
      'messages_read',     // 消息已读通知
      'message_recall',    // 私聊消息撤回
      'group_message_recall', // 群消息撤回
    ]

    serverEvents.forEach((event) => {
      this.socket!.on(event, (data: any) => {
        this.emit(event, data)

        // Electron 迁移时：触发系统通知
        // if (['private_message', 'group_message'].includes(event)) {
        //   this.showNotification(event, data)
        // }
      })
    })
  }

  /**
   * 断开连接
   *
   * Electron 迁移时：
   * - 应用退出时调用
   * - 切换账号时调用
   */
  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }
    this.listeners.clear()
  }

  isConnected(): boolean {
    return this.socket?.connected || false
  }

  // ============================================================
  // 消息发送
  // ============================================================

  // 发送私聊消息
  sendPrivateMessage(receiverId: number, content: string, type: 'text' | 'image' | 'file' = 'text'): void {
    this.socket?.emit('private_message', { receiverId, content, type })

    // Electron 迁移时：可添加发送队列
    // if (!this.isConnected()) {
    //   this.addToQueue({ event: 'private_message', data: { receiverId, content, type } })
    // }
  }

  // 发送群消息
  sendGroupMessage(groupId: number, content: string, type: 'text' | 'image' | 'file' = 'text'): void {
    this.socket?.emit('group_message', { groupId, content, type })
  }

  // 标记消息已读
  markAsRead(senderId: number): void {
    this.socket?.emit('message_read', { senderId })
  }

  // 撤回私聊消息
  recallMessage(messageId: number, receiverId: number): void {
    this.socket?.emit('message_recall', { messageId, receiverId })
  }

  // 撤回群消息
  recallGroupMessage(messageId: number, groupId: number): void {
    this.socket?.emit('group_message_recall', { messageId, groupId })
  }

  // ============================================================
  // 事件监听
  // ============================================================

  // 注册事件监听
  on(event: string, callback: EventCallback): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(callback)
  }

  // 移除事件监听
  off(event: string, callback?: EventCallback): void {
    if (!callback) {
      this.listeners.delete(event)
      return
    }
    this.listeners.get(event)?.delete(callback)
  }

  // 触发事件（内部使用）
  private emit(event: string, ...args: any[]): void {
    this.listeners.get(event)?.forEach((cb) => cb(...args))
  }

  // ============================================================
  // Electron 扩展功能（迁移时实现）
  // ============================================================

  /**
   * 显示系统通知（Electron 专用）
   *
   * ```typescript
   * private showNotification(event: string, data: any): void {
   *   if (!window.electronAPI) return
   *
   *   const title = event === 'private_message' ? '新私聊消息' : '新群消息'
   *   const body = data.content || '[图片/文件]'
   *
   *   new Notification(title, {
   *     body,
   *     icon: '/path/to/icon.png',
   *     silent: false,
   *   })
   * }
   * ```
   */

  /**
   * 消息发送队列（Electron 专用，离线支持）
   *
   * ```typescript
   * private messageQueue: Array<{ event: string; data: any }> = []
   *
   * private addToQueue(item: { event: string; data: any }): void {
   *   this.messageQueue.push(item)
   *   // 持久化到本地
   *   window.electronAPI.saveQueue(this.messageQueue)
   * }
   *
   * private async processQueue(): Promise<void> {
   *   while (this.messageQueue.length > 0 && this.isConnected()) {
   *     const item = this.messageQueue.shift()
   *     if (item) {
   *       this.socket?.emit(item.event, item.data)
   *     }
   *   }
   * }
   * ```
   */
}

export const socketService = new SocketService()
