/* =============================================================================
 * js/data/ext-terminal.js
 * -----------------------------------------------------------------------------
 * 内容扩展：一级分支「终端与 Shell 基础」（插在"环境搭建"之后）
 *
 * 为什么单独开一个分支：
 *   Day1~Day7 全都在敲命令，但"命令由哪几部分组成""引号有什么讲究"
 *   "PATH 到底是什么"这类底层认知如果缺了，学起来就变成背单词。
 *   这一节是整张地图的语法地基，先看它，后面 7 天会顺很多。
 *
 * 新增方式：LX.Data.addBranch(分支对象, '插在哪个分支后面')
 *   —— 追加后 knowledge.js 会自动重建索引，星图/目录/进度全部即时生效。
 * ========================================================================== */
(function (global) {
  'use strict';

  var Data = global.LX && global.LX.Data;
  if (!Data) return;

  Data.addBranch({
    id: 'term',
    name: '终端与 Shell 基础',
    icon: '⌨️',
    full: 'Terminal & Shell Fundamentals（bash 命令行基础）',
    plain: '终端是"窗口"，Shell（bash）是坐在窗口里听你说话的翻译官：你敲一行字，它先拆成"命令 + 选项 + 参数"，再交给内核执行。把这层语法搞明白，后面 7 天就不是背命令，而是看懂命令。',
    tips: [
      '命令三段式：命令 选项 参数（例：ls -l /home）',
      'Tab 补全、↑ 翻历史、Ctrl+R 搜历史 —— 熟练后打字量能少一半',
      '拿不准用法：man 命令 或 命令 --help（前者详细，后者速查）',
      '通配符 * 是 Shell 先展开再交给命令的，加了引号就不会展开 —— 新手最容易踩的坑'
    ],
    rel: ['term_basics', 'term_glob', 'term_redirect', 'day1'],
    children: [
      {
        id: 'term_basics',
        name: '命令的三段式',
        full: 'command [options] [arguments]（命令 / 选项 / 参数）',
        plain: '一条命令就像一句"快递单"：命令是动作（寄件），选项是备注（加急、保价），参数是地址（寄给谁）。顺序固定为 命令 → 选项 → 参数。',
        tips: [
          '短选项用单横线：-l -a -h；长选项用双横线：--help --color',
          '短选项可合并：-la 等价于 -l -a，顺序无关，ls -al 也一样',
          '长选项要写全，或者用等号带值：--block-size=1M',
          '命令、选项、参数之间必须有空格（少一个空格就报 command not found）',
          '参数可以是路径、文件名、用户名、数字……取决于命令本身'
        ],
        rel: ['term_help', 'ls', 'day1'],
        examples: [{
          q: '用一条命令：列出当前目录全部文件（含隐藏文件），并显示详细信息',
          steps: [
            '需要"全部"，也就是包含以 . 开头的隐藏文件 → 选项 -a',
            '需要"详细信息"（权限、大小、时间）→ 选项 -l',
            '两个短选项可以合并写在一起，再省一个字符',
            '最后不写参数，默认就是当前目录'
          ],
          answer: 'ls -la',
          accept: ['ls -al', 'ls -a -l', 'ls -l -a'],
          keywords: ['ls', '-a', '-l'],
          note: 'ls -la 与 ls -al 完全等价；选项顺序不影响结果，这是 Linux 的通用习惯。',
          sandbox: 'files'
        }, {
          q: '在终端里查看 /etc 目录的内容，并按修改时间从新到旧排序',
          steps: [
            '命令用 ls，参数是 /etc',
            '按时间排序用 -t（time），要"从新到旧"就保持默认，加 -r 才反过来',
            '想要看得清楚，把 -l 也加上'
          ],
          answer: 'ls -lt /etc',
          accept: ['ls -tl /etc', 'ls -l -t /etc'],
          keywords: ['ls', '-t', '/etc'],
          note: '-t 是新到旧，-r 是反转，所以"最旧的在前"是 ls -ltr。'
        }]
      },
      {
        id: 'term_help',
        name: '求助三件套 man / --help',
        full: 'manual / type / which（查手册、查命令来源）',
        plain: '记不住参数不用背：Linux 自带说明书。man 是厚手册，--help 是便利贴，type 告诉你这个命令到底是程序、别名还是内置命令。',
        tips: [
          'man ls：完整的官方手册，按 q 退出，/关键词 搜索',
          'ls --help：只用一屏，列出常用选项，适合快速翻',
          'type ls：告诉你是内置命令、别名还是某个路径下的可执行文件',
          'which ls：只回答"可执行文件在哪"，别名查不到',
          'apropos 关键词 / man -k 关键词：不知道命令名时反向搜索',
          'man 手册的分节：1 用户命令、5 配置文件格式、8 系统管理'
        ],
        rel: ['which', 'term_basics', 'cheat_sheet'],
        examples: [{
          q: '打开 ls 的完整官方手册',
          steps: ['man 是 manual（手册）的缩写', '后面直接跟要查的命令名，不加横线'],
          answer: 'man ls',
          keywords: ['man', 'ls'],
          note: '手册是分页器（less）打开的：空格翻页、/ 搜索、q 退出。',
          sandbox: 'files'
        }, {
          q: '不打开手册，用最快的方式看 ls 支持哪些选项',
          steps: ['几乎所有 GNU 命令都支持 --help 长选项', '输出比 man 短得多，一屏就能看完常用选项'],
          answer: 'ls --help',
          keywords: ['ls', '--help'],
          note: '--help 看"有哪些选项"，man 看"每个选项的准确含义和边界情况"。'
        }, {
          q: '确认 ls 这个命令到底是别名还是真正的程序',
          steps: ['用 type 检查命令类型', '如果输出 alias ls=\'ls --color=auto\'，说明它被设成了别名'],
          answer: 'type ls',
          accept: ['type -a ls'],
          keywords: ['type', 'ls'],
          note: '很多发行版默认给 ls 加了颜色别名，所以你在终端看到的带色输出，脚本里往往没有。'
        }]
      },
      {
        id: 'term_history',
        name: 'Tab 补全与历史命令',
        full: 'tab completion / history / reverse search（补全与历史）',
        plain: '终端最省力的两个功能：Tab 帮你把路径补完（不用怕打错），历史帮你把上次的命令捞回来（不用重打）。',
        tips: [
          '按 Tab：唯一匹配时直接补全，多个匹配时补到公共前缀',
          '连按两次 Tab：把所有候选列出来',
          '↑ / ↓：上下翻历史命令；history：列出全部历史（默认 1000 条）',
          '!编号 重新执行历史里的第 N 条；!! 重做上一条；!$ 取上一条命令的最后一个参数',
          'Ctrl + R：进入反向搜索，输入片段即可找到历史命令，回车执行、Ctrl+G 取消',
          'history -c 清空本次会话历史（想彻底清空还需删除 ~/.bash_history）'
        ],
        rel: ['term_keys', 'term_basics', 'shell_var'],
        examples: [{
          q: '列出你最近执行过的 10 条命令',
          steps: ['history 会输出带编号的历史列表', '直接跟数字 N 表示"只看最近 N 条"'],
          answer: 'history 10',
          keywords: ['history', '10'],
          note: '想重新执行第 3 条，敲 !3 回车即可；想找包含 tar 的历史命令，Ctrl+R 然后输入 tar。',
          sandbox: 'home'
        }, {
          q: '上一条命令打错了路径，重新执行一遍（不要重打整行）',
          steps: ['!! 代表"上一条命令"', '直接回车就会再执行一次', '配合 sudo 时常用：sudo !! 表示"上一条命令用管理员再跑一遍"'],
          answer: '!!',
          keywords: ['!!'],
          note: '!! 在脚本里不可用，它只属于交互式 Shell。'
        }]
      },
      {
        id: 'term_keys',
        name: '终端快捷键',
        full: 'keyboard shortcuts（Ctrl 组合键）',
        plain: '命令行里 Ctrl 键是"万能方向盘"：中断、清屏、跳到行首、删掉半行……学会这几个，改命令比用鼠标快十倍。',
        tips: [
          'Ctrl + C：中断当前正在跑的命令（最常用，卡住了就按它）',
          'Ctrl + D：发送 EOF，等于"退出"（退出 Python/SSH 会话、空行按它退出终端）',
          'Ctrl + L：清屏（等价于 clear 命令，但不会清掉历史）',
          'Ctrl + A / Ctrl + E：光标跳到行首 / 行尾',
          'Ctrl + U / Ctrl + K：删掉光标前 / 后的全部内容；Ctrl + W：删掉前一个单词',
          'WSL / Windows Terminal 里：复制是 Ctrl+Shift+C，粘贴是 Ctrl+Shift+V（不是 Ctrl+C/V）'
        ],
        rel: ['term_history', 'term_basics', 'kill'],
        examples: [{
          q: '把当前终端屏幕清空（用命令的方式）',
          steps: ['命令是 clear（清屏）', '快捷键 Ctrl + L 效果相同，而且不产生任何命令历史'],
          answer: 'clear',
          keywords: ['clear'],
          note: 'clear 只是把内容顶上去，向上滚动仍能看到之前的输出；想连滚动缓冲一起清掉可按 Ctrl+L 后再清一次。',
          sandbox: 'home'
        }, {
          q: '有一条命令一直在刷屏，怎么让它停下来？',
          steps: ['不要关窗口，也不要等它自己结束', '按 Ctrl + C 发送中断信号（SIGINT），进程会立刻终止', '如果按了没反应，说明它在内核态或忽略信号，需要另开终端 kill 掉'],
          answer: 'Ctrl + C',
          accept: ['ctrl+c', 'Ctrl-C', 'ctrl c'],
          keywords: ['ctrl', 'c'],
          note: 'Ctrl + C 是"礼貌地打断"，Ctrl + Z 是"挂起"（进程暂停在后台，可用 fg 恢复）。'
        }]
      },
      {
        id: 'term_glob',
        name: '通配符（Glob）',
        full: 'wildcard / globbing（* ? [abc] {a,b}）',
        plain: '通配符是 Shell 的"模糊匹配"：* 代表任意多个字符，? 代表一个字符。注意它是 Shell 先展开成真实文件名，再交给命令的 —— 所以命令根本没见过 *。',
        tips: [
          '* 匹配任意长度（包括 0 个）字符；? 匹配恰好一个字符',
          '[abc] 匹配方括号里的任意一个字符；[0-9] 匹配一个数字区间',
          '{a,b,c} 是"大括号展开"，会直接列出所有组合，如 cp a.txt{,.bak}',
          '通配符不匹配以 . 开头的隐藏文件（除 .* 这种写法）',
          '没有匹配项时，bash 默认把 * 原样传给命令（zsh 会报错，注意区别）',
          '通配符由 Shell 展开，所以 ls *.txt 里 ls 收到的其实是文件名列表'
        ],
        rel: ['term_quote', 'rm', 'find'],
        examples: [{
          q: '列出当前目录下所有以 .txt 结尾的文件',
          steps: ['用通配符 * 表示"任意前缀"', '后面接固定的 .txt 后缀', 'Shell 先把它展开成真实文件名，再交给 ls'],
          answer: 'ls *.txt',
          keywords: ['ls', '*.txt'],
          note: '如果目录里没有 .txt 文件，ls 会报 No such file or directory —— 说明通配符没匹配到任何东西。',
          sandbox: 'files'
        }, {
          q: '备份 practice 目录下的 notes.txt，得到 notes.txt.bak（一条命令）',
          steps: ['目标文件名 = 原名 + .bak', '大括号展开 {,.bak} 会生成两个名字：原样和带 .bak 的', '配合 cp 就能一次完成复制'],
          answer: 'cp notes.txt{,.bak}',
          accept: ['cp notes.txt notes.txt.bak'],
          keywords: ['cp', 'notes.txt', '.bak'],
          note: '{,.bak} 里逗号左边是空的，所以第一个参数仍是 notes.txt；这种写法在脚本里很常用。',
          sandbox: 'files'
        }]
      },
      {
        id: 'term_quote',
        name: '引号与转义',
        full: 'single / double quotes & escaping（\' \' " " \\ $()）',
        plain: '引号的作用是"把一堆带空格的文字打包成一个参数"，同时决定变量要不要展开：单引号最忠实（原样照抄），双引号会翻译 $变量，反斜杠负责转义单个字符。',
        tips: [
          '单引号 \'...\'：里面的一切都是字面量，变量、通配符都不解释',
          '双引号 "..."：会展开 $变量 和 $(命令)，是最常用的写法',
          '如果文件名带空格，必须加引号：cd "My Documents"',
          '反斜杠 \\ 转义下一个字符：echo \\$HOME 输出 $HOME 本身',
          '$(命令) 是命令替换，会把命令输出接到当前位置（比反引号 `...` 更清晰）',
          '字符串里想包含单引号，用 \'"\'"\' 或者改用双引号包外层'
        ],
        rel: ['term_glob', 'term_env', 'shell_var'],
        examples: [{
          q: '输出字面量 $HOME（不要让它变成 /home/student）',
          steps: ['要阻止变量展开，用单引号包住', '单引号内的 $ 没有任何特殊含义'],
          answer: "echo '$HOME'",
          accept: ['echo \\$HOME', 'echo \\$HOME'],
          keywords: ['echo', '$HOME'],
          note: '双引号 echo "$HOME" 会输出 /home/student，单引号才是字面量 —— 判分不区分引号写法时会看你的思路关键词。',
          sandbox: 'home'
        }, {
          q: '输出一句问候，把当前用户名嵌进去，例如 hello student',
          steps: ['变量 $USER 保存当前用户名', '双引号内变量会被展开', '注意引号要成对，且双引号内不要再用单引号包变量'],
          answer: 'echo "hello $USER"',
          accept: ['echo "hello ${USER}"', 'echo hello $USER'],
          keywords: ['echo', 'hello', '$USER'],
          note: '${USER} 是保险写法：当变量后面紧跟英文字母时（如 $USER_name 会被当成变量 USER_name），加花括号才不会歧义。',
          sandbox: 'home'
        }]
      },
      {
        id: 'term_env',
        name: '环境变量与 PATH',
        full: 'environment variables（PATH / HOME / USER / export）',
        plain: '环境变量是 Shell 传给所有程序的"便签"：HOME 告诉你家在哪，PATH 告诉系统去哪找命令。命令提示 command not found，八成就是 PATH 里没有它。',
        tips: [
          '查看全部变量：env 或 printenv；只看一个：echo $PATH',
          'PATH 用冒号分隔多个目录，系统按从左到右的顺序查找可执行文件',
          'export 把变量"导出"给子进程（脚本、程序都能读到）；不加 export 只是当前 Shell 的局部变量',
          '临时给一条命令加变量：LANG=C ls（只对该条命令生效）',
          '想让变量永久生效：写进 ~/.bashrc，然后 source ~/.bashrc',
          '常用内置变量：$HOME 家目录、$USER 用户名、$PWD 当前目录、$? 上条命令退出码、$$ 当前进程号'
        ],
        rel: ['term_alias', 'term_quote', 'shell_var', 'which'],
        examples: [{
          q: '查看系统当前的 PATH 环境变量',
          steps: ['变量名是 PATH，echo 加 $ 前缀取值', '输出是用冒号分隔的一串目录'],
          answer: 'echo $PATH',
          accept: ['printenv PATH', 'env | grep PATH'],
          keywords: ['PATH'],
          note: '命令找不到时先 echo $PATH 看看目录对不对，再用 which 确认命令是否存在。',
          sandbox: 'home'
        }, {
          q: '设置变量 GREET=hi，然后立刻输出它的值（一条命令行完成）',
          steps: ['先赋值 GREET=hi（等号两边不能有空格）', '用 && 连接下一条命令', '再 echo $GREET 输出结果'],
          answer: 'export GREET=hi && echo $GREET',
          accept: ['GREET=hi && echo $GREET', 'GREET=hi; echo $GREET'],
          keywords: ['GREET', 'echo'],
          note: '赋值时等号两侧绝对不能有空格：GREET = hi 会被当成"执行 GREET 命令"而报错。',
          sandbox: 'home'
        }]
      },
      {
        id: 'term_alias',
        name: '别名 alias',
        full: 'alias / unalias / ~/.bashrc（命令别名）',
        plain: '别名就是给长命令起的外号：把 ls -la 叫成 ll。临时起外号只在当前窗口有效，写进 ~/.bashrc 才会每次开终端都带着。',
        tips: [
          '定义：alias ll=\'ls -la\'（等号右边有空格时必须加引号）',
          '查看：alias 列出所有别名；取消：unalias ll',
          '临时绕过别名：在命令前加反斜杠，\\ls',
          '永久生效：把 alias 写进 ~/.bashrc，执行 source ~/.bashrc 立即加载',
          '别名只在交互式 Shell 中展开，脚本里默认不生效（脚本里请用函数或直接写全）',
          '常见默认别名：ll、la、grep --color=auto、rm -i'
        ],
        rel: ['term_env', 'term_help', 'term_alias'],
        examples: [{
          q: '给 ls -la 定义一个简短的别名 ll',
          steps: ['用 alias 定义', '右边含空格，必须用引号包住'],
          answer: "alias ll='ls -la'",
          accept: ['alias ll="ls -la"'],
          keywords: ['alias', 'll', 'ls -la'],
          note: '定义后直接敲 ll 就等于敲 ls -la；关掉窗口就失效了。',
          sandbox: 'files'
        }, {
          q: '把上面的别名写进 ~/.bashrc，并让它对当前终端立即生效',
          steps: [
            '第一步：用 echo 追加写入（>> 是追加，不会破坏文件原有内容）',
            '第二步：source ~/.bashrc 重新加载配置',
            '两步用 && 串起来'
          ],
          answer: "echo \"alias ll='ls -la'\" >> ~/.bashrc && source ~/.bashrc",
          accept: [
            "echo \"alias ll='ls -la'\" >> ~/.bashrc; source ~/.bashrc",
            "echo 'alias ll=\"ls -la\"' >> ~/.bashrc && source ~/.bashrc"
          ],
          keywords: ['bashrc', 'source'],
          note: '写 ~/.bashrc 时用 >> 而不是 >，否则会把原有配置整个覆盖掉 —— 这是新手最惨烈的事故之一。',
          sandbox: 'home'
        }]
      },
      {
        id: 'term_redirect',
        name: '重定向与管道',
        full: 'redirection & pipe（> >> 2> 2>&1 |）',
        plain: '默认情况下命令的输出会直接打在屏幕上。重定向是"改收货地址"：把输出写进文件；管道是"接传送带"：把输出交给下一个命令继续加工。',
        tips: [
          '> 覆盖写入文件（文件不存在则创建，存在则清空）',
          '>> 追加到文件末尾（日志常用，绝不覆盖）',
          '2> 重定向错误输出（stderr）；1> 是标准输出（可省略 1）',
          '2>&1 把错误合并到标准输出（顺序很重要：先 2>&1 再 > file 才是合并）',
          '&> file 是 "> file 2>&1" 的简写（bash 特有）',
          '> /dev/null 丢弃输出（黑洞设备）；< 是输入重定向',
          '| 管道：左边命令的输出作为右边命令的输入，可以串很多级'
        ],
        rel: ['pipe', 'grep', 'echo', 'term_env'],
        examples: [{
          q: '把当前目录的详细列表保存到 list.txt（覆盖原内容）',
          steps: ['ls -la 的输出本来打在屏幕上', '用 > 把它重定向到 list.txt'],
          answer: 'ls -la > list.txt',
          accept: ['ls -al > list.txt', 'ls -a -l > list.txt'],
          keywords: ['ls', '>', 'list.txt'],
          note: '想看结果用 cat list.txt；想追加而不是覆盖就用 >>。',
          sandbox: 'files'
        }, {
          q: '执行 ls /nope（一个不存在的目录），把报错信息丢弃，屏幕上什么都不显示',
          steps: ['该命令的错误走 stderr（文件描述符 2）', '把 2 重定向到 /dev/null 黑洞即可'],
          answer: 'ls /nope 2> /dev/null',
          accept: ['ls /nope 2>/dev/null', 'ls /nope 2> /dev/null'],
          keywords: ['2>', '/dev/null'],
          note: '只丢错误、保留正常输出常用 "cmd 2>/dev/null"；想两者都丢用 "cmd &>/dev/null"。',
          sandbox: 'files'
        }, {
          q: '统计 /etc 目录下有多少个文件（用管道，不生成临时文件）',
          steps: ['ls /etc 输出所有条目', '用 | 把结果交给 wc -l 数行数', '一行命令搞定，不留中间文件'],
          answer: 'ls /etc | wc -l',
          keywords: ['ls', '|', 'wc', '-l'],
          note: '管道是 Linux 的灵魂：ls /etc | grep conf | wc -l 这种三段式非常常见。',
          sandbox: 'files'
        }]
      },
    ]
  }, 'env');

})(window);
