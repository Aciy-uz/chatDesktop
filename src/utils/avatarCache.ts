/**
 * 头像缓存工具
 *
 * 将远程头像下载并缓存到本地，避免离线时无法显示
 */

const avatarCache = new Map<string, string>()

// 获取头像缓存路径
function getCacheKey(url: string): string {
  return `avatar_${url.replace(/[^a-zA-Z0-9]/g, '_')}`
}

// 缓存头像到 localStorage（Base64）
export async function cacheAvatar(url: string): Promise<string> {
  // 检查内存缓存
  if (avatarCache.has(url)) {
    return avatarCache.get(url)!
  }

  // 检查 localStorage 缓存
  const cacheKey = getCacheKey(url)
  const cached = localStorage.getItem(cacheKey)
  if (cached) {
    avatarCache.set(url, cached)
    return cached
  }

  // 下载并缓存
  try {
    const response = await fetch(url)
    const blob = await response.blob()

    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64 = reader.result as string
        // 保存到 localStorage
        try {
          localStorage.setItem(cacheKey, base64)
        } catch (e) {
          // localStorage 满了，清理旧缓存
          clearOldCache()
          try {
            localStorage.setItem(cacheKey, base64)
          } catch {
            // 还是满了，就不缓存了
          }
        }
        avatarCache.set(url, base64)
        resolve(base64)
      }
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  } catch {
    // 下载失败，返回原始 URL
    return url
  }
}

// 获取头像（优先使用缓存）
export function getCachedAvatar(url: string): string {
  if (!url) return ''

  // 如果是本地路径或 data URL，直接返回
  if (url.startsWith('data:') || url.startsWith('blob:')) {
    return url
  }

  // 检查内存缓存
  if (avatarCache.has(url)) {
    return avatarCache.get(url)!
  }

  // 检查 localStorage 缓存
  const cacheKey = getCacheKey(url)
  const cached = localStorage.getItem(cacheKey)
  if (cached) {
    avatarCache.set(url, cached)
    return cached
  }

  // 返回原始 URL（异步下载会在 getFullAvatarUrl 中触发）
  return url
}

// 异步加载头像并更新
export async function loadAvatar(url: string, callback: (cachedUrl: string) => void): Promise<void> {
  if (!url || url.startsWith('data:')) return

  const cached = getCachedAvatar(url)
  if (cached !== url) {
    callback(cached)
    return
  }

  // 异步下载
  const cachedUrl = await cacheAvatar(url)
  if (cachedUrl !== url) {
    callback(cachedUrl)
  }
}

// 清理旧缓存
function clearOldCache(): void {
  const keysToRemove: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && key.startsWith('avatar_')) {
      keysToRemove.push(key)
    }
  }
  // 删除一半的缓存
  const half = Math.floor(keysToRemove.length / 2)
  for (let i = 0; i < half; i++) {
    if (keysToRemove[i]) {
      localStorage.removeItem(keysToRemove[i]!)
    }
  }
}

// 清除所有头像缓存
export function clearAvatarCache(): void {
  avatarCache.clear()
  const keysToRemove: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && key.startsWith('avatar_')) {
      keysToRemove.push(key)
    }
  }
  keysToRemove.forEach(key => localStorage.removeItem(key))
}
