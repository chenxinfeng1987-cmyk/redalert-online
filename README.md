# 红色警戒 联机服务器

一个极简的中转服务器：**静态托管游戏** + **WebSocket 消息转发**（不运行游戏逻辑，房主权威）。

## 一、准备文件

服务器仓库内需要这些文件：

```
redalert-server/
├── server.js          # 服务器（已就绪）
├── package.json       # 已就绪
├── public/
│   └── 红色警戒.html   # ← 把改造后的游戏文件复制到这里
└── README.md
```

> 游戏文件在 `D:\儿童学习\红色警戒.html`，部署前复制一份到 `public\` 目录。

## 二、部署到 Render（免费，海外，国内可访问）

1. 打开 https://dashboard.render.com ，用 **GitHub 账号登录**。
2. 本仓库先推到 GitHub（见下方命令）。
3. Render → **New** → **Web Service** → 选择该 GitHub 仓库。
4. 填写：
   - **Name**: 任意，如 `redalert`
   - **Region**: **Singapore**（离国内最近）
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Instance Type**: **Free**
5. 点 **Create Web Service**，等 1~2 分钟构建完成。
6. 顶部会给出网址：`https://xxxx.onrender.com` —— 发给朋友打开即玩。

## 三、推到 GitHub（在本机 `redalert-server` 目录执行）

```powershell
cd D:\儿童学习\redalert-server
git init
git add .
git commit -m "redalert server"
git branch -M main
git remote add origin https://github.com/你的用户名/redalert-online.git
git push -u origin main
```

## 四、免费版注意事项

- **冷启动**：空闲 15 分钟会休眠，之后第一位打开的人需等待约 **1 分钟**唤醒（页面会白屏等待，属正常）。
- **每月 750 实例小时**、出网带宽约 100GB（够玩上百小时）。
- 需要**保活**可加一个免费定时器（如 cron-job.org）每 10 分钟访问一次 `https://xxxx.onrender.com/healthz`，但会占用实例小时额度。

## 五、本地自测（可选）

需要本机装 Node.js，然后：

```powershell
cd D:\儿童学习\redalert-server
npm install
node server.js
# 浏览器打开 http://localhost:8000
```
