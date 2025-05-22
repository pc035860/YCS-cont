function e(e) {
  return e && e.__esModule ? e.default : e;
}
function t(e, t, r, n) {
  Object.defineProperty(e, t, {
    get: r,
    set: n,
    enumerable: !0,
    configurable: !0,
  });
}
var r =
    'undefined' != typeof globalThis
      ? globalThis
      : 'undefined' != typeof self
      ? self
      : 'undefined' != typeof window
      ? window
      : 'undefined' != typeof global
      ? global
      : {},
  n = {},
  o = {},
  i = r.parcelRequireb06e;
null == i &&
  (((i = function (e) {
    if (e in n) return n[e].exports;
    if (e in o) {
      var t = o[e];
      delete o[e];
      var r = { id: e, exports: {} };
      return (n[e] = r), t.call(r.exports, r, r.exports), r.exports;
    }
    var i = new Error("Cannot find module '" + e + "'");
    throw ((i.code = 'MODULE_NOT_FOUND'), i);
  }).register = function (e, t) {
    o[e] = t;
  }),
  (r.parcelRequireb06e = i)),
  i.register('epVyJ', function (e, r) {
    t(e.exports, 'isNumeric', () => n),
      t(e.exports, 'wrapTryCatch', () => o),
      t(e.exports, 'delayMs', () => s),
      t(e.exports, 'removeNodeList', () => a),
      t(e.exports, 'msToRoundSec', () => u),
      t(e.exports, 'downloadFile', () => l),
      t(e.exports, 'getCommentsHtmlText', () => c),
      t(e.exports, 'getCommentsChatHtmlText', () => h),
      t(e.exports, 'getCommentsTrVideoHtmlText', () => f),
      t(e.exports, 'formatBytes', () => d),
      t(e.exports, 'getPaginate', () => p),
      t(e.exports, 'getSheetDetails', () => g),
      t(e.exports, 'getSheetChatDetails', () => m),
      t(e.exports, 'getSheetComments', () => y),
      t(e.exports, 'getSheetChatComments', () => v),
      t(e.exports, 'getSheetReplies', () => b),
      t(e.exports, 'getSheetTrVideoDetails', () => w),
      t(e.exports, 'getSheetTrVideo', () => x);
    (() => {
      const e = {};
    })();
    function n(e) {
      return (
        ('string' == typeof e || 'number' == typeof e) &&
        !isNaN(e) &&
        !isNaN(parseFloat(e))
      );
    }
    function o(e) {
      try {
        return e();
      } catch (e) {
        return;
      }
    }
    async function s(e) {
      return await new Promise((t) => setTimeout(t, e));
    }
    function a(e) {
      if ('string' != typeof e) return;
      const t = document.querySelectorAll(e);
      for (const e of t) e.remove();
    }
    function u(e) {
      try {
        return e && e > 0 ? parseInt(e / 1e3, 10) : void 0;
      } catch (e) {
        return;
      }
    }
    function l(e, t, r) {
      try {
        const n = document.createElement('a'),
          o = new Blob([e], { type: r });
        (n.href = URL.createObjectURL(o)),
          (n.download = t),
          n.click(),
          URL.revokeObjectURL(n.href);
      } catch (e) {
        return;
      }
    }
    function c(e) {
      if (Array.isArray(e))
        try {
          let d = '',
            p = 0;
          const g = new Set(),
            m = new Set();
          for (const t of e)
            'C' === (null == t ? void 0 : t.typeComment)
              ? ((t.commentRenderer.ycsReplies = []), g.add(t))
              : 'R' === (null == t ? void 0 : t.typeComment) && m.add(t);
          for (const e of g)
            if (o(() => e.commentRenderer.replyCount > 0))
              for (const t of m)
                (null == t
                  ? void 0
                  : t.originComment.commentRenderer.commentId) ===
                  e.commentRenderer.commentId &&
                  (e.commentRenderer.ycsReplies.push(t), m.delete(t));
          const y = (e) => {
              try {
                var t, r, n;
                if (
                  null == e ||
                  null === (t = e.commentRenderer) ||
                  void 0 === t ||
                  null === (r = t.sponsorCommentBadge) ||
                  void 0 === r ||
                  null === (n = r.sponsorCommentBadgeRenderer) ||
                  void 0 === n
                    ? void 0
                    : n.tooltip
                ) {
                  return ` | member: ${e.commentRenderer.sponsorCommentBadge.sponsorCommentBadgeRenderer.tooltip}`;
                }
                return '';
              } catch (e) {
                return '';
              }
            },
            v = (e) => {
              try {
                return 'C' === (null == e ? void 0 : e.typeComment)
                  ? '[COMMENT]'
                  : 'R' === (null == e ? void 0 : e.typeComment)
                  ? '[REPLY]'
                  : '';
              } catch (e) {
                return '';
              }
            },
            b = (e) => {
              try {
                var t;
                return 'C' === (null == e ? void 0 : e.typeComment)
                  ? ` | reply: ${
                      (null == e ||
                      null === (t = e.commentRenderer) ||
                      void 0 === t
                        ? void 0
                        : t.replyCount) || 0
                    }`
                  : '';
              } catch (e) {
                return '';
              }
            },
            w = (e) => {
              try {
                var t, r;
                if (
                  (null == e ||
                  null === (t = e.commentRenderer) ||
                  void 0 === t ||
                  null === (r = t.ycsReplies) ||
                  void 0 === r
                    ? void 0
                    : r.length) > 0
                ) {
                  let t = '\nReplies:\n';
                  for (const r of e.commentRenderer.ycsReplies) {
                    var n, i, s, a, u, l, c, h, f, d, g;
                    p++,
                      (t += `\n${v(r)}\n${
                        (null == r ||
                        null === (n = r.commentRenderer) ||
                        void 0 === n ||
                        null === (i = n.authorText) ||
                        void 0 === i
                          ? void 0
                          : i.simpleText) || ''
                      }\nyoutube.com${
                        (null == r ||
                        null === (s = r.commentRenderer) ||
                        void 0 === s ||
                        null === (a = s.authorEndpoint) ||
                        void 0 === a ||
                        null === (u = a.commandMetadata) ||
                        void 0 === u ||
                        null === (l = u.webCommandMetadata) ||
                        void 0 === l
                          ? void 0
                          : l.url) || ''
                      }\n\nyoutube.com${
                        o(
                          () =>
                            r.commentRenderer.publishedTimeText.runs[0]
                              .navigationEndpoint.commandMetadata
                              .webCommandMetadata.url
                        ) || ''
                      }\n${
                        o(
                          () => r.commentRenderer.publishedTimeText.runs[0].text
                        ) || ''
                      } | like: ${
                        (null == r ||
                        null === (c = r.commentRenderer) ||
                        void 0 === c
                          ? void 0
                          : c.likeCount) ||
                        (null == r ||
                        null === (h = r.commentRenderer) ||
                        void 0 === h ||
                        null === (f = h.voteCount) ||
                        void 0 === f
                          ? void 0
                          : f.simpleText) ||
                        0
                      }${b(r)}${y(r)}\n\n${
                        (null == r ||
                        null === (d = r.commentRenderer) ||
                        void 0 === d ||
                        null === (g = d.contentText) ||
                        void 0 === g
                          ? void 0
                          : g.fullText) || ''
                      }\n\n                        `);
                  }
                  return t;
                }
                return '';
              } catch (e) {
                return '';
              }
            };
          for (const e of g)
            try {
              var t, r, n, i, s, a, u, l, c, h, f;
              p++,
                (d += `\n\n#####\n\n${v(e)}\n${
                  (null == e ||
                  null === (t = e.commentRenderer) ||
                  void 0 === t ||
                  null === (r = t.authorText) ||
                  void 0 === r
                    ? void 0
                    : r.simpleText) || ''
                }\nyoutube.com${
                  (null == e ||
                  null === (n = e.commentRenderer) ||
                  void 0 === n ||
                  null === (i = n.authorEndpoint) ||
                  void 0 === i ||
                  null === (s = i.commandMetadata) ||
                  void 0 === s ||
                  null === (a = s.webCommandMetadata) ||
                  void 0 === a
                    ? void 0
                    : a.url) || ''
                }\n\nyoutube.com${
                  o(
                    () =>
                      e.commentRenderer.publishedTimeText.runs[0]
                        .navigationEndpoint.commandMetadata.webCommandMetadata
                        .url
                  ) || ''
                }\n${
                  o(() => e.commentRenderer.publishedTimeText.runs[0].text) ||
                  ''
                } | like: ${
                  (null == e || null === (u = e.commentRenderer) || void 0 === u
                    ? void 0
                    : u.likeCount) ||
                  (null == e ||
                  null === (l = e.commentRenderer) ||
                  void 0 === l ||
                  null === (c = l.voteCount) ||
                  void 0 === c
                    ? void 0
                    : c.simpleText) ||
                  0
                }${b(e)}${y(e)}\n\n${
                  (null == e ||
                  null === (h = e.commentRenderer) ||
                  void 0 === h ||
                  null === (f = h.contentText) ||
                  void 0 === f
                    ? void 0
                    : f.fullText) || ''
                }\n${w(e)}\n#####\n`);
            } catch (e) {
              continue;
            }
          return { count: p, html: d };
        } catch (e) {
          return;
        }
    }
    function h(e) {
      if (Array.isArray(e))
        try {
          let t = '',
            r = 0;
          for (const n of e)
            try {
              r++,
                (t += `\n\n#####\n\n${
                  o(
                    () =>
                      n.replayChatItemAction.actions[0].addChatItemAction.item
                        .liveChatTextMessageRenderer.authorName.simpleText
                  ) || ''
                }\nyoutube.com/channel/${
                  o(
                    () =>
                      n.replayChatItemAction.actions[0].addChatItemAction.item
                        .liveChatTextMessageRenderer.authorExternalChannelId
                  ) || ''
                }\n\ndate: ${
                  o(() =>
                    new Date(
                      n.replayChatItemAction.actions[0].addChatItemAction.item
                        .liveChatTextMessageRenderer.timestampUsec / 1e3
                    )
                      .toISOString()
                      .slice(0, -5)
                  ) || ''
                }\n\n${
                  o(
                    () =>
                      n.replayChatItemAction.actions[0].addChatItemAction.item
                        .liveChatTextMessageRenderer.purchaseAmountText
                        .simpleText
                  )
                    ? 'donated: ' +
                      n.replayChatItemAction.actions[0].addChatItemAction.item
                        .liveChatTextMessageRenderer.purchaseAmountText
                        .simpleText +
                      '\n'
                    : ''
                }\n${
                  o(
                    () =>
                      n.replayChatItemAction.actions[0].addChatItemAction.item
                        .liveChatTextMessageRenderer.message.fullText
                  ) || ''
                }\n\n#####\n`);
            } catch (e) {
              continue;
            }
          return { count: r, html: t };
        } catch (e) {
          return;
        }
    }
    function f(e) {
      if (Array.isArray(e))
        try {
          let n = '',
            i = 0;
          for (const s of e)
            try {
              var t, r;
              i++,
                (n += `\n\n#####\n\nTime: ${
                  (null == s ||
                  null === (t = s.transcriptCueGroupRenderer) ||
                  void 0 === t ||
                  null === (r = t.formattedStartOffset) ||
                  void 0 === r
                    ? void 0
                    : r.simpleText) || 0
                }\n\n${
                  o(
                    () =>
                      s.transcriptCueGroupRenderer.cues[0].transcriptCueRenderer
                        .cue.simpleText
                  ) || ''
                }\n\n#####\n`);
            } catch (e) {
              continue;
            }
          return { count: i, html: n };
        } catch (e) {
          return;
        }
    }
    function d(e, t = 2) {
      try {
        if (0 === e) return '0 Bytes';
        const r = 1024,
          n = t < 0 ? 0 : t,
          o = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'],
          i = Math.floor(Math.log(e) / Math.log(r));
        return parseFloat((e / Math.pow(r, i)).toFixed(n)) + ' ' + o[i];
      } catch (e) {}
    }
    function p(e, t = 1, r = 10, n = 10) {
      const o = Math.ceil(e / r);
      let i, s;
      if ((t < 1 ? (t = 1) : t > o && (t = o), o <= n)) (i = 1), (s = o);
      else {
        const e = Math.floor(n / 2),
          r = Math.ceil(n / 2) - 1;
        t <= e
          ? ((i = 1), (s = n))
          : t + r >= o
          ? ((i = o - n + 1), (s = o))
          : ((i = t - e), (s = t + r));
      }
      const a = (t - 1) * r,
        u = Math.min(a + r - 1, e - 1),
        l = Array.from(Array(s + 1 - i).keys()).map((e) => i + e);
      return {
        totalItems: e,
        currentPage: t,
        pageSize: r,
        totalPages: o,
        startPage: i,
        endPage: s,
        startIndex: a,
        endIndex: u,
        pages: l,
      };
    }
    function g(e) {
      try {
        if ('object' != typeof e) return;
        return {
          'Cache timestamp': Number(null == e ? void 0 : e.cachedDate),
          URL: null == e ? void 0 : e.urlVideo,
          'Video ID': null == e ? void 0 : e.videoId,
          Title: null == e ? void 0 : e.titleVideo,
          'Total Comments': Number(null == e ? void 0 : e.totalComments),
          'Total Replies': Number(null == e ? void 0 : e.totalReplies),
          Total: Number(null == e ? void 0 : e.total),
        };
      } catch (e) {}
    }
    function m(e) {
      try {
        if ('object' != typeof e) return;
        return {
          'Cache timestamp': Number(null == e ? void 0 : e.cachedDate),
          URL: null == e ? void 0 : e.urlVideo,
          'Video ID': null == e ? void 0 : e.videoId,
          Title: null == e ? void 0 : e.titleVideo,
          Total: Number(null == e ? void 0 : e.total),
        };
      } catch (e) {}
    }
    function y(e) {
      try {
        var t, r, n, o, i;
        if (!Array.isArray(e)) return [];
        const s = [];
        for (const a of e)
          s.push({
            URL: a.commentUrl,
            'Author name':
              null == a || null === (t = a.author) || void 0 === t
                ? void 0
                : t.nameAuthor,
            'Author Channel':
              null == a || null === (r = a.author) || void 0 === r
                ? void 0
                : r.channel,
            'Comment message': null == a ? void 0 : a.commentMessage,
            'Channel owner':
              null == a || null === (n = a.author) || void 0 === n
                ? void 0
                : n.authorIsChannelOwner,
            Member: null == a ? void 0 : a.member,
            Published: null == a ? void 0 : a.publishedTimeText,
            'Total likes': Number(null == a ? void 0 : a.totalLikes),
            Replies:
              0 |
              Number(
                null == a ||
                  null === (o = a.commentReplies) ||
                  void 0 === o ||
                  null === (i = o.replies) ||
                  void 0 === i
                  ? void 0
                  : i.length
              ),
          });
        return s;
      } catch (e) {
        return [];
      }
    }
    function v(e) {
      try {
        if ('object' != typeof e) return [];
        const o = [];
        for (const i of e.commentsChat) {
          var t, r, n;
          const [s, a] = i.timestampText.split(':'),
            u = 60 * Number(s) + Number(a);
          o.push({
            'Timestamp Usec': Number(null == i ? void 0 : i.timestampUsec),
            URL: `https://youtu.be/${e.videoId}?t=${u || 0}`,
            'Author name':
              null == i || null === (t = i.author) || void 0 === t
                ? void 0
                : t.nameAuthor,
            'Author Channel':
              null == i || null === (r = i.author) || void 0 === r
                ? void 0
                : r.channel,
            Member:
              null == i || null === (n = i.author) || void 0 === n
                ? void 0
                : n.member,
            'Comment message': null == i ? void 0 : i.commentMessage,
            'Timestamp comment': null == i ? void 0 : i.timestampText,
          });
        }
        return o;
      } catch (e) {
        return [];
      }
    }
    function b(e) {
      try {
        if (!Array.isArray(e)) return [];
        const i = [];
        for (const s of e) {
          var t, r, n, o;
          if (
            (null == s ||
            null === (t = s.commentReplies) ||
            void 0 === t ||
            null === (r = t.replies) ||
            void 0 === r
              ? void 0
              : r.length) > 0
          )
            for (const e of s.commentReplies.replies)
              i.push({
                'Сommented URL': null == s ? void 0 : s.commentUrl,
                'URL Reply': null == e ? void 0 : e.commentUrl,
                'Author name':
                  null == e || null === (n = e.author) || void 0 === n
                    ? void 0
                    : n.nameAuthor,
                Channel:
                  null == e || null === (o = e.author) || void 0 === o
                    ? void 0
                    : o.channel,
                'Reply message': null == e ? void 0 : e.commentMessage,
                Member: null == e ? void 0 : e.member,
                Published: null == e ? void 0 : e.publishedTimeText,
                'Total likes': Number(null == e ? void 0 : e.totalLikes),
              });
        }
        return i;
      } catch (e) {
        return [];
      }
    }
    function w(e) {
      try {
        if ('object' != typeof e) return;
        return {
          'Cache timestamp': Number(null == e ? void 0 : e.cachedDate),
          URL: null == e ? void 0 : e.urlVideo,
          Title: null == e ? void 0 : e.titleVideo,
          'Video ID': null == e ? void 0 : e.videoId,
          'Title transcript': null == e ? void 0 : e.titleTrVideo,
          Total: Number(null == e ? void 0 : e.total),
        };
      } catch (e) {}
    }
    function x(e) {
      try {
        if ('object' != typeof e) return [];
        const t = [];
        for (const r of e.trVideo)
          t.push({
            URL: null == r ? void 0 : r.urlShare,
            'Video timestamp': null == r ? void 0 : r.formattedStartOffset,
            'Start Offset Ms.': Number(null == r ? void 0 : r.startOffsetMs),
            'Duration Ms.': Number(null == r ? void 0 : r.durationMs),
            Message: null == r ? void 0 : r.message,
          });
        return t;
      } catch (e) {
        return [];
      }
    }
  }),
  i.register('hkaxq', function (e, t) {
    Object.defineProperty(e.exports, '__esModule', { value: !0 });
    var r = i('fRvLS'),
      n = i('1Znjf'),
      o = i('igKao');
    const s = () => {},
      a = new n.TimeoutError();
    e.exports.default = class extends r {
      constructor(e) {
        var t, r, n, i;
        if (
          (super(),
          (this._intervalCount = 0),
          (this._intervalEnd = 0),
          (this._pendingCount = 0),
          (this._resolveEmpty = s),
          (this._resolveIdle = s),
          !(
            'number' ==
              typeof (e = Object.assign(
                {
                  carryoverConcurrencyCount: !1,
                  intervalCap: 1 / 0,
                  interval: 0,
                  concurrency: 1 / 0,
                  autoStart: !0,
                  queueClass: o.default,
                },
                e
              )).intervalCap && e.intervalCap >= 1
          ))
        )
          throw new TypeError(
            `Expected \`intervalCap\` to be a number from 1 and up, got \`${
              null !==
                (r =
                  null === (t = e.intervalCap) || void 0 === t
                    ? void 0
                    : t.toString()) && void 0 !== r
                ? r
                : ''
            }\` (${typeof e.intervalCap})`
          );
        if (
          void 0 === e.interval ||
          !(Number.isFinite(e.interval) && e.interval >= 0)
        )
          throw new TypeError(
            `Expected \`interval\` to be a finite number >= 0, got \`${
              null !==
                (i =
                  null === (n = e.interval) || void 0 === n
                    ? void 0
                    : n.toString()) && void 0 !== i
                ? i
                : ''
            }\` (${typeof e.interval})`
          );
        (this._carryoverConcurrencyCount = e.carryoverConcurrencyCount),
          (this._isIntervalIgnored =
            e.intervalCap === 1 / 0 || 0 === e.interval),
          (this._intervalCap = e.intervalCap),
          (this._interval = e.interval),
          (this._queue = new e.queueClass()),
          (this._queueClass = e.queueClass),
          (this.concurrency = e.concurrency),
          (this._timeout = e.timeout),
          (this._throwOnTimeout = !0 === e.throwOnTimeout),
          (this._isPaused = !1 === e.autoStart);
      }
      get _doesIntervalAllowAnother() {
        return (
          this._isIntervalIgnored || this._intervalCount < this._intervalCap
        );
      }
      get _doesConcurrentAllowAnother() {
        return this._pendingCount < this._concurrency;
      }
      _next() {
        this._pendingCount--, this._tryToStartAnother(), this.emit('next');
      }
      _resolvePromises() {
        this._resolveEmpty(),
          (this._resolveEmpty = s),
          0 === this._pendingCount &&
            (this._resolveIdle(), (this._resolveIdle = s), this.emit('idle'));
      }
      _onResumeInterval() {
        this._onInterval(),
          this._initializeIntervalIfNeeded(),
          (this._timeoutId = void 0);
      }
      _isIntervalPaused() {
        const e = Date.now();
        if (void 0 === this._intervalId) {
          const t = this._intervalEnd - e;
          if (!(t < 0))
            return (
              void 0 === this._timeoutId &&
                (this._timeoutId = setTimeout(() => {
                  this._onResumeInterval();
                }, t)),
              !0
            );
          this._intervalCount = this._carryoverConcurrencyCount
            ? this._pendingCount
            : 0;
        }
        return !1;
      }
      _tryToStartAnother() {
        if (0 === this._queue.size)
          return (
            this._intervalId && clearInterval(this._intervalId),
            (this._intervalId = void 0),
            this._resolvePromises(),
            !1
          );
        if (!this._isPaused) {
          const e = !this._isIntervalPaused();
          if (
            this._doesIntervalAllowAnother &&
            this._doesConcurrentAllowAnother
          ) {
            const t = this._queue.dequeue();
            return (
              !!t &&
              (this.emit('active'),
              t(),
              e && this._initializeIntervalIfNeeded(),
              !0)
            );
          }
        }
        return !1;
      }
      _initializeIntervalIfNeeded() {
        this._isIntervalIgnored ||
          void 0 !== this._intervalId ||
          ((this._intervalId = setInterval(() => {
            this._onInterval();
          }, this._interval)),
          (this._intervalEnd = Date.now() + this._interval));
      }
      _onInterval() {
        0 === this._intervalCount &&
          0 === this._pendingCount &&
          this._intervalId &&
          (clearInterval(this._intervalId), (this._intervalId = void 0)),
          (this._intervalCount = this._carryoverConcurrencyCount
            ? this._pendingCount
            : 0),
          this._processQueue();
      }
      _processQueue() {
        for (; this._tryToStartAnother(); );
      }
      get concurrency() {
        return this._concurrency;
      }
      set concurrency(e) {
        if (!('number' == typeof e && e >= 1))
          throw new TypeError(
            `Expected \`concurrency\` to be a number from 1 and up, got \`${e}\` (${typeof e})`
          );
        (this._concurrency = e), this._processQueue();
      }
      async add(e, t = {}) {
        return new Promise((r, o) => {
          this._queue.enqueue(async () => {
            this._pendingCount++, this._intervalCount++;
            try {
              const i =
                void 0 === this._timeout && void 0 === t.timeout
                  ? e()
                  : n.default(
                      Promise.resolve(e()),
                      void 0 === t.timeout ? this._timeout : t.timeout,
                      () => {
                        (void 0 === t.throwOnTimeout
                          ? this._throwOnTimeout
                          : t.throwOnTimeout) && o(a);
                      }
                    );
              r(await i);
            } catch (e) {
              o(e);
            }
            this._next();
          }, t),
            this._tryToStartAnother(),
            this.emit('add');
        });
      }
      async addAll(e, t) {
        return Promise.all(e.map(async (e) => this.add(e, t)));
      }
      start() {
        return this._isPaused
          ? ((this._isPaused = !1), this._processQueue(), this)
          : this;
      }
      pause() {
        this._isPaused = !0;
      }
      clear() {
        this._queue = new this._queueClass();
      }
      async onEmpty() {
        if (0 !== this._queue.size)
          return new Promise((e) => {
            const t = this._resolveEmpty;
            this._resolveEmpty = () => {
              t(), e();
            };
          });
      }
      async onIdle() {
        if (0 !== this._pendingCount || 0 !== this._queue.size)
          return new Promise((e) => {
            const t = this._resolveIdle;
            this._resolveIdle = () => {
              t(), e();
            };
          });
      }
      get size() {
        return this._queue.size;
      }
      sizeBy(e) {
        return this._queue.filter(e).length;
      }
      get pending() {
        return this._pendingCount;
      }
      get isPaused() {
        return this._isPaused;
      }
      get timeout() {
        return this._timeout;
      }
      set timeout(e) {
        this._timeout = e;
      }
    };
  }),
  i.register('fRvLS', function (e, t) {
    var r = Object.prototype.hasOwnProperty,
      n = '~';
    function o() {}
    function i(e, t, r) {
      (this.fn = e), (this.context = t), (this.once = r || !1);
    }
    function s(e, t, r, o, s) {
      if ('function' != typeof r)
        throw new TypeError('The listener must be a function');
      var a = new i(r, o || e, s),
        u = n ? n + t : t;
      return (
        e._events[u]
          ? e._events[u].fn
            ? (e._events[u] = [e._events[u], a])
            : e._events[u].push(a)
          : ((e._events[u] = a), e._eventsCount++),
        e
      );
    }
    function a(e, t) {
      0 == --e._eventsCount ? (e._events = new o()) : delete e._events[t];
    }
    function u() {
      (this._events = new o()), (this._eventsCount = 0);
    }
    Object.create &&
      ((o.prototype = Object.create(null)), new o().__proto__ || (n = !1)),
      (u.prototype.eventNames = function () {
        var e,
          t,
          o = [];
        if (0 === this._eventsCount) return o;
        for (t in (e = this._events))
          r.call(e, t) && o.push(n ? t.slice(1) : t);
        return Object.getOwnPropertySymbols
          ? o.concat(Object.getOwnPropertySymbols(e))
          : o;
      }),
      (u.prototype.listeners = function (e) {
        var t = n ? n + e : e,
          r = this._events[t];
        if (!r) return [];
        if (r.fn) return [r.fn];
        for (var o = 0, i = r.length, s = new Array(i); o < i; o++)
          s[o] = r[o].fn;
        return s;
      }),
      (u.prototype.listenerCount = function (e) {
        var t = n ? n + e : e,
          r = this._events[t];
        return r ? (r.fn ? 1 : r.length) : 0;
      }),
      (u.prototype.emit = function (e, t, r, o, i, s) {
        var a = n ? n + e : e;
        if (!this._events[a]) return !1;
        var u,
          l,
          c = this._events[a],
          h = arguments.length;
        if (c.fn) {
          switch ((c.once && this.removeListener(e, c.fn, void 0, !0), h)) {
            case 1:
              return c.fn.call(c.context), !0;
            case 2:
              return c.fn.call(c.context, t), !0;
            case 3:
              return c.fn.call(c.context, t, r), !0;
            case 4:
              return c.fn.call(c.context, t, r, o), !0;
            case 5:
              return c.fn.call(c.context, t, r, o, i), !0;
            case 6:
              return c.fn.call(c.context, t, r, o, i, s), !0;
          }
          for (l = 1, u = new Array(h - 1); l < h; l++) u[l - 1] = arguments[l];
          c.fn.apply(c.context, u);
        } else {
          var f,
            d = c.length;
          for (l = 0; l < d; l++)
            switch (
              (c[l].once && this.removeListener(e, c[l].fn, void 0, !0), h)
            ) {
              case 1:
                c[l].fn.call(c[l].context);
                break;
              case 2:
                c[l].fn.call(c[l].context, t);
                break;
              case 3:
                c[l].fn.call(c[l].context, t, r);
                break;
              case 4:
                c[l].fn.call(c[l].context, t, r, o);
                break;
              default:
                if (!u)
                  for (f = 1, u = new Array(h - 1); f < h; f++)
                    u[f - 1] = arguments[f];
                c[l].fn.apply(c[l].context, u);
            }
        }
        return !0;
      }),
      (u.prototype.on = function (e, t, r) {
        return s(this, e, t, r, !1);
      }),
      (u.prototype.once = function (e, t, r) {
        return s(this, e, t, r, !0);
      }),
      (u.prototype.removeListener = function (e, t, r, o) {
        var i = n ? n + e : e;
        if (!this._events[i]) return this;
        if (!t) return a(this, i), this;
        var s = this._events[i];
        if (s.fn)
          s.fn !== t || (o && !s.once) || (r && s.context !== r) || a(this, i);
        else {
          for (var u = 0, l = [], c = s.length; u < c; u++)
            (s[u].fn !== t || (o && !s[u].once) || (r && s[u].context !== r)) &&
              l.push(s[u]);
          l.length ? (this._events[i] = 1 === l.length ? l[0] : l) : a(this, i);
        }
        return this;
      }),
      (u.prototype.removeAllListeners = function (e) {
        var t;
        return (
          e
            ? ((t = n ? n + e : e), this._events[t] && a(this, t))
            : ((this._events = new o()), (this._eventsCount = 0)),
          this
        );
      }),
      (u.prototype.off = u.prototype.removeListener),
      (u.prototype.addListener = u.prototype.on),
      (u.prefixed = n),
      (u.EventEmitter = u),
      (e.exports = u);
  }),
  i.register('1Znjf', function (e, t) {
    var r = i('iiqvO');
    class n extends Error {
      constructor(e) {
        super(e), (this.name = 'TimeoutError');
      }
    }
    const o = (e, t, o) =>
      new Promise((i, s) => {
        if ('number' != typeof t || t < 0)
          throw new TypeError(
            'Expected `milliseconds` to be a positive number'
          );
        if (t === 1 / 0) return void i(e);
        const a = setTimeout(() => {
          if ('function' == typeof o) {
            try {
              i(o());
            } catch (e) {
              s(e);
            }
            return;
          }
          const r =
            o instanceof Error
              ? o
              : new n(
                  'string' == typeof o
                    ? o
                    : `Promise timed out after ${t} milliseconds`
                );
          'function' == typeof e.cancel && e.cancel(), s(r);
        }, t);
        r(e.then(i, s), () => {
          clearTimeout(a);
        });
      });
    (e.exports = o), (e.exports.default = o), (e.exports.TimeoutError = n);
  }),
  i.register('iiqvO', function (e, t) {
    e.exports = (e, t) => (
      (t = t || (() => {})),
      e.then(
        (e) =>
          new Promise((e) => {
            e(t());
          }).then(() => e),
        (e) =>
          new Promise((e) => {
            e(t());
          }).then(() => {
            throw e;
          })
      )
    );
  }),
  i.register('igKao', function (e, t) {
    Object.defineProperty(e.exports, '__esModule', { value: !0 });
    var r = i('4HnjN');
    e.exports.default = class {
      constructor() {
        this._queue = [];
      }
      enqueue(e, t) {
        const n = {
          priority: (t = Object.assign({ priority: 0 }, t)).priority,
          run: e,
        };
        if (this.size && this._queue[this.size - 1].priority >= t.priority)
          return void this._queue.push(n);
        const o = r.default(this._queue, n, (e, t) => t.priority - e.priority);
        this._queue.splice(o, 0, n);
      }
      dequeue() {
        const e = this._queue.shift();
        return null == e ? void 0 : e.run;
      }
      filter(e) {
        return this._queue
          .filter((t) => t.priority === e.priority)
          .map((e) => e.run);
      }
      get size() {
        return this._queue.length;
      }
    };
  }),
  i.register('4HnjN', function (e, t) {
    Object.defineProperty(e.exports, '__esModule', { value: !0 }),
      (e.exports.default = function (e, t, r) {
        let n = 0,
          o = e.length;
        for (; o > 0; ) {
          const i = (o / 2) | 0;
          let s = n + i;
          r(e[s], t) <= 0 ? ((n = ++s), (o -= i + 1)) : (o = i);
        }
        return n;
      });
  }),
  i.register('bRhBe', function (r, n) {
    t(r.exports, 'fetchR', () => a), t(r.exports, 'idb', () => u);
    var o = i('1P6DW'),
      s = i('hMzWZ');
    const a = e(o)(fetch, {
        retries: 100,
        retryDelay: (e, t, r) =>
          'AbortError' !== (null == t ? void 0 : t.name) &&
          (e > 50 ? 6e4 : e > 20 ? 1e4 : 2e3),
        retryOn: (e, t, r) =>
          'AbortError' !== (null == t ? void 0 : t.name) &&
          (null !== t || r.status >= 400 ? !(e > 100) : void 0),
      }),
      u = s.openDB('IDB_YCS', 1, {
        upgrade(e) {
          e.createObjectStore('STORE_CACHE_YCS');
        },
      });
  }),
  i.register('1P6DW', function (e, t) {
    !(function (t, r) {
      'object' == typeof e.exports
        ? (e.exports = r())
        : 'function' == typeof define && define.amd
        ? define(r)
        : ((t =
            'undefined' != typeof globalThis
              ? globalThis
              : t || self).fetchRetry = r());
    })(e.exports, function () {
      function e(e) {
        return Number.isInteger(e) && e >= 0;
      }
      function t(e) {
        (this.name = 'ArgumentError'), (this.message = e);
      }
      return function (r, n) {
        if (((n = n || {}), 'function' != typeof r))
          throw new t('fetch must be a function');
        if ('object' != typeof n) throw new t('defaults must be an object');
        if (void 0 !== n.retries && !e(n.retries))
          throw new t('retries must be a positive integer');
        if (
          void 0 !== n.retryDelay &&
          !e(n.retryDelay) &&
          'function' != typeof n.retryDelay
        )
          throw new t(
            'retryDelay must be a positive integer or a function returning a positive integer'
          );
        if (
          void 0 !== n.retryOn &&
          !Array.isArray(n.retryOn) &&
          'function' != typeof n.retryOn
        )
          throw new t('retryOn property expects an array or function');
        return (
          (n = Object.assign({ retries: 3, retryDelay: 1e3, retryOn: [] }, n)),
          function (o, i) {
            var s = n.retries,
              a = n.retryDelay,
              u = n.retryOn;
            if (i && void 0 !== i.retries) {
              if (!e(i.retries))
                throw new t('retries must be a positive integer');
              s = i.retries;
            }
            if (i && void 0 !== i.retryDelay) {
              if (!e(i.retryDelay) && 'function' != typeof i.retryDelay)
                throw new t(
                  'retryDelay must be a positive integer or a function returning a positive integer'
                );
              a = i.retryDelay;
            }
            if (i && i.retryOn) {
              if (!Array.isArray(i.retryOn) && 'function' != typeof i.retryOn)
                throw new t('retryOn property expects an array or function');
              u = i.retryOn;
            }
            return new Promise(function (e, t) {
              var n = function (n) {
                var a =
                  'undefined' != typeof Request && o instanceof Request
                    ? o.clone()
                    : o;
                r(a, i)
                  .then(function (r) {
                    if (Array.isArray(u) && -1 === u.indexOf(r.status)) e(r);
                    else if ('function' == typeof u)
                      try {
                        return Promise.resolve(u(n, null, r))
                          .then(function (t) {
                            t ? l(n, null, r) : e(r);
                          })
                          .catch(t);
                      } catch (e) {
                        t(e);
                      }
                    else n < s ? l(n, null, r) : e(r);
                  })
                  .catch(function (e) {
                    if ('function' == typeof u)
                      try {
                        Promise.resolve(u(n, e, null))
                          .then(function (r) {
                            r ? l(n, e, null) : t(e);
                          })
                          .catch(function (e) {
                            t(e);
                          });
                      } catch (e) {
                        t(e);
                      }
                    else n < s ? l(n, e, null) : t(e);
                  });
              };
              function l(e, t, r) {
                var o = 'function' == typeof a ? a(e, t, r) : a;
                setTimeout(function () {
                  n(++e);
                }, o);
              }
              n(0);
            });
          }
        );
      };
    });
  }),
  i.register('hMzWZ', function (e, r) {
    t(e.exports, 'openDB', () => o);
    var n = i('bKSuF');
    n = i('bKSuF');
    function o(
      e,
      t,
      { blocked: r, upgrade: o, blocking: i, terminated: s } = {}
    ) {
      const a = indexedDB.open(e, t),
        u = n.w(a);
      return (
        o &&
          a.addEventListener('upgradeneeded', (e) => {
            o(n.w(a.result), e.oldVersion, e.newVersion, n.w(a.transaction));
          }),
        r && a.addEventListener('blocked', () => r()),
        u
          .then((e) => {
            s && e.addEventListener('close', () => s()),
              i && e.addEventListener('versionchange', () => i());
          })
          .catch(() => {}),
        u
      );
    }
    const s = ['get', 'getKey', 'getAll', 'getAllKeys', 'count'],
      a = ['put', 'add', 'delete', 'clear'],
      u = new Map();
    function l(e, t) {
      if (!(e instanceof IDBDatabase) || t in e || 'string' != typeof t) return;
      if (u.get(t)) return u.get(t);
      const r = t.replace(/FromIndex$/, ''),
        n = t !== r,
        o = a.includes(r);
      if (
        !(r in (n ? IDBIndex : IDBObjectStore).prototype) ||
        (!o && !s.includes(r))
      )
        return;
      const i = async function (e, ...t) {
        const i = this.transaction(e, o ? 'readwrite' : 'readonly');
        let s = i.store;
        return (
          n && (s = s.index(t.shift())),
          (await Promise.all([s[r](...t), o && i.done]))[0]
        );
      };
      return u.set(t, i), i;
    }
    n.r((e) => ({
      ...e,
      get: (t, r, n) => l(t, r) || e.get(t, r, n),
      has: (t, r) => !!l(t, r) || e.has(t, r),
    }));
  }),
  i.register('bKSuF', function (e, r) {
    t(e.exports, 'w', () => p), t(e.exports, 'r', () => h);
    let n, o;
    const i = new WeakMap(),
      s = new WeakMap(),
      a = new WeakMap(),
      u = new WeakMap(),
      l = new WeakMap();
    let c = {
      get(e, t, r) {
        if (e instanceof IDBTransaction) {
          if ('done' === t) return s.get(e);
          if ('objectStoreNames' === t) return e.objectStoreNames || a.get(e);
          if ('store' === t)
            return r.objectStoreNames[1]
              ? void 0
              : r.objectStore(r.objectStoreNames[0]);
        }
        return p(e[t]);
      },
      set: (e, t, r) => ((e[t] = r), !0),
      has: (e, t) =>
        (e instanceof IDBTransaction && ('done' === t || 'store' === t)) ||
        t in e,
    };
    function h(e) {
      c = e(c);
    }
    function f(e) {
      return e !== IDBDatabase.prototype.transaction ||
        'objectStoreNames' in IDBTransaction.prototype
        ? (
            o ||
            (o = [
              IDBCursor.prototype.advance,
              IDBCursor.prototype.continue,
              IDBCursor.prototype.continuePrimaryKey,
            ])
          ).includes(e)
          ? function (...t) {
              return e.apply(g(this), t), p(i.get(this));
            }
          : function (...t) {
              return p(e.apply(g(this), t));
            }
        : function (t, ...r) {
            const n = e.call(g(this), t, ...r);
            return a.set(n, t.sort ? t.sort() : [t]), p(n);
          };
    }
    function d(e) {
      return 'function' == typeof e
        ? f(e)
        : (e instanceof IDBTransaction &&
            (function (e) {
              if (s.has(e)) return;
              const t = new Promise((t, r) => {
                const n = () => {
                    e.removeEventListener('complete', o),
                      e.removeEventListener('error', i),
                      e.removeEventListener('abort', i);
                  },
                  o = () => {
                    t(), n();
                  },
                  i = () => {
                    r(e.error || new DOMException('AbortError', 'AbortError')),
                      n();
                  };
                e.addEventListener('complete', o),
                  e.addEventListener('error', i),
                  e.addEventListener('abort', i);
              });
              s.set(e, t);
            })(e),
          (t = e),
          (
            n ||
            (n = [
              IDBDatabase,
              IDBObjectStore,
              IDBIndex,
              IDBCursor,
              IDBTransaction,
            ])
          ).some((e) => t instanceof e)
            ? new Proxy(e, c)
            : e);
      var t;
    }
    function p(e) {
      if (e instanceof IDBRequest)
        return (function (e) {
          const t = new Promise((t, r) => {
            const n = () => {
                e.removeEventListener('success', o),
                  e.removeEventListener('error', i);
              },
              o = () => {
                t(p(e.result)), n();
              },
              i = () => {
                r(e.error), n();
              };
            e.addEventListener('success', o), e.addEventListener('error', i);
          });
          return (
            t
              .then((t) => {
                t instanceof IDBCursor && i.set(t, e);
              })
              .catch(() => {}),
            l.set(t, e),
            t
          );
        })(e);
      if (u.has(e)) return u.get(e);
      const t = d(e);
      return t !== e && (u.set(e, t), l.set(t, e)), t;
    }
    const g = (e) => l.get(e);
  });
