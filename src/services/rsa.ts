import { api } from './api'

let cachedPublicKey: string | null = null

async function getPublicKey(): Promise<string> {
  if (!cachedPublicKey) {
    cachedPublicKey = await api.getPublicKey()
  }
  return cachedPublicKey
}

export async function encryptPassword(password: string): Promise<string> {
  const publicKey = await getPublicKey()

  // 解析 PEM 格式的公钥
  const pemHeader = '-----BEGIN PUBLIC KEY-----'
  const pemFooter = '-----END PUBLIC KEY-----'
  const pemContents = publicKey
    .replace(pemHeader, '')
    .replace(pemFooter, '')
    .replace(/\s/g, '')

  // Base64 解码为 ArrayBuffer
  const binaryString = atob(pemContents)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }

  // 导入公钥
  const cryptoKey = await crypto.subtle.importKey(
    'spki',
    bytes,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt']
  )

  // 加密
  const encoded = new TextEncoder().encode(password)
  const encrypted = await crypto.subtle.encrypt(
    { name: 'RSA-OAEP' },
    cryptoKey,
    encoded
  )

  // 转为 Base64
  return btoa(String.fromCharCode(...new Uint8Array(encrypted)))
}
