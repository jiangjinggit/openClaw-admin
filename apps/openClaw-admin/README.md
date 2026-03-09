# 龙虾管理后台

一个部署在云服务器上的轻量只读文档后台，面向 OpenClaw / 项目目录的文档浏览场景。

## 功能

- 浏览指定目录下的文档树
- 支持文件类型：
  - `.md`
  - `.txt`
  - `.json`
  - `.yaml`
  - `.yml`
- Markdown 渲染预览
- 原生 Markdown 源码折叠查看
- 文件名 / 正文内容搜索
- 登录密码保护
- systemd 常驻运行
- 支持开机自启

## 当前默认配置

- 站点名称：`龙虾管理后台`
- 默认端口：`3001`
- 默认文档根目录：`/root/.openclaw`
- 服务名：`lobster-admin`

## 本地开发

```bash
cd apps/openClaw-admin
npm install
npm run dev
```

默认启动后访问：

```bash
http://127.0.0.1:3001/login
```

## 环境变量

| 变量名 | 说明 | 默认值 |
|---|---|---|
| `PORT` | 服务端口 | `3001` |
| `DOC_ROOT` | 要展示的根目录 | `/root/.openclaw` |
| `DOCS_PASSWORD` | 登录密码 | `djy-docs-2026` |
| `SITE_NAME` | 站点名称 | `龙虾管理后台` |

示例：

```bash
PORT=3001 \
DOC_ROOT=/root/.openclaw \
DOCS_PASSWORD='your-password' \
SITE_NAME='龙虾管理后台' \
node server.js
```

## 生产部署

### 1. 安装依赖

```bash
cd /root/.openclaw/workspace-djy-build/apps/openClaw-admin
npm install
```

### 2. 配置 systemd

项目已提供服务文件：

```bash
apps/openClaw-admin/doc-viewer.service
```

复制到系统目录：

```bash
cp apps/openClaw-admin/doc-viewer.service /etc/systemd/system/lobster-admin.service
systemctl daemon-reload
systemctl enable lobster-admin
systemctl restart lobster-admin
```

### 3. 检查状态

```bash
systemctl status lobster-admin
journalctl -u lobster-admin -n 100 --no-pager
```

### 4. 放行端口

确保云服务器安全组放行：

- TCP `3001`

浏览器访问：

```bash
http://服务器公网IP:3001/login
```

## 常用运维命令

### 重启服务

```bash
systemctl restart lobster-admin
```

### 停止服务

```bash
systemctl stop lobster-admin
```

### 启动服务

```bash
systemctl start lobster-admin
```

### 查看日志

```bash
journalctl -u lobster-admin -f
```

### 查看端口监听

```bash
ss -ltnp | grep 3001
```

## 目录与安全说明

- 服务只允许读取 `DOC_ROOT` 指定根目录下的文件
- 默认忽略：
  - `node_modules`
  - `.git`
  - `.next`
  - `dist`
  - `build`
  - `.turbo`
  - `.cache`
- Markdown 渲染默认关闭原始 HTML，以降低 XSS 风险

## 当前已知限制

- 目前是只读后台，不支持在线编辑
- 暂未接入 HTTPS
- 暂未接入更细粒度账号体系
- 大目录下搜索仍是轻量实现，后续可继续做索引优化

## 推荐后续增强

- 增加 README 首页卡片与统计
- 增加文件更新时间显示
- 增加白名单 IP 访问控制
- 增加 HTTPS / Nginx 反向代理
- 增加更多可查看文件类型（如 `.log`、`.ini`、`.toml`）
