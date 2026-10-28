/* =============================================================================
 * js/sandbox.js
 * -----------------------------------------------------------------------------
 * 方案 D：纯前端"伪终端"沙盒（虚拟文件系统 + 命令引擎）
 *
 * 设计目标
 *   · 不改任何真实文件：所有操作都作用在内存里的 VFS 树上，刷新即复原
 *   · 不依赖 DOM：本文件只做"把一行命令变成输出"，界面在 js/term.js
 *   · 可测：node 里 load 进来就能断言，不需要浏览器
 *
 * 支持的能力
 *   · 文件系统：目录树、权限位、软链接、gz/tar 的简化模型、5 套预设工作区
 *   · Shell 语法：引号、变量、$(命令)、通配符、大括号展开、管道 |、
 *                重定向 > >> 2> 2>&1 &>、命令串联 && ; 、别名、历史
 *   · 40+ 命令：文件、文本、权限、进程、系统信息、网络工具（模拟输出）
 *   · 迷你脚本解释器：变量 / for / while / if / case / 函数 / 参数 / set -e -x
 *
 * 明确的边界（教学诚实）
 *   · 不执行真实程序、不联网、不模拟全屏编辑器（vim / nano 只给提示）
 *   · 权限"看得到但不会真的拦你"：写只读目录会提示，但不会模拟 EACCES
 * ========================================================================== */
(function (global) {
  'use strict';

  var LX = global.LX = global.LX || {};

  /** 固定身份：与教程里 WSL 的默认账号保持一致 */
  var ME = { user: 'student', group: 'student', host: 'wsl-desktop', home: '/home/student' };

  /** 八进制权限字面量（ES5 没有 0o 前缀，用 parseInt 表达意图） */
  function m(oct) { return parseInt(String(oct), 8); }

  var NOW = Date.now();
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  /* ------------------------------- 基础工具 ------------------------------- */

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  /** 时间戳 → ls 风格（Oct 28 10:12） */
  function fmtTime(ts) {
    var d = new Date(ts);
    return MONTHS[d.getMonth()] + ' ' + pad2(d.getDate()) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  /** 权限数字 → -rwxr-xr-x 字符串 */
  function modeString(mode, type) {
    var prefix = type === 'dir' ? 'd' : (type === 'link' ? 'l' : '-');
    var digits = [(mode >> 6) & 7, (mode >> 3) & 7, mode & 7];
    var out = prefix;
    digits.forEach(function (d) {
      out += (d & 4 ? 'r' : '-') + (d & 2 ? 'w' : '-') + (d & 1 ? 'x' : '-');
    });
    return out;
  }

  /** 人类可读大小 */
  function humanSize(n) {
    if (n < 1024) return String(n);
    if (n < 1024 * 1024) return (n / 1024).toFixed(1).replace(/\.0$/, '') + 'K';
    if (n < 1024 * 1024 * 1024) return (n / 1024 / 1024).toFixed(1).replace(/\.0$/, '') + 'M';
    return (n / 1024 / 1024 / 1024).toFixed(1).replace(/\.0$/, '') + 'G';
  }

  /** 文本 → 行数组（末尾换行不算一行） */
  function toLines(text) {
    var t = String(text == null ? '' : text);
    if (t === '') return [];
    return t.replace(/\r/g, '').replace(/\n$/, '').split('\n');
  }

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  /* -------------------------------- VFS 构造 -------------------------------- */

  function mkFile(content, opts) {
    opts = opts || {};
    return {
      type: 'file',
      content: content == null ? '' : String(content),
      mode: opts.mode || m(644),
      owner: opts.owner || ME.user,
      group: opts.group || ME.group,
      mtime: opts.mtime || NOW
    };
  }

  function mkDir(children, opts) {
    opts = opts || {};
    return {
      type: 'dir',
      children: children || {},
      mode: opts.mode || m(755),
      owner: opts.owner || ME.user,
      group: opts.group || ME.group,
      mtime: opts.mtime || NOW
    };
  }

  function mkLink(target, opts) {
    opts = opts || {};
    return {
      type: 'link',
      target: target,
      mode: m(777),
      owner: opts.owner || ME.user,
      group: opts.group || ME.group,
      mtime: opts.mtime || NOW
    };
  }
  /* ==========================================================================
   *  系统盘（所有场景共用）：/etc /usr/bin /var/log /tmp …
   * ======================================================================== */

  var PASSWD = [
    'root:x:0:0:root:/root:/bin/bash',
    'daemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin',
    'www-data:x:33:33:www-data:/var/www:/usr/sbin/nologin',
    'student:x:1000:1000:Student:/home/student:/bin/bash',
    'alice:x:1001:1001:Alice:/home/alice:/bin/bash'
  ].join('\n');

  var SYSLOG = [
    'Oct 28 09:00:01 wsl systemd[1]: Started Daily apt upgrade and clean activities.',
    'Oct 28 09:12:44 wsl sshd[812]: Accepted password for student from 127.0.0.1 port 51234',
    'Oct 28 09:13:02 wsl CRON[830]: (student) CMD (/home/student/backup.sh)',
    'Oct 28 10:02:11 wsl nginx[901]: 192.168.1.24 - - "GET /index.html HTTP/1.1" 200 612',
    'Oct 28 10:02:15 wsl nginx[901]: 192.168.1.24 - - "GET /missing.png HTTP/1.1" 404 153',
    'Oct 28 10:20:00 wsl kernel: eth0: link becomes ready'
  ].join('\n');

  /** 生成 /bin 与 /usr/bin 里的可执行文件桩（让 which / ls /usr/bin 有意义） */
  function binDir(names) {
    var out = {};
    names.forEach(function (n) { out[n] = mkFile('', { mode: m(755), owner: 'root', group: 'root' }); });
    return mkDir(out, { mode: m(755), owner: 'root', group: 'root' });
  }

  function baseTree(cmdNames) {
    return {
      bin: binDir(cmdNames),
      usr: mkDir({
        bin: binDir(cmdNames),
        sbin: mkDir({}, { mode: m(755), owner: 'root', group: 'root' }),
        local: mkDir({ bin: mkDir({}), share: mkDir({}) }),
        share: mkDir({})
      }, { owner: 'root', group: 'root' }),
      etc: mkDir({
        passwd: mkFile(PASSWD),
        group: mkFile('root:x:0:\nsudo:x:27:student\nstudent:x:1000:\nalice:x:1001:'),
        hosts: mkFile('127.0.0.1\tlocalhost\n127.0.1.1\twsl-desktop\n::1\tip6-localhost'),
        'os-release': mkFile('NAME="Ubuntu"\nVERSION="22.04.4 LTS (Jammy Jellyfish)"\nID=ubuntu\nPRETTY_NAME="Ubuntu 22.04.4 LTS"'),
        crontab: mkFile('# /etc/crontab: system-wide crontab\nSHELL=/bin/sh\nPATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin'),
        nginx: mkDir({
          'nginx.conf': mkFile('user www-data;\nworker_processes auto;\nevents { worker_connections 768; }\nhttp {\n  server {\n    listen 80;\n    root /var/www/html;\n  }\n}')
        })
      }, { owner: 'root', group: 'root' }),
      var: mkDir({
        log: mkDir({
          syslog: mkFile(SYSLOG, { mode: m(640), owner: 'root', group: 'adm' }),
          'auth.log': mkFile('Oct 28 09:12:44 wsl sshd[812]: Accepted password for student from 127.0.0.1', { mode: m(640), owner: 'root', group: 'adm' }),
          nginx: mkDir({
            'access.log': mkFile([
              '192.168.1.24 - - [28/Oct/2026:10:02:11 +0800] "GET /index.html HTTP/1.1" 200 612',
              '192.168.1.31 - - [28/Oct/2026:10:02:12 +0800] "GET /api/list HTTP/1.1" 200 1024',
              '192.168.1.24 - - [28/Oct/2026:10:02:15 +0800] "GET /missing.png HTTP/1.1" 404 153',
              '10.0.0.7 - - [28/Oct/2026:10:03:01 +0800] "POST /login HTTP/1.1" 500 87'
            ].join('\n'), { mode: m(640), owner: 'www-data', group: 'adm' })
          }),
          'error.log': mkFile('2026/10/28 10:03:01 [error] 901#901: *12 connect() failed (111: Connection refused)', { mode: m(640), owner: 'www-data', group: 'adm' })
        }),
        www: mkDir({ html: mkDir({ 'index.html': mkFile('<h1>It works!</h1>', { owner: 'www-data', group: 'www-data' }) }) })
      }, { owner: 'root', group: 'root' }),
      tmp: mkDir({}, { mode: m(777) }),
      srv: mkDir({ share: mkDir({}, { mode: m(777) }) }, { owner: 'root', group: 'root' }),
      root: mkDir({}, { mode: m(700), owner: 'root', group: 'root' }),
      home: mkDir({
        student: mkDir({
          '.bashrc': mkFile('# ~/.bashrc: executed by bash for non-login shells\nalias ll=\'ls -la\'\nexport EDITOR=vim\nPATH=$PATH:$HOME/.local/bin'),
          '.profile': mkFile('# ~/.profile: executed by the login shell\nif [ -n "$BASH_VERSION" ]; then\n  . "$HOME/.bashrc"\nfi'),
          'readme.txt': mkFile('欢迎来到 Linux 沙盒。\n所有操作都发生在浏览器内存里，点右上角"重置沙盒"即可复原。')
        })
      }, { owner: 'root', group: 'root' })
    };
  }
  /* ==========================================================================
   *  5 套预设工作区：每道例题通过 ex.sandbox 指定，点"▶ 沙盒运行"时加载
   * ======================================================================== */

  function put(dir, name, content, mode) {
    dir.children[name] = mkFile(content, { mode: mode || m(644) });
    return dir;
  }

  /** 造一个"假装是 gz"的文件（沙盒不真压缩，只记内容） */
  function e_gzFile(content) {
    var node = mkFile('', { mode: m(644) });
    node.gzContent = content;
    return node;
  }

  var SCENARIOS = {
    /* —— 默认工作区：File 基本操作练手 —— */
    files: {
      label: '文件与目录',
      cwd: '/home/student',
      setup: function (home) {
        home.children.docs = mkDir({ 'guide.md': mkFile('# 使用指南\n1. 先看地图\n2. 再动手敲\n') });
        home.children.practice = mkDir({
          'notes.txt': mkFile('第一行：今天学 ls\n第二行：明天学 tar\n'),
          'a.txt': mkFile('apple\nbanana\n'),
          'b.txt': mkFile('apple\ncherry\n'),
          'todo.txt': mkFile('复习 chmod\n'),
          'old.log': mkFile('2026-10-01 boot ok\n'),
          sub: mkDir({ 'readme.md': mkFile('子目录说明\n') })
        });
        home.children['practice.bak'] = mkDir({
          'notes.txt': mkFile('第一行：今天学 ls\n'),
          'a.txt': mkFile('apple\nbanana\n')
        });
        home.children.olddir = mkDir({});
        home.children.temp = mkDir({
          'x.tmp': mkFile('tmp\n'), 'y.tmp': mkFile('tmp\n'), 'z.txt': mkFile('keep me\n')
        });
        home.children.data = mkDir({ 'sample.csv': mkFile('id,name\n1,alice\n2,bob\n') });
        put(home, 'notes.txt', '我的笔记：\n- pwd 看位置\n- ls -la 看全部\n');
        put(home, 'app.log', '2026-10-28 09:00:01 INFO  server started\n2026-10-28 09:02:11 ERROR db connect failed\n', m(644));
        put(home, 'list.txt', 'old content\n');
        put(home, 'cache.tmp', 'temp data\n');
        put(home, 'old.tmp', 'temp data\n');
        var gz = e_gzFile('2026-10-28 08:00:00 INFO  compressed log line 1\n2026-10-28 08:01:00 WARN  compressed log line 2\n2026-10-28 08:02:00 ERROR compressed log line 3\n');
        home.children['app.log.gz'] = gz;
      }
    },

    /* —— 文本处理：grep / sed / awk / sort / uniq / cut 的练手数据 —— */
    text: {
      label: '文本处理',
      cwd: '/home/student',
      setup: function (home) {
        put(home, 'access.log', [
          '192.168.1.24 GET /index.html 200',
          '10.0.0.7 GET /login 500',
          '192.168.1.24 GET /style.css 200',
          '192.168.1.31 POST /api/order 201',
          '10.0.0.7 GET /missing.png 404',
          '192.168.1.24 GET /missing.png 404',
          '172.16.0.5 GET /index.html 200',
          '192.168.1.31 GET /cart 200',
          '10.0.0.7 GET /admin 403',
          '192.168.1.24 POST /api/order 201',
          '172.16.0.5 GET /favicon.ico 404',
          '192.168.1.24 GET /index.html 200'
        ].join('\n'));
        put(home, 'numbers.txt', ['25', '9', '100', '3', '42', '7', '88', '1', '56', '30'].join('\n'));
        put(home, 'duplicate.txt', ['apple', 'banana', 'apple', 'apple', 'cherry', 'banana', 'apple'].join('\n'));
        put(home, 'a.txt', 'hello\nlinux\nworld\n');
        put(home, 'b.txt', 'hello\nunix\nworld\n');
        put(home, 'hello.txt', 'Hello WSL\n');
        put(home, 'win.txt', 'line1\r\nline2\r\nline3\r\n');
        put(home, 'app.log', [
          '2026-10-28 09:00:01 INFO  server started on port 8080',
          '2026-10-28 09:02:11 ERROR db connect failed',
          '2026-10-28 09:05:40 WARN  slow query 1.8s',
          '2026-10-28 09:09:12 ERROR 404 not found',
          '2026-10-28 09:20:00 INFO  health check ok'
        ].join('\n'));
        put(home, 'names.txt', 'alice bob carol\n');
      }
    },

    /* —— 权限：不同 mode 的文件，练 chmod / 特殊位 / umask —— */
    perm: {
      label: '权限与用户',
      cwd: '/home/student',
      setup: function (home) {
        home.children['secret.key'] = mkFile('PRIVATE-KEY-DEMO', { mode: m(600) });
        home.children['notes.txt'] = mkFile('公共笔记\n', { mode: m(644) });
        home.children['run.sh'] = mkFile('#!/bin/bash\necho running\n', { mode: m(755) });
        home.children['shared.txt'] = mkFile('alice 的文件\n', { mode: m(666), owner: 'alice', group: 'alice' });
        home.children['private'] = mkDir({ 'diary.txt': mkFile('只有我能看\n', { mode: m(600) }) }, { mode: m(700) });
        home.children['team'] = mkDir({ 'plan.md': mkFile('团队计划\n', { mode: m(664), owner: 'alice', group: 'student' }) }, { mode: m(775) });
      }
    },

    /* —— 脚本：可直接 bash 运行的示例脚本 —— */
    script: {
      label: 'Shell 脚本',
      cwd: '/home/student',
      setup: function (home) {
        home.children['hi.sh'] = mkFile('#!/bin/bash\necho "Hello, Linux!"\n');
        home.children['backup.sh'] = mkFile([
          '#!/bin/bash',
          'set -e',
          'STAMP=$(date +%F)',
          'echo "== 开始备份 $STAMP =="',
          'tar -czf "backup-$STAMP.tar.gz" practice',
          'echo "== 备份完成 =="'
        ].join('\n'), { mode: m(755) });
        home.children['deploy.sh'] = mkFile('#!/bin/bash\nfor f in a.txt b.txt; do\n  echo "deploying $f"\ndone\n');
        home.children['start.sh'] = mkFile('#!/bin/bash\necho "service started"\nsleep 1\necho "still running"\n', { mode: m(755) });
        home.children['loop.sh'] = mkFile('#!/bin/bash\nfor i in 1 2 3; do\n  echo "第 $i 次"\ndone\n', { mode: m(755) });
        put(home, 'users.txt', 'alice\nbob\n');
        put(home, 'practice', 'placeholder\n');
      }
    },

    /* —— 默认：最小工作区，用来随便试 —— */
    home: {
      label: '默认工作区',
      cwd: '/home/student',
      setup: function (home) {
        home.children.logs = mkDir({ 'app.log': mkFile('2026-10-28 09:00:01 INFO start\n2026-10-28 09:01:00 ERROR boom\n') });
        home.children.scripts = mkDir({ 'hi.sh': mkFile('#!/bin/bash\necho "Hello, Linux!"\n', { mode: m(755) }) });
        home.children.practice = mkDir({ 'notes.txt': mkFile('练习目录\n') });
        put(home, 'notes.txt', '我的 Linux 笔记\n');
      }
    }
  };

  /** 组装一套可用的文件系统 */
  function buildFs(scenarioName, cmdNames) {
    var sc = SCENARIOS[scenarioName] || SCENARIOS.home;
    var tree = baseTree(cmdNames);
    sc.setup(tree.home.children.student, tree);
    return { root: mkDir(tree), scenario: scenarioName, cwd: sc.cwd, label: sc.label };
  }
  /* ==========================================================================
   *  引擎：一个实例 = 一个终端会话（cwd / 环境变量 / 别名 / 历史 / umask）
   * ======================================================================== */

  var COMMAND_NAMES = [];      // 由命令表回填，供 which / ls /usr/bin 使用

  function Engine(options) {
    options = options || {};
    var built = buildFs(options.scenario || 'home', COMMAND_NAMES);
    this.root = built.root;
    this.scenario = built.scenario;
    this.scenarioLabel = built.label;
    this.cwd = built.cwd;
    this.env = {
      HOME: ME.home,
      USER: ME.user,
      LOGNAME: ME.user,
      SHELL: '/bin/bash',
      PATH: '/usr/local/bin:/usr/bin:/bin',
      PWD: this.cwd,
      OLDPWD: this.cwd,
      HOSTNAME: ME.host,
      LANG: 'C.UTF-8',
      EDITOR: 'vim'
    };
    this.aliases = { ll: 'ls -la', la: 'ls -A', l: 'ls' };
    this.history = [];
    this.jobs = [];
    this.umask = m(22);
    this.lastExit = 0;
    this.rootOnly = false;       // sudo 时置 true，用于放行 /etc 写操作
    this.trace = false;
    this.scriptArgs = [];
    this.scriptName = 'bash';
    this.stopped = false;
  }

  /* ------------------------------- 路径解析 ------------------------------- */

  /** 相对路径 → 绝对路径（处理 ~ . .. 与重复斜杠） */
  Engine.prototype.abs = function (p) {
    var path = p == null ? '' : String(p);
    if (path === '') return this.cwd;
    if (path === '~') path = ME.home;
    else if (path.indexOf('~/') === 0) path = ME.home + path.slice(1);
    else if (/^\$HOME(\/|$)/.test(path)) path = ME.home + path.slice(5);
    if (path.charAt(0) !== '/') path = this.cwd + '/' + path;
    var out = [];
    path.split('/').forEach(function (seg) {
      if (!seg || seg === '.') return;
      if (seg === '..') out.pop();
      else out.push(seg);
    });
    return '/' + out.join('/');
  };

  /** 取节点（跟随软链接，最多 8 跳） */
  Engine.prototype.node = function (p, noFollow) {
    var path = this.abs(p);
    if (path === '/') return this.root;
    var parts = path.split('/').filter(Boolean);
    var cur = this.root;
    var hops = 0;
    for (var i = 0; i < parts.length; i++) {
      if (!cur || cur.type !== 'dir') return null;
      var next = cur.children[parts[i]];
      if (!next) return null;
      if (next.type === 'link' && !(noFollow && i === parts.length - 1)) {
        if (++hops > 8) return null;
        var base = '/' + parts.slice(0, i).join('/');
        var target = next.target.charAt(0) === '/' ? next.target : this.abs(base + '/' + next.target);
        var segs = target.split('/').filter(Boolean);
        var resolved = null;
        var start = this.root;
        for (var j = 0; j < segs.length; j++) {
          if (!start || start.type !== 'dir') return null;
          resolved = start.children[segs[j]];
          if (!resolved) return null;
          start = resolved;
        }
        next = resolved;
      }
      cur = next;
    }
    return cur;
  };

  /** 取父目录 + 末级名字（用于创建/删除） */
  Engine.prototype.parentOf = function (p) {
    var path = this.abs(p);
    if (path === '/') return null;
    var idx = path.lastIndexOf('/');
    return { dirPath: idx === 0 ? '/' : path.slice(0, idx), name: path.slice(idx + 1), path: path };
  };

  /** 目录条目名列表 */
  Engine.prototype.listNames = function (p, all) {
    var node = this.node(p);
    if (!node || node.type !== 'dir') return null;
    return Object.keys(node.children).filter(function (name) {
      return all || name.charAt(0) !== '.';
    }).sort();
  };
  /* ------------------------------ 读写与增删 ------------------------------ */

  function fail(message, code) {
    var e = new Error(message);
    e.code = code || 1;
    e.isShellError = true;
    return e;
  }

  /** 检查目录写权限（按 owner / group / other 三段判断） */
  Engine.prototype.canWrite = function (dirNode) {
    if (this.rootOnly) return true;
    if (!dirNode) return false;
    var mode = dirNode.mode;
    if (dirNode.owner === ME.user) return (mode & m(200)) !== 0;
    if (dirNode.group === ME.group) return (mode & m(20)) !== 0;
    return (mode & m(2)) !== 0;
  };

  Engine.prototype.readFile = function (p) {
    var node = this.node(p);
    if (!node) throw fail('cat: ' + p + ': No such file or directory');
    if (node.type === 'dir') throw fail('cat: ' + p + ': Is a directory');
    if (node.gzContent != null) return node.gzContent;
    return node.content || '';
  };

  Engine.prototype.writeFile = function (p, content, append) {
    var parent = this.parentOf(p);
    if (!parent) throw fail('bash: ' + p + ': Is a directory');
    var dirNode = this.node(parent.dirPath);
    if (!dirNode || dirNode.type !== 'dir') throw fail('bash: ' + p + ': No such file or directory');
    if (!this.canWrite(dirNode)) throw fail('bash: ' + p + ': Permission denied');
    var existing = dirNode.children[parent.name];
    if (existing && existing.type === 'dir') throw fail('bash: ' + p + ': Is a directory');
    if (existing) {
      if (existing.type === 'link') existing = this.node(p);
      existing.content = append ? (existing.content || '') + content : content;
      existing.mtime = Date.now();
      delete existing.gzContent;
      return existing;
    }
    var created = mkFile(content, { mode: m(666) & ~this.umask });
    dirNode.children[parent.name] = created;
    return created;
  };

  Engine.prototype.mkdirp = function (p, mode) {
    var parts = this.abs(p).split('/').filter(Boolean);
    var cur = this.root;
    for (var i = 0; i < parts.length; i++) {
      var seg = parts[i];
      if (cur.type !== 'dir') throw fail('mkdir: cannot create directory \'' + p + '\': Not a directory');
      if (!cur.children[seg]) {
        if (!this.canWrite(cur)) throw fail('mkdir: cannot create directory \'' + p + '\': Permission denied');
        cur.children[seg] = mkDir({}, { mode: i === parts.length - 1 ? (mode || (m(777) & ~this.umask)) : m(755) });
      }
      cur = cur.children[seg];
    }
    return cur;
  };

  Engine.prototype.remove = function (p, recursive) {
    var parent = this.parentOf(p);
    if (!parent) throw fail('rm: it is dangerous to operate recursively on \'/\'');
    var dirNode = this.node(parent.dirPath);
    if (!dirNode || dirNode.type !== 'dir') throw fail('rm: cannot remove \'' + p + '\': No such file or directory');
    var target = dirNode.children[parent.name];
    if (!target) throw fail('rm: cannot remove \'' + p + '\': No such file or directory');
    if (!this.canWrite(dirNode)) throw fail('rm: cannot remove \'' + p + '\': Permission denied');
    if (target.type === 'dir' && Object.keys(target.children).length && !recursive) {
      throw fail('rm: cannot remove \'' + p + '\': Is a directory');
    }
    delete dirNode.children[parent.name];
  };
  /* -------------------------------- 通配符 -------------------------------- */

  function hasMagic(s) { return /[*?[]/.test(s); }

  function globToRegExp(seg) {
    var out = '^';
    for (var i = 0; i < seg.length; i++) {
      var c = seg.charAt(i);
      if (c === '*') out += '[^/]*';
      else if (c === '?') out += '[^/]';
      else if (c === '[') {
        var end = seg.indexOf(']', i + 1);
        if (end > 0) {
          out += '[' + seg.slice(i + 1, end).replace(/^!/, '^') + ']';
          i = end;
        } else out += '\\[';
      } else out += c.replace(/[.+^${}()|\\)\]\\]/g, '\\$&');
    }
    return new RegExp(out + '$');
  }

  /** 大括号展开：a{1..3}b、x{,.bak}、f{a,b} */
  function expandBraces(word) {
    var start = word.indexOf('{');
    if (start < 0) return [word];
    var depth = 0, end = -1, i;
    for (i = start; i < word.length; i++) {
      if (word.charAt(i) === '{') depth++;
      else if (word.charAt(i) === '}') {
        depth--;
        if (depth === 0) { end = i; break; }
      }
    }
    if (end < 0) return [word];
    var head = word.slice(0, start);
    var body = word.slice(start + 1, end);
    var tail = word.slice(end + 1);
    var options = [];
    if (/^-?\d+\.\.-?\d+$/.test(body)) {
      var from = parseInt(body.split('..')[0], 10);
      var to = parseInt(body.split('..')[1], 10);
      var step = from <= to ? 1 : -1;
      for (var n = from; step > 0 ? n <= to : n >= to; n += step) options.push(String(n));
    } else {
      options = body.split(',');
    }
    var out = [];
    options.forEach(function (opt) {
      expandBraces(head + opt + tail).forEach(function (x) { out.push(x); });
    });
    return out;
  }

  /** 展开通配符（相对写法保持相对，方便 ls 显示） */
  Engine.prototype.glob = function (pattern) {
    var self = this;
    var results = [];
    expandBraces(pattern).forEach(function (pat) {
      if (!hasMagic(pat)) { results.push(pat); return; }
      var segs = self.abs(pat).split('/').filter(Boolean);
      var candidates = ['/'];
      for (var i = 0; i < segs.length; i++) {
        var rx = globToRegExp(segs[i]);
        var next = [];
        candidates.forEach(function (base) {
          var node = self.node(base);
          if (!node || node.type !== 'dir') return;
          Object.keys(node.children).forEach(function (name) {
            if (name.charAt(0) === '.' && segs[i].charAt(0) !== '.') return;
            if (!rx.test(name)) return;
            next.push(base === '/' ? '/' + name : base + '/' + name);
          });
        });
        candidates = next;
      }
      if (!candidates.length) { results.push(pat); return; }   // bash 行为：原样保留
      candidates.forEach(function (absPath) {
        if (pat.charAt(0) === '/') results.push(absPath);
        else if (absPath.indexOf(self.cwd + '/') === 0) results.push(absPath.slice(self.cwd.length + 1));
        else results.push(absPath);
      });
    });
    return results;
  };
  /* ==========================================================================
   *  Shell 层：分词、引号、变量、命令替换、管道、重定向
   * ======================================================================== */

  var OP_CHARS = '|;&<>';

  /** 读一个"单词"（处理引号、反斜杠、$变量、$(命令)、反引号） */
  Engine.prototype.readWord = function (line, start) {
    var i = start, n = line.length, buf = '', quoted = false;
    while (i < n) {
      var c = line.charAt(i);
      if (c === ' ' || c === '\t' || OP_CHARS.indexOf(c) >= 0) break;
      if (c === '\\') { buf += line.charAt(i + 1) || ''; i += 2; quoted = true; continue; }
      if (c === "'") {
        var e1 = line.indexOf("'", i + 1);
        if (e1 < 0) e1 = n;
        buf += line.slice(i + 1, e1);
        i = e1 + 1;
        quoted = true;
        continue;
      }
      if (c === '"') {
        var e2 = line.indexOf('"', i + 1);
        if (e2 < 0) e2 = n;
        buf += this.expandIn(line.slice(i + 1, e2));
        i = e2 + 1;
        quoted = true;
        continue;
      }
      if (c === '$') {
        var r = this.readDollar(line, i);
        buf += r.text;
        i = r.end;
        continue;
      }
      if (c === '`') {
        var e3 = line.indexOf('`', i + 1);
        if (e3 < 0) e3 = n;
        buf += this.capture(line.slice(i + 1, e3));
        i = e3 + 1;
        continue;
      }
      buf += c;
      i += 1;
    }
    return { text: buf, quoted: quoted, end: i };
  };

  /** 双引号内部：只展开变量 / 命令替换 / 反斜杠 */
  Engine.prototype.expandIn = function (text) {
    var out = '', i = 0;
    while (i < text.length) {
      var c = text.charAt(i);
      if (c === '\\') {
        var nx = text.charAt(i + 1);
        if (nx === '"' || nx === '\\' || nx === '$' || nx === '`') { out += nx; i += 2; continue; }
        out += c;
        i += 1;
        continue;
      }
      if (c === '$') { var r = this.readDollar(text, i); out += r.text; i = r.end; continue; }
      if (c === '`') {
        var e = text.indexOf('`', i + 1);
        if (e < 0) e = text.length;
        out += this.capture(text.slice(i + 1, e));
        i = e + 1;
        continue;
      }
      out += c;
      i += 1;
    }
    return out;
  };

  /** $NAME / ${NAME} / $(命令) / $? / $# / $@ / $1 … */
  Engine.prototype.readDollar = function (line, i) {
    var nxt = line.charAt(i + 1);
    if (nxt === '(') {
      var depth = 1, j = i + 2;
      while (j < line.length && depth > 0) {
        var cj = line.charAt(j);
        if (cj === '(') depth += 1;
        else if (cj === ')') depth -= 1;
        if (depth === 0) break;
        j += 1;
      }
      return { text: this.capture(line.slice(i + 2, j)), end: j + 1 };
    }
    if (nxt === '{') {
      var end = line.indexOf('}', i + 2);
      if (end < 0) end = line.length;
      return { text: this.getVar(line.slice(i + 2, end)), end: end + 1 };
    }
    var m2 = /^\$([A-Za-z_][A-Za-z0-9_]*|[0-9@#?*])/.exec(line.slice(i));
    if (!m2) return { text: '$', end: i + 1 };
    return { text: this.getVar(m2[1]), end: i + m2[0].length };
  };

  /** 取变量值 */
  Engine.prototype.getVar = function (name) {
    if (name === '?') return String(this.lastExit);
    if (name === '#') return String(this.scriptArgs.length);
    if (name === '@' || name === '*') return this.scriptArgs.join(' ');
    if (name === '0') return this.scriptName;
    if (/^[0-9]+$/.test(name)) return this.scriptArgs[parseInt(name, 10) - 1] || '';
    if (Object.prototype.hasOwnProperty.call(this.env, name)) return String(this.env[name]);
    if (this.vars && Object.prototype.hasOwnProperty.call(this.vars, name)) return String(this.vars[name]);
    return '';
  };

  /** 执行 $(...) 并取标准输出（丢掉尾部换行） */
  Engine.prototype.capture = function (cmdline) {
    var r = this.exec(cmdline);
    return String(r.out || '').replace(/\n+$/, '');
  };

  /**
   * 分词：把一行拆成 {op} 或 {word, glob}
   * 顺序有意义：2>&1 / 2> 必须先于普通单词与 > 判断
   */
  Engine.prototype.tokenize = function (line) {
    var out = [], i = 0, n = line.length;
    while (i < n) {
      var c = line.charAt(i);
      var rest = line.slice(i);
      if (c === ' ' || c === '\t') { i += 1; continue; }
      if (rest.indexOf('2>&1') === 0) { out.push({ op: '2>&1' }); i += 4; continue; }
      if (rest.indexOf('1>&2') === 0) { out.push({ op: '1>&2' }); i += 4; continue; }
      if (rest.indexOf('2>') === 0) { out.push({ op: '2>' }); i += 2; continue; }
      if (rest.indexOf('&&') === 0) { out.push({ op: '&&' }); i += 2; continue; }
      if (rest.indexOf('||') === 0) { out.push({ op: '||' }); i += 2; continue; }
      if (rest.indexOf(';;') === 0) { out.push({ op: ';;' }); i += 2; continue; }
      if (rest.indexOf('>>') === 0) { out.push({ op: '>>' }); i += 2; continue; }
      if (rest.indexOf('&>') === 0) { out.push({ op: '&>' }); i += 2; continue; }
      if (OP_CHARS.indexOf(c) >= 0) { out.push({ op: c }); i += 1; continue; }
      var w = this.readWord(line, i);
      out.push({ word: w.text, glob: !w.quoted });
      i = w.end;
    }
    return out;
  };

  /** 单词展开：通配符 + 大括号（仅当未被引号保护） */
  Engine.prototype.expandWords = function (words) {
    var self = this;
    var out = [];
    words.forEach(function (w) {
      if (w.glob && hasMagic(w.word)) self.glob(w.word).forEach(function (x) { out.push(x); });
      else if (w.glob) expandBraces(w.word).forEach(function (x) { out.push(x); });
      else out.push(w.word);
    });
    return out;
  };
  /* ------------------------------- 执行一行 ------------------------------- */

  var REDIRECT_OPS = { '>': 1, '>>': 1, '2>': 1, '&>': 1, '2>&1': 1, '1>&2': 1, '<': 1 };

  /**
   * 按 ; && || & 切分成"命令段"（管道 | 留在段内）。
   * 必须先切分再分词：这样 $? 、$VAR 才是"执行到该段时"的值，
   * 与 bash 逐条执行的行为一致。
   */
  Engine.prototype.splitTop = function (text) {
    var parts = [], buf = '', i = 0, quote = null;
    while (i < text.length) {
      var c = text.charAt(i);
      if (quote) {
        buf += c;
        if (c === '\\' && quote === '"') { buf += text.charAt(i + 1) || ''; i += 2; continue; }
        if (c === quote) quote = null;
        i += 1;
        continue;
      }
      if (c === '\\') { buf += c + (text.charAt(i + 1) || ''); i += 2; continue; }
      if (c === "'" || c === '"') { quote = c; buf += c; i += 1; continue; }
      if (c === '|') {
        if (text.charAt(i + 1) === '|') { parts.push({ text: buf, sep: '||' }); buf = ''; i += 2; continue; }
        buf += c;
        i += 1;
        continue;
      }
      if (c === '&') {
        if (text.charAt(i + 1) === '&') { parts.push({ text: buf, sep: '&&' }); buf = ''; i += 2; continue; }
        if (text.charAt(i + 1) === '>') { buf += '&>'; i += 2; continue; }
        parts.push({ text: buf, sep: '&' });
        buf = '';
        i += 1;
        continue;
      }
      if (c === ';') {
        if (text.charAt(i + 1) === ';') { buf += ';;'; i += 2; continue; }
        parts.push({ text: buf, sep: ';' });
        buf = '';
        i += 1;
        continue;
      }
      buf += c;
      i += 1;
    }
    parts.push({ text: buf, sep: null });
    return parts;
  };

  /**
   * 执行一行命令
   * @return {{out:string, err:string, code:number}}
   */
  Engine.prototype.exec = function (line) {
    var self = this;
    var text = this.expandHistory(String(line == null ? '' : line));
    var groups = this.splitTop(text);

    var out = '', err = '', code = 0, prevSep = null, prevCode = 0;
    groups.forEach(function (g) {
      var body = g.text.trim();
      if (!body) { prevSep = g.sep; return; }
      if (prevSep === '&&' && prevCode !== 0) { prevSep = g.sep; return; }
      if (prevSep === '||' && prevCode === 0) { prevSep = g.sep; return; }

      var r = self.runPipeline(self.tokenize(body));
      out += r.out;
      err += r.err;
      code = r.code;
      prevCode = r.code;
      prevSep = g.sep;
      self.lastExit = code;      // 让同一行后面的 $? 拿到最新退出码

      if (g.sep === '&') {
        var pid = 2000 + self.jobs.length + 1;
        self.jobs.push({ pid: pid, cmd: body });
        out += '[' + self.jobs.length + '] ' + pid + '\n';
      }
    });
    this.lastExit = code;
    return { out: out, err: err, code: code };
  };

  /** 把 !! 和 !n 还原成历史里的命令 */
  Engine.prototype.expandHistory = function (text) {
    var self = this;
    if (text.indexOf('!!') >= 0) {
      var last = this.history[this.history.length - 1] || '';
      return text.replace(/!!/g, last);
    }
    return text.replace(/(^|\s)!(-?\d+)\b/g, function (all, pre, num) {
      var idx = num.charAt(0) === '-' ? self.history.length + parseInt(num, 10) : parseInt(num, 10) - 1;
      return pre + (self.history[idx] || all);
    });
  };

  /** 执行一条管道（可能带重定向） */
  Engine.prototype.runPipeline = function (tokens) {
    var self = this;
    var segments = [[]];
    tokens.forEach(function (t) {
      if (t.op === '|') segments.push([]);
      else segments[segments.length - 1].push(t);
    });

    var stdin = '';
    var outAcc = '', errAcc = '', code = 0;

    segments.forEach(function (seg, idx) {
      var words = [];
      var redirects = { out: null, append: false, errFile: null, merge: false, input: null };
      for (var i = 0; i < seg.length; i++) {
        var t = seg[i];
        if (t.op && REDIRECT_OPS[t.op]) {
          var target = seg[i + 1] && seg[i + 1].word;
          i += 1;
          if (t.op === '>') { redirects.out = target; redirects.append = false; }
          else if (t.op === '>>') { redirects.out = target; redirects.append = true; }
          else if (t.op === '2>') { redirects.errFile = target; }
          else if (t.op === '&>') { redirects.out = target; redirects.merge = true; }
          else if (t.op === '2>&1') { redirects.merge = true; }
          else if (t.op === '<') { redirects.input = target; }
          continue;
        }
        if (t.word == null) continue;
        words.push(t);
      }

      if (redirects.input) {
        try { stdin = self.readFile(redirects.input); }
        catch (e) { errAcc += e.message + '\n'; code = 1; return; }
      }

      var r = self.runWords(self.expandWords(words), stdin, { piped: idx < segments.length - 1 });
      stdin = r.out;
      code = r.code;
      if (r.err) {
        if (redirects.errFile) self.safeWrite(redirects.errFile, r.err, false);
        else if (!redirects.merge) errAcc += r.err;
      }
      if (redirects.out) {
        self.safeWrite(redirects.out, r.out, redirects.append);
        if (redirects.merge) self.safeWrite(redirects.out, r.err, true);
        if (idx === segments.length - 1) stdin = '';
      } else if (idx === segments.length - 1) {
        outAcc += r.out;
      }
    });

    return { out: outAcc, err: errAcc, code: code };
  };

  /** 重定向写文件失败时不抛异常，而是转成错误信息 */
  Engine.prototype.safeWrite = function (file, content, append) {
    try {
      this.writeFile(file, content, !!append);
    } catch (e) {
      return e.message;
    }
    return null;
  };
  /* ==========================================================================
   *  命令表：每个命令 = function (args, ctx) → {out, err, code}
   *  ctx = { stdin, engine, argv }
   * ======================================================================== */

  var COMMANDS = {};
  var DOCS = {};

  function def(name, fn, usage, desc) {
    COMMANDS[name] = fn;
    DOCS[name] = { usage: usage || name, desc: desc || '' };
  }

  function oktext(s) { return { out: s || '', err: '', code: 0 }; }
  function errtext(s, code) {
    var msg = String(s == null ? '' : s);
    return { out: '', err: msg.replace(/\n$/, '') + '\n', code: code || 1 };
  }

  /** 统一返回结构（命令也可以直接返回字符串） */
  function normalizeResult(r) {
    if (r == null) return { out: '', err: '', code: 0 };
    if (typeof r === 'string') return { out: r, err: '', code: 0 };
    return { out: r.out || '', err: r.err || '', code: r.code == null ? 0 : r.code };
  }

  /** 解析选项：-la → {l:true,a:true}；valueSpec 里的字母表示"要接一个值" */
  function parseArgs(args, valueSpec) {
    var flags = {}, operands = [], i;
    for (i = 0; i < args.length; i++) {
      var a = args[i];
      if (a === '--') { operands = operands.concat(args.slice(i + 1)); break; }
      if (a.charAt(0) === '-' && a.length > 1) {
        if (a.charAt(1) === '-') {
          var body = a.slice(2);
          var eq = body.indexOf('=');
          var key = eq >= 0 ? body.slice(0, eq) : body;
          flags[key] = eq >= 0 ? body.slice(eq + 1) : true;
          continue;
        }
        for (var j = 1; j < a.length; j++) {
          var ch = a.charAt(j);
          if (valueSpec && valueSpec.indexOf(ch) >= 0) {
            var val = a.slice(j + 1);
            if (!val) { val = args[i + 1]; i += 1; }
            flags[ch] = val;
            break;
          }
          flags[ch] = true;
        }
        continue;
      }
      operands.push(a);
    }
    return { flags: flags, operands: operands };
  }

  /** 行数组 → 文本（自动补换行） */
  function joinLines(arr) {
    if (!arr || !arr.length) return '';
    return arr.join('\n') + '\n';
  }

  /* ------------------------------ 目录与文件 ------------------------------ */

  def('pwd', function (args, ctx) {
    return oktext(ctx.engine.cwd + '\n');
  }, 'pwd', '显示当前所在目录的绝对路径');

  def('cd', function (args, ctx) {
    var e = ctx.engine;
    var target = args[0] || e.env.HOME;
    if (target === '-') {
      var prev = e.env.OLDPWD || e.env.HOME;
      var line = prev + '\n';
      e.env.OLDPWD = e.cwd;
      e.cwd = e.abs(prev);
      e.env.PWD = e.cwd;
      return oktext(line);
    }
    var node = e.node(target);
    if (!node) return errtext('bash: cd: ' + target + ': No such file or directory');
    if (node.type !== 'dir') return errtext('bash: cd: ' + target + ': Not a directory');
    e.env.OLDPWD = e.cwd;
    e.cwd = e.abs(target);
    e.env.PWD = e.cwd;
    return oktext('');
  }, 'cd [目录]', '切换目录（cd - 回上一个目录，cd 回家目录）');

  /** 单个目录条目 → 一行文本 */
  function formatEntry(e, name, node, long) {
    if (!long) return name;
    var size = node.type === 'dir' ? 4096 : String(node.content || '').length;
    var link = node.type === 'link' ? ' -> ' + node.target : '';
    return [
      modeString(node.mode, node.type),
      String(node.type === 'dir' ? 2 : 1).padStart(2, ' '),
      String(node.owner || 'student').padEnd(7, ' '),
      String(node.group || 'student').padEnd(7, ' '),
      String(size).padStart(6, ' '),
      fmtTime(node.mtime),
      name + link
    ].join(' ');
  }

  def('ls', function (args, ctx) {
    var e = ctx.engine;
    var p = parseArgs(args, '');
    var opt = p.flags;
    if (opt.help) return oktext(DOCS.ls.usage + '\n  ' + DOCS.ls.desc + '\n');
    var targets = p.operands.length ? p.operands : ['.'];
    var out = [], errs = [];

    targets.forEach(function (t) {
      var node = e.node(t, !!opt.l);
      if (!node) { errs.push('ls: cannot access \'' + t + '\': No such file or directory'); return; }
      if (node.type !== 'dir' || opt.d || (node.type === 'link' && opt.l)) {
        out.push(formatEntry(e, t, node, opt.l));
        return;
      }
      var names = Object.keys(node.children).filter(function (n) {
        return opt.a || opt.A || n.charAt(0) !== '.';
      });
      names.sort(function (a, b) {
        if (opt.t || opt.S) {
          var na = node.children[a], nb = node.children[b];
          var va = opt.S ? String(na.content || '').length : na.mtime;
          var vb = opt.S ? String(nb.content || '').length : nb.mtime;
          if (va !== vb) return vb - va;
        }
        return a < b ? -1 : (a > b ? 1 : 0);
      });
      if (opt.r) names.reverse();
      if (opt.l) out.push('total ' + names.length);
      if (targets.length > 1 && !opt.l) out.push(t + ':');
      names.forEach(function (n) { out.push(formatEntry(e, n, node.children[n], opt.l)); });
    });

    var body = opt.l || opt['1'] || ctx.piped || targets.length > 1
      ? joinLines(out)
      : (out.length ? out.join('  ') + '\n' : '');
    return { out: body, err: errs.length ? errs.join('\n') + '\n' : '', code: errs.length ? 2 : 0 };
  }, 'ls [-la][-h][-t][-S][-r] [路径]', '列出目录内容（-l 详情、-a 含隐藏、-t 按时间）');
  def('tree', function (args, ctx) {
    var e = ctx.engine;
    var p = parseArgs(args, 'L');
    var depth = p.flags.L ? parseInt(p.flags.L, 10) : Infinity;
    var start = p.operands[0] || '.';
    var node = e.node(start);
    if (!node) return errtext('tree: ' + start + ': No such file or directory');
    var out = [], dirs = 0, files = 0;

    (function walk(n, prefix, level) {
      if (level > depth) return;
      var names = Object.keys(n.children).filter(function (x) { return x.charAt(0) !== '.'; }).sort();
      names.forEach(function (name, i) {
        var last = i === names.length - 1;
        var child = n.children[name];
        out.push(prefix + (last ? '└── ' : '├── ') + name);
        if (child.type === 'dir') { dirs += 1; walk(child, prefix + (last ? '    ' : '│   '), level + 1); }
        else files += 1;
      });
    })(node, '', 1);

    return oktext((p.operands[0] || e.cwd) + '\n' + joinLines(out) + '\n' +
      dirs + ' directories, ' + files + ' files\n');
  }, 'tree [-L 层数] [目录]', '以树形显示目录结构');

  def('mkdir', function (args, ctx) {
    var e = ctx.engine;
    var p = parseArgs(args, '');
    if (!p.operands.length) return errtext('mkdir: missing operand');
    var errs = [];
    p.operands.forEach(function (dir) {
      if (p.flags.p) {
        try { e.mkdirp(dir); } catch (err) { errs.push(err.message); }
        return;
      }
      if (e.node(dir)) { errs.push('mkdir: cannot create directory \'' + dir + '\': File exists'); return; }
      var parent = e.parentOf(dir);
      var pn = parent && e.node(parent.dirPath);
      if (!parent || !pn || pn.type !== 'dir') {
        errs.push('mkdir: cannot create directory \'' + dir + '\': No such file or directory');
        return;
      }
      if (!e.canWrite(pn)) { errs.push('mkdir: cannot create directory \'' + dir + '\': Permission denied'); return; }
      pn.children[parent.name] = mkDir({}, { mode: m(777) & ~e.umask });
    });
    return { out: '', err: errs.length ? errs.join('\n') + '\n' : '', code: errs.length ? 1 : 0 };
  }, 'mkdir [-p] 目录…', '创建目录（-p 递归创建父目录）');

  def('rmdir', function (args, ctx) {
    var e = ctx.engine;
    if (!args.length) return errtext('rmdir: missing operand');
    var errs = [];
    args.forEach(function (d) {
      var node = e.node(d);
      if (!node) { errs.push('rmdir: failed to remove \'' + d + '\': No such file or directory'); return; }
      if (node.type !== 'dir') { errs.push('rmdir: failed to remove \'' + d + '\': Not a directory'); return; }
      if (Object.keys(node.children).length) { errs.push('rmdir: failed to remove \'' + d + '\': Directory not empty'); return; }
      try { e.remove(d, true); } catch (err) { errs.push(err.message); }
    });
    return { out: '', err: errs.length ? errs.join('\n') + '\n' : '', code: errs.length ? 1 : 0 };
  }, 'rmdir 目录…', '删除空目录');

  def('touch', function (args, ctx) {
    var e = ctx.engine;
    if (!args.length) return errtext('touch: missing file operand');
    try {
      args.forEach(function (f) {
        var node = e.node(f);
        if (node) node.mtime = Date.now();
        else e.writeFile(f, '', false);
      });
    } catch (err) { return errtext(err.message); }
    return oktext('');
  }, 'touch 文件…', '创建空文件 / 更新文件时间戳');

  def('rm', function (args, ctx) {
    var e = ctx.engine;
    var p = parseArgs(args, '');
    if (!p.operands.length) return errtext('rm: missing operand');
    var errs = [];
    p.operands.forEach(function (f) {
      if (f === '/') { errs.push('rm: it is dangerous to operate recursively on \'/\''); return; }
      try { e.remove(f, !!(p.flags.r || p.flags.R || p.flags.f)); }
      catch (err) { errs.push(err.message); }
    });
    return { out: '', err: errs.length ? errs.join('\n') + '\n' : '', code: errs.length ? 1 : 0 };
  }, 'rm [-r][-f] 路径…', '删除文件或目录（-r 递归、-f 不提示）');
  /* ------------------------------ 复制 / 移动 ------------------------------ */

  function baseName(p) {
    var s = String(p == null ? '' : p).replace(/\/+$/, '');
    var i = s.lastIndexOf('/');
    return i >= 0 ? s.slice(i + 1) : s;
  }

  function copyNode(srcNode, destPath, e, sources) {
    var parent = e.parentOf(destPath);
    var pn = parent && e.node(parent.dirPath);
    if (!pn || pn.type !== 'dir') return 'cp: cannot create \'' + destPath + '\': No such file or directory';
    if (!e.canWrite(pn)) return 'cp: cannot create \'' + destPath + '\': Permission denied';
    if (pn.children[parent.name] && pn.children[parent.name].type === 'dir') {
      return 'cp: cannot overwrite directory \'' + destPath + '\'';
    }
    var copy = clone(srcNode);
    copy.mtime = Date.now();
    pn.children[parent.name] = copy;
    if (sources && sources.indexOf(e.abs(destPath)) >= 0) {
      return 'cp: \'' + destPath + '\' and \'' + srcNode.name + '\' are the same file';
    }
    return null;
  }

  def('cp', function (args, ctx) {
    var e = ctx.engine;
    var p = parseArgs(args, '');
    if (p.operands.length < 2) return errtext('cp: missing destination file operand after \'' + (p.operands[0] || '') + '\'');
    var dest = p.operands[p.operands.length - 1];
    var srcs = p.operands.slice(0, -1);
    var destNode = e.node(dest);
    var errs = [];
    srcs.forEach(function (src) {
      var node = e.node(src, true);
      if (!node) { errs.push('cp: cannot stat \'' + src + '\': No such file or directory'); return; }
      var recursive = !!(p.flags.r || p.flags.R || p.flags.a);
      if (node.type === 'dir' && !recursive) {
        errs.push('cp: -r not specified; omitting directory \'' + src + '\'');
        return;
      }
      var target = destNode && destNode.type === 'dir' ? dest.replace(/\/+$/, '') + '/' + baseName(src) : dest;
      var msg = copyNode(node, target, e, srcs);
      if (msg) errs.push(msg);
    });
    return { out: '', err: errs.length ? errs.join('\n') + '\n' : '', code: errs.length ? 1 : 0 };
  }, 'cp [-r] 源… 目标', '复制文件或目录（-r 递归复制目录）');

  def('mv', function (args, ctx) {
    var e = ctx.engine;
    var p = parseArgs(args, '');
    if (p.operands.length < 2) return errtext('mv: missing destination file operand');
    var dest = p.operands[p.operands.length - 1];
    var srcs = p.operands.slice(0, -1);
    var destNode = e.node(dest);
    var errs = [];
    srcs.forEach(function (src) {
      var node = e.node(src, true);
      if (!node) { errs.push('mv: cannot stat \'' + src + '\': No such file or directory'); return; }
      var target = destNode && destNode.type === 'dir' ? dest.replace(/\/+$/, '') + '/' + baseName(src) : dest;
      var msg = copyNode(node, target, e, srcs);
      if (msg) { errs.push(msg.replace(/^cp:/, 'mv:')); return; }
      try { e.remove(src, true); } catch (err) { errs.push(err.message); }
    });
    return { out: '', err: errs.length ? errs.join('\n') + '\n' : '', code: errs.length ? 1 : 0 };
  }, 'mv 源… 目标', '移动或重命名文件 / 目录');

  def('ln', function (args, ctx) {
    var e = ctx.engine;
    var p = parseArgs(args, '');
    if (p.operands.length < 2) return errtext('ln: missing file operand');
    var target = p.operands[0];
    var linkName = p.operands[1];
    var destNode = e.node(linkName);
    if (destNode && destNode.type === 'dir') linkName = linkName.replace(/\/+$/, '') + '/' + baseName(target);
    var parent = e.parentOf(linkName);
    var pn = parent && e.node(parent.dirPath);
    if (!pn || pn.type !== 'dir') return errtext('ln: failed to create link \'' + linkName + '\': No such file or directory');
    if (!e.canWrite(pn)) return errtext('ln: failed to create link \'' + linkName + '\': Permission denied');
    if (p.flags.s) {
      if (!e.node(target, true)) return errtext('ln: failed to create symbolic link \'' + linkName + '\': No such file or directory');
      pn.children[parent.name] = mkLink(target);
      return oktext('');
    }
    var node = e.node(target, true);
    if (!node) return errtext('ln: failed to access \'' + target + '\': No such file or directory');
    if (node.type === 'dir') return errtext('ln: \'' + target + '\': hard link not allowed for directory');
    pn.children[parent.name] = clone(node);
    return oktext('');
  }, 'ln [-s] 目标 链接名', '创建硬链接（-s 创建软链接）');

  /* ------------------------------- 查看内容 ------------------------------- */

  def('cat', function (args, ctx) {
    var e = ctx.engine;
    var p = parseArgs(args, '');
    if (!p.operands.length) return oktext(ctx.stdin || '');
    var out = '', errs = [], n = 1;
    p.operands.forEach(function (f) {
      try {
        toLines(e.readFile(f)).forEach(function (line) {
          out += (p.flags.n ? String(n++).padStart(6, ' ') + '\t' : '') + line + '\n';
        });
      } catch (err) { errs.push(err.message); }
    });
    return { out: out, err: errs.length ? errs.join('\n') + '\n' : '', code: errs.length ? 1 : 0 };
  }, 'cat [-n] 文件…', '显示文件全部内容（-n 显示行号）');

  /** head / tail 的 N：支持 -n 5、-n5、-5 三种写法 */
  function lineCountFrom(flags, fallback) {
    if (flags.n) {
      var v = parseInt(flags.n, 10);
      if (!isNaN(v)) return v;
    }
    var keys = Object.keys(flags);
    for (var i = 0; i < keys.length; i++) {
      if (/^\d+$/.test(keys[i])) return parseInt(keys[i], 10);
    }
    return fallback;
  }

  def('head', function (args, ctx) {
    var e = ctx.engine;
    var p = parseArgs(args, 'n');
    var count = lineCountFrom(p.flags, 10);
    var src = p.operands.length ? e.readFile(p.operands[0]) : (ctx.stdin || '');
    return oktext(joinLines(toLines(src).slice(0, count)));
  }, 'head [-n N] 文件', '显示文件开头 N 行（默认 10 行）');

  def('tail', function (args, ctx) {
    var e = ctx.engine;
    var p = parseArgs(args, 'n');
    var count = lineCountFrom(p.flags, 10);
    var src = p.operands.length ? e.readFile(p.operands[0]) : (ctx.stdin || '');
    var lines = toLines(src);
    var out = joinLines(lines.slice(Math.max(0, lines.length - count)));
    if (p.flags.f || p.flags.F) {
      out += '\n（沙盒不模拟实时跟踪；真机上 tail -f 会一直等待新日志，Ctrl+C 退出）\n';
    }
    return oktext(out);
  }, 'tail [-n N][-f] 文件', '显示文件末尾 N 行（-f 实时跟踪）');
  /* ------------------------------- 输出与统计 ------------------------------- */

  def('echo', function (args, ctx) {
    var p = parseArgs(args, '');
    var text = p.operands.join(' ');
    if (p.flags.e) {
      text = text.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\\\/g, '\\');
    }
    return oktext(text + (p.flags.n ? '' : '\n'));
  }, 'echo [-n][-e] 文本…', '输出文本（-n 不换行、-e 解释 \\n \\t）');

  def('printf', function (args, ctx) {
    if (!args.length) return errtext('printf: usage: printf FORMAT [ARGUMENTS]');
    var fmt = args[0].replace(/\\n/g, '\n').replace(/\\t/g, '\t');
    var rest = args.slice(1), i = 0;
    var out = fmt.replace(/%s|%d|%[0-9]*[sd]/g, function () {
      var v = rest[i++];
      return v == null ? '' : v;
    });
    return oktext(/\n$/.test(out) ? out : out + '\n');
  }, 'printf 格式 参数…', '按格式输出（类似 C 的 printf）');

  def('wc', function (args, ctx) {
    var e = ctx.engine;
    var p = parseArgs(args, '');
    var files = p.operands;

    function count(text) {
      var t = String(text || '');
      return {
        l: t === '' ? 0 : toLines(t).length,
        w: t.trim() === '' ? 0 : t.trim().split(/\s+/).length,
        c: t.length
      };
    }
    function fmt(c) {
      var parts = [];
      if (p.flags.l) parts.push(c.l);
      if (p.flags.w) parts.push(c.w);
      if (p.flags.c) parts.push(c.c);
      if (!parts.length) parts = [c.l, c.w, c.c];
      return parts.map(function (n) { return String(n).padStart(7, ' '); }).join('');
    }

    if (!files.length) return oktext(fmt(count(ctx.stdin || '')) + '\n');

    var out = [], total = { l: 0, w: 0, c: 0 }, errs = [];
    files.forEach(function (f) {
      try {
        var c = count(e.readFile(f));
        total.l += c.l; total.w += c.w; total.c += c.c;
        out.push(fmt(c) + ' ' + f);
      } catch (err) { errs.push(err.message); }
    });
    if (files.length > 1) out.push(fmt(total) + ' total');
    return { out: joinLines(out), err: errs.length ? errs.join('\n') + '\n' : '', code: errs.length ? 1 : 0 };
  }, 'wc [-l][-w][-c] [文件…]', '统计行数 / 单词数 / 字节数');

  def('tee', function (args, ctx) {
    var e = ctx.engine;
    var p = parseArgs(args, '');
    var input = ctx.stdin || '';
    var errs = [];
    p.operands.forEach(function (f) {
      var msg = e.safeWrite(f, input, !!p.flags.a);
      if (msg) errs.push(msg);
    });
    return { out: input, err: errs.length ? errs.join('\n') + '\n' : '', code: errs.length ? 1 : 0 };
  }, 'tee [-a] 文件…', '把输入同时写到屏幕和文件（-a 追加）');

  /* -------------------------------- 文本处理 -------------------------------- */

  function readAll(e, files, stdin) {
    if (!files.length) return { text: stdin || '' };
    try {
      return { text: files.map(function (f) { return e.readFile(f); }).join('\n') };
    } catch (err) {
      return { error: err.message };
    }
  }

  function humanBytes(s) {
    var m2 = /^([0-9.]+)([KMG]?)$/i.exec(String(s));
    if (!m2) return parseFloat(s) || 0;
    var unit = m2[2].toUpperCase();
    var mult = unit === 'G' ? 1073741824 : unit === 'M' ? 1048576 : unit === 'K' ? 1024 : 1;
    return parseFloat(m2[1]) * mult;
  }
  def('sort', function (args, ctx) {
    var e = ctx.engine;
    var p = parseArgs(args, 'kto');
    var got = readAll(e, p.operands, ctx.stdin);
    if (got.error) return errtext(got.error);
    var arr = toLines(got.text);
    arr.sort(function (a, b) {
      var ka = a, kb = b;
      if (p.flags.t || p.flags.k) {
        var sep = p.flags.t || ' ';
        var col = parseInt(p.flags.k || '1', 10) - 1;
        ka = a.split(sep)[col] || '';
        kb = b.split(sep)[col] || '';
      }
      if (p.flags.n) return (parseFloat(ka) || 0) - (parseFloat(kb) || 0);
      if (p.flags.h) return humanBytes(ka) - humanBytes(kb);
      if (p.flags.f) { ka = ka.toLowerCase(); kb = kb.toLowerCase(); }
      return ka < kb ? -1 : (ka > kb ? 1 : 0);
    });
    if (p.flags.r) arr.reverse();
    if (p.flags.u) arr = arr.filter(function (x, i) { return i === 0 || x !== arr[i - 1]; });
    if (p.flags.o) { e.safeWrite(p.flags.o, joinLines(arr), false); return oktext(''); }
    return oktext(joinLines(arr));
  }, 'sort [-n][-r][-u] [-k 列] [-t 分隔符] [文件]', '按行排序（-n 数值、-r 倒序、-u 去重）');

  def('uniq', function (args, ctx) {
    var e = ctx.engine;
    var p = parseArgs(args, '');
    var got = readAll(e, p.operands, ctx.stdin);
    if (got.error) return errtext(got.error);
    var groups = [];
    toLines(got.text).forEach(function (line) {
      var key = p.flags.i ? line.toLowerCase() : line;
      var g = groups[groups.length - 1];
      if (g && g.key === key) { g.n += 1; return; }
      groups.push({ key: key, line: line, n: 1 });
    });
    var out = [];
    groups.forEach(function (g) {
      if (p.flags.d && g.n < 2) return;
      if (p.flags.u && g.n > 1) return;
      out.push((p.flags.c ? String(g.n).padStart(7, ' ') + ' ' : '') + g.line);
    });
    return oktext(joinLines(out));
  }, 'uniq [-c][-d][-u] [文件]', '去掉相邻重复行（-c 计数、-d 只留重复）');

  def('cut', function (args, ctx) {
    var e = ctx.engine;
    var p = parseArgs(args, 'dfc');
    var got = readAll(e, p.operands, ctx.stdin);
    if (got.error) return errtext(got.error);
    var delim = p.flags.d || '\t';
    var out = [];
    toLines(got.text).forEach(function (line) {
      if (p.flags.c) {
        var spec = String(p.flags.c).split(',')[0].split('-');
        var from = parseInt(spec[0] || '1', 10) - 1;
        var to = spec[1] ? parseInt(spec[1], 10) : from + 1;
        out.push(line.slice(from, to));
        return;
      }
      if (!p.flags.f) { out.push(line); return; }
      var cols = [];
      String(p.flags.f).split(',').forEach(function (piece) {
        var range = piece.split('-');
        if (range[1]) {
          var a2 = parseInt(range[0], 10), b2 = parseInt(range[1], 10);
          for (var k = a2; k <= b2; k++) cols.push(k);
        } else cols.push(parseInt(piece, 10));
      });
      var fields = line.split(delim);
      out.push(cols.map(function (n) { return fields[n - 1] == null ? '' : fields[n - 1]; }).join(delim));
    });
    return oktext(joinLines(out));
  }, 'cut -d 分隔符 -f 列 [-c 位置] [文件]', '按列截取文本（如 cut -d: -f1 /etc/passwd）');

  def('tr', function (args, ctx) {
    var p = parseArgs(args, '');
    var sets = p.operands;
    var src = ctx.stdin || '';
    function expandSet(s) {
      var out = '';
      var src = String(s).replace(/\\r/g, '\r').replace(/\\n/g, '\n').replace(/\\t/g, '\t');
      for (var i = 0; i < src.length; i++) {
        if (src.charAt(i + 1) === '-' && src.charAt(i + 2)) {
          for (var c = src.charCodeAt(i); c <= src.charCodeAt(i + 2); c++) out += String.fromCharCode(c);
          i += 2;
        } else out += src.charAt(i);
      }
      return out;
    }
    if (p.flags.d) {
      var del = expandSet(sets[0] || '');
      return oktext(src.split('').filter(function (ch) { return del.indexOf(ch) < 0; }).join(''));
    }
    var from2 = expandSet(sets[0] || ''), to2 = expandSet(sets[1] || '');
    return oktext(src.split('').map(function (ch) {
      var idx = from2.indexOf(ch);
      if (idx < 0) return ch;
      return to2.charAt(idx) || to2.charAt(to2.length - 1) || ch;
    }).join(''));
  }, 'tr 字符集1 [字符集2] [-d]', '逐字符替换或删除（如 tr a-z A-Z）');
  def('grep', function (args, ctx) {
    var e = ctx.engine;
    var p = parseArgs(args, '');
    if (!p.operands.length) return errtext('usage: grep [选项] 模式 [文件…]');
    var pattern = p.operands[0];
    var files = p.operands.slice(1);
    var rx;
    try {
      rx = new RegExp(pattern, p.flags.i ? 'i' : '');
    } catch (err) {
      rx = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), p.flags.i ? 'i' : '');
    }
    var out = [], errs = [], totalHits = 0;
    var fileNameCol = files.length > 1;

    function scanText(text, label) {
      var hits = 0;
      toLines(text).forEach(function (line, i) {
        var hit = rx.test(line);
        if (p.flags.v) hit = !hit;
        if (!hit) return;
        hits += 1;
        if (p.flags.l || p.flags.c) return;
        out.push((fileNameCol ? label + ':' : '') + (p.flags.n ? (i + 1) + ':' : '') + line);
      });
      totalHits += hits;
      if (p.flags.l && hits) out.push(label);
      if (p.flags.c) out.push((fileNameCol ? label + ':' : '') + hits);
      return hits;
    }

    function walkDir(dirPath, label) {
      var names = e.listNames(dirPath, false) || [];
      names.forEach(function (name) {
        var child = dirPath.replace(/\/+$/, '') + '/' + name;
        var node = e.node(child);
        if (!node) return;
        if (node.type === 'dir') { if (p.flags.r) walkDir(child, child + '/x'); return; }
        scanText(e.readFile(child), p.flags.h ? name : child);
      });
    }

    if (!files.length) {
      scanText(ctx.stdin || '', '(标准输入)');
    } else {
      files.forEach(function (f) {
        var node = e.node(f);
        if (!node) { errs.push('grep: ' + f + ': No such file or directory'); return; }
        if (node.type === 'dir') {
          if (!p.flags.r) { errs.push('grep: ' + f + ': Is a directory'); return; }
          walkDir(f, f);
          return;
        }
        try { scanText(e.readFile(f), f); } catch (err) { errs.push(err.message); }
      });
    }

    var body = joinLines(out);
    var code = errs.length ? 2 : (totalHits ? 0 : 1);
    return { out: body, err: errs.length ? errs.join('\n') + '\n' : '', code: code };
  }, 'grep [-invclr] 模式 [文件…]', '按正则筛选行（-i 忽略大小写、-v 反选、-n 行号）');

  def('sed', function (args, ctx) {
    var e = ctx.engine;
    var p = parseArgs(args, 'e');
    var script = p.flags.e || p.operands[0];
    if (!script) return errtext('usage: sed [选项] 脚本 [文件…]');
    var files = p.flags.e ? p.operands : p.operands.slice(1);
    var rules = String(script).split(';').map(function (s) { return s.trim(); }).filter(Boolean);
    var esc = function (s) {
      return s.replace(/\\r/g, '\r').replace(/\\t/g, '\t').replace(/\\n/g, '\n');
    };

    function applyLine(line) {
      var keep = true, changed = line;
      rules.forEach(function (rule) {
        var sub = /^s([^\w\s])(.*?)\1(.*?)\1([gi]*)$/.exec(rule);
        if (sub) {
          try {
            changed = changed.replace(new RegExp(esc(sub[2]), sub[4].indexOf('g') >= 0 ? 'g' : ''), esc(sub[3]));
          } catch (err) { /* 忽略非法正则 */ }
          return;
        }
        var del = /^\/?(.*?)\/?d$/.exec(rule);
        if (del && (rule === 'd' || rule.charAt(rule.length - 1) === 'd')) {
          if (rule === 'd') { keep = false; return; }
          try {
            if (new RegExp(esc(del[1])).test(changed)) keep = false;
          } catch (err) { /* ignore */ }
        }
      });
      return { keep: keep, line: changed };
    }

    if (!files.length) {
      return oktext(joinLines(toLines(ctx.stdin || '').map(applyLine).filter(function (r) { return r.keep; }).map(function (r) { return r.line; })));
    }

    var errs = [], outLines = [];
    files.forEach(function (f) {
      try {
        var result = toLines(e.readFile(f)).map(applyLine);
        var text = joinLines(result.filter(function (r) { return r.keep; }).map(function (r) { return r.line; }));
        if (p.flags.i) {
          var msg = e.safeWrite(f, text, false);
          if (msg) errs.push(msg);
        } else outLines.push(text.replace(/\n$/, ''));
      } catch (err) { errs.push(err.message); }
    });
    return { out: p.flags.i ? '' : (outLines.length ? outLines.join('\n') + '\n' : ''), err: errs.join('\n') + (errs.length ? '\n' : ''), code: errs.length ? 1 : 0 };
  }, 'sed [-i] [-e] \'s/旧/新/g\' [文件…]', '流式编辑：替换 / 删除行（-i 直接改文件）');

  def('awk', function (args, ctx) {
    var e = ctx.engine;
    var p = parseArgs(args, 'F');
    var prog = p.operands[0];
    var files = p.operands.slice(1);
    if (!prog) return errtext('usage: awk [-F 分隔符] \'{print $1}\' [文件…]');
    var m3 = /^\s*(?:\/(.+)\/)?\s*\{([^}]*)\}\s*$/.exec(prog);
    if (!m3) return errtext('awk: 沙盒只支持 \'{print $1,$2}\' 这类简单程序（真机 awk 是完整语言）');
    var cond = m3[1];
    var body = m3[2];
    var sep = p.flags.F;
    var got = readAll(e, files, ctx.stdin);
    if (got.error) return errtext(got.error);

    var out = [];
    toLines(got.text).forEach(function (line, i) {
      if (cond && line.indexOf(cond) < 0) return;
      var fields = sep ? line.split(sep) : line.trim().split(/\s+/);
      body.split(';').forEach(function (stmt) {
        var sm = /^\s*print\s+(.+?)\s*$/.exec(stmt);
        if (!sm) return;
        var pieces = sm[1].split(',').map(function (tok) {
          var t = tok.trim();
          if (t === '$0') return line;
          var f = /^\$(\d+)$/.exec(t);
          if (f) return fields[parseInt(f[1], 10) - 1] == null ? '' : fields[parseInt(f[1], 10) - 1];
          if (t === 'NR') return String(i + 1);
          if (t === 'NF') return String(fields.length);
          if (/^".*"$/.test(t)) return t.slice(1, -1);
          return t;
        });
        out.push(pieces.join(' '));
      });
    });
    return oktext(joinLines(out));
  }, 'awk [-F 分隔符] \'{print $1}\' [文件…]', '按列处理文本（支持 {print $N}、NR、NF）');
  def('diff', function (args, ctx) {
    var e = ctx.engine;
    var p = parseArgs(args, '');
    if (p.operands.length < 2) return errtext('diff: 需要两个文件（diff 文件1 文件2）', 2);
    var a = p.operands[0], b = p.operands[1];
    var left, right;
    try { left = toLines(e.readFile(a)); } catch (err) { return errtext('diff: ' + a + ': No such file or directory', 2); }
    try { right = toLines(e.readFile(b)); } catch (err) { return errtext('diff: ' + b + ': No such file or directory', 2); }

    var same = left.length === right.length && left.every(function (l, i) { return l === right[i]; });
    if (same) return oktext('');
    if (p.flags.q) return { out: 'Files ' + a + ' and ' + b + ' differ\n', err: '', code: 1 };

    var out = [];
    if (p.flags.u) {
      out.push('--- ' + a);
      out.push('+++ ' + b);
      out.push('@@ -1,' + left.length + ' +1,' + right.length + ' @@');
      left.forEach(function (l) {
        if (right.indexOf(l) < 0) out.push('-' + l);
        else out.push(' ' + l);
      });
      right.forEach(function (l) {
        if (left.indexOf(l) < 0) out.push('+' + l);
      });
    } else {
      out.push('1,' + left.length + 'c1,' + right.length);
      left.forEach(function (l) { out.push('< ' + l); });
      out.push('---');
      right.forEach(function (l) { out.push('> ' + l); });
    }
    return { out: joinLines(out), err: '', code: 1 };
  }, 'diff [-u][-q] 文件1 文件2', '比较两个文本文件的差异（-u 统一格式）');

  /* ------------------------------ 查找与信息 ------------------------------ */

  def('find', function (args, ctx) {
    var e = ctx.engine;
    var paths = [], name = null, type = null, maxdepth = Infinity, mtime = null;
    var doDelete = false, execCmd = null;
    for (var i = 0; i < args.length; i++) {
      var a = args[i];
      if (a === '-name') { name = args[++i]; }
      else if (a === '-type') { type = args[++i]; }
      else if (a === '-maxdepth') { maxdepth = parseInt(args[++i], 10); }
      else if (a === '-mtime') { mtime = args[++i]; }
      else if (a === '-delete') { doDelete = true; }
      else if (a === '-exec') {
        execCmd = [];
        while (i + 1 < args.length && args[i + 1] !== ';' && args[i + 1] !== '\\;') execCmd.push(args[++i]);
        i += 1;
      }
      else if (a.charAt(0) !== '-') { paths.push(a); }
    }
    if (!paths.length) paths = ['.'];

    var rx = name ? globToRegExp(name) : null;
    var out = [], errs = [];

    function match(node, base) {
      if (type) {
        var t = node.type === 'dir' ? 'd' : (node.type === 'link' ? 'l' : 'f');
        if (t !== type) return false;
      }
      if (rx && !rx.test(base)) return false;
      if (mtime) {
        var days = (Date.now() - node.mtime) / 86400000;
        var n = parseInt(mtime.replace(/^[+-]/, ''), 10) || 0;
        if (mtime.charAt(0) === '+' && !(days > n)) return false;
        if (mtime.charAt(0) === '-' && !(days < n)) return false;
        if (mtime.charAt(0) !== '+' && mtime.charAt(0) !== '-' && Math.floor(days) !== n) return false;
      }
      return true;
    }

    function walk(path, depth) {
      var node = e.node(path);
      if (!node) return;
      if (depth > 0 && match(node, baseName(path))) {
        out.push(path);
        if (doDelete) {
          try { e.remove(path, true); return; } catch (err) { errs.push(err.message); }
        }
        if (execCmd) e.exec(execCmd.map(function (t) { return t === '{}' ? path : t; }).join(' '));
      }
      if (node.type === 'dir' && depth < maxdepth) {
        Object.keys(node.children).forEach(function (child) {
          walk(path.replace(/\/+$/, '') + '/' + child, depth + 1);
        });
      }
    }

    paths.forEach(function (p) {
      var node = e.node(p);
      if (!node) { errs.push('find: \'' + p + '\': No such file or directory'); return; }
      if (p !== '.' && match(node, baseName(p))) out.push(p);
      walk(p, 0);
    });

    return { out: joinLines(out), err: errs.length ? errs.join('\n') + '\n' : '', code: errs.length ? 1 : 0 };
  }, 'find [路径] [-name 模式][-type f|d][-mtime +N][-delete][-exec …]', '按名字 / 类型 / 时间查找文件');

  def('file', function (args, ctx) {
    var e = ctx.engine;
    if (!args.length) return errtext('Usage: file [文件…]');
    var out = [], errs = [];
    args.forEach(function (f) {
      var node = e.node(f);
      if (!node) { errs.push('file: cannot open \'' + f + '\' (No such file or directory)'); return; }
      var kind;
      if (node.type === 'dir') kind = 'directory';
      else if (node.type === 'link') kind = 'symbolic link to ' + node.target;
      else {
        var c = node.content || '';
        if (/^#!\/bin\/(ba)?sh/.test(c)) kind = 'Bourne-Again shell script, ASCII text executable';
        else if (/[\u4e00-\u9fa5]/.test(c)) kind = 'UTF-8 Unicode text';
        else if (/^[\x00-\x7F]*$/.test(c)) kind = 'ASCII text';
        else kind = 'data';
        if (node.gzContent != null) kind = 'gzip compressed data';
      }
      out.push(f + ': ' + kind);
    });
    return { out: joinLines(out), err: errs.length ? errs.join('\n') + '\n' : '', code: errs.length ? 1 : 0 };
  }, 'file 文件…', '判断文件的真实类型');

  def('stat', function (args, ctx) {
    var e = ctx.engine;
    var p = parseArgs(args, 'c');
    if (!p.operands.length) return errtext('stat: missing operand');
    var out = [], errs = [];
    p.operands.forEach(function (f) {
      var node = e.node(f);
      if (!node) { errs.push('stat: cannot statx \'' + f + '\': No such file or directory'); return; }
      var size = node.type === 'dir' ? 4096 : String(node.content || '').length;
      if (p.flags.c) {
        out.push(String(p.flags.c).replace(/%s/g, String(size)).replace(/%n/g, f));
        return;
      }
      out.push('  File: ' + f);
      out.push('  Size: ' + String(size).padEnd(10, ' ') + 'Blocks: 8    IO Block: 4096   ' + (node.type === 'dir' ? 'directory' : 'regular file'));
      out.push('Device: 8,1\tInode: 13' + (100 + f.length * 7) + '\tLinks: 1');
      out.push('Access: (' + String(node.mode).padStart(4, '0') + '/' + modeString(node.mode, node.type) + ')  Uid: ( 1000/  ' + (node.owner || 'student') + ')   Gid: ( 1000/  ' + (node.group || 'student') + ')');
      out.push('Modify: ' + new Date(node.mtime).toISOString().replace('T', ' ').slice(0, 19) + ' +0800');
      out.push('');
    });
    return { out: joinLines(out), err: errs.length ? errs.join('\n') + '\n' : '', code: errs.length ? 1 : 0 };
  }, 'stat [-c 格式] 文件…', '查看文件元信息（inode、权限、时间戳）');
  function dirSize(node) {
    if (node.type !== 'dir') return String(node.content || '').length;
    return Object.keys(node.children).reduce(function (sum, k) { return sum + dirSize(node.children[k]); }, 0);
  }

  def('du', function (args, ctx) {
    var e = ctx.engine;
    var p = parseArgs(args, '');
    var targets = p.operands.length ? p.operands : ['.'];
    var out = [], errs = [];
    targets.forEach(function (t) {
      var node = e.node(t);
      if (!node) { errs.push('du: cannot access \'' + t + '\': No such file or directory'); return; }
      var kb = Math.max(4, Math.ceil(dirSize(node) / 1024));
      out.push((p.flags.h ? (kb >= 1024 ? (kb / 1024).toFixed(1) + 'M' : kb + 'K') : String(kb)) + '\t' + t);
    });
    return { out: joinLines(out), err: errs.length ? errs.join('\n') + '\n' : '', code: errs.length ? 1 : 0 };
  }, 'du [-s][-h] [路径…]', '统计目录占用的磁盘空间（-sh 只看汇总）');

  def('df', function (args, ctx) {
    return oktext(joinLines([
      'Filesystem      Size  Used Avail Use% Mounted on',
      '/dev/sdc        251G   38G  200G  16% /',
      'tmpfs           3.9G     0  3.9G   0% /dev/shm',
      'C:\\            476G  322G  155G  68% /mnt/c'
    ]));
  }, 'df [-h]', '查看磁盘分区使用情况');

  def('which', function (args, ctx) {
    if (!args.length) return errtext('which: missing argument');
    var out = [], errs = [];
    args.forEach(function (name) {
      if (COMMANDS[name]) out.push('/usr/bin/' + name);
      else errs.push('which: no ' + name + ' in (/usr/local/bin:/usr/bin:/bin)');
    });
    return { out: joinLines(out), err: errs.length ? errs.join('\n') + '\n' : '', code: errs.length ? 1 : 0 };
  }, 'which 命令…', '查看命令的可执行文件路径');

  def('type', function (args, ctx) {
    var e = ctx.engine;
    var out = [];
    args.forEach(function (name) {
      if (e.aliases[name]) out.push(name + ' is aliased to `' + e.aliases[name] + '\'');
      else if (COMMANDS[name]) out.push(name + ' is /usr/bin/' + name);
      else out.push('bash: type: ' + name + ': not found');
    });
    return oktext(joinLines(out));
  }, 'type 命令…', '判断命令是别名、内置命令还是可执行文件');

  /* -------------------------------- 权限 -------------------------------- */

  def('chmod', function (args, ctx) {
    var e = ctx.engine;
    var p = parseArgs(args, '');
    if (p.operands.length < 2) return errtext('chmod: missing operand');
    var modeArg = p.operands[0];
    var targets = p.operands.slice(1);
    var errs = [];

    function applySymbolic(mode, spec) {
      spec.split(',').forEach(function (part) {
        var m4 = /^([ugoa]*)([+\-=])([rwxst]*)$/.exec(part);
        if (!m4) return;
        var who = m4[1] || 'a';
        var op = m4[2];
        var perms = m4[3];
        var whoList = who === 'a' ? ['u', 'g', 'o'] : who.split('');
        whoList.forEach(function (w) {
          var shift = w === 'u' ? 6 : (w === 'g' ? 3 : 0);
          var bits = 0;
          if (perms.indexOf('r') >= 0) bits |= 4;
          if (perms.indexOf('w') >= 0) bits |= 2;
          if (perms.indexOf('x') >= 0) bits |= 1;
          var cur = (mode >> shift) & 7;
          if (op === '+') cur |= bits;
          else if (op === '-') cur &= ~bits;
          else cur = bits;
          mode = (mode & ~(7 << shift)) | (cur << shift);
        });
      });
      return mode;
    }

    targets.forEach(function (f) {
      var node = e.node(f, true);
      if (!node) { errs.push('chmod: cannot access \'' + f + '\': No such file or directory'); return; }
      if (node.owner !== e.env.USER && !e.rootOnly) {
        errs.push('chmod: changing permissions of \'' + f + '\': Operation not permitted');
        return;
      }
      var mode = node.mode;
      if (/^[0-7]{3,4}$/.test(modeArg)) mode = m(modeArg);
      else mode = applySymbolic(mode, modeArg);
      node.mode = mode;
    });
    return { out: '', err: errs.length ? errs.join('\n') + '\n' : '', code: errs.length ? 1 : 0 };
  }, 'chmod 权限 文件…', '修改权限（数字 755 或符号 u+x）');

  def('chown', function (args, ctx) {
    var e = ctx.engine;
    var p = parseArgs(args, '');
    if (p.operands.length < 2) return errtext('chown: missing operand');
    var spec = p.operands[0];
    var targets = p.operands.slice(1);
    var errs = [];
    if (!e.rootOnly) return errtext('chown: changing ownership of \'' + targets[0] + '\': Operation not permitted（需要 sudo）');
    targets.forEach(function (f) {
      var node = e.node(f, true);
      if (!node) { errs.push('chown: cannot access \'' + f + '\': No such file or directory'); return; }
      var parts = spec.split(':');
      if (parts[0]) node.owner = parts[0];
      if (parts[1]) node.group = parts[1];
    });
    return { out: '', err: errs.length ? errs.join('\n') + '\n' : '', code: errs.length ? 1 : 0 };
  }, 'chown 用户[:组] 文件…', '修改属主（需要 sudo）');

  def('umask', function (args, ctx) {
    var e = ctx.engine;
    if (!args.length) return oktext('0' + e.umask.toString(8).padStart(3, '0') + '\n');
    if (!/^[0-7]{1,4}$/.test(args[0])) return errtext('bash: umask: ' + args[0] + ': octal number out of range');
    e.umask = m(args[0]);
    return oktext('');
  }, 'umask [值]', '查看 / 设置新建文件的默认权限掩码');
  /* ------------------------------ 用户与系统 ------------------------------ */

  def('whoami', function (args, ctx) {
    return oktext((ctx.engine.rootOnly ? 'root' : ME.user) + '\n');
  }, 'whoami', '显示当前用户名');

  def('id', function (args, ctx) {
    var e = ctx.engine;
    var p = parseArgs(args, '');
    var user = e.rootOnly ? 'root' : ME.user;
    if (p.flags.Gn || (p.flags.G && p.flags.n)) return oktext(user + ' adm sudo\n');
    if (p.flags.G) return oktext('1000 4 27\n');
    if (p.flags.u) return oktext((e.rootOnly ? '0' : '1000') + '\n');
    return oktext('uid=' + (e.rootOnly ? '0(root)' : '1000(' + user + ')') +
      ' gid=1000(' + user + ') groups=1000(' + user + '),4(adm),27(sudo)\n');
  }, 'id [-u][-g][-Gn]', '显示用户 UID / GID / 所属组');

  def('groups', function (args, ctx) {
    return oktext((ctx.engine.rootOnly ? 'root' : ME.user) + ' adm sudo\n');
  }, 'groups', '显示当前用户所属的所有组');

  var BOOT_TIME = NOW - 1000 * 60 * 60 * 27 - 1000 * 60 * 14;

  def('ps', function (args, ctx) {
    var e = ctx.engine;
    var rows = [
      'UID        PID  PPID  C STIME TTY          TIME CMD',
      'root         1     0  0 08:31 ?        00:00:02 /sbin/init',
      'root       812     1  0 08:32 ?        00:00:00 /usr/sbin/sshd -D',
      'www-data   901     1  0 08:33 ?        00:00:00 nginx: worker process',
      'student   1042  1041  0 09:01 pts/0    00:00:00 -bash'
    ];
    e.jobs.forEach(function (j, idx) {
      rows.push('student   ' + String(j.pid).padStart(5, ' ') + '  1042  0 09:20 pts/0    00:00:00 ' + j.cmd);
    });
    var last = args[args.length - 1];
    if (last && last !== '-ef' && last !== 'aux' && last.charAt(0) !== '-') {
      rows = [rows[0]].concat(rows.slice(1).filter(function (r) { return r.indexOf(last) >= 0; }));
    }
    return oktext(joinLines(rows));
  }, 'ps [-ef|aux] [关键字]', '查看进程列表');

  def('pgrep', function (args, ctx) {
    var e = ctx.engine;
    var p = parseArgs(args, '');
    var name = p.operands[0];
    if (!name) return errtext('pgrep: no matching criteria specified');
    var hits = e.jobs.filter(function (j) { return j.cmd.indexOf(name) >= 0; });
    if (!hits.length) return { out: '', err: '', code: 1 };
    return oktext(joinLines(hits.map(function (j) { return (p.flags.l ? j.pid + ' ' + j.cmd : String(j.pid)); })));
  }, 'pgrep [-l] 名字', '按名字查找进程号');

  def('pkill', function (args, ctx) {
    var e = ctx.engine;
    var p = parseArgs(args, '');
    var name = p.operands[0];
    if (!name) return errtext('pkill: no matching criteria specified');
    var before = e.jobs.length;
    e.jobs = e.jobs.filter(function (j) { return j.cmd.indexOf(name) < 0; });
    if (before === e.jobs.length) return { out: '', err: '', code: 1 };
    return oktext('');
  }, 'pkill [-9] 名字', '按名字结束进程');

  def('kill', function (args, ctx) {
    var e = ctx.engine;
    var p = parseArgs(args, '');
    var pid = parseInt(p.operands[0], 10);
    if (!pid) return errtext('kill: usage: kill [-9] pid');
    var idx = -1;
    e.jobs.forEach(function (j, i) { if (j.pid === pid) idx = i; });
    if (idx < 0) return errtext('bash: kill: (' + pid + ') - No such process');
    e.jobs.splice(idx, 1);
    return oktext('');
  }, 'kill [-9] PID', '向进程发送信号（-9 强制结束）');

  def('jobs', function (args, ctx) {
    var e = ctx.engine;
    if (!e.jobs.length) return oktext('');
    var p = parseArgs(args, '');
    return oktext(joinLines(e.jobs.map(function (j, i) {
      return '[' + (i + 1) + ']' + (i === e.jobs.length - 1 ? '+' : '-') + '  ' +
        (p.flags.l ? j.pid + ' ' : '') + j.cmd;
    })));
  }, 'jobs [-l]', '查看当前终端的后台作业');

  def('free', function (args, ctx) {
    var p = parseArgs(args, '');
    if (p.flags.h) {
      return oktext(joinLines([
        '               total        used        free      shared  buff/cache   available',
        'Mem:           7.8Gi       2.1Gi       4.9Gi        12Mi       812Mi       5.4Gi',
        'Swap:          2.0Gi          0B       2.0Gi'
      ]));
    }
    return oktext(joinLines([
      '               total        used        free      shared  buff/cache   available',
      'Mem:         8178892     2201900     5140000       12288      832000     5660000',
      'Swap:        2097152           0     2097152'
    ]));
  }, 'free [-h]', '查看内存使用情况');

  def('uptime', function (args, ctx) {
    var mins = Math.floor((Date.now() - BOOT_TIME) / 60000);
    var h = Math.floor(mins / 60), mm = mins % 60;
    var clock = new Date().toTimeString().slice(0, 8);
    return oktext(' ' + clock + ' up ' + h + ':' + pad2(mm) + ',  1 user,  load average: 0.08, 0.12, 0.09\n');
  }, 'uptime', '查看运行时长与平均负载');
  def('date', function (args, ctx) {
    var p = parseArgs(args, 'd');
    var base = new Date();
    if (p.flags.d) {
      var spec = String(p.flags.d);
      if (/yesterday/i.test(spec)) base.setDate(base.getDate() - 1);
      else if (/tomorrow/i.test(spec)) base.setDate(base.getDate() + 1);
      else {
        var dm = /([+-]?\d+)\s*day/i.exec(spec);
        if (dm) base.setDate(base.getDate() + parseInt(dm[1], 10));
      }
    }
    var fmt = p.operands[0] || '';
    if (!fmt) return oktext(base.toString().replace(/GMT[+-]?\d+.*$/, 'CST') + '\n');
    if (fmt.charAt(0) !== '+') return errtext('date: invalid option -- \'' + fmt + '\'');
    var two = function (n) { return String(n).padStart(2, '0'); };
    var out = fmt.slice(1).replace(/%([FTYmdHMS%])/g, function (all, code) {
      switch (code) {
        case 'F': return base.getFullYear() + '-' + two(base.getMonth() + 1) + '-' + two(base.getDate());
        case 'T': return two(base.getHours()) + ':' + two(base.getMinutes()) + ':' + two(base.getSeconds());
        case 'Y': return String(base.getFullYear());
        case 'm': return two(base.getMonth() + 1);
        case 'd': return two(base.getDate());
        case 'H': return two(base.getHours());
        case 'M': return two(base.getMinutes());
        case 'S': return two(base.getSeconds());
        case '%': return '%';
        default: return all;
      }
    });
    return oktext(out + '\n');
  }, 'date [+格式] [-d 时间描述]', '显示 / 格式化时间（%F、%T、yesterday）');

  def('uname', function (args, ctx) {
    var p = parseArgs(args, '');
    var release = '5.15.153.1-microsoft-standard-WSL2';
    var arch = 'x86_64';
    if (p.flags.r) return oktext(release + '\n');
    if (p.flags.m) return oktext(arch + '\n');
    if (p.flags.n) return oktext(ME.host + '\n');
    if (p.flags.a) {
      return oktext('Linux ' + ME.host + ' ' + release + ' #1 SMP Fri Mar 29 23:14:13 UTC 2024 ' + arch + ' ' + arch + ' ' + arch + ' GNU/Linux\n');
    }
    return oktext('Linux\n');
  }, 'uname [-a][-r][-m][-n]', '显示内核 / 架构信息');

  def('hostname', function (args, ctx) {
    var p = parseArgs(args, '');
    if (p.flags.I) return oktext('172.24.118.5\n');
    return oktext(ME.host + '\n');
  }, 'hostname [-I]', '显示主机名（-I 显示 IP）');

  def('nproc', function (args, ctx) {
    return oktext('8\n');
  }, 'nproc', '显示可用 CPU 核心数');

  def('lscpu', function (args, ctx) {
    return oktext(joinLines([
      'Architecture:            x86_64',
      '  CPU op-mode(s):        32-bit, 64-bit',
      '  Model name:            Intel(R) Core(TM) i7-10750H CPU @ 2.60GHz',
      '  CPU(s):                8',
      '  Thread(s) per core:    2',
      '  Core(s) per socket:    4',
      '  Socket(s):             1',
      'Virtualization features:',
      '  Hypervisor vendor:     Microsoft',
      '  Virtualization type:   full'
    ]));
  }, 'lscpu', '显示 CPU 详细信息');

  def('env', function (args, ctx) {
    var e = ctx.engine;
    return oktext(joinLines(Object.keys(e.env).sort().map(function (k) { return k + '=' + e.env[k]; })));
  }, 'env', '显示所有环境变量');

  def('printenv', function (args, ctx) {
    var e = ctx.engine;
    if (!args.length) return COMMANDS.env([], ctx);
    return oktext(args.map(function (k) { return e.env[k] == null ? '' : e.env[k] + '\n'; }).join(''));
  }, 'printenv [变量名]', '显示环境变量');

  def('export', function (args, ctx) {
    var e = ctx.engine;
    if (!args.length) {
      return oktext(joinLines(Object.keys(e.env).sort().map(function (k) { return 'declare -x ' + k + '="' + e.env[k] + '"'; })));
    }
    args.forEach(function (a) {
      var idx = a.indexOf('=');
      if (idx > 0) e.env[a.slice(0, idx)] = a.slice(idx + 1);
    });
    return oktext('');
  }, 'export 变量=值', '设置并导出环境变量');

  def('unset', function (args, ctx) {
    var e = ctx.engine;
    args.forEach(function (a) { delete e.env[a]; });
    return oktext('');
  }, 'unset 变量名', '删除环境变量');
  def('alias', function (args, ctx) {
    var e = ctx.engine;
    if (!args.length) {
      return oktext(joinLines(Object.keys(e.aliases).sort().map(function (k) {
        return 'alias ' + k + '=\'' + e.aliases[k] + '\'';
      })));
    }
    args.forEach(function (a) {
      var idx = a.indexOf('=');
      if (idx > 0) e.aliases[a.slice(0, idx)] = a.slice(idx + 1);
    });
    return oktext('');
  }, 'alias [名字=命令]', '查看 / 定义命令别名');

  def('unalias', function (args, ctx) {
    args.forEach(function (a) { delete ctx.engine.aliases[a]; });
    return oktext('');
  }, 'unalias 名字', '删除命令别名');

  def('history', function (args, ctx) {
    var e = ctx.engine;
    var p = parseArgs(args, '');
    if (p.flags.c) { e.history = []; return oktext(''); }
    var n = parseInt(p.operands[0], 10);
    var list = e.history.map(function (cmd, i) { return String(i + 1).padStart(5, ' ') + '  ' + cmd; });
    if (!isNaN(n)) list = list.slice(Math.max(0, list.length - n));
    return oktext(joinLines(list));
  }, 'history [N] [-c]', '查看历史命令（-c 清空）');

  def('clear', function (args, ctx) {
    ctx.engine.lastAction = 'clear';
    return oktext('');
  }, 'clear', '清屏（等价 Ctrl+L）');

  def('help', function (args, ctx) {
    var names = Object.keys(DOCS).sort();
    return oktext('本站沙盒支持的命令（共 ' + names.length + ' 个）：\n' +
      names.map(function (n) { return '  ' + DOCS[n].usage; }).join('\n') +
      '\n\n提示：man 命令名 查看说明；沙盒不执行真实程序，也不联网。\n');
  }, 'help', '列出沙盒支持的所有命令');

  def('man', function (args, ctx) {
    var name = args[0];
    if (!name) return errtext('What manual page do you want?');
    var doc = DOCS[name];
    if (!doc) return errtext('No manual entry for ' + name);
    return oktext([
      name.toUpperCase() + '(1)                Linux 沙盒手册                ' + name.toUpperCase() + '(1)',
      '',
      '名称',
      '       ' + name + ' — ' + doc.desc,
      '',
      '用法',
      '       ' + doc.usage,
      '',
      '说明',
      '       沙盒实现的是真机命令的教学子集；完整行为请以真机 man 手册为准。',
      ''
    ].join('\n'));
  }, 'man 命令', '查看命令说明（沙盒版手册）');

  def('sleep', function (args, ctx) {
    return oktext('');
  }, 'sleep 秒数', '暂停若干秒（沙盒里立即返回）');

  def('set', function (args, ctx) {
    var e = ctx.engine;
    args.forEach(function (a) {
      if (a === '-e') e.setE = true;
      else if (a === '+e') e.setE = false;
      else if (a === '-x') { e.setX = true; e.trace = true; }
      else if (a === '+x') { e.setX = false; e.trace = false; }
    });
    return oktext('');
  }, 'set [-e][-x]', '设置 Shell 选项（-e 出错退出、-x 追踪）');

  def('su', function (args, ctx) {
    return oktext('（沙盒固定以 student 身份运行，不模拟 su 切换；真机请用 su - 用户名 或 sudo）\n');
  }, 'su [- 用户]', '切换用户（沙盒只给提示）');

  def('exit', function (args, ctx) {
    ctx.engine.lastAction = 'exit';
    return oktext('');
  }, 'exit [码]', '退出当前 Shell');
  /* ---------------------- 压缩 / 归档（简化但可用） ---------------------- */

  function archiveEntries(e, path) {
    var entries = [];
    (function walk(p) {
      var node = e.node(p);
      if (!node) return;
      entries.push({ path: p, type: node.type, content: node.content, mode: node.mode, mtime: node.mtime });
      if (node.type === 'dir') {
        Object.keys(node.children).forEach(function (child) {
          walk(p.replace(/\/+$/, '') + '/' + child);
        });
      }
    })(path);
    return entries;
  }

  function makeArchive(e, outName, sources, kind) {
    var entries = [], errs = [];
    sources.forEach(function (s) {
      var node = e.node(s);
      if (!node) { errs.push(kind + ': ' + s + ': No such file or directory'); return; }
      entries = entries.concat(archiveEntries(e, s));
    });
    if (errs.length) return errs;
    e.writeFile(outName, '', false);
    var created = e.node(outName);
    if (created) {
      created.archive = kind;
      created.archiveEntries = entries;
    }
    return null;
  }

  def('tar', function (args, ctx) {
    var e = ctx.engine;
    var queue = args.slice();
    var op = '';
    var file = null;

    /* 支持 -czf 这种"操作字母 + f 值"的紧凑写法 */
    if (queue[0] && queue[0].charAt(0) === '-') {
      var letters = queue.shift().slice(1);
      op = letters.replace(/[^ctxzjv]/g, '');
      var idxF = letters.indexOf('f');
      if (idxF >= 0) {
        var tail = letters.slice(idxF + 1);
        file = tail || queue.shift() || null;
      }
    } else {
      op = queue.shift() || '';
    }
    var operands = queue.filter(function (a) { return a !== '--'; });

    if (op.indexOf('t') >= 0) {
      var node = e.node(file);
      if (!node) return errtext('tar: ' + file + ': Cannot open: No such file or directory');
      return oktext(joinLines((node.archiveEntries || []).map(function (x) { return x.path; })));
    }
    if (op.indexOf('x') >= 0) {
      var arch = e.node(file);
      if (!arch) return errtext('tar: ' + file + ': Cannot open: No such file or directory');
      (arch.archiveEntries || []).forEach(function (x) {
        try {
          if (x.type === 'dir') e.mkdirp(x.path);
          else e.writeFile(x.path, x.content || '', false);
        } catch (err) { /* ignore */ }
      });
      return oktext('');
    }
    if (!file) return errtext('tar: Refusing to write archive contents to terminal (missing -f option?)');
    if (!operands.length) return errtext('tar: Cowardly refusing to create an empty archive');
    var errs = makeArchive(e, file, operands, 'tar');
    if (errs) return errtext(errs.join('\n'));
    return oktext('');
  }, 'tar -czf 包.tar.gz 目录 / -tzf / -xzf', '打包与解包（沙盒只记录结构，不做真实压缩）');

  def('gzip', function (args, ctx) {
    var e = ctx.engine;
    var p = parseArgs(args, '');
    if (p.flags.d) return COMMANDS.gunzip(p.operands, ctx);
    if (!p.operands.length) return errtext('gzip: compressed data not written to a terminal');
    var errs = [];
    p.operands.forEach(function (f) {
      try {
        var content = e.readFile(f);
        e.writeFile(f + '.gz', '', false);
        var gz = e.node(f + '.gz');
        gz.gzContent = content;
        if (!p.flags.k) e.remove(f, false);
      } catch (err) { errs.push(err.message); }
    });
    return { out: '', err: errs.length ? errs.join('\n') + '\n' : '', code: errs.length ? 1 : 0 };
  }, 'gzip [-k][-d] 文件…', '压缩文件（生成 .gz，-k 保留原文件）');

  def('gunzip', function (args, ctx) {
    var e = ctx.engine;
    var p = parseArgs(args, '');
    var errs = [];
    p.operands.forEach(function (f) {
      var node = e.node(f);
      if (!node) { errs.push('gunzip: ' + f + ': No such file or directory'); return; }
      if (node.gzContent == null) { errs.push('gunzip: ' + f + ': not in gzip format'); return; }
      if (p.flags.c) return;
      try {
        e.writeFile(f.replace(/\.gz$/, ''), node.gzContent, false);
        e.remove(f, false);
      } catch (err) { errs.push(err.message); }
    });
    return { out: '', err: errs.length ? errs.join('\n') + '\n' : '', code: errs.length ? 1 : 0 };
  }, 'gunzip 文件.gz', '解压 .gz 文件');

  def('zcat', function (args, ctx) {
    var e = ctx.engine;
    var out = '', errs = [];
    args.forEach(function (f) {
      var node = e.node(f);
      if (!node) { errs.push('zcat: ' + f + ': No such file or directory'); return; }
      if (node.gzContent == null) { errs.push('zcat: ' + f + ': not in gzip format'); return; }
      out += node.gzContent;
    });
    return { out: out, err: errs.length ? errs.join('\n') + '\n' : '', code: errs.length ? 1 : 0 };
  }, 'zcat 文件.gz', '不解压直接查看 .gz 内容');
  def('xargs', function (args, ctx) {
    var e = ctx.engine;
    var p = parseArgs(args, 'In');
    var template = p.operands.length ? p.operands : ['echo'];
    var input = ctx.stdin || '';
    var items = input.split(/\s+/).filter(Boolean);
    if (!items.length) return oktext('');
    var out = '';

    if (p.flags.I) {
      items.forEach(function (item) {
        var line = template.map(function (tok) { return tok.split(p.flags.I).join(item); }).join(' ');
        var r = e.exec(line);
        out += r.out + r.err;
      });
      return oktext(out);
    }

    var batch = parseInt(p.flags.n, 10) || items.length;
    for (var i = 0; i < items.length; i += batch) {
      var r2 = e.exec(template.concat(items.slice(i, i + batch)).join(' '));
      out += r2.out + r2.err;
    }
    return oktext(out);
  }, 'xargs [-n N][-I {}] 命令', '把标准输入变成命令参数（常接 find）');

  def('nohup', function (args, ctx) {
    if (!args.length) return errtext('nohup: missing operand');
    var r = ctx.engine.runWords(args, ctx.stdin);
    return {
      out: 'nohup: 忽略输入并把输出追加到 \'nohup.out\'\n' + (r.out || ''),
      err: r.err,
      code: r.code
    };
  }, 'nohup 命令 &', '忽略挂起信号运行命令（关终端也不退出）');

  def('zip', function (args, ctx) {
    var e = ctx.engine;
    var p = parseArgs(args, '');
    var op = p.operands;
    if (op.length < 2) return errtext('zip error: Nothing to do!');
    var outName = op[0], srcs = op.slice(1);
    var errs = [];
    srcs.forEach(function (s) {
      var node = e.node(s);
      if (!node) { errs.push('\tzip warning: name not matched: ' + s); return; }
      if (node.type === 'dir' && !p.flags.r) errs.push('\tzip warning: ' + s + ' is a directory (use -r)');
    });
    if (errs.length) return errtext(errs.join('\n'));
    var bad = makeArchive(e, outName, srcs, 'zip');
    if (bad) return errtext(bad.join('\n'));
    return oktext('  adding: ' + srcs.join(', ') + ' (stored 0%)\n');
  }, 'zip [-r] 包.zip 目录', '创建 zip 压缩包（Windows 可直接解压）');

  def('unzip', function (args, ctx) {
    var e = ctx.engine;
    var p = parseArgs(args, '');
    var file = p.operands[0];
    if (!file) return errtext('UnZip 6.00  usage: unzip file.zip');
    var node = e.node(file);
    if (!node) return errtext('unzip:  cannot find or open ' + file);
    var entries = node.archiveEntries || [];
    if (p.flags.l) return oktext(joinLines(entries.map(function (x) { return '  ' + x.path; })));
    entries.forEach(function (x) {
      try {
        if (x.type === 'dir') e.mkdirp(x.path);
        else e.writeFile(x.path, x.content || '', false);
      } catch (err) { /* ignore */ }
    });
    return oktext('Archive:  ' + file + '\n  inflating: ' + entries.length + ' entries\n');
  }, 'unzip [-l] 包.zip', '解压 zip（-l 只看清单）');

  /* ---------------------- 网络 / 服务相关（模拟输出） ---------------------- */

  var MOCK_HTTP = [
    'HTTP/1.1 200 OK',
    'Date: Wed, 28 Oct 2026 02:12:33 GMT',
    'Content-Type: text/html; charset=UTF-8',
    'Content-Length: 1256',
    'Connection: keep-alive',
    'Server: nginx'
  ].join('\n');

  def('curl', function (args, ctx) {
    var e = ctx.engine;
    var p = parseArgs(args, 'Oo');
    var url = p.operands[0] || '';
    if (!url) return errtext('curl: try \'curl --help\' for more information');
    if (p.flags.I) return oktext(MOCK_HTTP + '\n\n');
    if (p.flags.O) {
      var name = baseName(url) || 'index.html';
      e.safeWrite(name, '<!DOCTYPE html>\n<html><body>sandbox download</body></html>\n', false);
      return oktext('  % Total    % Received\n100 1256  100 1256    0     0   6218      0 --:--:-- --:--:-- --:--:--  6218\n');
    }
    return oktext('<!DOCTYPE html>\n<html><body>这是沙盒模拟的响应（真机返回 ' + url + ' 的真实内容）</body></html>\n');
  }, 'curl [-I][-O] URL', 'HTTP 客户端（沙盒返回模拟响应）');

  def('wget', function (args, ctx) {
    var e = ctx.engine;
    var p = parseArgs(args, 'O');
    var url = p.operands[0] || '';
    if (!url) return errtext('wget: missing URL');
    var name = p.flags.O || baseName(url) || 'index.html';
    e.safeWrite(name, '<!DOCTYPE html>\n<html><body>sandbox download</body></html>\n', false);
    return oktext([
      '--2026-10-28 10:12:33--  ' + url,
      'Resolving example.com (example.com)... 93.184.216.34',
      'Connecting to example.com|93.184.216.34|:443... connected.',
      'HTTP request sent, awaiting response... 200 OK',
      'Length: 1256 (1.2K) [text/html]',
      'Saving to: \'' + name + '\'',
      '',
      '\'' + name + '\' saved [1256/1256]'
    ].join('\n') + '\n');
  }, 'wget [-c][-O 文件名] URL', '下载文件（沙盒只写一个占位文件）');

  function offlineNotice(cmd, target) {
    return '（沙盒不联网：' + cmd + ' ' + (target || '') + ' 未真正执行）\n' +
      '真机上这条命令会通过 SSH 连接远程主机。\n';
  }

  def('ssh', function (args, ctx) {
    return oktext(offlineNotice('ssh', args.join(' ')));
  }, 'ssh 用户名@主机', '远程登录（沙盒只提示）');

  def('scp', function (args, ctx) {
    return oktext(offlineNotice('scp', args.join(' ')));
  }, 'scp 源 用户@主机:路径', '远程复制（沙盒只提示）');
  def('rsync', function (args, ctx) {
    var e = ctx.engine;
    var p = parseArgs(args, '');
    var op = p.operands;
    if (op.length < 2) return errtext('rsync: missing destination');
    var src = op[0], dest = op[1];
    var node = e.node(src);
    if (!node) return errtext('rsync: link_stat "' + src + '" failed: No such file or directory (2)');
    var lines = ['sending incremental file list'];
    if (node.type === 'dir') {
      Object.keys(node.children).forEach(function (child) {
        lines.push(src.replace(/\/+$/, '') + '/' + child);
      });
    } else lines.push(baseName(src));
    if (!p.flags.n) {
      if (src.charAt(src.length - 1) === '/' && node.type === 'dir') {
        try {
          e.mkdirp(dest);
          Object.keys(node.children).forEach(function (child) {
            e.safeWrite(dest.replace(/\/+$/, '') + '/' + child, node.children[child].content || '', false);
          });
        } catch (err) { return errtext(err.message); }
      } else {
        var target = e.node(dest);
        var destPath = target && target.type === 'dir' ? dest.replace(/\/+$/, '') + '/' + baseName(src) : dest;
        var msg = copyNode(node, destPath, e, []);
        if (msg) return errtext(msg.replace(/^cp:/, 'rsync:'));
      }
    }
    lines.push('');
    lines.push('sent ' + (node.type === 'dir' ? 128 : String(node.content || '').length) + ' bytes  received 35 bytes  326.00 bytes/sec');
    lines.push('total size is ' + dirSize(node) + '  speedup is 1.00' + (p.flags.n ? ' (dry run)' : ''));
    return oktext(joinLines(lines));
  }, 'rsync [-av][-n] 源/ 目标/', '增量同步（-n 演练；沙盒用本地复制模拟）');

  def('tmux', function (args, ctx) {
    var e = ctx.engine;
    e.tmuxSessions = e.tmuxSessions || [];
    var sub = args[0] || '';
    if (sub === 'new' || sub === 'new-session' || sub === 'new-s') {
      var p = parseArgs(args.slice(1), 's');
      var name = p.flags.s || 'session' + (e.tmuxSessions.length + 1);
      e.tmuxSessions.push(name);
      return oktext('（沙盒不模拟真实 tmux 界面；已登记会话 ' + name + '）\n');
    }
    if (sub === 'ls' || sub === 'list-sessions') {
      if (!e.tmuxSessions.length) return errtext('no server running on /tmp/tmux-1000/default');
      return oktext(e.tmuxSessions.map(function (n) { return n + ': 1 windows (created Wed Oct 28 10:12:33 2026)'; }).join('\n') + '\n');
    }
    if (sub === 'kill-session') {
      var p2 = parseArgs(args.slice(1), 't');
      e.tmuxSessions = e.tmuxSessions.filter(function (n) { return n !== p2.flags.t; });
      return oktext('');
    }
    return oktext('（沙盒不模拟真实 tmux；前缀键默认 Ctrl+B，按 d 分离）\n');
  }, 'tmux new -s 名字 / ls / a -t 名字', '终端会话保持（沙盒只登记会话）');

  def('systemctl', function (args, ctx) {
    var e = ctx.engine;
    e.services = e.services || {};
    var sub = args[0], svc = args[1];
    if (!svc) return errtext('systemctl: 需要服务名，例如 systemctl status nginx');
    if (sub === 'status') {
      var running = e.services[svc] === 'running';
      return oktext([
        (running ? '●' : '○') + ' ' + svc + '.service',
        '     Loaded: loaded (/lib/systemd/system/' + svc + '.service; enabled; vendor preset: enabled)',
        '     Active: ' + (running ? 'active (running)' : 'inactive (dead)'),
        '   Main PID: ' + (running ? '901 (' + svc + ')' : '0') + '   Tasks: ' + (running ? '3' : '0') + '   Memory: ' + (running ? '6.2M' : '0B')
      ].join('\n') + '\n');
    }
    if (sub === 'start' || sub === 'restart' || sub === 'enable') {
      e.services[svc] = 'running';
      return oktext('（沙盒模拟）' + svc + ' 已' + (sub === 'enable' ? '设为开机自启并启动' : '启动') + '\n');
    }
    if (sub === 'stop' || sub === 'disable') {
      e.services[svc] = 'stopped';
      return oktext('（沙盒模拟）' + svc + ' 已停止\n');
    }
    return oktext('（沙盒只实现 status / start / stop / restart / enable / disable）\n');
  }, 'systemctl status|start|stop 服务名', '管理 systemd 服务（沙盒为模拟）');

  def('journalctl', function (args, ctx) {
    var e = ctx.engine;
    var p = parseArgs(args, 'un');
    var all = toLines(e.readFile('/var/log/syslog') || '');
    if (p.flags.u) {
      var map = { ssh: 'sshd', sshd: 'sshd', nginx: 'nginx', cron: 'CRON' };
      var key = map[String(p.flags.u)] || String(p.flags.u);
      all = all.filter(function (l) { return l.indexOf(key) >= 0; });
    }
    var n = p.flags.n ? parseInt(p.flags.n, 10) : 10;
    if (!isNaN(n)) all = all.slice(Math.max(0, all.length - n));
    return oktext(all.length ? joinLines(all) : '-- No entries --\n');
  }, 'journalctl [-u 服务][-n N]', '查看 systemd 日志（沙盒读 /var/log/syslog）');

  def('lsof', function (args, ctx) {
    var p = parseArgs(args, 'i');
    if (p.flags.i) {
      var port = String(p.flags.i).replace(/^:/, '');
      if (port === '8080') {
        return oktext([
          'COMMAND  PID USER   FD   TYPE DEVICE SIZE/OFF NODE NAME',
          'node    2210 student  22u  IPv6  41234      0t0  TCP *:8080 (LISTEN)'
        ].join('\n') + '\n');
      }
      return { out: '', err: '', code: 1 };
    }
    return errtext('lsof: 沙盒只支持 lsof -i :端口');
  }, 'lsof -i :端口', '查看端口占用（沙盒只认 8080）');

  def('ss', function (args, ctx) {
    return oktext(joinLines([
      'State   Recv-Q  Send-Q   Local Address:Port    Peer Address:Port  Process',
      'LISTEN  0       128            0.0.0.0:22           0.0.0.0:*      users:(("sshd",pid=812,fd=3))',
      'LISTEN  0       511            0.0.0.0:80           0.0.0.0:*      users:(("nginx",pid=901,fd=6))',
      'LISTEN  0       511            0.0.0.0:8080         0.0.0.0:*      users:(("node",pid=2210,fd=22))'
    ]));
  }, 'ss -lntp', '查看监听端口（沙盒返回示例数据）');
  def('docker', function (args, ctx) {
    var e = ctx.engine;
    e.containers = e.containers || [];
    var sub = args[0];
    if (sub === 'run') {
      var image = args[args.length - 1];
      e.containers.push({ id: Math.random().toString(16).slice(2, 14), image: image, status: 'Up 1 second' });
      return oktext('（沙盒模拟）已启动容器 ' + image + '\n');
    }
    if (sub === 'ps') {
      return oktext(joinLines(['CONTAINER ID   IMAGE     STATUS'].concat(e.containers.map(function (c) {
        return c.id + '   ' + c.image + '   ' + c.status;
      }))));
    }
    return oktext('（沙盒只实现 docker ps / docker run）\n');
  }, 'docker ps / docker run -d -p 8080:80 nginx', '容器管理（沙盒为模拟）');

  def('crontab', function (args, ctx) {
    var e = ctx.engine;
    var p = parseArgs(args, '');
    if (p.flags.l) return oktext(e.crontab || 'no crontab for ' + ME.user + '\n');
    if (p.flags.e) return oktext('（沙盒不打开编辑器；真机 crontab -e 会调用 $EDITOR）\n');
    if (args[0]) { e.crontab = args[0] + '\n'; return oktext(''); }
    return oktext('（用法：crontab -l 查看、crontab -e 编辑）\n');
  }, 'crontab -l / -e', '查看 / 编辑定时任务（沙盒不打开编辑器）');

  def('apt', function (args, ctx) {
    var sub = args[0];
    if (sub === 'update') {
      return oktext(['Reading package lists... Done', 'E: 沙盒不联网，无法真正更新源索引（真机会连接源站）'].join('\n') + '\n');
    }
    if (sub === 'install') {
      return oktext('（沙盒不联网）真机执行 sudo apt install ' + args.slice(1).join(' ') + ' 会下载并安装软件包\n');
    }
    return oktext('（沙盒只实现 apt update / apt install 的提示）\n');
  }, 'apt update / apt install 包名', '软件包管理（沙盒只提示）');

  def('vim', function (args, ctx) {
    return oktext('（沙盒不模拟全屏编辑器）真机：vim ' + (args[0] || '文件') + ' → 按 i 编辑，Esc 后 :wq 保存退出\n');
  }, 'vim 文件', '编辑器（沙盒只给提示）');

  def('nano', function (args, ctx) {
    return oktext('（沙盒不模拟全屏编辑器）真机：nano ' + (args[0] || '文件') + ' → Ctrl+O 保存、Ctrl+X 退出\n');
  }, 'nano 文件', '简易编辑器（沙盒只给提示）');

  /* --------------------------- 脚本执行（bash / sh） --------------------------- */

  def('bash', function (args, ctx) {
    return runScriptCommand(args, ctx, false);
  }, 'bash [-x][-n] 脚本.sh [参数…]', '运行 Shell 脚本（-x 调试、-n 只检查语法）');

  def('sh', function (args, ctx) {
    return runScriptCommand(args, ctx, false);
  }, 'sh [-x][-n] 脚本.sh', '以 sh 方式运行脚本');

  def('source', function (args, ctx) {
    var e = ctx.engine;
    if (!args.length) return errtext('bash: source: filename argument required');
    var code;
    try { code = e.readFile(args[0]); } catch (err) { return errtext(err.message.replace(/^cat:/, 'bash: source:')); }
    var interp = new Interp(e, { trace: !!e.setX });
    var result = interp.run(code, args.slice(1), args[0]);
    return { out: result.out, err: result.err, code: result.code };
  }, 'source 脚本.sh', '在当前 Shell 中执行脚本（变量会保留）');

  function runScriptCommand(args, ctx, quiet) {
    var e = ctx.engine;
    var p = parseArgs(args, 'c');
    var debug = !!p.flags.x;
    var checkOnly = !!p.flags.n;
    var inline = p.flags.c;
    var target = p.operands[0];
    var scriptArgs = p.operands.slice(1);

    if (inline) {
      var it = new Interp(e, { trace: debug });
      var r0 = it.run(String(inline), p.operands, 'bash -c');
      return { out: r0.out, err: r0.err, code: r0.code };
    }
    if (!target) return errtext('bash: 需要脚本文件名（也可以 bash -c "命令"）');

    var source;
    try {
      source = e.readFile(target);
    } catch (err) {
      return errtext('bash: ' + target + ': No such file or directory');
    }
    if (checkOnly) {
      var opens = (source.match(/\b(for|while|if|case)\b/g) || []).length;
      var closes = (source.match(/\b(done|fi|esac)\b/g) || []).length;
      if (opens > closes) return errtext('bash: syntax error: unexpected end of file（缺少 done / fi / esac）', 2);
      return oktext('（语法检查通过：' + target + '）\n');
    }
    var interp = new Interp(e, { trace: debug });
    var savedSetE = e.setE, savedSetX = e.setX;
    var result;
    try {
      result = interp.run(source, scriptArgs, target);
    } finally {
      e.setE = savedSetE;      // 脚本内的 set -e / -x 不污染父 shell
      e.setX = savedSetX;
      e.trace = false;
    }
    return { out: result.out, err: result.err, code: result.code };
  }
  /* ==========================================================================
   *  迷你 bash 解释器：变量 / for / while / if / case / 函数 / 位置参数
   *  目标不是复刻 bash，而是让 Day7 的示例脚本能真的跑出结果。
   * ======================================================================== */

  /** 按换行 / 分号切语句（保留 ;; 作为独立标记，忽略引号内的分隔符） */
  function splitStatements(src) {
    var out = [], buf = '', i = 0, quote = null;
    var text = String(src || '');
    while (i < text.length) {
      var c = text.charAt(i);
      if (quote) {
        buf += c;
        if (c === '\\' && quote === '"') { buf += text.charAt(i + 1) || ''; i += 2; continue; }
        if (c === quote) quote = null;
        i += 1;
        continue;
      }
      if (c === '\\') { buf += c + (text.charAt(i + 1) || ''); i += 2; continue; }
      if (c === "'" || c === '"') { quote = c; buf += c; i += 1; continue; }
      if (c === '\n') { out.push(buf); buf = ''; i += 1; continue; }
      if (c === ';') {
        if (text.charAt(i + 1) === ';') { out.push(';;'); i += 2; continue; }
        out.push(buf); buf = ''; i += 1; continue;
      }
      buf += c;
      i += 1;
    }
    out.push(buf);
    return out.map(function (s) { return s.trim(); }).filter(function (s) { return s && s.charAt(0) !== '#'; });
  }

  function Interp(engine, options) {
    options = options || {};
    this.e = engine;
    this.out = '';
    this.err = '';
    this.code = 0;
    this.trace = !!options.trace;
    this.aborted = false;
    this.funcs = {};
    this.stmts = [];
    this.i = 0;
    this.args = [];
    this.name = 'bash';
    engine.vars = engine.vars || {};
  }

  Interp.prototype.run = function (source, args, name) {
    var self = this;
    this.args = args || [];
    this.name = name || 'bash';
    this.e.scriptArgs = this.args.slice();
    this.e.scriptName = this.name;

    var text = String(source || '');
    /* 单行函数定义：name() { ... } */
    text = text.replace(/^[ \t]*([A-Za-z_][A-Za-z0-9_]*)[ \t]*\(\)[ \t]*\{([^}\n]*)\}[ \t]*$/gm,
      function (all, fname, body) {
        self.funcs[fname] = body.trim();
        return '';
      });
    text = text.replace(/^#!.*$/m, '');
    this.stmts = splitStatements(text);
    this.i = 0;
    this.execBlock();
    return { out: this.out, err: this.err, code: this.code };
  };

  Interp.prototype.execBlock = function () {
    while (this.i < this.stmts.length && !this.aborted) {
      var stmt = this.stmts[this.i];
      this.i += 1;
      this.execStmt(stmt);
      if (this.e.setE && this.code !== 0) { this.aborted = true; break; }
    }
  };

  Interp.prototype.execStmt = function (stmt) {
    var head = stmt.split(/\s+/)[0];
    if (!head) return;
    if (head === 'for') return this.execFor(stmt);
    if (head === 'while') return this.execWhile(stmt);
    if (head === 'if') return this.execIf(stmt);
    if (head === 'case') return this.execCase(stmt);
    if (head === 'exit') {
      this.aborted = true;
      this.code = parseInt(stmt.split(/\s+/)[1] || '0', 10) || 0;
      return;
    }
    if (head === '{' || head === '}' || head === 'then' || head === 'do') return;
    if (this.funcs[head]) return this.callFunc(head, stmt.slice(head.length));
    this.execSimple(stmt);
  };

  Interp.prototype.execSimple = function (stmt) {
    var r = this.e.exec(stmt);
    if (this.trace) this.out += '+ ' + stmt + '\n';
    if (r.out) this.out += r.out;
    if (r.err) this.out += r.err;
    this.code = r.code;
  };

  /** 收集一个块（直到 stops 里的关键字），depth 处理嵌套 */
  Interp.prototype.captureBlock = function (stops) {
    var body = [], depth = 0;
    while (this.i < this.stmts.length) {
      var s = this.stmts[this.i];
      var head = s.split(/\s+/)[0];
      if (depth === 0 && stops.indexOf(head) >= 0) {
        this.i += 1;
        return { body: body, stop: head, text: s };
      }
      if (head === 'for' || head === 'while' || head === 'if' || head === 'case') depth += 1;
      else if (head === 'done' || head === 'fi' || head === 'esac') depth -= 1;
      body.push(s);
      this.i += 1;
    }
    return { body: body, stop: null, text: '' };
  };

  /** 吃掉 then / do / else 关键字，返回同一句里剩下的命令 */
  Interp.prototype.takeKeyword = function (word) {
    var s = this.stmts[this.i];
    if (s == null) return { found: false, rest: '' };
    if (s === word) { this.i += 1; return { found: true, rest: '' }; }
    if (s.indexOf(word + ' ') === 0) { this.i += 1; return { found: true, rest: s.slice(word.length + 1).trim() }; }
    return { found: false, rest: '' };
  };

  Interp.prototype.runBody = function (body) {
    var savedStmts = this.stmts, savedI = this.i;
    this.stmts = body;
    this.i = 0;
    this.execBlock();
    this.stmts = savedStmts;
    this.i = savedI;
  };

  /** 展开一串单词（支持 $@、通配符、大括号） */
  Interp.prototype.expandList = function (text) {
    var e = this.e;
    var words = e.tokenize(String(text || '')).filter(function (t) { return t.word != null; });
    var out = [];
    e.expandWords(words).forEach(function (w) { out = out.concat(String(w).split(/\s+/)); });
    return out.filter(Boolean);
  };
  Interp.prototype.execFor = function (stmt) {
    var m = /^for\s+([A-Za-z_][A-Za-z0-9_]*)\s*(?:in\s+(.*))?$/.exec(stmt);
    if (!m) return;
    var varName = m[1];
    var words = this.expandList(m[2] == null ? '$@' : m[2]);
    var kw = this.takeKeyword('do');
    if (!kw.found) return;
    var cap = this.captureBlock(['done']);
    var body = (kw.rest ? [kw.rest] : []).concat(cap.body);
    var self = this;
    words.forEach(function (w) {
      if (self.aborted) return;
      self.e.env[varName] = w;
      self.runBody(body);
    });
  };

  Interp.prototype.execWhile = function (stmt) {
    var cond = stmt.replace(/^while\s+/, '');
    var kw = this.takeKeyword('do');
    if (!kw.found) return;
    var cap = this.captureBlock(['done']);
    var body = (kw.rest ? [kw.rest] : []).concat(cap.body);

    /* 特判教学里最常见的写法：while read -r line; do ...; done < 文件 */
    var mRead = /^read\s+(?:-\w+\s+)*([A-Za-z_][A-Za-z0-9_]*)$/.exec(cond.trim());
    var redir = /<\s*(\S+)\s*$/.exec(cap.text || '');
    if (mRead && redir) {
      var text;
      try {
        text = this.e.readFile(redir[1].replace(/^['"]|['"]$/g, ''));
      } catch (err) {
        this.out += err.message + '\n';
        return;
      }
      var rows = toLines(text);
      for (var i = 0; i < rows.length; i++) {
        this.e.env[mRead[1]] = rows[i];
        this.runBody(body);
        if (this.aborted) break;
      }
      return;
    }

    var guard = 0;
    while (this.evalCond(cond)) {
      this.runBody(body);
      if (this.aborted) break;
      guard += 1;
      if (guard > 200) {
        this.out += '（沙盒保护：循环超过 200 次已中断，真机上会一直跑）\n';
        break;
      }
    }
  };

  Interp.prototype.execIf = function (stmt) {
    var cond = stmt.replace(/^if\s+/, '');
    var kw = this.takeKeyword('then');
    if (!kw.found) return;
    var first = kw.rest ? [kw.rest] : [];
    var cap = this.captureBlock(['else', 'elif', 'fi']);
    var body = first.concat(cap.body);
    var elseBody = [];

    if (cap.stop === 'else') {
      var rest = cap.text.slice(4).trim();
      if (rest) elseBody.push(rest);
      elseBody = elseBody.concat(this.captureBlock(['fi']).body);
    } else if (cap.stop === 'elif') {
      elseBody.push('if ' + cap.text.slice(4).trim());
      elseBody = elseBody.concat(this.captureBlock(['fi']).body);
    }

    if (this.evalCond(cond)) this.runBody(body);
    else if (elseBody.length) this.runBody(elseBody);
  };

  Interp.prototype.execCase = function (stmt) {
    var m = /^case\s+(.+?)\s+in$/.exec(stmt);
    if (!m) return;
    var value = this.expandList(m[1])[0] || '';
    var clauses = [], cur = null;
    while (this.i < this.stmts.length) {
      var s = this.stmts[this.i];
      this.i += 1;
      if (s === 'esac') break;
      if (s === ';;') { cur = null; continue; }
      var pat = /^(.*?)\)\s*(.*)$/.exec(s);
      if (pat && !cur) {
        cur = { patterns: pat[1].trim().split('|'), body: [] };
        if (pat[2]) cur.body.push(pat[2]);
        clauses.push(cur);
      } else if (cur) cur.body.push(s);
    }
    for (var k = 0; k < clauses.length; k++) {
      var hit = clauses[k].patterns.some(function (p) {
        return globToRegExp(p.trim()).test(value);
      });
      if (hit) { this.runBody(clauses[k].body); break; }
    }
  };

  Interp.prototype.callFunc = function (name, rest) {
    var args = this.expandList(rest);
    var savedArgs = this.e.scriptArgs;
    this.e.scriptArgs = args;
    this.runBody(splitStatements(this.funcs[name]));
    this.e.scriptArgs = savedArgs;
  };

  /** 条件求值：[ -n x ]、[ a = b ]、[ $n -lt 3 ]、[ -f 文件 ]、true/false */
  Interp.prototype.evalCond = function (cond) {
    var text = String(cond == null ? '' : cond).trim();
    if (!text) return false;
    if (text === 'true' || text === ':') return true;
    if (text === 'false') return false;

    var m = /^\[\[?\s*(.*?)\s*\]\]?$/.exec(text);
    if (!m) {
      var r = this.e.exec(text);
      if (r.out) this.out += r.out;
      if (r.err) this.out += r.err;
      return r.code === 0;
    }

    var parts = m[1].split(/\s+/);
    if (parts.length === 2 && (parts[0] === '-n' || parts[0] === '-z')) {
      var v = this.expandList(parts[1]).join(' ');
      return parts[0] === '-n' ? v.length > 0 : v.length === 0;
    }
    if (parts.length === 2 && /^-[edfrsx]$/.test(parts[0])) {
      var path = this.expandList(parts[1])[0] || '';
      var node = this.e.node(path);
      if (parts[0] === '-e' || parts[0] === '-r' || parts[0] === '-x' || parts[0] === '-s') return !!node;
      if (parts[0] === '-f') return !!node && node.type !== 'dir';
      if (parts[0] === '-d') return !!node && node.type === 'dir';
    }
    if (parts.length >= 3) {
      var left = this.expandList(parts[0]).join(' ');
      var op = parts[1];
      var right = this.expandList(parts.slice(2).join(' ')).join(' ');
      if (op === '=' || op === '==') return left === right;
      if (op === '!=') return left !== right;
      var ln = parseFloat(left), rn = parseFloat(right);
      if (op === '-eq') return ln === rn;
      if (op === '-ne') return ln !== rn;
      if (op === '-lt') return ln < rn;
      if (op === '-gt') return ln > rn;
      if (op === '-le') return ln <= rn;
      if (op === '-ge') return ln >= rn;
    }
    return false;
  };
  /* ==========================================================================
   *  命令分发（别名 / sudo / 变量赋值 / 未实现提示）
   * ======================================================================== */

  Engine.prototype.runWords = function (argv, stdin, opts) {
    opts = opts || {};
    var args = argv.slice();
    if (!args.length) return { out: '', err: '', code: 0 };

    /* 别名展开（最多 5 层，避免死循环） */
    var guard = 0;
    while (this.aliases[args[0]] && guard < 5) {
      var aliasWords = this.tokenize(this.aliases[args[0]]).filter(function (t) {
        return t.word != null;
      }).map(function (t) { return t.word; });
      args = aliasWords.concat(args.slice(1));
      guard += 1;
    }

    /* 单独一条赋值：NAME=value */
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(args[0]) && args.length === 1) {
      var eq = args[0].indexOf('=');
      var key = args[0].slice(0, eq);
      this.env[key] = args[0].slice(eq + 1);
      this.vars = this.vars || {};
      this.vars[key] = this.env[key];
      return { out: '', err: '', code: 0 };
    }

    /* sudo：临时提升为 root 再执行剩下的命令 */
    if (args[0] === 'sudo') {
      var rest = args.slice(1).filter(function (a) { return a.charAt(0) !== '-'; });
      if (!rest.length) return { out: '', err: 'usage: sudo command\n', code: 1 };
      var wasRoot = this.rootOnly;
      this.rootOnly = true;
      try {
        return this.runWords(rest, stdin);
      } finally {
        this.rootOnly = wasRoot;
      }
    }

    /* Windows 侧命令：如实告知要去 PowerShell */
    if (/^(wsl|wsl\.exe|powershell|cmd)$/i.test(args[0])) {
      return {
        out: '（这条命令要在 Windows PowerShell / CMD 里执行；沙盒模拟的是 Ubuntu 终端）\n' +
          '真机：Win 键 → 输入 powershell → 执行 ' + args.join(' ') + '\n',
        err: '',
        code: 0
      };
    }

    var name = args[0];
    var fn = COMMANDS[name];
    if (!fn) {
      var inBin = this.node('/usr/bin/' + name) || this.node('/bin/' + name);
      if (inBin) {
        return { out: '', err: 'bash: ' + name + ': 沙盒未实现该命令；真机可用 man ' + name + ' 查看用法\n', code: 127 };
      }
      return { out: '', err: 'bash: ' + name + ': command not found\n', code: 127 };
    }

    try {
      return normalizeResult(fn(args.slice(1), {
        stdin: stdin,
        engine: this,
        argv: args,
        piped: !!opts.piped
      }));
    } catch (err) {
      var msg = err && err.message ? err.message : String(err);
      return { out: '', err: msg + '\n', code: (err && err.code) || 1 };
    }
  };

  /* ---------------------------- 会话级便捷方法 ---------------------------- */

  /** 提示符：student@wsl-desktop:~/practice$ */
  Engine.prototype.prompt = function () {
    var dir = this.cwd;
    if (dir === ME.home) dir = '~';
    else if (dir.indexOf(ME.home + '/') === 0) dir = '~' + dir.slice(ME.home.length);
    return (this.rootOnly ? 'root' : ME.user) + '@' + ME.host + ':' + dir + '$ ';
  };

  /**
   * 执行一行（供 UI 调用）
   * @return {{out, err, code, clear}}
   */
  Engine.prototype.run = function (line) {
    var text = String(line == null ? '' : line).trim();
    var result = { out: '', err: '', code: 0, clear: false };
    if (!text) return result;
    this.lastAction = null;
    var r = this.exec(text);       // 先执行（!! 需要看到"之前"的历史）
    this.history.push(text);
    result.out = r.out;
    result.err = r.err;
    result.code = r.code;
    if (this.lastAction === 'clear') result.clear = true;
    this.lastAction = null;
    return result;
  };

  /**
   * Tab 补全：第一个词补命令名，后续补路径
   * @return {string[]} 候选列表
   */
  Engine.prototype.complete = function (input) {
    var text = String(input || '');
    var parts = text.split(/\s+/);
    var last = parts[parts.length - 1] || '';
    if (parts.length === 1) {
      return Object.keys(COMMANDS).filter(function (n) { return n.indexOf(last) === 0; }).sort();
    }
    var parent = last.indexOf('/') >= 0 ? last.slice(0, last.lastIndexOf('/') + 1) : '';
    var prefix = last.slice(parent.length);
    var names = this.listNames(parent || '.', true) || [];
    return names.filter(function (n) { return n.indexOf(prefix) === 0; })
      .map(function (n) { return parent + n; });
  };

  /* 命令名回填（which / ls /usr/bin / 补全 都依赖它） */
  Object.keys(COMMANDS).sort().forEach(function (n) { COMMAND_NAMES.push(n); });

  /* -------------------------------- 对外接口 -------------------------------- */

  var Sandbox = {
    /** 支持的场景名（按 UI 顺序） */
    scenarios: ['home', 'files', 'text', 'perm', 'script'],

    /** 场景的中文名 */
    label: function (name) {
      return (SCENARIOS[name] || SCENARIOS.home).label;
    },

    /** 命令文档表（term.js 的 help / 补全用） */
    docs: DOCS,

    /** 所有命令名 */
    commands: COMMAND_NAMES.slice(),

    /** 新建一个会话（可指定工作区） */
    create: function (scenario) {
      return new Engine({ scenario: scenario || 'home' });
    },

    /** 直接跑一行，返回 {out, err, code}（无会话状态，测试用） */
    once: function (line, scenario) {
      var e = new Engine({ scenario: scenario || 'home' });
      return e.exec(line);
    },

    /** 版本号 */
    version: '1.0'
  };

  LX.Sandbox = Sandbox;
})(window);
