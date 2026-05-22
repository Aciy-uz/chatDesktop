// 用户信息
export interface User {
  id: number
  username: string
  nickname: string
  avatar: string
  avatarUrl?: string
  created_at?: string
  last_online?: string | null
}

// 好友信息（含未读数）
export interface Friend extends User {
  unread_count: number
}

// 好友申请
export interface FriendRequest {
  id: number
  from_user_id: number
  to_user_id: number
  status: 'pending' | 'accepted' | 'rejected'
  message: string
  created_at: string
  username?: string
  nickname?: string
  avatar?: string
}

// 消息类型
export type MessageType = 'text' | 'image' | 'file'

// 私聊消息
export interface Message {
  id: number
  sender_id: number
  receiver_id: number
  content: string
  type: MessageType
  is_read: number
  is_recalled: number
  created_at: string
}

// WebSocket 消息格式
export interface WSMessage {
  id: number
  senderId: number
  receiverId: number
  content: string
  type: MessageType
  createdAt: string
}

// 群信息
export interface Group {
  id: number
  name: string
  owner_id: number
  created_at: string
}

// 群消息
export interface GroupMessage {
  id: number
  group_id: number
  sender_id: number
  content: string
  type: MessageType
  is_recalled: number
  created_at: string
}

// WebSocket 群消息格式
export interface WSGroupMessage {
  id: number
  groupId: number
  senderId: number
  content: string
  type: MessageType
  createdAt: string
}

// API 响应格式
export interface ApiResponse<T = any> {
  code: number
  msg: string
  data?: T
}

// 文件上传响应
export interface UploadResult {
  url: string
  type: 'image' | 'file'
  filename: string
  size: number
}

// 聊天会话
export interface ChatSession {
  id: string // 'user_2' | 'group_1'
  type: 'private' | 'group'
  targetId: number
  name: string
  avatar: string
  lastMessage?: string
  lastTime?: string
  unreadCount: number
}
