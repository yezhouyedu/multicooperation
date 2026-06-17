# HTTPS 域名接入方案

> 日期：2026-06-17  
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

证书私钥不进 git，不写入 Markdown，不放入 `02_specs` 可提交内容。

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

## 6. 稳定后收口

HTTPS 稳定后，建议把腾讯云安全组里的公网 3000 / 3001 关闭，只保留：

- 80
- 443
- 22

关闭 3000 / 3001 前需要确认：

- `https://aiseek.tech` 能打开登录页和 admin。
- `https://aiseek.tech/api/health` 返回 200。
- AI、SSE、图片上传、变量导出都能通过 `/api` 代理工作。

