/* =============================================================================
 * js/util.js
 * -----------------------------------------------------------------------------
 * 通用小工具：DOM 创建、转义、本地存储读写、节流。
 * 刻意保持极简（无框架依赖），并按顺序在所有模块之前加载。
 * ========================================================================== */
(function (global) {
  'use strict';

  var LX = global.LX = global.LX || {};

  var util = {
    /** 单个选择器 */
    $: function (sel, root) { return (root || document).querySelector(sel); },

    /** 选择器全部结果 → 真数组 */
    $$: function (sel, root) {
      return Array.prototype.slice.call((root || document).querySelectorAll(sel));
    },

    /**
     * 创建 DOM 节点
     * util.el('div', {className:'x', text:'hi', on:{click:fn}}, [child1, child2])
     */
    el: function (tag, opts, children) {
      var node = document.createElement(tag);
      opts = opts || {};
      if (opts.className) node.className = opts.className;
      if (opts.text != null) node.textContent = opts.text;
      if (opts.html != null) node.innerHTML = opts.html;
      if (opts.attrs) {
        Object.keys(opts.attrs).forEach(function (k) {
          node.setAttribute(k, opts.attrs[k]);
        });
      }
      if (opts.on) {
        Object.keys(opts.on).forEach(function (k) {
          node.addEventListener(k, opts.on[k]);
        });
      }
      var kids = children || [];
      if (typeof kids === 'string') {
        node.textContent = kids;
      } else {
        kids.forEach(function (c) {
          if (c) node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
        });
      }
      return node;
    },

    /** HTML 转义，避免内容里的尖括号破坏结构 */
    escape: function (str) {
      return String(str == null ? '' : str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    },

    /** 百分比（向下取整，避免 99.6% 显示成 100%） */
    pct: function (done, total) {
      if (!total) return 0;
      return Math.min(100, Math.floor(done / total * 100));
    },

    /** 防抖 */
    debounce: function (fn, wait) {
      var timer = null;
      return function () {
        var args = arguments;
        var self = this;
        clearTimeout(timer);
        timer = setTimeout(function () { fn.apply(self, args); }, wait || 200);
      };
    },

    /** localStorage 安全封装（隐私模式 / 容量满时不至于崩） */
    storage: {
      get: function (key, fallback) {
        try {
          var raw = global.localStorage.getItem(key);
          return raw ? JSON.parse(raw) : fallback;
        } catch (e) {
          return fallback;
        }
      },
      set: function (key, value) {
        try {
          global.localStorage.setItem(key, JSON.stringify(value));
          return true;
        } catch (e) {
          return false;
        }
      },
      remove: function (key) {
        try { global.localStorage.removeItem(key); } catch (e) { /* ignore */ }
      }
    },

    /** 复制到剪贴板（失败时降级为选中文本） */
    copy: function (text) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text);
      }
      var ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (e) { /* ignore */ }
      document.body.removeChild(ta);
      return Promise.resolve();
    }
  };

  LX.util = util;
})(window);
