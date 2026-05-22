/**
 * Auth Store - 认证状态管理
 *
 * 负责用户登录、登出、Token 管理等功能。
 *
 * ## Electron 迁移说明
 *
 * 当前使用 localStorage 存储 Token 和用户信息，迁移到 Electron 后建议：
 *
 * 1. **Token 存储** - 使用 electron-store 或 keytar
 *    - electron-store: 简单键值存储，数据存储在 userData 目录
 *    - keytar: 系统级安全存储（Windows 凭据管理器 / macOS 钥匙串）
 *    - 替换位置：login() / restore() 中的 localStorage 操作
 *
 * 2. **用户信息** - 使用 electron-store
 *    - 存储路径：app.getPath('userData')/config.json
 *    - 替换位置：login() / updateUser() 中的 localStorage 操作
 *
 * 3. **自动登录** - Electron 可实现开机自启 + 自动登录
 *    - 检查 Token 有效性
 *    - 自动刷新过期 Token（如果后端支持）
 *
 * ## 安全建议
 *
 * - 生产环境应使用 keytar 存储敏感信息
 * - Token 应设置合理的过期时间
 * - 实现 Token 自动刷新机制
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { User } from '@/types'
import { api } from '@/services/api'
import { socketService } from '@/services/socket'
import { encryptPassword } from '@/services/rsa'

// ============================================================
// 存储 Key 配置
// Electron 迁移时：替换为 electron-store 的 key
// ============================================================
const TOKEN_KEY = 'chat_token'
const USER_KEY = 'chat_user'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const token = ref<string>('')
  const isLoggedIn = computed(() => !!token.value && !!user.value)

  // ============================================================
  // 状态恢复
  // ============================================================

  /**
   * 从持久化存储恢复登录状态
   *
   * Electron 迁移方案：
   * ```typescript
   * import Store from 'electron-store'
   * const store = new Store()
   *
   * function restore(): void {
   *   const savedToken = store.get(TOKEN_KEY) as string
   *   const savedUser = store.get(USER_KEY) as User
   *   if (savedToken && savedUser) {
   *     token.value = savedToken
   *     user.value = savedUser
   *     api.setToken(savedToken)
   *   }
   * }
   * ```
   */
  function restore(): void {
    // 当前实现：localStorage
    const savedToken = localStorage.getItem(TOKEN_KEY)
    const savedUser = localStorage.getItem(USER_KEY)

    // Electron 迁移实现（示例）：
    // const savedToken = window.electronAPI.getToken()
    // const savedUser = window.electronAPI.getUser()

    if (savedToken && savedUser) {
      token.value = savedToken
      user.value = JSON.parse(savedUser)
      api.setToken(savedToken)
    }
  }

  // ============================================================
  // 登录
  // ============================================================

  /**
   * 用户登录
   *
   * Electron 迁移时：
   * - Token 存储到 electron-store 或 keytar
   * - 用户信息存储到 electron-store
   * - 可选：记住密码功能（加密存储）
   */
  async function login(username: string, password: string, captchaId: string, captchaCode: string): Promise<{ success: boolean; msg?: string }> {
    try {
      const encrypted = await encryptPassword(password)
      const res = await api.login({ username, encrypted, captchaId, captchaCode })

      if (res.code === 200 && res.data) {
        token.value = res.data.token
        user.value = res.data.user
        api.setToken(res.data.token)

        // 当前实现：localStorage
        localStorage.setItem(TOKEN_KEY, res.data.token)
        localStorage.setItem(USER_KEY, JSON.stringify(res.data.user))

        // Electron 迁移实现（示例）：
        // window.electronAPI.saveToken(res.data.token)
        // window.electronAPI.saveUser(res.data.user)
        // 或使用 electron-store：
        // store.set(TOKEN_KEY, res.data.token)
        // store.set(USER_KEY, res.data.user)

        // 连接 WebSocket
        socketService.connect(res.data.token)

        return { success: true }
      }
      return { success: false, msg: res.msg }
    } catch (err: any) {
      return { success: false, msg: err.message || '网络错误' }
    }
  }

  // ============================================================
  // 注册
  // ============================================================

  async function register(formData: FormData): Promise<{ success: boolean; msg?: string }> {
    try {
      const res = await api.register(formData)
      if (res.code === 200) {
        return { success: true }
      }
      return { success: false, msg: res.msg }
    } catch (err: any) {
      return { success: false, msg: err.message || '网络错误' }
    }
  }

  // ============================================================
  // 登出
  // ============================================================

  /**
   * 用户登出
   *
   * Electron 迁移时：
   * - 清除 electron-store 中的 Token
   * - 可选：清除 keytar 中的凭据
   * - 可选：清除本地聊天数据库
   */
  function logout(): void {
    // 先断开 WebSocket
    socketService.disconnect()

    // 清理状态
    user.value = null
    token.value = ''
    api.setToken('')

    // 当前实现：localStorage
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)

    // Electron 迁移实现（示例）：
    // window.electronAPI.clearToken()
    // window.electronAPI.clearUser()
    // 或使用 electron-store：
    // store.delete(TOKEN_KEY)
    // store.delete(USER_KEY)
  }

  // ============================================================
  // 用户信息更新
  // ============================================================

  /**
   * 更新用户信息
   *
   * Electron 迁移时：同步更新 electron-store
   */
  function updateUser(updates: Partial<User>): void {
    if (user.value) {
      user.value = { ...user.value, ...updates }

      // 当前实现：localStorage
      localStorage.setItem(USER_KEY, JSON.stringify(user.value))

      // Electron 迁移实现（示例）：
      // window.electronAPI.saveUser(user.value)
      // 或：
      // store.set(USER_KEY, user.value)
    }
  }

  return {
    user,
    token,
    isLoggedIn,
    restore,
    login,
    register,
    logout,
    updateUser,
  }
})
