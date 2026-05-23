import { createRouter, createWebHistory, createWebHashHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

// Electron 使用 hash 模式，浏览器使用 history 模式
const isElectron = typeof window !== 'undefined' && !!window.electronAPI

const router = createRouter({
  history: isElectron ? createWebHashHistory() : createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/Login.vue'),
      meta: { requiresGuest: true },
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('@/views/Register.vue'),
      meta: { requiresGuest: true },
    },
    {
      path: '/',
      name: 'chat',
      component: () => import('@/views/Chat.vue'),
      meta: { requiresAuth: true },
    },
  ],
})

// 路由守卫（使用返回值方式，不再使用 next）
router.beforeEach((to) => {
  const authStore = useAuthStore()
  authStore.restore()

  if (to.meta.requiresAuth && !authStore.isLoggedIn) {
    return '/login'
  }
  if (to.meta.requiresGuest && authStore.isLoggedIn) {
    return '/'
  }
})

export default router
