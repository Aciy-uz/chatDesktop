<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useContactStore } from '@/stores/contact'
import { useAuthStore } from '@/stores/auth'
import { getFullAvatarUrl } from '@/utils/avatar'
import type { User, FriendRequest } from '@/types'

const emit = defineEmits<{
  startChat: [id: number, name: string, avatar: string, isGroup?: boolean]
}>()

const contactStore = useContactStore()
const authStore = useAuthStore()

const activeTab = ref<'friends' | 'groups' | 'requests'>('friends')
const searchKeyword = ref('')
const searchResults = ref<User[]>([])
const showSearch = ref(false)

// 搜索用户
async function handleSearch() {
  if (!searchKeyword.value.trim()) {
    showSearch.value = false
    return
  }
  showSearch.value = true
  searchResults.value = await contactStore.searchUsers(searchKeyword.value)
}

// 发送好友申请
async function sendRequest(user: User) {
  const result = await contactStore.sendFriendRequest(user.id)
  if (result.success) {
    alert('好友申请已发送')
  } else {
    alert(result.msg || '发送失败')
  }
}

// 创建群聊
const showCreateGroup = ref(false)
const newGroupName = ref('')
const selectedMembers = ref<number[]>([])

async function handleCreateGroup() {
  if (!newGroupName.value.trim()) {
    alert('请输入群名称')
    return
  }
  const groupName = newGroupName.value
  const result = await contactStore.createGroup(groupName, selectedMembers.value)
  if (result.success) {
    showCreateGroup.value = false
    newGroupName.value = ''
    selectedMembers.value = []
    // 跳转到新创建的群聊
    if (result.groupId) {
      emit('startChat', result.groupId, groupName, '', true)
    }
    alert('群创建成功')
  } else {
    alert(result.msg || '创建失败')
  }
}

function toggleMember(userId: number) {
  const index = selectedMembers.value.indexOf(userId)
  if (index > -1) {
    selectedMembers.value.splice(index, 1)
  } else {
    selectedMembers.value.push(userId)
  }
}
</script>

<template>
  <div class="contact-panel">
    <!-- 头部 -->
    <div class="header">
      <h3>通讯录</h3>
    </div>

    <!-- 搜索栏 -->
    <div class="search-bar">
      <input
        v-model="searchKeyword"
        type="text"
        placeholder="搜索用户..."
        @input="handleSearch"
      />
    </div>

    <!-- 搜索结果 -->
    <div v-if="showSearch" class="search-results">
      <div class="section-title">
        搜索结果
        <button class="close-btn" @click="showSearch = false; searchKeyword = ''">×</button>
      </div>
      <div v-if="searchResults.length === 0" class="empty-hint">未找到用户</div>
      <div
        v-for="user in searchResults"
        :key="user.id"
        class="contact-item"
      >
        <div class="avatar">
          <img v-if="user.avatarUrl || user.avatar" :src="getFullAvatarUrl(user.avatarUrl || user.avatar)" :alt="user.nickname" />
          <div v-else class="avatar-placeholder">{{ user.nickname?.charAt(0) || user.username.charAt(0) }}</div>
        </div>
        <div class="info">
          <span class="name">{{ user.nickname || user.username }}</span>
          <span class="username">@{{ user.username }}</span>
        </div>
        <button class="add-btn" @click="sendRequest(user)">加好友</button>
      </div>
    </div>

    <!-- 标签页 -->
    <div v-else class="tabs-container">
      <div class="tabs">
        <button
          :class="{ active: activeTab === 'friends' }"
          @click="activeTab = 'friends'"
        >
          好友
        </button>
        <button
          :class="{ active: activeTab === 'groups' }"
          @click="activeTab = 'groups'"
        >
          群聊
        </button>
        <button
          :class="{ active: activeTab === 'requests' }"
          @click="activeTab = 'requests'"
        >
          申请
          <span v-if="contactStore.pendingRequestCount > 0" class="tab-badge">
            {{ contactStore.pendingRequestCount }}
          </span>
        </button>
      </div>

      <!-- 好友列表 -->
      <div v-if="activeTab === 'friends'" class="list">
        <div
          v-for="friend in contactStore.friends"
          :key="friend.id"
          class="contact-item"
          @click="emit('startChat', friend.id, friend.nickname || friend.username, friend.avatarUrl || friend.avatar)"
        >
          <div class="avatar">
            <img :src="getFullAvatarUrl(friend.avatarUrl || friend.avatar)" :alt="friend.nickname" />
            <span v-if="contactStore.isOnline(friend.id)" class="online-dot"></span>
          </div>
          <div class="info">
            <span class="name">{{ friend.nickname || friend.username }}</span>
          </div>
          <span v-if="friend.unread_count > 0" class="unread-badge">{{ friend.unread_count }}</span>
        </div>
        <div v-if="contactStore.friends.length === 0" class="empty-hint">暂无好友</div>
      </div>

      <!-- 群聊列表 -->
      <div v-if="activeTab === 'groups'" class="list">
        <button class="create-group-btn" @click="showCreateGroup = true">+ 创建群聊</button>
        <div
          v-for="group in contactStore.groups"
          :key="group.id"
          class="contact-item"
          @click="emit('startChat', group.id, group.name, '', true)"
        >
          <div class="avatar group-avatar">
            <div class="avatar-placeholder">{{ group.name.charAt(0) }}</div>
          </div>
          <div class="info">
            <span class="name">{{ group.name }}</span>
          </div>
        </div>
        <div v-if="contactStore.groups.length === 0" class="empty-hint">暂无群聊</div>
      </div>

      <!-- 好友申请 -->
      <div v-if="activeTab === 'requests'" class="list">
        <div
          v-for="req in contactStore.friendRequests"
          :key="req.id"
          class="contact-item request-item"
        >
          <div class="avatar">
            <img v-if="req.avatar" :src="getFullAvatarUrl(req.avatar)" :alt="req.nickname" />
            <div v-else class="avatar-placeholder">{{ (req.nickname || req.username || '?').charAt(0) }}</div>
          </div>
          <div class="info">
            <span class="name">{{ req.nickname || req.username }}</span>
            <span class="message">{{ req.message || '请求添加你为好友' }}</span>
          </div>
          <div class="actions">
            <button class="accept-btn" @click="contactStore.acceptRequest(req.id)">接受</button>
            <button class="reject-btn" @click="contactStore.rejectRequest(req.id)">拒绝</button>
          </div>
        </div>
        <div v-if="contactStore.friendRequests.length === 0" class="empty-hint">暂无申请</div>
      </div>
    </div>

    <!-- 创建群聊弹窗 -->
    <div v-if="showCreateGroup" class="modal-overlay" @click.self="showCreateGroup = false">
      <div class="modal">
        <h3>创建群聊</h3>
        <input v-model="newGroupName" placeholder="群名称" />
        <div class="member-select">
          <p>选择成员：</p>
          <div
            v-for="friend in contactStore.friends"
            :key="friend.id"
            class="member-option"
            :class="{ selected: selectedMembers.includes(friend.id) }"
            @click="toggleMember(friend.id)"
          >
            <img :src="getFullAvatarUrl(friend.avatarUrl || friend.avatar)" :alt="friend.nickname" />
            <span>{{ friend.nickname || friend.username }}</span>
          </div>
        </div>
        <div class="modal-actions">
          <button @click="showCreateGroup = false">取消</button>
          <button class="primary" @click="handleCreateGroup">创建</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.contact-panel {
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

.search-bar {
  padding: 12px 16px;
}

.search-bar input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
  box-sizing: border-box;
}

.search-bar input:focus {
  border-color: #667eea;
}

.tabs {
  display: flex;
  border-bottom: 1px solid #f0f0f0;
  padding: 0 16px;
}

.tabs button {
  flex: 1;
  padding: 12px 0;
  border: none;
  background: none;
  font-size: 14px;
  color: #666;
  cursor: pointer;
  position: relative;
  transition: color 0.2s;
}

.tabs button:hover {
  color: #333;
}

.tabs button.active {
  color: #667eea;
  font-weight: 600;
}

.tabs button.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 20%;
  right: 20%;
  height: 2px;
  background: #667eea;
  border-radius: 1px;
}

.tab-badge {
  position: absolute;
  top: 6px;
  right: 10%;
  background: #ff4d4f;
  color: #fff;
  font-size: 10px;
  min-width: 16px;
  height: 16px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
}

.list {
  flex: 1;
  overflow-y: auto;
}

.contact-item {
  display: flex;
  padding: 12px 16px;
  cursor: pointer;
  transition: background 0.15s;
  gap: 12px;
  align-items: center;
}

.contact-item:hover {
  background: #f5f5f5;
}

.avatar {
  width: 44px;
  height: 44px;
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
  font-size: 16px;
  font-weight: 600;
}

.online-dot {
  position: absolute;
  bottom: 2px;
  right: 2px;
  width: 10px;
  height: 10px;
  background: #52c41a;
  border: 2px solid #fff;
  border-radius: 50%;
}

.info {
  flex: 1;
  min-width: 0;
}

.info .name {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: #333;
}

.info .username {
  display: block;
  font-size: 12px;
  color: #999;
}

.info .message {
  display: block;
  font-size: 12px;
  color: #999;
  margin-top: 2px;
}

.add-btn {
  padding: 6px 16px;
  background: #667eea;
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  transition: opacity 0.2s;
}

.add-btn:hover {
  opacity: 0.9;
}

.unread-badge {
  background: #ff4d4f;
  color: #fff;
  font-size: 11px;
  min-width: 20px;
  height: 20px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 5px;
}

.request-item .actions {
  display: flex;
  gap: 8px;
}

.accept-btn, .reject-btn {
  padding: 6px 14px;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
}

.accept-btn {
  background: #52c41a;
  color: #fff;
}

.reject-btn {
  background: #f5f5f5;
  color: #666;
}

.create-group-btn {
  width: calc(100% - 32px);
  margin: 12px 16px;
  padding: 10px;
  background: #f5f5f5;
  border: 1px dashed #d9d9d9;
  border-radius: 8px;
  font-size: 14px;
  color: #666;
  cursor: pointer;
  transition: all 0.2s;
}

.create-group-btn:hover {
  border-color: #667eea;
  color: #667eea;
}

.empty-hint {
  text-align: center;
  padding: 40px 20px;
  color: #999;
  font-size: 14px;
}

.section-title {
  padding: 12px 16px;
  font-size: 13px;
  color: #999;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.close-btn {
  background: none;
  border: none;
  font-size: 18px;
  color: #999;
  cursor: pointer;
}

.search-results {
  flex: 1;
  overflow-y: auto;
}

/* 模态框 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  width: 90%;
  max-width: 400px;
  max-height: 80vh;
  overflow-y: auto;
}

.modal h3 {
  margin: 0 0 16px;
  font-size: 18px;
}

.modal input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  font-size: 14px;
  outline: none;
  box-sizing: border-box;
  margin-bottom: 16px;
}

.member-select {
  margin-bottom: 16px;
}

.member-select p {
  font-size: 14px;
  color: #666;
  margin: 0 0 8px;
}

.member-option {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
}

.member-option:hover {
  background: #f5f5f5;
}

.member-option.selected {
  background: #e8e8ff;
}

.member-option img {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  object-fit: cover;
}

.member-option span {
  font-size: 14px;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.modal-actions button {
  padding: 8px 20px;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  background: #fff;
}

.modal-actions button.primary {
  background: #667eea;
  color: #fff;
  border-color: #667eea;
}
</style>
