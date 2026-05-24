import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Friend, FriendRequest, Group, User } from '@/types'
import { api } from '@/services/api'
import * as storage from '@/services/storage'
import { useAuthStore } from './auth'

export const useContactStore = defineStore('contact', () => {
  const friends = ref<Friend[]>([])
  const groups = ref<Group[]>([])
  const friendRequests = ref<FriendRequest[]>([])
  const onlineUserIds = ref<Set<number>>(new Set())

  // 好友申请数量
  const pendingRequestCount = computed(() => friendRequests.value.length)

  // 从缓存恢复
  function restoreFromCache(): void {
    const authStore = useAuthStore()
    if (!authStore.user) return

    const cachedFriends = storage.loadFriends(authStore.user.id)
    if (cachedFriends.length > 0) {
      friends.value = cachedFriends
    }

    const cachedGroups = storage.loadGroups(authStore.user.id)
    if (cachedGroups.length > 0) {
      groups.value = cachedGroups
    }
  }

  // 获取好友列表
  async function loadFriends(): Promise<void> {
    const authStore = useAuthStore()

    // 先从缓存加载
    if (authStore.user) {
      const cachedFriends = storage.loadFriends(authStore.user.id)
      if (cachedFriends.length > 0) {
        friends.value = cachedFriends
      }
    }

    // 再从服务器加载
    const res = await api.getFriendList()
    if (res.code === 200 && res.data) {
      friends.value = res.data
      // 保存到缓存
      if (authStore.user) {
        storage.saveFriends(authStore.user.id, res.data)
      }
    }
  }

  // 获取群列表
  async function loadGroups(): Promise<void> {
    const authStore = useAuthStore()

    // 先从缓存加载
    if (authStore.user) {
      const cachedGroups = storage.loadGroups(authStore.user.id)
      if (cachedGroups.length > 0) {
        groups.value = cachedGroups
      }
    }

    // 再从服务器加载
    const res = await api.getGroupList()
    if (res.code === 200 && res.data) {
      groups.value = res.data
      // 保存到缓存
      if (authStore.user) {
        storage.saveGroups(authStore.user.id, res.data)
      }
    }
  }

  // 获取好友申请
  async function loadFriendRequests(): Promise<void> {
    const res = await api.getFriendRequests()
    if (res.code === 200 && res.data) {
      friendRequests.value = res.data
    }
  }

  // 发送好友申请
  async function sendFriendRequest(friendId: number, message?: string): Promise<{ success: boolean; msg?: string }> {
    const res = await api.sendFriendRequest(friendId, message)
    return { success: res.code === 200, msg: res.msg }
  }

  // 接受好友申请
  async function acceptRequest(requestId: number): Promise<boolean> {
    const res = await api.acceptFriendRequest(requestId)
    if (res.code === 200) {
      await loadFriends()
      await loadFriendRequests()
      return true
    }
    return false
  }

  // 拒绝好友申请
  async function rejectRequest(requestId: number): Promise<boolean> {
    const res = await api.rejectFriendRequest(requestId)
    if (res.code === 200) {
      await loadFriendRequests()
      return true
    }
    return false
  }

  // 删除好友
  async function removeFriend(friendId: number): Promise<boolean> {
    const res = await api.deleteFriend(friendId)
    if (res.code === 200) {
      friends.value = friends.value.filter((f) => f.id !== friendId)
      return true
    }
    return false
  }

  // 搜索用户
  async function searchUsers(keyword: string): Promise<User[]> {
    const res = await api.searchUsers(keyword)
    return res.data || []
  }

  // 创建群
  async function createGroup(name: string, members: number[]): Promise<{ success: boolean; groupId?: number; msg?: string }> {
    const res = await api.createGroup(name, members)
    if (res.code === 200 && res.data) {
      await loadGroups()
      return { success: true, groupId: res.data.groupId }
    }
    return { success: false, msg: res.msg }
  }

  // 更新好友未读数
  function setUnreadCount(userId: number, count: number): void {
    const friend = friends.value.find((f) => f.id === userId)
    if (friend) {
      friend.unread_count = count
    }
  }

  // 增加好友未读数
  function incrementUnread(userId: number): void {
    const friend = friends.value.find((f) => f.id === userId)
    if (friend) {
      friend.unread_count++
    }
  }

  // 清除好友未读数
  function clearUnread(userId: number): void {
    const friend = friends.value.find((f) => f.id === userId)
    if (friend) {
      friend.unread_count = 0
    }
  }

  // 设置在线用户
  function setOnlineUsers(userIds: number[]): void {
    onlineUserIds.value = new Set(userIds)
  }

  // 用户上线
  function userOnline(userId: number): void {
    onlineUserIds.value.add(userId)
  }

  // 用户下线
  function userOffline(userId: number): void {
    onlineUserIds.value.delete(userId)
  }

  // 检查用户是否在线
  function isOnline(userId: number): boolean {
    return onlineUserIds.value.has(userId)
  }

  return {
    friends,
    groups,
    friendRequests,
    onlineUserIds,
    pendingRequestCount,
    restoreFromCache,
    loadFriends,
    loadGroups,
    loadFriendRequests,
    sendFriendRequest,
    acceptRequest,
    rejectRequest,
    removeFriend,
    searchUsers,
    createGroup,
    setUnreadCount,
    incrementUnread,
    clearUnread,
    setOnlineUsers,
    userOnline,
    userOffline,
    isOnline,
  }
})
