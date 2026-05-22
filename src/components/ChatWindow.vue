<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import type { ChatSession, Message, GroupMessage, Friend } from '@/types'
import { useChatStore } from '@/stores/chat'
import { useAuthStore } from '@/stores/auth'
import { useContactStore } from '@/stores/contact'
import { api } from '@/services/api'
import { getFullAvatarUrl } from '@/utils/avatar'

const props = defineProps<{
  session: ChatSession
}>()

const chatStore = useChatStore()
const authStore = useAuthStore()
const contactStore = useContactStore()

const messageInput = ref('')
const messageList = ref<HTMLDivElement | null>(null)
const textareaRef = ref<HTMLTextAreaElement | null>(null)
const showEmojiPicker = ref(false)
const showFileMenu = ref(false)

const messages = computed(() => chatStore.currentMessages)
const myId = computed(() => authStore.user?.id || 0)

// 信息面板
const showInfoPanel = ref(false)
const infoPanelMembers = ref<any[]>([])

// 获取对方用户信息（私聊）
const chatPartner = computed(() => {
  if (props.session.type !== 'private') return null
  return contactStore.friends.find(f => f.id === props.session.targetId) || null
})

// 加载群成员
async function loadGroupMembers() {
  if (props.session.type !== 'group') return
  const res = await api.getGroupMembers(props.session.targetId)
  if (res.code === 200 && res.data) {
    infoPanelMembers.value = res.data
  }
}

// 打开信息面板
function openInfoPanel() {
  showInfoPanel.value = true
  if (props.session.type === 'group') {
    loadGroupMembers()
  }
}

// 拖拽状态
const isDragging = ref(false)
let dragCounter = 0

// 待发送的文件
const pendingFile = ref<File | null>(null)
const pendingFilePreview = ref('')

// @提及功能
const showMentionList = ref(false)
const mentionKeyword = ref('')
const mentionIndex = ref(0)

// 群成员列表（用于@提及）
const groupMembers = computed(() => {
  if (props.session.type !== 'group') return []
  return contactStore.friends.filter(f => f.id !== myId.value)
})

// 过滤后的群成员
const filteredMembers = computed(() => {
  if (!mentionKeyword.value) return groupMembers.value
  const kw = mentionKeyword.value.toLowerCase()
  return groupMembers.value.filter(m =>
    (m.nickname || m.username).toLowerCase().includes(kw) ||
    m.username.toLowerCase().includes(kw)
  )
})

// 消息搜索
const showSearch = ref(false)
const searchKeyword = ref('')
const searchResults = ref<number[]>([])
const searchIndex = ref(-1)

const filteredMessages = computed(() => {
  if (!searchKeyword.value.trim()) return messages.value
  const keyword = searchKeyword.value.trim().toLowerCase()
  return messages.value.filter(m => {
    if (m.is_recalled) return false
    if (m.type === 'text') return m.content.toLowerCase().includes(keyword)
    return false
  })
})

// 右键菜单
const contextMenu = ref({
  visible: false,
  x: 0,
  y: 0,
  msg: null as Message | GroupMessage | null,
})

// 获取 API 基础地址
const apiBase = api.getApiBase()

// 滚动到底部
function scrollToBottom() {
  nextTick(() => {
    if (messageList.value) {
      messageList.value.scrollTop = messageList.value.scrollHeight
    }
  })
}

// 监听消息变化，自动滚动
watch(messages, scrollToBottom, { deep: true })
watch(() => props.session.id, scrollToBottom)

onMounted(scrollToBottom)

// 发送消息
async function sendMessage() {
  const content = messageInput.value.trim()

  // 如果有待发送文件，先上传
  if (pendingFile.value) {
    const file = pendingFile.value
    clearPendingFile()

    const result = await chatStore.uploadAndSend(
      file,
      props.session.targetId,
      props.session.type === 'group'
    )

    if (!result.success) {
      alert(result.msg || '上传失败')
      return
    }
  }

  // 发送文本消息
  if (content) {
    if (props.session.type === 'private') {
      chatStore.sendPrivateMessage(props.session.targetId, content)
    } else {
      chatStore.sendGroupMessage(props.session.targetId, content)
    }
  }

  messageInput.value = ''
  showEmojiPicker.value = false
  // 重置输入框高度
  nextTick(() => {
    if (textareaRef.value) {
      textareaRef.value.style.height = 'auto'
    }
  })
}

// 发送文件
async function handleFileUpload(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return

  if (file.size > 10 * 1024 * 1024) {
    alert('文件大小不能超过 10MB')
    return
  }

  const result = await chatStore.uploadAndSend(
    file,
    props.session.targetId,
    props.session.type === 'group'
  )

  if (!result.success) {
    alert(result.msg || '上传失败')
  }

  showFileMenu.value = false
  // 清空 input
  ;(e.target as HTMLInputElement).value = ''
}

// 设置待发送文件
function setPendingFile(file: File) {
  if (file.size > 10 * 1024 * 1024) {
    alert('文件大小不能超过 10MB')
    return
  }
  pendingFile.value = file
  // 生成预览
  if (file.type.startsWith('image/')) {
    pendingFilePreview.value = URL.createObjectURL(file)
  } else {
    pendingFilePreview.value = ''
  }
}

// 清除待发送文件
function clearPendingFile() {
  if (pendingFilePreview.value) {
    URL.revokeObjectURL(pendingFilePreview.value)
  }
  pendingFile.value = null
  pendingFilePreview.value = ''
}

// 拖拽事件处理
function onDragEnter(e: DragEvent) {
  e.preventDefault()
  dragCounter++
  if (e.dataTransfer?.types.includes('Files')) {
    isDragging.value = true
  }
}

function onDragLeave(e: DragEvent) {
  e.preventDefault()
  dragCounter--
  if (dragCounter === 0) {
    isDragging.value = false
  }
}

function onDragOver(e: DragEvent) {
  e.preventDefault()
}

function onDrop(e: DragEvent) {
  e.preventDefault()
  isDragging.value = false
  dragCounter = 0

  const files = e.dataTransfer?.files
  if (files && files.length > 0 && files[0]) {
    setPendingFile(files[0])
  }
}

// 剪贴板粘贴
function handlePaste(e: ClipboardEvent) {
  const items = e.clipboardData?.items
  if (!items) return

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (!item) continue
    // 检查是否是图片
    if (item.type.startsWith('image/')) {
      e.preventDefault()
      const file = item.getAsFile()
      if (file) {
        setPendingFile(file)
      }
      return
    }
  }
}

// 自动调整输入框高度
function adjustTextareaHeight() {
  const textarea = textareaRef.value
  if (!textarea) return
  textarea.style.height = 'auto'
  textarea.style.height = Math.min(textarea.scrollHeight, 150) + 'px'
}

// 撤回消息
async function recallMessage(msg: Message | GroupMessage) {
  if (!confirm('确定要撤回这条消息吗？')) return

  const isGroup = props.session.type === 'group'
  if (isGroup) {
    await chatStore.recallGroupMsg(msg.id, (msg as GroupMessage).group_id)
  } else {
    await chatStore.recallPrivateMessage(msg.id, (msg as Message).receiver_id)
  }
}

// 判断是否可以撤回（2分钟内，且是自己发的）
function canRecall(msg: Message | GroupMessage): boolean {
  if (msg.sender_id !== myId.value) return false
  if (msg.is_recalled) return false

  const sendTime = new Date(msg.created_at).getTime()
  const now = Date.now()
  return now - sendTime < 2 * 60 * 1000
}

// 判断消息是否是自己发的
function isMine(msg: Message | GroupMessage): boolean {
  return msg.sender_id === myId.value
}

// 打开图片
function openImage(url: string) {
  window.open(url)
}

// 判断是否是私聊消息
function isPrivateMessage(msg: Message | GroupMessage): msg is Message {
  return 'receiver_id' in msg
}

// 格式化时间
function formatTime(time: string): string {
  const date = new Date(time)
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

// 获取发送者昵称（群聊用）
function getSenderName(senderId: number): string {
  if (senderId === myId.value) return authStore.user?.nickname || '我'
  const friend = contactStore.friends.find(f => f.id === senderId)
  return friend?.nickname || friend?.username || `用户${senderId}`
}

// 获取发送者头像（群聊用）
function getSenderAvatar(senderId: number): string {
  if (senderId === myId.value) {
    return getFullAvatarUrl(authStore.user?.avatarUrl || authStore.user?.avatar)
  }
  const friend = contactStore.friends.find(f => f.id === senderId)
  return getFullAvatarUrl(friend?.avatarUrl || friend?.avatar)
}

// 获取会话头像（私聊用，优先从好友列表获取最新）
function getSessionAvatar(): string {
  const friend = contactStore.friends.find(f => f.id === props.session.targetId)
  if (friend) {
    return getFullAvatarUrl(friend.avatarUrl || friend.avatar)
  }
  return getFullAvatarUrl(props.session.avatar)
}

// 处理按键
function handleKeydown(e: KeyboardEvent) {
  // @提及列表导航
  if (showMentionList.value) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      mentionIndex.value = (mentionIndex.value + 1) % filteredMembers.value.length
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      mentionIndex.value = (mentionIndex.value - 1 + filteredMembers.value.length) % filteredMembers.value.length
      return
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      if (filteredMembers.value[mentionIndex.value]) {
        insertMention(filteredMembers.value[mentionIndex.value]!)
      }
      return
    }
    if (e.key === 'Escape') {
      showMentionList.value = false
      return
    }
  }

  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendMessage()
  }
}

// 监听输入，检测 @ 符号
function handleInput() {
  const value = messageInput.value
  const cursorPos = (document.querySelector('.input-row textarea') as HTMLTextAreaElement)?.selectionStart || value.length

  // 查找光标前最近的 @ 符号
  const beforeCursor = value.substring(0, cursorPos)
  const atIndex = beforeCursor.lastIndexOf('@')

  if (atIndex >= 0 && (atIndex === 0 || beforeCursor[atIndex - 1] === ' ' || beforeCursor[atIndex - 1] === '\n')) {
    const keyword = beforeCursor.substring(atIndex + 1)
    // 检查 @ 后面是否包含空格（表示已经完成输入）
    if (!keyword.includes(' ') && !keyword.includes('\n')) {
      mentionKeyword.value = keyword
      mentionIndex.value = 0
      showMentionList.value = true
      return
    }
  }
  showMentionList.value = false
}

// 插入 @提及
function insertMention(member: Friend) {
  const value = messageInput.value
  const cursorPos = (document.querySelector('.input-row textarea') as HTMLTextAreaElement)?.selectionStart || value.length
  const beforeCursor = value.substring(0, cursorPos)
  const atIndex = beforeCursor.lastIndexOf('@')

  if (atIndex >= 0) {
    const name = member.nickname || member.username
    const newValue = value.substring(0, atIndex) + '@' + name + ' ' + value.substring(cursorPos)
    messageInput.value = newValue
  }
  showMentionList.value = false
}

// 高亮 @提及
function highlightMentions(content: string): string {
  // 匹配 @用户名 或 @昵称
  const allMembers = contactStore.friends
  let result = content
  for (const member of allMembers) {
    const name = member.nickname || member.username
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(`@${escaped}(?=\\s|$|[^\\w])`, 'g')
    result = result.replace(regex, `<span class="mention">@${name}</span>`)
  }
  return result
}

// 插入表情
const emojiTab = ref<'face' | 'gesture' | 'symbol'>('face')

const emojiCategories = {
  face: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '🥲', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🫡', '🤐', '🤨', '😐', '😑', '😶', '🫥', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '🥸', '😎', '🤓', '🧐', '😕', '🫤', '😟', '🙁', '😮', '😯', '😲', '😳', '🥺', '🥹', '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱', '😖', '😣', '😞', '😓', '😩', '😫', '🥱', '😤', '😡', '😠', '🤬', '😈', '👿', '💀', '☠️', '💩', '🤡', '👹', '👺', '👻', '👽', '👾', '🤖'],
  gesture: ['👋', '🤚', '🖐️', '✋', '🖖', '🫱', '🫲', '🫳', '🫴', '👌', '🤌', '🤏', '✌️', '🤞', '🫰', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '🫵', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '🫶', '👐', '🤲', '🤝', '🙏', '✍️', '💪', '🦾', '🦿', '🦵', '🦶', '👂', '🦻', '👃', '🧠', '🫀', '🫁', '🦷', '🦴', '👀', '👁️', '👅', '👄', '🫦', '💋', '🩸'],
  symbol: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❤️‍🔥', '❤️‍🩹', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐', '⛎', '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓', '⭐', '🌟', '✨', '💫', '🔥', '💯', '🎉', '🎊', '🎈', '🎁', '🏆', '🥇', '🥈', '🥉', '🏅', '🎯', '✅', '❌', '⚡', '💧', '🎵', '🎶', '➕', '➖', '➗', '✖️', '♾️', '💲', '🔱', '📛', '🔰', '♻️', '🔰', '✳️', '❇️', '❓', '❗', '‼️', '⁉️'],
}

function insertEmoji(emoji: string) {
  messageInput.value += emoji
}

function insertSticker(sticker: string) {
  // 贴纸作为图片消息发送
  if (props.session.type === 'private') {
    chatStore.sendPrivateMessage(props.session.targetId, sticker, 'text')
  } else {
    chatStore.sendGroupMessage(props.session.targetId, sticker, 'text')
  }
  showEmojiPicker.value = false
}

// 显示右键菜单
function showContextMenu(e: MouseEvent, msg: Message | GroupMessage) {
  e.preventDefault()

  // 菜单尺寸
  const menuWidth = 130
  const menuHeight = msg.is_recalled ? 0 : (canRecall(msg) ? 90 : 45)

  // 计算位置，防止超出视口
  let x = e.clientX
  let y = e.clientY

  if (x + menuWidth > window.innerWidth) {
    x = window.innerWidth - menuWidth - 10
  }
  if (y + menuHeight > window.innerHeight) {
    y = window.innerHeight - menuHeight - 10
  }
  if (x < 0) x = 10
  if (y < 0) y = 10

  contextMenu.value = {
    visible: true,
    x,
    y,
    msg,
  }
  // 点击其他地方关闭菜单
  setTimeout(() => {
    document.addEventListener('click', closeContextMenu, { once: true })
  }, 0)
}

// 关闭右键菜单
function closeContextMenu() {
  contextMenu.value.visible = false
}

// 复制消息内容
async function copyMessage() {
  if (!contextMenu.value.msg) return
  const content = contextMenu.value.msg.content
  try {
    await navigator.clipboard.writeText(content)
  } catch {
    // fallback
    const textarea = document.createElement('textarea')
    textarea.value = content
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    document.body.removeChild(textarea)
  }
  closeContextMenu()
}

// 撤回消息（从右键菜单）
async function recallFromMenu() {
  if (!contextMenu.value.msg) return
  const msg = contextMenu.value.msg
  closeContextMenu()

  const isGroup = props.session.type === 'group'
  if (isGroup) {
    await chatStore.recallGroupMsg(msg.id, (msg as GroupMessage).group_id)
  } else {
    await chatStore.recallPrivateMessage(msg.id, (msg as Message).receiver_id)
  }
}

// 切换搜索
function toggleSearch() {
  showSearch.value = !showSearch.value
  if (!showSearch.value) {
    searchKeyword.value = ''
    searchIndex.value = -1
  }
}

// 搜索消息
function handleSearch() {
  searchIndex.value = -1
  if (filteredMessages.value.length > 0) {
    searchIndex.value = 0
    scrollToMessage(filteredMessages.value[0]!.id)
  }
}

// 上一条/下一条搜索结果
function searchPrev() {
  if (filteredMessages.value.length === 0) return
  searchIndex.value = (searchIndex.value - 1 + filteredMessages.value.length) % filteredMessages.value.length
  scrollToMessage(filteredMessages.value[searchIndex.value]!.id)
}

function searchNext() {
  if (filteredMessages.value.length === 0) return
  searchIndex.value = (searchIndex.value + 1) % filteredMessages.value.length
  scrollToMessage(filteredMessages.value[searchIndex.value]!.id)
}

// 滚动到指定消息
function scrollToMessage(msgId: number) {
  nextTick(() => {
    const el = document.querySelector(`[data-msg-id="${msgId}"]`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  })
}

// 高亮搜索关键词
function highlightText(content: string, keyword: string): string {
  if (!keyword.trim()) return content
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(${escaped})`, 'gi')
  return content.replace(regex, '<mark>$1</mark>')
}
</script>

<template>
  <div class="chat-window">
    <!-- 头部 -->
    <div class="header">
      <div class="header-info" @click="openInfoPanel">
        <h3>{{ session.name }}</h3>
        <span v-if="session.type === 'group'" class="member-count">群聊</span>
        <svg class="info-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM13 17H11V11H13V17ZM13 9H11V7H13V9Z"/></svg>
      </div>
      <div class="header-actions">
        <button class="header-btn" @click="toggleSearch" :class="{ active: showSearch }" title="搜索消息">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M15.5 14H14.71L14.43 13.73C15.41 12.59 16 11.11 16 9.5C16 5.91 13.09 3 9.5 3C5.91 3 3 5.91 3 9.5C3 13.09 5.91 16 9.5 16C11.11 16 12.59 15.41 13.73 14.43L14 14.71V15.5L19 20.49L20.49 19L15.5 14ZM9.5 14C7.01 14 5 11.99 5 9.5C5 7.01 7.01 5 9.5 5C11.99 5 14 7.01 14 9.5C14 11.99 11.99 14 9.5 14Z"/></svg>
        </button>
      </div>
    </div>

    <!-- 搜索栏 -->
    <div v-if="showSearch" class="search-bar">
      <input
        v-model="searchKeyword"
        type="text"
        placeholder="搜索消息..."
        @keydown.enter="handleSearch"
        @input="handleSearch"
        autofocus
      />
      <span class="search-count" v-if="searchKeyword">
        {{ searchIndex + 1 }} / {{ filteredMessages.length }}
      </span>
      <button class="search-nav-btn" @click="searchPrev" :disabled="!filteredMessages.length">▲</button>
      <button class="search-nav-btn" @click="searchNext" :disabled="!filteredMessages.length">▼</button>
      <button class="search-close-btn" @click="toggleSearch">×</button>
    </div>

    <!-- 消息列表 -->
    <div
      class="message-list"
      ref="messageList"
      @dragenter="onDragEnter"
      @dragleave="onDragLeave"
      @dragover="onDragOver"
      @drop="onDrop"
    >
      <!-- 拖拽提示 -->
      <div v-if="isDragging" class="drag-overlay">
        <div class="drag-content">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM14 13v4h-4v-4H7l5-5 5 5h-3z"/></svg>
          <p>拖拽文件到此处发送</p>
        </div>
      </div>
      <div
        v-for="msg in (showSearch && searchKeyword ? filteredMessages : messages)"
        :key="msg.id"
        :data-msg-id="msg.id"
        class="message-wrapper"
        :class="{
          mine: isMine(msg),
          recalled: msg.is_recalled,
          'search-highlight': showSearch && searchKeyword && searchIndex >= 0 && filteredMessages[searchIndex]?.id === msg.id
        }"
      >
        <!-- 群聊显示头像和昵称 -->
        <template v-if="session.type === 'group' && !isMine(msg)">
          <div class="avatar">
            <img v-if="getSenderAvatar(msg.sender_id)" :src="getSenderAvatar(msg.sender_id)" />
            <div v-else class="avatar-placeholder">{{ getSenderName(msg.sender_id).charAt(0) }}</div>
          </div>
          <div class="message-body">
            <span class="sender-name">{{ getSenderName(msg.sender_id) }}</span>
            <div class="bubble" @contextmenu.prevent="showContextMenu($event, msg)">
              <template v-if="msg.is_recalled">
                <span class="recalled-text">消息已撤回</span>
              </template>
              <template v-else-if="msg.type === 'image'">
                <img :src="msg.content.startsWith('http') ? msg.content : apiBase + msg.content" class="msg-image" @click="openImage(msg.content.startsWith('http') ? msg.content : apiBase + msg.content)" />
              </template>
              <template v-else-if="msg.type === 'file'">
                <a :href="msg.content.startsWith('http') ? msg.content : apiBase + msg.content" target="_blank" class="msg-file">
                  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2ZM16 18H8V16H16V18ZM16 14H8V12H16V14ZM13 9V3.5L18.5 9H13Z"/></svg>
                  <span>{{ msg.content.split('/').pop() }}</span>
                </a>
              </template>
              <template v-else>
                <span v-if="showSearch && searchKeyword" v-html="highlightText(msg.content, searchKeyword)"></span>
                <span v-else-if="session.type === 'group'" v-html="highlightMentions(msg.content)"></span>
                <span v-else>{{ msg.content }}</span>
              </template>
            </div>
            <span class="msg-time">{{ formatTime(msg.created_at) }}</span>
          </div>
        </template>

        <!-- 自己的消息或私聊 -->
        <template v-else>
          <div v-if="!isMine(msg) && session.type === 'private'" class="avatar">
            <img v-if="getSessionAvatar()" :src="getSessionAvatar()" />
            <div v-else class="avatar-placeholder">{{ session.name.charAt(0) }}</div>
          </div>
          <div class="message-body" :class="{ 'align-right': isMine(msg) }">
            <div class="bubble" :class="{ 'my-bubble': isMine(msg) }" @contextmenu.prevent="showContextMenu($event, msg)">
              <template v-if="msg.is_recalled">
                <span class="recalled-text">消息已撤回</span>
              </template>
              <template v-else-if="msg.type === 'image'">
                <img :src="msg.content.startsWith('http') ? msg.content : apiBase + msg.content" class="msg-image" @click="openImage(msg.content.startsWith('http') ? msg.content : apiBase + msg.content)" />
              </template>
              <template v-else-if="msg.type === 'file'">
                <a :href="msg.content.startsWith('http') ? msg.content : apiBase + msg.content" target="_blank" class="msg-file">
                  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2ZM16 18H8V16H16V18ZM16 14H8V12H16V14ZM13 9V3.5L18.5 9H13Z"/></svg>
                  <span>{{ msg.content.split('/').pop() }}</span>
                </a>
              </template>
              <template v-else>
                <span v-if="showSearch && searchKeyword" v-html="highlightText(msg.content, searchKeyword)"></span>
                <span v-else-if="session.type === 'group'" v-html="highlightMentions(msg.content)"></span>
                <span v-else>{{ msg.content }}</span>
              </template>
            </div>
            <span class="msg-time">
              {{ formatTime(msg.created_at) }}
              <template v-if="session.type === 'private' && isMine(msg) && isPrivateMessage(msg)">
                {{ msg.is_read ? '✓✓' : '✓' }}
              </template>
            </span>
          </div>
        </template>
      </div>

      <div v-if="messages.length === 0" class="empty-messages">
        <p>暂无消息</p>
        <p class="hint">发送第一条消息开始聊天吧</p>
      </div>
    </div>

    <!-- 输入区域 -->
    <div class="input-area">
      <!-- 工具栏 -->
      <div class="toolbar">
        <button class="tool-btn" @click="showEmojiPicker = !showEmojiPicker" title="表情">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 20C7.59 20 4 16.41 4 12C4 7.59 7.59 4 12 4C16.41 4 20 7.59 20 12C20 16.41 16.41 20 12 20ZM15.5 11C16.33 11 17 10.33 17 9.5C17 8.67 16.33 8 15.5 8C14.67 8 14 8.67 14 9.5C14 10.33 14.67 11 15.5 11ZM8.5 11C9.33 11 10 10.33 10 9.5C10 8.67 9.33 8 8.5 8C7.67 8 7 8.67 7 9.5C7 10.33 7.67 11 8.5 11ZM12 17.5C14.33 17.5 16.31 16.04 17.11 14H6.89C7.69 16.04 9.67 17.5 12 17.5Z"/></svg>
        </button>
        <div class="file-upload-wrapper">
          <button class="tool-btn" @click="showFileMenu = !showFileMenu" title="发送文件">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 6V17.5C16.5 19.71 14.71 21.5 12.5 21.5C10.29 21.5 8.5 19.71 8.5 17.5V5C8.5 3.62 9.62 2.5 11 2.5C12.38 2.5 13.5 3.62 13.5 5V15.5C13.5 16.05 13.05 16.5 12.5 16.5C11.95 16.5 11.5 16.05 11.5 15.5V6H10V15.5C10 16.88 11.12 18 12.5 18C13.88 18 15 16.88 15 15.5V5C15 2.79 13.21 1 11 1C8.79 1 7 2.79 7 5V17.5C7 20.54 9.46 23 12.5 23C15.54 23 18 20.54 18 17.5V6H16.5Z"/></svg>
          </button>
          <div v-if="showFileMenu" class="file-menu">
            <label class="file-option">
              <input type="file" accept="image/*" @change="handleFileUpload" hidden />
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 19V5C21 3.9 20.1 3 19 3H5C3.9 3 3 3.9 3 5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19ZM8.5 13.5L11 16.51L14.5 12L19 18H5L8.5 13.5Z"/></svg>
              <span>发送图片</span>
            </label>
            <label class="file-option">
              <input type="file" @change="handleFileUpload" hidden />
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2ZM16 18H8V16H16V18ZM16 14H8V12H16V14ZM13 9V3.5L18.5 9H13Z"/></svg>
              <span>发送文件</span>
            </label>
          </div>
        </div>
      </div>

      <!-- 表情选择器 -->
      <div v-if="showEmojiPicker" class="emoji-picker">
        <div class="emoji-tabs">
          <button :class="{ active: emojiTab === 'face' }" @click="emojiTab = 'face'">😀</button>
          <button :class="{ active: emojiTab === 'gesture' }" @click="emojiTab = 'gesture'">👋</button>
          <button :class="{ active: emojiTab === 'symbol' }" @click="emojiTab = 'symbol'">❤️</button>
        </div>
        <div class="emoji-grid">
          <span
            v-for="emoji in emojiCategories[emojiTab]"
            :key="emoji"
            class="emoji"
            @click="insertEmoji(emoji)"
          >{{ emoji }}</span>
        </div>
      </div>

      <!-- @提及列表 -->
      <div v-if="showMentionList && filteredMembers.length > 0" class="mention-list">
        <div
          v-for="(member, index) in filteredMembers"
          :key="member.id"
          class="mention-item"
          :class="{ active: index === mentionIndex }"
          @click="insertMention(member)"
        >
          <div class="mention-avatar">
            <img v-if="getFullAvatarUrl(member.avatarUrl || member.avatar)" :src="getFullAvatarUrl(member.avatarUrl || member.avatar)" />
            <div v-else class="mention-avatar-placeholder">{{ (member.nickname || member.username).charAt(0) }}</div>
          </div>
          <span class="mention-name">{{ member.nickname || member.username }}</span>
        </div>
      </div>

      <!-- 待发送文件预览 -->
      <div v-if="pendingFile" class="pending-file">
        <div class="pending-file-preview">
          <img v-if="pendingFilePreview" :src="pendingFilePreview" />
          <div v-else class="file-icon">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2ZM16 18H8V16H16V18ZM16 14H8V12H16V14ZM13 9V3.5L18.5 9H13Z"/></svg>
          </div>
          <div class="pending-file-info">
            <span class="file-name">{{ pendingFile.name }}</span>
            <span class="file-size">{{ (pendingFile.size / 1024).toFixed(1) }} KB</span>
          </div>
        </div>
        <button class="pending-file-remove" @click="clearPendingFile">×</button>
      </div>

      <!-- 输入框 -->
      <div class="input-row">
        <textarea
          ref="textareaRef"
          v-model="messageInput"
          placeholder="输入消息...（支持粘贴图片、拖拽文件）"
          @keydown="handleKeydown"
          @input="handleInput; adjustTextareaHeight()"
          @paste="handlePaste"
          rows="1"
        ></textarea>
        <button class="send-btn" @click="sendMessage" :disabled="!messageInput.trim() && !pendingFile">
          发送
        </button>
      </div>
    </div>

    <!-- 信息面板 -->
    <div v-if="showInfoPanel" class="info-overlay" @click.self="showInfoPanel = false">
      <div class="info-panel">
        <div class="info-header">
          <h3>{{ session.type === 'group' ? '群聊信息' : '联系人信息' }}</h3>
          <button class="info-close" @click="showInfoPanel = false">×</button>
        </div>

        <!-- 私聊信息 -->
        <div v-if="session.type === 'private' && chatPartner" class="info-content">
          <div class="info-avatar">
            <img v-if="getFullAvatarUrl(chatPartner.avatarUrl || chatPartner.avatar)" :src="getFullAvatarUrl(chatPartner.avatarUrl || chatPartner.avatar)" />
            <div v-else class="info-avatar-placeholder">{{ (chatPartner.nickname || chatPartner.username).charAt(0) }}</div>
          </div>
          <div class="info-item">
            <label>昵称</label>
            <span>{{ chatPartner.nickname || chatPartner.username }}</span>
          </div>
          <div class="info-item">
            <label>用户名</label>
            <span>{{ chatPartner.username }}</span>
          </div>
          <div class="info-item">
            <label>用户ID</label>
            <span>{{ chatPartner.id }}</span>
          </div>
          <div class="info-item">
            <label>在线状态</label>
            <span :class="contactStore.isOnline(chatPartner.id) ? 'status-online' : 'status-offline'">
              {{ contactStore.isOnline(chatPartner.id) ? '在线' : '离线' }}
            </span>
          </div>
        </div>

        <!-- 群聊信息 -->
        <div v-if="session.type === 'group'" class="info-content">
          <div class="info-avatar group">
            <div class="info-avatar-placeholder">{{ session.name.charAt(0) }}</div>
          </div>
          <div class="info-item">
            <label>群名称</label>
            <span>{{ session.name }}</span>
          </div>
          <div class="info-item">
            <label>群ID</label>
            <span>{{ session.targetId }}</span>
          </div>
          <div class="info-item">
            <label>群成员 ({{ infoPanelMembers.length }})</label>
          </div>
          <div class="member-list">
            <div v-for="member in infoPanelMembers" :key="member.id" class="member-item">
              <div class="member-avatar">
                <img v-if="getFullAvatarUrl(member.avatar)" :src="getFullAvatarUrl(member.avatar)" />
                <div v-else class="member-avatar-placeholder">{{ (member.nickname || member.username).charAt(0) }}</div>
              </div>
              <div class="member-info">
                <span class="member-name">{{ member.nickname || member.username }}</span>
                <span v-if="member.id === myId" class="member-tag">我</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 右键菜单 -->
    <Teleport to="body">
      <div
        v-if="contextMenu.visible"
        class="context-menu"
        :style="{ left: contextMenu.x + 'px', top: contextMenu.y + 'px' }"
      >
        <div class="context-item" @click="copyMessage">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 1H4C2.9 1 2 1.9 2 3V17H4V3H16V1ZM19 5H8C6.9 5 6 5.9 6 7V21C6 22.1 6.9 23 8 23H19C20.1 23 21 22.1 21 21V7C21 5.9 20.1 5 19 5ZM19 21H8V7H19V21Z"/></svg>
          复制
        </div>
        <div
          v-if="contextMenu.msg && canRecall(contextMenu.msg)"
          class="context-item danger"
          @click="recallFromMenu"
        >
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.5 8C9.85 8 7.45 9 5.6 10.6L2 7V16H11L7.38 12.38C8.77 11.22 10.54 10.5 12.5 10.5C15.04 10.5 17.29 11.67 18.71 13.45L21.16 11C19.24 8.57 16.09 8 12.5 8ZM6 18L2 14L6 10V18Z"/></svg>
          撤回
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.chat-window {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #f5f5f5;
  min-width: 0;
}

.header {
  padding: 16px 20px;
  background: #fff;
  border-bottom: 1px solid #e8e8e8;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-actions {
  display: flex;
  gap: 4px;
}

.header-btn {
  width: 36px;
  height: 36px;
  border: none;
  background: none;
  cursor: pointer;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666;
  transition: all 0.15s;
}

.header-btn:hover {
  background: #f5f5f5;
  color: #333;
}

.header-btn.active {
  background: #e8e8ff;
  color: #667eea;
}

.header-btn svg {
  width: 20px;
  height: 20px;
}

/* 搜索栏 */
.search-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
  background: #fff;
  border-bottom: 1px solid #e8e8e8;
}

.search-bar input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #e8e8e8;
  border-radius: 6px;
  font-size: 14px;
  outline: none;
}

.search-bar input:focus {
  border-color: #667eea;
}

.search-count {
  font-size: 13px;
  color: #999;
  white-space: nowrap;
}

.search-nav-btn {
  width: 30px;
  height: 30px;
  border: 1px solid #e8e8e8;
  background: #fff;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: #666;
  transition: all 0.15s;
}

.search-nav-btn:hover:not(:disabled) {
  background: #f5f5f5;
  color: #333;
}

.search-nav-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.search-close-btn {
  width: 30px;
  height: 30px;
  border: none;
  background: none;
  cursor: pointer;
  border-radius: 6px;
  font-size: 18px;
  color: #999;
  display: flex;
  align-items: center;
  justify-content: center;
}

.search-close-btn:hover {
  background: #f5f5f5;
  color: #333;
}

/* 搜索高亮 */
.search-highlight {
  background: #fff3cd;
  border-radius: 8px;
}

:deep(mark) {
  background: #ffc107;
  color: #333;
  padding: 1px 2px;
  border-radius: 2px;
}

.header-info h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.member-count {
  font-size: 12px;
  color: #999;
  background: #f0f0f0;
  padding: 2px 8px;
  border-radius: 4px;
}

/* 消息列表 */
.message-list {
  flex: 1;
  overflow-y: auto;
  padding: 16px 20px;
}

.message-wrapper {
  display: flex;
  gap: 10px;
  margin-bottom: 16px;
}

.message-wrapper.mine {
  flex-direction: row-reverse;
}

.avatar {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  overflow: hidden;
  flex-shrink: 0;
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
  font-size: 14px;
  font-weight: 600;
}

.message-body {
  max-width: 60%;
}

.message-body.align-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.sender-name {
  font-size: 12px;
  color: #999;
  margin-bottom: 4px;
  display: block;
}

.bubble {
  background: #fff;
  padding: 10px 14px;
  border-radius: 12px;
  border-top-left-radius: 4px;
  word-break: break-word;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  position: relative;
}

.my-bubble {
  background: #95ec69;
  border-top-left-radius: 12px;
  border-top-right-radius: 4px;
}

.message-wrapper.recalled .bubble {
  opacity: 0.6;
}

.recalled-text {
  color: #999;
  font-size: 13px;
  font-style: italic;
}

.msg-image {
  max-width: 240px;
  max-height: 240px;
  border-radius: 8px;
  cursor: pointer;
  display: block;
}

.msg-file {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #333;
  text-decoration: none;
  min-width: 180px;
}

.msg-file svg {
  width: 32px;
  height: 32px;
  color: #667eea;
  flex-shrink: 0;
}

.msg-file span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 14px;
}

.msg-time {
  font-size: 11px;
  color: #ccc;
  margin-top: 4px;
  display: block;
}

.empty-messages {
  text-align: center;
  padding: 80px 20px;
  color: #999;
}

.empty-messages p {
  margin: 0 0 4px;
}

.hint {
  font-size: 13px;
  color: #bbb;
}

/* 输入区域 */
.input-area {
  background: #fff;
  border-top: 1px solid #e8e8e8;
  padding: 12px 20px;
}

.toolbar {
  display: flex;
  gap: 4px;
  margin-bottom: 8px;
}

.tool-btn {
  width: 36px;
  height: 36px;
  border: none;
  background: none;
  cursor: pointer;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666;
  transition: all 0.15s;
}

.tool-btn:hover {
  background: #f5f5f5;
  color: #333;
}

.tool-btn svg {
  width: 22px;
  height: 22px;
}

.file-upload-wrapper {
  position: relative;
}

.file-menu {
  position: absolute;
  bottom: 100%;
  left: 0;
  background: #fff;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  padding: 8px 0;
  min-width: 140px;
  z-index: 10;
}

.file-option {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  cursor: pointer;
  transition: background 0.15s;
  font-size: 14px;
  color: #333;
}

.file-option:hover {
  background: #f5f5f5;
}

.file-option svg {
  width: 20px;
  height: 20px;
  color: #667eea;
}

.emoji-picker {
  background: #fff;
  border: 1px solid #e8e8e8;
  border-radius: 10px;
  margin-bottom: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

.emoji-tabs {
  display: flex;
  border-bottom: 1px solid #f0f0f0;
  padding: 0 4px;
}

.emoji-tabs button {
  flex: 1;
  padding: 8px;
  border: none;
  background: none;
  font-size: 20px;
  cursor: pointer;
  position: relative;
  transition: background 0.15s;
  border-radius: 6px 6px 0 0;
}

.emoji-tabs button:hover {
  background: #f5f5f5;
}

.emoji-tabs button.active {
  background: #fff;
}

.emoji-tabs button.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 20%;
  right: 20%;
  height: 2px;
  background: #667eea;
}

.emoji-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  padding: 8px;
  max-height: 240px;
  overflow-y: auto;
}

.emoji {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.15s;
}

.emoji:hover {
  background: #f0f0f0;
  transform: scale(1.15);
}

.input-row {
  display: flex;
  gap: 12px;
  align-items: flex-end;
}

.input-row textarea {
  flex: 1;
  padding: 10px 14px;
  border: 1px solid #e8e8e8;
  border-radius: 10px;
  font-size: 14px;
  resize: none;
  outline: none;
  min-height: 40px;
  max-height: 150px;
  font-family: inherit;
  line-height: 1.4;
  overflow-y: auto;
}

.input-row textarea:focus {
  border-color: #667eea;
}

.send-btn {
  padding: 10px 24px;
  background: #667eea;
  color: #fff;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: opacity 0.2s;
  white-space: nowrap;
}

.send-btn:hover {
  opacity: 0.9;
}

.send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* 右键菜单 */
.context-menu {
  position: fixed;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  padding: 6px 0;
  min-width: 120px;
  z-index: 9999;
  animation: contextFadeIn 0.1s ease;
}

@keyframes contextFadeIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

.context-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  font-size: 14px;
  color: #333;
  cursor: pointer;
  transition: background 0.15s;
}

.context-item:hover {
  background: #f5f5f5;
}

.context-item svg {
  width: 18px;
  height: 18px;
  color: #666;
}

.context-item.danger {
  color: #ff4d4f;
}

.context-item.danger svg {
  color: #ff4d4f;
}

/* @提及列表 */
.mention-list {
  position: absolute;
  bottom: 100%;
  left: 20px;
  right: 20px;
  background: #fff;
  border: 1px solid #e8e8e8;
  border-radius: 10px;
  box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.1);
  max-height: 200px;
  overflow-y: auto;
  z-index: 100;
  margin-bottom: 4px;
}

.mention-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  cursor: pointer;
  transition: background 0.15s;
}

.mention-item:hover,
.mention-item.active {
  background: #f0f2ff;
}

.mention-avatar {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  overflow: hidden;
  flex-shrink: 0;
}

.mention-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.mention-avatar-placeholder {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
}

.mention-name {
  font-size: 14px;
  color: #333;
}

/* @提及高亮 */
:deep(.mention) {
  color: #667eea;
  font-weight: 500;
  cursor: pointer;
}

:deep(.mention:hover) {
  text-decoration: underline;
}

/* 拖拽覆盖层 */
.drag-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(102, 126, 234, 0.15);
  border: 3px dashed #667eea;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  pointer-events: none;
  animation: dragFadeIn 0.2s ease;
}

@keyframes dragFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.drag-content {
  text-align: center;
  color: #667eea;
}

.drag-content svg {
  width: 48px;
  height: 48px;
  margin-bottom: 12px;
}

.drag-content p {
  font-size: 16px;
  font-weight: 500;
  margin: 0;
}

/* 待发送文件预览 */
.pending-file {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  background: #f8f9ff;
  border: 1px solid #e0e4ff;
  border-radius: 10px;
  margin-bottom: 8px;
}

.pending-file-preview {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.pending-file-preview img {
  width: 48px;
  height: 48px;
  object-fit: cover;
  border-radius: 6px;
}

.file-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #e8ecff;
  border-radius: 6px;
}

.file-icon svg {
  width: 24px;
  height: 24px;
  color: #667eea;
}

.pending-file-info {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.file-name {
  font-size: 14px;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-size {
  font-size: 12px;
  color: #999;
}

.pending-file-remove {
  width: 28px;
  height: 28px;
  border: none;
  background: #f0f0f0;
  border-radius: 50%;
  font-size: 18px;
  color: #666;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
  flex-shrink: 0;
}

.pending-file-remove:hover {
  background: #ff4d4f;
  color: #fff;
}

/* 头部信息图标 */
.header-info {
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-info:hover .info-icon {
  opacity: 1;
}

.info-icon {
  width: 16px;
  height: 16px;
  color: #999;
  opacity: 0.5;
  transition: opacity 0.2s;
}

/* 信息面板 */
.info-overlay {
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

.info-panel {
  background: #fff;
  border-radius: 12px;
  width: 360px;
  max-height: 70vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
}

.info-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  border-bottom: 1px solid #f0f0f0;
}

.info-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.info-close {
  background: none;
  border: none;
  font-size: 24px;
  color: #999;
  cursor: pointer;
  line-height: 1;
  padding: 0;
}

.info-close:hover {
  color: #333;
}

.info-content {
  padding: 20px;
  overflow-y: auto;
}

.info-avatar {
  width: 72px;
  height: 72px;
  border-radius: 12px;
  overflow: hidden;
  margin: 0 auto 20px;
}

.info-avatar.group {
  border-radius: 50%;
}

.info-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.info-avatar-placeholder {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  font-weight: 600;
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid #f5f5f5;
}

.info-item label {
  font-size: 14px;
  color: #999;
}

.info-item span {
  font-size: 14px;
  color: #333;
}

.status-online {
  color: #52c41a;
}

.status-offline {
  color: #999;
}

/* 群成员列表 */
.member-list {
  margin-top: 12px;
  max-height: 300px;
  overflow-y: auto;
}

.member-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid #f5f5f5;
}

.member-item:last-child {
  border-bottom: none;
}

.member-avatar {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  overflow: hidden;
  flex-shrink: 0;
}

.member-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.member-avatar-placeholder {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 600;
}

.member-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.member-name {
  font-size: 14px;
  color: #333;
}

.member-tag {
  font-size: 11px;
  color: #667eea;
  background: #f0f2ff;
  padding: 1px 6px;
  border-radius: 4px;
}
</style>
