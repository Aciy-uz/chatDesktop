<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useContactStore } from '@/stores/contact'
import { useChatStore } from '@/stores/chat'
import { socketService } from '@/services/socket'
import Sidebar from '@/components/Sidebar.vue'
import SessionList from '@/components/SessionList.vue'
import ChatWindow from '@/components/ChatWindow.vue'
import ContactPanel from '@/components/ContactPanel.vue'
import { ref } from 'vue'

const authStore = useAuthStore()
const contactStore = useContactStore()
const chatStore = useChatStore()

const activePanel = ref<'chat' | 'contact'>('chat')

// 切换到通讯录时刷新群列表
watch(activePanel, (val) => {
  if (val === 'contact') {
    contactStore.loadGroups()
  }
})

// 初始化 WebSocket 监听
function initSocketListeners() {
  socketService.on('online_users', (userIds: number[]) => {
    contactStore.setOnlineUsers(userIds)
  })

  socketService.on('user_online', ({ userId }: { userId: number }) => {
    contactStore.userOnline(userId)
  })

  socketService.on('user_offline', ({ userId }: { userId: number }) => {
    contactStore.userOffline(userId)
  })

  socketService.on('private_message', (msg: any) => {
    chatStore.handlePrivateMessage(msg)
  })

  socketService.on('group_message', (msg: any) => {
    console.log('[WebSocket] 收到群消息:', msg)
    chatStore.handleGroupMessage(msg)
  })

  socketService.on('unread_messages', (grouped: Record<number, any[]>) => {
    chatStore.handleUnreadMessages(grouped)
  })

  socketService.on('messages_read', ({ readerId }: { readerId: number }) => {
    // 可以在这里更新消息已读状态
  })

  socketService.on('message_recall', ({ messageId, senderId }: { messageId: number; senderId: number }) => {
    // 更新所有私聊消息存储中的撤回状态
    chatStore.handleMessageRecall(messageId, senderId, false, senderId)
  })

  socketService.on('group_message_recall', ({ messageId, senderId, groupId }: { messageId: number; senderId: number; groupId: number }) => {
    chatStore.handleMessageRecall(messageId, senderId, true, groupId)
  })
}

onMounted(async () => {
  // 连接 WebSocket
  if (!socketService.isConnected()) {
    console.log('[Socket] 连接 token:', authStore.token?.substring(0, 20) + '...')
    socketService.connect(authStore.token)
  }

  initSocketListeners()

  // 先恢复保存的会话
  const hasRestoredSessions = await chatStore.restoreSessions()

  // 加载好友和群列表
  await Promise.all([
    contactStore.loadFriends(),
    contactStore.loadGroups(),
    contactStore.loadFriendRequests(),
  ])

  // 如果恢复了活跃会话，加载对应的历史消息
  if (hasRestoredSessions && chatStore.activeSession) {
    const session = chatStore.activeSession
    if (session.type === 'private') {
      await chatStore.loadPrivateHistory(session.targetId)
    } else {
      await chatStore.loadGroupHistory(session.targetId)
    }
  }
})

onUnmounted(() => {
  // 只在非退出登录的情况下断开连接
  // logout 会先断开连接，所以这里检查是否还连接着
  if (socketService.isConnected()) {
    socketService.disconnect()
  }
})
</script>

<template>
  <div class="chat-layout" v-if="authStore.user">
    <!-- 左侧边栏 -->
    <Sidebar
      v-model:active-panel="activePanel"
      :user="authStore.user"
    />

    <!-- 会话列表 / 联系人面板 -->
    <div class="panel-area">
      <SessionList
        v-if="activePanel === 'chat'"
        :sessions="chatStore.sessions"
        :active-session-id="chatStore.activeSession?.id"
        @select="(session) => {
          if (session.type === 'private') {
            chatStore.openPrivateChat(session.targetId, session.name, session.avatar)
          } else {
            chatStore.openGroupChat(session.targetId, session.name)
          }
        }"
      />
      <ContactPanel
        v-else
        @start-chat="(id, name, avatar, isGroup) => {
          if (isGroup) {
            chatStore.openGroupChat(id, name)
          } else {
            chatStore.openPrivateChat(id, name, avatar)
          }
          activePanel = 'chat'
        }"
      />
    </div>

    <!-- 聊天窗口 -->
    <ChatWindow
      v-if="chatStore.activeSession"
      :session="chatStore.activeSession"
    />
    <div v-else class="empty-chat">
      <div class="empty-content">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2ZM20 16H5.17L4 17.17V4H20V16Z" fill="currentColor"/>
        </svg>
        <p>选择一个会话开始聊天</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chat-layout {
  display: flex;
  height: 100vh;
  background: #f0f2f5;
}

.panel-area {
  width: 320px;
  min-width: 320px;
  background: #fff;
  border-right: 1px solid #e8e8e8;
  display: flex;
  flex-direction: column;
}

.empty-chat {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f5f5;
}

.empty-content {
  text-align: center;
  color: #ccc;
}

.empty-content svg {
  width: 80px;
  height: 80px;
  margin-bottom: 16px;
}

.empty-content p {
  font-size: 16px;
  margin: 0;
}
</style>
