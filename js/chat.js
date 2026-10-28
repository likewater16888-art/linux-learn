/* =============================================================================
 * js/chat.js
 * -----------------------------------------------------------------------------
 * AI 学习助手（双模式）
 *
 *   A1 本地知识库模式（默认，无需任何 Key）：
 *      完全离线，基于 js/data/knowledge.js 做"关键词命中 + 意图识别"，
 *      能回答"X 是什么/全称是什么/怎么用/给道练习题"，并给出可点击的知识点入口。
 *   A2 在线大模型模式（用户自备 OpenAI 兼容接口的 API Key）：
 *      在 ⚙ 设置里填入 Base URL / 模型名 / Key，Key 只存在浏览器 localStorage，
 *      直接由浏览器请求接口；请求失败会自动降级回 A1 并提示原因。
 * ========================================================================== */
(function (global) {
  'use strict';

  var LX = global.LX = global.LX || {};
  var util = LX.util;

  var refs = {
    panel: null,
    list: null,
    input: null,
    sendBtn: null,
    modeBadge: null,
    settingsBox: null,
    onNavigate: function () {}
  };

  var messages = [];   // {role:'user'|'bot'|'sys', text:string, links:[id]}

  /* ----------------------------- 本地知识库素材 ----------------------------- */

  /** 高频问题（命中关键词直接答，不用选节点） */
  var FAQ = [
    {
      kws: ['密码不显示', '输入密码没反应', '看不到输入', '密码看不到', '输密码', '密码'],
      title: '密码输入时不显示，是正常的',
      body: 'Linux 输入密码时屏幕完全不动，连星号都不显示，这是安全设计，不是卡住了。\n直接输完按回车即可；如果输错会让你重新输一次。\n真的忘了密码：在 PowerShell 执行 wsl -u root passwd 你的用户名 即可重置。',
      links: ['wsl_account', 'sudo']
    },
    {
      kws: ['回收站', '删错', '恢复文件', '误删'],
      title: 'Linux 删除没有回收站',
      body: 'rm 是直接删除，不进回收站，删了基本找不回来。\n建议：重要文件先 tar 打包备份，或者先 mv 到 ~/trash 目录，确认没问题再删。',
      links: ['rm', 'rm_rf', 'tip_norecycle', 'tar']
    },
    {
      kws: ['permission denied', '权限不够', '没权限', '拒绝访问'],
      title: 'Permission denied 的排查顺序',
      body: '1) ls -l 看权限位，确认自己有没有 x / w 权限\n2) 需要改动系统目录时才用 sudo\n3) 执行脚本报错 → chmod +x 脚本名\n4) 文件属主不对 → sudo chown 用户名 文件',
      links: ['perm_bits', 'chmod', 'sudo', 'chown']
    },
    {
      kws: ['command not found', '找不到命令', '命令不存在', '不是内部或外部命令'],
      title: 'command not found 三种常见原因',
      body: '1) 软件没装 → sudo apt install -y 包名\n2) 当前目录的脚本没写 ./ → ./脚本.sh\n3) 拼写错误 → which 命令名 确认是否存在',
      links: ['which', 'shell_run', 'apt_update']
    },
    {
      kws: ['怎么进wsl', '进入linux', '回到linux', 'wsl怎么用', '打开ubuntu'],
      title: '随时回到 Ubuntu',
      body: 'Windows 任意位置：Win + R 输入 wsl 回车。\n也可以开始菜单搜 Ubuntu。想关掉全部实例：wsl --shutdown。',
      links: ['tip_wsl_reenter', 'wsl_install']
    },
    {
      kws: ['学习路线', '怎么学', '从哪开始', '学习顺序', '7天', '七天'],
      title: '推荐学习顺序',
      body: '环境搭建 → Day1 文件与目录 → Day2 查看文件 → Day3 权限 → Day4 进程 → Day5 文本三剑客 → Day6 查找压缩 → Day7 脚本 → 速查表 / 进阶。\n每天 30 分钟，重点是"自己敲一遍 + 做例题"。',
      links: ['env', 'day1', 'day2', 'day3', 'day4', 'day5', 'day6', 'day7']
    },
    {
      kws: ['卡住', '没反应', '卡死', 'crtl c', 'ctrl c'],
      title: '命令卡住怎么办',
      body: 'Ctrl + C 中断当前前台命令（ping、tail -f、top 都靠它退出）。\nCtrl + Z 挂起到后台，jobs 查看，fg 回到前台。\n实在不行 kill -9 进程号。',
      links: ['kill', 'kill_9', 'top_htop']
    }
  ];

  /** 中文口语关键词 → 知识点 id（弥补命令名匹配不到的短句） */
  var KEYWORD_HINTS = [
    { kws: ['删除', '删掉'], ids: ['rm', 'rm_rf', 'tip_norecycle'] },
    { kws: ['复制'], ids: ['cp'] },
    { kws: ['移动', '重命名', '改名'], ids: ['mv'] },
    { kws: ['权限', '授权', '授权'], ids: ['perm_bits', 'chmod'] },
    { kws: ['管理员', 'root', '提权'], ids: ['sudo', 'id'] },
    { kws: ['进程', '运行中的程序'], ids: ['ps', 'top_htop', 'kill'] },
    { kws: ['内存'], ids: ['free'] },
    { kws: ['磁盘', '空间', '满了'], ids: ['df', 'du', 'du_sort'] },
    { kws: ['日志'], ids: ['tail_f', 'less', 'grep'] },
    { kws: ['压缩', '打包', '备份', '解压'], ids: ['tar', 'zip_unzip'] },
    { kws: ['查找', '搜索文件', '找不到文件'], ids: ['find', 'grep'] },
    { kws: ['脚本', '自动化'], ids: ['script_hello', 'shell_run', 'shebang'] },
    { kws: ['循环'], ids: ['shell_for'] },
    { kws: ['判断'], ids: ['shell_if'] },
    { kws: ['变量'], ids: ['shell_var'] },
    { kws: ['安装软件', '装软件', '安装'], ids: ['apt_update', 'wsl_tools'] },
    { kws: ['定时', '每天自动'], ids: ['cron'] },
    { kws: ['服务', '开机自启'], ids: ['systemctl'] },
    { kws: ['网络', '下载', '端口'], ids: ['network'] },
    { kws: ['容器', 'docker'], ids: ['docker'] }
  ];

  function uniq(arr) {
    var seen = {};
    return arr.filter(function (x) {
      if (seen[x]) return false;
      seen[x] = true;
      return true;
    });
  }

  /** 识别用户意图：全称 / 举例 / 用法 */
  function detectIntent(q) {
    if (/(全称|英文|全拼|全名|什么意思|啥意思|是什么意思|含义)/.test(q)) return 'full';
    if (/(例子|例题|练习|题目|来一道|出个题|考考我)/.test(q)) return 'example';
    if (/(怎么用|如何用|用法|参数|选项|语法|怎么做)/.test(q)) return 'usage';
    return null;
  }

  /** 在知识库里定位节点：先按名称整词匹配，再退回全文检索 */
  function matchNode(q) {
    var best = null;
    LX.Data.nodes.forEach(function (n) {
      var name = String(n.name || '').toLowerCase();
      if (name.length < 2) return;
      var re = new RegExp('(^|[^a-z0-9_\\-])' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^a-z0-9_\\-]|$)');
      if (re.test(q) && (!best || name.length > best.name.length)) best = n;
    });
    if (best) return best;
    var hits = LX.Data.search(q.replace(/[？?！!，,。.、]/g, ' ').trim());
    return hits.length ? hits[0] : null;
  }

  function matchFaq(q) {
    for (var i = 0; i < FAQ.length; i++) {
      for (var j = 0; j < FAQ[i].kws.length; j++) {
        if (q.indexOf(FAQ[i].kws[j]) >= 0) return FAQ[i];
      }
    }
    return null;
  }
  /* --------------------------- 本地知识库应答逻辑 --------------------------- */

  /**
   * A1 模式回答（完全离线）
   * @return {{text:string, links:Array<string>}}
   */
  function localAnswer(question) {
    var q = String(question || '').toLowerCase().trim();
    if (!q) {
      return { text: '把问题写出来吧，例如："chmod 是干什么的？" 或 "给我一道 ls 的练习题"。' };
    }

    // ① 常见问题直答
    var faq = matchFaq(q);
    if (faq) return { text: faq.title + '\n\n' + faq.body, links: faq.links || [] };

    // ② 命令 / 知识点 + 意图识别
    var intent = detectIntent(q);
    var node = matchNode(q);

    if (node) {
      if (intent === 'full') {
        return {
          text: node.name + ' 的全称：' + (node.full || '（暂无）') +
            '\n\n大白话：' + node.plain,
          links: [node.id]
        };
      }

      if (intent === 'example') {
        var ex = node.examples[0];
        if (!ex) {
          return {
            text: node.name + ' 暂时没有配套例题，先把要点记住：\n' +
              node.tips.slice(0, 4).map(function (t) { return '· ' + t; }).join('\n'),
            links: [node.id]
          };
        }
        return {
          text: '来一道 ' + node.name + ' 的练习题：\n' + ex.q +
            '\n\n解题步骤：\n' + ex.steps.map(function (s, i) { return (i + 1) + '. ' + s; }).join('\n') +
            '\n\n参考答案：' + ex.answer,
          links: [node.id]
        };
      }

      return {
        text: node.name + '：' + (node.full || '') + '\n\n' + node.plain +
          '\n\n要点：\n' + node.tips.slice(0, 4).map(function (t) { return '· ' + t; }).join('\n'),
        links: [node.id]
      };
    }

    // ③ 中文口语关键词 → 相关知识点
    var hinted = [];
    KEYWORD_HINTS.forEach(function (h) {
      h.kws.forEach(function (k) {
        if (q.indexOf(k.toLowerCase()) >= 0) hinted = hinted.concat(h.ids);
      });
    });
    hinted = uniq(hinted).filter(function (id) { return LX.Data.get(id); }).slice(0, 4);

    if (hinted.length) {
      return {
        text: '我没有完全听懂，不过下面这些知识点应该和你的问题有关：\n' +
          hinted.map(function (id) {
            var n = LX.Data.get(id);
            return '· ' + n.name + ' — ' + n.plain;
          }).join('\n'),
        links: hinted
      };
    }

    // ④ 兜底
    return {
      text: '这个问题超出本地知识库的范围了。你可以：\n' +
        '· 换个说法，或直接写命令名（ls、chmod、tar…）\n' +
        '· 点右上角 ⚙ 填入 OpenAI 兼容接口的 API Key，使用在线大模型回答\n' +
        '· 先看看速查表，绝大多数入门问题都在里面',
      links: ['cheat_sheet', 'resources']
    };
  }
  /* ------------------------------ 在线大模型 ------------------------------ */

  /** A2 模式：调用用户自备的 OpenAI 兼容接口 */
  function callRemote() {
    var s = LX.Progress.settings();

    var ctx = '';
    var curId = (LX.Lesson && LX.Lesson.current) ? LX.Lesson.current() : null;
    var cur = curId ? LX.Data.get(curId) : null;
    if (cur) {
      ctx = '用户当前正在学习"' + cur.name + '"（' + (cur.full || '') + '），要点：' +
        cur.tips.slice(0, 3).join('；') + '。';
    }

    var sys = '你是一位耐心、口语化的中文 Linux 助教，面向使用 WSL2 的初学者。要求：' +
      '1) 先一句话给结论，再分点解释；2) 命令贴出来并用反引号包裹；' +
      '3) 控制在 250 字以内；4) 只回答 Linux / WSL2 / Shell 相关问题，' +
      '其它话题礼貌拒答并引导回学习内容。' + ctx;

    // 只带最近 6 条对话，避免 token 膨胀；最后一条就是本次提问
    var history = messages
      .filter(function (m) { return m.role === 'user' || m.role === 'bot'; })
      .slice(-6)
      .map(function (m) {
        return { role: m.role === 'user' ? 'user' : 'assistant', content: m.text };
      });

    var payload = {
      model: s.model || 'deepseek-chat',
      temperature: 0.4,
      messages: [{ role: 'system', content: sys }].concat(history)
    };

    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = setTimeout(function () { if (controller) controller.abort(); }, 30000);

    return fetch(s.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + s.apiKey
      },
      body: JSON.stringify(payload),
      signal: controller ? controller.signal : undefined
    }).then(function (res) {
      clearTimeout(timer);
      if (!res.ok) {
        if (res.status === 401) throw new Error('Key 无效或已过期（401）');
        if (res.status === 404) throw new Error('接口地址不对（404），请检查 Base URL');
        throw new Error('接口返回 HTTP ' + res.status);
      }
      return res.json();
    }).then(function (data) {
      var choice = data && data.choices && data.choices[0];
      var content = choice && choice.message && choice.message.content;
      if (!content) throw new Error('返回内容为空');
      return String(content).trim();
    });
  }

  /* -------------------------------- 渲染 -------------------------------- */

  function renderMessage(msg) {
    var wrap = util.el('div', { className: 'msg msg-' + msg.role });
    var bubble = util.el('div', { className: 'bubble' });
    bubble.textContent = msg.text;      // 用 textContent，绝不把内容当 HTML 执行
    wrap.appendChild(bubble);

    if (msg.links && msg.links.length) {
      var chips = util.el('div', { className: 'msg-links' });
      msg.links.forEach(function (id) {
        var n = LX.Data.get(id);
        if (!n) return;
        chips.appendChild(util.el('button', {
          className: 'chip xs',
          text: n.name,
          attrs: { title: n.full || n.name },
          on: { click: function () { refs.onNavigate(id); } }
        }));
      });
      if (chips.childNodes.length) wrap.appendChild(chips);
    }
    return wrap;
  }

  function push(msg) {
    messages.push(msg);
    if (!refs.list) return;
    refs.list.appendChild(renderMessage(msg));
    refs.list.scrollTop = refs.list.scrollHeight;
  }

  function showTyping() {
    var el = util.el('div', { className: 'msg msg-bot' }, [
      util.el('div', { className: 'bubble typing', html: '<i></i><i></i><i></i>' })
    ]);
    if (refs.list) {
      refs.list.appendChild(el);
      refs.list.scrollTop = refs.list.scrollHeight;
    }
    return el;
  }

  function updateModeBadge() {
    if (!refs.modeBadge) return;
    var online = !!LX.Progress.settings().apiKey;
    refs.modeBadge.textContent = online ? '在线大模型' : '本地知识库';
    refs.modeBadge.className = 'mode-badge ' + (online ? 'is-online' : 'is-local');
    refs.modeBadge.title = online
      ? '已配置 API Key，回答由在线模型生成（失败会自动降级）'
      : '未配置 API Key，使用离线知识库回答';
  }

  /* -------------------------------- 发送 -------------------------------- */

  function send(text) {
    var q = String(text || '').trim();
    if (!q) return;

    push({ role: 'user', text: q });
    if (refs.input) {
      refs.input.value = '';
      refs.input.style.height = 'auto';
    }

    var settings = LX.Progress.settings();

    // —— A2：在线模型 ——
    if (settings.apiKey) {
      if (refs.sendBtn) refs.sendBtn.disabled = true;
      var typing = showTyping();
      callRemote().then(function (answer) {
        typing.remove();
        push({ role: 'bot', text: answer });
      }).catch(function (err) {
        typing.remove();
        push({
          role: 'sys',
          text: '在线模型调用失败：' + (err && err.message ? err.message : '未知错误') +
            '\n已自动改用本地知识库回答。'
        });
        var local = localAnswer(q);
        push({ role: 'bot', text: local.text, links: local.links });
      }).then(function () {
        if (refs.sendBtn) refs.sendBtn.disabled = false;
      });
      return;
    }

    // —— A1：本地知识库（加一点延迟，让"思考中"更自然）——
    var t = showTyping();
    setTimeout(function () {
      t.remove();
      var local = localAnswer(q);
      push({ role: 'bot', text: local.text, links: local.links });
    }, 260);
  }
  /* ------------------------------- 设置面板 ------------------------------- */

  function initSettings() {
    var box = refs.settingsBox;
    if (!box) return;

    var s = LX.Progress.settings();
    var keyInput = box.querySelector('[data-field="apiKey"]');
    var urlInput = box.querySelector('[data-field="apiUrl"]');
    var modelInput = box.querySelector('[data-field="model"]');
    var saveBtn = box.querySelector('.js-save');
    var clearBtn = box.querySelector('.js-clear');

    if (keyInput) keyInput.value = s.apiKey || '';
    if (urlInput) urlInput.value = s.apiUrl || '';
    if (modelInput) modelInput.value = s.model || '';

    if (saveBtn) {
      saveBtn.addEventListener('click', function () {
        var cur = LX.Progress.settings();
        LX.Progress.saveSettings({
          apiKey: keyInput ? keyInput.value.trim() : '',
          apiUrl: (urlInput && urlInput.value.trim()) || cur.apiUrl,
          model: (modelInput && modelInput.value.trim()) || cur.model
        });
        updateModeBadge();
        push({
          role: 'sys',
          text: '设置已保存到本机浏览器（localStorage）。现在使用：' +
            (LX.Progress.settings().apiKey ? '在线大模型' : '本地知识库') + '。'
        });
        box.classList.remove('is-open');
      });
    }

    if (clearBtn) {
      clearBtn.addEventListener('click', function () {
        LX.Progress.saveSettings({ apiKey: '' });
        if (keyInput) keyInput.value = '';
        updateModeBadge();
        push({ role: 'sys', text: '已清除 API Key，切回本地知识库模式。' });
      });
    }
  }

  var WELCOME = '你好，我是 Linux 学习助手 👋\n' +
    '我的工作方式有两档：\n' +
    '· 本地知识库（默认）：不联网，按命令名 / 关键词检索知识地图\n' +
    '· 在线大模型：点右上角 ⚙ 填入 OpenAI 兼容接口的 API Key 后启用\n\n' +
    '试试问我："chmod 全称是什么？"、"给我一道 tar 的练习题"、"删错文件能恢复吗？"';

  /* ------------------------------- 公共接口 ------------------------------- */

  var Chat = {
    /**
     * 初始化
     * @param {Object} options {panel,list,input,form,sendBtn,modeBadge,settingsBox,
     *                          settingsBtn,closeBtn,onNavigate}
     */
    init: function (options) {
      var opts = options || {};
      refs.panel = opts.panel || null;
      refs.list = opts.list || null;
      refs.input = opts.input || null;
      refs.sendBtn = opts.sendBtn || null;
      refs.modeBadge = opts.modeBadge || null;
      refs.settingsBox = opts.settingsBox || null;
      refs.onNavigate = opts.onNavigate || function () {};

      if (opts.form) {
        opts.form.addEventListener('submit', function (e) {
          e.preventDefault();
          send(refs.input ? refs.input.value : '');
        });
      }

      if (refs.input) {
        refs.input.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            send(refs.input.value);
          }
        });
      }

      // 快捷提问按钮（HTML 里用 data-ask 声明问题）
      util.$$('[data-ask]', refs.panel || document).forEach(function (btn) {
        btn.addEventListener('click', function () { send(btn.getAttribute('data-ask')); });
      });

      if (opts.closeBtn) {
        opts.closeBtn.addEventListener('click', function () { Chat.close(); });
      }
      if (opts.settingsBtn && refs.settingsBox) {
        opts.settingsBtn.addEventListener('click', function () {
          refs.settingsBox.classList.toggle('is-open');
        });
      }

      initSettings();
      updateModeBadge();
      if (!messages.length) push({ role: 'bot', text: WELCOME });
      return this;
    },

    /** 打开面板（可选：顺带针对某知识点提问） */
    open: function (nodeId) {
      if (refs.panel) refs.panel.classList.add('is-open');
      if (refs.input) setTimeout(function () { refs.input.focus(); }, 200);
      if (nodeId) this.askAbout(nodeId);
    },

    close: function () {
      if (refs.panel) refs.panel.classList.remove('is-open');
    },

    toggle: function () {
      if (!refs.panel) return;
      if (refs.panel.classList.contains('is-open')) this.close();
      else this.open();
    },

    isOpen: function () {
      return !!(refs.panel && refs.panel.classList.contains('is-open'));
    },

    /** 针对某个知识点提问（详情面板上的"问 AI"按钮） */
    askAbout: function (nodeId) {
      var n = LX.Data.get(nodeId);
      if (!n) return;
      if (refs.panel && !refs.panel.classList.contains('is-open')) this.open();
      send(n.name + ' 是干什么的？');
    },

    /** 直接发送一句话（外部可调用） */
    ask: function (text) { send(text); },

    /** 清空对话 */
    reset: function () {
      messages = [];
      if (refs.list) refs.list.innerHTML = '';
      push({ role: 'bot', text: WELCOME });
    },

    /** 设置变化后刷新模式徽章 */
    refreshMode: updateModeBadge,

    /** 当前模式文案 */
    mode: function () {
      return LX.Progress.settings().apiKey ? 'online' : 'local';
    },

    /** 供调试：本地回答（不产生对话） */
    localAnswer: localAnswer
  };

  LX.Chat = Chat;
})(window);



