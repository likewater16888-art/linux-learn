/* =============================================================================
 * js/lesson.js
 * -----------------------------------------------------------------------------
 * 知识详情面板（右侧抽屉）
 *
 * 打开某个知识点时渲染：
 *   面包屑 → 名称 + 全称 + 层级徽章 → 操作（标记已学 / 问 AI）
 *   → 通俗说明 → 细节要点 → 动手练习（可提交答案、即时判分）
 *   → 智能关联推荐 → 延伸子知识点
 *
 * 所有内容都来自 LX.Data，本题页不硬编码任何命令文本。
 * ========================================================================== */
(function (global) {
  'use strict';

  var LX = global.LX = global.LX || {};
  var util = LX.util;

  var refs = {
    panel: null,
    body: null,
    currentId: null,
    onNavigate: function () {},
    onChange: function () {},
    onAsk: function () {},
    onRun: function () {}
  };

  /** 例题作答统计 → 文案 */
  function statText(stat) {
    if (!stat.ok && !stat.no) return '尚未作答';
    return '✅ ' + stat.ok + ' 次 ／ ❌ ' + stat.no + ' 次';
  }

  /* ------------------------------ 各区块渲染 ------------------------------ */

  function renderCrumb(node) {
    var path = LX.Data.pathOf(node.id);
    var nav = util.el('nav', { className: 'lesson-crumb', attrs: { 'aria-label': '层级路径' } });
    path.forEach(function (n, i) {
      var isLast = i === path.length - 1;
      nav.appendChild(util.el('button', {
        className: 'crumb' + (isLast ? ' is-current' : ''),
        text: n.name,
        attrs: isLast ? { 'aria-current': 'true' } : { title: n.full || n.name },
        on: { click: function () { if (!isLast) refs.onNavigate(n.id); } }
      }));
      if (!isLast) nav.appendChild(util.el('span', { className: 'crumb-sep', text: '›' }));
    });
    return nav;
  }

  function renderHead(node) {
    var head = util.el('header', { className: 'lesson-head' });

    var titleRow = util.el('div', { className: 'lesson-title-row' });
    titleRow.appendChild(util.el('h2', {
      className: 'lesson-title',
      text: (node.icon ? node.icon + ' ' : '') + node.name
    }));
    head.appendChild(titleRow);

    if (node.full) {
      head.appendChild(util.el('p', { className: 'lesson-full', text: node.full }));
    }

    var meta = util.el('div', { className: 'lesson-meta' });
    meta.appendChild(util.el('span', { className: 'tag tag-level', text: '第 ' + node.level + ' 层' }));
    meta.appendChild(util.el('span', { className: 'tag tag-branch', text: node.branchName }));
    var stat = LX.Progress.nodeQuizStat(node.id);
    if (stat.total) {
      meta.appendChild(util.el('span', {
        className: 'tag tag-quiz',
        text: '练习 ' + stat.right + '/' + stat.total + ' 已通过'
      }));
    }
    if (LX.Progress.isLearned(node.id)) {
      meta.appendChild(util.el('span', { className: 'tag tag-done', text: '✓ 已学' }));
    }
    head.appendChild(meta);

    return head;
  }

  function renderActions(node) {
    var bar = util.el('div', { className: 'lesson-actions' });

    var learned = LX.Progress.isLearned(node.id);
    bar.appendChild(util.el('button', {
      className: 'btn sm' + (learned ? ' is-on' : ' primary'),
      text: learned ? '✓ 已标记为已学' : '标记为已学',
      on: {
        click: function () {
          LX.Progress.toggleLearned(node.id);
          refs.onChange();
          Lesson.render(node.id);
        }
      }
    }));

    if (node.children.length) {
      bar.appendChild(util.el('button', {
        className: 'btn sm ghost',
        text: '在星图中展开',
        on: { click: function () { LX.Galaxy.expand(node.id); } }
      }));
    }

    bar.appendChild(util.el('button', {
      className: 'btn sm ghost',
      text: '🤖 问 AI',
      on: { click: function () { refs.onAsk(node.id); } }
    }));

    return bar;
  }

  function renderTips(node) {
    if (!node.tips.length) return null;
    var sec = util.el('section', { className: 'lesson-section' });
    sec.appendChild(util.el('h3', { className: 'section-title', text: '细节要点' }));
    var ul = util.el('ul', { className: 'tips' });
    node.tips.forEach(function (t) {
      ul.appendChild(util.el('li', { className: 'tip-item', text: t }));
    });
    sec.appendChild(ul);
    return sec;
  }
  /* -------------------------------- 例题卡片 ------------------------------- */

  function exampleCard(ex, index) {
    var stat = LX.Progress.quizStat(ex.id);
    var card = util.el('article', { className: 'ex-card' + (stat.ok ? ' is-solved' : '') });

    var head = util.el('div', { className: 'ex-head' });
    head.appendChild(util.el('span', { className: 'ex-index', text: '练习 ' + (index + 1) }));
    head.appendChild(util.el('p', { className: 'ex-q', text: ex.q }));
    card.appendChild(head);

    if (ex.steps.length) {
      var details = util.el('details', { className: 'ex-steps' });
      details.appendChild(util.el('summary', { text: '查看解题步骤（' + ex.steps.length + ' 步）' }));
      var ol = util.el('ol', { className: 'step-list' });
      ex.steps.forEach(function (s) { ol.appendChild(util.el('li', { text: s })); });
      details.appendChild(ol);
      card.appendChild(details);
    }

    var input = util.el('textarea', {
      className: 'ex-input',
      attrs: {
        rows: '2',
        placeholder: '在这里输入你的命令 / 答案（Ctrl + Enter 快速提交）',
        spellcheck: 'false',
        autocapitalize: 'off',
        autocorrect: 'off'
      }
    });
    card.appendChild(input);

    var feedback = util.el('div', { className: 'ex-feedback' });
    feedback.hidden = true;
    card.appendChild(feedback);

    var actions = util.el('div', { className: 'ex-actions' });
    var submit = util.el('button', { className: 'btn primary sm', text: '提交答案' });
    var run = util.el('button', {
      className: 'btn ghost sm',
      text: '▶ 沙盒运行',
      attrs: { title: '在浏览器内的沙盒终端里按参考答案执行（不碰真实文件）' }
    });
    var reveal = util.el('button', { className: 'btn ghost sm', text: '查看参考答案' });
    var statEl = util.el('span', { className: 'ex-stat', text: statText(stat) });
    actions.appendChild(submit);
    actions.appendChild(run);
    actions.appendChild(reveal);
    actions.appendChild(statEl);
    card.appendChild(actions);

    run.addEventListener('click', function () { refs.onRun(ex); });

    var answerBox = util.el('div', { className: 'ex-answer' });
    answerBox.hidden = true;
    var pre = util.el('pre', { className: 'code-block' });
    pre.appendChild(util.el('code', { text: ex.answer }));
    answerBox.appendChild(pre);
    if (ex.note) {
      answerBox.appendChild(util.el('p', { className: 'ex-note', text: '💡 ' + ex.note }));
    }
    var copyBtn = util.el('button', {
      className: 'btn ghost xs',
      text: '复制答案',
      on: {
        click: function () {
          util.copy(ex.answer);
          copyBtn.textContent = '已复制 ✓';
          setTimeout(function () { copyBtn.textContent = '复制答案'; }, 1500);
        }
      }
    });
    answerBox.appendChild(copyBtn);
    card.appendChild(answerBox);

    /* —— 提交判分 —— */
    submit.addEventListener('click', function () {
      var result = LX.Quiz.judge(input.value, ex);
      var isRight = result.status === 'right';
      LX.Progress.recordQuiz(ex.id, isRight);

      feedback.hidden = false;
      feedback.className = 'ex-feedback is-' + result.status;
      feedback.textContent = result.message;

      if (isRight) {
        card.classList.add('is-solved');
        input.classList.remove('is-wrong');
        input.classList.add('is-right');
      } else {
        input.classList.add('is-wrong');
        input.classList.remove('is-right');
      }

      statEl.textContent = statText(LX.Progress.quizStat(ex.id));
      refs.onChange();
    });

    input.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        submit.click();
      }
    });

    reveal.addEventListener('click', function () {
      answerBox.hidden = !answerBox.hidden;
      reveal.textContent = answerBox.hidden ? '查看参考答案' : '收起参考答案';
    });

    return card;
  }

  function renderExamples(node) {
    var sec = util.el('section', { className: 'lesson-section' });
    var list = node.examples;
    sec.appendChild(util.el('h3', {
      className: 'section-title',
      text: list.length ? '动手练习 · ' + list.length + ' 题' : '动手练习'
    }));

    if (!list.length) {
      sec.appendChild(util.el('p', {
        className: 'muted',
        text: '这个知识点暂时没有配套例题，可以点上面的"问 AI"让助手出一道。'
      }));
      return sec;
    }

    list.forEach(function (ex, i) { sec.appendChild(exampleCard(ex, i)); });
    return sec;
  }

  /* ----------------------------- 关联 / 子节点 ----------------------------- */

  function renderRelated(node) {
    var related = LX.Data.relatedOf(node.id, 6);
    if (!related.length) return null;
    var sec = util.el('section', { className: 'lesson-section' });
    sec.appendChild(util.el('h3', { className: 'section-title', text: '智能关联推荐' }));
    var wrap = util.el('div', { className: 'chips' });
    related.forEach(function (r) {
      wrap.appendChild(util.el('button', {
        className: 'chip',
        text: r.name,
        attrs: { title: r.full || r.name },
        on: { click: function () { refs.onNavigate(r.id); } }
      }));
    });
    sec.appendChild(wrap);
    return sec;
  }

  function renderChildren(node) {
    if (!node.children.length) return null;
    var sec = util.el('section', { className: 'lesson-section' });
    sec.appendChild(util.el('h3', {
      className: 'section-title',
      text: '延伸子知识点 · ' + node.children.length
    }));
    var list = util.el('div', { className: 'child-list' });
    node.children.forEach(function (c) {
      list.appendChild(util.el('button', {
        className: 'child-item',
        on: { click: function () { refs.onNavigate(c.id); } }
      }, [
        util.el('span', { className: 'child-name', text: c.name }),
        util.el('span', { className: 'child-plain', text: c.plain || c.full || '' })
      ]));
    });
    sec.appendChild(list);
    return sec;
  }
  /* ------------------------------- 公共接口 ------------------------------- */

  var Lesson = {
    /**
     * 初始化
     * @param {Object} options {panel, body, onNavigate, onChange, onAsk}
     */
    init: function (options) {
      var opts = options || {};
      refs.panel = opts.panel || null;
      refs.body = opts.body || null;
      refs.onNavigate = opts.onNavigate || function () {};
      refs.onChange = opts.onChange || function () {};
      refs.onAsk = opts.onAsk || function () {};
      refs.onRun = opts.onRun || function () {};
      return this;
    },

    /** 渲染指定知识点（同时把抽屉打开） */
    render: function (nodeId) {
      var node = LX.Data.get(nodeId);
      if (!node || !refs.body) return;
      refs.currentId = nodeId;

      var body = refs.body;
      body.innerHTML = '';

      body.appendChild(renderCrumb(node));
      body.appendChild(renderHead(node));
      body.appendChild(renderActions(node));
      body.appendChild(util.el('p', {
        className: 'lesson-plain',
        text: node.plain || '（暂无通俗说明）'
      }));

      [
        renderTips(node),
        renderExamples(node),
        renderRelated(node),
        renderChildren(node)
      ].forEach(function (sec) {
        if (sec) body.appendChild(sec);
      });

      if (refs.panel) refs.panel.classList.add('is-open');
      if (body.scrollTo) body.scrollTo({ top: 0, behavior: 'auto' });
      else body.scrollTop = 0;
    },

    /** 关闭抽屉 */
    close: function () {
      if (refs.panel) refs.panel.classList.remove('is-open');
    },

    /** 当前展示的知识点 id */
    current: function () { return refs.currentId; },

    /** 进度变化后原地重绘 */
    refresh: function () {
      if (refs.currentId) Lesson.render(refs.currentId);
    }
  };

  LX.Lesson = Lesson;
})(window);


