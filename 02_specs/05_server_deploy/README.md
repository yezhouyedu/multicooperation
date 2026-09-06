# 05_server_deploy

本目录专门放服务器上线与运维相关文档。

它和 `04_pre_deploy/` 的边界是：

- `04_pre_deploy/`：变量记录、导出包、数据库文件夹阅读、材料存储口径。
- `05_server_deploy/`：服务器、Docker、域名、HTTPS、SSH、备份恢复、日志排障、上线协作方式。

## 当前文件

- `命令运行清单.md`
  - 日常运维常用命令：SSH 连接、查看状态、日志、重启、停止、git archive 部署、数据库操作、排查问题。
- `上线前工作指导.md`
  - 记录 P0/P1/P2 上线阶段、协作方式、SSH 私钥位置约定、正式实验前运维边界。P0 已完成。
- `部署运行手册.md`
  - 记录 Docker compose 启停、生产环境变量、日志查看、HTTPS/Nginx 入口和备份收口。
- `HTTPS部署/HTTPS域名接入方案.md`
  - 本项目 HTTPS 与证书续期真相源，记录 `https://aiseek.tech`、Docker Nginx、证书目录、续期、回滚和 smoke 口径。
- `HTTPS部署/Nginx 服务器证书安装.md`
  - 腾讯云通用 WordPress/Nginx 供应商参考，不适用于本项目 Docker Nginx，不能作为执行手册。

## 当前原则

- 业务代码在本地仓库改，服务器只作为部署运行环境。
- SSH 私钥内容不进仓库或 Markdown；仓库外私钥路径可在 `命令运行清单.md` 中记录。
- 长耗时部署任务优先写成可观察脚本或分步骤命令，让操作者能看到进度。
- 生产部署前必须先在本地跑过生产式验证。
- 当前公网主入口是 `https://aiseek.tech`，`/api/*` 由 Nginx 反代到 server。
- 代码住在 `/opt/multi-cooperation`；PostgreSQL 数据住在 Docker volume `multi-cooperation_postgres_data`；材料运行时副本、AI 图片附件、变量导出包住在 Docker volume `multi-cooperation_server_storage`，容器内路径为 `/app/storage`。
- 当前推荐部署路线是本地 `scripts/deploy/upload-git-archive.ps1` 上传 git HEAD；服务器直连 GitHub 仅作为可选路线。
- 生产环境不要执行 `docker compose down -v`、`docker volume rm ...` 或手动删除 `/var/lib/docker/volumes/...`。
