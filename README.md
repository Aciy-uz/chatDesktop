# ChatClient - 仿微信即时通讯客户端

基于 Vue 3 + TypeScript + Vite + Pinia + Vue Router 的聊天客户端，配合 ChatServer 后端使用。

> 后端项目 ：[ChatServer](https://github.com/Aciy-uz/ChatServes)

## 技术栈

- **框架**: Vue 3 (Composition API)
- **语言**: TypeScript
- **构建工具**: Vite
- **状态管理**: Pinia
- **路由**: Vue Router
- **WebSocket**: Socket.io Client

## 项目结构

```
src/
├── assets/          # 静态资源
├── components/      # 组件
│   ├── Sidebar.vue        # 左侧导航栏
│   ├── SessionList.vue    # 会话列表
│   ├── ContactPanel.vue   # 通讯录面板
│   └── ChatWindow.vue     # 聊天窗口
├── router/          # 路由配置
├── services/        # 服务层
│   ├── api.ts             # HTTP API 封装
│   ├── rsa.ts             # RSA 加密工具
│   └── socket.ts          # WebSocket 服务
├── stores/          # Pinia 状态管理
│   ├── auth.ts            # 认证状态
│   ├── contact.ts         # 联系人状态
│   └── chat.ts            # 聊天状态
├── types/           # TypeScript 类型定义
├── views/           # 页面视图
│   ├── Login.vue          # 登录页
│   ├── Register.vue       # 注册页
│   └── Chat.vue           # 主聊天页
├── App.vue          # 根组件
└── main.ts          # 入口文件
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

开发环境配置已包含在 `.env.development` 中：

```env
VITE_API_BASE=http://localhost:3000
VITE_SOCKET_URL=http://localhost:3000
```

如需修改 API 地址，可创建 `.env.local` 文件覆盖。

### 3. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:5173

### 4. 构建生产版本

```bash
npm run build
```

## 功能特性

- 用户注册/登录（RSA 加密 + 验证码）
- 好友管理（搜索、申请、接受/拒绝、删除）
- 私聊（文字、图片、文件）
- 群聊（创建、管理、消息）
- 消息撤回（2分钟内）
- 消息已读/未读状态
- 在线状态显示
- 离线消息推送

## Electron 迁移

项目已为 Electron 迁移做好准备：

1. **环境变量配置**: API 地址通过环境变量配置，可轻松修改
2. **模块化架构**: 服务层（api/socket）独立于 UI，便于替换
3. **相对路径**: 构建输出使用相对路径 (`base: './'`)
4. **无浏览器特定依赖**: 核心逻辑不依赖浏览器 API

迁移步骤：

```bash
# 1. 安装 Electron
npm install electron electron-builder -D

# 2. 创建 electron/main.ts 主进程文件

# 3. 配置 package.json 的 main 字段和构建脚本

# 4. 修改 vite.config.ts 添加 Electron 插件
```

## 许可证

MIT
