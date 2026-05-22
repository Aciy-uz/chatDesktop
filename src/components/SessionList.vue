<script setup lang="ts">
import type { ChatSession } from '@/types'
import { useContactStore } from '@/stores/contact'
import { getFullAvatarUrl } from '@/utils/avatar'

const props = defineProps<{
  sessions: ChatSession[]
  activeSessionId?: string
}>()

const emit = defineEmits<{
  select: [session: ChatSession]
}>()

const contactStore = useContactStore()

function formatTime(time?: string): string {
  if (!time) return ''
  const date = new Date(time)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()

  if (isToday) {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }

  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) {
    return '昨天'
  }

  return date.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' })
}

function getAvatar(session: ChatSession): string {
  if (session.type === 'group') {
    return getFullAvatarUrl(session.avatar)
  }
  // 优先从好友列表获取最新头像
  const friend = contactStore.friends.find(f => f.id === session.targetId)
  if (friend) {
    return getFullAvatarUrl(friend.avatarUrl || friend.avatar)
  }
  // 否则使用会话中保存的头像
  return getFullAvatarUrl(session.avatar)
}
</script>

<template>
  <div class="session-list">
    <div class="header">
      <h3>聊天</h3>
    </div>

    <div class="sessions">
      <div
        v-for="session in sessions"
        :key="session.id"
        class="session-item"
        :class="{ active: session.id === activeSessionId }"
        @click="emit('select', session)"
      >
        <div class="avatar">
          <img v-if="getAvatar(session)" :src="getAvatar(session)" :alt="session.name" />
          <div v-else class="avatar-placeholder">
            {{ session.name.charAt(0) }}
          </div>
          <span v-if="session.type === 'group'" class="group-badge">群</span>
        </div>

        <div class="info">
          <div class="top-row">
            <span class="name">{{ session.name }}</span>
            <span class="time">{{ formatTime(session.lastTime) }}</span>
          </div>
          <div class="bottom-row">
            <span class="last-msg">{{ session.lastMessage || '暂无消息' }}</span>
            <span v-if="session.unreadCount > 0" class="unread">
              {{ session.unreadCount > 99 ? '99+' : session.unreadCount }}
            </span>
          </div>
        </div>
      </div>

      <div v-if="sessions.length === 0" class="empty">
        <p>暂无会话</p>
        <p class="hint">在通讯录中选择好友开始聊天</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.session-list {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.header {
  padding: 16px 16px 12px;
  border-bottom: 1px solid #f0f0f0;
}

.header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.sessions {
  flex: 1;
  overflow-y: auto;
}

.session-item {
  display: flex;
  padding: 12px 16px;
  cursor: pointer;
  transition: background 0.15s;
  gap: 12px;
}

.session-item:hover {
  background: #f5f5f5;
}

.session-item.active {
  background: #e8e8e8;
}

.avatar {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  overflow: hidden;
  flex-shrink: 0;
  position: relative;
}

.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 600;
}

.group-badge {
  position: absolute;
  bottom: 0;
  right: 0;
  background: #52c41a;
  color: #fff;
  font-size: 10px;
  padding: 1px 4px;
  border-radius: 4px 0 0 0;
}

.info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.top-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.name {
  font-size: 15px;
  font-weight: 500;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.time {
  font-size: 12px;
  color: #999;
  flex-shrink: 0;
  margin-left: 8px;
}

.bottom-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.last-msg {
  font-size: 13px;
  color: #999;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.unread {
  background: #ff4d4f;
  color: #fff;
  font-size: 11px;
  min-width: 18px;
  height: 18px;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 5px;
  flex-shrink: 0;
  margin-left: 8px;
}

.empty {
  text-align: center;
  padding: 60px 20px;
  color: #999;
}

.empty p {
  margin: 0 0 4px;
}

.hint {
  font-size: 13px;
  color: #bbb;
}
</style>
