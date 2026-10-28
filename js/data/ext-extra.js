/* =============================================================================
 * js/data/ext-extra.js
 * -----------------------------------------------------------------------------
 * 内容扩展：速查表 & 学习资源 + 进阶方向
 *
 * 这两个分支原本最薄（只有 1~2 个例题），补上"报错速查""7 天验收标准"
 * 与"日志 / tmux / vim"三项进阶必备技能后，它们才真正能当工具用。
 * ========================================================================== */
(function (global) {
  'use strict';

  var Data = global.LX && global.LX.Data;
  if (!Data) return;

  /* --------------------------- 速查表 & 资源补充 --------------------------- */
  Data.addChildren('cheatsheet', [
    {
      id: 'errors',
      name: '常见报错速查',
      full: 'common errors & fixes（报错 → 原因 → 解决）',
      plain: '新手 90% 的卡壳都来自十来个固定报错。把这几个背下来，遇到红色文字就不会慌：先读报错，再定位是"没权限""找不到""写满了"哪一类。',
      tips: [
        'command not found：没装 / 拼错 / 不在 PATH；用 which、apt install 解决',
        'Permission denied：权限不够，或文件所在目录缺 x 权限（进不去目录也会报这个）',
        'No such file or directory：路径写错；脚本报 /bin/bash^M 说明是 Windows 换行符',
        'Is a directory / Not a directory：cp 少了 -r，或把文件当目录用了',
        'Text file busy：程序正在运行，先 kill 再更新文件',
        'Argument list too long：通配符匹配文件太多，改用 find ... | xargs',
        'No space left on device：df -h 看分区，du -sh * 找大目录，删日志或清理缓存',
        'Address already in use：端口被占用，用 lsof -i :端口 找到并处理'
      ],
      rel: ['perm_bits', 'path', 'lsof_fd', 'head_tail'],
      examples: [{
        q: '脚本执行时报 "/bin/bash^M: bad interpreter"，怎么修？（文件是 Windows 换行）',
        steps: [
          '^M 是 Windows 的 \\r 回车符，Linux 解释器不认',
          '用 sed -i 就地把行尾的 \\r 删掉',
          '或者用 tr -d "\\r" 重写一份文件'
        ],
        answer: "sed -i 's/\\r$//' hi.sh",
        accept: ['tr -d "\\r" < hi.sh > hi2.sh', "dos2unix hi.sh"],
        keywords: ['sed', '-i', '\\r', 'hi.sh'],
        note: '在 WSL 里用 Windows 编辑器改脚本几乎必然会踩这个坑，建议统一用 VS Code 的 LF 换行。',
        sandbox: 'script'
      }, {
        q: '提示 No space left on device，快速找出当前目录里最大的 5 个条目',
        steps: ['du -sh * 统计每个条目的总大小', 'sort -h 按人类可读大小排序', 'tail -5 取最大的五个'],
        answer: 'du -sh * | sort -h | tail -5',
        keywords: ['du', '-sh', 'sort', '-h', 'tail'],
        note: '别忘了隐藏目录：du -sh .[!.]* * 2>/dev/null | sort -h | tail。',
        sandbox: 'files'
      }]
    },
    {
      id: 'study_plan',
      name: '7 天学习计划与验收标准',
      full: 'study plan（每天学什么、怎么算学会）',
      plain: '学命令行最怕"看完了但不会用"。这份计划给每天配了一个可验收的小任务：能独立敲出来，才算这天过关。',
      tips: [
        'Day 1（文件）：30 秒内完成"建目录 → 进入 → 建文件 → 改名 → 删除"',
        'Day 2（内容）：能说出 cat / less / head 各自适合什么场景，并用重定向造一个文件',
        'Day 3（权限）：看到 -rwxr-xr-- 能算出 754，并能用两种写法改权限',
        'Day 4（进程）：能用 ps + grep 找到进程、kill 掉它，并解释负载 8.0 意味着什么',
        'Day 5（文本）：能用 grep / awk 从日志里统计出访问量前 3 的 IP',
        'Day 6（查找备份）：能用 find + tar 写一条"找出 7 天前的日志并打包"的命令',
        'Day 7（脚本）：写出带参数检查、日志输出、并在 crontab 里跑起来的备份脚本',
        '每天 40 分钟：15 分钟看地图里的知识点，25 分钟在真实终端或本站沙盒里敲'
      ],
      rel: ['day1', 'cheat_sheet', 'script_hello'],
      examples: [{
        q: 'Day 1 验收：一条命令完成"建 demo 目录 → 进目录 → 建 a.txt → 改名为 b.txt → 回上级 → 删掉整个目录"',
        steps: [
          'mkdir demo && cd demo',
          'touch a.txt && mv a.txt b.txt',
          'cd .. 回到上级',
          'rm -r demo 删掉整个目录'
        ],
        answer: 'mkdir demo && cd demo && touch a.txt && mv a.txt b.txt && cd .. && rm -r demo',
        keywords: ['mkdir', 'touch', 'mv', 'rm'],
        note: '能用 && 串起来，说明你理解了"每条命令都会返回成功/失败"，这是写脚本的起点。',
        sandbox: 'files'
      }, {
        q: 'Day 5 验收：统计 access.log 中出现次数最多的前 3 个 IP',
        steps: ['cut 取第一列', 'sort 让相同 IP 相邻', 'uniq -c 计数', 'sort -rn 按次数倒序', 'head -3 取前三'],
        answer: "cut -d' ' -f1 access.log | sort | uniq -c | sort -rn | head -3",
        keywords: ['cut', 'sort', 'uniq', 'head'],
        note: '这条管道能独立写出来，文本处理就算入门了。',
        sandbox: 'text'
      }]
    }
  ]);
  /* ------------------------------ 进阶方向补充 ------------------------------ */
  Data.addChildren('next', [
    {
      id: 'journalctl_logs',
      name: '日志排查（journalctl / /var/log）',
      full: 'journalctl & /var/log（系统日志）',
      plain: '出问题第一件事就是看日志。systemd 的系统把日志收进 journal，用 journalctl 查；传统服务（nginx、mysql）则把文件写在 /var/log 下，用 tail 跟踪。',
      tips: [
        'journalctl -u nginx：只看某个服务的日志',
        'journalctl -f：实时跟踪（等于日志版 tail -f）',
        'journalctl -xe：查看最近的错误与提示（排障第一站）',
        'journalctl --since "1 hour ago" -n 100：时间 + 行数过滤',
        '文件日志：tail -f /var/log/nginx/access.log 实时跟；grep 过滤关键字',
        'WSL 默认没有 systemd，journalctl 不可用 —— 直接用 /var/log 或 dmesg'
      ],
      rel: ['systemctl', 'head_tail', 'grep'],
      examples: [{
        q: '实时跟踪 nginx 访问日志（先显示最后 10 行）',
        steps: ['tail -f 表示 follow，持续输出新内容', '-n 10 先显示最后 10 行', 'Ctrl+C 退出跟踪'],
        answer: 'tail -f -n 10 /var/log/nginx/access.log',
        accept: ['tail -n 10 -f /var/log/nginx/access.log', 'tail -10f /var/log/nginx/access.log'],
        keywords: ['tail', '-f', 'access.log'],
        note: '日志被 logrotate 切走后，tail -f 会"僵住"，改用 tail -F 或 journalctl。',
        sandbox: 'files'
      }, {
        q: '在 systemd 环境里查看 ssh 服务最近 50 行日志',
        steps: ['journalctl -u 后跟服务名', '-n 50 只取最后 50 行'],
        answer: 'journalctl -u ssh -n 50',
        accept: ['journalctl -u sshd -n 50', 'journalctl -u ssh --no-pager -n 50'],
        keywords: ['journalctl', '-u', 'ssh'],
        note: '服务名用 systemctl list-units 查，Ubuntu 上是 ssh，CentOS 上是 sshd。',
        sandbox: 'files'
      }]
    },
    {
      id: 'tmux',
      name: 'tmux（会话保持）',
      full: 'terminal multiplexer（终端复用器）',
      plain: 'tmux 是"给终端加一层壳"：断网、关窗口、SSH 掉线，里面跑的东西都还在。下次连回去，画面原封不动。',
      tips: [
        '新建会话：tmux new -s work；列出：tmux ls；重连：tmux a -t work',
        '前缀键默认 Ctrl+B：再按 c 新建窗口、n/p 切窗口、d 分离（detach）',
        '分离后进程继续跑，这是"远程跑长任务"的标准做法',
        '结束会话：tmux kill-session -t work',
        '窗口内再分屏：Ctrl+B 然后 % 左右分、" 上下分',
        '安装：sudo apt install tmux（WSL 里尤其推荐）'
      ],
      rel: ['nohup', 'ssh_scp', 'jobs_bg'],
      examples: [{
        q: '新建一个名为 work 的 tmux 会话',
        steps: ['tmux new 新建会话', '-s 指定会话名，方便以后重连'],
        answer: 'tmux new -s work',
        accept: ['tmux new-session -s work'],
        keywords: ['tmux', 'new', 'work'],
        note: '进入后按 Ctrl+B 再按 d 就能分离，进程继续在后台跑。',
        sandbox: 'script'
      }, {
        q: '列出当前所有 tmux 会话',
        steps: ['tmux ls 列出会话', '输出里有会话名、窗口数和创建时间'],
        answer: 'tmux ls',
        accept: ['tmux list-sessions'],
        keywords: ['tmux', 'ls'],
        note: '重连用 tmux a -t work（a 是 attach 的缩写）。',
        sandbox: 'script'
      }]
    },
    {
      id: 'vim_editor',
      name: 'vim 速成（服务器必备编辑器）',
      full: 'vi improved（三种模式的编辑器）',
      plain: '服务器上没有鼠标和菜单，改配置基本靠 vim 或 nano。vim 的怪点在于"模式"：进去不能直接打字，要先按 i 进入插入模式。',
      tips: [
        '三种模式：普通模式（默认）→ 按 i/a/o 进插入模式 → 按 Esc 回普通 → 按 : 进命令行模式',
        '保存退出：:wq；只退出：:q；不保存强退：:q!',
        '普通模式：dd 删整行、yy 复制行、p 粘贴、u 撤销、/关键词 搜索',
        'gg 跳到文件头、G 跳到文件尾、:100 跳到第 100 行、:$ 最后一行',
        '没有 sudo 权限保存：:w !sudo tee %',
        '不想学 vim 就用 nano 文件：Ctrl+O 保存、Ctrl+X 退出，底部有提示'
      ],
      rel: ['less', 'script_hello', 'errors'],
      examples: [{
        q: '在 vim 里做了修改但不想保存，直接强制退出（写出按键）',
        steps: ['先按 Esc 确保回到普通模式', '输入 : 进入命令行模式', '输入 q! 回车，表示 quit 且丢弃修改'],
        answer: ':q!',
        keywords: [':q!'],
        note: '忘按 Esc 就开始敲 :q! 的话，这些字符会被插入到文件里 —— 新手第一坑。',
        sandbox: 'script'
      }, {
        q: '用 vim 打开 notes.txt（服务器上最常见的编辑操作）',
        steps: ['vim 后跟文件名，文件不存在会新建', '按 i 开始编辑，Esc 退出编辑，:wq 保存并退出'],
        answer: 'vim notes.txt',
        keywords: ['vim', 'notes.txt'],
        note: '沙盒终端不模拟全屏编辑器；真机上先 vimtutor 练 20 分钟就够用了。',
        sandbox: 'files'
      }]
    }
  ]);

})(window);
