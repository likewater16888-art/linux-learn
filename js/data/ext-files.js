/* =============================================================================
 * js/data/ext-files.js
 * -----------------------------------------------------------------------------
 * 内容扩展：Day 1（文件与目录）+ Day 2（查看文件内容）
 *
 * 补充的是"原始教程里没写、但一上手就会撞到"的命令：
 *   链接、文件元信息、空目录删除、隐藏文件、
 *   以及文本处理的常用四件套（sort / uniq / cut / tee）+ diff。
 * ========================================================================== */
(function (global) {
  'use strict';

  var Data = global.LX && global.LX.Data;
  if (!Data) return;

  /* ------------------------------ Day 1 补充 ------------------------------ */
  Data.addChildren('day1', [
    {
      id: 'ln_link',
      name: 'ln（软链接 / 硬链接）',
      full: 'link（symbolic link / hard link）',
      plain: '软链接像 Windows 的快捷方式：原文件删了它就失效；硬链接是给同一份数据起了第二个名字，删掉其中一个名字数据还在。',
      tips: [
        '软链接：ln -s 原文件 链接名（漏写 -s 就变成硬链接，这是最常见的错）',
        '软链接可以指向目录、可以跨分区；硬链接两者都不行',
        'ls -l 里软链接显示成 l 开头，并带 "链接名 -> 目标" 箭头',
        '删除软链接用 rm 链接名，不会影响原文件；千万别写成 rm 链接名/（会删到目标里）',
        '用相对路径创建的软链接，是相对"链接所在目录"解析的，不是相对当前目录',
        '硬链接不能跨文件系统，且无法链接目录（防止出现循环目录树）'
      ],
      rel: ['cp', 'ls', 'rm', 'stat_file'],
      examples: [{
        q: '给 notes.txt 创建一个名为 latest 的软链接',
        steps: ['用 ln 命令', '必须加 -s 才是软链接（symbolic）', '顺序是：先原文件，后链接名'],
        answer: 'ln -s notes.txt latest',
        keywords: ['ln', '-s', 'notes.txt', 'latest'],
        note: 'ls -l 会看到 latest -> notes.txt；此时 cat latest 与 cat notes.txt 内容一样。',
        sandbox: 'files'
      }, {
        q: '删除软链接 latest，但保留原文件 notes.txt',
        steps: ['软链接本身就是一个"文件条目"，直接用 rm 删它', '注意不要加斜杠，也不要用 -r'],
        answer: 'rm latest',
        keywords: ['rm', 'latest'],
        note: '删软链接时加斜杠（rm latest/）会删到它指向的目标目录里，是经典事故。',
        sandbox: 'files'
      }]
    },
    {
      id: 'stat_file',
      name: 'stat / file（文件元信息）',
      full: 'stat（状态信息）· file（真实文件类型）',
      plain: 'ls -l 只给你看"外表"，stat 能看到时间戳和 inode 这些"身份证信息"；file 则绕过扩展名，直接读文件头判断它真实是什么。',
      tips: [
        'stat 文件：显示大小、权限、inode、三个时间（访问 atime / 修改 mtime / 元数据变更 ctime）',
        'file 文件：按文件头判断真实类型，改扩展名骗不过它',
        'ls -l 只显示 mtime（内容最后修改时间）',
        'touch 更新的是 mtime；读取文件会更新 atime',
        'ls -l 第一个字符：- 普通文件、d 目录、l 链接、c 字符设备、b 块设备',
        'stat -c "%s %n" 只取大小和名字，方便脚本里用'
      ],
      rel: ['ls', 'ln_link', 'find'],
      examples: [{
        q: '查看 notes.txt 的详细元信息（大小、权限、时间戳）',
        steps: ['stat 后跟文件名', '输出比 ls -l 详细得多，包含 inode 与三种时间'],
        answer: 'stat notes.txt',
        keywords: ['stat', 'notes.txt'],
        note: '排查"文件明明改了却没生效"时，先 stat 看 mtime 对不对。',
        sandbox: 'files'
      }, {
        q: '不靠扩展名，判断 app.log 到底是什么类型的文件',
        steps: ['用 file 命令读文件头', '输出会写成 ASCII text / ELF executable 之类的真实类型'],
        answer: 'file app.log',
        keywords: ['file', 'app.log'],
        note: '有人把可执行文件改成 .txt 想躲检查，file 一眼就识破。',
        sandbox: 'files'
      }]
    },
    {
      id: 'rmdir',
      name: 'rmdir / 安全删除',
      full: 'remove directory（删除空目录）',
      plain: 'rmdir 只肯删"空房间"：里面还有东西就拒绝。这条限制其实是保护机制，逼你确认清楚再动手。',
      tips: [
        'rmdir 目录：只能删空目录，非空会报 Directory not empty',
        '想连内容一起删：rm -r 目录（-r 递归）',
        'rm -rf 不加确认、不进回收站，删错就真没了（WSL 里也没有回收站）',
        '动手前先 ls 目录 看一眼，或先 mv 到 /tmp 观察几天',
        'rm -i 会逐个询问；alias rm=\'rm -i\' 可以养成良好的肌肉记忆',
        '重要数据先备份：tar -czf backup.tar.gz 目录'
      ],
      rel: ['rm', 'mkdir', 'tar'],
      examples: [{
        q: '删除一个已经清空的目录 olddir（用最安全的方式）',
        steps: ['确认里面是空的：ls olddir', '空目录用 rmdir，比 rm -r 更安全，删错了会报错提示'],
        answer: 'rmdir olddir',
        keywords: ['rmdir', 'olddir'],
        note: '如果提示 Directory not empty，说明还有隐藏文件（ls -a 看看）。',
        sandbox: 'files'
      }, {
        q: '删除整个 temp 目录以及里面的所有内容，不逐个询问',
        steps: ['递归删除用 -r', '强制不再询问用 -f', '两个选项合并成 -rf，参数是目录名'],
        answer: 'rm -rf temp',
        accept: ['rm -r -f temp', 'rm -fr temp'],
        keywords: ['rm', '-rf', 'temp'],
        note: '执行前务必 pwd 确认位置：rm -rf 与空格写错（rm -rf / home）后果完全不同。',
        sandbox: 'files'
      }]
    },
    {
      id: 'hidden_file',
      name: '隐藏文件（. 开头）',
      full: 'dotfiles（以点开头的文件）',
      plain: 'Linux 没有"隐藏"属性，规则只有一条：名字以点开头的就不显示。你的家目录里其实塞满了 .bashrc、.profile 这类配置文件。',
      tips: [
        '以 . 开头的文件/目录默认不显示（ls 看不到）',
        'ls -a 显示全部，包含 . 和 .. 这两个特殊目录',
        'ls -A 显示隐藏文件但排除 . 和 ..（更常用）',
        '常见 dotfile：.bashrc（bash 配置）、.profile、.gitignore、.env、.ssh/',
        '. 代表当前目录、.. 代表上一级目录，cd .. 就是靠它',
        '通配符 .* 会匹配到 . 和 ..，所以 rm .* 极其危险，不要这么写'
      ],
      rel: ['ls', 'term_glob', 'term_alias', 'rm'],
      examples: [{
        q: '列出家目录下所有隐藏文件（但不要显示 . 和 ..）',
        steps: ['切换到查看家目录：~ 代表 $HOME', '用 -A 选项：显示隐藏项但排除 . 与 ..'],
        answer: 'ls -A ~',
        keywords: ['ls', '-A', '~'],
        note: 'ls -a 会多出 . 与 .. 两行；脚本里统计文件数量时用 -A 才不会多算。',
        sandbox: 'home'
      }, {
        q: '编辑（查看）你的 bash 配置文件，并让它立即生效',
        steps: ['配置文件在 ~/.bashrc', '改完之后执行 source ~/.bashrc 重新加载', '新开终端也会自动加载'],
        answer: 'source ~/.bashrc',
        keywords: ['source', '.bashrc'],
        note: 'source（或 . 空格）在当前 Shell 里执行脚本，所以变量/别名才会留在当前窗口。',
        sandbox: 'home'
      }]
    }
  ]);

  /* ------------------------------ Day 2 补充 ------------------------------ */
  Data.addChildren('day2', [
    {
      id: 'sort',
      name: 'sort（排序）',
      full: 'sort（按行排序）',
      plain: 'sort 把文件按行排队：默认按字典序（10 会排在 9 前面），加 -n 才按数值；配合 | uniq -c 就是最经典的统计组合。',
      tips: [
        '默认字典序（字符逐个比较），数字排序必须加 -n',
        '-r 倒序、-u 去重、-f 忽略大小写',
        '-k N 指定第 N 列排序；-t 指定分隔符（默认是空白）',
        'sort 只把结果打到屏幕，不改原文件；要写回用 sort file -o file',
        '常用组合：sort file | uniq -c | sort -rn（按出现次数从多到少）',
        '-h 按人类可读大小排序（如 1K < 1M < 1G），配合 du -h 很好用'
      ],
      rel: ['uniq', 'cut', 'pipe', 'wc'],
      examples: [{
        q: '把 numbers.txt 里的数字按从小到大排序（按数值而不是字符）',
        steps: ['按数值排序要加 -n（numeric）', '默认是升序，要降序再加 -r'],
        answer: 'sort -n numbers.txt',
        keywords: ['sort', '-n', 'numbers.txt'],
        note: '不加 -n 时 "10" 会排到 "9" 前面，因为字典序是逐字符比较的。',
        sandbox: 'text'
      }, {
        q: '统计 access.log 中访问次数最多的前 3 个 IP（第一列是 IP）',
        steps: [
          '先取出第一列：cut -d\' \' -f1 access.log',
          '排序让相同 IP 相邻：sort',
          '计数：uniq -c',
          '再按次数从多到少排：sort -rn',
          '取前 3 行：head -3'
        ],
        answer: "cut -d' ' -f1 access.log | sort | uniq -c | sort -rn | head -3",
        keywords: ['cut', 'sort', 'uniq', '-c', 'head'],
        note: '这五段管道是日志分析的第一课，几乎每个运维都背过。',
        sandbox: 'text'
      }]
    },
    {
      id: 'uniq',
      name: 'uniq（相邻去重与计数）',
      full: 'unique（相邻重复行处理）',
      plain: 'uniq 只会合并"挨在一起"的重复行，所以几乎永远先 sort 再 uniq；-c 加计数后，它就成了统计频次的利器。',
      tips: [
        'uniq 只处理相邻重复行，所以前面通常要接 sort',
        '-c 在每行前显示出现次数；-d 只显示重复过的行；-u 只显示没重复过的行',
        '-i 忽略大小写；-f N 跳过前 N 个字段再比较',
        '经典套路：sort 文件 | uniq -c | sort -rn',
        '想统计某列：先 cut/awk 取列，再 sort | uniq -c'
      ],
      rel: ['sort', 'cut', 'pipe'],
      examples: [{
        q: '统计 duplicate.txt 中每行出现了几次，并从多到少排列',
        steps: ['先 sort 让相同行聚在一起', 'uniq -c 统计并显示次数', '再 sort -rn 按次数倒序'],
        answer: 'sort duplicate.txt | uniq -c | sort -rn',
        keywords: ['sort', 'uniq', '-c', '-rn'],
        note: '如果直接 uniq -c duplicate.txt，结果会不准，因为相同行可能不相邻。',
        sandbox: 'text'
      }, {
        q: '只列出 duplicate.txt 中出现过不止一次的行（不含计数）',
        steps: ['-d 表示只显示有重复的行', '仍然需要先 sort'],
        answer: 'sort duplicate.txt | uniq -d',
        keywords: ['sort', 'uniq', '-d'],
        note: '-u 正好相反：只看"只出现一次"的行。',
        sandbox: 'text'
      }]
    },
    {
      id: 'cut',
      name: 'cut（按列截取）',
      full: 'cut（按分隔符切列）',
      plain: 'cut 像切面包：按分隔符把每一行切成若干列，然后只取你要的那一片。默认分隔符是 Tab，所以取空格分隔的列时一定要写 -d。',
      tips: [
        '-d 指定分隔符，-f 指定要第几列：cut -d: -f1 /etc/passwd',
        '多列：-f1,3 或 -f2-4；-c 按字符位置切（-c1-5）',
        '默认分隔符是 Tab，不是空格 —— 忘了写 -d 是最常见错误',
        '多个连续空格用 cut 会切出空字段，这种情况改用 awk 更稳',
        'cut -d: -f1,3 是查 /etc/passwd 用户名和 UID 的标准写法'
      ],
      rel: ['awk', 'sort', 'uniq', 'pipe'],
      examples: [{
        q: '从 /etc/passwd 中取出所有用户名（第一列，冒号分隔）',
        steps: ['/etc/passwd 每行用 : 分隔', '用 -d: 指定分隔符', '用 -f1 取第一列'],
        answer: 'cut -d: -f1 /etc/passwd',
        accept: ["cut -d ':' -f 1 /etc/passwd", "cut -d: -f 1 /etc/passwd"],
        keywords: ['cut', '-d', '-f1', '/etc/passwd'],
        note: '想同时看用户名和家目录：cut -d: -f1,6 /etc/passwd。',
        sandbox: 'files'
      }, {
        q: '取 access.log 第一列（IP）并去重，只显示不重复的 IP',
        steps: ['cut -d\' \' -f1 取第一列', '管道交给 sort 排好', 'uniq 去掉相邻重复'],
        answer: "cut -d' ' -f1 access.log | sort | uniq",
        keywords: ['cut', 'sort', 'uniq'],
        note: 'uniq 必须接在 sort 后面才可靠。',
        sandbox: 'text'
      }]
    },
    {
      id: 'tee',
      name: 'tee（分流保存）',
      full: 'tee（T 型三通：屏幕 + 文件）',
      plain: '重定向 > 是"改地址"，屏幕上看不到东西；tee 是"三通接头"，一边打在屏幕上，一边存进文件，调试时特别好用。',
      tips: [
        'cmd | tee out.txt：既显示在屏幕，也写入文件',
        '-a 追加而不是覆盖：cmd | tee -a log.txt',
        '写需要 root 权限的文件：echo 内容 | sudo tee /etc/xxx（sudo echo > 不行）',
        '与 > 的区别：> 之后屏幕无输出，tee 之后两边都有',
        '配合 tee 能边看边存，排查长日志时很方便'
      ],
      rel: ['term_redirect', 'pipe', 'echo'],
      examples: [{
        q: '把当前目录列表同时显示在屏幕上并写入 out.txt',
        steps: ['ls 的输出先交给管道', '用 tee out.txt 分流：一份到屏幕，一份到文件'],
        answer: 'ls | tee out.txt',
        keywords: ['ls', 'tee', 'out.txt'],
        note: '想追加就 tee -a out.txt。',
        sandbox: 'files'
      }, {
        q: '用 sudo 往 /etc/hosts 追加一行 127.0.0.1 myapp',
        steps: ['sudo echo ... > /etc/hosts 会失败：重定向由当前 Shell 执行，Shell 没有 root 权限', '正确做法：echo 交给 sudo tee 去写'],
        answer: 'echo "127.0.0.1 myapp" | sudo tee -a /etc/hosts',
        keywords: ['echo', 'sudo', 'tee', '-a', '/etc/hosts'],
        note: '这是"sudo 与重定向"的经典坑：> 的权限来自 Shell，不来自 sudo。',
        sandbox: 'home'
      }]
    },
    {
      id: 'diff',
      name: 'diff（比较差异）',
      full: 'difference（比较文件差异 / patch 基础）',
      plain: 'diff 逐行比较两个文件，告诉你哪儿多了、哪儿少了。它输出的格式就是打补丁（patch）用的通用格式，改配置前后对比特别有用。',
      tips: [
        'diff a.txt b.txt：逐行比较',
        '-u 统一格式（带上下文，最常看）；-y 并排显示；-q 只报"是否不同"',
        '行首标记：< 左文件、> 右文件、--- 旧文件、+++ 新文件',
        '-r 递归比较两个目录（会列出哪些文件不同）',
        '-i 忽略大小写、-w 忽略空白差异',
        'diff -u old.conf new.conf > fix.patch，再用 patch -p0 < fix.patch 应用'
      ],
      rel: ['cat', 'grep', 'sort'],
      examples: [{
        q: '用统一格式比较 a.txt 和 b.txt 的差异',
        steps: ['-u 表示 unified diff，带上下文行，最易读', '顺序：旧文件在前，新文件在后'],
        answer: 'diff -u a.txt b.txt',
        keywords: ['diff', '-u', 'a.txt', 'b.txt'],
        note: '只想知道有没有变化、不想看内容，用 diff -q a.txt b.txt。',
        sandbox: 'text'
      }, {
        q: '比较 practice 和 practice.bak 两个目录有哪些文件不一样',
        steps: ['比较目录要加 -r（递归）', '加 -q 只输出"哪些文件不同"，不打印具体内容'],
        answer: 'diff -rq practice practice.bak',
        keywords: ['diff', '-r', '-q'],
        note: '目录对比常用来核对备份是否完整。',
        sandbox: 'files'
      }]
    }
  ]);

})(window);
