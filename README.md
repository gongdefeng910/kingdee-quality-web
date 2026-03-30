# 金蝶小微官网质量部 V2.0 - 完整部署教程

> 纯线上部署模式 | 前端 GitHub Pages + 后端 Render

---

## 项目简介

金蝶小微官网质量部数据展示平台 V2.0，前后端完全分离：

- **前端**：HTML + CSS + JS + Chart.js，部署到 GitHub Pages
- **后端**：Python Flask + SQLite（兼容 PostgreSQL），部署到 Render
- **认证**：JWT + HttpOnly Cookie，bcrypt 密码哈希
- **API**：RESTful `/api/v1/` 统一规范
- **登录账号**：admin / admin123

## 项目结构

```
kingdee-quality-web/
├── frontend/                  # 前端静态站点（GitHub Pages）
│   ├── index.html             # 对外官网（脱敏数据展示）
│   ├── admin.html             # 内部管理（登录后可见）
│   ├── css/
│   │   └── style.css          # 金蝶风格样式
│   └── js/
│       └── app.js             # 前端交互与 API 调用
├── backend/                   # 后端 API 服务（Render）
│   ├── app.py                 # Flask 主程序
│   ├── models.py              # 数据库模型（SQLAlchemy ORM）
│   └── requirements.txt       # Python 依赖
└── README.md                  # 本部署教程
```

## V2.0 安全特性

| 特性 | 说明 |
|------|------|
| 密码存储 | bcrypt 哈希，不存明文 |
| Token 传输 | HttpOnly + Secure Cookie，防 XSS 窃取 |
| 速率限制 | 登录接口 5次/分钟，防暴力破解 |
| CORS 白名单 | 仅允许指定前端域名调用 API |
| 安全响应头 | X-Frame-Options、X-Content-Type-Options 等 |
| 输入校验 | 指标 key 白名单，数值类型校验 |
| 密钥管理 | SECRET_KEY 通过环境变量注入 |

---

## 第一部分：前端部署到 GitHub Pages

### 步骤 1：创建 GitHub 仓库

1. 登录 [GitHub](https://github.com)
2. 点击右上角 **+** → **New repository**
3. 填写仓库信息：
   - **Repository name**: `kingdee-quality-web`
   - **Description**: 金蝶小微官网质量部数据平台 V2.0
   - **Public**（必须公开才能使用 GitHub Pages）
   - 勾选 **Add a README file**
4. 点击 **Create repository**

### 步骤 2：上传前端代码

#### 方式 A：网页上传

1. 进入仓库页面
2. 点击 **Add file** → **Upload files**
3. 将 `frontend` 文件夹内的所有文件拖拽到上传区域：
   - `index.html`
   - `admin.html`
   - `css/style.css`
   - `js/app.js`
4. 点击 **Commit changes**

> 注意：需要保持 `css/` 和 `js/` 的目录结构

#### 方式 B：Git 命令上传（推荐）

```bash
git clone https://github.com/你的用户名/kingdee-quality-web.git
cd kingdee-quality-web

# 将 frontend 目录下的文件复制到仓库根目录
# （GitHub Pages 需要 index.html 在根目录或指定目录）
cp -r /path/to/frontend/* .

git add .
git commit -m "添加前端代码 V2.0"
git push origin main
```

### 步骤 3：开启 GitHub Pages

1. 进入仓库 → **Settings** → 左侧菜单 **Pages**
2. **Source** 选择：
   - Branch: `main`
   - Folder: `/ (root)`
3. 点击 **Save**
4. 等待 1-2 分钟，获取访问地址：
   - `https://你的用户名.github.io/kingdee-quality-web/`

### 步骤 4：验证前端

1. 访问上述地址
2. 确认能看到金蝶 Logo 和首页内容
3. 点击「登录」测试弹窗

---

## 第二部分：后端部署到 Render

### 步骤 1：上传后端代码

确保 GitHub 仓库中包含 `backend/` 目录：

```
backend/
├── app.py
├── models.py
└── requirements.txt
```

如果前面上传前端时覆盖了根目录，需要将 `backend/` 目录也推送到仓库：

```bash
# 在仓库根目录下
mkdir backend
cp /path/to/backend/* backend/
git add backend/
git commit -m "添加后端代码"
git push origin main
```

### 步骤 2：注册 Render

1. 访问 [Render](https://render.com)
2. 点击 **Get Started for Free**
3. 选择 **Continue with GitHub** 登录

### 步骤 3：创建 Web Service

1. 登录后点击 **New +** → **Web Service**
2. 选择你的 `kingdee-quality-web` 仓库
3. 点击 **Connect**

### 步骤 4：配置服务

| 配置项 | 值 |
|--------|-----|
| **Name** | `kingdee-quality-api` |
| **Region** | `Singapore` 或 `Oregon` |
| **Branch** | `main` |
| **Root Directory** | `backend` |
| **Runtime** | `Python 3` |
| **Build Command** | `pip install -r requirements.txt` |
| **Start Command** | `gunicorn app:app` |
| **Plan** | `Free` |

### 步骤 5：配置环境变量

在 Render 服务页面 → **Environment** 中添加：

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `SECRET_KEY` | 自行生成一个随机字符串（32位以上） | JWT 签名密钥 |
| `FLASK_ENV` | `production` | 启用安全 Cookie |
| `ALLOWED_ORIGINS` | `https://你的用户名.github.io` | CORS 白名单 |

> 生成 SECRET_KEY 方法：在终端运行 `python -c "import secrets; print(secrets.token_hex(32))"`

### 步骤 6：等待部署

1. Render 自动拉取代码、安装依赖、启动服务
2. 等待状态变为 **Live**
3. 记录服务地址：`https://kingdee-quality-api.onrender.com`

### 步骤 7：验证后端

浏览器访问：

```
https://kingdee-quality-api.onrender.com/api/v1/health
```

应返回：

```json
{
    "code": 200,
    "message": "success",
    "data": { "status": "healthy", "version": "2.0.0" },
    "timestamp": "..."
}
```

---

## 第三部分：前后端联调

### 步骤 1：修改前端 API 地址

有两种方式：

**方式 A：通过管理后台设置（推荐）**

1. 打开前端页面，点击登录（此时后端未连接，登录会失败）
2. 直接打开 `admin.html`
3. 点击「系统设置」→ 填写后端 API 地址（如 `https://kingdee-quality-api.onrender.com`）
4. 点击「保存配置」
5. 刷新页面

**方式 B：修改代码中的默认值**

1. 打开 `js/app.js`
2. 找到第 7 行：
   ```javascript
   API_BASE: localStorage.getItem('apiBaseUrl') || 'http://localhost:5000',
   ```
3. 将 `http://localhost:5000` 替换为你的 Render 地址
4. 提交并推送到 GitHub

### 步骤 2：完整功能测试

1. 访问 GitHub Pages 前端地址
2. 确认公开数据正常显示
3. 点击「登录」→ 输入 `admin` / `admin123`
4. 确认登录成功后：
   - 右侧内部面板解锁
   - 切换「对内版」显示内部数据
5. 点击「数据管理」进入 admin 页面
6. 修改指标数值并保存
7. 返回首页确认数据已更新

---

## 第四部分：数据管理说明

### 登录信息

- **账号**：`admin`
- **密码**：`admin123`

### 可修改的指标

| 类别 | 指标 | 说明 |
|------|------|------|
| 核心指标 | 拦截风险内容 | 累计拦截的风险内容数量 |
| 核心指标 | 版本发布次数 | 累计版本发布次数 |
| 核心指标 | 页面性能提升 (%) | 性能优化百分比 |
| 核心指标 | 重大内容错误 | 重大内容错误数量 |
| 内部指标 | 本周测试用例 | 本周执行的测试用例数 |
| 内部指标 | 缺陷修复率 (%) | 缺陷修复完成百分比 |
| 内部指标 | 自动化覆盖率 (%) | 自动化测试覆盖百分比 |
| 内部指标 | 平均修复时长 (h) | 缺陷平均修复时长 |

---

## 第五部分：API 接口文档

### 基础信息

- 基础路径：`/api/v1/`
- 认证方式：HttpOnly Cookie（登录后自动携带）

### 统一响应格式

```json
{
    "code": 200,
    "message": "success",
    "data": { ... },
    "timestamp": "2026-03-30T10:00:00.000000Z"
}
```

### 接口列表

| 方法 | 路径 | 说明 | 认证 |
|------|------|------|:---:|
| POST | `/api/v1/auth/login` | 登录 | N |
| POST | `/api/v1/auth/logout` | 退出 | N |
| GET | `/api/v1/auth/me` | 当前用户信息 | Y |
| GET | `/api/v1/metrics/public` | 获取公开指标 | N |
| PUT | `/api/v1/metrics/public` | 更新公开指标 | Y |
| GET | `/api/v1/metrics/internal` | 获取内部指标 | Y |
| PUT | `/api/v1/metrics/internal` | 更新内部指标 | Y |
| GET | `/api/v1/health` | 健康检查 | N |

---

## 第六部分：常见问题

### Q1: GitHub Pages 显示 404？

- 确认仓库是 **Public**
- 确认 `index.html` 在正确目录下
- 等待 2-3 分钟后刷新

### Q2: Render 部署失败？

- 确认 **Root Directory** 设置为 `backend`
- 检查 `requirements.txt` 内容是否正确
- 查看 Render Events 日志中的错误信息

### Q3: 登录提示"请求失败"？

- 确认前端 API 地址配置正确
- 确认 Render 服务状态为 Live
- 确认 `ALLOWED_ORIGINS` 环境变量包含你的 GitHub Pages 域名
- 浏览器 F12 查看 Console 和 Network 错误

### Q4: Render 免费版休眠问题

Render 免费版 15 分钟无访问后休眠，首次访问需等待约 30 秒。解决方案：

- 使用 [UptimeRobot](https://uptimerobot.com) 每 5 分钟 Ping `/api/v1/health`
- 或升级到 Render Starter Plan

### Q5: 跨域 Cookie 不生效？

- 确认后端 `FLASK_ENV=production`（启用 Secure + SameSite=None）
- 确认 `ALLOWED_ORIGINS` 设置正确
- 部分浏览器（如 Safari）默认阻止第三方 Cookie，需在设置中允许

---

## 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| 前端 | HTML5 + CSS3 + ES5 | - |
| 图表 | Chart.js | 4.4.0 |
| 后端 | Python Flask | 3.0.0 |
| ORM | Flask-SQLAlchemy | 3.1.1 |
| 数据库 | SQLite | 内置 |
| 认证 | PyJWT + bcrypt | 2.8.0 / 4.1.2 |
| 安全 | Flask-CORS + Flask-Limiter | 4.0.0 / 3.5.0 |
| 部署 | GitHub Pages + Render | - |

---

**版权所有 &copy; 2026 金蝶软件（中国）有限公司**
