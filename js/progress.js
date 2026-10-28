/* =============================================================================
 * js/progress.js
 * -----------------------------------------------------------------------------
 * 学习进度（localStorage 持久化）
 *
 * 记录两类数据：
 *   learned  { 节点id: true }                  —— 手动"标记已学"
 *   quiz     { 例题id: {ok:次数, no:次数} }    —— 例题作答结果
 * 另外保存 lastNode（上次看的知识点）与 expanded（星图展开状态），刷新后可还原。
 * ========================================================================== */
(function (global) {
  'use strict';

  var LX = global.LX = global.LX || {};
  var util = LX.util;

  var KEY_PROGRESS = 'lx_progress_v1';
  var KEY_SETTINGS = 'lx_settings_v1';

  var PROGRESS_DEFAULT = {
    learned: {},
    quiz: {},
    lastNode: 'linux',
    expanded: ['linux']
  };

  /** AI 设置默认值：不填 Key 时使用本地知识库回答 */
  var SETTINGS_DEFAULT = {
    theme: 'dark',
    apiKey: '',
    apiUrl: 'https://api.deepseek.com/v1/chat/completions',
    model: 'deepseek-chat'
  };

  function merge(base, extra) {
    var out = {};
    Object.keys(base).forEach(function (k) { out[k] = base[k]; });
    Object.keys(extra || {}).forEach(function (k) { out[k] = extra[k]; });
    return out;
  }

  var state = merge(PROGRESS_DEFAULT, util.storage.get(KEY_PROGRESS, {}));
  var settings = merge(SETTINGS_DEFAULT, util.storage.get(KEY_SETTINGS, {}));

  var listeners = [];

  function emit() {
    listeners.forEach(function (fn) {
      try { fn(state); } catch (e) { /* 单个订阅出错不影响其它 */ }
    });
  }

  function save() {
    util.storage.set(KEY_PROGRESS, state);
  }

  function saveSettings() {
    util.storage.set(KEY_SETTINGS, settings);
  }

  var Progress = {
    /** 订阅变化（侧边栏、进度环等刷新） */
    onChange: function (fn) {
      if (typeof fn === 'function') listeners.push(fn);
      return function () {
        var i = listeners.indexOf(fn);
        if (i >= 0) listeners.splice(i, 1);
      };
    },

    /* ---------------------------- 知识点状态 ---------------------------- */

    isLearned: function (nodeId) {
      return !!state.learned[nodeId];
    },

    toggleLearned: function (nodeId) {
      if (state.learned[nodeId]) delete state.learned[nodeId];
      else state.learned[nodeId] = true;
      save();
      emit();
      return this.isLearned(nodeId);
    },

    /* ----------------------------- 例题结果 ----------------------------- */

    /** 记录一次作答：ok 为是否完全正确 */
    recordQuiz: function (exampleId, ok) {
      var rec = state.quiz[exampleId] || { ok: 0, no: 0 };
      if (ok) rec.ok += 1;
      else rec.no += 1;
      state.quiz[exampleId] = rec;
      save();
      emit();
      return rec;
    },

    quizStat: function (exampleId) {
      return state.quiz[exampleId] || { ok: 0, no: 0 };
    },

    /** 节点内例题统计：{total, right, wrong, tried} */
    nodeQuizStat: function (nodeId) {
      var Data = LX.Data;
      var list = Data.examplesOf(nodeId);
      var stat = { total: list.length, right: 0, wrong: 0, tried: 0 };
      list.forEach(function (ex) {
        var rec = Progress.quizStat(ex.id);
        if (rec.ok > 0) stat.right += 1;
        if (rec.no > 0) stat.wrong += 1;
        if (rec.ok + rec.no > 0) stat.tried += 1;
      });
      return stat;
    },

    /**
     * 节点是否算"完成"：
     *   手动标记已学，或该节点所有例题都至少答对过一次（无例题则只看已学）
     */
    isDone: function (nodeId) {
      if (state.learned[nodeId]) return true;
      var stat = this.nodeQuizStat(nodeId);
      return stat.total > 0 && stat.right === stat.total;
    },

    /* ------------------------------ 统计 ------------------------------- */

    /** 某个一级分支的完成情况 */
    branchStat: function (branchId) {
      var list = LX.Data.learnable().filter(function (n) { return n.branch === branchId; });
      var done = list.filter(function (n) { return Progress.isDone(n.id); }).length;
      return { done: done, total: list.length, pct: util.pct(done, list.length) };
    },

    /** 全站完成情况 */
    overall: function () {
      var list = LX.Data.learnable();
      var done = list.filter(function (n) { return Progress.isDone(n.id); }).length;
      return { done: done, total: list.length, pct: util.pct(done, list.length) };
    },

    /** 例题总览：答对 / 答错 次数 */
    quizOverview: function () {
      var ok = 0, no = 0;
      Object.keys(state.quiz).forEach(function (id) {
        ok += state.quiz[id].ok || 0;
        no += state.quiz[id].no || 0;
      });
      return { ok: ok, no: no };
    },

    /* --------------------------- 视图状态记忆 --------------------------- */

    getLastNode: function () { return state.lastNode || 'linux'; },

    /** 是否已有本地学习记录（用于判断"首次访问"，决定是否弹引导） */
    hasVisited: function () {
      return !!util.storage.get(KEY_PROGRESS, null);
    },

    setLastNode: function (nodeId) {
      state.lastNode = nodeId;
      save();
    },

    getExpanded: function () { return state.expanded || ['linux']; },

    setExpanded: function (ids) {
      state.expanded = ids;
      save();
    },

    /* ------------------------------ 设置 ------------------------------- */

    settings: function () { return settings; },

    saveSettings: function (patch) {
      settings = merge(settings, patch || {});
      saveSettings();
      return settings;
    },

    /* ------------------------------ 重置 ------------------------------- */

    resetAll: function () {
      state = merge(PROGRESS_DEFAULT, {});
      util.storage.remove(KEY_PROGRESS);
      emit();
    }
  };

  LX.Progress = Progress;
})(window);
