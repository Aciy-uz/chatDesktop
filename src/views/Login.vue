<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { api } from '@/services/api'

const router = useRouter()
const authStore = useAuthStore()

const username = ref('')
const password = ref('')
const captchaCode = ref('')
const captchaId = ref('')
const captchaSvg = ref('')
const loading = ref(false)
const errorMsg = ref('')

// 获取验证码
async function refreshCaptcha() {
  const data = await api.getCaptcha()
  captchaId.value = data.id
  captchaSvg.value = data.svg
  captchaCode.value = ''
}

// 登录
async function handleLogin() {
  if (!username.value || !password.value || !captchaCode.value) {
    errorMsg.value = '请填写完整信息'
    return
  }

  loading.value = true
  errorMsg.value = ''

  const result = await authStore.login(
    username.value,
    password.value,
    captchaId.value,
    captchaCode.value
  )

  loading.value = false

  if (result.success) {
    router.push('/')
  } else {
    errorMsg.value = result.msg || '登录失败'
    refreshCaptcha()
  }
}

onMounted(() => {
  refreshCaptcha()
})
</script>

<template>
  <div class="login-page">
    <div class="login-card">
      <div class="login-header">
        <div class="logo">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 20C7.59 20 4 16.41 4 12C4 7.59 7.59 4 12 4C16.41 4 20 7.59 20 12C20 16.41 16.41 20 12 20Z" fill="currentColor"/>
            <path d="M12 6C8.69 6 6 8.69 6 12C6 15.31 8.69 18 12 18C15.31 18 18 15.31 18 12C18 8.69 15.31 6 12 6ZM12 16C9.79 16 8 14.21 8 12C8 9.79 9.79 8 12 8C14.21 8 16 9.79 16 12C16 14.21 14.21 16 12 16Z" fill="currentColor"/>
          </svg>
        </div>
        <h1>ChatApp</h1>
        <p>即时通讯</p>
      </div>

      <form class="login-form" @submit.prevent="handleLogin">
        <div v-if="errorMsg" class="error-msg">{{ errorMsg }}</div>

        <div class="form-group">
          <input
            v-model="username"
            type="text"
            placeholder="用户名"
            autocomplete="username"
          />
        </div>

        <div class="form-group">
          <input
            v-model="password"
            type="password"
            placeholder="密码"
            autocomplete="current-password"
          />
        </div>

        <div class="form-group captcha-group">
          <input
            v-model="captchaCode"
            type="text"
            placeholder="验证码"
            maxlength="4"
          />
          <div class="captcha-img" v-html="captchaSvg" @click="refreshCaptcha"></div>
        </div>

        <button type="submit" :disabled="loading">
          {{ loading ? '登录中...' : '登录' }}
        </button>
      </form>

      <div class="login-footer">
        <router-link to="/register">没有账号？立即注册</router-link>
      </div>
    </div>
  </div>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
}

.login-card {
  background: #fff;
  border-radius: 16px;
  padding: 40px;
  width: 100%;
  max-width: 400px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
}

.login-header {
  text-align: center;
  margin-bottom: 32px;
}

.logo {
  width: 64px;
  height: 64px;
  margin: 0 auto 16px;
  color: #667eea;
}

.logo svg {
  width: 100%;
  height: 100%;
}

.login-header h1 {
  font-size: 28px;
  color: #333;
  margin: 0 0 4px;
}

.login-header p {
  color: #999;
  font-size: 14px;
  margin: 0;
}

.form-group {
  margin-bottom: 16px;
}

.form-group input {
  width: 100%;
  padding: 14px 16px;
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
  height: 48px;
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

.login-footer {
  text-align: center;
  margin-top: 20px;
}

.login-footer a {
  color: #667eea;
  text-decoration: none;
  font-size: 14px;
}

.login-footer a:hover {
  text-decoration: underline;
}
</style>
