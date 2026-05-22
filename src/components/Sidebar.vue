<script setup lang="ts">
import type { User } from '@/types'
import { useContactStore } from '@/stores/contact'
import { useAuthStore } from '@/stores/auth'
import { useChatStore } from '@/stores/chat'
import { useRouter } from 'vue-router'
import { ref, computed } from 'vue'
import { getFullAvatarUrl } from '@/utils/avatar'
import { api } from '@/services/api'

const props = defineProps<{
  user: User
  activePanel: 'chat' | 'contact'
}>()

const emit = defineEmits<{
  'update:activePanel': [value: 'chat' | 'contact']
  'update:user': [user: User]
}>()

const contactStore = useContactStore()
const authStore = useAuthStore()
const chatStore = useChatStore()
const router = useRouter()

const pendingCount = computed(() => contactStore.pendingRequestCount)

const userAvatar = computed(() => {
  return getFullAvatarUrl(props.user.avatarUrl || props.user.avatar)
})

// 设置弹窗
const showSettings = ref(false)
const settingsTab = ref<'profile' | 'security'>('profile')

// 修改昵称
const newNickname = ref('')
const nicknameLoading = ref(false)

// 修改头像
const avatarLoading = ref(false)
const avatarPreview = ref('')

function switchPanel(panel: 'chat' | 'contact') {
  emit('update:activePanel', panel)
}

function openSettings() {
  showSettings.value = true
  newNickname.value = props.user.nickname || ''
  avatarPreview.value = ''
}

// 修改昵称
async function handleUpdateNickname() {
  if (!newNickname.value.trim()) {
    alert('请输入昵称')
    return
  }
  nicknameLoading.value = true
  const res = await api.updateNickname(newNickname.value.trim())
  nicknameLoading.value = false

  if (res.code === 200) {
    authStore.updateUser({ nickname: newNickname.value.trim() })
    alert('昵称修改成功')
  } else {
    alert(res.msg || '修改失败')
  }
}

// 选择头像
function onAvatarChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) {
    avatarPreview.value = URL.createObjectURL(file)
  }
}

// 上传头像
async function handleUpdateAvatar() {
  const input = document.getElementById('settings-avatar-input') as HTMLInputElement
  const file = input?.files?.[0]
  if (!file) {
    alert('请选择头像')
    return
  }

  avatarLoading.value = true
  const res = await api.updateAvatar(file)
  avatarLoading.value = false

  if (res.code === 200 && res.data) {
    authStore.updateUser({
      avatar: res.data.avatarUrl,
      avatarUrl: res.data.avatarUrl,
    })
    avatarPreview.value = ''
    alert('头像修改成功')
  } else {
    alert(res.msg || '修改失败')
  }
}

// 退出登录
function handleLogout() {
  if (!confirm('确定要退出登录吗？')) return
  showSettings.value = false
  chatStore.clearAll()
  authStore.logout()
  router.push('/login')
}
</script>

<template>
  <div class="sidebar">
    <!-- 用户头像 -->
    <div class="user-avatar" @click="openSettings">
      <img v-if="userAvatar" :src="userAvatar" :alt="user.nickname" />
      <div v-else class="avatar-placeholder">{{ user.nickname?.charAt(0) || '?' }}</div>
    </div>

    <!-- 导航按钮 -->
    <div class="nav-buttons">
      <button
        class="nav-btn"
        :class="{ active: activePanel === 'chat' }"
        @click="switchPanel('chat')"
        title="聊天"
      >
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2ZM20 16H5.17L4 17.17V4H20V16Z" fill="currentColor"/>
        </svg>
      </button>

      <button
        class="nav-btn"
        :class="{ active: activePanel === 'contact' }"
        @click="switchPanel('contact')"
        title="通讯录"
      >
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M15 12C17.21 12 19 10.21 19 8C19 5.79 17.21 4 15 4C12.79 4 11 5.79 11 8C11 10.21 12.79 12 15 12ZM6 10V7H4V10H1V12H4V15H6V12H9V10H6ZM15 14C12.33 14 7 15.34 7 18V20H23V18C23 15.34 17.67 14 15 14Z" fill="currentColor"/>
        </svg>
        <span v-if="pendingCount > 0" class="badge">{{ pendingCount > 99 ? '99+' : pendingCount }}</span>
      </button>
    </div>

    <!-- 底部设置 -->
    <div class="bottom-actions">
      <button class="nav-btn" @click="openSettings" title="设置">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M19.14 12.94C19.18 12.64 19.2 12.33 19.2 12C19.2 11.68 19.18 11.36 19.13 11.06L21.16 9.48C21.34 9.34 21.39 9.07 21.28 8.87L19.36 5.55C19.24 5.33 18.99 5.26 18.77 5.33L16.38 6.29C15.88 5.91 15.35 5.59 14.76 5.35L14.4 2.81C14.36 2.57 14.16 2.4 13.92 2.4H10.08C9.84 2.4 9.65 2.57 9.61 2.81L9.25 5.35C8.66 5.59 8.12 5.92 7.63 6.29L5.24 5.33C5.02 5.25 4.77 5.33 4.65 5.55L2.74 8.87C2.62 9.08 2.66 9.34 2.86 9.48L4.89 11.06C4.84 11.36 4.8 11.69 4.8 12C4.8 12.31 4.82 12.64 4.87 12.94L2.84 14.52C2.66 14.66 2.61 14.93 2.72 15.13L4.64 18.45C4.76 18.67 5.01 18.74 5.23 18.67L7.62 17.71C8.12 18.09 8.65 18.41 9.24 18.65L9.6 21.19C9.65 21.43 9.84 21.6 10.08 21.6H13.92C14.16 21.6 14.36 21.43 14.39 21.19L14.75 18.65C15.34 18.41 15.88 18.09 16.37 17.71L18.76 18.67C18.98 18.75 19.23 18.67 19.35 18.45L21.27 15.13C21.39 14.91 21.34 14.66 21.15 14.52L19.14 12.94ZM12 15.6C10.02 15.6 8.4 13.98 8.4 12C8.4 10.02 10.02 8.4 12 8.4C13.98 8.4 15.6 10.02 15.6 12C15.6 13.98 13.98 15.6 12 15.6Z" fill="currentColor"/>
        </svg>
      </button>
    </div>

    <!-- 设置弹窗 -->
    <div v-if="showSettings" class="settings-overlay" @click.self="showSettings = false">
      <div class="settings-modal">
        <div class="settings-header">
          <h3>设置</h3>
          <button class="close-btn" @click="showSettings = false">&times;</button>
        </div>

        <div class="settings-body">
          <!-- 左侧导航 -->
          <div class="settings-nav">
            <button
              :class="{ active: settingsTab === 'profile' }"
              @click="settingsTab = 'profile'"
            >
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 12C14.21 12 16 10.21 16 8C16 5.79 14.21 4 12 4C9.79 4 8 5.79 8 8C8 10.21 9.79 12 12 12ZM12 14C9.33 14 4 15.34 4 18V20H20V18C20 15.34 14.67 14 12 14Z"/></svg>
              账号资料
            </button>
            <button
              :class="{ active: settingsTab === 'security' }"
              @click="settingsTab = 'security'"
            >
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M18 8H17V6C17 3.24 14.76 1 12 1C9.24 1 7 3.24 7 6V8H6C4.9 8 4 8.9 4 10V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V10C20 8.9 19.1 8 18 8ZM12 17C10.9 17 10 16.1 10 15C10 13.9 10.9 13 12 13C13.1 13 14 13.9 14 15C14 16.1 13.1 17 12 17ZM15.1 8H8.9V6C8.9 4.29 10.29 2.9 12 2.9C13.71 2.9 15.1 4.29 15.1 6V8Z"/></svg>
              账号安全
            </button>
          </div>

          <!-- 右侧内容 -->
          <div class="settings-content">
            <!-- 账号资料 -->
            <div v-if="settingsTab === 'profile'">
              <h4>账号资料</h4>

              <!-- 头像 -->
              <div class="setting-item">
                <label>头像</label>
                <div class="avatar-edit">
                  <div class="avatar-preview">
                    <img v-if="avatarPreview || userAvatar" :src="avatarPreview || userAvatar" />
                    <div v-else class="avatar-placeholder-sm">{{ user.nickname?.charAt(0) }}</div>
                  </div>
                  <div class="avatar-actions">
                    <label class="change-btn" for="settings-avatar-input">更换头像</label>
                    <input id="settings-avatar-input" type="file" accept="image/*" hidden @change="onAvatarChange" />
                    <button
                      v-if="avatarPreview"
                      class="save-btn"
                      :disabled="avatarLoading"
                      @click="handleUpdateAvatar"
                    >{{ avatarLoading ? '上传中...' : '保存' }}</button>
                  </div>
                </div>
              </div>

              <!-- 昵称 -->
              <div class="setting-item">
                <label>昵称</label>
                <div class="nickname-edit">
                  <input
                    v-model="newNickname"
                    type="text"
                    placeholder="输入新昵称"
                    maxlength="20"
                  />
                  <button
                    class="save-btn"
                    :disabled="nicknameLoading || newNickname.trim() === (user.nickname || '')"
                    @click="handleUpdateNickname"
                  >{{ nicknameLoading ? '保存中...' : '保存' }}</button>
                </div>
              </div>

              <!-- 用户名 -->
              <div class="setting-item">
                <label>用户名</label>
                <div class="readonly-value">{{ user.username }}</div>
              </div>
            </div>

            <!-- 账号安全 -->
            <div v-if="settingsTab === 'security'">
              <h4>账号安全</h4>

              <div class="setting-item">
                <label>登录状态</label>
                <div class="readonly-value online-status">
                  <span class="status-dot"></span>已登录
                </div>
              </div>

              <div class="setting-item danger-zone">
                <label>危险操作</label>
                <button class="logout-btn" @click="handleLogout">
                  退出登录
                </button>
                <p class="hint">退出后需要重新输入用户名和密码登录</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sidebar {
  width: 64px;
  min-width: 64px;
  background: #2e2e2e;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px 0;
}

.user-avatar {
  width: 44px;
  height: 44px;
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 24px;
  cursor: pointer;
  transition: opacity 0.2s;
}

.user-avatar:hover {
  opacity: 0.8;
}

.user-avatar img {
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

.nav-buttons {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.nav-btn {
  width: 44px;
  height: 44px;
  border: none;
  background: transparent;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #999;
  transition: all 0.2s;
  position: relative;
}

.nav-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.nav-btn.active {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
}

.nav-btn svg {
  width: 24px;
  height: 24px;
}

.badge {
  position: absolute;
  top: 4px;
  right: 4px;
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

.bottom-actions {
  margin-top: auto;
}

/* 设置弹窗 */
.settings-overlay {
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

.settings-modal {
  background: #fff;
  border-radius: 12px;
  width: 50vw;
  height: 60vh;
  min-width: 560px;
  min-height: 400px;
  max-width: 800px;
  max-height: 600px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
}

.settings-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  border-bottom: 1px solid #f0f0f0;
}

.settings-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  color: #999;
  cursor: pointer;
  line-height: 1;
  padding: 0;
}

.close-btn:hover {
  color: #333;
}

.settings-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* 左侧导航 */
.settings-nav {
  width: 160px;
  min-width: 160px;
  background: #f7f8fa;
  border-right: 1px solid #f0f0f0;
  padding: 12px 0;
  overflow-y: auto;
}

.settings-nav button {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 20px;
  border: none;
  background: none;
  font-size: 14px;
  color: #666;
  cursor: pointer;
  transition: all 0.15s;
  text-align: left;
}

.settings-nav button:hover {
  background: #eef0f5;
  color: #333;
}

.settings-nav button.active {
  background: #fff;
  color: #667eea;
  font-weight: 500;
  position: relative;
}

.settings-nav button.active::before {
  content: '';
  position: absolute;
  left: 0;
  top: 8px;
  bottom: 8px;
  width: 3px;
  background: #667eea;
  border-radius: 0 2px 2px 0;
}

.settings-nav button svg {
  width: 18px;
  height: 18px;
  flex-shrink: 0;
}

/* 右侧内容 */
.settings-content {
  flex: 1;
  padding: 20px 24px;
  overflow-y: auto;
}

.settings-content h4 {
  margin: 0 0 20px;
  font-size: 15px;
  font-weight: 600;
  color: #333;
}

.setting-item {
  margin-bottom: 20px;
}

.setting-item:last-child {
  margin-bottom: 0;
}

.setting-item label {
  display: block;
  font-size: 13px;
  color: #999;
  margin-bottom: 8px;
}

.avatar-edit {
  display: flex;
  align-items: center;
  gap: 16px;
}

.avatar-preview {
  width: 64px;
  height: 64px;
  border-radius: 8px;
  overflow: hidden;
  flex-shrink: 0;
}

.avatar-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder-sm {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-weight: 600;
}

.avatar-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.change-btn {
  display: inline-block;
  padding: 6px 16px;
  background: #f5f5f5;
  border: 1px solid #e8e8e8;
  border-radius: 6px;
  font-size: 13px;
  color: #333;
  cursor: pointer;
  transition: all 0.2s;
}

.change-btn:hover {
  background: #e8e8e8;
}

.nickname-edit {
  display: flex;
  gap: 12px;
}

.nickname-edit input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #e8e8e8;
  border-radius: 6px;
  font-size: 14px;
  outline: none;
}

.nickname-edit input:focus {
  border-color: #667eea;
}

.save-btn {
  padding: 8px 16px;
  background: #667eea;
  color: #fff;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  cursor: pointer;
  transition: opacity 0.2s;
  white-space: nowrap;
}

.save-btn:hover {
  opacity: 0.9;
}

.save-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.readonly-value {
  padding: 8px 12px;
  background: #f5f5f5;
  border-radius: 6px;
  font-size: 14px;
  color: #666;
}

.online-status {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-dot {
  width: 8px;
  height: 8px;
  background: #52c41a;
  border-radius: 50%;
}

.danger-zone {
  padding-top: 20px;
  border-top: 1px solid #f0f0f0;
  margin-top: 24px;
}

.logout-btn {
  width: 100%;
  padding: 10px;
  background: #fff;
  color: #ff4d4f;
  border: 1px solid #ff4d4f;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.logout-btn:hover {
  background: #ff4d4f;
  color: #fff;
}

.hint {
  margin: 8px 0 0;
  font-size: 12px;
  color: #999;
}
</style>
