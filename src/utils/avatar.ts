/**
 * 头像 URL 处理工具
 *
 * 解决头像显示问题：
 * - 服务器返回的可能是相对路径（如 /uploads/xxx.png）
 * - 需要拼接 API 基础地址
 * - 处理空值和默认头像
 * - 支持离线缓存
 */

import { api } from '@/services/api'
import { getCachedAvatar, cacheAvatar } from './avatarCache'

const API_BASE = api.getApiBase()

/**
 * 获取完整的头像 URL（支持缓存）
 *
 * @param avatar 头像路径（可能是相对路径或完整 URL）
 * @returns 完整的头像 URL，如果没有头像则返回空字符串
 */
export function getFullAvatarUrl(avatar: string | null | undefined): string {
  if (!avatar) return ''

  let fullUrl = avatar

  // 如果是相对路径，拼接 API 基础地址
  if (!avatar.startsWith('http://') && !avatar.startsWith('https://') && !avatar.startsWith('data:')) {
    if (avatar.startsWith('/')) {
      fullUrl = `${API_BASE}${avatar}`
    } else {
      fullUrl = `${API_BASE}/${avatar}`
    }
  }

  // 检查缓存
  const cached = getCachedAvatar(fullUrl)
  if (cached !== fullUrl) {
    return cached
  }

  // 异步下载并缓存（不阻塞渲染）
  cacheAvatar(fullUrl).catch(() => {})

  return fullUrl
}

/**
 * 获取用户头像首字母（用于占位符）
 *
 * @param name 用户名或昵称
 * @returns 首字符
 */
export function getAvatarPlaceholder(name: string): string {
  if (!name) return '?'
  return name.charAt(0).toUpperCase()
}
