import initSqlJs, { Database } from 'sql.js'
import path from 'path'
import fs from 'fs'
import { app } from 'electron'

let db: Database | null = null
let dbPath: string = ''

// 初始化数据库
export async function initDatabase(): Promise<Database> {
  if (db) return db

  // 从 node_modules 加载 WASM 文件
  const wasmPath = path.join(__dirname, '../node_modules/sql.js/dist/sql-wasm.wasm')
  const wasmBinary = fs.readFileSync(wasmPath)

  const SQL = await initSqlJs({ wasmBinary })

  // 数据库文件路径
  dbPath = path.join(app.getPath('userData'), 'chat.db')
  console.log('数据库路径:', dbPath)

  // 如果数据库文件存在，加载它
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath)
    db = new SQL.Database(fileBuffer)
  } else {
    db = new SQL.Database()
  }

  // 创建表
  db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      target_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      avatar TEXT DEFAULT '',
      unread_count INTEGER DEFAULT 0,
      last_message TEXT,
      last_time TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL,
      sender_id INTEGER NOT NULL,
      receiver_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      type TEXT DEFAULT 'text',
      is_read INTEGER DEFAULT 0,
      is_recalled INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS group_messages (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL,
      group_id INTEGER NOT NULL,
      sender_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      type TEXT DEFAULT 'text',
      is_recalled INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    )
  `)

  // 保存到文件
  saveDatabase()

  return db
}

// 保存数据库到文件
function saveDatabase(): void {
  if (!db || !dbPath) return
  const data = db.export()
  const buffer = Buffer.from(data)
  fs.writeFileSync(dbPath, buffer)
}

// 获取数据库实例
export function getDatabase(): Database {
  if (!db) {
    throw new Error('数据库未初始化，请先调用 initDatabase()')
  }
  return db
}

// 关闭数据库
export function closeDatabase(): void {
  if (db) {
    saveDatabase()
    db.close()
    db = null
  }
}

// ============ 会话操作 ============

export function saveSessions(userId: number, sessions: any[]): void {
  const db = getDatabase()

  db.run('DELETE FROM sessions WHERE user_id = ?', [userId])

  const stmt = db.prepare(`
    INSERT INTO sessions (id, user_id, type, target_id, name, avatar, unread_count, last_message, last_time)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  for (const session of sessions) {
    stmt.run([
      session.id,
      userId,
      session.type,
      session.targetId,
      session.name,
      session.avatar || '',
      session.unreadCount || 0,
      session.lastMessage || null,
      session.lastTime || null,
    ])
  }
  stmt.free()

  saveDatabase()
}

export function loadSessions(userId: number): any[] {
  const db = getDatabase()
  const results: any[] = []

  const stmt = db.prepare('SELECT * FROM sessions WHERE user_id = ? ORDER BY created_at DESC')
  stmt.bind([userId])

  while (stmt.step()) {
    const row = stmt.getAsObject()
    results.push({
      id: row.id,
      type: row.type,
      targetId: row.target_id,
      name: row.name,
      avatar: row.avatar,
      unreadCount: row.unread_count,
      lastMessage: row.last_message,
      lastTime: row.last_time,
    })
  }
  stmt.free()

  return results
}

// ============ 私聊消息操作 ============

export function saveMessages(userId: number, messages: any[]): void {
  const db = getDatabase()

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO messages (id, user_id, sender_id, receiver_id, content, type, is_read, is_recalled, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  for (const msg of messages) {
    stmt.run([
      msg.id,
      userId,
      msg.sender_id,
      msg.receiver_id,
      msg.content,
      msg.type,
      msg.is_read || 0,
      msg.is_recalled || 0,
      msg.created_at,
    ])
  }
  stmt.free()

  saveDatabase()
}

export function loadMessages(userId: number, targetId: number, limit = 50, offset = 0): any[] {
  const db = getDatabase()
  const results: any[] = []

  const stmt = db.prepare(`
    SELECT * FROM messages
    WHERE user_id = ? AND (sender_id = ? OR receiver_id = ?)
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `)
  stmt.bind([userId, targetId, targetId, limit, offset])

  while (stmt.step()) {
    results.push(stmt.getAsObject())
  }
  stmt.free()

  return results
}

// ============ 群聊消息操作 ============

export function saveGroupMessages(userId: number, messages: any[]): void {
  const db = getDatabase()

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO group_messages (id, user_id, group_id, sender_id, content, type, is_recalled, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)

  for (const msg of messages) {
    stmt.run([
      msg.id,
      userId,
      msg.group_id,
      msg.sender_id,
      msg.content,
      msg.type,
      msg.is_recalled || 0,
      msg.created_at,
    ])
  }
  stmt.free()

  saveDatabase()
}

export function loadGroupMessages(userId: number, groupId: number, limit = 50, offset = 0): any[] {
  const db = getDatabase()
  const results: any[] = []

  const stmt = db.prepare(`
    SELECT * FROM group_messages
    WHERE user_id = ? AND group_id = ?
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `)
  stmt.bind([userId, groupId, limit, offset])

  while (stmt.step()) {
    results.push(stmt.getAsObject())
  }
  stmt.free()

  return results
}

// ============ 消息搜索 ============

export function searchMessages(userId: number, keyword: string): any[] {
  const db = getDatabase()
  const results: any[] = []
  const likeKeyword = `%${keyword}%`

  // 搜索私聊消息
  const stmt1 = db.prepare(`
    SELECT *, 'private' as chat_type FROM messages
    WHERE user_id = ? AND content LIKE ? AND is_recalled = 0
    ORDER BY created_at DESC LIMIT 50
  `)
  stmt1.bind([userId, likeKeyword])
  while (stmt1.step()) {
    results.push(stmt1.getAsObject())
  }
  stmt1.free()

  // 搜索群聊消息
  const stmt2 = db.prepare(`
    SELECT *, 'group' as chat_type FROM group_messages
    WHERE user_id = ? AND content LIKE ? AND is_recalled = 0
    ORDER BY created_at DESC LIMIT 50
  `)
  stmt2.bind([userId, likeKeyword])
  while (stmt2.step()) {
    results.push(stmt2.getAsObject())
  }
  stmt2.free()

  return results.sort((a, b) =>
    new Date(b.created_at as string).getTime() - new Date(a.created_at as string).getTime()
  )
}

// ============ 清除用户数据 ============

export function clearUserData(userId: number): void {
  const db = getDatabase()
  db.run('DELETE FROM sessions WHERE user_id = ?', [userId])
  db.run('DELETE FROM messages WHERE user_id = ?', [userId])
  db.run('DELETE FROM group_messages WHERE user_id = ?', [userId])
  saveDatabase()
}
