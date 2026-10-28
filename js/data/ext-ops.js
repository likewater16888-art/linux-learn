/* =============================================================================
 * js/data/ext-ops.js
 * -----------------------------------------------------------------------------
 * 内容扩展：Day 5（三剑客进阶）+ Day 6（传输与备份）+ Day 7（脚本进阶）
 *
 * 这三天的共同点：命令要"组合起来用"才发挥威力。
 * 所以补的都是组合型技能：正则、xargs、curl、rsync、cron、脚本调试。
 * ========================================================================== */
(function (global) {
  'use strict';

  var Data = global.LX && global.LX.Data;
  if (!Data) return;

  /* ------------------------------ Day 5 补充 ------------------------------ */
  Data.addChildren('day5', [
    {
      id: 'regex_basic',
      name: '正则表达式基础',
      full: 'regular expression（正则：描述文本模式的语法）',
      plain: '正则是"用符号描述一类文字"的语言：^abc 表示开头是 abc，[0-9]+ 表示一串数字。grep / sed / awk 都吃这一套，学会一次到处能用。',
      tips: [
        '^ 行首、$ 行尾、. 任意一个字符、* 前一项重复 0 次以上',
        '[abc] 任一字符、[^abc] 排除、[0-9] 数字区间',
        '\\+ 一次以上、\\? 零或一次（egrep / grep -E 里不用转义）',
        '\\< 词首、\\> 词尾；\\b 单词边界',
        '| 表示"或"，在 grep 里要加 -E（或写 \\|）',
        '* 在正则里是"重复 0 次"，而在 Shell 通配符里是"任意字符" —— 两套语法别搞混',
        '测试正则：echo 文本 | grep -E "模式"；复杂正则可先用在线工具验证'
      ],
      rel: ['grep', 'sed', 'awk', 'term_glob'],
      examples: [{
        q: '在 access.log 中找出所有以 192.168 开头的行',
        steps: ['行首用 ^ 表示', '模式写成 ^192\\.168（点要转义，否则匹配任意字符）', '用 grep -E 或 grep 都能跑'],
        answer: "grep -E '^192\\.168' access.log",
        accept: ["grep '^192.168' access.log", "grep '^192\\.168' access.log"],
        keywords: ['grep', '^192', 'access.log'],
        note: '不加 -E 时反斜杠写法更保险；这里点是"任意字符"，所以 ^192.168 也能匹配，但语义不严谨。',
        sandbox: 'text'
      }, {
        q: '找出所有只由数字组成的行（整行都是数字）',
        steps: ['整行：^ 开头 + $ 结尾', '数字：[0-9]+', '组合成 ^[0-9]+$'],
        answer: "grep -E '^[0-9]+$' numbers.txt",
        accept: ["grep -E '^[[:digit:]]+$' numbers.txt", "grep '^[0-9][0-9]*$' numbers.txt"],
        keywords: ['grep', '[0-9]', 'numbers.txt'],
        note: '^[0-9]+$ 与 [0-9] 的区别：前者要求整行都是数字，后者只要行里出现数字就算匹配。',
        sandbox: 'text'
      }]
    },
    {
      id: 'xargs_cmd',
      name: 'xargs（把结果变成参数）',
      full: 'xargs（标准输入 → 命令参数）',
      plain: '管道只能把文字送进下一个命令的"嘴巴"（标准输入），但有些命令不吃这个，只认"手里拿的参数"。xargs 就是那个把文字转成参数的搬运工。',
      tips: [
        'find . -name "*.log" | xargs rm：把找到的路径当参数交给 rm',
        '-n 1 每次只传一个参数（配合 grep 单文件更好看）',
        '-I {} 用占位符，方便把参数放到命令中间：xargs -I {} mv {} /tmp',
        '-0 配合 find -print0，处理文件名带空格的情况（强烈建议）',
        'rm 太危险时先加 -p 或 echo 空跑一遍：... | xargs echo',
        'xargs 与管道的区别：| 传的是"数据流"，xargs 传的是"命令行参数"'
      ],
      rel: ['find', 'pipe', 'rm'],
      examples: [{
        q: '删除当前目录下所有 .log 文件（用 find 配合 xargs）',
        steps: ['find . -name "*.log" 找出所有日志文件', '用 | xargs rm 把路径作为参数交给 rm', '危险操作前可以先 ... | xargs echo 看一眼'],
        answer: 'find . -name "*.log" | xargs rm',
        accept: ["find . -name '*.log' -delete", 'find . -name "*.log" | xargs -n 1 rm'],
        keywords: ['find', 'xargs', 'rm'],
        note: '文件名带空格时这条命令会出错，安全写法：find . -name "*.log" -print0 | xargs -0 rm。',
        sandbox: 'text'
      }, {
        q: '找出所有 .txt 文件，并把它们全部移动到 docs 目录',
        steps: ['find 找出文件', 'xargs -I {} 用占位符代表每个路径', '把 {} 放到 mv 的源位置'],
        answer: 'find . -name "*.txt" | xargs -I {} mv {} docs/',
        accept: ['find . -name "*.txt" -exec mv {} docs/ \\;'],
        keywords: ['find', 'xargs', 'mv', 'docs'],
        note: '-exec ... \\; 是 find 自带的执行方式，功效类似 xargs，但每个文件启动一次进程、更慢。',
        sandbox: 'text'
      }]
    },
    {
      id: 'tr_cmd',
      name: 'tr（字符级替换）',
      full: 'translate（逐字符替换 / 删除）',
      plain: 'sed 按模式替换"字符串"，tr 则是逐字符做映射：把所有小写变大写、把逗号换成换行、把 Windows 的 \\r 删掉。',
      tips: [
        'tr 只能读标准输入，不接文件名（必须配合 < 或 |）',
        '小写转大写：tr a-z A-Z；大写转小写：tr A-Z a-z',
        '-d 删除字符：tr -d "\\r" 去掉 Windows 换行符（超实用）',
        '-s 压缩连续重复字符：tr -s " " 把多个空格压成一个',
        '把冒号换成换行：tr ":" "\\n"',
        '处理 CRLF 文件：tr -d "\\r" < win.txt > unix.txt'
      ],
      rel: ['sed', 'cut', 'pipe'],
      examples: [{
        q: '把 hello.txt 的内容全部转成大写输出',
        steps: ['tr 只能从标准输入读，用 < 重定向文件', '字符区间 a-z 映射到 A-Z'],
        answer: 'tr a-z A-Z < hello.txt',
        accept: ["tr 'a-z' 'A-Z' < hello.txt", 'cat hello.txt | tr a-z A-Z'],
        keywords: ['tr', 'a-z', 'A-Z', 'hello.txt'],
        note: '想在文件里直接改，用 sed 或重定向：tr a-z A-Z < hello.txt > upper.txt。',
        sandbox: 'text'
      }, {
        q: '把 Windows 格式的文件 win.txt 转成 Linux 换行格式，另存为 unix.txt',
        steps: ['Windows 换行是 \\r\\n，Linux 只用 \\n', '用 tr -d "\\r" 删掉所有回车符', '输出重定向到新文件'],
        answer: 'tr -d "\\r" < win.txt > unix.txt',
        accept: ["tr -d '\\r' < win.txt > unix.txt", 'sed "s/\\r$//" win.txt > unix.txt'],
        keywords: ['tr', '-d', 'win.txt', 'unix.txt'],
        note: '在 WSL 里编辑 Windows 上的脚本后报 "$\\r: command not found"，就是这个问题。',
        sandbox: 'text'
      }]
    }
  ]);
  /* ------------------------------ Day 6 补充 ------------------------------ */
  Data.addChildren('day6', [
    {
      id: 'gzip_unzip',
      name: 'gzip / zip / unzip',
      full: 'gzip（单文件压缩）· zip/unzip（跨平台压缩包）',
      plain: 'tar 负责"打包"（把很多文件装进一个箱子），gzip 负责"压缩"（把箱子抽真空）。zip 则把两件事一次做完，且 Windows 能直接双击打开。',
      tips: [
        'gzip 文件：原地压缩成 文件.gz（原文件会消失，可用 -k 保留）',
        'gunzip 文件.gz 或 gzip -d：解压',
        'zcat 文件.gz：不解压直接看内容（看日志超方便）',
        'zip -r 包.zip 目录：递归压缩，Windows 也能打开',
        'unzip 包.zip：解压；unzip -l 包.zip 先看内容清单',
        'tar 管打包，gzip 管压缩：tar -czf 就是 tar + gzip 的组合（-z）',
        '压缩比：文本类（日志、源码）很高，图片视频几乎压不动'
      ],
      rel: ['tar', 'find', 'rsync_backup'],
      examples: [{
        q: '把整个 practice 目录压缩成一个 zip 包，Windows 上也能解压',
        steps: ['zip 命令加 -r 才能递归目录', '第一个参数是输出的压缩包名', '第二个参数是要压缩的目录'],
        answer: 'zip -r practice.zip practice',
        keywords: ['zip', '-r', 'practice.zip', 'practice'],
        note: '装 zip：sudo apt install zip unzip；tar.gz 是 Linux 原生格式，zip 更适合发给别人。',
        sandbox: 'files'
      }, {
        q: '不解压直接查看 app.log.gz 的最后 3 行',
        steps: ['gzip 压缩的文件要用 zcat 读取', 'zcat 会把解压内容输出到标准输出，可以继续接管道', '用 tail -3 取最后三行'],
        answer: 'zcat app.log.gz | tail -3',
        accept: ['gunzip -c app.log.gz | tail -3', 'gzip -dc app.log.gz | tail -3'],
        keywords: ['zcat', 'tail', 'app.log.gz'],
        note: '直接 tail app.log.gz 会输出乱码 —— 压缩文件必须先解压才能按行读取。',
        sandbox: 'files'
      }]
    },
    {
      id: 'ssh_scp',
      name: 'ssh / scp（远程登录与传文件）',
      full: 'secure shell / secure copy（加密远程登录与复制）',
      plain: 'SSH 是"加密的电话线"：有了它你才能在 Windows 里安全地操作一台远程 Linux 服务器。scp 则是沿这条线搬文件。',
      tips: [
        '登录：ssh 用户名@主机IP（默认 22 端口，-p 指定其他端口）',
        '首次连接会问是否信任指纹，输入 yes；密钥写在 ~/.ssh/known_hosts',
        '免密登录：ssh-keygen -t ed25519 生成密钥，ssh-copy-id 用户名@主机 上传公钥',
        'scp 本地文件 用户名@主机:/目标路径：上传；反过来就是下载',
        'scp -r 目录 用户名@主机:/tmp：传整个目录',
        'SSH 断开后远程进程会终止 —— 长任务请配合 tmux/screen 或 nohup',
        'WSL 里的 ~/.ssh 与 Windows 的 C:\\Users\\你\\.ssh 是两套，注意别搞混'
      ],
      rel: ['network', 'rsync_backup', 'tmux'],
      examples: [{
        q: '用 ssh 登录到 192.168.1.10 这台服务器的 root 账号',
        steps: ['格式：ssh 用户名@主机地址', '回车后输入密码（输入时不显示）'],
        answer: 'ssh root@192.168.1.10',
        accept: ['ssh -p 22 root@192.168.1.10'],
        keywords: ['ssh', 'root@192.168.1.10'],
        note: '生产环境不建议直接用 root 登录，应使用普通用户 + sudo + 密钥认证。',
        sandbox: 'home'
      }, {
        q: '把本地 app.conf 上传到 192.168.1.10 的 /etc/myapp/ 目录',
        steps: ['scp 源 目标', '远程路径写成 用户名@主机:路径'],
        answer: 'scp app.conf root@192.168.1.10:/etc/myapp/',
        keywords: ['scp', 'app.conf', '/etc/myapp/'],
        note: '下载就是把两个位置调换：scp root@192.168.1.10:/etc/myapp/app.conf ./。',
        sandbox: 'home'
      }]
    },
    {
      id: 'curl_wget',
      name: 'curl / wget（下载与调试接口）',
      full: 'client URL / web getter（HTTP 客户端）',
      plain: 'wget 是"下载器"（能断点续传），curl 是"万能 HTTP 工具"（还能测接口、看响应头）。调 API 用 curl，下大文件用 wget。',
      tips: [
        'curl URL：把响应内容打到屏幕；curl -O URL：按原文件名保存',
        'curl -I URL：只看响应头（状态码、Content-Type）',
        'curl -s：静默模式（不显示进度条），脚本里常用',
        'curl -X POST -H "Content-Type: application/json" -d \'{...}\' URL：调接口',
        'wget URL：下载并保存；wget -c URL：断点续传',
        'wget -O 文件名 URL：另存为指定名字',
        '判断是否为网络问题：先 curl -I https://www.baidu.com 看返回码'
      ],
      rel: ['network', 'term_redirect', 'ssh_scp'],
      examples: [{
        q: '只看 https://example.com 的 HTTP 响应头（不下载正文）',
        steps: ['-I 表示只发 HEAD 请求', '输出里有状态码 200 / 301 等，可据此判断服务是否正常'],
        answer: 'curl -I https://example.com',
        accept: ['curl --head https://example.com'],
        keywords: ['curl', '-I', 'https://example.com'],
        note: '返回 000 通常是网络/DNS 不通；返回 404 说明服务在但路径不对。',
        sandbox: 'home'
      }, {
        q: '下载一个文件并支持断点续传',
        steps: ['wget 加 -c 表示 continue（续传）', '后面跟下载地址'],
        answer: 'wget -c https://example.com/big.iso',
        keywords: ['wget', '-c'],
        note: 'WSL 里如果提示未安装：sudo apt install wget curl。',
        sandbox: 'home'
      }]
    },
    {
      id: 'rsync_backup',
      name: 'rsync（增量同步备份）',
      full: 'remote sync（增量同步）',
      plain: 'cp 是"全量复印"，rsync 是"只搬运改动过的部分"。每天备份几百 G 的目录，用 rsync 只要几秒，因为它只传差异。',
      tips: [
        'rsync -av 源目录/ 目标目录/：-a 保留权限时间、-v 显示过程',
        '源目录末尾的斜杠非常关键：src/ 表示"目录里的内容"，src 表示"目录本身"',
        '-n / --dry-run：先演练一遍，看会做什么，不实际执行',
        '--delete：让目标与源完全一致（会删掉目标里多出来的文件，慎用）',
        '远程同步：rsync -avz 本地/ 用户@主机:/backup/（-z 边传边压缩）',
        '--exclude "*.log"：排除不需要同步的文件',
        '定时备份：写进 crontab，每天凌晨跑一次'
      ],
      rel: ['cp', 'cron_task', 'tar', 'ssh_scp'],
      examples: [{
        q: '把 practice 目录的内容完整备份到 backup/ 目录（保留权限和时间）',
        steps: ['-a 归档模式：递归 + 保留权限/时间/软链接', '-v 显示过程', '源目录末尾加斜杠，表示同步"里面的内容"'],
        answer: 'rsync -av practice/ backup/',
        accept: ['rsync -av practice/ backup/', 'rsync -av --delete practice/ backup/'],
        keywords: ['rsync', '-av', 'practice/', 'backup/'],
        note: 'practice 不加斜杠会变成 backup/practice/，加不加斜杠是 rsync 头号坑。',
        sandbox: 'files'
      }, {
        q: '先演练一次备份（不实际写入），确认会复制哪些文件',
        steps: ['加 -n 表示 dry-run 演练', '通常再配 -v 打印细节'],
        answer: 'rsync -avn practice/ backup/',
        accept: ['rsync -av --dry-run practice/ backup/', 'rsync -anv practice/ backup/'],
        keywords: ['rsync', '-n', 'practice/', 'backup/'],
        note: '对任何带 --delete 的同步命令，先跑一遍 dry-run 是保命习惯。',
        sandbox: 'files'
      }]
    }
  ]);
  /* ------------------------------ Day 7 补充 ------------------------------ */
  Data.addChildren('day7', [
    {
      id: 'shell_while',
      name: 'while 循环',
      full: 'while loop（条件为真就一直做）',
      plain: 'for 是"名单里挨个来"，while 是"只要条件成立就一直做"。按行读文件、等某个服务起来、定时轮询，都是 while 的活儿。',
      tips: [
        '语法：while [ 条件 ]; do 命令; done',
        '按行读文件：while read -r line; do echo "$line"; done < 文件',
        'read 前加 IFS= 可保留行首尾空格，-r 防止反斜杠被转义',
        '无限循环：while true; do ...; sleep 1; done，用 Ctrl+C 结束',
        '计数器：i=$((i+1))，注意是双括号，不是 $[ ]',
        '坑：cmd | while read ... 中的 while 在子 shell 里跑，变量改完父 shell 看不到'
      ],
      rel: ['shell_for', 'shell_if', 'shell_args'],
      examples: [{
        q: '逐行读取 users.txt，并给每一行加上前缀 user: 输出',
        steps: ['while read -r line 每次读一行', '循环体里 echo "user: $line"', '最后用 < users.txt 把文件喂给整个 while'],
        answer: 'while read -r line; do echo "user: $line"; done < users.txt',
        keywords: ['while', 'read', 'users.txt'],
        note: '如果写成 cat users.txt | while read ...，循环内修改的变量会随子 shell 一起消失。',
        sandbox: 'script'
      }, {
        q: '写一个每秒打印一次当前时间、直到按 Ctrl+C 才停止的循环',
        steps: ['while true 就是无限循环', '循环体里 date 打印时间', 'sleep 1 让循环慢下来，否则会疯狂刷屏'],
        answer: 'while true; do date; sleep 1; done',
        keywords: ['while', 'true', 'date', 'sleep'],
        note: '想限制次数：while [ $i -lt 5 ]; do ...; i=$((i+1)); done。',
        sandbox: 'script'
      }]
    },
    {
      id: 'shell_case',
      name: 'case 分支',
      full: 'case ... esac（多分支匹配）',
      plain: '当你要按一个值分很多种情况处理时，一长串 if/elif 又丑又容易写错。case 就是"开关式"分发，写启动/停止脚本的标准姿势。',
      tips: [
        '语法：case "$1" in start) ...;; stop) ...;; *) 默认;; esac',
        '每个分支用 ;; 结束，最后一个分支的 ;; 可以省略',
        '分支模式支持通配符：*.txt)、[Yy]es)、start|begin)',
        '*) 是"其他所有情况"，建议永远写一个，用于打印用法',
        '分支里可以写多条命令，用换行或 ; 分隔',
        'bash 还有 ;;& 和 ;& 表示"继续匹配后续分支"，属于进阶用法'
      ],
      rel: ['shell_if', 'shell_args', 'script_hello'],
      examples: [{
        q: '写一段 case 结构：参数为 start 输出 starting，为 stop 输出 stopping，其他情况输出 usage',
        steps: [
          '用 case "$1" in 匹配脚本第一个参数',
          '每个分支以 ;; 结尾',
          '最后用 *) 兜底输出 usage',
          '整体以 esac 结束'
        ],
        answer: 'case "$1" in\n  start) echo starting ;;\n  stop) echo stopping ;;\n  *) echo usage ;;\nesac',
        keywords: ['case', 'start', 'stop', 'esac'],
        note: '把它放进脚本后执行 ./ctl.sh start 就会输出 starting；这就是 systemd 服务脚本的雏形。',
        sandbox: 'script'
      }, {
        q: '在 case 的一个分支里同时匹配 yes 和 y（不区分大小写）',
        steps: ['多个模式用 | 分隔', '想忽略大小写可以写成 [Yy]*)', '分支内容照常写，最后 ;;'],
        answer: 'yes|y|[Yy]) echo confirmed ;;\n*) echo cancelled ;;',
        keywords: ['|', '[Yy]', 'confirmed'],
        note: 'case 的模式是通配符语法（glob），不是正则 —— 所以是 *.txt 而不是 .*\\.txt$。',
        sandbox: 'script'
      }]
    },
    {
      id: 'shell_func',
      name: '函数（function）',
      full: 'shell function（把重复逻辑打包）',
      plain: '脚本越写越长时，把重复的三五行打包成函数，起个名字反复调用。函数是脚本从"一次性命令堆"升级成"工具"的关键一步。',
      tips: [
        '定义：name() { 命令; }，调用只写 name，不加括号',
        '函数内参数同样是 $1 $2 $@，与脚本参数规则一致',
        'local 声明局部变量，避免把全局环境搞乱',
        'return 只能返回 0-255 的退出码；要返回字符串请用 echo，再 $(函数名) 捕获',
        '函数必须先定义后调用，否则 command not found',
        'export -f 可以把函数导出给子进程（bash 特性，了解即可）'
      ],
      rel: ['shell_args', 'shell_var', 'shell_while'],
      examples: [{
        q: '定义函数 greet，接收一个名字并输出 hello 名字，然后调用它传入 world',
        steps: ['greet() { ... } 定义函数', '函数体里用 $1 取第一个参数', '定义完之后另起一行写 greet world 调用'],
        answer: 'greet() { echo "hello $1"; }\ngreet world',
        keywords: ['greet', '$1', 'world'],
        note: '调用时写 greet world，不要写 greet(world) —— 括号是 C 语言的写法。',
        sandbox: 'script'
      }, {
        q: '写一个带返回值捕获的函数：把当前时间格式化后"返回"给调用者',
        steps: ['函数里用 echo 输出结果', '调用时用 now=$(get_time) 捕获输出', '再 echo "$now" 使用'],
        answer: 'get_time() { date +%H:%M; }\nnow=$(get_time)\necho "现在 $now"',
        keywords: ['date', '$(', 'echo'],
        note: 'Shell 没有真正的"返回值"，echo + $() 就是标准做法。',
        sandbox: 'script'
      }]
    }
  ]);
  Data.addChildren('day7', [
    {
      id: 'shell_args',
      name: '脚本参数与退出码',
      full: '$1 $@ $# $? / set -e（参数与健壮性）',
      plain: '脚本要能"接受指令"才像工具：$1 是第一个参数，$# 是参数个数，$? 是上条命令成功没有。再配上 set -e，脚本出错就会立刻停下，而不是带病继续跑。',
      tips: [
        '$0 脚本名、$1~$9 第 1~9 个参数、${10} 第十个（大于 9 要加花括号）',
        '$# 参数个数、$@ 全部参数（每个仍是独立单词）、$* 全部参数拼成一个字符串',
        '$? 上一条命令的退出码：0 成功，非 0 失败',
        'if [ $# -lt 1 ]; then echo "用法: $0 目录"; exit 1; fi',
        'set -e：任一命令失败立即退出；set -u：用了未定义变量就报错；set -o pipefail：管道中任一环失败也算失败',
        'exit 0 表示成功，exit 1 表示失败，便于被别的脚本/CI 判断'
      ],
      rel: ['shell_var', 'shell_if', 'shell_debug', 'shell_run'],
      examples: [{
        q: '在脚本开头判断：如果没传参数，就打印用法并以失败状态退出',
        steps: ['$# 是参数个数', '[ $# -lt 1 ] 表示"少于 1 个"', '打印用法时用 $0 显示脚本名', '最后 exit 1 表示异常退出'],
        answer: 'if [ $# -lt 1 ]; then echo "用法: $0 <目录>"; exit 1; fi',
        keywords: ['$#', '$0', 'exit', '1'],
        note: '把这段放在脚本最前面，能省掉后面一堆莫名其妙的报错。',
        sandbox: 'script'
      }, {
        q: '让脚本在任意一条命令失败时立即停止执行',
        steps: ['set -e 是最常用的开关', '更严格可以写 set -euo pipefail', '调试完可以 set +e 关闭'],
        answer: 'set -e',
        accept: ['set -euo pipefail', 'set -o errexit'],
        keywords: ['set', '-e'],
        note: '默认情况下 bash 会"忽略失败继续跑"，这在自动化脚本里非常危险。',
        sandbox: 'script'
      }]
    },
    {
      id: 'cron_task',
      name: 'crontab（定时任务）',
      full: 'cron table（计划任务）',
      plain: '想让脚本每天凌晨自动备份？把时间规则写进 crontab 就行。它像闹钟：分 时 日 月 周 五个位置，填 * 表示"每个"。',
      tips: [
        'crontab -e 编辑当前用户的计划任务，crontab -l 查看',
        '五个字段：分(0-59) 时(0-23) 日(1-31) 月(1-12) 周(0-7)',
        '*/5 * * * * 每 5 分钟；0 3 * * * 每天 3:00；0 9 * * 1-5 工作日 9 点',
        '脚本一律写绝对路径，cron 的 PATH 很短，环境变量也很少',
        '务必重定向输出：>> /var/log/task.log 2>&1，否则出错你看不到',
        'WSL 默认没有 systemd，需要手动 sudo service cron start',
        '验证是否执行过：grep CRON /var/log/syslog'
      ],
      rel: ['rsync_backup', 'systemctl', 'shell_run'],
      examples: [{
        q: '设置每天凌晨 3:30 执行 /home/student/backup.sh，并把输出追加到 backup.log',
        steps: [
          '分字段写 30，时字段写 3',
          '日、月、周都写 *（每天）',
          '命令写绝对路径，别忘了重定向日志'
        ],
        answer: '30 3 * * * /home/student/backup.sh >> /home/student/backup.log 2>&1',
        keywords: ['30', '3', '*', 'backup.sh'],
        note: '写成 3 30 * * * 就变成"每天 3 点 30 分中的每一分钟"，是经典错误。',
        sandbox: 'script'
      }, {
        q: '查看当前用户已经配置了哪些定时任务',
        steps: ['crontab -l 列出当前用户的计划任务', '没有任务时会提示 no crontab for 用户名'],
        answer: 'crontab -l',
        keywords: ['crontab', '-l'],
        note: '系统级任务放在 /etc/cron.d/ 或 /etc/crontab，格式多一个"执行用户"字段。',
        sandbox: 'script'
      }]
    },
    {
      id: 'shell_debug',
      name: '脚本调试（bash -x）',
      full: 'bash -x / bash -n / set -x（脚本排障）',
      plain: '脚本跑飞了别靠猜：bash -x 会把每条执行的命令连变量值一起打印出来，一眼就能看到哪一步开始不对。',
      tips: [
        'bash -x script.sh：逐条打印执行的命令（前面带 + 号）',
        'bash -n script.sh：只做语法检查，不执行（改完先跑一下）',
        '脚本内部 set -x 打开、set +x 关闭，可只调试某一段',
        'echo 调试：echo "变量=$var"（记得加引号和标签）',
        'shellcheck script.sh 静态检查未加引号、$? 误用等常见坑',
        '最常见 bug 前二：变量没加双引号、cd 失败后继续删文件'
      ],
      rel: ['shell_args', 'shell_func', 'shell_run'],
      examples: [{
        q: '以调试模式运行 backup.sh，看到每一条命令的执行过程',
        steps: ['用 bash 启动脚本，加 -x 选项', '输出里以 + 开头的行就是实际执行的命令'],
        answer: 'bash -x backup.sh',
        accept: ['bash -xv backup.sh', 'sh -x backup.sh'],
        keywords: ['bash', '-x', 'backup.sh'],
        note: '调试信息太多时，可在脚本里把 set -x 只放在可疑的那几行前后。',
        sandbox: 'script'
      }, {
        q: '只检查 deploy.sh 有没有语法错误，但不实际执行',
        steps: ['bash -n 表示 noexec：只解析语法', '脚本会执行权限检查，但不会跑任何命令'],
        answer: 'bash -n deploy.sh',
        keywords: ['bash', '-n', 'deploy.sh'],
        note: '在 crontab 里挂脚本之前，一定要先 bash -n 过一遍。',
        sandbox: 'script'
      }]
    }
  ]);

})(window);
