/* =============================================================================
 * js/data/knowledge.js
 * -----------------------------------------------------------------------------
 * 全站唯一内容源。
 * 把《Linux 学习指南（WSL2 入门）.md》整理成一棵"银河系知识地图"：
 *
 *   核心（Linux 入门）
 *     → 一级分支（11 个主题：环境搭建 / 终端基础 / Day1~Day7 / 速查资源 / 进阶）
 *       → 二级分支（具体命令、具体概念 = 97 个知识点）
 *         → 三级分支（参数细节、易错点、拓展实践）
 *
 * 本文件只放"主干 + Day1~Day7 核心命令"，其余内容按主题拆在 js/data/ext-*.js：
 *   ext-terminal.js  新增一级分支「终端与 Shell 基础」
 *   ext-files.js     Day1 / Day2 补充（ln、stat、sort、cut、tee、diff…）
 *   ext-sys.js       Day3 / Day4 补充（umask、特殊位、作业控制、端口占用…）
 *   ext-ops.js       Day5~Day7 补充（正则、xargs、rsync、cron、脚本调试…）
 *   ext-extra.js     速查表 / 进阶方向补充（报错速查、7 天计划、日志、tmux、vim）
 *   ext-examples.js  给只有 1 道题的核心知识点补第二题（用 Data.addExamples）
 * 它们调用 LX.Data.addBranch / addChildren / addExamples，加载后自动重建索引。
 *
 * 数据里只写"嵌套结构"，层级(level)/父节点(parent)/所属分支(branch) 全部由
 * flatten() 自动推导，所以以后加内容只要往 children 里塞对象即可。
 *
 * 节点字段：
 *   id        唯一标识（英文短横线命名）
 *   name      显示名称（一般是命令本身）
 *   full      全称 / 英文原文（对应"命令术语都附带全称解释"）
 *   plain     通俗说明（大白话比喻）
 *   icon      emoji，仅一级分支使用
 *   tips      细节要点数组（参数、易错点、实践建议）
 *   rel       显式关联的其他节点 id（用于"智能关联推荐"）
 *   examples  动手例题数组，见下
 *   children  子节点数组
 *
 * 例题字段：
 *   q         题干
 *   steps     详细步骤讲解（分步展开）
 *   answer    参考答案（可直接照抄到终端）
 *   accept    可选：等价写法（比对时会自动归一化，如 ls -la ≡ ls -al）
 *   keywords  可选：判分关键词，全部命中视为思路正确
 *   note      可选：常见错误 / 补充说明
 * ========================================================================== */
(function (global) {
  'use strict';

  /** 站点元信息 */
  var META = {
    title: 'Linux 学习指南（WSL2 入门）',
    subtitle: '银河系知识地图 · 7 天交互学习站',
    source: 'Linux学习指南_WSL2入门.md',
    core: 'linux'
  };

  /* ===========================================================================
   *  知识树（内容区：按一级分支顺序书写）
   * ======================================================================== */
  var TREE = {
    id: 'linux',
    name: 'Linux 入门',
    full: 'Linux Operating System（基于 WSL2 的入门学习）',
    plain: '把 Windows 想成一栋宿舍楼，Linux 就是楼里那间独立机房：没有花哨的图形界面，但工具箱（命令行）极其齐全。学会它，服务器部署、日志排查、自动化脚本都能自己动手。',
    icon: '🐧',
    tips: [
      '地图按"环境准备 + 7 天任务 + 速查资源 + 进阶方向"组织，从核心一圈圈向外辐射',
      '点击任意节点 → 右侧查看全称、通俗说明、细节要点和动手例题',
      '每个例题都能提交答案，系统归一化比对后给出反馈；进度存在浏览器本地',
      '记不住命令时：先看地图，再问右下角的 AI 助手'
    ],
    rel: ['env', 'day1', 'cheatsheet'],
    children: [
      /* ---------------------------------------------------------------------
       * 分支 1：环境搭建（WSL2）
       * ------------------------------------------------------------------ */
      {
        id: 'env',
        name: '环境搭建（WSL2）',
        icon: '🧱',
        full: 'Windows Subsystem for Linux 2 环境搭建',
        plain: '在 Windows 里开一间"真正的 Linux 房间"：共享文件、共享网络，装坏了删掉重装即可，零成本无限重来。',
        tips: [
          '安装主线：启用功能 → 重启 → wsl --install -d Ubuntu → 设置账号 → apt update',
          'WSL2 带真实 Linux 内核（轻量虚拟机），所以能跑服务、能装 Docker',
          '安装侧在 PowerShell 敲命令，学习侧在 Ubuntu 终端敲命令'
        ],
        rel: ['apt_update', 'wsl_mnt', 'tip_wsl_reenter'],
        children: [
          {
            id: 'wsl_install',
            name: 'wsl --install',
            full: 'Windows Subsystem for Linux（安装命令）',
            plain: '一条命令把 WSL 内核和 Ubuntu 一起装好，等于"一键建房 + 拎包入住"。',
            tips: [
              '在 PowerShell 里执行：wsl --install -d Ubuntu',
              '-d 是 --distribution 的缩写，用来指定发行版',
              '提示权限不足 → 右键 PowerShell「以管理员身份运行」再执行一次',
              '安装包约 1GB，看网速耐心等几分钟',
              '底层功能没开时，该命令会自动启用"适用于 Linux 的 Windows 子系统"与"虚拟机平台"'
            ],
            rel: ['sys_verify', 'wsl_account'],
            examples: [{
              q: '在 PowerShell 里用一条命令安装 Ubuntu 发行版',
              steps: [
                '按 Win 键，输入 powershell，打开 Windows PowerShell（普通窗口即可）',
                '输入安装命令并回车，等待下载安装完成（约 1GB）',
                '若提示需要管理员权限，右键「以管理员身份运行」再执行一次'
              ],
              answer: 'wsl --install -d Ubuntu',
              keywords: ['wsl', '--install', 'ubuntu'],
              note: '安装完必须重启电脑，WSL2 的虚拟化功能才生效。'
            }],
            children: [{
              id: 'wsl_restart',
              name: '重启电脑',
              full: 'Reboot（重启操作系统）',
              plain: 'WSL2 依赖虚拟化，功能启用后不重启等于没开——先保存工作再重启。',
              tips: [
                '重启前保存所有工作，别在下载或编译中途重启',
                '重启后打开 PowerShell 输入 wsl 就能进入 Ubuntu'
              ],
              rel: ['wsl_install']
            }]
          },
          {
            id: 'wsl_account',
            name: 'Linux 账号设置',
            full: 'UNIX username / password（首次登录设置）',
            plain: '第一次进 Ubuntu 会让你取名和设密码，等于给新房间配钥匙。',
            tips: [
              'Enter new UNIX username：输入全小写英文（如 deepvision），别用中文',
              'New password：输入密码时屏幕完全不显示，这是正常现象，输完直接回车',
              'Retype new password：再输一遍，两次不一致会重来',
              '看到 Welcome to Ubuntu 提示就说明成功了',
              '忘记密码：PowerShell 执行 wsl -u root passwd 你的用户名 即可重置'
            ],
            rel: ['whoami', 'sys_verify'],
            examples: [{
              q: '进入 Ubuntu 后，确认当前是以哪个用户身份登录的',
              steps: ['开始菜单或 Win + R 输入 wsl 回车，进入 Ubuntu 终端', '输入 whoami 并回车', '输出的名字就是你刚才设置的用户名'],
              answer: 'whoami',
              keywords: ['whoami']
            }]
          }
          ,{
            id: 'sys_verify',
            name: '验证安装',
            full: 'uname -a / lsb_release -a（验证内核与发行版）',
            plain: '装修完验收：看内核、看系统版本、看当前用户、看当前目录，四项都对就说明装成功了。',
            tips: [
              'uname -a：显示 Linux 内核版本与架构（-a = all）',
              'lsb_release -a：显示 Ubuntu 发行版编号（-a = all）',
              'whoami：当前用户；pwd：当前目录',
              '输出里出现 Linux … Ubuntu … 加上你的用户名 → 安装成功 ✅'
            ],
            rel: ['pwd', 'whoami', 'wsl_install'],
            examples: [{
              q: '查看当前系统内核版本的全部信息（含系统名、内核号、架构）',
              steps: ['进入 Ubuntu 终端', '输入 uname -a 并回车', '观察输出第一段是不是 Linux，以及后面的内核版本号与 x86_64 架构'],
              answer: 'uname -a',
              keywords: ['uname', '-a']
            }]
          },
          {
            id: 'apt_update',
            name: 'apt update / upgrade',
            full: 'Advanced Package Tool（Debian / Ubuntu 软件包管理器）',
            plain: 'Linux 的应用商店：update 只是刷新货架清单，upgrade 才是真的把东西换成新版。',
            tips: [
              'sudo apt update：只刷新软件源索引，不升级任何东西',
              'sudo apt upgrade -y：真正升级已安装软件，-y 表示全部自动确认',
              '装任何软件之前先 update，这是 Linux 新手第一课',
              '国内网速慢可以换镜像源（清华 / 阿里云）再 update'
            ],
            rel: ['wsl_tools', 'sudo'],
            examples: [{
              q: '刷新软件源索引，并自动确认升级所有已安装软件（两条命令）',
              steps: [
                'sudo apt update —— 先拉取最新的软件清单',
                'sudo apt upgrade -y —— 按新清单升级已装软件，-y 跳过所有交互确认',
                '提示输入密码时，输入你设置的 Linux 密码（屏幕不显示是正常的）'
              ],
              answer: 'sudo apt update\nsudo apt upgrade -y',
              accept: ['sudo apt upgrade -y\nsudo apt update'],
              keywords: ['apt update', 'apt upgrade'],
              note: '很多人只敲了 update 就以为系统升级完了——update 永远不会升级软件。'
            }]
          },
          {
            id: 'wsl_tools',
            name: '常用工具安装',
            full: 'apt install vim tree htop git curl wget',
            plain: '一次性配齐"编辑器 + 目录树 + 监控 + 下载"，后面几天的练习都会用到。',
            tips: [
              'sudo apt install -y vim tree htop git curl wget',
              'vim 功能强但难上手，新手先用 nano 更轻松',
              'tree 树状展示目录，htop 彩色实时监控进程',
              'curl / wget 都是下载工具，git 用来拉代码'
            ],
            rel: ['apt_update', 'top_htop', 'tree'],
            examples: [{
              q: '一次安装 vim、tree、htop、git、curl、wget 六个工具（自动确认）',
              steps: ['先确保执行过 sudo apt update', 'apt install 后面可以跟多个包名，用空格分隔', '加上 -y 免去逐个确认'],
              answer: 'sudo apt install -y vim tree htop git curl wget',
              keywords: ['apt install', 'vim', 'tree', 'htop', 'git', 'curl', 'wget']
            }]
          },
          {
            id: 'wsl_mnt',
            name: '/mnt/c 跨系统访问',
            full: 'mount point（挂载点 · 访问 Windows 磁盘）',
            plain: 'WSL 把 Windows 的 C 盘挂在 /mnt/c，所以你在 Linux 里也能翻 Windows 文件。',
            tips: [
              'ls /mnt/c 查看 C 盘根目录，/mnt/d 就是 D 盘',
              'Linux 自己的家目录是 /home/你的用户名，读写性能远好于 /mnt/c',
              '代码项目建议放 Linux 家目录，别放 /mnt/c（跨文件系统会明显变慢）',
              '在 WSL 里改 Windows 文件要注意权限与换行符（CRLF / LF）差异'
            ],
            rel: ['mv', 'du', 'tip_wsl_reenter'],
            examples: [{
              q: '列出 Windows C 盘根目录里的内容',
              steps: ['进入 Ubuntu 终端', 'Windows 的磁盘统一挂在 /mnt 下，C 盘即 /mnt/c', '用 ls 列出该目录内容'],
              answer: 'ls /mnt/c',
              keywords: ['ls', '/mnt/c']
            }],
            children: [{
              id: 'wsl_unregister',
              name: '重装 / 卸载发行版',
              full: 'wsl --unregister（注销并删除发行版）',
              plain: '练习环境随便折腾，装坏了直接注销重装，完全免费可无限重来。',
              tips: [
                'PowerShell 执行 wsl --unregister Ubuntu 会删除整个发行版（数据全没）',
                'wsl --list --verbose 查看已安装的发行版及运行状态',
                'wsl --shutdown 立即关闭所有 WSL 实例'
              ],
              rel: ['wsl_install']
            }]
          }
        ]
      },
      /* ---------------------------------------------------------------------
       * 分支 2：Day 1 文件与目录
       * ------------------------------------------------------------------ */
      {
        id: 'day1',
        name: 'Day 1 文件与目录',
        icon: '📁',
        full: 'Filesystem & Directories（文件系统与目录操作）',
        plain: '在 Linux 里一切皆文件：看路、看屋子、进屋、造屋、搬走。这一天练熟 8 个命令，后面全都建立在这上面。',
        tips: [
          '学习命令：pwd、ls、cd、mkdir、touch、rm、cp、mv、tree',
          'Linux 用正斜杠 / 分隔路径，没有 C 盘盘符；根目录就是 /',
          '⚠️ Linux 删除没有回收站，rm 之前一定想清楚'
        ],
        rel: ['day2', 'path', 'tip_norecycle'],
        children: [
          {
            id: 'pwd',
            name: 'pwd',
            full: 'print working directory（打印当前工作目录）',
            plain: '迷路时看路牌：我现在到底在哪个目录？',
            tips: [
              '输出的是绝对路径，例如 /home/deepvision',
              '打开终端默认就在家目录 ~，也就是 /home/用户名',
              '和 ls 组合是最高频的新手动作：不确定就先 pwd'
            ],
            rel: ['ls', 'cd', 'path'],
            examples: [{
              q: '显示当前所在的完整目录路径',
              steps: ['打开 Ubuntu 终端', '输入 pwd 回车', '观察输出的绝对路径，通常以 /home/你的用户名 开头'],
              answer: 'pwd',
              keywords: ['pwd']
            }]
          },
          {
            id: 'ls',
            name: 'ls',
            full: 'list（列出目录内容）',
            plain: '打开柜门看看里面都有什么，默认只看"看得见"的。',
            tips: [
              'ls -l 长格式：权限、属主、大小、修改时间一次看全',
              'ls -a 显示隐藏文件（以点开头的文件，如 .bashrc）',
              'ls -h 把大小显示成 1K / 2M 这种人类可读格式',
              '三个可以连写：ls -lah 等价于 ls -l -a -h',
              'ls 后面跟路径就能看别的目录：ls /etc'
            ],
            rel: ['pwd', 'ls_l', 'cd'],
            examples: [{
              q: '列出当前目录下所有文件（含隐藏文件）的详细信息',
              steps: [
                'ls 单独用只显示文件名，看不出权限和大小',
                '-l 长格式；-a 显示隐藏文件（含 . 和 ..）',
                '两个参数可以合并写成 -la（等价于 -l -a）'
              ],
              answer: 'ls -la',
              accept: ['ls -al', 'ls -a -l', 'ls -l -a'],
              keywords: ['ls', '-l', '-a'],
              note: '-la / -al 完全等价，缩写参数的顺序不影响结果。'
            }],
            children: [{
              id: 'ls_l',
              name: 'ls -l 权限位',
              full: 'long format（长格式列表）',
              plain: '像身份证表格：谁拥有、谁能读写、多大、什么时候改的。',
              tips: [
                '第一列 -rwxr-xr-x 共 10 位：第 1 位是类型（- 文件 / d 目录 / l 链接）',
                '第 2~4 位属主权限，第 5~7 位属组权限，第 8~10 位其他人权限',
                'r=读(4) w=写(2) x=执行(1)，没有该权限显示 -',
                '第三天 Day3 会专门拆解这 10 位'
              ],
              rel: ['chmod', 'ls']
            }, {
              id: 'ls_h',
              name: 'ls -h',
              full: 'human-readable（人类可读格式）',
              plain: '把 1048576 字节换成 1.0M，眼睛不用数零。',
              tips: ['ls -lh 配合长格式最常用', 'df -h、du -sh、free -h 里的 -h 都是同一个意思']
            }]
          },
          {
            id: 'cd',
            name: 'cd',
            full: 'change directory（切换目录）',
            plain: '走进另一间屋子。cd 后面跟门牌号（路径）。',
            tips: [
              'cd /etc 用绝对路径进；cd logs 用相对路径进下级目录',
              'cd .. 返回上一级；cd ../.. 返回上两级',
              'cd ~ 或单独 cd 回到用户家目录；cd - 回到上一次所在的目录',
              'cd 后面不带参数等价于 cd ~'
            ],
            rel: ['pwd', 'path', 'mkdir'],
            examples: [{
              q: '从当前目录返回上一级目录',
              steps: ['在 Linux 里，. 表示当前目录，.. 表示上一级目录', '所以返回上一级就是 cd 加两个点', '进入后可用 pwd 确认路径变化'],
              answer: 'cd ..',
              keywords: ['cd', '..']
            }]
          },
          {
            id: 'mkdir',
            name: 'mkdir',
            full: 'make directory（创建目录）',
            plain: '造新房间。mkdir -p 能一次把"爷爷-爸爸-儿子"三层房间全造好。',
            tips: [
              'mkdir 目录名 创建单层目录',
              'mkdir -p a/b/c 一次创建多级目录，父目录不存在也不会报错',
              '-p 的另一个好处：目录已存在时不报错（幂等）',
              'mkdir -p 是建项目骨架（如 src/css js data）最快的写法'
            ],
            rel: ['cd', 'touch', 'tree'],
            examples: [{
              q: '一次性创建多级目录 a/b/c（中间层两个目录都不存在）',
              steps: [
                '直接用 mkdir a/b/c 会报错：父目录 a/b 不存在',
                '加 -p（--parents）参数，缺哪层就自动补哪层',
                '创建完用 tree a 或 ls -R a 验证结构'
              ],
              answer: 'mkdir -p a/b/c',
              accept: ['mkdir --parents a/b/c', 'mkdir -p a/b/c/'],
              keywords: ['mkdir', '-p', 'a/b/c']
            }]
          },
          {
            id: 'touch',
            name: 'touch',
            full: 'touch（创建空文件 / 更新文件时间戳）',
            plain: '轻轻碰一下：文件不存在就建个空的，存在就只更新"最后修改时间"。',
            tips: [
              'touch 1.txt 创建空文件（大小为 0 字节）',
              '对已存在的文件执行 touch 不会清空内容，只改时间戳',
              '批量建文件：touch a.txt b.txt c.txt',
              '想直接写内容用 echo "内容" > 文件.txt 更方便'
            ],
            rel: ['echo', 'mkdir', 'cp'],
            examples: [{
              q: '在当前目录创建一个空的文本文件 1.txt',
              steps: ['touch 后面直接跟文件名', '文件名建议带扩展名，方便识别', '用 ls -l 1.txt 检查，大小应为 0'],
              answer: 'touch 1.txt',
              keywords: ['touch', '1.txt']
            }]
          },
          {
            id: 'cp',
            name: 'cp',
            full: 'copy（复制文件或目录）',
            plain: '复印机：源文件留在原地，多出一份副本。',
            tips: [
              'cp 源文件 目标文件 —— 例如 cp 1.txt 2.txt',
              'cp 文件 目录/ —— 把文件复制进目录',
              '复制目录必须加 -r（recursive 递归），否则报错 omitted directory',
              'cp -i 覆盖前询问；cp -v 显示复制过程'
            ],
            rel: ['mv', 'rm', 'touch'],
            examples: [{
              q: '把 1.txt 复制一份，命名为 2.txt（原文件保留）',
              steps: ['cp 的语法是 cp 源 目标', '源写 1.txt，目标写 2.txt', '用 ls -l 检查两个文件内容大小一致'],
              answer: 'cp 1.txt 2.txt',
              keywords: ['cp', '1.txt', '2.txt']
            }]
          },
          {
            id: 'mv',
            name: 'mv',
            full: 'move（移动 / 重命名）',
            plain: '搬家工人：把文件搬到别的屋子；如果"新地址"其实是个新名字，那就是改名。',
            tips: [
              'mv 源 目标目录/ —— 移动到目录里，例如 mv 2.txt b/',
              'mv 旧名 新名 —— 同一目录内就是重命名，例如 mv 1.txt 3.txt',
              '目标已存在会被直接覆盖，且不会有任何提示（危险点）',
              '-i 覆盖前询问，-v 显示过程'
            ],
            rel: ['cp', 'rm', 'cd'],
            examples: [{
              q: '把文件 2.txt 移动到 b 目录下',
              steps: ['mv 的语法是 mv 源 目标', '目标是目录时，路径结尾加 / 更直观', '用 ls b 确认文件已在里面'],
              answer: 'mv 2.txt b/',
              accept: ['mv 2.txt b'],
              keywords: ['mv', '2.txt', 'b']
            }]
          },
          {
            id: 'rm',
            name: 'rm',
            full: 'remove（删除文件或目录）',
            plain: '碎纸机，没有回收站：删了就真没了，rm -rf 更是推土机。',
            tips: [
              'rm 3.txt 删除文件',
              'rm -r 目录 递归删除目录及其内容（rmdir 只能删空目录）',
              'rm -f 强制删除，不提示、忽略不存在的文件',
              'rm -rf / 或 rm -rf * 是经典事故，执行前先 pwd 确认位置',
              '想留退路：先 mv 到临时目录，或装 trash-cli 做回收站'
            ],
            rel: ['mv', 'cp', 'tip_norecycle'],
            examples: [{
              q: '删除文件 3.txt（不需要确认）',
              steps: ['rm 后跟要删的文件名', '系统不会问"确定吗"，直接删除', '用 ls 确认文件已消失'],
              answer: 'rm 3.txt',
              keywords: ['rm', '3.txt'],
              note: '⚠️ Linux 没有回收站，删错只能重来。带 -f 时连提示都没有。'
            }],
            children: [{
              id: 'rm_rf',
              name: 'rm -rf 风险',
              full: 'remove -recursive -force（递归强制删除）',
              plain: '推土机：目录连根拔起，不问确认。新手最容易在这里翻车。',
              tips: [
                '执行前一定先 pwd 和 ls 看清位置',
                '永远不要写 rm -rf / 或 rm -rf /*',
                '变量拼接的路径要加引号并先 echo 验证，避免空变量变成删根目录',
                '生产环境建议用 mv 到 /tmp 代替直接删除'
              ],
              rel: ['rm', 'tip_norecycle']
            }]
          },
          {
            id: 'tree',
            name: 'tree',
            full: 'tree（树状显示目录结构）',
            plain: '把文件夹变成一张树形图，一眼看清整个项目的骨架。',
            tips: [
              'tree 目录 显示该目录的树状结构',
              'tree -L 2 只显示 2 层，目录太深时很实用',
              'tree -a 连隐藏文件一起显示',
              '系统默认可能没装：sudo apt install -y tree'
            ],
            rel: ['ls', 'mkdir', 'wsl_tools'],
            examples: [{
              q: '用树状结构查看当前目录（只看 2 层，避免刷屏）',
              steps: ['tree 默认递归全部层级，输出可能很长', '-L 参数限制层数，-L 2 表示只显示两层', '需要安装：sudo apt install -y tree'],
              answer: 'tree -L 2',
              keywords: ['tree', '-L', '2']
            }]
          },
          {
            id: 'path',
            name: '绝对路径 / 相对路径',
            full: 'absolute path & relative path',
            plain: '绝对路径是从"/"这个总大门开始写的完整门牌；相对路径是从"我现在站的屋子"开始数。',
            tips: [
              '绝对路径以 / 开头，例如 /home/deepvision/a/b',
              '相对路径不以 / 开头，例如 a/b、./a、../b',
              '. 表示当前目录，.. 表示上一级目录，~ 表示当前用户家目录',
              '切换目录、写脚本时用绝对路径更不容易出错',
              '路径有空格要用引号包起来："my file.txt"'
            ],
            rel: ['pwd', 'cd', 'mkdir'],
            examples: [{
              q: '用绝对路径的形式，进入当前用户的家目录（写全路径，不要用 ~）',
              steps: [
                '家目录的绝对路径是 /home/用户名，用户名可用 whoami 查到',
                'cd 后面跟绝对路径即可进入',
                '进入后用 pwd 验证输出与输入的路径一致'
              ],
              answer: 'cd /home/deepvision',
              accept: ['cd $HOME', 'cd ~'],
              keywords: ['cd', '/home/'],
              note: '实际练习时把 deepvision 换成你自己的用户名。'
            }]
          }
        ]
      },
      /* ---------------------------------------------------------------------
       * 分支 3：Day 2 查看文件内容
       * ------------------------------------------------------------------ */
      {
        id: 'day2',
        name: 'Day 2 查看文件内容',
        icon: '📄',
        full: 'Viewing & Writing Files（查看与写入文件内容）',
        plain: '昨天只会造空文件，今天学会往里写字、把文件读出来、翻页看、实时看日志。',
        tips: [
          '学习命令：cat、less、head、tail、wc、echo，外加重定向 > 与 >>',
          '小文件用 cat，大文件用 less，日志实时盯用 tail -f',
          '> 是覆盖，>> 是追加，写错一个字符后果完全不同'
        ],
        rel: ['day1', 'pipe', 'grep'],
        children: [
          {
            id: 'echo',
            name: 'echo / 重定向',
            full: 'echo（输出文本）+ > >>（redirection 重定向）',
            plain: 'echo 是喇叭，把话喊到屏幕上；重定向是话筒，把话录进文件里。',
            tips: [
              'echo "hello linux" 直接在屏幕输出',
              'echo "hello linux" > 1.txt：单个 > 覆盖写入（原内容清空）',
              'echo "第二行" >> 1.txt：>> 追加到末尾，不清空',
              'echo $PATH 可以查看环境变量内容',
              'echo 内容里想保留空格和特殊字符，用单引号更安全'
            ],
            rel: ['cat', 'redirect', 'day7'],
            examples: [{
              q: '把 hello linux 写入 1.txt，如果文件已有内容则全部覆盖',
              steps: [
                'echo 负责产生文本，> 负责把输出重定向到文件（覆盖）',
                '文本建议用双引号包住，避免空格被当成多个参数',
                '写完后用 cat 1.txt 验证内容'
              ],
              answer: 'echo "hello linux" > 1.txt',
              accept: ["echo 'hello linux' > 1.txt", 'echo hello linux > 1.txt'],
              keywords: ['echo', 'hello linux', '>', '1.txt'],
              note: '单个 > 会清空原文件；想追加必须用 >>。'
            }, {
              q: '把"第二行"追加到 1.txt 末尾（保留原有内容）',
              steps: ['追加使用双箭头 >>', '如果误写成 >，文件会被清空只剩"第二行"', '用 cat 1.txt 确认两行都在'],
              answer: 'echo "第二行" >> 1.txt',
              accept: ["echo '第二行' >> 1.txt", 'echo 第二行 >> 1.txt'],
              keywords: ['echo', '第二行', '>>', '1.txt']
            }],
            children: [{
              id: 'redirect',
              name: '> / >> / 2>',
              full: 'redirection（输入输出重定向）',
              plain: '把屏幕上的输出"改道"进文件；2> 是专门接住报错信息的管子。',
              tips: [
                '> 覆盖写入，>> 追加写入',
                '2> err.log 只重定向错误输出；> out.log 2>&1 把正常和错误一起写进文件',
                '< 是输入重定向，例如 wc -l < 1.txt',
                '管道 | 把上一个命令的输出直接交给下一个命令'
              ],
              rel: ['echo', 'pipe']
            }]
          },
          {
            id: 'cat',
            name: 'cat',
            full: 'concatenate（连接并显示文件内容）',
            plain: '一口气把整份文件念给你听，适合短文件。',
            tips: [
              'cat 1.txt 显示全部内容',
              'cat -n 1.txt 显示行号',
              'cat a.txt b.txt 依次显示多个文件（"连接"的意思）',
              'cat > new.txt 然后输入多行内容，Ctrl+D 结束并保存',
              '文件超过一屏就别用 cat，用 less'
            ],
            rel: ['less', 'head_tail', 'echo'],
            examples: [{
              q: '带行号查看 1.txt 的全部内容',
              steps: ['cat 显示全部内容但默认没有行号', '-n（number）参数给每一行编号', '输入 cat -n 1.txt 并观察左侧数字'],
              answer: 'cat -n 1.txt',
              keywords: ['cat', '-n', '1.txt']
            }]
          },
          {
            id: 'less',
            name: 'less',
            full: 'less（分页查看文件内容）',
            plain: '给文件装了个"阅读器"：一页一页翻，不会像 cat 那样刷屏。',
            tips: [
              'less 大文件.txt 进入分页阅读',
              '空格 / PgDn 向下翻一屏，b / PgUp 向上翻，方向键上下滚动',
              '输入 / 关键字 向下搜索，n 下一个匹配，N 上一个',
              'q 退出（新手最常卡住：不知道按什么退出）',
              'less 不会一次性把整个文件读进内存，看几个 G 的日志也没问题'
            ],
            rel: ['cat', 'head_tail', 'grep'],
            examples: [{
              q: '用分页方式打开 1.txt（看完用键盘退出）',
              steps: ['less 后接文件名进入阅读模式', '空格翻页，向上键上滚，/ 加关键字可搜索', '按 q 键退出阅读模式'],
              answer: 'less 1.txt',
              keywords: ['less', '1.txt']
            }]
          },
          {
            id: 'head_tail',
            name: 'head / tail',
            full: 'head（文件头部）/ tail（文件尾部）',
            plain: '只看开头几行用 head，只看结尾几行用 tail——日志排查全靠它们。',
            tips: [
              'head -n 5 1.txt 看前 5 行（不加 -n 默认 10 行）',
              'tail -n 5 1.txt 看最后 5 行',
              'tail -f app.log 实时跟踪日志新增内容（f = follow）',
              'tail -n 100 -f app.log —— 先看最后 100 行，再持续跟新',
              'Ctrl + C 退出 -f 模式'
            ],
            rel: ['less', 'cat', 'tail_f'],
            examples: [{
              q: '查看 1.txt 的最后 2 行',
              steps: ['head 看头部，tail 看尾部，看尾部用 tail', '-n 2 指定行数', '命令写作 tail -n 2 1.txt'],
              answer: 'tail -n 2 1.txt',
              accept: ['tail -2 1.txt'],
              keywords: ['tail', '2', '1.txt']
            }],
            children: [{
              id: 'tail_f',
              name: 'tail -f 实时日志',
              full: 'tail --follow（实时跟踪文件追加内容）',
              plain: '像盯着滚动字幕：文件每多一行，屏幕就自动多一行。',
              tips: [
                'tail -f 日志文件 持续输出新写入的内容',
                'tail -F 在日志文件被切割/重建时也能继续跟（生产更常用）',
                'Ctrl + C 退出跟踪',
                '配合 grep 过滤：tail -f app.log | grep ERROR'
              ],
              rel: ['head_tail', 'grep', 'pipe']
            }]
          },
          {
            id: 'wc',
            name: 'wc',
            full: 'word count（统计行数 / 单词数 / 字节数）',
            plain: '数数工具：有多少行、多少个词、多少字节。',
            tips: [
              'wc -l 1.txt 统计行数（最常用，-l = lines）',
              'wc -w 统计单词数，wc -c 统计字节数',
              'wc -l 不带文件名时从标准输入读，可配合管道：ls | wc -l 数文件个数',
              '统计代码行数：find . -name "*.py" | xargs wc -l'
            ],
            rel: ['pipe', 'cat', 'find'],
            examples: [{
              q: '统计 1.txt 一共有多少行',
              steps: ['wc 默认输出 行数 单词数 字节数 文件名', '-l 只输出行数', '命令写作 wc -l 1.txt'],
              answer: 'wc -l 1.txt',
              keywords: ['wc', '-l', '1.txt']
            }]
          }
        ]
      },
      /* ---------------------------------------------------------------------
       * 分支 4：Day 3 权限与用户
       * ------------------------------------------------------------------ */
      {
        id: 'day3',
        name: 'Day 3 权限与用户',
        icon: '🔐',
        full: 'Permissions & Users（权限与用户管理）',
        plain: 'Linux 是多用户系统：谁能读、谁能写、谁能执行都写在文件上。搞不清权限，是新手踩坑最多的地方。',
        tips: [
          '学习命令：ls -l、chmod、sudo、whoami、id（速查表里还有 chown）',
          '权限三组：属主 u、属组 g、其他人 o；权限三种：r 读=4、w 写=2、x 执行=1',
          '提示 Permission denied 时，先看权限，不要第一反应就 sudo'
        ],
        rel: ['day1', 'ls_l', 'sudo'],
        children: [
          {
            id: 'perm_bits',
            name: '权限位 rwx',
            full: 'file permission bits（-rwxr-xr-x）',
            plain: '十位字符像三把钥匙分配表：第一把给主人，第二把给同组人，第三把给外人。',
            tips: [
              '一共 10 位：文件类型 1 位 + 属主 3 位 + 属组 3 位 + 其他人 3 位',
              '类型位：- 普通文件、d 目录、l 符号链接',
              'r = read 读（4）、w = write 写（2）、x = execute 执行（1）',
              'r-x = 4+1 = 5；rw- = 4+2 = 6；rwx = 7',
              '-rwxr-xr-x 等价于 755，-rw-r--r-- 等价于 644',
              '目录的 x 表示"能进入"（cd），r 表示"能 ls 看到内容"，w 表示"能新建/删除文件"'
            ],
            rel: ['ls_l', 'chmod', 'chmod_num'],
            examples: [{
              q: '查看 /etc/hosts 的权限，并说出它对应的三位数字要求（只需执行查看命令）',
              steps: ['查看单个文件的详细信息用 ls -l 加路径', '-rw-r--r-- 拆成 rw- / r-- / r-- 三组', '4+2=6、4=4、4=4，所以数字是 644'],
              answer: 'ls -l /etc/hosts',
              keywords: ['ls', '-l', '/etc/hosts']
            }]
          },
          {
            id: 'chmod',
            name: 'chmod',
            full: 'change mode（修改文件权限）',
            plain: '给文件重新配钥匙：谁能读、谁能写、谁能运行。',
            tips: [
              'chmod +x 脚本.sh 给所有身份加可执行权限（最常用）',
              'chmod 754 文件 用数字方式一次性设定 u/g/o 权限',
              'u+x、g-w、o=r 这种字母写法可以精准修改某一组',
              'chmod -R 755 目录 递归修改整个目录',
              '脚本无法直接运行（Permission denied）时，99% 是少了 x 权限'
            ],
            rel: ['chmod_num', 'perm_bits', 'shell_run'],
            examples: [{
              q: '给脚本文件 hi.sh 加上可执行权限，让它能 ./hi.sh 运行',
              steps: [
                '新建的脚本默认没有 x 权限，直接 ./hi.sh 会报 Permission denied',
                'chmod +x 文件名 为属主/属组/其他人统一加上执行权限',
                '再用 ls -l hi.sh 确认权限位里出现了 x'
              ],
              answer: 'chmod +x hi.sh',
              accept: ['chmod u+x hi.sh', 'chmod a+x hi.sh', 'chmod 755 hi.sh'],
              keywords: ['chmod', '+x', 'hi.sh']
            }],
            children: [{
              id: 'chmod_num',
              name: '数字权限 754',
              full: 'octal permission（八进制权限表示法）',
              plain: '把三组权限换成三个 0~7 的数字，一串数字搞定一个文件。',
              tips: [
                '7 = rwx、6 = rw-、5 = r-x、4 = r--、0 = ---',
                '754 表示：属主 rwx、属组 r-x、其他人 r--',
                '常用组合：644 普通文件、755 可执行文件/目录、600 私钥',
                '数字是相加出来的：r(4)+w(2)+x(1)'
              ],
              rel: ['chmod', 'perm_bits'],
              examples: [{
                q: '用数字方式把文件 1.txt 的权限设为：属主读写执行，属组读执行，其他人读',
                steps: ['rwx = 7；r-x = 4+1 = 5；r-- = 4', '组合成三位数字 754', 'chmod 754 1.txt 后用 ls -l 验证'],
                answer: 'chmod 754 1.txt',
                keywords: ['chmod', '754', '1.txt']
              }]
            }]
          },
          {
            id: 'sudo',
            name: 'sudo',
            full: 'superuser do（以管理员身份执行）',
            plain: '临时借用管理员的万能钥匙：装软件、改系统配置都得靠它。',
            tips: [
              'sudo apt update —— 在普通命令前面加 sudo',
              '第一次使用会要求输入你自己的密码（输入时不显示）',
              'sudo -i 进入 root 交互 shell（不推荐长期这么干）',
              'sudo !! 用管理员身份重跑上一条命令，忘记加 sudo 时非常实用',
              '不要对所有命令都加 sudo：会改坏家目录文件的属主，导致后续无法编辑'
            ],
            rel: ['apt_update', 'id', 'perm_bits'],
            examples: [{
              q: '以管理员身份刷新软件源索引',
              steps: ['apt update 需要写系统目录权限，普通用户会报 Permission denied', '在命令最前面加 sudo 提权执行', '按提示输入你自己的 Linux 密码（屏幕不显示）'],
              answer: 'sudo apt update',
              keywords: ['sudo', 'apt update']
            }]
          },
          {
            id: 'whoami',
            name: 'whoami',
            full: 'who am i（我是谁）',
            plain: '照镜子：当前这个终端到底是哪个用户在操作。',
            tips: [
              '输出当前用户名，安装后通常就是你自己创建的名字',
              'sudo whoami 会输出 root，可以验证提权是否生效',
              '排查"为什么没权限"时，第一步就是 whoami'
            ],
            rel: ['id', 'wsl_account', 'sudo'],
            examples: [{
              q: '确认当前登录的用户名',
              steps: ['输入 whoami 回车', '输出即当前用户名（不是主机名）', '想看更完整的信息用 id'],
              answer: 'whoami',
              keywords: ['whoami']
            }]
          },
          {
            id: 'id',
            name: 'id',
            full: 'identity（查看用户 ID 与所属组）',
            plain: '身份证详情页：uid 是编号，gid 是主组，groups 是你加入的所有组。',
            tips: [
              '例：uid=1000(deepvision) gid=1000(deepvision) groups=1000(deepvision),27(sudo)',
              'uid=0 就是 root，看到 0 说明你是超级用户',
              'groups=sudo 表示这个用户可以 sudo 提权',
              'id 用户名 可以查别人；groups 只列组名'
            ],
            rel: ['whoami', 'sudo', 'chown'],
            examples: [{
              q: '查看当前用户的 uid、gid 和所有所属组',
              steps: ['输入 id 回车', 'uid 是用户编号，gid 是主组编号', 'groups 后面的括号里就是所属组名称'],
              answer: 'id',
              keywords: ['id']
            }]
          },
          {
            id: 'chown',
            name: 'chown',
            full: 'change owner（修改文件属主 / 属组）',
            plain: '换房本名字：把文件的主人从 A 改成 B。',
            tips: [
              'chown 用户名 文件 —— 改属主',
              'chown 用户名:组名 文件 —— 属主和属组一起改',
              'chown -R 用户名:组名 目录 —— 递归修改',
              '需要 sudo；误用 sudo 创建文件后常要用它把属主改回来'
            ],
            rel: ['chmod', 'id', 'sudo'],
            examples: [{
              q: '把文件 1.txt 的属主和属组都改成 root（需要提权）',
              steps: ['chown 属主:属组 文件名的语法', '这里属主和属组都是 root', '普通用户改属主必须加 sudo'],
              answer: 'sudo chown root:root 1.txt',
              keywords: ['sudo', 'chown', 'root', '1.txt']
            }]
          }
        ]
      },
      /* ---------------------------------------------------------------------
       * 分支 5：Day 4 进程与系统信息
       * ------------------------------------------------------------------ */
      {
        id: 'day4',
        name: 'Day 4 进程与系统信息',
        icon: '⚙️',
        full: 'Processes & System Info（进程与系统资源）',
        plain: '电脑卡了、磁盘满了、某个程序不听话——这一天学的是"看体检报告 + 精准动手"。',
        tips: [
          '学习命令：ps、top / htop、kill、free、df、du',
          '查问题顺序：先 ps/top 找进程 → 再看 free/df/du 看资源',
          'df 看"磁盘还剩多少"，du 看"某个目录吃了多少"'
        ],
        rel: ['day6', 'pipe', 'docker'],
        children: [
          {
            id: 'ps',
            name: 'ps',
            full: 'process status（查看进程状态）',
            plain: '任务管理器的一次性快照：把当前所有在跑的程序列出来。',
            tips: [
              'ps aux 查看系统所有进程（BSD 风格，最常用）',
              'ps -ef 另一种写法（标准风格），效果类似',
              '输出列：USER 用户、PID 进程号、%CPU、%MEM、COMMAND 启动命令',
              'PS aux | grep 关键字 找特定程序（记得配合管道）',
              '只看自己的进程：ps -u $USER'
            ],
            rel: ['top_htop', 'kill', 'pipe'],
            examples: [{
              q: '列出系统里所有进程的详细信息（含 CPU / 内存占用）',
              steps: [
                'ps 单独执行只显示当前终端的进程',
                'a 表示所有用户的进程，u 表示以用户友好格式显示，x 表示包含无终端的进程',
                '常用写法：ps aux'
              ],
              answer: 'ps aux',
              accept: ['ps -ef', 'ps -aux'],
              keywords: ['ps', 'aux']
            }]
          },
          {
            id: 'top_htop',
            name: 'top / htop',
            full: 'top（实时进程监控）/ htop（增强版）',
            plain: '任务管理器实时版：CPU、内存、各进程占用不停刷新。',
            tips: [
              'top 进入实时监控，默认 3 秒刷新一次',
              'M 按内存排序，P 按 CPU 排序，q 退出',
              'htop 更直观（彩色、可鼠标点、F9 可杀进程）：sudo apt install -y htop',
              'top -n 1 只输出一次，适合写进脚本或日志'
            ],
            rel: ['ps', 'kill', 'wsl_tools'],
            examples: [{
              q: '打开实时进程监控界面（进入后按 q 退出）',
              steps: ['输入 top 回车进入监控界面', '按 P 按 CPU 排序、M 按内存排序', '按 q 退出（装了 htop 也可以直接敲 htop）'],
              answer: 'top',
              accept: ['htop'],
              keywords: ['top']
            }]
          },
          {
            id: 'kill',
            name: 'kill',
            full: 'kill（向进程发送信号 / 结束进程）',
            plain: '点名让某个进程下班。先温和提醒，不听就强制拖走。',
            tips: [
              'kill 进程号 默认发送 TERM(15)，让程序自己体面退出',
              'kill -9 进程号 发送 KILL(9) 强杀，不给清理机会',
              '进程号用 ps aux 或 top 查到（PID 列）',
              '按名字杀：pkill 进程名；killall 进程名',
              '先 15 后 9：直接 -9 可能留下损坏的临时文件或锁'
            ],
            rel: ['ps', 'top_htop', 'pipe'],
            examples: [{
              q: '用 ps 找到名为 sleep 的进程号，并强制结束它（一条命令组合）',
              steps: [
                '先用 ps aux | grep sleep 找到该进程的 PID（第二列）',
                '把 PID 填进 kill -9 后面',
                '若确定只有一个，可用 pkill -9 sleep 一步完成'
              ],
              answer: 'ps aux | grep sleep | awk \'{print $2}\' | xargs kill -9',
              accept: ['pkill -9 sleep', 'kill -9 进程号', 'ps aux | grep sleep | awk \'{print $2}\' | xargs kill -9'],
              keywords: ['kill', '-9'],
              note: '实战中先用 kill PID（TERM）更礼貌，不行再 -9。'
            }],
            children: [{
              id: 'kill_9',
              name: 'TERM 与 -9 的区别',
              full: 'SIGTERM(15) vs SIGKILL(9)',
              plain: 'TERM 是"请你下班"，程序还能保存收尾；KILL 是"直接断电"，谁也拦不住。',
              tips: [
                'SIGTERM(15)：可被程序捕获，做清理后退出（优先使用）',
                'SIGKILL(9)：内核直接杀，程序无法拦截，可能丢数据',
                'SIGINT(2)：等于 Ctrl + C，中断前台程序',
                'SIGHUP(1)：常用于让服务重载配置'
              ],
              rel: ['kill', 'systemctl']
            }]
          },
          {
            id: 'free',
            name: 'free',
            full: 'free（查看内存使用情况）',
            plain: '看内存这台"冰箱"还剩多少空间，-h 让数字变成 1.2G 这种好读的样子。',
            tips: [
              'free -h 以 G/M 为单位显示，可读性最好',
              '重点看 available 列：真正还能用的内存（buff/cache 可回收）',
              'swap 是交换分区，被大量使用说明物理内存不够了',
              '内存 ≠ 磁盘：free 看内存，df 看磁盘'
            ],
            rel: ['df', 'du', 'top_htop'],
            examples: [{
              q: '以人类可读的单位（G/M）查看当前内存使用情况',
              steps: ['free 默认以 KB 显示，数字很长', '-h（human-readable）自动换算单位', '执行 free -h，关注 total 与 available 两列'],
              answer: 'free -h',
              keywords: ['free', '-h']
            }]
          },
          {
            id: 'df',
            name: 'df',
            full: 'disk free（查看磁盘空间使用情况）',
            plain: '看每个分区还剩多少空间——和 Windows 里"清理 C 盘"是同一件事。',
            tips: [
              'df -h 人类可读显示所有挂载点',
              '关注 Use% 列，超过 90% 就该注意了',
              'WSL 里 / 是虚拟磁盘，/mnt/c 才是 Windows 的 C 盘',
              'df -i 查看 inode 占用（文件数太多也会满）'
            ],
            rel: ['du', 'free', 'find'],
            examples: [{
              q: '以人类可读格式查看各分区磁盘占用（含剩余空间和使用率）',
              steps: ['df 列出所有挂载点的磁盘使用情况', '-h 让容量显示成 G/M', '观察 Use% 一列找出快满的分区'],
              answer: 'df -h',
              keywords: ['df', '-h']
            }]
          },
          {
            id: 'du',
            name: 'du',
            full: 'disk usage（统计目录 / 文件占用空间）',
            plain: '称重器：这个文件夹到底吃了我多少 G。',
            tips: [
              'du -sh 目录 汇总显示该目录总大小（s = summarize，h = 可读）',
              'du -h --max-depth=1 . 只看当前目录的直接子目录各占多少',
              '配合排序找大目录：du -h --max-depth=1 . | sort -hr | head',
              'du 慢于 df：它要真的遍历文件，目录越大越慢'
            ],
            rel: ['df', 'find', 'wsl_mnt'],
            examples: [{
              q: '查看当前目录总共占用了多少磁盘空间（只要一个汇总值）',
              steps: ['du 默认逐层输出每个子目录，刷屏很长', '-s 只输出汇总，-h 换算成易读单位', '两者可合并写成 du -sh .'],
              answer: 'du -sh .',
              accept: ['du -sh', 'du -sh ./'],
              keywords: ['du', '-sh']
            }],
            children: [{
              id: 'du_sort',
              name: '找出最占空间的目录',
              full: 'du + sort + head（组合排查）',
              plain: '不许一个个翻：让机器把最大的几个目录排到最前面。',
              tips: [
                'du -h --max-depth=1 . | sort -hr | head -10',
                'sort -hr 中 h 识别 G/M 单位，r 倒序',
                '磁盘告警时先用 df -h 定位分区，再用这条命令定位目录',
                'find . -size +100M 可以精准找大文件'
              ],
              rel: ['du', 'df', 'find']
            }]
          }
        ]
      },
      /* ---------------------------------------------------------------------
       * 分支 6：Day 5 文本处理三剑客
       * ------------------------------------------------------------------ */
      {
        id: 'day5',
        name: 'Day 5 文本三剑客',
        icon: '🔎',
        full: 'grep / sed / awk + Pipe（文本处理三剑客与管道）',
        plain: 'Linux 的看家本领：几百万行日志里，一秒钟捞出你要的那几行，还能顺手改掉、算出统计。',
        tips: [
          '学习命令：grep、sed、awk，以及把命令串起来的管道 |',
          'grep 负责"挑行"，sed 负责"改字"，awk 负责"切列算数"',
          '管道 | 把前一个命令的输出当作后一个命令的输入，可无限拼接'
        ],
        rel: ['day2', 'day6', 'toolchain_combo'],
        children: [
          {
            id: 'pipe',
            name: '管道 |',
            full: 'pipe（管道符）',
            plain: '流水线：上一步的产物直接送到下一步，不必先存成文件。',
            tips: [
              'ls | grep txt —— 只显示名字里带 txt 的',
              'ps aux | grep nginx —— 找 nginx 进程',
              'cat 1.txt | wc -l 与 wc -l < 1.txt 效果类似',
              '可以串很多级：ps aux | grep python | awk \'{print $2}\' | head -n 3',
              '| 只传"标准输出"，报错信息（stderr）需要 2>&1 合并'
            ],
            rel: ['grep', 'awk', 'redirect'],
            examples: [{
              q: '列出当前目录下的文件，并只显示文件名里包含 txt 的那些',
              steps: [
                '先 ls 列出所有文件，输出到屏幕',
                '用 | 把 ls 的输出交给 grep',
                'grep txt 只保留包含 txt 的行'
              ],
              answer: 'ls | grep txt',
              accept: ["ls | grep 'txt'", 'ls | grep "txt"'],
              keywords: ['ls', '|', 'grep', 'txt']
            }]
          },
          {
            id: 'grep',
            name: 'grep',
            full: 'Global Regular Expression Print（全局正则搜索并打印）',
            plain: '筛子：从一大堆文字里，留下符合条件的行。',
            tips: [
              'grep 关键字 文件 —— 在文件里找包含关键字的行',
              'grep -r 关键字 目录 —— 递归搜索整个目录下的所有文件',
              'grep -n 显示行号；grep -i 忽略大小写；grep -v 反向（排除）',
              'grep -c 只输出匹配行数；grep -l 只输出文件名',
              'grep "ERROR\\|WARN" 或 grep -E "ERROR|WARN" 匹配多种情况',
              '常与管道连用：ps aux | grep nginx'
            ],
            rel: ['pipe', 'sed', 'awk'],
            examples: [{
              q: '在当前目录及其所有子目录的文件里，递归搜索包含 hello 的行',
              steps: [
                'grep 默认只搜单个文件或从管道读',
                '-r（recursive）让 grep 遍历目录下所有文件',
                '命令写作 grep -r "hello" .'
              ],
              answer: 'grep -r "hello" .',
              accept: ['grep -r hello .', 'grep -rn hello .'],
              keywords: ['grep', '-r', 'hello']
            }],
            children: [{
              id: 'grep_flags',
              name: 'grep 常用参数',
              full: '-i / -n / -v / -c / -E',
              plain: '五个开关：忽略大小写、带行号、反向排除、只数行数、支持扩展正则。',
              tips: [
                '-i：ignore case 忽略大小写',
                '-n：number 输出行号',
                '-v：invert 反向匹配（排除含关键字的行）',
                '-c：count 只输出匹配的行数',
                '-E：extended regexp，可用 | 表示或；-A2/-B2 显示后/前两行',
                '排查日志常用：grep -n -A2 ERROR app.log'
              ],
              rel: ['grep', 'pipe']
            }]
          },
          {
            id: 'sed',
            name: 'sed',
            full: 'stream editor（流式文本编辑器）',
            plain: '流水线上的修改工：读一行、改一行、传一行，不打开文件也能批量替换。',
            tips: [
              'sed \'s/旧词/新词/\' 文件 —— 只替换每行第一处（屏幕输出，不改源文件）',
              'sed \'s/旧词/新词/g\' 文件 —— g 表示全局替换该行所有匹配',
              'sed -i \'s/旧词/新词/g\' 文件 —— -i 直接写回文件（改动前建议先备份）',
              'sed -n \'2,5p\' 文件 —— 只打印第 2~5 行',
              'sed \'/关键字/d\' 文件 —— 删除包含关键字的行（输出结果里不含）',
              '分隔符可用 | 代替 /：sed \'s|/old/path|/new/path|g\''
            ],
            rel: ['grep', 'awk', 'redirect'],
            examples: [{
              q: '把 1.txt 里的所有 hello 替换成 hi（只在屏幕显示结果，不改动原文件）',
              steps: [
                'sed 的替换语法：sed \'s/旧内容/新内容/修饰符\' 文件名',
                's 表示 substitute 替换',
                '要替换一行中的全部匹配需要加 g 修饰，否则只换第一处；不加 -i 就不会修改源文件'
              ],
              answer: 'sed \'s/hello/hi/g\' 1.txt',
              accept: ['sed "s/hello/hi/g" 1.txt', 'sed \'s|hello|hi|g\' 1.txt'],
              keywords: ['sed', 's/hello/hi/g', '1.txt'],
              note: '想真正修改文件必须加 -i：sed -i \'s/hello/hi/g\' 1.txt（建议先 cp 备份）。'
            }]
          },
          {
            id: 'awk',
            name: 'awk',
            full: 'awk（按列处理文本的语言工具，名称取自三位作者姓氏）',
            plain: '切菜板：按空格把每行切成 $1 $2 $3…几块，想取哪块取哪块，还能求和求平均。',
            tips: [
              'awk \'{print $1}\' 文件 —— 取每行第一列（$0 是整行）',
              '默认以空格 / 制表符为分隔符，可用 -F: 指定冒号等分隔符',
              'awk \'{print $1, $3}\' 输出多列（逗号会变成空格）',
              'awk -F: \'{print $1}\' /etc/passwd 取用户名列表',
              '求和：awk \'{sum+=$1} END {print sum}\' 文件',
              '带条件：awk \'$3 > 100 {print $1}\' 文件'
            ],
            rel: ['pipe', 'grep', 'sed'],
            examples: [{
              q: '只输出 1.txt 每一行的第一列内容',
              steps: [
                'awk 把每行按空白切成若干列，$1 是第一列',
                '{print $1} 表示对每一行执行"打印第一列"',
                '命令写作 awk \'{print $1}\' 1.txt（外层单引号必须保留）'
              ],
              answer: 'awk \'{print $1}\' 1.txt',
              accept: ['awk "{print $1}" 1.txt'],
              keywords: ['awk', 'print $1', '1.txt']
            }],
            children: [{
              id: 'toolchain_combo',
              name: '三剑客组合实战',
              full: 'ps aux | grep | awk（管道组合）',
              plain: '三件工具串起来，才是真正的威力：先列全部、再筛目标、最后只要那一列。',
              tips: [
                'ps aux | grep 程序名 | awk \'{print $2}\' —— 一步拿到进程号',
                '加 | head -n 1 避免 grep 自身也被匹配到',
                'grep 与 awk 都能做筛选，简单过滤用 grep，按列判断用 awk',
                '统计某列之和：... | awk \'{s+=$1} END {print s}\''
              ],
              rel: ['pipe', 'grep', 'awk'],
              examples: [{
                q: '用一条管道命令，找出名为 python 的进程号（只要数字那一列）',
                steps: [
                  'ps aux 列出所有进程，进程号在第 2 列',
                  'grep python 只保留含 python 的行',
                  'awk \'{print $2}\' 取出第 2 列；必要时用 head -n 1 取第一条'
                ],
                answer: "ps aux | grep python | awk '{print $2}'",
                accept: ['ps aux | grep python | awk \'{print $2}\' | head -n 1'],
                keywords: ['ps aux', 'grep', 'python', 'awk', '$2']
              }]
            }]
          }
        ]
      },
      /* ---------------------------------------------------------------------
       * 分支 7：Day 6 查找与压缩备份
       * ------------------------------------------------------------------ */
      {
        id: 'day6',
        name: 'Day 6 查找与压缩备份',
        icon: '🗜️',
        full: 'Find & Archive（文件查找与打包压缩）',
        plain: '找不到文件、要备份目录、要传给别人——这一天是"大扫除 + 打包发货"的技能。',
        tips: [
          '学习命令：find、which、tar（速查表里还有 zip / unzip）',
          'find 按名字、大小、时间找文件；which 找命令装在哪',
          'tar 的 czf 打包 / xzf 解包，是 Linux 最通用的备份格式'
        ],
        rel: ['day4', 'du_sort', 'cheatsheet'],
        children: [
          {
            id: 'find',
            name: 'find',
            full: 'find（按条件查找文件）',
            plain: '整栋楼搜人：按名字搜、按体重（大小）搜、按搬进来时间搜。',
            tips: [
              'find ~ -name "*.txt" —— 在家目录按名字找（通配符要加引号）',
              'find . -size +10M —— 找当前目录下大于 10MB 的文件（大文件清理利器）',
              'find . -type f 只找普通文件，-type d 只找目录',
              'find . -mtime -7 找 7 天内修改过的文件',
              '找到后直接处理：find . -name "*.log" -delete 或 -exec rm {} \\;',
              'find 的结果可以接 xargs：find . -name "*.txt" | xargs wc -l'
            ],
            rel: ['which', 'du_sort', 'grep'],
            examples: [{
              q: '在用户家目录下按名字查找所有 .txt 文件（含子目录）',
              steps: [
                'find 的语法：find 搜索起点 条件 …',
                '-name "*.txt" 按文件名匹配，通配符建议加引号防止被 shell 提前展开',
                '搜索起点用 ~ 表示家目录'
              ],
              answer: 'find ~ -name "*.txt"',
              accept: ['find ~ -name *.txt', 'find /home/$(whoami) -name "*.txt"'],
              keywords: ['find', '-name', '*.txt']
            }],
            children: [{
              id: 'find_size',
              name: 'find -size 找大文件',
              full: 'find -size（按文件大小过滤）',
              plain: '按体重筛人：只把大于 10M 的揪出来，清理磁盘特别有效。',
              tips: [
                'find . -size +10M 大于 10MB（+ 大于，- 小于）',
                '单位：c 字节、k KB、M MB、G GB',
                '配合 du 排序：find . -size +100M -exec du -h {} \\;',
                '清空日志场景：find /var/log -name "*.log" -size +1G'
              ],
              rel: ['find', 'df', 'du_sort']
            }]
          },
          {
            id: 'tar',
            name: 'tar',
            full: 'tape archive（打包归档）',
            plain: '把一堆文件塞进一个箱子（打包），再抽真空（压缩），或反过来拆箱。',
            tips: [
              'tar czf 备份.tar.gz 文件夹 —— c 创建、z 用 gzip 压缩、f 指定文件名',
              'tar xzf 备份.tar.gz —— x 解包、z 解压、f 指定文件',
              'tar tzf 备份.tar.gz —— t 只列出内容，不解包（l 保险动作）',
              '记住口诀：压缩 czf，解压 xzf，查看 tzf（顺序都是 tar 后面的字母）',
              'tar czf 备份.tar.gz 目录 默认包含目录本身，建议先 cd 到上级目录'
            ],
            rel: ['which', 'zip_unzip', 'find'],
            examples: [{
              q: '把文件夹 mydir 打包并压缩成 mydir.tar.gz',
              steps: [
                'tar 的三个关键字母：c（create 创建）、z（gzip 压缩）、f（file 指定文件名）',
                '文件名一般以 .tar.gz 结尾，方便识别',
                '打包完用 tar tzf mydir.tar.gz 检查内容'
              ],
              answer: 'tar czf mydir.tar.gz mydir',
              accept: ['tar -czf mydir.tar.gz mydir', 'tar czvf mydir.tar.gz mydir'],
              keywords: ['tar', 'czf', 'mydir.tar.gz', 'mydir']
            }, {
              q: '把 mydir.tar.gz 解压到当前目录',
              steps: ['解包用 x（extract）替换 c', '保留 z 和 f', '解压前先 tar tzf 看一眼内容更安全'],
              answer: 'tar xzf mydir.tar.gz',
              accept: ['tar -xzf mydir.tar.gz', 'tar xzvf mydir.tar.gz'],
              keywords: ['tar', 'xzf', 'mydir.tar.gz']
            }],
            children: [{
              id: 'zip_unzip',
              name: 'zip / unzip',
              full: 'zip & unzip（与 Windows 通用的压缩格式）',
              plain: '要发给 Windows 同事就用 zip，对方双击就能解。',
              tips: [
                'zip -r 打包.zip 目录 —— -r 递归包含子目录',
                'unzip 打包.zip —— 解压；unzip -l 先看内容',
                'unzip 打包.zip -d 目标目录 —— 解压到指定位置',
                '没装的话：sudo apt install -y zip unzip'
              ],
              rel: ['tar', 'wsl_tools']
            }]
          },
          {
            id: 'which',
            name: 'which',
            full: 'which（查找命令的可执行文件位置）',
            plain: '问"这个工具装在哪"：比如 ls 到底是哪个文件。',
            tips: [
              'which ls 输出 /usr/bin/ls 或 /bin/ls',
              'which python3 which git 可一次问多个',
              'command -v 命令 更通用（shell 内建也能查）',
              '找不到时用 whereis 或 find / -name 命令名 2>/dev/null'
            ],
            rel: ['find', 'tip_help'],
            examples: [{
              q: '查看 ls 这个命令对应的可执行文件在哪个目录',
              steps: ['which 会沿着 PATH 环境变量里的目录查找', '命令：which ls', '输出类似 /usr/bin/ls'],
              answer: 'which ls',
              keywords: ['which', 'ls']
            }]
          }
        ]
      },
      /* ---------------------------------------------------------------------
       * 分支 8：Day 7 写第一个 shell 脚本
       * ------------------------------------------------------------------ */
      {
        id: 'day7',
        name: 'Day 7 Shell 脚本',
        icon: '📜',
        full: 'Bash Shell Script（Shell 脚本编程）',
        plain: '把每天重复敲的一串命令写成文件，以后敲一次就跑完——这就是自动化。7 天里最有成就感的一天。',
        tips: [
          '学习内容：变量、if 判断、for 循环、脚本执行方式',
          '脚本第一行写 #!/bin/bash（shebang），告诉系统用哪个解释器',
          '写完必须 chmod +x 才能 ./脚本名 运行',
          '不会用 vim 就先用 nano 写：Ctrl+O 保存、Ctrl+X 退出'
        ],
        rel: ['day3', 'systemctl', 'cron'],
        children: [
          {
            id: 'script_hello',
            name: '第一个脚本 hi.sh',
            full: 'shell script（以 .sh 结尾的脚本文件）',
            plain: '把"打招呼 + 报时"的命令打包成一个文件，以后一个命令全搞定。',
            tips: [
              'nano hi.sh 创建脚本文件',
              '第一行写 #!/bin/bash，固定写法，别忘了',
              '# 开头是注释，解释器会忽略',
              '写完 chmod +x hi.sh 再 ./hi.sh 运行',
              '命名惯例：脚本以 .sh 结尾，文件名见名知意'
            ],
            rel: ['shell_run', 'shell_var', 'chmod'],
            examples: [{
              q: '用 nano 创建脚本 hi.sh，内容为：打印"你好，Linux！"并显示当前日期（写出运行它的完整命令）',
              steps: [
                'nano hi.sh 新建文件，第一行写 #!/bin/bash',
                '第二行 echo "你好，Linux！"，第三行 date',
                'Ctrl+O 回车保存，Ctrl+X 退出',
                'chmod +x hi.sh 加执行权限，然后 ./hi.sh 运行'
              ],
              answer: 'chmod +x hi.sh && ./hi.sh',
              accept: ['./hi.sh', 'bash hi.sh', 'sh hi.sh', 'chmod +x hi.sh; ./hi.sh'],
              keywords: ['chmod', '+x', './hi.sh'],
              note: '不加 x 权限直接 ./hi.sh 会报 Permission denied；也可以用 bash hi.sh 绕过权限。'
            }],
            children: [{
              id: 'shebang',
              name: '#! 是什么',
              full: 'shebang / hashbang（解释器声明）',
              plain: '脚本的门牌，写着"请用哪位翻译官来执行我"。',
              tips: [
                '#!/bin/bash —— 用 bash 解释执行',
                '#!/usr/bin/env python3 —— 用环境里的 python3 执行',
                '必须是文件第一行、且前面不能有空格，否则不生效',
                '没有 shebang 时，用 bash 脚本 也能跑，但依赖当前 shell'
              ],
              rel: ['script_hello', 'shell_run']
            }]
          },
          {
            id: 'shell_var',
            name: '变量',
            full: 'shell variable（Shell 变量）',
            plain: '给数据贴个标签：name="小明"，之后用 $name 就能取出来。',
            tips: [
              '赋值：name="小明"（等号两边不能有空格！）',
              '取值：echo "你好，$name" 或 ${name}',
              '双引号内变量会展开，单引号内原样输出',
              '可用 $(命令) 把命令结果存进变量：now=$(date)',
              '查看全部变量：set 或 env（局部变量 vs 环境变量）'
            ],
            rel: ['shell_for', 'shell_if', 'echo'],
            examples: [{
              q: '定义变量 name 值为 小明，然后打印"你好，小明"',
              steps: [
                '赋值语法：name=小明（等号两边绝对不能有空格）',
                '取值用 $name，配合 echo 输出',
                '整句：echo "你好，$name"'
              ],
              answer: 'name="小明"; echo "你好，$name"',
              accept: ['name=小明\necho "你好，$name"', 'name="小明"\necho "你好，$name"', 'name=小明; echo "你好，$name"'],
              keywords: ['name=', 'echo', '$name'],
              note: '写成 name = "小明"（带空格）会报 command not found。'
            }]
          },
          {
            id: 'shell_for',
            name: 'for 循环',
            full: 'for loop（Shell 循环语句）',
            plain: '对着清单挨个办：清单里有几个元素，就重复几次。',
            tips: [
              '语法：for i in 1 2 3; do … done（分号或换行分隔）',
              'for i in {1..10}; do echo $i; done —— 输出 1 到 10（bash 扩展）',
              'for f in *.txt; do echo $f; done —— 遍历当前目录所有 txt',
              'seq 1 10 也能生成数字序列：for i in $(seq 1 10); do … done',
              '循环体里注意变量要用 $i，不是 i'
            ],
            rel: ['shell_if', 'shell_var', 'pipe'],
            examples: [{
              q: '写一个 for 循环，输出 1 到 10 这十个数字',
              steps: [
                'for i in 1 2 3 … 10; do 开始循环（大括号写法 {1..10} 更简洁）',
                '循环体里 echo "数字：$i" 输出当前值',
                '最后用 done 结束循环'
              ],
              answer: 'for i in {1..10}; do echo "数字：$i"; done',
              accept: ['for i in 1 2 3 4 5 6 7 8 9 10; do echo "数字：$i"; done', 'for i in $(seq 1 10); do echo "数字：$i"; done'],
              keywords: ['for', 'do', 'done', 'echo']
            }]
          },
          {
            id: 'shell_if',
            name: 'if 判断',
            full: 'if statement（Shell 条件判断）',
            plain: '岔路口：满足条件走这条路，不满足走另一条。',
            tips: [
              '语法：if [ 条件 ]; then … else … fi （中括号两边必须有空格）',
              '[ -f 文件 ] 判断文件是否存在且是普通文件',
              '[ -d 目录 ] 目录是否存在；[ -z "$str" ] 字符串是否为空',
              '[ "$a" -eq "$b" ] 数值比较：-eq 等、-ne 不等、-gt 大于、-lt 小于',
              'fi 是 if 反过来写，表示结束，别漏'
            ],
            rel: ['shell_for', 'shell_var', 'script_hello'],
            examples: [{
              q: '写一个判断：如果文件 /etc/hosts 存在就输出"文件存在"，否则输出"文件不存在"',
              steps: [
                'if [ -f /etc/hosts ]; then 判断是否是普通文件',
                'then 后面写存在的分支 echo "文件存在"',
                'else 分支 echo "文件不存在"，最后 fi 结束'
              ],
              answer: 'if [ -f /etc/hosts ]; then echo "文件存在"; else echo "文件不存在"; fi',
              accept: ['if [ -f /etc/hosts ]; then\n  echo "文件存在"\nelse\n  echo "文件不存在"\nfi'],
              keywords: ['if', '-f', '/etc/hosts', 'then', 'fi']
            }]
          },
          {
            id: 'shell_run',
            name: '运行脚本',
            full: 'chmod +x && ./script.sh（执行方式）',
            plain: '钥匙（x 权限）+ 门牌（./）= 脚本能跑起来。',
            tips: [
              './hi.sh 在当前目录执行（必须带 ./，否则会去 PATH 里找）',
              'bash hi.sh 用指定解释器执行，不需要 x 权限',
              'source hi.sh 或 . hi.sh 在当前 shell 里执行（能影响当前环境变量）',
              'Permission denied → chmod +x；找不到命令 → 忘了写 ./',
              'bash -x hi.sh 可打印每条命令的执行过程，调试神器'
            ],
            rel: ['script_hello', 'chmod', 'shebang'],
            examples: [{
              q: '给 hi.sh 加上执行权限并在当前目录运行它',
              steps: ['chmod +x hi.sh 先加可执行权限', './hi.sh 用相对路径执行', '两个命令可用 && 连起来，前一个成功才执行后一个'],
              answer: 'chmod +x hi.sh && ./hi.sh',
              accept: ['chmod +x hi.sh; ./hi.sh'],
              keywords: ['chmod +x', './hi.sh']
            }]
          }
        ]
      },
      /* ---------------------------------------------------------------------
       * 分支 9：速查表 · 学习资源 · 新手小贴士
       * ------------------------------------------------------------------ */
      {
        id: 'cheatsheet',
        name: '速查表 & 学习资源',
        icon: '📋',
        full: 'Cheat Sheet & Learning Resources',
        plain: '贴在墙上的命令清单 + 免费练手网站 + 新手最容易踩的坑，随时回来翻。',
        tips: [
          '命令不用背，用得多了自然记住；记不住就查速查表或用 man',
          '练手首选 OverTheWire Bandit（闯关式 SSH 练习）',
          'WSL 本身就是最好的练习场，装坏了 wsl --unregister 重来'
        ],
        rel: ['day1', 'tip_help', 'bandit'],
        children: [
          {
            id: 'cheat_sheet',
            name: '常用命令速查表',
            full: 'command cheat sheet（按分类记忆）',
            plain: '按用途把命令分格子贴好：找目录的、看文件的、管进程的、处理文本的。',
            tips: [
              '目录：pwd / ls / cd / mkdir / rmdir',
              '文件：touch / rm / cp / mv',
              '查看：cat / less / head / tail；编辑：nano / vim',
              '权限：chmod / chown / sudo',
              '进程：ps / top / htop / kill',
              '系统：df / du / free',
              '文本：grep / sed / awk；查找：find / which',
              '压缩：tar / zip；网络：ping / curl / wget',
              '帮助：man 命令 / 命令 --help'
            ],
            rel: ['day1', 'day5', 'tip_help'],
            examples: [{
              q: '不记得 mkdir 的用法时，怎样在终端里查看它的帮助文档（写出命令）',
              steps: [
                'man 是最完整的命令手册：man mkdir',
                '进入后空格翻页、/ 搜索、q 退出',
                '想快速看参数就用 mkdir --help'
              ],
              answer: 'man mkdir',
              accept: ['mkdir --help', 'mkdir -h'],
              keywords: ['man', 'mkdir']
            }]
          },
          {
            id: 'tips',
            name: '新手小贴士',
            full: 'tips for beginners（避坑指南）',
            plain: '前人的血泪经验：知道这些，能少踩一半的坑。',
            tips: [
              '密码输入不回显是正常现象，不是卡住了',
              'Linux 删除没有回收站，rm 前想清楚',
              '每天 30 分钟 > 周末 5 小时，贵在坚持',
              '遇到报错先读报错信息，关键词直接搜'
            ],
            rel: ['tip_norecycle', 'tip_help', 'tip_wsl_reenter'],
            children: [{
              id: 'tip_norecycle',
              name: '删除没有回收站',
              full: 'no recycle bin（rm 不可恢复）',
              plain: 'Windows 删东西先进回收站，Linux 直接扬了。',
              tips: [
                'rm -rf 不可撤销，重要文件先 tar 备份',
                '想安全一点：先 mv 到 ~/trash，定期清理',
                '装 trash-cli 后可用 trash-put / trash-list 模拟回收站'
              ],
              rel: ['rm', 'rm_rf', 'tar']
            }, {
              id: 'tip_help',
              name: 'man / --help',
              full: 'manual page（手册页）',
              plain: '命令的说明书：忘了参数就翻它，比背下来可靠。',
              tips: [
                'man 命令 打开完整手册（q 退出）',
                '命令 --help 输出精简用法摘要',
                'man -k 关键词 搜索相关命令（相当于搜手册索引）',
                'info 命令 是另一种文档格式，内容有时更详细'
              ],
              rel: ['cheat_sheet', 'which']
            }, {
              id: 'tip_wsl_reenter',
              name: '随时回到 Linux',
              full: 'wsl（在 Windows 中进入 Linux）',
              plain: 'Windows 里任何地方敲 wsl 就能回到 Ubuntu，不用重装。',
              tips: [
                'Win + R 输入 wsl 回车即可进入',
                '在 Windows 资源管理器地址栏输入 \\\\wsl$ 可直接看到 Linux 文件',
                'wsl --shutdown 关闭所有实例；wsl --list --verbose 看状态',
                'VS Code 装 WSL 插件后可直接连进 Linux 编辑文件'
              ],
              rel: ['wsl_mnt', 'env']
            }]
          },
          {
            id: 'resources',
            name: '学习资源',
            full: 'free learning resources（免费练手资源）',
            plain: '光看不练假把式：找一个能真敲命令的地方，边闯关边学。',
            tips: [
              'OverTheWire Bandit：SSH 连真实服务器闯关，强烈推荐',
              'Linux Journey：图文教程 + 页面内练习终端，能被翻译成中文',
              '菜鸟教程 / 阮一峰 Bash 脚本教程：查命令、学语法',
              '你机器上的 WSL 就是最好的练习场，随便折腾'
            ],
            rel: ['bandit', 'linuxjourney', 'cheatsheet'],
            children: [{
              id: 'bandit',
              name: 'OverTheWire Bandit',
              full: 'OverTheWire Bandit Wargame（闯关式 Linux 练习）',
              plain: '游戏化练手：每关一个密码，靠命令找到下一关的钥匙，越玩越上瘾。',
              tips: [
                '网址：overthewire.org/wargames/bandit',
                '第一关：ssh bandit0@bandit.labs.overthewire.org -p 2220（密码 bandit0）',
                'SSH 首次连接会问 yes/no，输入 yes 回车',
                '每关破解后得到下一关密码，建议边看 man 边试',
                '目标：先通关前 5 关'
              ],
              rel: ['resources', 'linuxjourney', 'day1'],
              examples: [{
                q: '用 SSH 连接 Bandit 第一关服务器（用户 bandit0，端口 2220）',
                steps: [
                  '语法：ssh 用户名@主机 -p 端口',
                  '用户名 bandit0，主机 bandit.labs.overthewire.org，端口 2220',
                  '密码是 bandit0（输入时不显示）'
                ],
                answer: 'ssh bandit0@bandit.labs.overthewire.org -p 2220',
                keywords: ['ssh', 'bandit0@bandit.labs.overthewire.org', '2220']
              }]
            }, {
              id: 'linuxjourney',
              name: 'Linux Journey',
              full: 'linuxjourney.com（图文互动教程）',
              plain: '像连环画一样的 Linux 教程，网页里自带练习终端，可以边看边敲。',
              tips: [
                '网址：linuxjourney.com',
                '章节顺序：Grasshopper（入门）→ Journeyman → Networking',
                '页面内可直接练习命令，不用自己装环境'
              ],
              rel: ['resources', 'bandit']
            }]
          }
        ]
      },
      /* ---------------------------------------------------------------------
       * 分支 10：进阶方向（学完 7 天之后）
       * ------------------------------------------------------------------ */
      {
        id: 'next',
        name: '进阶方向',
        icon: '🚀',
        full: 'Next Steps（学完 7 天之后往哪走）',
        plain: '入门之后有两条主线：让服务长期跑（systemctl）＋ 把环境装进容器（Docker）。',
        tips: [
          '顺序建议：Shell 脚本进阶 → 服务管理 systemctl → 网络配置 → Docker',
          '每步都在 WSL 里能练，不用买服务器',
          '学完可以试着用脚本 + 定时任务做一个"每日自动备份"'
        ],
        rel: ['day7', 'docker', 'systemctl'],
        children: [
          {
            id: 'systemctl',
            name: 'systemctl',
            full: 'system control（systemd 服务管理）',
            plain: '给服务当"开关 + 遥控器"：开机自启、启动、停止、看状态、看日志。',
            tips: [
              'systemctl status nginx 查看服务状态',
              'systemctl start / stop / restart 服务名',
              'systemctl enable 服务名 设为开机自启（disable 取消）',
              'systemctl list-units --type=service 列出所有服务',
              '看日志：journalctl -u 服务名 -f（Ctrl+C 退出）',
              'WSL 默认没开 systemd，需在 /etc/wsl.conf 里加 [boot] systemd=true 后 wsl --shutdown 重启'
            ],
            rel: ['kill_9', 'docker', 'next'],
            children: [{
              id: 'cron',
              name: 'crontab 定时任务',
              full: 'cron table（定时任务表）',
              plain: '闹钟：每天几点自动跑你的备份脚本，不用人盯着。',
              tips: [
                'crontab -e 编辑当前用户的定时任务，crontab -l 查看',
                '格式：分 时 日 月 周 命令，例如 0 3 * * * /home/me/backup.sh',
                '0 3 * * * 表示每天 03:00 执行',
                '脚本内路径建议写绝对路径，cron 环境变量很少'
              ],
              rel: ['systemctl', 'day7', 'tar']
            }]
          },
          {
            id: 'network',
            name: '网络排查',
            full: 'ping / curl / wget（网络连通与下载）',
            plain: '网络出问题时：先 ping 通不通，再 curl 看返回，最后 wget 下东西。',
            tips: [
              'ping -c 4 baidu.com 发 4 个包测连通（Ctrl+C 停止持续 ping）',
              'curl -I https://example.com 只看响应头',
              'curl -o 文件 URL 下载；wget URL 也是下载',
              'curl ifconfig.me 查看自己的公网 IP',
              'WSL 与 Windows 共享网络，端口一般可直接互访'
            ],
            rel: ['next', 'wsl_tools', 'cheatsheet'],
            examples: [{
              q: '用 curl 下载 https://example.com/index.html 并保存为 index.html',
              steps: ['curl 默认把内容输出到屏幕', '-o 参数指定保存的文件名', '命令：curl -o index.html https://example.com/index.html'],
              answer: 'curl -o index.html https://example.com/index.html',
              accept: ['wget https://example.com/index.html', 'curl -O https://example.com/index.html'],
              keywords: ['curl', '-o', 'index.html']
            }]
          },
          {
            id: 'docker',
            name: 'Docker',
            full: 'Docker（容器化）',
            plain: '把"软件 + 依赖 + 配置"打包成一个盒子，到哪台机器上都能一模一样地跑。',
            tips: [
              'docker ps 看运行中的容器，docker ps -a 看全部',
              'docker images 看本地镜像，docker pull nginx 拉镜像',
              'docker run -d -p 8080:80 nginx 后台运行并映射端口',
              'docker exec -it 容器名 bash 进入容器内部',
              'docker logs -f 容器名 看日志（对应 Day2 的 tail -f 思路）',
              'WSL2 是 Docker Desktop 的默认后端，本机就能练'
            ],
            rel: ['next', 'systemctl', 'day4']
          }
        ]
      },
      // —— 一级分支结束 ——





    ]
  };
  /* ===========================================================================
   *  数据加工层：把嵌套树摊平成索引，供 galaxy / lesson / quiz / chat 使用
   * ======================================================================== */

  /**
   * 递归摊平知识树
   * @param {Object} node 当前节点
   * @param {string|null} parentId 父节点 id
   * @param {number} depth 层级（0=核心，1=一级分支，2=知识点，3=细节）
   * @param {string|null} branchId 所属一级分支 id
   * @param {Array} out 收集结果
   */
  function flatten(node, parentId, depth, branchId, out) {
    var branch = depth === 1 ? node.id : (branchId || node.id);
    node.parent = parentId;
    node.level = depth;
    node.branch = branch;
    node.children = node.children || [];
    node.tips = node.tips || [];
    node.rel = node.rel || [];
    // 例题补齐默认字段（id 用于记录每题的对错次数）
    node.examples = (node.examples || []).map(function (ex, i) {
      return {
        id: ex.id || (node.id + '#' + (i + 1)),
        nodeId: node.id,
        q: ex.q,
        steps: ex.steps || [],
        answer: ex.answer,
        accept: ex.accept || [],
        keywords: ex.keywords || [],
        note: ex.note || '',
        // 可选：指向沙盒工作区预设（home / files / text / perm / script），
        // 例题卡片上的「▶ 沙盒运行」按钮会按它加载对应目录结构
        sandbox: ex.sandbox || null
      };
    });
    out.push(node);
    node.children.forEach(function (child) {
      flatten(child, node.id, depth + 1, node.branch, out);
    });
    return out;
  }

  var nodes = [];
  var byId = {};

  /**
   * 重建全部索引。
   * flatten() 是幂等的（重复执行只会覆盖 parent/level/branch/example 字段），
   * 因此外部通过 addBranch / addChildren 追加内容后，重跑一次即可。
   */
  function rebuild() {
    nodes = flatten(TREE, null, 0, null, []);
    byId = {};
    nodes.forEach(function (n) { byId[n.id] = n; });
    // 回填分支名（徽章与进度统计需要）
    nodes.forEach(function (n) {
      n.branchName = (byId[n.branch] || n).name;
    });
    Data.nodes = nodes;
    Data.byId = byId;
    return nodes.length;
  }

  var Data = {
    meta: META,
    root: TREE,
    nodes: nodes,
    byId: byId,

    /** 按 id 取节点 */
    get: function (id) { return byId[id] || null; },

    /** 子节点 */
    children: function (id) {
      var n = byId[id];
      return n ? n.children : [];
    },

    /** 面包屑：从核心节点到目标节点的完整路径 */
    pathOf: function (id) {
      var path = [];
      var cur = byId[id];
      while (cur) {
        path.unshift(cur);
        cur = cur.parent ? byId[cur.parent] : null;
      }
      return path;
    },

    /** 10 个一级分支 */
    branches: function () { return TREE.children; },

    /** 参与进度统计的节点（一级 + 二级） */
    learnable: function () {
      return nodes.filter(function (n) { return n.level === 1 || n.level === 2; });
    },

    /** 全部例题（扁平数组） */
    examples: function () {
      var out = [];
      nodes.forEach(function (n) { out = out.concat(n.examples); });
      return out;
    },

    /** 某节点的例题 */
    examplesOf: function (id) {
      var n = byId[id];
      return n ? n.examples : [];
    },

    /**
     * 智能关联推荐
     * 优先级：显式 rel 关联 → 同父兄弟 → 同分支其他知识点
     */
    relatedOf: function (id, limit) {
      var node = byId[id];
      if (!node) return [];
      limit = limit || 6;
      var picked = [];
      var seen = {};
      seen[id] = true;

      function push(x) {
        if (!x || seen[x.id] || picked.length >= limit) return;
        seen[x.id] = true;
        picked.push(x);
      }

      (node.rel || []).forEach(function (rid) { push(byId[rid]); });

      var siblings = node.parent ? (byId[node.parent] || TREE).children : TREE.children;
      siblings.forEach(push);

      nodes.forEach(function (n) {
        if (n.branch === node.branch && n.level >= 1 && n.level <= 2) push(n);
      });

      return picked;
    },

    /**
     * 关键词搜索：命中名称 / 全称 / 通俗说明 / 要点，按相关度排序
     * @return {Array} 节点数组
     */
    search: function (q) {
      var kw = String(q || '').trim().toLowerCase();
      if (!kw) return [];
      var scored = [];
      nodes.forEach(function (n) {
        var name = (n.name || '').toLowerCase();
        var full = (n.full || '').toLowerCase();
        var plain = (n.plain || '').toLowerCase();
        var tips = (n.tips || []).join(' ').toLowerCase();
        var score = 0;
        if (name === kw) score += 100;
        else if (name.indexOf(kw) === 0) score += 60;
        else if (name.indexOf(kw) >= 0) score += 40;
        if (full.indexOf(kw) >= 0) score += 20;
        if (plain.indexOf(kw) >= 0) score += 10;
        if (tips.indexOf(kw) >= 0) score += 5;
        if (score > 0) scored.push({ node: n, score: score - n.level * 2 });
      });
      scored.sort(function (a, b) { return b.score - a.score; });
      return scored.map(function (s) { return s.node; });
    },

    /** 全站统计（调试与页脚展示用） */
    stats: function () {
      var levels = [0, 0, 0, 0, 0];
      nodes.forEach(function (n) { levels[n.level] = (levels[n.level] || 0) + 1; });
      return { total: nodes.length, levels: levels, examples: Data.examples().length };
    }
  };

  /* ===========================================================================
   *  内容扩展 API（供 js/data/ext-*.js 使用）
   *
   *  刻意把内容拆成多个文件：knowledge.js 放主干与核心命令，
   *  ext-*.js 按主题补充进阶知识点。这样单个文件不会无限膨胀，
   *  也方便按主题增删内容 —— 改完刷新页面即可生效，全程无需构建。
   * ======================================================================== */

  /** 过滤掉 id 已存在的节点，避免重复内容破坏索引 */
  function uniqueKids(list) {
    return (list || []).filter(function (k) { return k && k.id && !byId[k.id]; });
  }

  /**
   * 追加一个一级分支（主题）
   * @param {Object} branch 分支对象（结构同 TREE.children 的元素）
   * @param {string} [afterId] 插到哪个分支后面；省略则追加到末尾
   * @return {boolean} 是否成功（id 重复会返回 false）
   */
  Data.addBranch = function (branch, afterId) {
    if (!branch || !branch.id || byId[branch.id]) return false;
    var list = TREE.children;
    var at = -1;
    if (afterId) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].id === afterId) { at = i; break; }
      }
    }
    if (at >= 0) list.splice(at + 1, 0, branch);
    else list.push(branch);
    rebuild();
    return true;
  };

  /**
   * 追加二级知识点到已有节点
   * @param {string} parentId 父节点 id
   * @param {Array|Object} kids 一个或多个知识点对象
   * @return {number} 实际加入的数量
   */
  Data.addChildren = function (parentId, kids) {
    var parent = byId[parentId];
    if (!parent) return 0;
    var list = uniqueKids([].concat(kids || []));
    parent.children = parent.children || [];
    list.forEach(function (k) { parent.children.push(k); });
    if (list.length) rebuild();
    return list.length;
  };

  /**
   * 给已有知识点追加例题（不改变节点结构，因此无需重建索引）
   * @param {string} nodeId 知识点 id
   * @param {Array|Object} list 一道或多道例题
   * @return {number} 实际加入的数量
   */
  Data.addExamples = function (nodeId, list) {
    var node = byId[nodeId];
    if (!node) return 0;
    var base = node.examples.length;
    var added = 0;
    [].concat(list || []).forEach(function (ex) {
      if (!ex || !ex.answer) return;
      node.examples.push({
        id: ex.id || (nodeId + '#' + (base + added + 1)),
        nodeId: nodeId,
        q: ex.q,
        steps: ex.steps || [],
        answer: ex.answer,
        accept: ex.accept || [],
        keywords: ex.keywords || [],
        note: ex.note || '',
        sandbox: ex.sandbox || null
      });
      added += 1;
    });
    return added;
  };

  /** 数据版本（排查浏览器缓存时用） */
  Data.version = '2.0';

  rebuild();

  // 挂到全局命名空间（刻意不用 ES Module，保证 file:// 双击也能运行）
  var LX = global.LX = global.LX || {};
  LX.Data = Data;
})(window);
