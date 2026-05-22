<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { encryptPassword } from '@/services/rsa'
import { api } from '@/services/api'

const router = useRouter()
const authStore = useAuthStore()

const username = ref('')
const password = ref('')
const confirmPassword = ref('')
const nickname = ref('')
const captchaCode = ref('')
const captchaId = ref('')
const captchaSvg = ref('')
const avatarFile = ref<File | null>(null)
const avatarPreview = ref('')
const loading = ref(false)
const errorMsg = ref('')
const successMsg = ref('')

// 获取验证码
async function refreshCaptcha() {
  const data = await api.getCaptcha()
  captchaId.value = data.id
  captchaSvg.value = data.svg
  captchaCode.value = ''
}

// 选择头像
function onAvatarChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) {
    avatarFile.value = file
    avatarPreview.value = URL.createObjectURL(file)
  }
}

// 注册
async function handleRegister() {
  errorMsg.value = ''
  successMsg.value = ''

  if (!username.value || !password.value || !captchaCode.value) {
    errorMsg.value = '请填写必要信息'
    return
  }

  if (password.value !== confirmPassword.value) {
    errorMsg.value = '两次输入的密码不一致'
    return
  }

  if (password.value.length < 6) {
    errorMsg.value = '密码长度不能少于6位'
    return
  }

  loading.value = true

  try {
    const encrypted = await encryptPassword(password.value)

    const form = new FormData()
    form.append('username', username.value)
    form.append('encrypted', encrypted)
    form.append('nickname', nickname.value || username.value)
    form.append('captchaId', captchaId.value)
    form.append('captchaCode', captchaCode.value)
    if (avatarFile.value) {
      form.append('avatar', avatarFile.value)
    }

    const result = await authStore.register(form)

    if (result.success) {
      successMsg.value = '注册成功！即将跳转到登录页面...'
      setTimeout(() => router.push('/login'), 1500)
    } else {
      errorMsg.value = result.msg || '注册失败'
      refreshCaptcha()
    }
  } catch (err: any) {
    errorMsg.value = err.message || '注册失败'
    refreshCaptcha()
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  refreshCaptcha()
})
</script>

<template>
  <div class="register-page">
    <div class="register-card">
      <div class="register-header">
        <h1>创建账号</h1>
        <p>加入 ChatApp 开始聊天</p>
      </div>

      <form class="register-form" @submit.prevent="handleRegister">
        <div v-if="errorMsg" class="error-msg">{{ errorMsg }}</div>
        <div v-if="successMsg" class="success-msg">{{ successMsg }}</div>

        <div class="avatar-upload">
          <div class="avatar-preview" @click="($refs.avatarInput as HTMLInputElement).click()">
            <img v-if="avatarPreview" :src="avatarPreview" alt="头像" />
            <div v-else class="avatar-placeholder">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 12C14.21 12 16 10.21 16 8C16 5.79 14.21 4 12 4C9.79 4 8 5.79 8 8C8 10.21 9.79 12 12 12ZM12 14C9.33 14 4 15.34 4 18V20H20V18C20 15.34 14.67 14 12 14Z" fill="currentColor"/>
              </svg>
              <span>选择头像</span>
            </div>
          </div>
          <input
            ref="avatarInput"
            type="file"
            accept="image/*"
            style="display: none"
            @change="onAvatarChange"
          />
        </div>

        <div class="form-group">
          <input v-model="username" type="text" placeholder="用户名 *" autocomplete="username" />
        </div>

        <div class="form-group">
          <input v-model="nickname" type="text" placeholder="昵称（选填）" />
        </div>

        <div class="form-group">
          <input v-model="password" type="password" placeholder="密码 *" autocomplete="new-password" />
        </div>

        <div class="form-group">
          <input v-model="confirmPassword" type="password" placeholder="确认密码 *" autocomplete="new-password" />
        </div>

        <div class="form-group captcha-group">
          <input v-model="captchaCode" type="text" placeholder="验证码 *" maxlength="4" />
          <div class="captcha-img" v-html="captchaSvg" @click="refreshCaptcha"></div>
        </div>

        <button type="submit" :disabled="loading">
          {{ loading ? '注册中...' : '注册' }}
        </button>
      </form>

      <div class="register-footer">
        <router-link to="/login">已有账号？立即登录</router-link>
      </div>
    </div>
  </div>
</template>

<style scoped>
.register-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
}

.register-card {
  background: #fff;
  border-radius: 16px;
  padding: 40px;
  width: 100%;
  max-width: 420px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
}

.register-header {
  text-align: center;
  margin-bottom: 28px;
}

.register-header h1 {
  font-size: 28px;
  color: #333;
  margin: 0 0 4px;
}

.register-header p {
  color: #999;
  font-size: 14px;
  margin: 0;
}

.avatar-upload {
  display: flex;
  justify-content: center;
  margin-bottom: 24px;
}

.avatar-preview {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  border: 3px dashed #ddd;
  cursor: pointer;
  overflow: hidden;
  transition: border-color 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.avatar-preview:hover {
  border-color: #667eea;
}

.avatar-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  color: #999;
}

.avatar-placeholder svg {
  width: 32px;
  height: 32px;
  margin-bottom: 4px;
}

.avatar-placeholder span {
  font-size: 11px;
}

.form-group {
  margin-bottom: 14px;
}

.form-group input {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid #e8e8e8;
  border-radius: 10px;
  font-size: 15px;
  transition: border-color 0.2s;
  outline: none;
  box-sizing: border-box;
}

.form-group input:focus {
  border-color: #667eea;
}

.captcha-group {
  display: flex;
  gap: 12px;
}

.captcha-group input {
  flex: 1;
}

.captcha-img {
  width: 120px;
  height: 44px;
  border: 2px solid #e8e8e8;
  border-radius: 10px;
  cursor: pointer;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f5f5;
  flex-shrink: 0;
}

.captcha-img :deep(svg) {
  width: 100%;
  height: 100%;
}

button[type="submit"] {
  width: 100%;
  padding: 14px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  border: none;
  border-radius: 10px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
  margin-top: 8px;
}

button[type="submit"]:hover {
  opacity: 0.9;
}

button[type="submit"]:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error-msg {
  background: #fff2f0;
  border: 1px solid #ffccc7;
  color: #ff4d4f;
  padding: 10px 12px;
  border-radius: 8px;
  font-size: 14px;
  margin-bottom: 16px;
}

.success-msg {
  background: #f6ffed;
  border: 1px solid #b7eb8f;
  color: #52c41a;
  padding: 10px 12px;
  border-radius: 8px;
  font-size: 14px;
  margin-bottom: 16px;
}

.register-footer {
  text-align: center;
  margin-top: 20px;
}

.register-footer a {
  color: #667eea;
  text-decoration: none;
  font-size: 14px;
}

.register-footer a:hover {
  text-decoration: underline;
}
</style>
