/* =============================================================================
 * js/galaxy.js
 * -----------------------------------------------------------------------------
 * "银河系知识地图"渲染器
 *
 * 设计要点：
 *   · 布局：优先使用 CDN 引入的 D3 v7（d3.forceSimulation 力导向 +
 *     forceRadial 同心圈），做出"核心居中、分支向外辐射"的星系结构；
 *     若 D3 加载失败（离线 / CDN 被墙），自动退化为本文件内置的
 *     确定性辐射布局，功能完全可用 —— 这是本项目的降级方案。
 *   · 渲染：用原生 SVG API 生成节点与连线（不依赖任何框架），
 *     每次节点集合变化重建一次，模拟 tick 时只更新坐标属性，性能稳定。
 *   · 交互：点击节点 → 展开/收起 + 通知外部打开详情；
 *     鼠标滚轮缩放、空白处拖拽平移、节点可拖拽、悬停显示提示卡。
 * ========================================================================== */
(function (global) {
  'use strict';

  var LX = global.LX = global.LX || {};
  var util = LX.util;
  var SVG_NS = 'http://www.w3.org/2000/svg';

  /** 每个一级分支一种颜色，让"星系"有分区感 */
  var BRANCH_COLORS = {
    env: '#5eead4',
    term: '#22d3ee',
    day1: '#60a5fa',
    day2: '#818cf8',
    day3: '#c084fc',
    day4: '#f472b6',
    day5: '#fb923c',
    day6: '#facc15',
    day7: '#4ade80',
    cheatsheet: '#38bdf8',
    next: '#f87171'
  };

  /** 新增分支（内容扩展文件里注册的）按顺序取色，避免出现"灰点" */
  var FALLBACK_COLORS = ['#5eead4', '#22d3ee', '#60a5fa', '#818cf8', '#c084fc',
    '#f472b6', '#fb923c', '#facc15', '#4ade80', '#38bdf8', '#f87171'];

  /** 各层级节点半径 */
  var RADIUS = [34, 21, 12, 7];

  var state = {
    svg: null,
    wrap: null,
    tooltip: null,
    viewport: null,
    layerLinks: null,
    layerNodes: null,
    onSelect: function () {},
    selectedId: 'linux',
    hoverId: null,
    size: { w: 900, h: 620 },
    view: { x: 0, y: 0, k: 1 },
    nodes: [],
    links: [],
    expanded: ['linux'],
    sim: null,
    dragging: null,
    panning: null,
    paintPending: false,
    searchHits: null
  };

  /* ------------------------------- 基础工具 ------------------------------- */

  function svgEl(tag, attrs) {
    var node = document.createElementNS(SVG_NS, tag);
    Object.keys(attrs || {}).forEach(function (k) {
      node.setAttribute(k, attrs[k]);
    });
    return node;
  }

  function radiusOf(node) {
    return RADIUS[node.level] || 6;
  }

  function colorOf(node) {
    if (node.level === 0) return '#e2e8f0';
    if (BRANCH_COLORS[node.branch]) return BRANCH_COLORS[node.branch];
    var branches = (LX.Data && LX.Data.branches) ? LX.Data.branches() : [];
    var idx = 0;
    for (var i = 0; i < branches.length; i++) {
      if (branches[i].id === node.branch) { idx = i; break; }
    }
    return FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
  }

  function isExpanded(id) {
    return state.expanded.indexOf(id) >= 0;
  }

  /* --------------------------- 可见节点集合计算 --------------------------- */

  /**
   * 从核心节点出发收集当前应显示的节点与连线。
   * 规则：核心永远展开；一级/二级节点只有在"自己已被展开"时才显示子节点。
   */
  function collect(node, out) {
    out.nodes.push(node);
    var open = node.id === 'linux' || isExpanded(node.id);
    if (!open) return;
    node.children.forEach(function (child) {
      out.links.push({ source: node.id, target: child.id });
      collect(child, out);
    });
  }

  /**
   * 构建渲染模型：保留上次的坐标，让展开/收起时节点不会乱跳
   */
  function buildModel() {
    var raw = { nodes: [], links: [] };
    collect(LX.Data.root, raw);

    var prev = {};
    state.nodes.forEach(function (n) { prev[n.id] = n; });

    var nodes = raw.nodes.map(function (n) {
      var old = prev[n.id];
      return {
        id: n.id,
        name: n.name,
        full: n.full,
        plain: n.plain,
        level: n.level,
        branch: n.branch,
        childCount: n.children.length,
        x: old && isFinite(old.x) ? old.x : undefined,
        y: old && isFinite(old.y) ? old.y : undefined,
        vx: 0,
        vy: 0,
        ref: n,
        el: null,
        label: null
      };
    });

    var byId = {};
    nodes.forEach(function (n) { byId[n.id] = n; });

    var links = raw.links.map(function (l) {
      return { source: byId[l.source], target: byId[l.target], el: null };
    }).filter(function (l) { return l.source && l.target; });

    state.nodes = nodes;
    state.links = links;
  }
  /* -------------------------------- 布局 -------------------------------- */

  /** 使用 D3 力导向模拟（含 forceRadial，形成同心星系结构） */
  function startSimulation() {
    var d3 = global.d3;
    if (!d3 || !d3.forceSimulation) {
      fallbackLayout();
      return;
    }
    if (state.sim) state.sim.stop();

    var cx = state.size.w / 2;
    var cy = state.size.h / 2;
    var span = Math.min(cx, cy);

    var sim = d3.forceSimulation(state.nodes)
      .force('link', d3.forceLink(state.links)
        .id(function (d) { return d.id; })
        .distance(function (l) {
          return l.target.level === 1 ? 165 : (l.target.level === 2 ? 92 : 54);
        })
        .strength(0.7))
      .force('charge', d3.forceManyBody().strength(function (d) {
        return d.level === 0 ? -1100 : d.level === 1 ? -380 : d.level === 2 ? -140 : -50;
      }))
      .force('collide', d3.forceCollide().radius(function (d) { return radiusOf(d) + 16; }))
      .force('radial', d3.forceRadial(function (d) {
        return d.level === 0 ? 0
          : d.level === 1 ? span * 0.62
            : d.level === 2 ? span * 1.02
              : span * 1.3;
      }, cx, cy).strength(0.32))
      .alpha(0.9)
      .alphaDecay(0.03);

    sim.on('tick', schedulePaint);
    state.sim = sim;
  }

  /**
   * 降级布局（没有 D3 时使用）：
   * 核心居中，一级分支均匀分布在一个圆上，二/三级节点朝父节点外侧扇形展开。
   */
  function fallbackLayout() {
    var cx = state.size.w / 2;
    var cy = state.size.h / 2;
    var span = Math.min(state.size.w, state.size.h);

    state.nodes.forEach(function (n) {
      if (n.level === 0) { n.x = cx; n.y = cy; }
    });

    var branches = state.nodes.filter(function (n) { return n.level === 1; });
    var R1 = span * 0.30;
    branches.forEach(function (n, i) {
      var angle = (i / Math.max(branches.length, 1)) * Math.PI * 2 - Math.PI / 2;
      n.x = cx + Math.cos(angle) * R1;
      n.y = cy + Math.sin(angle) * R1;
      n.angle = angle;
    });

    function placeChildren(parentLevel, radius, spread) {
      state.nodes.filter(function (n) { return n.level === parentLevel; }).forEach(function (p) {
        var kids = state.nodes.filter(function (n) { return n.parent === p.id; });
        if (!kids.length) return;
        var base = p.angle != null ? p.angle : Math.atan2(p.y - cy, p.x - cx);
        kids.forEach(function (k, i) {
          var offset = kids.length > 1 ? (i / (kids.length - 1) - 0.5) * spread : 0;
          var a = base + offset;
          k.x = cx + Math.cos(a) * radius;
          k.y = cy + Math.sin(a) * radius;
          k.angle = a;
        });
      });
    }

    placeChildren(1, span * 0.46, Math.PI * 0.55);
    placeChildren(2, span * 0.62, Math.PI * 0.5);
    schedulePaint();
  }
  /* -------------------------------- 绘制 -------------------------------- */

  function schedulePaint() {
    if (state.paintPending) return;
    state.paintPending = true;
    requestAnimationFrame(function () {
      state.paintPending = false;
      paint();
    });
  }

  /** 只更新坐标（模拟 tick 高频调用，避免重建 DOM） */
  function paint() {
    var k = state.view.k;
    if (state.viewport) {
      state.viewport.setAttribute('transform',
        'translate(' + state.view.x + ',' + state.view.y + ') scale(' + k + ')');
    }

    state.links.forEach(function (l) {
      if (!l.el) return;
      l.el.setAttribute('x1', l.source.x || 0);
      l.el.setAttribute('y1', l.source.y || 0);
      l.el.setAttribute('x2', l.target.x || 0);
      l.el.setAttribute('y2', l.target.y || 0);
    });

    state.nodes.forEach(function (n) {
      if (!n.el) return;
      n.el.setAttribute('transform', 'translate(' + (n.x || 0) + ',' + (n.y || 0) + ')');
      if (n.label) {
        // 三级节点标签默认隐藏，放大或选中/悬停时才出现，避免星图过密
        var show = n.level <= 2 || k > 1.15 || state.selectedId === n.id || state.hoverId === n.id;
        n.label.style.opacity = show ? '1' : '0';
      }
    });
  }

  /** 重建模型 + DOM + 布局（展开/收起、搜索后调用） */
  function render() {
    buildModel();
    buildDom();
    startSimulation();
    schedulePaint();
  }

  function buildDom() {
    var vp = state.viewport;
    while (vp.firstChild) vp.removeChild(vp.firstChild);

    var gLinks = svgEl('g', { class: 'g-links' });
    var gNodes = svgEl('g', { class: 'g-nodes' });
    vp.appendChild(gLinks);
    vp.appendChild(gNodes);

    state.links.forEach(function (l) {
      var line = svgEl('line', { class: 'link lv' + l.target.level });
      gLinks.appendChild(line);
      l.el = line;
    });

    state.nodes.forEach(function (n) {
      var r = radiusOf(n);
      var color = colorOf(n);
      var g = svgEl('g', {
        class: 'node lv' + n.level + (n.childCount ? ' expandable' : ''),
        'data-id': n.id
      });

      var halo = svgEl('circle', { class: 'halo', r: r + 9 });
      halo.style.stroke = color;
      var core = svgEl('circle', { class: 'core', r: r });
      core.style.fill = color;
      g.appendChild(halo);
      g.appendChild(core);

      if (n.childCount) {
        var badge = svgEl('text', { class: 'badge', y: -r - 5, 'text-anchor': 'middle' });
        badge.textContent = isExpanded(n.id) ? '−' : '+';
        g.appendChild(badge);
      }

      var label = svgEl('text', { class: 'node-label', y: r + 15, 'text-anchor': 'middle' });
      label.textContent = n.name;
      g.appendChild(label);
      n.label = label;

      bindNodeEvents(g, n);
      gNodes.appendChild(g);
      n.el = g;
    });

    applyStateClasses();
  }

  /** 同步"选中 / 已学 / 展开 / 搜索命中"等状态样式 */
  function applyStateClasses() {
    var hits = state.searchHits;
    state.nodes.forEach(function (n) {
      if (!n.el) return;
      var cl = n.el.classList;
      var hit = hits ? hits.indexOf(n.id) >= 0 : false;
      cl.toggle('is-selected', n.id === state.selectedId);
      cl.toggle('is-done', LX.Progress.isDone(n.id));
      cl.toggle('is-open', isExpanded(n.id));
      cl.toggle('is-hit', hit);
      cl.toggle('is-dim', !!hits && !hit);
      var badge = n.el.querySelector('.badge');
      if (badge) badge.textContent = isExpanded(n.id) ? '−' : '+';
    });
  }
  /* -------------------------------- 交互 -------------------------------- */

  function svgPoint(evt) {
    var rect = state.svg.getBoundingClientRect();
    return { x: evt.clientX - rect.left, y: evt.clientY - rect.top };
  }

  function zoomAt(pt, factor) {
    var view = state.view;
    var k = Math.min(2.6, Math.max(0.3, view.k * factor));
    var ratio = k / view.k;
    view.x = pt.x - (pt.x - view.x) * ratio;
    view.y = pt.y - (pt.y - view.y) * ratio;
    view.k = k;
    schedulePaint();
  }

  function showTooltip(n) {
    var tip = state.tooltip;
    if (!tip) return;
    tip.innerHTML =
      '<div class="tip-name">' + util.escape(n.name) + '</div>' +
      (n.full ? '<div class="tip-full">' + util.escape(n.full) + '</div>' : '') +
      (n.plain ? '<div class="tip-plain">' + util.escape(n.plain) + '</div>' : '') +
      '<div class="tip-hint">' +
      (n.childCount ? (isExpanded(n.id) ? '点击收起子节点' : '点击展开子节点') : '点击查看详情') +
      '</div>';

    if (n.el) {
      var r = n.el.getBoundingClientRect();
      var wrapRect = state.wrap.getBoundingClientRect();
      tip.style.left = (r.left - wrapRect.left + r.width / 2) + 'px';
      tip.style.top = (r.top - wrapRect.top - 12 + (state.wrap.scrollTop || 0)) + 'px';
    }
    tip.classList.add('is-visible');
  }

  function hideTooltip() {
    if (state.tooltip) state.tooltip.classList.remove('is-visible');
  }

  /** 节点上的拖拽 + 点击 + 悬停 */
  function bindNodeEvents(g, n) {
    g.addEventListener('pointerdown', function (evt) {
      evt.stopPropagation();
      state.dragging = {
        node: n,
        start: svgPoint(evt),
        origin: { x: n.x || 0, y: n.y || 0 },
        moved: false
      };
      if (state.sim && state.sim.alphaTarget) {
        state.sim.alphaTarget(0.25).restart();
        n.fx = n.x;
        n.fy = n.y;
      }
      if (g.setPointerCapture) g.setPointerCapture(evt.pointerId);
    });

    g.addEventListener('pointermove', function (evt) {
      var d = state.dragging;
      if (!d || d.node !== n) return;
      var p = svgPoint(evt);
      var dx = (p.x - d.start.x) / state.view.k;
      var dy = (p.y - d.start.y) / state.view.k;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) d.moved = true;
      n.x = d.origin.x + dx;
      n.y = d.origin.y + dy;
      if (state.sim) { n.fx = n.x; n.fy = n.y; }
      schedulePaint();
    });

    g.addEventListener('pointerup', function () {
      var d = state.dragging;
      state.dragging = null;
      if (state.sim && state.sim.alphaTarget) {
        state.sim.alphaTarget(0);
        n.fx = null;
        n.fy = null;
      }
      if (d && !d.moved) Galaxy.select(n.id, { toggle: true });
    });

    g.addEventListener('pointerenter', function () {
      state.hoverId = n.id;
      if (n.el) n.el.classList.add('is-hover');
      showTooltip(n);
      schedulePaint();
    });

    g.addEventListener('pointerleave', function () {
      state.hoverId = null;
      if (n.el) n.el.classList.remove('is-hover');
      hideTooltip();
      schedulePaint();
    });
  }

  /** 画布：空白拖拽平移、滚轮缩放 */
  function bindCanvasEvents() {
    var svg = state.svg;

    svg.addEventListener('pointerdown', function (evt) {
      if (evt.target.closest && evt.target.closest('.node')) return;
      state.panning = {
        start: svgPoint(evt),
        origin: { x: state.view.x, y: state.view.y }
      };
      svg.classList.add('is-panning');
      hideTooltip();
      if (svg.setPointerCapture) svg.setPointerCapture(evt.pointerId);
    });

    svg.addEventListener('pointermove', function (evt) {
      if (!state.panning) return;
      var p = svgPoint(evt);
      state.view.x = state.panning.origin.x + (p.x - state.panning.start.x);
      state.view.y = state.panning.origin.y + (p.y - state.panning.start.y);
      schedulePaint();
    });

    function endPan() {
      if (!state.panning) return;
      state.panning = null;
      svg.classList.remove('is-panning');
    }
    svg.addEventListener('pointerup', endPan);
    svg.addEventListener('pointercancel', endPan);
    svg.addEventListener('pointerleave', endPan);

    svg.addEventListener('wheel', function (evt) {
      evt.preventDefault();
      zoomAt(svgPoint(evt), evt.deltaY < 0 ? 1.12 : 1 / 1.12);
    }, { passive: false });
  }

  /** 背景星尘（不随缩放变化，只做氛围） */
  function buildStarfield() {
    var g = svgEl('g', { class: 'starfield' });
    var seed = 20240501;
    function rnd() {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    }
    for (var i = 0; i < 90; i++) {
      g.appendChild(svgEl('circle', {
        cx: Math.round(rnd() * state.size.w),
        cy: Math.round(rnd() * state.size.h),
        r: (rnd() * 1.4 + 0.3).toFixed(2),
        'data-o': (rnd() * 0.55 + 0.12).toFixed(2)
      }));
    }
    state.svg.appendChild(g);
  }
  /* ------------------------------ 展开逻辑 ------------------------------ */

  /** 展开目标节点的所有祖先，保证它在星图上可见 */
  function expandPath(id) {
    var changed = false;
    LX.Data.pathOf(id).forEach(function (n) {
      if (n.id === id || !n.children.length) return;
      if (state.expanded.indexOf(n.id) < 0) {
        state.expanded.push(n.id);
        changed = true;
      }
    });
    return changed;
  }

  /** 收起某节点及其所有后代的展开状态 */
  function removeExpand(id) {
    var kill = {};
    (function walk(n) {
      if (!n || !n.id) return;
      kill[n.id] = true;
      (n.children || []).forEach(walk);
    })(LX.Data.get(id));

    var before = state.expanded.length;
    state.expanded = state.expanded.filter(function (x) { return !kill[x]; });
    LX.Progress.setExpanded(state.expanded.slice());
    return state.expanded.length !== before;
  }

  /** 当前可见节点的包围盒，用于"自适应缩放" */
  function bounds() {
    var xs = [], ys = [];
    state.nodes.forEach(function (n) {
      if (isFinite(n.x) && isFinite(n.y)) { xs.push(n.x); ys.push(n.y); }
    });
    if (!xs.length) return null;
    return {
      minX: Math.min.apply(null, xs),
      maxX: Math.max.apply(null, xs),
      minY: Math.min.apply(null, ys),
      maxY: Math.max.apply(null, ys)
    };
  }
  /* ------------------------------ 公共接口 ------------------------------ */

  var Galaxy = {
    /** 是否成功用上 CDN 上的 D3 */
    hasD3: function () { return !!(global.d3 && global.d3.forceSimulation); },

    /**
     * 初始化
     * @param {Object} options {svg, wrap, tooltip, onSelect, expanded, selectedId}
     */
    init: function (options) {
      var opts = options || {};
      state.svg = opts.svg;
      state.wrap = opts.wrap || state.svg.parentNode;
      state.tooltip = opts.tooltip || null;
      state.onSelect = opts.onSelect || function () {};
      state.expanded = (opts.expanded && opts.expanded.length) ? opts.expanded.slice() : ['linux'];
      if (state.expanded.indexOf('linux') < 0) state.expanded.push('linux');
      state.selectedId = opts.selectedId || 'linux';

      var rect = state.svg.getBoundingClientRect();
      state.size.w = Math.max(320, Math.round(rect.width) || 900);
      state.size.h = Math.max(280, Math.round(rect.height) || 620);
      // 让 SVG 内部坐标等于 CSS 像素，缩放 / 平移换算才准确
      state.svg.setAttribute('viewBox', '0 0 ' + state.size.w + ' ' + state.size.h);

      buildStarfield();
      state.viewport = svgEl('g', { class: 'galaxy-viewport' });
      state.svg.appendChild(state.viewport);

      bindCanvasEvents();
      expandPath(state.selectedId);
      render();
      return this;
    },

    /** 容器尺寸变化时调用 */
    resize: function () {
      if (!state.svg) return;
      var rect = state.svg.getBoundingClientRect();
      var w = Math.max(320, Math.round(rect.width) || 900);
      var h = Math.max(280, Math.round(rect.height) || 620);
      if (w === state.size.w && h === state.size.h) return;
      state.size.w = w;
      state.size.h = h;
      state.svg.setAttribute('viewBox', '0 0 ' + w + ' ' + h);
      if (state.sim) {
        var radial = state.sim.force('radial');
        if (radial) radial.x(w / 2).y(h / 2);
        state.sim.alpha(0.4).restart();
      } else {
        fallbackLayout();
      }
      schedulePaint();
    },

    /**
     * 选中节点
     * @param {string} id
     * @param {{toggle:boolean, silent:boolean}} opts toggle: 有子节点时切换展开态
     */
    select: function (id, opts) {
      opts = opts || {};
      var node = LX.Data.get(id);
      if (!node) return;

      var needRender = expandPath(id);

      if (opts.toggle && node.children.length) {
        if (state.expanded.indexOf(id) >= 0) {
          if (removeExpand(id)) needRender = true;
        } else {
          state.expanded.push(id);
          needRender = true;
        }
      }

      state.selectedId = id;
      LX.Progress.setExpanded(state.expanded.slice());
      LX.Progress.setLastNode(id);

      if (needRender) render();
      else applyStateClasses();

      if (opts.silent !== true) state.onSelect(id);
    },

    /** 选中并把节点移到视野中央（侧边栏点击时用） */
    focus: function (id) {
      this.select(id, { silent: true });
      var go = function () {
        var target = null;
        state.nodes.forEach(function (n) { if (n.id === id) target = n; });
        if (!target || !isFinite(target.x) || !isFinite(target.y)) return;
        state.view.k = Math.max(state.view.k, 0.9);
        state.view.x = state.size.w / 2 - target.x * state.view.k;
        state.view.y = state.size.h / 2 - target.y * state.view.k;
        schedulePaint();
      };
      go();
      setTimeout(go, 650);   // 等模拟稳定后再对齐一次
    },

    /** 展开某节点的子节点 */
    expand: function (id) {
      if (state.expanded.indexOf(id) >= 0) return;
      state.expanded.push(id);
      LX.Progress.setExpanded(state.expanded.slice());
      render();
    },

    /** 收起某节点（连同后代） */
    collapse: function (id) {
      if (removeExpand(id)) render();
    },

    /** 一键展开（核心 + 全部一级 + 全部二级） */
    expandAll: function () {
      var ids = ['linux'];
      LX.Data.nodes.forEach(function (n) {
        if (n.children.length && n.level >= 1 && n.level <= 2) ids.push(n.id);
      });
      state.expanded = ids;
      LX.Progress.setExpanded(ids.slice());
      render();
      setTimeout(function () { Galaxy.fit(); }, 900);
    },

    /** 一键折叠回初始状态 */
    collapseAll: function () {
      state.expanded = ['linux'];
      LX.Progress.setExpanded(['linux']);
      render();
      this.resetView();
      this.fit();
    },

    /** 搜索高亮：命中节点发光，其余变暗 */
    highlight: function (term) {
      if (!term) {
        state.searchHits = null;
      } else {
        var visible = {};
        state.nodes.forEach(function (n) { visible[n.id] = true; });
        state.searchHits = LX.Data.search(term)
          .map(function (n) { return n.id; })
          .filter(function (id) { return visible[id]; });
      }
      applyStateClasses();
    },

    /** 进度变化后刷新"已学"标记 */
    refresh: function () { applyStateClasses(); }
  };
  /* ----------------------------- 视图控制补充 ----------------------------- */

  Galaxy.zoomIn = function () {
    zoomAt({ x: state.size.w / 2, y: state.size.h / 2 }, 1.2);
  };

  Galaxy.zoomOut = function () {
    zoomAt({ x: state.size.w / 2, y: state.size.h / 2 }, 1 / 1.2);
  };

  Galaxy.resetView = function () {
    state.view = { x: 0, y: 0, k: 1 };
    schedulePaint();
  };

  /** 自适应缩放：把当前所有可见节点框进视野 */
  Galaxy.fit = function () {
    var b = bounds();
    if (!b) return;
    var pad = 90;
    var w = Math.max(120, b.maxX - b.minX + pad * 2);
    var h = Math.max(120, b.maxY - b.minY + pad * 2);
    var k = Math.min(state.size.w / w, state.size.h / h);
    state.view.k = Math.max(0.35, Math.min(1.6, k));
    state.view.x = state.size.w / 2 - (b.minX + b.maxX) / 2 * state.view.k;
    state.view.y = state.size.h / 2 - (b.minY + b.maxY) / 2 * state.view.k;
    schedulePaint();
  };

  /** 当前选中的节点 id */
  Galaxy.selected = function () { return state.selectedId; };

  LX.Galaxy = Galaxy;
})(window);






