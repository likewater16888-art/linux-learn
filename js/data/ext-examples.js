/* =============================================================================
 * js/data/ext-examples.js
 * -----------------------------------------------------------------------------
 * 内容扩展：给"只有 1 道例题"的核心知识点补第二道（多半是组合用法 / 真实场景），
 * 并补齐原本 0 例题的 systemctl、docker、tips 三个节点。
 *
 * 用的 API 是 LX.Data.addExamples(nodeId, [...])：
 * 只往节点里追加例题，不动结构，所以刷新页面即可生效。
 * ========================================================================== */
(function (global) {
  'use strict';

  var Data = global.LX && global.LX.Data;
  if (!Data) return;

  /* ---------------------------- Day 1 文件与目录 ---------------------------- */
  Data.addExamples('ls', [{
    q: '用一条命令同时列出当前目录和 /tmp 目录的内容',
    steps: ['ls 可以接收多个参数', '每个参数都会单独列出一段', '记得各个目录之间用空格分开'],
    answer: 'ls . /tmp',
    accept: ['ls /tmp .'],
    keywords: ['ls', '/tmp'],
    note: 'ls 只显示名字，看不到大小；想看详情加 -l，想按大小排序加 -S。',
    sandbox: 'files'
  }]);

  Data.addExamples('cd', [{
    q: '在两个目录之间来回切换：先进入 /tmp，再回到刚才的目录',
    steps: ['cd /tmp 进入 /tmp', 'cd - 表示"回到上一次所在目录"', 'Shell 会顺便打印你跳到了哪里'],
    answer: 'cd /tmp && cd -',
    accept: ['cd /tmp; cd -'],
    keywords: ['cd', '-'],
    note: 'cd - 在"改配置、看日志"两头跑时特别省事；不带参数的 cd 则直接回家目录。',
    sandbox: 'files'
  }]);

  Data.addExamples('mkdir', [{
    q: '一次性创建 a/b/c 三层嵌套目录（父目录不存在也不会报错）',
    steps: ['嵌套目录要加 -p（parents）', '否则必须先建 a，再建 a/b，再建 a/b/c'],
    answer: 'mkdir -p a/b/c',
    keywords: ['mkdir', '-p', 'a/b/c'],
    note: '写部署脚本时 mkdir -p 几乎必用：目录已存在也不会报错。',
    sandbox: 'files'
  }]);

  Data.addExamples('touch', [{
    q: '一次创建 1.txt、2.txt、3.txt 三个空文件',
    steps: ['touch 可以接多个文件名', '文件不存在就创建，存在就只更新时间戳'],
    answer: 'touch 1.txt 2.txt 3.txt',
    keywords: ['touch', '1.txt', '3.txt'],
    note: '批量造测试文件：touch file{1..10}.txt 会生成 file1.txt 到 file10.txt。',
    sandbox: 'files'
  }]);

  Data.addExamples('cp', [{
    q: '把整个 practice 目录（含里面的文件）复制成 practice.bak',
    steps: ['复制目录必须加 -r（recursive）', '参数顺序是：源 目标', '目标不存在时会新建这个目录'],
    answer: 'cp -r practice practice.bak',
    accept: ['cp -r practice/ practice.bak'],
    keywords: ['cp', '-r', 'practice', 'practice.bak'],
    note: '忘了 -r 就会得到 omitting directory 的警告，这是新手高频报错。',
    sandbox: 'files'
  }]);

  Data.addExamples('mv', [{
    q: '把 notes.txt 重命名为 todo.txt',
    steps: ['mv 的第二个参数是"新名字"', '同目录下就是改名，不同目录下就是移动'],
    answer: 'mv notes.txt todo.txt',
    keywords: ['mv', 'notes.txt', 'todo.txt'],
    note: 'mv 默认直接覆盖同名文件、不提示；批量移动前先用 ls 确认目标目录。',
    sandbox: 'files'
  }]);

  Data.addExamples('rm', [{
    q: '删除当前目录所有 .tmp 文件，但每删一个都先问你一句',
    steps: ['通配符 *.tmp 匹配所有临时文件', '-i 表示 interactive，逐个确认', '回答 y 才会删'],
    answer: 'rm -i *.tmp',
    keywords: ['rm', '-i', '*.tmp'],
    note: '把 rm 设成 rm -i 别名能救命：alias rm=\'rm -i\'。',
    sandbox: 'files'
  }]);

  Data.addExamples('tree', [{
    q: '只显示两层深度的目录结构',
    steps: ['tree 默认会一直递归到底', '-L 2 表示最多显示 2 层'],
    answer: 'tree -L 2',
    accept: ['tree -L2'],
    keywords: ['tree', '-L', '2'],
    note: 'tree 默认没装：sudo apt install tree；不确定结构时先看两层，比 ls -R 清楚。',
    sandbox: 'files'
  }]);

  Data.addExamples('path', [{
    q: '进入上一级目录，并确认当前所在的绝对路径',
    steps: ['cd .. 回到上级', 'pwd 打印当前绝对路径', '用 && 把两步串起来'],
    answer: 'cd .. && pwd',
    keywords: ['cd', '..', 'pwd'],
    note: '绝对路径以 / 开头，相对路径依赖当前目录 —— 脚本里一律建议用绝对路径。',
    sandbox: 'files'
  }]);

  /* ---------------------------- Day 2 查看内容 ---------------------------- */
  Data.addExamples('cat', [{
    q: '带行号显示 notes.txt 的内容',
    steps: ['cat 的 -n 表示给所有行编号', '-b 只给非空行编号'],
    answer: 'cat -n notes.txt',
    keywords: ['cat', '-n', 'notes.txt'],
    note: '行号在对照报错信息（如 line 12）时特别有用。',
    sandbox: 'text'
  }]);

  Data.addExamples('less', [{
    q: '用 less 打开 app.log 后，搜索其中的 error 关键字（写出按键）',
    steps: ['打开后按 / 进入搜索', '输入 error 回车，按 n 跳下一个、N 跳上一个', '按 q 退出'],
    answer: '/error',
    keywords: ['/error'],
    note: 'less 比 cat 强的地方：大文件不卡、能搜索、退出后终端不会留一堆乱码。',
    sandbox: 'text'
  }]);

  Data.addExamples('head_tail', [{
    q: '实时跟踪 app.log 的新内容（先显示最后 20 行）',
    steps: ['tail -f 表示 follow，新写入会持续打印', '-n 20 先显示最后 20 行', 'Ctrl + C 退出'],
    answer: 'tail -f -n 20 app.log',
    accept: ['tail -n 20 -f app.log', 'tail -20f app.log'],
    keywords: ['tail', '-f', '-n', 'app.log'],
    note: '日志被切割（logrotate）后 tail -f 会失效，改用 tail -F 会自动重新打开文件。',
    sandbox: 'text'
  }]);

  Data.addExamples('wc', [{
    q: '统计 app.log 有多少行',
    steps: ['-l 表示 lines', '只看数字结果可以用管道配合 cat'],
    answer: 'wc -l app.log',
    keywords: ['wc', '-l', 'app.log'],
    note: '统计一个目录里的文件数用 ls -A | wc -l（-A 排除 . 和 ..）。',
    sandbox: 'text'
  }]);
  /* --------------------------- Day 3 权限与用户 --------------------------- */
  Data.addExamples('chmod', [{
    q: '用符号写法：给 notes.txt 的所有者加执行权限，并让组和其他人只有读权限',
    steps: ['u 所有者、g 组、o 其他人', 'u+x 加执行；go=r 直接设为只读', '多个操作用逗号分隔'],
    answer: 'chmod u+x,go=r notes.txt',
    accept: ['chmod u+x,go=r notes.txt', 'chmod u+x,go-w,go+r notes.txt'],
    keywords: ['chmod', 'u+x', 'go=', 'notes.txt'],
    note: '符号写法的好处是可读性强；数字写法适合一次性设定完整权限。',
    sandbox: 'perm'
  }]);

  Data.addExamples('sudo', [{
    q: '用管理员权限安装 htop（Debian/Ubuntu 系）',
    steps: ['安装软件用 apt install', '前面加 sudo 提权', '安装前通常先 apt update 更新索引'],
    answer: 'sudo apt install htop',
    accept: ['sudo apt-get install htop', 'sudo apt update && sudo apt install htop'],
    keywords: ['sudo', 'apt', 'install', 'htop'],
    note: 'sudo 只对紧跟的那一条命令生效；要切换成 root 环境请用 sudo -i。',
    sandbox: 'home'
  }]);

  Data.addExamples('id', [{
    q: '查看当前用户属于哪些用户组（只要组名）',
    steps: ['id -Gn 只打印组名列表', 'id 会输出 UID、GID 和所有附加组'],
    answer: 'id -Gn',
    accept: ['groups', 'id -nG'],
    keywords: ['id', '-Gn'],
    note: '刚被 usermod -aG 加进新组时，必须重新登录（或 newgrp）才会生效。',
    sandbox: 'home'
  }]);

  /* -------------------------- Day 4 进程与系统信息 -------------------------- */
  Data.addExamples('ps', [{
    q: '查看系统中所有进程的完整信息（包含命令行）',
    steps: ['ps -ef 是 System V 风格，-f 显示完整格式', '想连命令行参数一起看，BSD 风格用 ps aux'],
    answer: 'ps -ef',
    accept: ['ps aux'],
    keywords: ['ps', '-ef'],
    note: '只关心某个进程：ps -ef | grep 关键字 | grep -v grep。',
    sandbox: 'home'
  }]);

  Data.addExamples('kill', [{
    q: '强制结束 PID 为 4321 的进程（进程不肯正常退出时用）',
    steps: ['kill 默认发 TERM（15），进程可能忽略', '-9 发 KILL，系统层面直接终止，无法忽略'],
    answer: 'kill -9 4321',
    accept: ['kill -KILL 4321', 'kill -SIGKILL 4321'],
    keywords: ['kill', '-9', '4321'],
    note: '先试 kill 4321，不行再 -9：KILL 不给进程保存数据的机会。',
    sandbox: 'home'
  }]);

  Data.addExamples('df', [{
    q: '以人类可读的方式查看所有磁盘分区的使用率',
    steps: ['df 显示文件系统使用情况', '-h 用 G/M 这种可读单位'],
    answer: 'df -h',
    keywords: ['df', '-h'],
    note: 'WSL 里会看到一个很大的 /mnt/c，那是你的 Windows C 盘。',
    sandbox: 'home'
  }]);

  Data.addExamples('du', [{
    q: '查看 practice 目录总共占了多少空间（只要一行汇总）',
    steps: ['du -s 只输出汇总', '-h 用可读单位', '两者合并写 -sh'],
    answer: 'du -sh practice',
    keywords: ['du', '-sh', 'practice'],
    note: 'du 是"目录里文件加起来"，df 是"整个分区剩多少"，两者对不上很正常（被删除但被占用的文件）。',
    sandbox: 'files'
  }]);

  /* --------------------------- Day 5 文本三剑客 --------------------------- */
  Data.addExamples('pipe', [{
    q: '用管道统计当前目录一共有多少个条目',
    steps: ['ls -A 列出全部条目（含隐藏，不含 . 和 ..）', '用 | 交给 wc -l 数行数'],
    answer: 'ls -A | wc -l',
    accept: ['ls -1 | wc -l', 'ls -a | wc -l'],
    keywords: ['ls', '|', 'wc', '-l'],
    note: '管道里每个命令都只干一件事，串起来就能完成大任务。',
    sandbox: 'files'
  }]);

  Data.addExamples('grep', [{
    q: '统计 app.log 中 404 出现了多少行（只要数字）',
    steps: ['grep -c 直接输出匹配行数', '想不区分大小写再加 -i'],
    answer: 'grep -c 404 app.log',
    accept: ['grep 404 app.log | wc -l'],
    keywords: ['grep', '-c', '404'],
    note: '-c 统计的是"行数"不是"次数"：一行里出现两次 404 也只算 1。',
    sandbox: 'text'
  }]);

  Data.addExamples('sed', [{
    q: '把 app.log 里所有的 404 替换成 500，并直接写回原文件',
    steps: ['sed 的替换语法 s/旧/新/g', '-i 表示原地修改文件', '先不加 -i 跑一遍，确认输出正确再改'],
    answer: "sed -i 's/404/500/g' app.log",
    keywords: ['sed', '-i', 's/404/500/g', 'app.log'],
    note: 'macOS 上的 sed 需要写 sed -i \'\' ...；生产环境改配置前务必备份。',
    sandbox: 'text'
  }]);

  /* --------------------------- Day 6 查找与备份 --------------------------- */
  Data.addExamples('find', [{
    q: '找出 /var/log 下 7 天以前修改过的 .log 文件',
    steps: ['find /var/log 指定搜索起点', '-name "*.log" 按名字过滤', '-mtime +7 表示修改时间在 7 天以前', '2>/dev/null 屏蔽权限报错'],
    answer: 'find /var/log -name "*.log" -mtime +7 2>/dev/null',
    accept: ['find /var/log -name "*.log" -mtime +7'],
    keywords: ['find', '-name', '-mtime', '+7'],
    note: '-mtime +7 是"超过 7 天"，配合 -delete 就是自动清理旧日志的核心命令。',
    sandbox: 'files'
  }]);
  /* ------------------------ 速查表 tips + 进阶工具 ------------------------ */
  Data.addExamples('tips', [{
    q: '刚敲的命令忘了加 sudo 被拒绝了，怎样用管理员权限重跑上一条？',
    steps: ['!! 代表上一条命令', '在它前面加 sudo 就是"给上一条命令提权"', '回车后能看到完整命令再执行'],
    answer: 'sudo !!',
    accept: ['sudo !!'],
    keywords: ['sudo', '!!'],
    note: 'Shell 会把 !! 展开成真正的上一条命令，所以你看到的是完整的 sudo xxx。',
    sandbox: 'home'
  }]);

  Data.addExamples('systemctl', [{
    q: '查看 nginx 服务当前的运行状态',
    steps: ['systemctl status 服务名', '输出里 Active: active (running) 表示正在运行', '按 q 退出分页'],
    answer: 'systemctl status nginx',
    accept: ['sudo systemctl status nginx'],
    keywords: ['systemctl', 'status', 'nginx'],
    note: 'WSL 默认没有 systemd，这条命令要在真正的服务器或开了 systemd 的发行版上用。',
    sandbox: 'home'
  }, {
    q: '让 nginx 开机自动启动，并立刻启动它',
    steps: ['enable 设置开机自启', 'start 立即启动', '两条命令可以用 && 串起来'],
    answer: 'sudo systemctl enable --now nginx',
    accept: ['sudo systemctl enable nginx && sudo systemctl start nginx'],
    keywords: ['systemctl', 'enable', 'nginx'],
    note: '改完配置后要 systemctl restart nginx 才生效；只 reload 不会中断连接。',
    sandbox: 'home'
  }]);

  Data.addExamples('docker', [{
    q: '查看当前正在运行的容器',
    steps: ['docker ps 只列运行中的容器', '加 -a 连已停止的一起列'],
    answer: 'docker ps',
    accept: ['docker ps -a'],
    keywords: ['docker', 'ps'],
    note: 'WSL2 里可以装 Docker Desktop 并勾选 WSL 集成，也可以直接 sudo apt install docker.io。',
    sandbox: 'home'
  }, {
    q: '后台启动一个 nginx 容器，把宿主机 8080 映射到容器 80 端口',
    steps: ['-d 后台运行', '-p 宿主机端口:容器端口', '最后是要用的镜像名'],
    answer: 'docker run -d -p 8080:80 nginx',
    keywords: ['docker', 'run', '-d', '-p', '8080:80', 'nginx'],
    note: '启动后浏览器访问 http://localhost:8080 就能看到 nginx 欢迎页。',
    sandbox: 'home'
  }]);

})(window);
