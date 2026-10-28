/* =============================================================================
 * js/data/ext-sys.js
 * -----------------------------------------------------------------------------
 * 内容扩展：Day 3（权限与用户）+ Day 4（进程与系统信息）
 *
 * 补齐"权限是怎么算出来的""后台任务怎么管""系统到底忙不忙"这三类高频场景。
 * ========================================================================== */
(function (global) {
  'use strict';

  var Data = global.LX && global.LX.Data;
  if (!Data) return;

  /* ------------------------------ Day 3 补充 ------------------------------ */
  Data.addChildren('day3', [
    {
      id: 'umask',
      name: 'umask（默认权限掩码）',
      full: 'user file-creation mode mask（新建文件的默认权限）',
      plain: '新建文件的权限不是随便给的，而是"最大权限 - umask"。umask 022 的意思是：把组和其他人的写权限（w）从默认值里抹掉。',
      tips: [
        '新建文件默认基线是 666，目录是 777，再"减去" umask',
        'umask 022 → 文件 644（rw-r--r--）、目录 755（rwxr-xr-x），这是最常见配置',
        'umask 077 → 只有自己能读写（600 / 700），处理敏感数据时常用',
        '直接输入 umask 查看当前值；umask 027 临时修改（只对当前会话有效）',
        '永久修改写进 ~/.bashrc 或 ~/.profile',
        '注意：这里的"减"是按位清除，不是算术减法'
      ],
      rel: ['perm_bits', 'chmod', 'term_env'],
      examples: [{
        q: '查看当前 shell 的 umask 值',
        steps: ['umask 不带参数就是查询', '输出通常是 0022 或 022'],
        answer: 'umask',
        keywords: ['umask'],
        note: '看到 0022 时，新建文件权限就是 666 - 022 = 644。',
        sandbox: 'perm'
      }, {
        q: '临时把 umask 设成 077，使新建文件只有自己能访问',
        steps: ['umask 077 直接设置', '之后再 touch 出来的文件就是 -rw-------'],
        answer: 'umask 077',
        accept: ['umask 77'],
        keywords: ['umask', '077'],
        note: '处理密钥、隐私数据时非常好用；退出终端后失效。',
        sandbox: 'perm'
      }]
    },
    {
      id: 'special_bits',
      name: '特殊权限位（SUID/SGID/粘滞位）',
      full: 'SUID / SGID / sticky bit（s s t）',
      plain: '除了读写成执行（rwx），还有三位"特殊开关"：SUID 让程序以文件所有者身份运行（passwd 就是），粘滞位让 /tmp 里别人删不掉你的文件。',
      tips: [
        'SUID（4）：执行时临时获得文件所有者权限，典型例子 /usr/bin/passwd',
        'SGID（2）：文件上按所属组身份运行；目录上让新建文件继承该目录的组',
        '粘滞位（1）：目录里只有文件主人能删自己的文件，/tmp 就是 1777',
        '数字写法四位：chmod 4755 file（SUID）、chmod 1777 /tmp',
        '符号写法：chmod u+s、chmod g+s、chmod +t',
        'SUID 的 root 程序是提权攻击重点，看到陌生 SUID 文件要警惕：find / -perm -4000'
      ],
      rel: ['perm_bits', 'chmod', 'chown', 'find'],
      examples: [{
        q: '给 /tmp 目录加上粘滞位（保持 777 不变）',
        steps: ['粘滞位用 +t 表示', '或者用四位数字 1777', '加完后 ls -ld /tmp 会看到 drwxrwxrwt'],
        answer: 'chmod 1777 /tmp',
        accept: ['chmod +t /tmp', 'chmod o+t /tmp'],
        keywords: ['chmod', '1777', '/tmp'],
        note: '这就是为什么在 /tmp 里你能删自己的文件，却删不了别人的。',
        sandbox: 'perm'
      }, {
        q: '找出系统中所有带 SUID 位的文件（安全排查常用）',
        steps: ['find 从根目录开始找：find /', '-perm -4000 表示"包含 SUID 位"', '2>/dev/null 丢掉没权限目录的报错'],
        answer: 'find / -perm -4000 2>/dev/null',
        accept: ['find / -perm -4000 -type f 2>/dev/null'],
        keywords: ['find', '-perm', '4000'],
        note: '-4000 表示"至少包含这三位"，等价写法是 -perm /4000 或 -perm -u+s。',
        sandbox: 'perm'
      }]
    },
    {
      id: 'user_admin',
      name: '用户与组管理',
      full: 'useradd / usermod / passwd / groupadd（用户与组）',
      plain: 'Linux 是多用户系统：每个用户有 UID，每个组有 GID，用户至少属于一个主组。加人、改密码、加组，是给服务器分配权限的第一步。',
      tips: [
        '新建用户：sudo useradd -m -s /bin/bash alice（-m 建家目录，-s 指定 shell）',
        '更友好的是 adduser alice（Debian/Ubuntu 的交互式封装）',
        '设置/修改密码：sudo passwd alice；锁定账号：sudo passwd -l alice',
        '加入附加组：sudo usermod -aG sudo alice（-a 必须写，否则会覆盖原有组）',
        '查看自己属于哪些组：groups、id',
        '删除用户：sudo userdel -r alice（-r 连家目录一起删，慎用）',
        '用户信息存在 /etc/passwd，密码哈希在 /etc/shadow（普通用户读不到）'
      ],
      rel: ['sudo', 'id', 'chown', 'whoami'],
      examples: [{
        q: '新建用户 alice，同时创建家目录并使用 bash',
        steps: ['需要管理员权限，前面加 sudo', '-m 创建 /home/alice', '-s /bin/bash 指定默认 shell'],
        answer: 'sudo useradd -m -s /bin/bash alice',
        accept: ['sudo useradd -m alice'],
        keywords: ['useradd', '-m', 'alice'],
        note: '建完还要 sudo passwd alice 设密码，否则无法登录。',
        sandbox: 'perm'
      }, {
        q: '把已有用户 alice 加入 sudo 组（保留她原来的组）',
        steps: ['usermod -aG 组名 用户名', '-a 是 append，漏写会把她的其他组全清掉', '改完需要重新登录才生效'],
        answer: 'sudo usermod -aG sudo alice',
        keywords: ['usermod', '-aG', 'sudo', 'alice'],
        note: '-aG 与 -G 的差别是新手事故高发点：只写 -G 会让她只剩 sudo 一个组。',
        sandbox: 'perm'
      }]
    },
    {
      id: 'su_switch',
      name: 'su（切换用户）',
      full: 'substitute user（切换用户身份）',
      plain: 'su 是"换个人坐在这台电脑前"：su alice 变成 alice，su - 变成 root。sudo 则是"以管理员身份执行这一条命令"，更安全、更推荐。',
      tips: [
        'su - alice：切换用户并加载对方环境（- 很重要，不加会继承当前环境变量）',
        'su - 或 su - root：切到 root；root 切普通用户不需要密码',
        'sudo 命令：只提升这一条命令的权限，事后自动回落，审计更清晰',
        'Ubuntu 默认禁用 root 密码登录，一律走 sudo',
        'sudo -i 进入一个 root 的交互式 shell（等价 su -，但要输自己的密码）',
        'visudo 编辑 /etc/sudoers，改错了可能导致所有人都无法 sudo'
      ],
      rel: ['sudo', 'user_admin', 'whoami'],
      examples: [{
        q: '切换到 alice 用户，并同时加载她的环境变量',
        steps: ['su 后面跟用户名', '加短横线 - 表示"登录式切换"，会加载对方的环境配置'],
        answer: 'su - alice',
        keywords: ['su', '-', 'alice'],
        note: '不加 - 时 PATH、HOME 可能还是原用户的，会出现"命令找不到"的怪现象。',
        sandbox: 'perm'
      }, {
        q: '以 root 身份执行一条命令（不切换用户，只执行这一次）',
        steps: ['用 sudo 前缀', '示例命令：更新软件源索引'],
        answer: 'sudo apt update',
        accept: ['sudo -i apt update'],
        keywords: ['sudo', 'apt', 'update'],
        note: 'sudo 会记录谁在什么时间执行了什么命令（/var/log/auth.log），比 su 更可追溯。',
        sandbox: 'perm'
      }]
    }
  ]);
  /* ------------------------------ Day 4 补充 ------------------------------ */
  Data.addChildren('day4', [
    {
      id: 'jobs_bg',
      name: '后台运行与作业控制',
      full: 'jobs / fg / bg / &（job control）',
      plain: '命令后面加个 & 就是"你先到后台干活，我继续敲下一条"。jobs 看有哪些后台活，fg 把某一件拉回前台盯着看。',
      tips: [
        'cmd & 放到后台，终端会打印 [1] 12345（作业号 + 进程号）',
        'jobs -l：列出当前 Shell 的作业和进程号',
        'fg %1 把 1 号作业拉回前台；bg %1 让被挂起的作业在后台继续跑',
        'Ctrl + Z：把当前前台进程"暂停"（挂起），不是杀掉',
        '关掉终端会给所有作业发 SIGHUP，后台任务一起被杀 —— 想长期跑要用 nohup / tmux',
        'jobs 只显示当前 Shell 的作业；跨终端请用 ps 或 pgrep'
      ],
      rel: ['nohup', 'ps', 'kill', 'term_keys'],
      examples: [{
        q: '让 sleep 1000 在后台运行，不占用当前终端',
        steps: ['命令末尾加 & 符号', 'Shell 会立刻返回提示符，并打印作业号'],
        answer: 'sleep 1000 &',
        keywords: ['sleep', '&'],
        note: '前台运行时按 Ctrl + Z 也能挂起，再 bg 让它转到后台继续。',
        sandbox: 'home'
      }, {
        q: '查看当前终端里有哪些后台作业（带进程号）',
        steps: ['jobs 列出作业', '-l 额外显示 PID'],
        answer: 'jobs -l',
        keywords: ['jobs', '-l'],
        note: '输出里的 + 号表示"当前作业"，fg 不带参数时默认恢复它。',
        sandbox: 'home'
      }]
    },
    {
      id: 'nohup',
      name: 'nohup（脱离终端运行）',
      full: 'no hang up（忽略挂起信号）',
      plain: '后台任务最怕关窗口：终端一关，SIGHUP 就把它们全杀了。nohup 让进程"无视挂断信号"，关掉窗口它还能继续跑。',
      tips: [
        'nohup 命令 &：忽略 SIGHUP，输出默认追加到 nohup.out',
        '标准写法：nohup bash start.sh > app.log 2>&1 &（日志自己管，错误也进日志）',
        'disown 可以让已经在跑的后台作业脱离 Shell',
        '长期跑服务更推荐 tmux / screen：能重新连回去看输出',
        'WSL 里关闭所有终端窗口后，进程可能被一并回收 —— 重要任务请用 tmux',
        '想确认还在跑：ps -ef | grep 进程名'
      ],
      rel: ['jobs_bg', 'ps', 'term_redirect', 'tmux'],
      examples: [{
        q: '后台运行 start.sh，把正常输出和报错都写入 app.log，且关闭终端后继续运行',
        steps: [
          'nohup 让进程忽略挂断信号',
          '> app.log 把标准输出写进日志',
          '2>&1 让错误也进同一个文件',
          '最后的 & 让它回到后台'
        ],
        answer: 'nohup bash start.sh > app.log 2>&1 &',
        keywords: ['nohup', 'app.log', '2>&1'],
        note: '顺序很重要：2>&1 必须写在 > app.log 之后才是"都进日志"的效果。',
        sandbox: 'script'
      }, {
        q: '查看刚才那个后台进程是否还在运行',
        steps: ['ps -ef 列出所有进程', '用 grep 过滤脚本名', 'grep -v grep 排除掉 grep 自己那一行'],
        answer: 'ps -ef | grep start.sh | grep -v grep',
        accept: ['ps aux | grep start.sh | grep -v grep'],
        keywords: ['ps', 'grep', 'start.sh'],
        note: '更干净的做法是 pgrep -af start.sh。',
        sandbox: 'script'
      }]
    },
    {
      id: 'pgrep_pkill',
      name: 'pgrep / pkill（按名字找/杀进程）',
      full: 'process grep / process kill（按名称匹配进程）',
      plain: '记不住 PID 也没关系：pgrep 按名字查出进程号，pkill 按名字直接结束。两者是 kill 的"按名字版"。',
      tips: [
        'pgrep 名字：列出匹配的 PID；pgrep -l 名字：连命令名一起显示',
        'pkill 名字：结束所有匹配进程（默认发 TERM 信号，礼貌退出）',
        '-f 匹配完整命令行（脚本被杀不掉时试试）',
        'pkill -9 强制结束（先试 TERM，不行再 KILL）',
        'pkill -u alice：结束某个用户的所有进程（慎用）',
        '动手前先用 pgrep 确认匹配范围，避免误杀同名系统进程'
      ],
      rel: ['ps', 'kill', 'jobs_bg'],
      examples: [{
        q: '找出所有名为 nginx 的进程号',
        steps: ['pgrep 直接接进程名', '想同时看到命令名就加 -l'],
        answer: 'pgrep nginx',
        accept: ['pgrep -l nginx'],
        keywords: ['pgrep', 'nginx'],
        note: 'pgrep 匹配的是"进程名"，名字被截断时用 pgrep -f 匹配完整命令行。',
        sandbox: 'home'
      }, {
        q: '结束所有名为 python3 的进程',
        steps: ['pkill 后跟进程名', '默认发送 SIGTERM（15），允许进程保存现场后退出', '不生效再加 -9'],
        answer: 'pkill python3',
        accept: ['pkill -15 python3', 'killall python3'],
        keywords: ['pkill', 'python3'],
        note: 'pkill -9 相当于"直接断电"，可能丢数据；先用 15 再考虑 9。',
        sandbox: 'home'
      }]
    }
  ]);
  Data.addChildren('day4', [
    {
      id: 'uptime_load',
      name: '负载与 CPU 核心数',
      full: 'load average / uptime / nproc（系统繁忙程度）',
      plain: '平均负载就是"排队的人数"：1 分钟、5 分钟、15 分钟内平均有多少进程在跑或等 CPU。超过核心数就说明系统开始排队了。',
      tips: [
        'uptime：运行时长、登录用户数、1/5/15 分钟平均负载',
        '负载 ≈ 正在运行 + 等待 CPU 的进程数，不是百分比',
        '判断标准：负载 ÷ 核心数 > 1 表示拥塞；0.7 以下算健康',
        'nproc 看核心数；lscpu 看 CPU 型号、缓存、核数详情',
        'top / htop 第一行也显示 load average，还能看谁在吃 CPU',
        '负载高但 CPU 空？多半是磁盘 I/O 卡住了（配合 vmstat 1、iostat）'
      ],
      rel: ['top_htop', 'free', 'ps'],
      examples: [{
        q: '一条命令查看系统运行了多久、当前平均负载',
        steps: ['uptime 一条命令就够', '输出里 load average 后三个数字分别是 1/5/15 分钟'],
        answer: 'uptime',
        keywords: ['uptime'],
        note: 'WSL2 里的负载反映的是虚拟机的状态，和 Windows 任务管理器的数字不完全一致。',
        sandbox: 'home'
      }, {
        q: '查看这台机器有几个 CPU 核心',
        steps: ['nproc 直接输出可用核心数', '想看详细型号用 lscpu'],
        answer: 'nproc',
        accept: ['lscpu', 'grep -c ^processor /proc/cpuinfo'],
        keywords: ['nproc'],
        note: '有了核心数才能判断负载 4.0 是"很忙"还是"闲得很"（4 核就是刚好打满）。',
        sandbox: 'home'
      }]
    },
    {
      id: 'lsof_fd',
      name: 'lsof / ss（端口与文件占用）',
      full: 'list open files / socket statistics（谁占用了端口）',
      plain: '"端口被占用"是开发最常见的报错，lsof 或 ss 能告诉你到底是哪个进程占着它；它们还能查出"删了文件但磁盘没释放"这种诡异问题。',
      tips: [
        'lsof -i :8080：查看 8080 端口被谁占用（最常用）',
        'ss -lntp：列出所有 TCP 监听端口和对应进程（比 netstat 更快）',
        'lsof -p 1234：查看某个进程打开的所有文件',
        'df 显示满了、du 加起来却不够？用 lsof +L1 找"已删除但仍被占用"的文件',
        '看别人的进程通常需要 sudo',
        'Windows 侧查端口是另一套：netstat -ano | findstr :8080'
      ],
      rel: ['network', 'ps', 'df', 'kill'],
      examples: [{
        q: '查看 8080 端口被哪个进程占用',
        steps: ['lsof -i :端口号', '输出里有进程名和 PID', '拿到 PID 后可以用 kill 结束它'],
        answer: 'lsof -i :8080',
        accept: ['sudo lsof -i :8080', 'ss -lntp | grep 8080'],
        keywords: ['lsof', '8080'],
        note: '没装 lsof 时可以用 ss -lntp 代替，或 sudo apt install lsof。',
        sandbox: 'home'
      }, {
        q: '列出所有正在监听 TCP 的端口及对应进程',
        steps: ['ss 的 -l 表示 listening、-n 不解析域名、-t 只看 TCP、-p 显示进程', '组合成 ss -lntp'],
        answer: 'ss -lntp',
        accept: ['ss -tlnp', 'netstat -lntp'],
        keywords: ['ss', '-lntp'],
        note: '只看 22 端口：ss -lntp | grep :22。',
        sandbox: 'home'
      }]
    },
    {
      id: 'date_uname',
      name: 'date / uname（时间与系统信息）',
      full: 'date / uname / hostname（时间格式与内核信息）',
      plain: '脚本里经常要用时间戳命名备份文件；uname 则回答"我到底是什么系统"。这两条是排障和自动化的基础设施。',
      tips: [
        'date：默认输出完整时间；date +%F 只输出 2026-10-28',
        'date +"%Y-%m-%d %H:%M:%S"：自定义格式，写日志常用',
        'date -d "yesterday" +%F：算出昨天的日期；-d "+3 days" 同理',
        'uname -a：内核版本、主机名、架构等全量信息',
        'uname -r 只看内核版本；WSL 里会显示 microsoft-standard-WSL2',
        'hostname 看主机名；hostname -I 看本机 IP；cal 看日历'
      ],
      rel: ['uptime_load', 'top_htop', 'tar'],
      examples: [{
        q: '只输出今天的日期，格式为 YYYY-MM-DD',
        steps: ['date 支持 +格式 自定义输出', '%F 就是 %Y-%m-%d 的简写'],
        answer: 'date +%F',
        keywords: ['date', '%F'],
        note: '备份文件命名常用：tar -czf backup-$(date +%F).tar.gz 目录。',
        sandbox: 'home'
      }, {
        q: '查看当前系统的内核版本号',
        steps: ['uname 的 -r 表示 release（内核版本）', '想看全部信息用 uname -a'],
        answer: 'uname -r',
        accept: ['uname -a', 'cat /proc/version'],
        keywords: ['uname', '-r'],
        note: 'WSL2 的内核由微软编译，所以会看到 microsoft-standard-WSL2 字样。',
        sandbox: 'home'
      }]
    }
  ]);

})(window);
