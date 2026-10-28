/* =============================================================================
 * js/term.js
 * -----------------------------------------------------------------------------
 * 沙盒终端的界面层（方案 D 的"脸"）
 *
 *   · 把 js/sandbox.js 的 Engine 接到一个可输入的终端面板上
 *   · 支持：回车执行、↑/↓ 翻历史、Tab 补全、Ctrl+L 清屏、Ctrl+C 取消
 *   · 例题联动：lesson.js 的「▶ 沙盒运行」会调 runExample(ex)
 *     多行答案自动写成 ~/sandbox-example.sh 再交给 bash 执行
 *
 * 与 sandbox.js 的分工：本文件只管 DOM，不解析任何命令。
 * ========================================================================== */
(function (global) {
  'use strict';

  var LX = global.LX = global.LX || {};
  var util = LX.util;

  var refs = { panel: null, out: null, input: null, prompt: null, scenario: null, fab: null };

  var engine = null;
  var scenario = 'home';
  var historyIdx = -1;

  /* -------------------------------- 小工具 -------------------------------- */

  function trimEnd(text) {
    return String(text == null ? '' : text).replace(/\n+$/, '');
  }

  function scrollToEnd() {
    if (refs.out) refs.out.scrollTop = refs.out.scrollHeight;
  }

  function ensureEngine(nextScenario) {
    var want = nextScenario || scenario || 'home';
    if (!engine || want !== engine.scenario) {
      engine = LX.Sandbox.create(want);
      scenario = want;
      if (refs.scenario) refs.scenario.textContent = LX.Sandbox.label(want);
    }
    return engine;
  }

  function updatePrompt() {
    if (refs.prompt) refs.prompt.textContent = ensureEngine().prompt();
  }

  /* -------------------------------- 输出渲染 -------------------------------- */

  function block(className) {
    var el = util.el('div', { className: 't-block' + (className ? ' ' + className : '') });
    if (refs.out) refs.out.appendChild(el);
    return el;
  }

  /** 提示 / 公告行 */
  function printLine(text, cls) {
    block(cls).appendChild(util.el('div', { className: 't-note', text: text }));
    scrollToEnd();
  }

  /** 执行一条命令并渲染结果 */
  function execLine(line) {
    var text = String(line == null ? '' : line).trim();
    if (!text) return null;

    var e = ensureEngine();
    var promptText = e.prompt();
    var result = e.run(text);

    if (result.clear) {
      clearOutput();
      updatePrompt();
      return result;
    }

    var wrap = block();
    var cmdLine = util.el('div', { className: 't-cmd-line' });
    cmdLine.appendChild(util.el('span', { className: 't-prompt', text: promptText }));
    cmdLine.appendChild(util.el('span', { className: 't-cmd', text: text }));
    wrap.appendChild(cmdLine);

    if (result.out) wrap.appendChild(util.el('pre', { className: 't-stdout', text: trimEnd(result.out) }));
    if (result.err) wrap.appendChild(util.el('pre', { className: 't-stderr', text: trimEnd(result.err) }));

    scrollToEnd();
    updatePrompt();
    return result;
  }

  function clearOutput() {
    if (refs.out) refs.out.innerHTML = '';
  }

  function welcome() {
    var e = ensureEngine();
    clearOutput();
    var head = block('is-welcome');
    head.appendChild(util.el('div', {
      className: 't-banner-title',
      text: '🐧 Linux 沙盒终端 · ' + LX.Sandbox.label(e.scenario)
    }));
    head.appendChild(util.el('div', {
      className: 't-banner-text',
      text: '文件系统完全在你的浏览器内存里：随便 rm -rf，刷新页面或点 ⟳ 就能复原。不联网、不碰真实文件。'
    }));
    head.appendChild(util.el('div', {
      className: 't-banner-text',
      text: '试试：ls -la　cat notes.txt　grep ERROR app.log　help'
    }));
    scrollToEnd();
  }
  /* ------------------------------- 交互逻辑 ------------------------------- */

  function submit() {
    if (!refs.input) return;
    var value = refs.input.value;
    refs.input.value = '';
    historyIdx = -1;
    execLine(value);
  }

  function historyStep(dir) {
    var list = ensureEngine().history;
    if (!list.length) return;
    if (historyIdx === -1) historyIdx = dir < 0 ? list.length - 1 : list.length;
    else historyIdx += dir;
    if (historyIdx < 0) historyIdx = 0;
    if (historyIdx >= list.length) { historyIdx = list.length; refs.input.value = ''; return; }
    refs.input.value = list[historyIdx];
    setTimeout(function () {
      try { refs.input.setSelectionRange(refs.input.value.length, refs.input.value.length); } catch (e) { /* ignore */ }
    }, 0);
  }

  function complete() {
    var value = refs.input.value;
    var candidates = ensureEngine().complete(value);
    if (!candidates.length) return;

    if (candidates.length === 1) {
      var parts = value.split(/\s+/);
      parts[parts.length - 1] = candidates[0];
      refs.input.value = parts.join(' ');
      return;
    }

    /* 多个候选：先补公共前缀，再把候选列出来 */
    var common = candidates[0];
    candidates.forEach(function (c) {
      var i = 0;
      while (i < common.length && i < c.length && common.charAt(i) === c.charAt(i)) i += 1;
      common = common.slice(0, i);
    });
    var parts2 = value.split(/\s+/);
    var last = parts2[parts2.length - 1] || '';
    if (common.length > last.length) {
      parts2[parts2.length - 1] = common;
      refs.input.value = parts2.join(' ');
    }
    printLine(candidates.join('   '), 'is-hint');
  }

  /* ------------------------------ 例题联动 ------------------------------ */

  function looksLikeWindowsCommand(cmd) {
    return /^(wsl|wsl\.exe|powershell|cmd)\b/i.test(cmd);
  }

  function runExample(ex) {
    if (!ex) return;
    Term.open(ex.sandbox || 'home');
    var answer = String(ex.answer == null ? '' : ex.answer).trim();

    if (!answer) {
      printLine('这道题没有参考答案，先自己试试。', 'is-hint');
      return;
    }
    if (looksLikeWindowsCommand(answer)) {
      printLine('这条命令要在 Windows PowerShell 里执行，沙盒模拟的是 Ubuntu 终端：', 'is-hint');
      printLine('   Win 键 → 输入 powershell → 执行 ' + answer, 'is-hint');
      return;
    }

    /* 多行答案：写入临时脚本再 bash 执行（Day7 的脚本片段都走这条路径） */
    if (answer.indexOf('\n') >= 0) {
      var e = ensureEngine();
      var scriptPath = '/home/student/sandbox-example.sh';
      e.writeFile(scriptPath, /\n$/.test(answer) ? answer : answer + '\n', false);
      printLine('多行代码已写入 ~/sandbox-example.sh，用 bash 执行：', 'is-hint');
      execLine('bash ~/sandbox-example.sh');
      return;
    }

    var result = execLine(answer);
    if (result && result.err && /command not found/.test(result.err)) {
      printLine('这题考的是按键 / 配置片段，沙盒里没有对应可执行程序；真机上按提示操作即可。', 'is-hint');
      return;
    }
    if (result && result.code === 0) {
      printLine('✓ 已按参考答案执行，可以接着在上面改参数试试。', 'is-hint');
    }
  }
  /* ------------------------------- 公共接口 ------------------------------- */

  var Term = {
    init: function (options) {
      var opts = options || {};
      refs.panel = opts.panel || util.$('#termPanel');
      refs.out = opts.out || util.$('#termOut');
      refs.input = opts.input || util.$('#termInput');
      refs.prompt = opts.prompt || util.$('#termPrompt');
      refs.scenario = opts.scenario || util.$('#termScenario');
      refs.fab = opts.fab || util.$('#termFab');

      if (refs.input) {
        refs.input.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') {
            e.preventDefault();
            submit();
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            historyStep(-1);
          } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            historyStep(1);
          } else if (e.key === 'Tab') {
            e.preventDefault();
            complete();
          } else if ((e.ctrlKey || e.metaKey) && (e.key === 'l' || e.key === 'L')) {
            e.preventDefault();
            clearOutput();
          } else if (e.ctrlKey && (e.key === 'c' || e.key === 'C')) {
            e.preventDefault();
            printLine((refs.input.value || '') + '^C', 'is-hint');
            refs.input.value = '';
          }
        });
      }

      if (refs.out) {
        refs.out.addEventListener('click', function () {
          if (refs.input) refs.input.focus();
        });
      }

      var closeBtn = util.$('#termClose');
      if (closeBtn) closeBtn.addEventListener('click', function () { Term.close(); });

      var resetBtn = util.$('#termReset');
      if (resetBtn) {
        resetBtn.addEventListener('click', function () {
          engine = LX.Sandbox.create(scenario);
          welcome();
          updatePrompt();
          if (refs.input) refs.input.focus();
        });
      }

      var helpBtn = util.$('#termHelp');
      if (helpBtn) {
        helpBtn.addEventListener('click', function () {
          execLine('help');
          if (refs.input) refs.input.focus();
        });
      }

      updatePrompt();
      return this;
    },

    /** 打开终端（可同时切换工作区） */
    open: function (nextScenario) {
      if (refs.panel) refs.panel.classList.add('is-open');
      ensureEngine(nextScenario);
      if (!refs.out || !refs.out.childNodes.length) welcome();
      updatePrompt();
      if (refs.input) refs.input.focus();
      return this;
    },

    close: function () {
      if (refs.panel) refs.panel.classList.remove('is-open');
    },

    toggle: function () {
      if (Term.isOpen()) Term.close();
      else Term.open();
    },

    isOpen: function () {
      return !!(refs.panel && refs.panel.classList.contains('is-open'));
    },

    /** 外部直接执行一条命令 */
    exec: function (line) {
      Term.open();
      return execLine(line);
    },

    /** 例题的「▶ 沙盒运行」入口 */
    runExample: runExample,

    /** 重置为指定工作区 */
    reset: function (nextScenario) {
      scenario = nextScenario || scenario;
      engine = LX.Sandbox.create(scenario);
      welcome();
      updatePrompt();
      return this;
    },

    /** 当前引擎（调试 / 测试用） */
    engine: function () { return engine; }
  };

  LX.Term = Term;
})(window);
