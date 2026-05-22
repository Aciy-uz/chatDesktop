import Database from 'better-sqlite3'
import path from 'path'
import { app } from 'electron'

let db: Database.Database | null = null

// 初始化数据库
export function initDatabase(): Database.Database {
  if (db) return db

  // 数据库文件路径（存储在用户数据目录）
  const dbPath = path.join(app.getPath('userData'), 'chat.db')
  console.log('数据库路径:', dbPath)

  db = new Database(dbPath)

  // 启用 WAL 模式（提高并发性能）
  db.pragma('journal_mode = WAL')

  // 创建表
  db.exec(`
    -- 会话表
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,  -- 'private' | 'group'
      target_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      avatar TEXT DEFAULT '',
      unread_count INTEGER DEFAULT 0,
      last_message TEXT,
      last_time TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- 私聊消息表
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL,       -- 当前用户 ID
      sender_id INTEGER NOT NULL,
      receiver_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      type TEXT DEFAULT 'text',
      is_read INTEGER DEFAULT 0,
      is_recalled INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    );

    -- 群聊消息表
    CREATE TABLE IF NOT EXISTS group_messages (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL,       -- 当前用户 ID
      group_id INTEGER NOT NULL,
      sender_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      type TEXT DEFAULT 'text',
      is_recalled INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    );

    -- 创建索引
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_messages_user ON messages(user_id);
    CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(user_id, receiver_id);
    CREATE INDEX IF NOT EXISTS idx_group_messages_user ON group_messages(user_id);
    CREATE INDEX IF NOT EXISTS idx_group_messages_group ON group_messages(user_id, group_id);
  `)

  return db
}

// 获取数据库实例
export function getDatabase(): Database.Database {
  if (!db) {
    return initDatabase()
  }
  return db
}

// 关闭数据库
export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}

// ============ 会话操作 ============

export function saveSessions(userId: number, sessions: any[]): void {
  const db = getDatabase()

  // 使用事务
  const transaction = db.transaction(() => {
    // 删除旧会话
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId)

    // 插入新会话
    const stmt = db.prepare(`
      INSERT INTO sessions (id, user_id, type, target_id, name, avatar, unread_count, last_message, last_time)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    for (const session of sessions) {
      stmt.run(
        session.id,
        userId,
        session.type,
        session.targetId,
        session.name,
        session.avatar || '',
        session.unreadCount || 0,
        session.lastMessage || null,
        session.lastTime || null
      )
    }
  })

  transaction()
}

export function loadSessions(userId: number): any[] {
  const db = getDatabase()
  const rows = db.prepare('SELECT * FROM sessions WHERE user_id = ? ORDER BY created_at DESC').all(userId) as any[]

  return rows.map(row => ({
    id: row.id,
    type: row.type,
    targetId: row.target_id,
    name: row.name,
    avatar: row.avatar,
    unreadCount: row.unread_count,
    lastMessage: row.last_message,
    lastTime: row.last_time,
  }))
}

// ============ 私聊消息操作 ============

export function saveMessages(userId: number, messages: any[]): void {
  const db = getDatabase()
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO messages (id, user_id, sender_id, receiver_id, content, type, is_read, is_recalled, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const transaction = db.transaction(() => {
    for (const msg of messages) {
      stmt.run(
        msg.id,
        userId,
        msg.sender_id,
        msg.receiver_id,
        msg.content,
        msg.type,
        msg.is_read || 0,
        msg.is_recalled || 0,
        msg.created_at
      )
    }
  })

  transaction()
}

export function loadMessages(userId: number, targetId: number, limit = 50, offset = 0): any[] {
  const db = getDatabase()
  return db.prepare(`
    SELECT * FROM messages
    WHERE user_id = ? AND (sender_id = ? OR receiver_id = ?)
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(userId, targetId, targetId, limit, offset) as any[]
}

// ============ 群聊消息操作 ============

export function saveGroupMessages(userId: number, messages: any[]): void {
  const db = getDatabase()
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO group_messages (id, user_id, group_id, sender_id, content, type, is_recalled, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)

  const transaction = db.transaction(() => {
    for (const msg of messages) {
      stmt.run(
        msg.id,
        userId,
        msg.group_id,
        msg.sender_id,
        msg.content,
        msg.type,
        msg.is_recalled || 0,
        msg.created_at
      )
    }
  })

  transaction()
}

export function loadGroupMessages(userId: number, groupId: number, limit = 50, offset = 0): any[] {
  const db = getDatabase()
  return db.prepare(`
    SELECT * FROM group_messages
    WHERE user_id = ? AND group_id = ?
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(userId, groupId, limit, offset) as any[]
}

// ============ 消息搜索 ============

export function searchMessages(userId: number, keyword: string): any[] {
  const db = getDatabase()
  const likeKeyword = `%${keyword}%`

  const privateMsgs = db.prepare(`
    SELECT *, 'private' as chat_type FROM messages
    WHERE user_id = ? AND content LIKE ? AND is_recalled = 0
    ORDER BY created_at DESC LIMIT 50
  `).all(userId, likeKeyword) as any[]

  const groupMsgs = db.prepare(`
    SELECT *, 'group' as chat_type FROM group_messages
    WHERE user_id = ? AND content LIKE ? AND is_recalled = 0
    ORDER BY created_at DESC LIMIT 50
  `).all(userId, likeKeyword) as any[]

  return [...privateMsgs, ...groupMsgs].sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )
}

// ============ 清除用户数据 ============

export function clearUserData(userId: number): void {
  const db = getDatabase()
  const transaction = db.transaction(() => {
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId)
    db.prepare('DELETE FROM messages WHERE user_id = ?').run(userId)
    db.prepare('DELETE FROM group_messages WHERE user_id = ?').run(userId)
  })
  transaction()
}
