# BigA-total 换机与部署说明

这个文档记录本项目在不同电脑之间继续迭代、同步代码、查看线上页面时需要的信息。

## 仓库地址

- GitHub 仓库：https://github.com/leejiazhi88-gif/BigA-total
- 线上页面：https://leejiazhi88-gif.github.io/BigA-total/

## 本机常用路径

当前这台电脑上的项目目录：

```text
/Users/fuguiplus/Documents/Codex/2026-06-08/bili-atotal/work/BigA-total
```

主要页面文件：

```text
index.html
outputs/a_share_20y_dashboard.html
```

## 换一台电脑继续开发

首次使用时克隆仓库：

```bash
git clone https://github.com/leejiazhi88-gif/BigA-total.git
cd BigA-total
```

每次开始工作前先同步远端最新代码：

```bash
git pull --rebase
```

修改完成后提交并推送：

```bash
git status
git add .
git commit -m "描述这次修改"
git push
```

推送完成后，GitHub Pages 会自动更新线上页面。线上缓存可能需要等待几分钟。

## 本地运行

生成页面：

```bash
node ./work/build_market_dashboard.js
```

本地预览：

```bash
node ./work/preview_server.js
```

然后打开：

```text
http://127.0.0.1:9876
```

注意：`127.0.0.1:9876` 只是当前电脑的本地预览地址，电脑关机或预览服务停止后就不能访问。真正的线上地址是：

```text
https://leejiazhi88-gif.github.io/BigA-total/
```

## GitHub 登录

如果新电脑第一次执行 `git push` 时提示无法读取用户名或密码，需要先完成 GitHub 认证。推荐使用 GitHub CLI：

```bash
gh auth login
```

如果没有安装 `gh`，也可以继续使用 HTTPS 推送时弹出的 GitHub 登录/token 流程。macOS 通常会把凭据保存到钥匙串。

## 数据与运行注意事项

- 项目会使用 Python 脚本拉取部分估值与情绪数据。
- 如果设置了 `CODEX_PYTHON` 或 `PYTHON`，生成脚本会优先使用它们。
- 如果没有设置，会自动尝试 `python3` 和 `python`。
- Tushare 部分接口可能需要账号权限；权限不足时，脚本会尽量使用已有缓存数据。
- 如果外部行情接口临时断开，可以稍后重试生成命令。

## Codex 协作约定

后续每完成一步，请在最后给出：

- 最新本地文件路径
- 可验收的线上 URL
- 当前 git 状态或需要人工确认的点
