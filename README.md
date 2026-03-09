# openClaw-admin

这是一个运行在云服务器上的轻量文档管理后台项目，当前默认产品名为 **龙虾管理后台**。

## 目标

方便在浏览器中查看服务器指定目录下的项目文档与配置文件，重点支持 Markdown 渲染和源码查看。

## 当前能力

- 目录树浏览
- Markdown 渲染
- Markdown 原文折叠查看
- TXT / JSON / YAML 查看
- 搜索文件名与正文
- 登录密码保护
- systemd 开机自启与常驻

## 项目位置

主程序位于：

```bash
apps/doc-viewer/
```

详细部署与运维说明见：

- [apps/doc-viewer/README.md](./apps/doc-viewer/README.md)

## 线上运行信息

默认配置：

- 端口：`3001`
- systemd 服务名：`lobster-admin`
- 文档根目录：`/root/.openclaw`

## 快速启动

```bash
cd apps/doc-viewer
npm install
npm run dev
```

## 生产启动

```bash
cp apps/doc-viewer/doc-viewer.service /etc/systemd/system/lobster-admin.service
systemctl daemon-reload
systemctl enable lobster-admin
systemctl restart lobster-admin
```
