export {}

declare global {
  interface Window {
    electronAPI?: {
      showNotification: (title: string, body: string) => Promise<void>
      getAppPath: () => Promise<string>
      platform: string
      isElectron: boolean
      db: {
        saveSessions: (userId: number, sessions: any[]) => Promise<void>
        loadSessions: (userId: number) => Promise<any[]>
        saveMessages: (userId: number, messages: any[]) => Promise<void>
        loadMessages: (userId: number, targetId: number, limit?: number, offset?: number) => Promise<any[]>
        saveGroupMessages: (userId: number, messages: any[]) => Promise<void>
        loadGroupMessages: (userId: number, groupId: number, limit?: number, offset?: number) => Promise<any[]>
        searchMessages: (userId: number, keyword: string) => Promise<any[]>
        clearUserData: (userId: number) => Promise<void>
      }
    }
  }
}
