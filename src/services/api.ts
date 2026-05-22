/**
 * API Service - HTTP 请求封装
 *
 * 封装所有与后端的 HTTP 通信。
 *
 * ## Electron 迁移说明
 *
 * 1. **API 地址配置**
 *    - 开发环境：http://localhost:3000
 *    - 生产环境：可通过环境变量 VITE_API_BASE 配置
 *    - Electron 中：可在设置页面让用户配置服务器地址
 *
 * 2. **请求拦截**
 *    - 可添加请求/响应拦截器
 *    - 统一处理 401 未授权（自动跳转登录）
 *    - 统一处理网络错误
 *
 * 3. **文件上传**
 *    - 当前使用 FormData + fetch
 *    - Electron 中：可使用 electron-uploader 实现断点续传
 *    - 支持拖拽上传、剪贴板粘贴上传
 *
 * 4. **离线支持**
 *    - 可添加请求队列，离线时缓存请求
 *    - 联网后自动重发
 */

import type { ApiResponse, User, Friend, FriendRequest, Message, Group, GroupMessage, UploadResult } from '@/types'

// ============================================================
// API 配置
// Electron 迁移时：可在应用设置中动态配置
// ============================================================
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000'

class ApiService {
  private token: string = ''

  setToken(token: string) {
    this.token = token
  }

  getToken(): string {
    return this.token
  }

  /**
   * 通用请求方法
   *
   * Electron 迁移时可扩展：
   * - 添加请求重试机制
   * - 添加请求超时处理
   * - 添加请求缓存（GET 请求）
   */
  private async request<T>(url: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    }

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`
    }

    // 如果 body 不是 FormData，设置 Content-Type
    if (options.body && !(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json'
    }

    // Electron 迁移时：可添加代理配置
    // const proxyUrl = await window.electronAPI.getProxyUrl()
    // const fullUrl = proxyUrl ? `${proxyUrl}${url}` : `${API_BASE}${url}`

    const response = await fetch(`${API_BASE}${url}`, {
      ...options,
      headers,
    })

    // 处理 401 未授权
    if (response.status === 401) {
      // Electron 迁移时：可触发重新登录对话框
      // window.dispatchEvent(new CustomEvent('auth:expired'))
    }

    return response.json()
  }

  // ============================================================
  // RSA 加密
  // ============================================================

  async getPublicKey(): Promise<string> {
    const response = await fetch(`${API_BASE}/rsa/public-key`)
    const data = await response.json()
    return data.publicKey || ''
  }

  // ============================================================
  // 验证码
  // ============================================================

  async getCaptcha(): Promise<{ id: string; svg: string }> {
    const response = await fetch(`${API_BASE}/user/captcha`)
    const data = await response.json()
    return { id: data.id || '', svg: data.svg || '' }
  }

  // ============================================================
  // 用户认证
  // ============================================================

  async register(formData: FormData): Promise<ApiResponse> {
    return this.request('/user/register', {
      method: 'POST',
      body: formData,
    })
  }

  async login(data: { username: string; encrypted: string; captchaId: string; captchaCode: string }): Promise<ApiResponse<{ token: string; user: User }>> {
    return this.request('/user/login', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  // ============================================================
  // 用户资料
  // ============================================================

  async getProfile(): Promise<ApiResponse<User>> {
    return this.request('/user/profile')
  }

  async updateNickname(nickname: string): Promise<ApiResponse> {
    return this.request('/user/profile', {
      method: 'PUT',
      body: JSON.stringify({ nickname }),
    })
  }

  async updateAvatar(file: File): Promise<ApiResponse<{ avatarUrl: string }>> {
    const form = new FormData()
    form.append('avatar', file)
    return this.request('/user/avatar', {
      method: 'POST',
      body: form,
    })
  }

  async searchUsers(keyword: string): Promise<ApiResponse<User[]>> {
    return this.request(`/user/search?keyword=${encodeURIComponent(keyword)}`)
  }

  // ============================================================
  // 好友系统
  // ============================================================

  async sendFriendRequest(friendId: number, message?: string): Promise<ApiResponse> {
    return this.request('/friend/request', {
      method: 'POST',
      body: JSON.stringify({ friendId, message }),
    })
  }

  async acceptFriendRequest(requestId: number): Promise<ApiResponse> {
    return this.request('/friend/accept', {
      method: 'POST',
      body: JSON.stringify({ requestId }),
    })
  }

  async rejectFriendRequest(requestId: number): Promise<ApiResponse> {
    return this.request('/friend/reject', {
      method: 'POST',
      body: JSON.stringify({ requestId }),
    })
  }

  async getFriendRequests(): Promise<ApiResponse<FriendRequest[]>> {
    return this.request('/friend/requests')
  }

  async getFriendList(): Promise<ApiResponse<Friend[]>> {
    return this.request('/friend/list')
  }

  async deleteFriend(friendId: number): Promise<ApiResponse> {
    return this.request('/friend/delete', {
      method: 'POST',
      body: JSON.stringify({ friendId }),
    })
  }

  // ============================================================
  // 消息系统
  // ============================================================

  /**
   * 获取聊天历史
   *
   * Electron 迁移时：
   * - 优先从本地 SQLite 加载
   * - 增量同步服务器新消息
   * - 支持离线查看
   */
  async getHistory(friendId: number, page = 1, size = 20): Promise<ApiResponse<Message[]>> {
    return this.request(`/message/history?friendId=${friendId}&page=${page}&size=${size}`)
  }

  async getUnread(): Promise<ApiResponse<{ sender_id: number; count: number }[]>> {
    return this.request('/message/unread')
  }

  async recallMessage(messageId: number): Promise<ApiResponse<{ receiverId: number }>> {
    return this.request('/message/recall', {
      method: 'POST',
      body: JSON.stringify({ messageId }),
    })
  }

  /**
   * 上传文件
   *
   * Electron 迁移时：
   * - 支持大文件断点续传
   * - 支持文件夹上传
   * - 显示上传进度
   * - 支持拖拽上传
   */
  async uploadFile(file: File): Promise<ApiResponse<UploadResult>> {
    const form = new FormData()
    form.append('file', file)
    return this.request('/message/upload', {
      method: 'POST',
      body: form,
    })
  }

  // ============================================================
  // 群聊系统
  // ============================================================

  async createGroup(name: string, members: number[]): Promise<ApiResponse<{ groupId: number }>> {
    return this.request('/group/create', {
      method: 'POST',
      body: JSON.stringify({ name, members }),
    })
  }

  async getGroupList(): Promise<ApiResponse<Group[]>> {
    return this.request('/group/list')
  }

  async getGroupMembers(groupId: number): Promise<ApiResponse<User[]>> {
    return this.request(`/group/members?groupId=${groupId}`)
  }

  async joinGroup(groupId: number): Promise<ApiResponse> {
    return this.request('/group/join', {
      method: 'POST',
      body: JSON.stringify({ groupId }),
    })
  }

  async quitGroup(groupId: number): Promise<ApiResponse> {
    return this.request('/group/quit', {
      method: 'POST',
      body: JSON.stringify({ groupId }),
    })
  }

  async kickMember(groupId: number, userId: number): Promise<ApiResponse> {
    return this.request('/group/kick', {
      method: 'POST',
      body: JSON.stringify({ groupId, userId }),
    })
  }

  async transferOwner(groupId: number, newOwnerId: number): Promise<ApiResponse> {
    return this.request('/group/transfer', {
      method: 'POST',
      body: JSON.stringify({ groupId, newOwnerId }),
    })
  }

  async disbandGroup(groupId: number): Promise<ApiResponse> {
    return this.request('/group/disband', {
      method: 'POST',
      body: JSON.stringify({ groupId }),
    })
  }

  async getGroupHistory(groupId: number, page = 1, size = 20): Promise<ApiResponse<GroupMessage[]>> {
    return this.request(`/group/history?groupId=${groupId}&page=${page}&size=${size}`)
  }

  async recallGroupMessage(messageId: number): Promise<ApiResponse<{ groupId: number }>> {
    return this.request('/group/recall', {
      method: 'POST',
      body: JSON.stringify({ messageId }),
    })
  }

  // 获取 API 基础地址（用于文件链接）
  getApiBase(): string {
    return API_BASE
  }
}

export const api = new ApiService()
