/* =============================================================================
 * js/app.js
 * -----------------------------------------------------------------------------
 * 应用入口：把各模块粘起来
 *   · 主题切换（深色星图 / 浅色阅读）
 *   · 左侧目录树（按 11 个分支分组、显示完成度、支持关键词过滤）
 *   · 顶部进度环 + 总进度条 + 练习统计
 *   · 星图 / 详情面板 / AI 助手的事件编排
 *   · 键盘快捷键与移动端抽屉
 * ========================================================================== */
(function (global) {
  'use strict';

  var LX = global.LX = global.LX || {};
  var util = LX.util;

  var dom = {};
  var filterText = '';

  /* -------------------------------- 主题 -------------------------------- */

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    if (dom.themeToggle) {
      dom.themeToggle.textContent = theme === 'light' ? '☀️' : '🌙';
      dom.themeToggle.title = theme === 'light' ? '切换到深色（星图）主题' : '切换到浅色（阅读）主题';
      dom.themeToggle.setAttribute('aria-pressed', theme === 'light' ? 'true' : 'false');
    }
  }

  function toggleTheme() {
    var cur = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    var next = cur === 'light' ? 'dark' : 'light';
    applyTheme(next);
    LX.Progress.saveSettings({ theme: next });
  }

  /* -------------------------------- 提示条 -------------------------------- */

  function toast(text) {
    if (!dom.toast) return;
    dom.toast.textContent = text;
    dom.toast.classList.add('is-visible');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(function () {
      dom.toast.classList.remove('is-visible');
    }, 2400);
  }

  /* ------------------------------ 左侧目录树 ------------------------------ */

  function renderSidebar(keyword) {
    var wrap = dom.treeList;
    if (!wrap) return;
    var kw = String(keyword || '').trim().toLowerCase();
    var selected = LX.Galaxy.selected ? LX.Galaxy.selected() : 'linux';

    wrap.innerHTML = '';

    LX.Data.branches().forEach(function (branch) {
      var stat = LX.Progress.branchStat(branch.id);
      var branchHit = !kw || (branch.name + branch.full + (branch.plain || '')).toLowerCase().indexOf(kw) >= 0;
      var kids = branch.children.filter(function (c) {
        if (!kw) return true;
        return (c.name + c.full + (c.plain || '') + (c.tips || []).join(' '))
          .toLowerCase().indexOf(kw) >= 0;
      });
      if (kw && !kids.length && !branchHit) return;

      var group = util.el('section', { className: 'tree-group' });

      var head = util.el('button', {
        className: 'tree-branch' + (branch.id === selected ? ' is-active' : ''),
        attrs: { 'data-node': branch.id, title: branch.full }
      });
      head.appendChild(util.el('span', { className: 'tree-icon', text: branch.icon || '•' }));
      head.appendChild(util.el('span', { className: 'tree-name', text: branch.name }));
      head.appendChild(util.el('span', {
        className: 'tree-count' + (stat.pct === 100 ? ' is-full' : ''),
        text: stat.done + '/' + stat.total
      }));
      head.addEventListener('click', function () {
        group.classList.toggle('is-open');
        openNode(branch.id);
      });
      group.appendChild(head);

      var list = util.el('div', { className: 'tree-kids' });
      (kids.length ? kids : branch.children).forEach(function (child) {
        var done = LX.Progress.isDone(child.id);
        var item = util.el('button', {
          className: 'tree-item' +
            (done ? ' is-done' : '') +
            (child.id === selected ? ' is-active' : ''),
          attrs: { 'data-node': child.id, title: child.full || child.name }
        });
        item.appendChild(util.el('span', { className: 'dot' }));
        item.appendChild(util.el('span', { className: 'tree-kid-name', text: child.name }));
        if (child.children.length) {
          item.appendChild(util.el('span', { className: 'tree-sub', text: '+' + child.children.length }));
        }
        item.addEventListener('click', function () { openNode(child.id); });
        list.appendChild(item);
      });
      group.appendChild(list);

      // 搜索时全部展开，平时默认展开
      group.classList.add('is-open');
      wrap.appendChild(group);
    });

    if (!wrap.childNodes.length) {
      wrap.appendChild(util.el('p', {
        className: 'muted pad',
        text: '没有找到「' + keyword + '」相关内容，试试命令名，如 ls / tar / chmod。'
      }));
    }
  }

  /** 高亮目录树中的当前节点，并自动展开其所属分组 */
  function markActiveInTree(id) {
    if (!dom.treeList) return;
    util.$$('.tree-item.is-active, .tree-branch.is-active', dom.treeList).forEach(function (el) {
      el.classList.remove('is-active');
    });
    var target = dom.treeList.querySelector('[data-node="' + id + '"]');
    if (!target) return;
    target.classList.add('is-active');
    var group = target.closest ? target.closest('.tree-group') : null;
    if (group) group.classList.add('is-open');
  }

  /* ------------------------------- 顶部进度 ------------------------------- */

  function renderOverall() {
    var stat = LX.Progress.overall();

    if (dom.ringText) dom.ringText.textContent = stat.pct + '%';
    if (dom.ring) {
      var r = Number(dom.ring.getAttribute('r')) || 15;
      var c = 2 * Math.PI * r;
      dom.ring.style.strokeDasharray = c + ' ' + c;
      dom.ring.style.strokeDashoffset = c * (1 - stat.pct / 100);
    }
    if (dom.overallBar) dom.overallBar.style.width = stat.pct + '%';
    if (dom.overallText) {
      dom.overallText.textContent = '已完成 ' + stat.done + ' / ' + stat.total + ' 个知识点';
    }
    if (dom.quizStat) {
      var q = LX.Progress.quizOverview();
      dom.quizStat.textContent = '练习：✅ ' + q.ok + ' ／ ❌ ' + q.no;
    }
  }

  /** 进度变化后的统一刷新 */
  function refreshChrome() {
    renderSidebar(filterText);
    renderOverall();
    if (LX.Galaxy.refresh) LX.Galaxy.refresh();
  }
  /* ------------------------------ 打开知识点 ------------------------------ */

  function openNode(id) {
    LX.Galaxy.focus(id);
    LX.Lesson.render(id);
    markActiveInTree(id);
    closeSidebar();
  }

  function closeSidebar() {
    if (dom.app) dom.app.classList.remove('is-sidebar-open');
  }

  /* ------------------------------ 星图交互 ------------------------------ */

  function handleGalaxySelect(id) {
    LX.Lesson.render(id);
    markActiveInTree(id);
  }

  function initMap() {
    LX.Galaxy.init({
      svg: dom.galaxy,
      wrap: dom.galaxyWrap,
      tooltip: dom.galaxyTip,
      expanded: LX.Progress.getExpanded(),
      selectedId: LX.Progress.getLastNode(),
      onSelect: handleGalaxySelect
    });

    function bind(sel, fn) {
      var el = util.$(sel);
      if (el) el.addEventListener('click', fn);
    }
    bind('#zoomIn', function () { LX.Galaxy.zoomIn(); });
    bind('#zoomOut', function () { LX.Galaxy.zoomOut(); });
    bind('#zoomFit', function () { LX.Galaxy.fit(); });
    bind('#btnExpandAll', function () { LX.Galaxy.expandAll(); toast('已展开全部知识点'); });
    bind('#btnCollapseAll', function () {
      LX.Galaxy.collapseAll();
      toast('已折叠回 ' + LX.Data.branches().length + ' 个主题');
    });
  }

  /** 底部徽章：说明当前用的是 D3 还是内置降级布局 */
  function initMapBadge() {
    if (!dom.d3Badge) return;
    if (LX.Galaxy.hasD3()) {
      dom.d3Badge.textContent = 'D3 力导向布局';
      dom.d3Badge.className = 'map-badge is-ok';
      dom.d3Badge.title = '已加载 D3 v7（仓库内置 js/lib/d3.min.js），使用 forceSimulation + forceRadial 生成星系布局。';
    } else {
      dom.d3Badge.textContent = '内置辐射布局';
      dom.d3Badge.className = 'map-badge is-warn';
      dom.d3Badge.title = 'D3 未加载成功（js/lib/d3.min.js 缺失且 CDN 不可达），已自动降级为内置布局，功能不受影响。';
    }
  }

  /* -------------------------------- AI 助手 -------------------------------- */

  function initChat() {
    LX.Chat.init({
      panel: util.$('#chatPanel'),
      list: util.$('#chatList'),
      input: util.$('#chatInput'),
      form: util.$('#chatForm'),
      sendBtn: util.$('#chatSend'),
      modeBadge: util.$('#chatMode'),
      settingsBox: util.$('#chatSettings'),
      settingsBtn: util.$('#btnChatSettings'),
      closeBtn: util.$('#btnChatClose'),
      onNavigate: function (id) { openNode(id); }
    });

    var fab = util.$('#chatFab');
    if (fab) fab.addEventListener('click', function () { LX.Chat.toggle(); });
  }

  /* ------------------------------ 沙盒终端 ------------------------------ */

  function initTerm() {
    if (!LX.Term) return;
    LX.Term.init({
      panel: util.$('#termPanel'),
      out: util.$('#termOut'),
      input: util.$('#termInput'),
      prompt: util.$('#termPrompt'),
      scenario: util.$('#termScenario'),
      fab: util.$('#termFab')
    });

    var fab = util.$('#termFab');
    if (fab) fab.addEventListener('click', function () { LX.Term.toggle(); });

    var mapBtn = util.$('#btnTerm');
    if (mapBtn) mapBtn.addEventListener('click', function () { LX.Term.toggle(); });
  }

  /* ------------------------------- 顶部与搜索 ------------------------------- */

  function initHeader() {
    if (dom.themeToggle) dom.themeToggle.addEventListener('click', toggleTheme);

    if (dom.search) {
      var onInput = util.debounce(function (value) {
        renderSidebar(value);
        LX.Galaxy.highlight(value);
      }, 120);

      dom.search.addEventListener('input', function () {
        filterText = dom.search.value;
        onInput(filterText);
      });

      dom.search.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          var hits = LX.Data.search(dom.search.value);
          if (hits.length) {
            openNode(hits[0].id);
            toast('已定位：' + hits[0].name + '（共 ' + hits.length + ' 个相关知识点）');
          } else if (dom.search.value.trim()) {
            toast('没找到，试试命令名：ls / tar / chmod / grep');
          }
        }
        if (e.key === 'Escape') {
          e.stopPropagation();
          dom.search.value = '';
          filterText = '';
          renderSidebar('');
          LX.Galaxy.highlight('');
          dom.search.blur();
        }
      });
    }

    if (dom.btnReset) {
      dom.btnReset.addEventListener('click', function () {
        if (!global.confirm('确定清空所有学习进度与练习记录吗？该操作不可撤销。')) return;
        LX.Progress.resetAll();
        LX.Galaxy.collapseAll();
        renderSidebar('');
        renderOverall();
        toast('学习进度已重置');
      });
    }

    if (dom.btnMenu) {
      dom.btnMenu.addEventListener('click', function () {
        if (dom.app) dom.app.classList.toggle('is-sidebar-open');
      });
    }
    if (dom.sidebarBackdrop) {
      dom.sidebarBackdrop.addEventListener('click', closeSidebar);
    }

    var closeLesson = util.$('#btnCloseLesson');
    if (closeLesson) {
      closeLesson.addEventListener('click', function () { LX.Lesson.close(); });
    }
  }

  /* ------------------------------- 键盘快捷键 ------------------------------- */

  function initKeyboard() {
    document.addEventListener('keydown', function (e) {
      var tag = (e.target && e.target.tagName || '').toLowerCase();
      var typing = tag === 'input' || tag === 'textarea';

      if (e.key === 'Escape') {
        LX.Chat.close();
        LX.Lesson.close();
        if (LX.Term) LX.Term.close();
        closeSidebar();
      }
      if (e.key === '`' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (LX.Term) LX.Term.toggle();
      }
      if (e.key === '/' && !typing) {
        e.preventDefault();
        if (dom.search) dom.search.focus();
      }
    });
  }
  /* -------------------------------- 启动 -------------------------------- */

  function cacheDom() {
    dom.app = util.$('#app');
    dom.themeToggle = util.$('#themeToggle');
    dom.search = util.$('#search');
    dom.btnReset = util.$('#btnReset');
    dom.btnMenu = util.$('#btnMenu');
    dom.sidebarBackdrop = util.$('#sidebarBackdrop');
    dom.treeList = util.$('#treeList');
    dom.ring = util.$('#ringProgress');
    dom.ringText = util.$('#ringText');
    dom.overallBar = util.$('#overallBar');
    dom.overallText = util.$('#overallText');
    dom.quizStat = util.$('#quizStat');
    dom.galaxy = util.$('#galaxy');
    dom.galaxyWrap = util.$('#galaxyWrap');
    dom.galaxyTip = util.$('#galaxyTip');
    dom.d3Badge = util.$('#d3Badge');
    dom.toast = util.$('#toast');
    dom.lessonPanel = util.$('#lessonPanel');
    dom.lessonBody = util.$('#lessonBody');
  }

  function boot() {
    if (!global.LX || !LX.Data) {
      document.body.innerHTML =
        '<p style="padding:40px;font-family:sans-serif;color:#fff">' +
        '数据加载失败：请确认 js/data/knowledge.js 存在，且是通过 index.html 打开的。</p>';
      return;
    }

    cacheDom();
    applyTheme(LX.Progress.settings().theme || 'dark');

    // 详情面板（onAsk 需要 Chat 已存在，函数体在点击时才执行，因此顺序安全）
    LX.Lesson.init({
      panel: dom.lessonPanel,
      body: dom.lessonBody,
      onNavigate: openNode,
      onChange: refreshChrome,
      onAsk: function (id) { LX.Chat.askAbout(id); },
      onRun: function (ex) { if (LX.Term) LX.Term.runExample(ex); }
    });

    initMap();
    initChat();
    initTerm();
    initHeader();
    initKeyboard();
    initMapBadge();
    setTimeout(initMapBadge, 800);   // D3 若是异步加载也能正确判断

    renderSidebar('');
    renderOverall();

    // 恢复上次学习位置（首次访问则停在核心节点，并打开引导卡片）
    var firstVisit = !LX.Progress.hasVisited();
    var last = LX.Progress.getLastNode();

    if (last && LX.Data.get(last) && last !== 'linux') {
      LX.Galaxy.select(last, { silent: true });
      LX.Lesson.render(last);
      markActiveInTree(last);
    } else {
      markActiveInTree('linux');
      if (firstVisit && global.innerWidth > 980) {
        // 第一次来（且是宽屏）：打开"Linux 入门"核心卡片，说明这份地图怎么用
        // 窄屏下不自动弹出，避免把星图整个盖住
        LX.Lesson.render('linux');
      }
    }

    // 进度变化 → 顶部进度环、星图"已学"标记
    LX.Progress.onChange(function () {
      renderOverall();
      if (LX.Galaxy.refresh) LX.Galaxy.refresh();
    });

    // 响应式：容器尺寸变化时重算星图
    var onResize = util.debounce(function () { LX.Galaxy.resize(); }, 150);
    global.addEventListener('resize', onResize);
    if (global.ResizeObserver && dom.galaxyWrap) {
      new global.ResizeObserver(onResize).observe(dom.galaxyWrap);
    }

    document.body.classList.add('is-ready');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  LX.App = {
    boot: boot,
    toast: toast,
    refresh: refreshChrome
  };
})(window);


