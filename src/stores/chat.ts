/**
 * Chat Store - 聊天状态管理
 *
 * 使用 storage 适配器自动选择存储方式：
 * - Electron: SQLite 数据库
 * - 浏览器: localStorage
 */

import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { Message, GroupMessage, ChatSession, MessageType } from '@/types'
import { api } from '@/services/api'
import { socketService } from '@/services/socket'
import { useAuthStore } from './auth'
import { useContactStore } from './contact'
import * as storage from '@/services/storage'

export const useChatStore = defineStore('chat', () => {
  const activeSession = ref<ChatSession | null>(null)
  const privateMessages = ref<Map<number, Message[]>>(new Map())
  const groupMessages = ref<Map<number, GroupMessage[]>>(new Map())
  const sessions = ref<ChatSession[]>([])

  const currentMessages = computed(() => {
    if (!activeSession.value) return []
    if (activeSession.value.type === 'private') {
      return privateMessages.value.get(activeSession.value.targetId) || []
    }
    return groupMessages.value.get(activeSession.value.targetId) || []
  })

  // ============================================================
  // 持久化（使用 storage 适配器）
  // ============================================================

  let saveTimer: ReturnType<typeof setTimeout> | null = null

  function debounceSave() {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      const authStore = useAuthStore()
      if (authStore.user) {
        storage.saveSessions(authStore.user.id, sessions.value)
      }
    }, 500)
  }

  watch(sessions, debounceSave, { deep: true })
  watch(activeSession, debounceSave)

  async function restoreSessions(): Promise<boolean> {
    const authStore = useAuthStore()
    if (!authStore.user) return false

    const savedSessions = await storage.loadSessions(authStore.user.id)
    if (savedSessions.length > 0) {
      sessions.value = savedSessions
      return true
    }
    return false
  }

  // ============================================================
  // 消息格式转换
  // ============================================================

  function convertWSMessage(msg: any): Message {
    return {
      id: msg.id,
      sender_id: msg.senderId ?? msg.sender_id,
      receiver_id: msg.receiverId ?? msg.receiver_id,
      content: msg.content,
      type: msg.type,
      is_read: msg.isRead ?? msg.is_read ?? 0,
      is_recalled: msg.isRecalled ?? msg.is_recalled ?? 0,
      created_at: msg.createdAt ?? msg.created_at ?? new Date().toISOString(),
    }
  }

  function convertWSGroupMessage(msg: any): GroupMessage {
    return {
      id: msg.id,
      group_id: msg.groupId ?? msg.group_id,
      sender_id: msg.senderId ?? msg.sender_id,
      content: msg.content,
      type: msg.type,
      is_recalled: msg.isRecalled ?? msg.is_recalled ?? 0,
      created_at: msg.createdAt ?? msg.created_at ?? new Date().toISOString(),
    }
  }

  // ============================================================
  // 消息缓存管理
  // ============================================================

  function addPrivateMessage(targetId: number, msg: Message): void {
    const messages = privateMessages.value.get(targetId) || []
    messages.push(msg)
    privateMessages.value.set(targetId, messages)

    // 持久化到存储
    const authStore = useAuthStore()
    if (authStore.user) {
      storage.saveMessages(authStore.user.id, [msg])
    }
  }

  function addGroupMessage(groupId: number, msg: GroupMessage): void {
    const messages = groupMessages.value.get(groupId) || []
    messages.push(msg)
    groupMessages.value.set(groupId, messages)

    // 持久化到存储
    const authStore = useAuthStore()
    if (authStore.user) {
      storage.saveGroupMessages(authStore.user.id, [msg])
    }
  }

  // ============================================================
  // 会话操作
  // ============================================================

  async function openPrivateChat(friendId: number, friendName: string, friendAvatar: string): Promise<void> {
    const sessionId = `user_${friendId}`

    let session = sessions.value.find((s) => s.id === sessionId)
    if (!session) {
      session = {
        id: sessionId,
        type: 'private',
        targetId: friendId,
        name: friendName,
        avatar: friendAvatar,
        unreadCount: 0,
      }
      sessions.value.unshift(session)
    } else {
      session.name = friendName
      session.avatar = friendAvatar
    }

    activeSession.value = session

    const contactStore = useContactStore()
    contactStore.clearUnread(friendId)
    session.unreadCount = 0

    socketService.markAsRead(friendId)

    if (!privateMessages.value.has(friendId)) {
      await loadPrivateHistory(friendId)
    }
  }

  async function openGroupChat(groupId: number, groupName: string): Promise<void> {
    const sessionId = `group_${groupId}`

    let session = sessions.value.find((s) => s.id === sessionId)
    if (!session) {
      session = {
        id: sessionId,
        type: 'group',
        targetId: groupId,
        name: groupName,
        avatar: '',
        unreadCount: 0,
      }
      sessions.value.unshift(session)
    } else {
      session.name = groupName
    }

    activeSession.value = session

    if (!groupMessages.value.has(groupId)) {
      await loadGroupHistory(groupId)
    }
  }

  // ============================================================
  // 历史消息加载
  // ============================================================

  async function loadPrivateHistory(friendId: number, page = 1): Promise<void> {
    const authStore = useAuthStore()

    // 先从本地存储加载
    if (authStore.user && page === 1) {
      const localMessages = await storage.loadMessages(authStore.user.id, friendId, 50)
      if (localMessages.length > 0) {
        privateMessages.value.set(friendId, localMessages.reverse())
      }
    }

    // 再从服务器加载
    const res = await api.getHistory(friendId, page)
    if (res.code === 200 && res.data) {
      if (page === 1) {
        privateMessages.value.set(friendId, res.data)
      } else {
        const existing = privateMessages.value.get(friendId) || []
        privateMessages.value.set(friendId, [...res.data, ...existing])
      }

      // 保存到本地存储
      if (authStore.user && res.data.length > 0) {
        storage.saveMessages(authStore.user.id, res.data)
      }
    }
  }

  async function loadGroupHistory(groupId: number, page = 1): Promise<void> {
    const authStore = useAuthStore()

    // 先从本地存储加载
    if (authStore.user && page === 1) {
      const localMessages = await storage.loadGroupMessages(authStore.user.id, groupId, 50)
      if (localMessages.length > 0) {
        groupMessages.value.set(groupId, localMessages.reverse())
      }
    }

    // 再从服务器加载
    const res = await api.getGroupHistory(groupId, page)
    if (res.code === 200 && res.data) {
      if (page === 1) {
        groupMessages.value.set(groupId, res.data)
      } else {
        const existing = groupMessages.value.get(groupId) || []
        groupMessages.value.set(groupId, [...res.data, ...existing])
      }

      // 保存到本地存储
      if (authStore.user && res.data.length > 0) {
        storage.saveGroupMessages(authStore.user.id, res.data)
      }
    }
  }

  // ============================================================
  // 消息发送（乐观更新）
  // ============================================================

  function sendPrivateMessage(receiverId: number, content: string, type: MessageType = 'text'): void {
    const authStore = useAuthStore()
    const myId = authStore.user?.id

    const tempMsg: Message = {
      id: Date.now(),
      sender_id: myId!,
      receiver_id: receiverId,
      content,
      type,
      is_read: 0,
      is_recalled: 0,
      created_at: new Date().toISOString(),
    }

    addPrivateMessage(receiverId, tempMsg)

    const sessionId = `user_${receiverId}`
    const session = sessions.value.find((s) => s.id === sessionId)
    if (session) {
      session.lastMessage = type === 'text' ? content : `[${type === 'image' ? '图片' : '文件'}]`
      session.lastTime = tempMsg.created_at
    }

    socketService.sendPrivateMessage(receiverId, content, type)
  }

  function sendGroupMessage(groupId: number, content: string, type: MessageType = 'text'): void {
    const authStore = useAuthStore()
    const myId = authStore.user?.id

    const tempMsg: GroupMessage = {
      id: Date.now(),
      group_id: groupId,
      sender_id: myId!,
      content,
      type,
      is_recalled: 0,
      created_at: new Date().toISOString(),
    }

    addGroupMessage(groupId, tempMsg)

    const sessionId = `group_${groupId}`
    const session = sessions.value.find((s) => s.id === sessionId)
    if (session) {
      session.lastMessage = type === 'text' ? content : `[${type === 'image' ? '图片' : '文件'}]`
      session.lastTime = tempMsg.created_at
    }

    socketService.sendGroupMessage(groupId, content, type)
  }

  async function uploadAndSend(file: File, targetId: number, isGroup: boolean): Promise<{ success: boolean; msg?: string }> {
    const res = await api.uploadFile(file)
    if (res.code === 200 && res.data) {
      if (isGroup) {
        sendGroupMessage(targetId, res.data.url, res.data.type)
      } else {
        sendPrivateMessage(targetId, res.data.url, res.data.type)
      }
      return { success: true }
    }
    return { success: false, msg: res.msg }
  }

  // ============================================================
  // 消息撤回
  // ============================================================

  async function recallPrivateMessage(messageId: number, receiverId: number): Promise<boolean> {
    const res = await api.recallMessage(messageId)
    if (res.code === 200) {
      socketService.recallMessage(messageId, receiverId)
      const messages = privateMessages.value.get(receiverId)
      if (messages) {
        const msg = messages.find((m) => m.id === messageId)
        if (msg) msg.is_recalled = 1
      }
      return true
    }
    return false
  }

  async function recallGroupMsg(messageId: number, groupId: number): Promise<boolean> {
    const res = await api.recallGroupMessage(messageId)
    if (res.code === 200) {
      socketService.recallGroupMessage(messageId, groupId)
      const messages = groupMessages.value.get(groupId)
      if (messages) {
        const msg = messages.find((m) => m.id === messageId)
        if (msg) msg.is_recalled = 1
      }
      return true
    }
    return false
  }

  // ============================================================
  // 消息接收处理
  // ============================================================

  function handlePrivateMessage(rawMsg: any): void {
    const authStore = useAuthStore()
    const contactStore = useContactStore()
    const myId = authStore.user?.id

    const msg = convertWSMessage(rawMsg)
    const chatPartnerId = msg.sender_id === myId ? msg.receiver_id : msg.sender_id

    const messages = privateMessages.value.get(chatPartnerId) || []
    const exists = messages.some((m) => {
      if (m.sender_id === myId && m.content === msg.content && m.type === msg.type) {
        const timeDiff = Math.abs(new Date(m.created_at).getTime() - new Date(msg.created_at).getTime())
        return timeDiff < 5000
      }
      return m.id === msg.id
    })

    if (exists) {
      const tempIndex = messages.findIndex((m) => {
        if (m.sender_id === myId && m.content === msg.content && m.type === msg.type) {
          const timeDiff = Math.abs(new Date(m.created_at).getTime() - new Date(msg.created_at).getTime())
          return timeDiff < 5000
        }
        return false
      })
      if (tempIndex > -1 && messages[tempIndex]!.id !== msg.id) {
        messages[tempIndex] = msg
      }
      return
    }

    addPrivateMessage(chatPartnerId, msg)

    const sessionId = `user_${chatPartnerId}`
    const session = sessions.value.find((s) => s.id === sessionId)

    if (session) {
      session.lastMessage = msg.type === 'text' ? msg.content : `[${msg.type === 'image' ? '图片' : '文件'}]`
      session.lastTime = msg.created_at
      if (activeSession.value?.id !== sessionId && msg.sender_id !== myId) {
        session.unreadCount++
        contactStore.incrementUnread(chatPartnerId)
      }
    } else if (msg.sender_id !== myId) {
      const friend = contactStore.friends.find((f) => f.id === chatPartnerId)
      if (friend) {
        sessions.value.unshift({
          id: sessionId,
          type: 'private',
          targetId: chatPartnerId,
          name: friend.nickname || friend.username,
          avatar: friend.avatar,
          lastMessage: msg.type === 'text' ? msg.content : `[${msg.type === 'image' ? '图片' : '文件'}]`,
          lastTime: msg.created_at,
          unreadCount: 1,
        })
        contactStore.incrementUnread(chatPartnerId)
      }
    }
  }

  function handleGroupMessage(rawMsg: any): void {
    const authStore = useAuthStore()
    const contactStore = useContactStore()
    const myId = authStore.user?.id

    const msg = convertWSGroupMessage(rawMsg)

    const messages = groupMessages.value.get(msg.group_id) || []
    const exists = messages.some((m) => {
      if (m.sender_id === myId && m.content === msg.content && m.type === msg.type) {
        const timeDiff = Math.abs(new Date(m.created_at).getTime() - new Date(msg.created_at).getTime())
        return timeDiff < 5000
      }
      return m.id === msg.id
    })

    if (exists) {
      const tempIndex = messages.findIndex((m) => {
        if (m.sender_id === myId && m.content === msg.content && m.type === msg.type) {
          const timeDiff = Math.abs(new Date(m.created_at).getTime() - new Date(msg.created_at).getTime())
          return timeDiff < 5000
        }
        return false
      })
      if (tempIndex > -1 && messages[tempIndex]!.id !== msg.id) {
        messages[tempIndex] = msg
      }
      return
    }

    addGroupMessage(msg.group_id, msg)

    const sessionId = `group_${msg.group_id}`
    let session = sessions.value.find((s) => s.id === sessionId)

    if (!session) {
      const group = contactStore.groups.find(g => g.id === msg.group_id)
      if (!group) {
        contactStore.loadGroups()
      }
      const groupName = group?.name || `群${msg.group_id}`
      session = {
        id: sessionId,
        type: 'group',
        targetId: msg.group_id,
        name: groupName,
        avatar: '',
        unreadCount: 0,
      }
      sessions.value.unshift(session)
    }

    session.lastMessage = msg.type === 'text' ? msg.content : `[${msg.type === 'image' ? '图片' : '文件'}]`
    session.lastTime = msg.created_at
    if (activeSession.value?.id !== sessionId && msg.sender_id !== myId) {
      session.unreadCount++
    }
  }

  function handleMessageRecall(messageId: number, senderId: number, isGroup: boolean, targetId: number): void {
    if (isGroup) {
      const messages = groupMessages.value.get(targetId)
      if (messages) {
        const msg = messages.find((m) => m.id === messageId)
        if (msg) msg.is_recalled = 1
      }
    } else {
      for (const [key, messages] of privateMessages.value.entries()) {
        const msg = messages.find((m) => m.id === messageId)
        if (msg) {
          msg.is_recalled = 1
          break
        }
      }
    }
  }

  function handleUnreadMessages(grouped: Record<number, any[]>): void {
    const contactStore = useContactStore()

    for (const [senderIdStr, rawMessages] of Object.entries(grouped)) {
      const senderId = Number(senderIdStr)
      const messages = rawMessages.map(convertWSMessage)
      const existing = privateMessages.value.get(senderId) || []
      privateMessages.value.set(senderId, [...existing, ...messages])
      contactStore.setUnreadCount(senderId, messages.length)

      const sessionId = `user_${senderId}`
      if (!sessions.value.find((s) => s.id === sessionId)) {
        const friend = contactStore.friends.find((f) => f.id === senderId)
        if (friend && messages.length > 0) {
          const lastMsg = messages[messages.length - 1]!
          sessions.value.push({
            id: sessionId,
            type: 'private',
            targetId: senderId,
            name: friend.nickname || friend.username,
            avatar: friend.avatar,
            lastMessage: lastMsg.type === 'text' ? lastMsg.content : `[${lastMsg.type === 'image' ? '图片' : '文件'}]`,
            lastTime: lastMsg.created_at,
            unreadCount: messages.length,
          })
        }
      }
    }
  }

  // ============================================================
  // 其他操作
  // ============================================================

  function closeSession(sessionId: string): void {
    const index = sessions.value.findIndex((s) => s.id === sessionId)
    if (index > -1) {
      sessions.value.splice(index, 1)
      if (activeSession.value?.id === sessionId) {
        activeSession.value = sessions.value[0] || null
      }
    }
  }

  async function clearAll(): Promise<void> {
    const authStore = useAuthStore()
    if (authStore.user) {
      await storage.clearUserData(authStore.user.id)
    }
    sessions.value = []
    activeSession.value = null
    privateMessages.value.clear()
    groupMessages.value.clear()
  }

  return {
    activeSession,
    sessions,
    currentMessages,
    privateMessages,
    groupMessages,
    restoreSessions,
    openPrivateChat,
    openGroupChat,
    loadPrivateHistory,
    loadGroupHistory,
    sendPrivateMessage,
    sendGroupMessage,
    uploadAndSend,
    recallPrivateMessage,
    recallGroupMsg,
    handlePrivateMessage,
    handleGroupMessage,
    handleMessageRecall,
    handleUnreadMessages,
    closeSession,
    clearAll,
  }
})
