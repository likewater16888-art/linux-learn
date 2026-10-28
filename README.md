> **在线访问：** https://likewater16888-art.github.io/linux-learn/

# Linux 学习指南（WSL2 入门）· 银河系知识地图

一个**纯前端、零构建、双击即用**的 Linux 入门交互学习站。内容源自 `../Linux学习指南_WSL2入门.md`，
被整理成一张可缩放的"银河系知识地图"，配合动手例题即时判分、**浏览器内置沙盒终端**（方案 D）与 AI 学习助手。

> 规模：**11 个主题 / 130 个知识点 / 175 道动手例题**，沙盒终端内置 **91 个命令** + 5 套练习工作区。

---

## 一、怎么打开

**方式 0（给别人分享用）**：在线地址 **https://likewater16888-art.github.io/linux-learn/** ，手机、平板、别人的电脑打开就能用，
不需要装任何东西、不需要网络环境配合（D3 已内置）。发布方法见 **第十一章「发布与分享」**。

**方式 1（最简单）**：直接双击 `index.html`，用 Chrome / Edge 打开。
项目刻意**不使用 ES Module**，所以 `file://` 协议下也能正常运行（不会被 CORS 拦住）。

**方式 2（推荐，功能最完整）**：起一个本地静态服务器

```bash
# 在本目录下
python -m http.server 8000
# 浏览器打开 http://localhost:8000
```

> 方式 2 的好处：某些浏览器对 `file://` 的 localStorage / 剪贴板权限更严格，用 http 更顺。
> 两种方式下页面功能一致。

---

## 二、目录结构

```
linux-learn/
├─ index.html                 # 唯一页面（结构 + 外链资源）
├─ css/
│  ├─ theme.css               # 设计变量层：深浅两套主题、字体、圆角、滚动条
│  └─ layout.css              # 结构层：顶栏/目录/星图/详情抽屉/AI 助手/沙盒终端/响应式
├─ js/
│  ├─ lib/
│  │  └─ d3.min.js            # 内置 D3 v7.9.0（唯一第三方依赖，随仓库分发，不依赖 CDN）
│  ├─ util.js                 # 通用工具：DOM 创建、转义、localStorage、防抖
│  ├─ data/
│  │  ├─ knowledge.js         # ★ 主干内容源 + 索引层 + 内容扩展 API
│  │  ├─ ext-terminal.js      # 新增分支「终端与 Shell 基础」
│  │  ├─ ext-files.js         # Day1 / Day2 补充知识点
│  │  ├─ ext-sys.js           # Day3 / Day4 补充知识点
│  │  ├─ ext-ops.js           # Day5~Day7 补充知识点
│  │  ├─ ext-extra.js         # 速查表 / 进阶方向补充知识点
│  │  └─ ext-examples.js      # 给核心知识点补"第二道题"
│  ├─ progress.js             # 学习进度：已学标记、例题对错、设置项（localStorage）
│  ├─ quiz.js                 # 判分引擎：归一化比对 + 关键词 + 编辑距离
│  ├─ sandbox.js              # ★ 沙盒引擎：虚拟文件系统 + 91 个命令 + 迷你 bash（无 DOM）
│  ├─ term.js                 # 沙盒终端界面：输入历史、Tab 补全、例题一键运行
│  ├─ galaxy.js               # 银河系星图：D3 力导向布局 + 内置降级布局
│  ├─ lesson.js               # 知识点详情面板（要点 / 练习 / 沙盒运行 / 关联推荐）
│  ├─ chat.js                 # AI 助手：A1 本地知识库 + A2 在线大模型
│  └─ app.js                  # 入口：主题、目录树、进度环、事件编排
├─ PUBLISH.md                 # ★ 发布契约（给 AI 看的执行说明 + 发布地址）
├─ publish.config.json        # ★ 发布配置（仓库名 / 可见性 / 验证地址）
├─ deploy.ps1                 # ★ 一键发布脚本（建仓 → 推送 → 开 Pages → 验证）
├─ .gitignore
└─ README.md
```

脚本按 **util → data（knowledge + ext-*） → progress → quiz → sandbox → galaxy →
lesson → term → chat → app** 的顺序加载，全部挂在全局命名空间 `window.LX` 下，
没有打包器、没有 npm 依赖。

> `sandbox.js` 刻意**不碰 DOM**：它只负责"一行命令 → 一段输出"，
> 因此既能在浏览器里被 `term.js` 驱动，也能在 node 里直接 require 做单元测试。

---

## 三、功能一览

| 需求 | 实现位置 |
| --- | --- |
| 银河系知识地图（核心 + 分支 + 三级展开） | `js/galaxy.js`（D3 `forceSimulation` + `forceRadial`） |
| 130 个知识点的全称解释与通俗比喻 | `js/data/*.js` 的 `full` / `plain` 字段 |
| 每个知识点带参数细节 / 易错点 | `tips` 字段，详情面板"细节要点" |
| 动手例题（175 道）+ 即时判分 + 分步讲解 | `js/quiz.js` + `js/lesson.js` |
| **例题一键在沙盒里跑**（不碰真实文件） | 例题卡片「▶ 沙盒运行」→ `js/term.js` 的 `runExample()` |
| **沙盒终端：虚拟文件系统 + 91 个命令** | `js/sandbox.js`（`LX.Sandbox.create()`） |
| **沙盒执行 Shell 脚本**（for/while/if/case/函数/参数） | `js/sandbox.js` 的 `Interp` 迷你解释器 |
| 智能关联推荐 | `Data.relatedOf()`：显式关联 → 同父兄弟 → 同分支知识点 |
| 学习进度追踪 / 本地保存 / 一键重置 | `js/progress.js`（`lx_progress_v1`） |
| 11 个主题的侧边目录（可搜索过滤） | `js/app.js` 的 `renderSidebar()` |
| 全站搜索（命令名 / 释义 / 要点）+ 星图高亮 | 顶栏搜索框，回车定位首个命中 |
| AI 助手（无 Key 可用） | `js/chat.js` 的 `localAnswer()` |
| AI 助手（自定义 API Key） | `js/chat.js` 的 `callRemote()` |
| 深色 / 浅色主题 | `css/theme.css` + `data-theme` 属性 |
| 响应式（桌面三栏 / 移动端抽屉） | `css/layout.css` 媒体查询 |

### 交互小抄

| 操作 | 说明 |
| --- | --- |
| 点击节点 | 展开/收起子节点，并在右侧打开详情 |
| 滚轮 | 以鼠标位置为中心缩放 |
| 空白处拖拽 | 平移星图 |
| 拖拽节点 | 手动摆放某个节点（松开后回归力导向） |
| `/` | 聚焦搜索框 |
| `Esc` | 关闭详情 / 助手 / 移动端目录 |
| `Ctrl + Enter` | 在例题输入框内提交答案 |
| `Ctrl + \`` 或左下角 ⌨️ | 打开 / 关闭沙盒终端 |
| 终端内 `↑` `↓` | 翻命令历史 |
| 终端内 `Tab` | 补全命令名 / 路径 |
| 终端内 `Ctrl + L` / `Ctrl + C` | 清屏 / 取消当前输入 |
| 左侧目录点击 | 定位到该知识点并把星图居中 |

---

## 四、内容怎么加？（改一个文件，或加一个主题文件）

`js/data/knowledge.js` 里是一棵**嵌套树**，层级（第 1/2/3 层）、父节点、所属分支
全部由 `flatten()` 自动推导，你只需要写内容：

```js
{
  id: 'rsync',                       // 唯一 id（英文短横线命名）
  name: 'rsync',                     // 显示名
  full: 'remote sync（远程同步）',    // 全称 / 英文原文
  plain: '搬家还带增量：只传变动的部分。', // 通俗比喻
  tips: ['rsync -av 源 目标 —— a 保留属性，v 显示过程'],  // 细节要点
  rel: ['cp', 'tar'],                // 想强关联的其它节点 id
  examples: [{
    q: '把 a 目录同步到 b 目录并显示过程',
    steps: ['-a 归档模式', '-v 显示过程', '命令：rsync -av a/ b/'],
    answer: 'rsync -av a/ b/',
    accept: ['rsync -av a b'],       // 可选：等价写法
    keywords: ['rsync', '-av', 'a', 'b'],  // 可选：判分关键词
    note: '源路径结尾的 / 很关键，漏了会多套一层目录',   // 可选：易错提示
    sandbox: 'files'                 // 可选：这道题的沙盒工作区（home/files/text/perm/script）
  }],
  children: []                       // 第三层：参数细节 / 易错点 / 拓展
}
```

放进对应分支的 `children` 数组即可。若不想动主干文件，也可以在 `js/data/ext-*.js`
里用下面三个 API 追加内容（**加载后自动重建索引，星图/目录/搜索/进度立刻生效**）：

```js
// 1) 新增一个一级主题（第二个参数 = 插在哪个分支后面）
LX.Data.addBranch({ id: 'my-topic', name: '我的主题', icon: '🧪', plain: '…', children: [] }, 'next');

// 2) 给已有知识点追加子节点（返回实际加入数量，id 重复会自动跳过）
LX.Data.addChildren('day6', [{ id: 'my_cmd', name: 'mycmd', full: '…', plain: '…', tips: [] }]);

// 3) 给已有知识点追加例题（不动结构，因此不会重建索引）
LX.Data.addExamples('ls', [{ q: '列出 /tmp 内容', answer: 'ls /tmp', keywords: ['ls', '/tmp'] }]);
```

新增主题记得在 `index.html` 里补一行 `<script>`（放在 `knowledge.js` 之后、`progress.js` 之前）。

---

## 五、判分引擎是怎么判的

`js/quiz.js` 不会做"字符串相等"这种笨比对，而是先归一化再分级判定：

1. 去掉句末中文标点、行首 `$` 提示符，统一小写、压缩空格、丢弃空行；
2. 去掉单/双引号（`echo "x"` ≡ `echo x`）；
3. 统一 `>` `>>` `|` `&&` `;` 两侧空格；
4. 排序单横杠短参数：`ls -al` ≡ `ls -la`；
5. 多行答案按行排序后比较，两条命令先后顺序不影响判等；
6. 与 `answer` / `accept` 全部比对，命中即**完全正确**；
7. 否则看关键词：全命中 → "思路对、写法不同"；部分命中 → 指出缺哪个；
8. 都不像 → 用编辑距离相似度（≥72%）提示"很接近，检查拼写"。

所以 `LS -LA`、`ls -a -l`、`chmod u+x hi.sh`、`chmod 755 hi.sh` 都会被判对。

---

## 六、内置沙盒终端（方案 D）

为什么要有它：Linux 最难的从来不是"看懂"，而是"敢不敢敲"。真机上 `rm -rf` 有代价，
而这里的一切都在浏览器内存里 —— 关掉面板或点 ⟳ 就复原。

### 6.1 怎么用

- 左下角 ⌨️ 或快捷键 `Ctrl + \``，也可以点星图左下角的「终端」按钮；
- 每张例题卡片都有「▶ 沙盒运行」：按该题指定的工作区加载文件系统，并执行参考答案；
- 多行答案（Day7 的脚本片段）会自动写入 `~/sandbox-example.sh`，再交给 `bash` 执行；
- 纯按键题（`Ctrl + C`、`:q!`）会明确提示"这是按键 / 片段题，沙盒没有对应程序"；
- Windows 侧命令（`wsl --install`）会提示"这条要在 PowerShell 里执行"。

### 6.2 五套工作区

| 场景 | 中文名 | 初始内容 |
| --- | --- | --- |
| `home` | 默认工作区 | notes.txt、logs/app.log、practice/、scripts/hi.sh |
| `files` | 文件与目录 | practice/、practice.bak/、temp/*.tmp、olddir/、notes.txt、app.log、app.log.gz |
| `text` | 文本处理 | access.log、numbers.txt、duplicate.txt、a.txt/b.txt、hello.txt、win.txt(CRLF) |
| `perm` | 权限与用户 | secret.key(600)、run.sh(755)、shared.txt(alice 所属)、private/、team/ |
| `script` | Shell 脚本 | hi.sh、backup.sh、deploy.sh、start.sh、loop.sh、users.txt |

另有只读的系统盘：`/etc/passwd`、`/etc/nginx/nginx.conf`、`/var/log/syslog`、
`/var/log/nginx/access.log`、`/usr/bin`（命令桩）、`/tmp`(777)、`/srv/share`。

### 6.3 Shell 层支持到什么程度

- **分词与引号**：单引号、双引号、`\` 转义、`$VAR`、`${VAR}`、`$(命令)`、反引号；
- **展开**：通配符 `* ? [abc]`、大括号 `{1..3}` / `{,.bak}`，引号内不展开；
- **组合**：管道 `|`、重定向 `>` `>>` `2>` `&>` `2>&1` `<`、串联 `;` `&&` `||`、后台 `&`；
- **状态**：`cd`/`pwd`、`alias`、`export`/`unset`、`history`、`!!`、`$?`、`umask`、`sudo`（临时提权）；
- **脚本**：`bash 脚本` / `bash -x`（追踪）/ `bash -n`（语法检查）/ `bash -c`，支持
  `for`、`while read`、`if [ … ]`、`case`、单行函数定义、`$1/$#/$@`、`set -e`。

---

### 6.4 命令清单（91 个，终端里输入 `help` 查看）

| 类别 | 命令 |
| --- | --- |
| 文件 | `pwd cd ls tree mkdir rmdir touch rm cp mv ln cat head tail stat file du df find which type` |
| 文本 | `echo printf wc tee sort uniq cut tr grep sed awk diff` |
| 权限 / 用户 | `chmod chown umask whoami id groups su sudo` |
| 进程 / 系统 | `ps pgrep pkill kill jobs free uptime date uname hostname nproc lscpu env printenv export unset alias unalias history clear help man sleep set exit` |
| 归档与批处理 | `tar gzip gunzip zcat zip unzip xargs nohup` |
| 服务 / 网络（模拟输出） | `curl wget ssh scp rsync tmux systemctl journalctl lsof ss docker crontab apt vim nano` |
| 脚本 | `bash sh source` |

### 6.5 诚实的边界

- **不执行真实程序**：没有 fork/exec，命令都是 JS 实现；遇到没实现的选项会明确说"沙盒未实现"；
- **不联网**：`curl` / `wget` 返回示例响应，`ssh` / `scp` 只提示，`apt install` 只提示；
- **不模拟全屏交互**：`vim` / `nano` / `top` / `less` 只给操作说明；
- **权限是"会拦但不完整"**：写 `/etc` 会被拒、改别人的文件会被拒，但没有完整 ACL / SELinux / 用户切换；
- **压缩是结构模型**：`tar` / `zip` / `gzip` 记录条目与内容，不做真实压缩（只为演示打包流程）。

### 6.6 想加一个命令？

在 `js/sandbox.js` 里写一个函数并注册即可，终端、补全、`help`、`man` 会自动带上它：

```js
def('hello', function (args, ctx) {
  return { out: 'hi ' + (args[0] || ctx.engine.env.USER) + '\n', err: '', code: 0 };
}, 'hello [名字]', '打个招呼（示例命令）');
```

---

## 七、AI 助手：双模式

### A1 本地知识库（默认，零配置、完全离线）

`localAnswer()` 的判定顺序：

1. **常见问题直答**：密码不回显、没回收站、`Permission denied`、`command not found`、
   怎么进 WSL、学习顺序、命令卡住等；
2. **意图识别**：问"全称"→ 返回 `full`；问"例子/练习题"→ 返回例题与步骤；问"怎么用"→ 返回 `tips`；
3. **节点匹配**：按命令名整词匹配（`chmod` 不会误命中 `cd`），匹配不到再走全文检索；
4. **口语关键词**：如"删除/权限/磁盘满了/日志"映射到对应知识点；
5. **兜底**：说明超出范围并引导去速查表或配置在线模型。

回答里附带的命令标签可直接点击跳转到对应知识点。

### A2 在线大模型（自备 Key）

点助手右上角 ⚙ 填写：

- **API Key**：形如 `sk-...`，只写入你本机浏览器的 `localStorage`；
- **接口地址**：任意 OpenAI 兼容的 `chat/completions` 地址，默认 `https://api.deepseek.com/v1/chat/completions`；
- **模型名**：默认 `deepseek-chat`。

要点：

- 请求由**浏览器直接发往接口**，本项目没有后端，Key 不会上传到任何第三方服务器；
- 系统提示词已约束为"中文 Linux 助教"，并会带上当前正在看的知识点作为上下文；
- 401 / 404 / 超时（30s）等情况会给出明确原因，并**自动降级**回本地知识库继续回答；
- 若该接口服务端没有放开 CORS（浏览器跨域限制），请求同样会失败并降级 ——
  这是纯前端方案的天花板，需要换成允许浏览器直连的服务，或自行加一层极简代理；
- 点"清除 Key"即可立刻回到 A1 模式。

> ⚠️ 共享电脑上请勿保存 Key；`localStorage` 是明文存储，仅适合个人学习环境。

---

## 八、星图布局与降级策略

- **首选**：CDN 加载 D3 v7，`forceSimulation` + `forceLink` + `forceManyBody` +
  `forceCollide` + `forceRadial` 生成"核心居中、分支同心辐射"的星系结构；
- **降级**：若 D3 没加载成功（离线 / CDN 不可达 / 被墙），`galaxy.js` 会检测
  `d3.forceSimulation` 是否存在，自动切换到**内置确定性辐射布局**
  （核心居中 → 一级分支均分圆周 → 子节点朝父节点外侧扇形展开）。
  此时星图、展开/收起、拖拽、缩放、搜索高亮**全部照常可用**，只是不再有弹性动画；
- 星图右下角的徽章会显示当前用的是 **"D3 力导向布局"** 还是 **"内置辐射布局"**，
  鼠标悬停可看到说明；
- 绘制层是原生 SVG（每次节点集合变化重建、tick 只更新坐标），不依赖 D3 的选择器/缩放 API，
  因此两种模式的行为完全一致。

---

## 九、数据与隐私

| 存储键 | 内容 |
| --- | --- |
| `lx_progress_v1` | `learned`（已学知识点）、`quiz`（每题对错次数）、`lastNode`、`expanded` |
| `lx_settings_v1` | `theme`、`apiKey`、`apiUrl`、`model` |

- 全部存在浏览器本地，不上传、不统计、无后端；
- 侧边栏底部"重置进度"可一键清空学习记录（会二次确认）；
- 首次访问会自动打开"🐧 Linux 入门"卡片说明玩法，之后打开则恢复上次看的知识点。

---

## 十、已实现范围与后续可迭代

**已完成**：星图、详情、判分、进度、搜索、关联推荐、双模式 AI、主题、响应式、D3 降级，
以及**方案 D 的内置沙盒终端**（虚拟文件系统 + 91 个命令 + 迷你 bash + 例题一键运行）。

**验证情况**（本地执行，非口头承诺）：

| 验证项 | 方式 | 结果 |
| --- | --- | --- |
| JS 语法 | `node --check` 逐个文件 | 16/16 通过 |
| 内容完整性 | 脚本审计：重复 id / 空答案 / 失效关联 / 空字段 | 0 问题（130 节点 / 175 例题 / 11 主题） |
| 沙盒引擎 | node 单测：文件 / 文本 / 权限 / 重定向 / 脚本 / 模拟命令（111 项）+ 修正 `ls` 管道语义后的 65 项回归 | 全部通过 |
| 浏览器端到端 | headless Chrome 加载真实脚本：点例题按钮、判分、搜索、终端输入、Tab 补全、多行脚本 | **40 / 40 通过** |

**后续可迭代**：

1. **判分升级**：让例题判分从"比对字符串"变成"在沙盒里执行并比对输出"
   （引擎已就绪：`LX.Sandbox.create(scenario).run(cmd)` 直接可用）；
2. **题目与沙盒联动**：给每道题配 `setup`（执行前的准备命令）与 `expect`（期望输出片段），
   做到"解释器式"批改；
3. **更多主题文件**：`ext-*.js` 的拆分方式已经留好，新增主题只需一个文件 + 一行 `<script>`；
4. **真实压缩 / 更完整的正则**：目前 `tar/zip/gzip` 是结构模型，`sed/awk` 是教学子集；
5. **离线化 D3**：把 `d3.min.js` 一并放进 `js/vendor/`，彻底摆脱 CDN 依赖。 ✅ **已完成**
   —— 已内置到 `js/lib/d3.min.js`（v7.9.0，279 KB），`index.html` 优先加载本地文件，缺失时才回落 CDN。

---

## 十一、发布与分享（GitHub Pages）

本站是**纯静态**站点（无构建、无后端、无密钥），所以最适合用 GitHub Pages 免费托管：
推上去就得到一个 `https://<用户名>.github.io/<仓库名>/` 的公网地址，发给谁都能直接打开。

### 三个文件就是"发布套件"

| 文件 | 作用 |
| --- | --- |
| `PUBLISH.md` | **发布契约**：写清"这是一个静态站 → 发到 GitHub → 开 Pages → 验证 → 回写地址"。把项目连同它交给 AI 助手，说一句「发布」即可 |
| `publish.config.json` | **机器配置**：仓库名、可见性、分支、要检查的 URL 列表 |
| `deploy.ps1` | **一键执行器**：建仓 → 提交 → 推送 → 开 Pages → 轮询验证 → 打印分享地址 |

### 三种发布方式

**① 交给 AI 助手（最省事）**
前提：装好 GitHub CLI 并登录一次（`winget install --id GitHub.cli -e` → `gh auth login`）。
之后每次改完只要说「**发布**」，助手会执行 建仓/推送/开 Pages/验证 并回你地址。

**② 自己双击脚本**
```powershell
cd linux-learn
.\deploy.ps1                 # 已 gh 登录 → 全自动
.\deploy.ps1 -Owner 你的用户名  # 未登录时手动指定账号
.\deploy.ps1 -DryRun         # 只演练：读配置、查密钥、本地提交，不推送
```

**③ 纯手动**（不装任何工具）
1. 网页新建仓库 `linux-learn`（public，**不要**勾选 README）；
2. 本目录执行 `git init -b main; git add -A; git commit -m "init"; git remote add origin https://github.com/<用户名>/linux-learn.git; git push -u origin main`；
3. 仓库 Settings → Pages → Source 选 `main` / `/ (root)` → Save。

### 常见坑

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| Pages 里选不到分支 | 还没成功 push | 先 `git push -u origin main` |
| 打开是 404 | 首次构建中（30–90 秒） | 稍等；确认 Source 是 `main` / `(root)` |
| 页面全白 | `index.html` 不在仓库根目录 | 仓库根 = 站点根 |
| 星图变成同心圆 | `js/lib/d3.min.js` 未提交 | `git add js/lib/d3.min.js` 后重新发布 |
| 想隐藏源码 | 免费账号只有 public 仓库能开 Pages | 改私有仓库 + Cloudflare Pages（免费支持私有仓）|

> 公开仓库意味着源码对所有人可见。本站**没有**任何硬编码密钥；
> AI 助手填写的 API Key 只存在**访问者自己浏览器**的 `localStorage` 里，不会上传。

