# 发布契约 · PUBLISH

> 这个文件是**给我（AI 助手）看的执行说明**，也是给人看的说明书。
> 用法：把项目文件夹（里面要带 `PUBLISH.md` + `publish.config.json`）丢给我，说一句「**发布**」。
> 我会按下面的「执行清单」做完，然后回你一个可以发给任何人的网址。
> 换项目也照样管用——把这两个文件复制到新项目里，改一下 `repo.name` 就行。

## 1. 一句话意图

把这个目录当作**纯静态网站**发布到 GitHub，开启 GitHub Pages，产出公网地址供他人直接访问。

## 2. 当前项目

| 项 | 值 |
| --- | --- |
| 项目名 | Linux 学习指南（WSL2 入门）· 银河系知识地图 |
| 站点类型 | 纯静态（HTML + CSS + 原生 JS，**无构建、无后端、无 npm**） |
| 站点根目录 | 本目录（入口 `index.html`） |
| 仓库名 | `linux-learn` |
| 可见性 | **public**（GitHub 免费账号只有公开仓库能开 Pages） |
| 分支 | `main` |
| 预计公开地址 | `https://likewater16888-art.github.io/linux-learn/` |
| 外部依赖 | **无**（D3 已内置在 `js/lib/d3.min.js`，不再依赖 CDN） |
| 敏感信息 | **无**（正文已核查：无 API Key / token / 密码；用户自填的 Key 只存浏览器 localStorage） |

## 3. 执行清单（我按顺序做）

1. **体检**：`node --check` 全部 JS；扫一遍 `sk-`、`token`、`password` 等硬编码密钥；确认没有 `_*` 临时文件被纳入。
2. **初始化**：`git init -b main`（已有 `.git` 则跳过）；按 `.gitignore` 过滤 `_*`、`*.out`、`node_modules`。
3. **提交身份**：`user.name` / `user.email` 用 GitHub 账号与 `…@users.noreply.github.com`（不暴露真实邮箱）。
4. **建仓库**：`gh repo create <name> --public --source . --remote origin`（仓库已存在则跳过）。
5. **推送**：`git add -A && git commit && git push -u origin main`。
6. **开 Pages**：`gh api -X POST repos/{owner}/{repo}/pages -f "source[branch]=main" -f "source[path]=/"`（已存在则 PUT 更新）。
7. **验证**：逐个请求 `publish.config.json` 里 `verify` 的地址，直到 `/` 返回 200（首次部署约 30–90 秒）。
8. **回写**：把最终地址写到本文件「4. 当前地址」和 `README.md` 顶部的分享徽章里。
9. **汇报**：输出 `✅ 已发布`、公开地址、仓库地址、本次提交的文件数与体积。

## 4. 当前地址

| 名称 | 地址 |
| --- | --- |
| 🌐 公开访问 | **https://likewater16888-art.github.io/linux-learn/** （已上线，2026-10 验证 200） |
| 📦 源码仓库 | https://github.com/likewater16888-art/linux-learn |

## 5. 发布后怎么更新

对着我说「**发布**」或「**更新一下**」即可：我会 `git add/commit/push`，Pages 自动重建（约 30 秒），**地址永远不变**。

命令行等价操作：

```powershell
git add -A; git commit -m "update: xxx"; git push
```

## 6. 不想公开源码怎么办

把 `publish.config.json` 里 `pages.provider` 改成 `cloudflare`，仓库可见性改成 `private`，
改用 Cloudflare Pages 连接该仓库（免费版支持私有仓库，国内访问通常更快）。其余流程不变。

## 7. 排障速查

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| Pages 里看不到 `main` 分支 | 还没 push 成功 | 先 `git push -u origin main` |
| 打开是 404 | Pages 首次构建中 | 等 1–2 分钟；确认 Settings→Pages 的 Source 是 `main` / `(root)` |
| 页面白屏、控制台 404 | 仓库根目录不是站点根目录 | 保证 `index.html` 在仓库根目录 |
| 星图变成同心圆 | `js/lib/d3.min.js` 没提交 | `git add js/lib/d3.min.js` 后重新发布 |
| 在线 AI 模式报跨域 | 接口不允许浏览器直连 | 改用支持 CORS 的接口，或继续用本地知识库模式 |
