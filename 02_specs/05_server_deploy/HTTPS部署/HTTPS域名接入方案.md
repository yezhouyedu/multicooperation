# HTTPS 域名接入方案

> 更新日期：2026-09-06
> 当前域名：`aiseek.tech`、`www.aiseek.tech`  
> 当前服务器：`49.233.203.108`

## 1. 当前目标

把线上访问入口从裸 IP 收口到：

- 前台 / admin：`https://aiseek.tech`
- 后端健康检查：`https://aiseek.tech/api/health`

`www.aiseek.tech` 只作为兼容入口，统一 301 跳转到 `https://aiseek.tech`。

## 2. 已具备条件

- DNS A 记录：
  - `aiseek.tech -> 49.233.203.108`
  - `www.aiseek.tech -> 49.233.203.108`
- 腾讯云安全组已放行：
  - TCP 80
  - TCP 443
  - TCP 22
- SSL 证书本地检查确认 SAN 包含：
  - `aiseek.tech`
  - `www.aiseek.tech`

## 3. 生产架构

生产 Docker Compose 增加 `nginx` 容器：

```text
Browser
  |
  | https://aiseek.tech
  v
nginx:80/443
  |-- /       -> web:3000
  |-- /api/*  -> server:3001/*
```

Nginx 配置文件：

```text
infra/nginx/production.conf
```

证书文件放在服务器：

```text
/etc/multi-cooperation/certs/aiseek.tech_bundle.crt
/etc/multi-cooperation/certs/aiseek.tech.key
```

证书私钥内容不进 git、不写入 Markdown、不放入 `02_specs` 可提交内容。

当前证书已于 2026-08-31 完成续期：

- 证书序列号：`0C209191A5272082A38AA812B8EF0F34`
- 到期时间：2026-11-29 07:59:59（Asia/Shanghai）
- 服务器备份：`/etc/multi-cooperation/cert-backups/20260831T164017+0800`
- 当前证书：`/etc/multi-cooperation/certs/aiseek.tech_bundle.crt`
- 当前私钥：`/etc/multi-cooperation/certs/aiseek.tech.key`

## 4. 生产环境变量

服务器 `/opt/multi-cooperation/.env.production` 需要使用：

```text
NEXT_PUBLIC_SERVER_BASE_URL=https://aiseek.tech/api
NGINX_CERT_DIR=/etc/multi-cooperation/certs
HTTP_PUBLIC_PORT=80
HTTPS_PUBLIC_PORT=443
```

改完后必须重新构建 web，因为 `NEXT_PUBLIC_SERVER_BASE_URL` 会进入 Next.js 构建产物。

## 5. 部署验证

服务器内验证：

```bash
cd /opt/multi-cooperation
docker compose --env-file .env.production -f compose.production.yml ps
curl http://127.0.0.1:3001/health
curl -I http://127.0.0.1/healthz
curl --resolve aiseek.tech:443:127.0.0.1 https://aiseek.tech/api/health
```

本地外部验证：

```powershell
Invoke-WebRequest -UseBasicParsing https://aiseek.tech/api/health
Invoke-WebRequest -UseBasicParsing https://aiseek.tech/admin
Invoke-WebRequest -UseBasicParsing http://aiseek.tech -MaximumRedirection 0
```

## 6. 证书续期和回滚

续期证书时：

1. 确认证书 SAN 同时包含 `aiseek.tech` 和 `www.aiseek.tech`，并核对有效期与证书/私钥匹配。
2. 在服务器 `/etc/multi-cooperation/cert-backups/<时间戳>/` 备份当前 `.crt` 和 `.key`。
3. 将新文件写入 `/etc/multi-cooperation/certs/` 的固定文件名，权限只允许必要账户读取。
4. 在 Nginx 容器内执行配置检查后重载；若当前镜像不支持平滑重载，仅重建 `nginx` 服务，不重建数据库 volume。
5. 从公网核对证书序列号、到期时间、主域名、`www` 跳转、`/api/health` 和 `/admin`。
6. 验证失败时，从最近备份恢复证书并重启 `nginx`。

续期只替换证书文件，不需要修改业务数据库，也不得执行 `docker compose down -v`。

## 7. 稳定后收口

HTTPS 稳定后，建议把腾讯云安全组里的公网 3000 / 3001 关闭，只保留：

- 80
- 443
- 22

关闭 3000 / 3001 前需要确认：

- `https://aiseek.tech` 能打开登录页和 admin。
- `https://aiseek.tech/api/health` 返回 200。
- AI、SSE、图片上传、变量导出都能通过 `/api` 代理工作。
