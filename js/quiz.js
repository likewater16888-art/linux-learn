/* =============================================================================
 * js/quiz.js
 * -----------------------------------------------------------------------------
 * 判分引擎（纯前端，无需后端）
 *
 * 判分不是简单的字符串相等，做了这些"归一化"处理，容错更友好：
 *   1. 中文标点 → 英文标点
 *   2. 去掉行首提示符 $ 、统一小写、压缩空白、丢弃空行
 *   3. 去掉引号（单/双），因为 echo "x" 和 echo x 常常等价
 *   4. 统一 > >> | && ; 两侧的空格
 *   5. 排序单横杠短参数：ls -al ≡ ls -la
 *   6. 多行答案按行排序后比较：两条命令的先后顺序不影响判等
 * 若不完全相等，再退化成"关键词命中 + 编辑距离相似度"给出分级反馈。
 * ========================================================================== */
(function (global) {
  'use strict';

  var LX = global.LX = global.LX || {};

  var CN_PUNCT = {
    '，': ',', '。': '.', '；': ';', '：': ':', '（': '(', '）': ')',
    '“': '"', '”': '"', '‘': "'", '’': "'", '！': '!', '？': '?', '　': ' '
  };

  function replaceCnPunct(str) {
    return str.replace(/[，。；：（）“”‘’！？　]/g, function (c) {
      return CN_PUNCT[c] || c;
    });
  }

  /** 归一化字符串（比对前统一格式） */
  function normalize(input) {
    var s = String(input == null ? '' : input);
    // 先去掉句末的中文标点（"ls -la。" ≡ "ls -la"），注意不能动 cd .. 这种 ASCII 点
    s = s.replace(/[。！？；]+$/gm, '');
    s = replaceCnPunct(s);
    s = s.replace(/\r\n?/g, '\n');
    s = s.replace(/^\s*\$\s+/gm, '');            // 允许用户粘贴带 $ 的提示符
    s = s.split('\n').map(function (line) {
      return line.trim();
    }).filter(function (line) {
      return line.length > 0;
    }).join('\n');
    s = s.toLowerCase();
    s = s.replace(/["']/g, '');                  // 引号不参与判等
    s = s.replace(/\s*>>\s*/g, '>>');
    s = s.replace(/\s*>\s*/g, '>');
    s = s.replace(/\s*\|\s*/g, '|');
    s = s.replace(/\s*&&\s*/g, '&&');
    s = s.replace(/\s*;\s*/g, ';');
    s = s.replace(/[ \t]+/g, ' ');
    // 单横杠短参数排序：-al → -la
    s = s.replace(/(^|[\s|;>])-([a-z]{2,})(?=[\s|;>]|$)/g, function (m, pre, flags) {
      return pre + '-' + flags.split('').sort().join('');
    });
    return s.trim();
  }

  /** 编辑距离（Levenshtein），用于识别"接近但写错"的答案 */
  function levenshtein(a, b) {
    if (a === b) return 0;
    var la = a.length, lb = b.length;
    if (!la) return lb;
    if (!lb) return la;
    var prev = [], cur = [], i, j;
    for (j = 0; j <= lb; j++) prev[j] = j;
    for (i = 1; i <= la; i++) {
      cur[0] = i;
      for (j = 1; j <= lb; j++) {
        var cost = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1;
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      }
      prev = cur.slice();
    }
    return prev[lb];
  }

  /** 相似度 0~1 */
  function similarity(a, b) {
    if (!a || !b) return 0;
    var d = levenshtein(a, b);
    return 1 - d / Math.max(a.length, b.length);
  }

  function wrap(kw) { return '「' + kw + '」'; }

  /** 行集合比较：两条命令顺序颠倒也算对 */
  function sameLineSet(a, b) {
    var x = a.split('\n').slice().sort().join('\n');
    var y = b.split('\n').slice().sort().join('\n');
    return x === y;
  }

  /**
   * 判分
   * @param {string} input 用户输入
   * @param {Object} example 例题对象（answer / accept / keywords）
   * @return {{status:string, message:string, missing:Array, similarity:number}}
   *         status: right | partial | wrong | empty
   */
  function judge(input, example) {
    var raw = String(input == null ? '' : input).trim();
    var uNorm = normalize(raw);
    if (!uNorm) {
      return {
        status: 'empty',
        message: '还没有输入内容～先在输入框里写出你的命令或答案，再点"提交答案"。',
        missing: [],
        similarity: 0
      };
    }

    var candidates = [example.answer].concat(example.accept || []);
    var best = { sim: 0, norm: '' };

    candidates.forEach(function (c) {
      var cn = normalize(c);
      var sim = cn === uNorm ? 1 : similarity(uNorm, cn);
      if (cn.indexOf('\n') >= 0 || uNorm.indexOf('\n') >= 0) {
        if (sameLineSet(uNorm, cn)) sim = 1;      // 顺序无关
      }
      if (sim > best.sim) best = { sim: sim, norm: cn };
    });

    if (best.sim >= 1) {
      return {
        status: 'right',
        message: '✅ 完全正确！可以继续下一题，或去星图上看看相关知识点。',
        missing: [],
        similarity: 1
      };
    }

    // —— 关键词判定：命中全部关键词说明思路对，只是写法不同 ——
    var kws = (example.keywords || []).map(normalize).filter(Boolean);
    var missing = kws.filter(function (k) { return uNorm.indexOf(k) < 0; });
    var hit = kws.length - missing.length;

    if (kws.length && missing.length === 0) {
      return {
        status: 'partial',
        message: '⚠️ 关键要素全写到了，只是和参考答案的写法不同。展开"查看参考答案"对照一下顺序与参数。',
        missing: [],
        similarity: best.sim
      };
    }

    if (kws.length && hit > 0) {
      return {
        status: 'partial',
        message: '⚠️ 差一点点：还缺少 ' + missing.map(wrap).join('、') + '，补上再提交一次。',
        missing: missing,
        similarity: best.sim
      };
    }

    if (best.sim >= 0.72) {
      return {
        status: 'partial',
        message: '⚠️ 很接近了（相似度 ' + Math.round(best.sim * 100) + '%），检查拼写、空格和参数顺序。',
        missing: missing,
        similarity: best.sim
      };
    }

    return {
      status: 'wrong',
      message: '❌ 和参考答案差别较大。先点"查看步骤"照顺序过一遍，再试一次。',
      missing: missing,
      similarity: best.sim
    };
  }

  LX.Quiz = {
    normalize: normalize,
    similarity: similarity,
    judge: judge
  };
})(window);
