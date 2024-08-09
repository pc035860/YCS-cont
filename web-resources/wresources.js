/* global htmlEntities */

(() => {
  const IS_DEBUG = /ycs_debug/.test(window.location.search);

  function e(e) {
    return e && e.__esModule ? e.default : e;
  }
  function stopXSS(str) {
    return htmlEntities.encode(str);
  }

  // Trusted Types feature testing
  if (window.trustedTypes && trustedTypes.createPolicy) {
    if (!trustedTypes.defaultPolicy) {
      // provide a default policy for trusted types
      trustedTypes.createPolicy('default', {
        // createHTML() gets called when assigning .innerHTML
        createHTML: (string) => string,
      });
    }
  }

  const FORMATTED_NUMBER_CONFIG_ENTRIES = Object.entries({
    k: 1000,
    rb: 1000,
    mil: 1000,
    'hilj.': 1000,
    'tis.': 1000,
    elfu: 1000,
    'þ.': 1000,
    'tūkst.': 1000,
    E: 1000,
    ming: 1000,
    mijë: 1000,
    N: 1000,
    B: 1000,
    'хил.': 1000,
    миң: 1000,
    мянга: 1000,
    'тыс.': 1000,
    'хиљ.': 1000,
    'тис.': 1000,
    'χιλ.': 1000,
    հզր: 1000,
    ද: 1000,
    พัน: 1000,
    ພັນ: 1000,
    ထောင်: 1000,
    'ათ.': 1000,
    ሺ: 1000,
    ពាន់: 1000,
    천: 1000,
    သောင်း: 10000,
    万: 10000,
    만: 10000,
    萬: 10000,
    m: 1000000,
  }).sort((a, b) => b[0].length - a[0].length);
  /**
   * From formatted number to raw number
   * @param {string} formattedNumber
   * @returns {number}
   */
  function parseFormattedNumber(formattedNumber) {
    const configEntries = FORMATTED_NUMBER_CONFIG_ENTRIES;
    let buf = formattedNumber.toLowerCase();
    let multiply = 1;

    for (const [key, value] of configEntries) {
      if (buf.includes(key)) {
        multiply = value;
        buf = buf.replace(key, '');
        break;
      }
    }

    let num;
    if (multiply === 1) {
      num = parseInt(buf.replace(/[,.]/g, ''));
    } else {
      num = parseFloat(buf.replace(/,/g, '')) * multiply;
    }
    return {
      number: num,
      multiply,
    };
  }

  /**
   * Get search filter options via checking button DOM class
   * @param {object} pool
   * @returns {object} {
   *   timestamp: boolean,
   *   author: boolean,
   *   heart: boolean,
   *   verified: boolean,
   *   links: boolean,
   *   likes: boolean,
   *   replied: boolean,
   *   members: boolean,
   *   donated: boolean,
   *   random: boolean
   * }
   */
  function getSearchOptions(pool) {
    const map = {
      elPTimeStamps: 'timestamp',
      elPAuthor: 'author',
      elPHeart: 'heart',
      elPVerified: 'verified',
      elPLinks: 'links',
      elPLikes: 'likes',
      elPReplied: 'replied',
      elPMembers: 'members',
      elPDonated: 'donated',
      elPRandom: 'random',
      elFirstComments: 'sortFirst',
    };
    const options = {};
    let hit = false;
    for (const key in pool) {
      if (pool[key].classList.contains('ycs_btn_active')) {
        options[map[key]] = true;
        hit = true;
      }
    }
    if (!hit) {
      return undefined;
    }
    return options;
  }

  var t =
      'undefined' != typeof globalThis
        ? globalThis
        : 'undefined' != typeof self
        ? self
        : 'undefined' != typeof window
        ? window
        : 'undefined' != typeof global
        ? global
        : {},
    n = {};
  Object.defineProperty(n, '__esModule', {
    value: !0,
  });
  var o = {};
  Object.defineProperty(o, '__esModule', {
    value: !0,
  });
  const r = new WeakMap(),
    i = new WeakMap();
  function a(e) {
    return r.get(e);
  }
  function s(e) {
    null == e.passiveListener
      ? e.event.cancelable &&
        ((e.canceled = !0),
        'function' == typeof e.event.preventDefault && e.event.preventDefault())
      : 'undefined' != typeof console && console.error;
  }
  function c(e, t) {
    r.set(this, {
      eventTarget: e,
      event: t,
      eventPhase: 2,
      currentTarget: e,
      canceled: !1,
      stopped: !1,
      immediateStopped: !1,
      passiveListener: null,
      timeStamp: t.timeStamp || Date.now(),
    }),
      Object.defineProperty(this, 'isTrusted', {
        value: !1,
        enumerable: !0,
      });
    const n = Object.keys(t);
    for (let e = 0; e < n.length; ++e) {
      const t = n[e];
      t in this || Object.defineProperty(this, t, l(t));
    }
  }
  function l(e) {
    return {
      get() {
        return a(this).event[e];
      },
      set(t) {
        a(this).event[e] = t;
      },
      configurable: !0,
      enumerable: !0,
    };
  }
  function d(e) {
    return {
      value() {
        const t = a(this).event;
        return t[e].apply(t, arguments);
      },
      configurable: !0,
      enumerable: !0,
    };
  }
  function u(e) {
    if (null == e || e === Object.prototype) return c;
    let t = i.get(e);
    return (
      null == t &&
        ((t = (function (e, t) {
          const n = Object.keys(t);
          if (0 === n.length) return e;
          function o(t, n) {
            e.call(this, t, n);
          }
          o.prototype = Object.create(e.prototype, {
            constructor: {
              value: o,
              configurable: !0,
              writable: !0,
            },
          });
          for (let r = 0; r < n.length; ++r) {
            const i = n[r];
            if (!(i in e.prototype)) {
              const e =
                'function' ==
                typeof Object.getOwnPropertyDescriptor(t, i).value;
              Object.defineProperty(o.prototype, i, e ? d(i) : l(i));
            }
          }
          return o;
        })(u(Object.getPrototypeOf(e)), e)),
        i.set(e, t)),
      t
    );
  }
  function h(e) {
    return a(e).immediateStopped;
  }
  function m(e, t) {
    a(e).passiveListener = t;
  }
  (c.prototype = {
    get type() {
      return a(this).event.type;
    },
    get target() {
      return a(this).eventTarget;
    },
    get currentTarget() {
      return a(this).currentTarget;
    },
    composedPath() {
      const e = a(this).currentTarget;
      return null == e ? [] : [e];
    },
    get NONE() {
      return 0;
    },
    get CAPTURING_PHASE() {
      return 1;
    },
    get AT_TARGET() {
      return 2;
    },
    get BUBBLING_PHASE() {
      return 3;
    },
    get eventPhase() {
      return a(this).eventPhase;
    },
    stopPropagation() {
      const e = a(this);
      (e.stopped = !0),
        'function' == typeof e.event.stopPropagation &&
          e.event.stopPropagation();
    },
    stopImmediatePropagation() {
      const e = a(this);
      (e.stopped = !0),
        (e.immediateStopped = !0),
        'function' == typeof e.event.stopImmediatePropagation &&
          e.event.stopImmediatePropagation();
    },
    get bubbles() {
      return Boolean(a(this).event.bubbles);
    },
    get cancelable() {
      return Boolean(a(this).event.cancelable);
    },
    preventDefault() {
      s(a(this));
    },
    get defaultPrevented() {
      return a(this).canceled;
    },
    get composed() {
      return Boolean(a(this).event.composed);
    },
    get timeStamp() {
      return a(this).timeStamp;
    },
    get srcElement() {
      return a(this).eventTarget;
    },
    get cancelBubble() {
      return a(this).stopped;
    },
    set cancelBubble(e) {
      if (!e) return;
      const t = a(this);
      (t.stopped = !0),
        'boolean' == typeof t.event.cancelBubble && (t.event.cancelBubble = !0);
    },
    get returnValue() {
      return !a(this).canceled;
    },
    set returnValue(e) {
      e || s(a(this));
    },
    initEvent() {},
  }),
    Object.defineProperty(c.prototype, 'constructor', {
      value: c,
      configurable: !0,
      writable: !0,
    }),
    'undefined' != typeof window &&
      void 0 !== window.Event &&
      (Object.setPrototypeOf(c.prototype, window.Event.prototype),
      i.set(window.Event.prototype, c));
  const p = new WeakMap();
  function f(e) {
    return null !== e && 'object' == typeof e;
  }
  function v(e) {
    const t = p.get(e);
    if (null == t)
      throw new TypeError(
        "'this' is expected an EventTarget object, but got another value."
      );
    return t;
  }
  function y(e, t) {
    Object.defineProperty(
      e,
      `on${t}`,
      (function (e) {
        return {
          get() {
            let t = v(this).get(e);
            for (; null != t; ) {
              if (3 === t.listenerType) return t.listener;
              t = t.next;
            }
            return null;
          },
          set(t) {
            'function' == typeof t || f(t) || (t = null);
            const n = v(this);
            let o = null,
              r = n.get(e);
            for (; null != r; )
              3 === r.listenerType
                ? null !== o
                  ? (o.next = r.next)
                  : null !== r.next
                  ? n.set(e, r.next)
                  : n.delete(e)
                : (o = r),
                (r = r.next);
            if (null !== t) {
              const r = {
                listener: t,
                listenerType: 3,
                passive: !1,
                once: !1,
                next: null,
              };
              null === o ? n.set(e, r) : (o.next = r);
            }
          },
          configurable: !0,
          enumerable: !0,
        };
      })(t)
    );
  }
  function g(e) {
    function t() {
      w.call(this);
    }
    t.prototype = Object.create(w.prototype, {
      constructor: {
        value: t,
        configurable: !0,
        writable: !0,
      },
    });
    for (let n = 0; n < e.length; ++n) y(t.prototype, e[n]);
    return t;
  }
  function w() {
    if (!(this instanceof w)) {
      if (1 === arguments.length && Array.isArray(arguments[0]))
        return g(arguments[0]);
      if (arguments.length > 0) {
        const e = new Array(arguments.length);
        for (let t = 0; t < arguments.length; ++t) e[t] = arguments[t];
        return g(e);
      }
      throw new TypeError('Cannot call a class as a function');
    }
    p.set(this, new Map());
  }
  (w.prototype = {
    addEventListener(e, t, n) {
      if (null == t) return;
      if ('function' != typeof t && !f(t))
        throw new TypeError("'listener' should be a function or an object.");
      const o = v(this),
        r = f(n),
        i = (r ? Boolean(n.capture) : Boolean(n)) ? 1 : 2,
        a = {
          listener: t,
          listenerType: i,
          passive: r && Boolean(n.passive),
          once: r && Boolean(n.once),
          next: null,
        };
      let s = o.get(e);
      if (void 0 === s) return void o.set(e, a);
      let c = null;
      for (; null != s; ) {
        if (s.listener === t && s.listenerType === i) return;
        (c = s), (s = s.next);
      }
      c.next = a;
    },
    removeEventListener(e, t, n) {
      if (null == t) return;
      const o = v(this),
        r = (f(n) ? Boolean(n.capture) : Boolean(n)) ? 1 : 2;
      let i = null,
        a = o.get(e);
      for (; null != a; ) {
        if (a.listener === t && a.listenerType === r)
          return void (null !== i
            ? (i.next = a.next)
            : null !== a.next
            ? o.set(e, a.next)
            : o.delete(e));
        (i = a), (a = a.next);
      }
    },
    dispatchEvent(e) {
      if (null == e || 'string' != typeof e.type)
        throw new TypeError('"event.type" should be a string.');
      const t = v(this),
        n = e.type;
      let o = t.get(n);
      if (null == o) return !0;
      const r = (function (e, t) {
        return new (u(Object.getPrototypeOf(t)))(e, t);
      })(this, e);
      let i = null;
      for (; null != o; ) {
        if (
          (o.once
            ? null !== i
              ? (i.next = o.next)
              : null !== o.next
              ? t.set(n, o.next)
              : t.delete(n)
            : (i = o),
          m(r, o.passive ? o.listener : null),
          'function' == typeof o.listener)
        )
          try {
            o.listener.call(this, r);
          } catch (e) {
            'undefined' != typeof console && console.error;
          }
        else
          3 !== o.listenerType &&
            'function' == typeof o.listener.handleEvent &&
            o.listener.handleEvent(r);
        if (h(r)) break;
        o = o.next;
      }
      return (
        m(r, null),
        (function (e, t) {
          a(e).eventPhase = t;
        })(r, 0),
        (function (e, t) {
          a(e).currentTarget = t;
        })(r, null),
        !r.defaultPrevented
      );
    },
  }),
    Object.defineProperty(w.prototype, 'constructor', {
      value: w,
      configurable: !0,
      writable: !0,
    }),
    'undefined' != typeof window &&
      void 0 !== window.EventTarget &&
      Object.setPrototypeOf(w.prototype, window.EventTarget.prototype),
    (o.defineEventAttribute = y),
    (o.EventTarget = w),
    (o.default = w),
    ((o = w).EventTarget = o.default = w),
    (o.defineEventAttribute = y);
  class b extends o.EventTarget {
    constructor() {
      throw (
        (super(), new TypeError('AbortSignal cannot be constructed directly'))
      );
    }
    get aborted() {
      const e = x.get(this);
      if ('boolean' != typeof e)
        throw new TypeError(
          "Expected 'this' to be an 'AbortSignal' object, but got " +
            (null === this ? 'null' : typeof this)
        );
      return e;
    }
  }
  o.defineEventAttribute(b.prototype, 'abort');
  const x = new WeakMap();
  Object.defineProperties(b.prototype, {
    aborted: {
      enumerable: !0,
    },
  }),
    'function' == typeof Symbol &&
      'symbol' == typeof Symbol.toStringTag &&
      Object.defineProperty(b.prototype, Symbol.toStringTag, {
        configurable: !0,
        value: 'AbortSignal',
      });
  class _ {
    constructor() {
      C.set(
        this,
        (function () {
          const e = Object.create(b.prototype);
          return o.EventTarget.call(e), x.set(e, !1), e;
        })()
      );
    }
    get signal() {
      return E(this);
    }
    abort() {
      var e;
      (e = E(this)),
        !1 === x.get(e) &&
          (x.set(e, !0),
          e.dispatchEvent({
            type: 'abort',
          }));
    }
  }
  const C = new WeakMap();
  function E(e) {
    const t = C.get(e);
    if (null == t)
      throw new TypeError(
        "Expected 'this' to be an 'AbortController' object, but got " +
          (null === e ? 'null' : typeof e)
      );
    return t;
  }
  Object.defineProperties(_.prototype, {
    signal: {
      enumerable: !0,
    },
    abort: {
      enumerable: !0,
    },
  }),
    'function' == typeof Symbol &&
      'symbol' == typeof Symbol.toStringTag &&
      Object.defineProperty(_.prototype, Symbol.toStringTag, {
        configurable: !0,
        value: 'AbortController',
      }),
    (n.AbortController = _),
    (n.AbortSignal = b),
    (n.default = _),
    ((n = _).AbortController = n.default = _),
    (n.AbortSignal = b);
  const T =
    'undefined' != typeof self
      ? self
      : 'undefined' != typeof window
      ? window
      : void 0 !== t
      ? t
      : void 0;
  T &&
    (void 0 === T.AbortController && (T.AbortController = n.AbortController),
    void 0 === T.AbortSignal && (T.AbortSignal = n.AbortSignal));
  var I = {};
  !(function (e, t) {
    'object' == typeof I
      ? (I = t())
      : 'function' == typeof define && define.amd
      ? define(t)
      : ((e = 'undefined' != typeof globalThis ? globalThis : e || self).Fuse =
          t());
  })(I, function () {
    'use strict';
    function e(e, t) {
      var n = Object.keys(e);
      if (Object.getOwnPropertySymbols) {
        var o = Object.getOwnPropertySymbols(e);
        t &&
          (o = o.filter(function (t) {
            return Object.getOwnPropertyDescriptor(e, t).enumerable;
          })),
          n.push.apply(n, o);
      }
      return n;
    }
    function t(t) {
      for (var n = 1; n < arguments.length; n++) {
        var o = null != arguments[n] ? arguments[n] : {};
        n % 2
          ? e(Object(o), !0).forEach(function (e) {
              a(t, e, o[e]);
            })
          : Object.getOwnPropertyDescriptors
          ? Object.defineProperties(t, Object.getOwnPropertyDescriptors(o))
          : e(Object(o)).forEach(function (e) {
              Object.defineProperty(
                t,
                e,
                Object.getOwnPropertyDescriptor(o, e)
              );
            });
      }
      return t;
    }
    function n(e) {
      return (n =
        'function' == typeof Symbol && 'symbol' == typeof Symbol.iterator
          ? function (e) {
              return typeof e;
            }
          : function (e) {
              return e &&
                'function' == typeof Symbol &&
                e.constructor === Symbol &&
                e !== Symbol.prototype
                ? 'symbol'
                : typeof e;
            })(e);
    }
    function o(e, t) {
      if (!(e instanceof t))
        throw new TypeError('Cannot call a class as a function');
    }
    function r(e, t) {
      for (var n = 0; n < t.length; n++) {
        var o = t[n];
        (o.enumerable = o.enumerable || !1),
          (o.configurable = !0),
          'value' in o && (o.writable = !0),
          Object.defineProperty(e, o.key, o);
      }
    }
    function i(e, t, n) {
      return (
        t && r(e.prototype, t),
        n && r(e, n),
        Object.defineProperty(e, 'prototype', {
          writable: !1,
        }),
        e
      );
    }
    function a(e, t, n) {
      return (
        t in e
          ? Object.defineProperty(e, t, {
              value: n,
              enumerable: !0,
              configurable: !0,
              writable: !0,
            })
          : (e[t] = n),
        e
      );
    }
    function s(e, t) {
      if ('function' != typeof t && null !== t)
        throw new TypeError(
          'Super expression must either be null or a function'
        );
      Object.defineProperty(e, 'prototype', {
        value: Object.create(t && t.prototype, {
          constructor: {
            value: e,
            writable: !0,
            configurable: !0,
          },
        }),
        writable: !1,
      }),
        t && l(e, t);
    }
    function c(e) {
      return (c = Object.setPrototypeOf
        ? Object.getPrototypeOf
        : function (e) {
            return e.__proto__ || Object.getPrototypeOf(e);
          })(e);
    }
    function l(e, t) {
      return (l =
        Object.setPrototypeOf ||
        function (e, t) {
          return (e.__proto__ = t), e;
        })(e, t);
    }
    function d(e, t) {
      if (t && ('object' == typeof t || 'function' == typeof t)) return t;
      if (void 0 !== t)
        throw new TypeError(
          'Derived constructors may only return object or undefined'
        );
      return (function (e) {
        if (void 0 === e)
          throw new ReferenceError(
            "this hasn't been initialised - super() hasn't been called"
          );
        return e;
      })(e);
    }
    function u(e) {
      var t = (function () {
        if ('undefined' == typeof Reflect || !Reflect.construct) return !1;
        if (Reflect.construct.sham) return !1;
        if ('function' == typeof Proxy) return !0;
        try {
          return (
            Boolean.prototype.valueOf.call(
              Reflect.construct(Boolean, [], function () {})
            ),
            !0
          );
        } catch (e) {
          return !1;
        }
      })();
      return function () {
        var n,
          o = c(e);
        if (t) {
          var r = c(this).constructor;
          n = Reflect.construct(o, arguments, r);
        } else n = o.apply(this, arguments);
        return d(this, n);
      };
    }
    function h(e) {
      return (
        (function (e) {
          if (Array.isArray(e)) return m(e);
        })(e) ||
        (function (e) {
          if (
            ('undefined' != typeof Symbol && null != e[Symbol.iterator]) ||
            null != e['@@iterator']
          )
            return Array.from(e);
        })(e) ||
        (function (e, t) {
          if (!e) return;
          if ('string' == typeof e) return m(e, t);
          var n = Object.prototype.toString.call(e).slice(8, -1);
          'Object' === n && e.constructor && (n = e.constructor.name);
          if ('Map' === n || 'Set' === n) return Array.from(e);
          if (
            'Arguments' === n ||
            /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(n)
          )
            return m(e, t);
        })(e) ||
        (function () {
          throw new TypeError(
            'Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.'
          );
        })()
      );
    }
    function m(e, t) {
      (null == t || t > e.length) && (t = e.length);
      for (var n = 0, o = new Array(t); n < t; n++) o[n] = e[n];
      return o;
    }
    function p(e) {
      return Array.isArray ? Array.isArray(e) : '[object Array]' === x(e);
    }
    function f(e) {
      return 'string' == typeof e;
    }
    function v(e) {
      return 'number' == typeof e;
    }
    function y(e) {
      return (
        !0 === e ||
        !1 === e ||
        ((function (e) {
          return g(e) && null !== e;
        })(e) &&
          '[object Boolean]' == x(e))
      );
    }
    function g(e) {
      return 'object' === n(e);
    }
    function w(e) {
      return null != e;
    }
    function b(e) {
      return !e.trim().length;
    }
    function x(e) {
      return null == e
        ? void 0 === e
          ? '[object Undefined]'
          : '[object Null]'
        : Object.prototype.toString.call(e);
    }
    var _ = function (e) {
        return 'Invalid value for key '.concat(e);
      },
      C = function (e) {
        return 'Pattern length exceeds max of '.concat(e, '.');
      },
      E = Object.prototype.hasOwnProperty,
      T = (function () {
        function e(t) {
          var n = this;
          o(this, e), (this._keys = []), (this._keyMap = {});
          var r = 0;
          t.forEach(function (e) {
            var t = I(e);
            (r += t.weight),
              n._keys.push(t),
              (n._keyMap[t.id] = t),
              (r += t.weight);
          }),
            this._keys.forEach(function (e) {
              e.weight /= r;
            });
        }
        return (
          i(e, [
            {
              key: 'get',
              value: function (e) {
                return this._keyMap[e];
              },
            },
            {
              key: 'keys',
              value: function () {
                return this._keys;
              },
            },
            {
              key: 'toJSON',
              value: function () {
                return JSON.stringify(this._keys);
              },
            },
          ]),
          e
        );
      })();
    function I(e) {
      var t = null,
        n = null,
        o = null,
        r = 1,
        i = null;
      if (f(e) || p(e)) (o = e), (t = k(e)), (n = R(e));
      else {
        if (!E.call(e, 'name'))
          throw new Error(
            (function (e) {
              return 'Missing '.concat(e, ' property in key');
            })('name')
          );
        var a = e.name;
        if (((o = a), E.call(e, 'weight') && (r = e.weight) <= 0))
          throw new Error(
            (function (e) {
              return "Property 'weight' in key '".concat(
                e,
                "' must be a positive integer"
              );
            })(a)
          );
        (t = k(a)), (n = R(a)), (i = e.getFn);
      }
      return {
        path: t,
        id: n,
        weight: r,
        src: o,
        getFn: i,
      };
    }
    function k(e) {
      return p(e) ? e : e.split('.');
    }
    function R(e) {
      return p(e) ? e.join('.') : e;
    }
    var M = {
        useExtendedSearch: !1,
        getFn: function (e, t) {
          var n = [],
            o = !1;
          return (
            (function e(t, r, i) {
              if (w(t))
                if (r[i]) {
                  var a = t[r[i]];
                  if (!w(a)) return;
                  if (i === r.length - 1 && (f(a) || v(a) || y(a)))
                    n.push(
                      (function (e) {
                        return null == e
                          ? ''
                          : (function (e) {
                              if ('string' == typeof e) return e;
                              var t = e + '';
                              return '0' == t && 1 / e == -1 / 0 ? '-0' : t;
                            })(e);
                      })(a)
                    );
                  else if (p(a)) {
                    o = !0;
                    for (var s = 0, c = a.length; s < c; s += 1)
                      e(a[s], r, i + 1);
                  } else r.length && e(a, r, i + 1);
                } else n.push(t);
            })(e, f(t) ? t.split('.') : t, 0),
            o ? n : n[0]
          );
        },
        ignoreLocation: !1,
        ignoreFieldNorm: !1,
        fieldNormWeight: 1,
      },
      A = t(
        t(
          t(
            t(
              {},
              {
                isCaseSensitive: !1,
                includeScore: !1,
                keys: [],
                shouldSort: !0,
                sortFn: function (e, t) {
                  return e.score === t.score
                    ? e.idx < t.idx
                      ? -1
                      : 1
                    : e.score < t.score
                    ? -1
                    : 1;
                },
              }
            ),
            {
              includeMatches: !1,
              findAllMatches: !1,
              minMatchCharLength: 1,
            }
          ),
          {
            location: 0,
            threshold: 0.6,
            distance: 100,
          }
        ),
        M
      ),
      S = /[^ ]+/g;
    function L() {
      var e =
          arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : 1,
        t = arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : 3,
        n = new Map(),
        o = Math.pow(10, t);
      return {
        get: function (t) {
          var r = t.match(S).length;
          if (n.has(r)) return n.get(r);
          var i = 1 / Math.pow(r, 0.5 * e),
            a = parseFloat(Math.round(i * o) / o);
          return n.set(r, a), a;
        },
        clear: function () {
          n.clear();
        },
      };
    }
    var B = (function () {
      function e() {
        var t =
            arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : {},
          n = t.getFn,
          r = void 0 === n ? A.getFn : n,
          i = t.fieldNormWeight,
          a = void 0 === i ? A.fieldNormWeight : i;
        o(this, e),
          (this.norm = L(a, 3)),
          (this.getFn = r),
          (this.isCreated = !1),
          this.setIndexRecords();
      }
      return (
        i(e, [
          {
            key: 'setSources',
            value: function () {
              var e =
                arguments.length > 0 && void 0 !== arguments[0]
                  ? arguments[0]
                  : [];
              this.docs = e;
            },
          },
          {
            key: 'setIndexRecords',
            value: function () {
              var e =
                arguments.length > 0 && void 0 !== arguments[0]
                  ? arguments[0]
                  : [];
              this.records = e;
            },
          },
          {
            key: 'setKeys',
            value: function () {
              var e = this,
                t =
                  arguments.length > 0 && void 0 !== arguments[0]
                    ? arguments[0]
                    : [];
              (this.keys = t),
                (this._keysMap = {}),
                t.forEach(function (t, n) {
                  e._keysMap[t.id] = n;
                });
            },
          },
          {
            key: 'create',
            value: function () {
              var e = this;
              !this.isCreated &&
                this.docs.length &&
                ((this.isCreated = !0),
                f(this.docs[0])
                  ? this.docs.forEach(function (t, n) {
                      e._addString(t, n);
                    })
                  : this.docs.forEach(function (t, n) {
                      e._addObject(t, n);
                    }),
                this.norm.clear());
            },
          },
          {
            key: 'add',
            value: function (e) {
              var t = this.size();
              f(e) ? this._addString(e, t) : this._addObject(e, t);
            },
          },
          {
            key: 'removeAt',
            value: function (e) {
              this.records.splice(e, 1);
              for (var t = e, n = this.size(); t < n; t += 1)
                this.records[t].i -= 1;
            },
          },
          {
            key: 'getValueForItemAtKeyId',
            value: function (e, t) {
              return e[this._keysMap[t]];
            },
          },
          {
            key: 'size',
            value: function () {
              return this.records.length;
            },
          },
          {
            key: '_addString',
            value: function (e, t) {
              if (w(e) && !b(e)) {
                var n = {
                  v: e,
                  i: t,
                  n: this.norm.get(e),
                };
                this.records.push(n);
              }
            },
          },
          {
            key: '_addObject',
            value: function (e, t) {
              var n = this,
                o = {
                  i: t,
                  $: {},
                };
              this.keys.forEach(function (t, r) {
                var i = t.getFn ? t.getFn(e) : n.getFn(e, t.path);
                if (w(i))
                  if (p(i))
                    !(function () {
                      for (
                        var e = [],
                          t = [
                            {
                              nestedArrIndex: -1,
                              value: i,
                            },
                          ];
                        t.length;

                      ) {
                        var a = t.pop(),
                          s = a.nestedArrIndex,
                          c = a.value;
                        if (w(c))
                          if (f(c) && !b(c)) {
                            var l = {
                              v: c,
                              i: s,
                              n: n.norm.get(c),
                            };
                            e.push(l);
                          } else
                            p(c) &&
                              c.forEach(function (e, n) {
                                t.push({
                                  nestedArrIndex: n,
                                  value: e,
                                });
                              });
                      }
                      o.$[r] = e;
                    })();
                  else if (f(i) && !b(i)) {
                    var a = {
                      v: i,
                      n: n.norm.get(i),
                    };
                    o.$[r] = a;
                  }
              }),
                this.records.push(o);
            },
          },
          {
            key: 'toJSON',
            value: function () {
              return {
                keys: this.keys,
                records: this.records,
              };
            },
          },
        ]),
        e
      );
    })();
    function O(e, t) {
      var n =
          arguments.length > 2 && void 0 !== arguments[2] ? arguments[2] : {},
        o = n.getFn,
        r = void 0 === o ? A.getFn : o,
        i = n.fieldNormWeight,
        a = void 0 === i ? A.fieldNormWeight : i,
        s = new B({
          getFn: r,
          fieldNormWeight: a,
        });
      return s.setKeys(e.map(I)), s.setSources(t), s.create(), s;
    }
    function z(e) {
      var t =
          arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : {},
        n = t.errors,
        o = void 0 === n ? 0 : n,
        r = t.currentLocation,
        i = void 0 === r ? 0 : r,
        a = t.expectedLocation,
        s = void 0 === a ? 0 : a,
        c = t.distance,
        l = void 0 === c ? A.distance : c,
        d = t.ignoreLocation,
        u = void 0 === d ? A.ignoreLocation : d,
        h = o / e.length;
      if (u) return h;
      var m = Math.abs(s - i);
      return l ? h + m / l : m ? 1 : h;
    }
    function N() {
      for (
        var e =
            arguments.length > 0 && void 0 !== arguments[0] ? arguments[0] : [],
          t =
            arguments.length > 1 && void 0 !== arguments[1]
              ? arguments[1]
              : A.minMatchCharLength,
          n = [],
          o = -1,
          r = -1,
          i = 0,
          a = e.length;
        i < a;
        i += 1
      ) {
        var s = e[i];
        s && -1 === o
          ? (o = i)
          : s ||
            -1 === o ||
            ((r = i - 1) - o + 1 >= t && n.push([o, r]), (o = -1));
      }
      return e[i - 1] && i - o >= t && n.push([o, i - 1]), n;
    }
    var $ = 32;
    function P(e) {
      for (var t = {}, n = 0, o = e.length; n < o; n += 1) {
        var r = e.charAt(n);
        t[r] = (t[r] || 0) | (1 << (o - n - 1));
      }
      return t;
    }
    var j = (function () {
        function e(t) {
          var n = this,
            r =
              arguments.length > 1 && void 0 !== arguments[1]
                ? arguments[1]
                : {},
            i = r.location,
            a = void 0 === i ? A.location : i,
            s = r.threshold,
            c = void 0 === s ? A.threshold : s,
            l = r.distance,
            d = void 0 === l ? A.distance : l,
            u = r.includeMatches,
            h = void 0 === u ? A.includeMatches : u,
            m = r.findAllMatches,
            p = void 0 === m ? A.findAllMatches : m,
            f = r.minMatchCharLength,
            v = void 0 === f ? A.minMatchCharLength : f,
            y = r.isCaseSensitive,
            g = void 0 === y ? A.isCaseSensitive : y,
            w = r.ignoreLocation,
            b = void 0 === w ? A.ignoreLocation : w;
          if (
            (o(this, e),
            (this.options = {
              location: a,
              threshold: c,
              distance: d,
              includeMatches: h,
              findAllMatches: p,
              minMatchCharLength: v,
              isCaseSensitive: g,
              ignoreLocation: b,
            }),
            (this.pattern = g ? t : t.toLowerCase()),
            (this.chunks = []),
            this.pattern.length)
          ) {
            var x = function (e, t) {
                n.chunks.push({
                  pattern: e,
                  alphabet: P(e),
                  startIndex: t,
                });
              },
              _ = this.pattern.length;
            if (_ > $) {
              for (var C = 0, E = _ % $, T = _ - E; C < T; )
                x(this.pattern.substr(C, $), C), (C += $);
              if (E) {
                var I = _ - $;
                x(this.pattern.substr(I), I);
              }
            } else x(this.pattern, 0);
          }
        }
        return (
          i(e, [
            {
              key: 'searchIn',
              value: function (e) {
                var t = this.options,
                  n = t.isCaseSensitive,
                  o = t.includeMatches;
                if ((n || (e = e.toLowerCase()), this.pattern === e)) {
                  var r = {
                    isMatch: !0,
                    score: 0,
                  };
                  return o && (r.indices = [[0, e.length - 1]]), r;
                }
                var i = this.options,
                  a = i.location,
                  s = i.distance,
                  c = i.threshold,
                  l = i.findAllMatches,
                  d = i.minMatchCharLength,
                  u = i.ignoreLocation,
                  m = [],
                  p = 0,
                  f = !1;
                this.chunks.forEach(function (t) {
                  var n = t.pattern,
                    r = t.alphabet,
                    i = t.startIndex,
                    v = (function (e, t, n) {
                      var o =
                          arguments.length > 3 && void 0 !== arguments[3]
                            ? arguments[3]
                            : {},
                        r = o.location,
                        i = void 0 === r ? A.location : r,
                        a = o.distance,
                        s = void 0 === a ? A.distance : a,
                        c = o.threshold,
                        l = void 0 === c ? A.threshold : c,
                        d = o.findAllMatches,
                        u = void 0 === d ? A.findAllMatches : d,
                        h = o.minMatchCharLength,
                        m = void 0 === h ? A.minMatchCharLength : h,
                        p = o.includeMatches,
                        f = void 0 === p ? A.includeMatches : p,
                        v = o.ignoreLocation,
                        y = void 0 === v ? A.ignoreLocation : v;
                      if (t.length > $) throw new Error(C($));
                      for (
                        var g,
                          w = t.length,
                          b = e.length,
                          x = Math.max(0, Math.min(i, b)),
                          _ = l,
                          E = x,
                          T = m > 1 || f,
                          I = T ? Array(b) : [];
                        (g = e.indexOf(t, E)) > -1;

                      ) {
                        var k = z(t, {
                          currentLocation: g,
                          expectedLocation: x,
                          distance: s,
                          ignoreLocation: y,
                        });
                        if (((_ = Math.min(k, _)), (E = g + w), T))
                          for (var R = 0; R < w; ) (I[g + R] = 1), (R += 1);
                      }
                      E = -1;
                      for (
                        var M = [], S = 1, L = w + b, B = 1 << (w - 1), O = 0;
                        O < w;
                        O += 1
                      ) {
                        for (var P = 0, j = L; P < j; ) {
                          z(t, {
                            errors: O,
                            currentLocation: x + j,
                            expectedLocation: x,
                            distance: s,
                            ignoreLocation: y,
                          }) <= _
                            ? (P = j)
                            : (L = j),
                            (j = Math.floor((L - P) / 2 + P));
                        }
                        L = j;
                        var F = Math.max(1, x - j + 1),
                          U = u ? b : Math.min(x + j, b) + w,
                          D = Array(U + 2);
                        D[U + 1] = (1 << O) - 1;
                        for (var V = U; V >= F; V -= 1) {
                          var H = V - 1,
                            G = n[e.charAt(H)];
                          if (
                            (T && (I[H] = +!!G),
                            (D[V] = ((D[V + 1] << 1) | 1) & G),
                            O &&
                              (D[V] |= ((M[V + 1] | M[V]) << 1) | 1 | M[V + 1]),
                            D[V] & B &&
                              (S = z(t, {
                                errors: O,
                                currentLocation: H,
                                expectedLocation: x,
                                distance: s,
                                ignoreLocation: y,
                              })) <= _)
                          ) {
                            if (((_ = S), (E = H) <= x)) break;
                            F = Math.max(1, 2 * x - E);
                          }
                        }
                        if (
                          z(t, {
                            errors: O + 1,
                            currentLocation: x,
                            expectedLocation: x,
                            distance: s,
                            ignoreLocation: y,
                          }) > _
                        )
                          break;
                        M = D;
                      }
                      var q = {
                        isMatch: E >= 0,
                        score: Math.max(0.001, S),
                      };
                      if (T) {
                        var W = N(I, m);
                        W.length ? f && (q.indices = W) : (q.isMatch = !1);
                      }
                      return q;
                    })(e, n, r, {
                      location: a + i,
                      distance: s,
                      threshold: c,
                      findAllMatches: l,
                      minMatchCharLength: d,
                      includeMatches: o,
                      ignoreLocation: u,
                    }),
                    y = v.isMatch,
                    g = v.score,
                    w = v.indices;
                  y && (f = !0),
                    (p += g),
                    y && w && (m = [].concat(h(m), h(w)));
                });
                var v = {
                  isMatch: f,
                  score: f ? p / this.chunks.length : 1,
                };
                return f && o && (v.indices = m), v;
              },
            },
          ]),
          e
        );
      })(),
      F = (function () {
        function e(t) {
          o(this, e), (this.pattern = t);
        }
        return (
          i(
            e,
            [
              {
                key: 'search',
                value: function () {},
              },
            ],
            [
              {
                key: 'isMultiMatch',
                value: function (e) {
                  return U(e, this.multiRegex);
                },
              },
              {
                key: 'isSingleMatch',
                value: function (e) {
                  return U(e, this.singleRegex);
                },
              },
            ]
          ),
          e
        );
      })();
    function U(e, t) {
      var n = e.match(t);
      return n ? n[1] : null;
    }
    var D = (function (e) {
        s(n, e);
        var t = u(n);
        function n(e) {
          return o(this, n), t.call(this, e);
        }
        return (
          i(
            n,
            [
              {
                key: 'search',
                value: function (e) {
                  var t = e === this.pattern;
                  return {
                    isMatch: t,
                    score: t ? 0 : 1,
                    indices: [0, this.pattern.length - 1],
                  };
                },
              },
            ],
            [
              {
                key: 'type',
                get: function () {
                  return 'exact';
                },
              },
              {
                key: 'multiRegex',
                get: function () {
                  return /^="(.*)"$/;
                },
              },
              {
                key: 'singleRegex',
                get: function () {
                  return /^=(.*)$/;
                },
              },
            ]
          ),
          n
        );
      })(F),
      V = (function (e) {
        s(n, e);
        var t = u(n);
        function n(e) {
          return o(this, n), t.call(this, e);
        }
        return (
          i(
            n,
            [
              {
                key: 'search',
                value: function (e) {
                  var t = -1 === e.indexOf(this.pattern);
                  return {
                    isMatch: t,
                    score: t ? 0 : 1,
                    indices: [0, e.length - 1],
                  };
                },
              },
            ],
            [
              {
                key: 'type',
                get: function () {
                  return 'inverse-exact';
                },
              },
              {
                key: 'multiRegex',
                get: function () {
                  return /^!"(.*)"$/;
                },
              },
              {
                key: 'singleRegex',
                get: function () {
                  return /^!(.*)$/;
                },
              },
            ]
          ),
          n
        );
      })(F),
      H = (function (e) {
        s(n, e);
        var t = u(n);
        function n(e) {
          return o(this, n), t.call(this, e);
        }
        return (
          i(
            n,
            [
              {
                key: 'search',
                value: function (e) {
                  var t = e.startsWith(this.pattern);
                  return {
                    isMatch: t,
                    score: t ? 0 : 1,
                    indices: [0, this.pattern.length - 1],
                  };
                },
              },
            ],
            [
              {
                key: 'type',
                get: function () {
                  return 'prefix-exact';
                },
              },
              {
                key: 'multiRegex',
                get: function () {
                  return /^\^"(.*)"$/;
                },
              },
              {
                key: 'singleRegex',
                get: function () {
                  return /^\^(.*)$/;
                },
              },
            ]
          ),
          n
        );
      })(F),
      G = (function (e) {
        s(n, e);
        var t = u(n);
        function n(e) {
          return o(this, n), t.call(this, e);
        }
        return (
          i(
            n,
            [
              {
                key: 'search',
                value: function (e) {
                  var t = !e.startsWith(this.pattern);
                  return {
                    isMatch: t,
                    score: t ? 0 : 1,
                    indices: [0, e.length - 1],
                  };
                },
              },
            ],
            [
              {
                key: 'type',
                get: function () {
                  return 'inverse-prefix-exact';
                },
              },
              {
                key: 'multiRegex',
                get: function () {
                  return /^!\^"(.*)"$/;
                },
              },
              {
                key: 'singleRegex',
                get: function () {
                  return /^!\^(.*)$/;
                },
              },
            ]
          ),
          n
        );
      })(F),
      q = (function (e) {
        s(n, e);
        var t = u(n);
        function n(e) {
          return o(this, n), t.call(this, e);
        }
        return (
          i(
            n,
            [
              {
                key: 'search',
                value: function (e) {
                  var t = e.endsWith(this.pattern);
                  return {
                    isMatch: t,
                    score: t ? 0 : 1,
                    indices: [e.length - this.pattern.length, e.length - 1],
                  };
                },
              },
            ],
            [
              {
                key: 'type',
                get: function () {
                  return 'suffix-exact';
                },
              },
              {
                key: 'multiRegex',
                get: function () {
                  return /^"(.*)"\$$/;
                },
              },
              {
                key: 'singleRegex',
                get: function () {
                  return /^(.*)\$$/;
                },
              },
            ]
          ),
          n
        );
      })(F),
      W = (function (e) {
        s(n, e);
        var t = u(n);
        function n(e) {
          return o(this, n), t.call(this, e);
        }
        return (
          i(
            n,
            [
              {
                key: 'search',
                value: function (e) {
                  var t = !e.endsWith(this.pattern);
                  return {
                    isMatch: t,
                    score: t ? 0 : 1,
                    indices: [0, e.length - 1],
                  };
                },
              },
            ],
            [
              {
                key: 'type',
                get: function () {
                  return 'inverse-suffix-exact';
                },
              },
              {
                key: 'multiRegex',
                get: function () {
                  return /^!"(.*)"\$$/;
                },
              },
              {
                key: 'singleRegex',
                get: function () {
                  return /^!(.*)\$$/;
                },
              },
            ]
          ),
          n
        );
      })(F),
      J = (function (e) {
        s(n, e);
        var t = u(n);
        function n(e) {
          var r,
            i =
              arguments.length > 1 && void 0 !== arguments[1]
                ? arguments[1]
                : {},
            a = i.location,
            s = void 0 === a ? A.location : a,
            c = i.threshold,
            l = void 0 === c ? A.threshold : c,
            d = i.distance,
            u = void 0 === d ? A.distance : d,
            h = i.includeMatches,
            m = void 0 === h ? A.includeMatches : h,
            p = i.findAllMatches,
            f = void 0 === p ? A.findAllMatches : p,
            v = i.minMatchCharLength,
            y = void 0 === v ? A.minMatchCharLength : v,
            g = i.isCaseSensitive,
            w = void 0 === g ? A.isCaseSensitive : g,
            b = i.ignoreLocation,
            x = void 0 === b ? A.ignoreLocation : b;
          return (
            o(this, n),
            ((r = t.call(this, e))._bitapSearch = new j(e, {
              location: s,
              threshold: l,
              distance: u,
              includeMatches: m,
              findAllMatches: f,
              minMatchCharLength: y,
              isCaseSensitive: w,
              ignoreLocation: x,
            })),
            r
          );
        }
        return (
          i(
            n,
            [
              {
                key: 'search',
                value: function (e) {
                  return this._bitapSearch.searchIn(e);
                },
              },
            ],
            [
              {
                key: 'type',
                get: function () {
                  return 'fuzzy';
                },
              },
              {
                key: 'multiRegex',
                get: function () {
                  return /^"(.*)"$/;
                },
              },
              {
                key: 'singleRegex',
                get: function () {
                  return /^(.*)$/;
                },
              },
            ]
          ),
          n
        );
      })(F),
      Y = (function (e) {
        s(n, e);
        var t = u(n);
        function n(e) {
          return o(this, n), t.call(this, e);
        }
        return (
          i(
            n,
            [
              {
                key: 'search',
                value: function (e) {
                  for (
                    var t, n = 0, o = [], r = this.pattern.length;
                    (t = e.indexOf(this.pattern, n)) > -1;

                  )
                    (n = t + r), o.push([t, n - 1]);
                  var i = !!o.length;
                  return {
                    isMatch: i,
                    score: i ? 0 : 1,
                    indices: o,
                  };
                },
              },
            ],
            [
              {
                key: 'type',
                get: function () {
                  return 'include';
                },
              },
              {
                key: 'multiRegex',
                get: function () {
                  return /^'"(.*)"$/;
                },
              },
              {
                key: 'singleRegex',
                get: function () {
                  return /^'(.*)$/;
                },
              },
            ]
          ),
          n
        );
      })(F),
      K = [D, Y, H, G, W, q, V, J],
      X = K.length,
      Q = / +(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/;
    function Z(e) {
      var t =
        arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : {};
      return e.split('|').map(function (e) {
        for (
          var n = e
              .trim()
              .split(Q)
              .filter(function (e) {
                return e && !!e.trim();
              }),
            o = [],
            r = 0,
            i = n.length;
          r < i;
          r += 1
        ) {
          for (var a = n[r], s = !1, c = -1; !s && ++c < X; ) {
            var l = K[c],
              d = l.isMultiMatch(a);
            d && (o.push(new l(d, t)), (s = !0));
          }
          if (!s)
            for (c = -1; ++c < X; ) {
              var u = K[c],
                h = u.isSingleMatch(a);
              if (h) {
                o.push(new u(h, t));
                break;
              }
            }
        }
        return o;
      });
    }
    var ee = new Set([J.type, Y.type]),
      te = (function () {
        function e(t) {
          var n =
              arguments.length > 1 && void 0 !== arguments[1]
                ? arguments[1]
                : {},
            r = n.isCaseSensitive,
            i = void 0 === r ? A.isCaseSensitive : r,
            a = n.includeMatches,
            s = void 0 === a ? A.includeMatches : a,
            c = n.minMatchCharLength,
            l = void 0 === c ? A.minMatchCharLength : c,
            d = n.ignoreLocation,
            u = void 0 === d ? A.ignoreLocation : d,
            h = n.findAllMatches,
            m = void 0 === h ? A.findAllMatches : h,
            p = n.location,
            f = void 0 === p ? A.location : p,
            v = n.threshold,
            y = void 0 === v ? A.threshold : v,
            g = n.distance,
            w = void 0 === g ? A.distance : g;
          o(this, e),
            (this.query = null),
            (this.options = {
              isCaseSensitive: i,
              includeMatches: s,
              minMatchCharLength: l,
              findAllMatches: m,
              ignoreLocation: u,
              location: f,
              threshold: y,
              distance: w,
            }),
            (this.pattern = i ? t : t.toLowerCase()),
            (this.query = Z(this.pattern, this.options));
        }
        return (
          i(
            e,
            [
              {
                key: 'searchIn',
                value: function (e) {
                  var t = this.query;
                  if (!t)
                    return {
                      isMatch: !1,
                      score: 1,
                    };
                  var n = this.options,
                    o = n.includeMatches;
                  e = n.isCaseSensitive ? e : e.toLowerCase();
                  for (
                    var r = 0, i = [], a = 0, s = 0, c = t.length;
                    s < c;
                    s += 1
                  ) {
                    var l = t[s];
                    (i.length = 0), (r = 0);
                    for (var d = 0, u = l.length; d < u; d += 1) {
                      var m = l[d],
                        p = m.search(e),
                        f = p.isMatch,
                        v = p.indices,
                        y = p.score;
                      if (!f) {
                        (a = 0), (r = 0), (i.length = 0);
                        break;
                      }
                      if (((r += 1), (a += y), o)) {
                        var g = m.constructor.type;
                        ee.has(g) ? (i = [].concat(h(i), h(v))) : i.push(v);
                      }
                    }
                    if (r) {
                      var w = {
                        isMatch: !0,
                        score: a / r,
                      };
                      return o && (w.indices = i), w;
                    }
                  }
                  return {
                    isMatch: !1,
                    score: 1,
                  };
                },
              },
            ],
            [
              {
                key: 'condition',
                value: function (e, t) {
                  return t.useExtendedSearch;
                },
              },
            ]
          ),
          e
        );
      })(),
      ne = [];
    function oe(e, t) {
      for (var n = 0, o = ne.length; n < o; n += 1) {
        var r = ne[n];
        if (r.condition(e, t)) return new r(e, t);
      }
      return new j(e, t);
    }
    var re = '$and',
      ie = '$or',
      ae = '$path',
      se = '$val',
      ce = function (e) {
        return !(!e[re] && !e[ie]);
      },
      le = function (e) {
        return !!e[ae];
      },
      de = function (e) {
        return !p(e) && g(e) && !ce(e);
      },
      ue = function (e) {
        return a(
          {},
          re,
          Object.keys(e).map(function (t) {
            return a({}, t, e[t]);
          })
        );
      };
    function he(e, t) {
      var n =
          arguments.length > 2 && void 0 !== arguments[2] ? arguments[2] : {},
        o = n.auto,
        r = void 0 === o || o,
        i = function e(n) {
          var o = Object.keys(n),
            i = le(n);
          if (!i && o.length > 1 && !ce(n)) return e(ue(n));
          if (de(n)) {
            var a = i ? n[ae] : o[0],
              s = i ? n[se] : n[a];
            if (!f(s)) throw new Error(_(a));
            var c = {
              keyId: R(a),
              pattern: s,
            };
            return r && (c.searcher = oe(s, t)), c;
          }
          var l = {
            children: [],
            operator: o[0],
          };
          return (
            o.forEach(function (t) {
              var o = n[t];
              p(o) &&
                o.forEach(function (t) {
                  l.children.push(e(t));
                });
            }),
            l
          );
        };
      return ce(e) || (e = ue(e)), i(e);
    }
    function me(e, t) {
      var n = t.ignoreFieldNorm,
        o = void 0 === n ? A.ignoreFieldNorm : n;
      e.forEach(function (e) {
        var t = 1;
        e.matches.forEach(function (e) {
          var n = e.key,
            r = e.norm,
            i = e.score,
            a = n ? n.weight : null;
          t *= Math.pow(
            0 === i && a ? Number.EPSILON : i,
            (a || 1) * (o ? 1 : r)
          );
        }),
          (e.score = t);
      });
    }
    function pe(e, t) {
      var n = e.matches;
      (t.matches = []),
        w(n) &&
          n.forEach(function (e) {
            if (w(e.indices) && e.indices.length) {
              var n = {
                indices: e.indices,
                value: e.value,
              };
              e.key && (n.key = e.key.src),
                e.idx > -1 && (n.refIndex = e.idx),
                t.matches.push(n);
            }
          });
    }
    function fe(e, t) {
      t.score = e.score;
    }
    function ve(e, t) {
      var n =
          arguments.length > 2 && void 0 !== arguments[2] ? arguments[2] : {},
        o = n.includeMatches,
        r = void 0 === o ? A.includeMatches : o,
        i = n.includeScore,
        a = void 0 === i ? A.includeScore : i,
        s = [];
      return (
        r && s.push(pe),
        a && s.push(fe),
        e.map(function (e) {
          var n = e.idx,
            o = {
              item: t[n],
              refIndex: n,
            };
          return (
            s.length &&
              s.forEach(function (t) {
                t(e, o);
              }),
            o
          );
        })
      );
    }
    var ye = (function () {
      function e(n) {
        var r =
            arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : {},
          i = arguments.length > 2 ? arguments[2] : void 0;
        o(this, e),
          (this.options = t(t({}, A), r)),
          this.options.useExtendedSearch,
          (this._keyStore = new T(this.options.keys)),
          this.setCollection(n, i);
      }
      return (
        i(e, [
          {
            key: 'setCollection',
            value: function (e, t) {
              if (((this._docs = e), t && !(t instanceof B)))
                throw new Error("Incorrect 'index' type");
              this._myIndex =
                t ||
                O(this.options.keys, this._docs, {
                  getFn: this.options.getFn,
                  fieldNormWeight: this.options.fieldNormWeight,
                });
            },
          },
          {
            key: 'add',
            value: function (e) {
              w(e) && (this._docs.push(e), this._myIndex.add(e));
            },
          },
          {
            key: 'remove',
            value: function () {
              for (
                var e =
                    arguments.length > 0 && void 0 !== arguments[0]
                      ? arguments[0]
                      : function () {
                          return !1;
                        },
                  t = [],
                  n = 0,
                  o = this._docs.length;
                n < o;
                n += 1
              ) {
                var r = this._docs[n];
                e(r, n) && (this.removeAt(n), (n -= 1), (o -= 1), t.push(r));
              }
              return t;
            },
          },
          {
            key: 'removeAt',
            value: function (e) {
              this._docs.splice(e, 1), this._myIndex.removeAt(e);
            },
          },
          {
            key: 'getIndex',
            value: function () {
              return this._myIndex;
            },
          },
          {
            key: 'search',
            value: function (e) {
              var t =
                  arguments.length > 1 && void 0 !== arguments[1]
                    ? arguments[1]
                    : {},
                n = t.limit,
                o = void 0 === n ? -1 : n,
                r = this.options,
                i = r.includeMatches,
                a = r.includeScore,
                s = r.shouldSort,
                c = r.sortFn,
                l = r.ignoreFieldNorm,
                d = f(e)
                  ? f(this._docs[0])
                    ? this._searchStringList(e)
                    : this._searchObjectList(e)
                  : this._searchLogical(e);
              return (
                me(d, {
                  ignoreFieldNorm: l,
                }),
                s && d.sort(c),
                v(o) && o > -1 && (d = d.slice(0, o)),
                ve(d, this._docs, {
                  includeMatches: i,
                  includeScore: a,
                })
              );
            },
          },
          {
            key: '_searchStringList',
            value: function (e) {
              var t = oe(e, this.options),
                n = this._myIndex.records,
                o = [];
              return (
                n.forEach(function (e) {
                  var n = e.v,
                    r = e.i,
                    i = e.n;
                  if (w(n)) {
                    var a = t.searchIn(n),
                      s = a.isMatch,
                      c = a.score,
                      l = a.indices;
                    s &&
                      o.push({
                        item: n,
                        idx: r,
                        matches: [
                          {
                            score: c,
                            value: n,
                            norm: i,
                            indices: l,
                          },
                        ],
                      });
                  }
                }),
                o
              );
            },
          },
          {
            key: '_searchLogical',
            value: function (e) {
              var t = this,
                n = he(e, this.options),
                o = function e(n, o, r) {
                  if (!n.children) {
                    var i = n.keyId,
                      a = n.searcher,
                      s = t._findMatches({
                        key: t._keyStore.get(i),
                        value: t._myIndex.getValueForItemAtKeyId(o, i),
                        searcher: a,
                      });
                    return s && s.length
                      ? [
                          {
                            idx: r,
                            item: o,
                            matches: s,
                          },
                        ]
                      : [];
                  }
                  for (
                    var c = [], l = 0, d = n.children.length;
                    l < d;
                    l += 1
                  ) {
                    var u = e(n.children[l], o, r);
                    if (u.length) c.push.apply(c, h(u));
                    else if (n.operator === re) return [];
                  }
                  return c;
                },
                r = this._myIndex.records,
                i = {},
                a = [];
              return (
                r.forEach(function (e) {
                  var t = e.$,
                    r = e.i;
                  if (w(t)) {
                    var s = o(n, t, r);
                    s.length &&
                      (i[r] ||
                        ((i[r] = {
                          idx: r,
                          item: t,
                          matches: [],
                        }),
                        a.push(i[r])),
                      s.forEach(function (e) {
                        var t,
                          n = e.matches;
                        (t = i[r].matches).push.apply(t, h(n));
                      }));
                  }
                }),
                a
              );
            },
          },
          {
            key: '_searchObjectList',
            value: function (e) {
              var t = this,
                n = oe(e, this.options),
                o = this._myIndex,
                r = o.keys,
                i = o.records,
                a = [];
              return (
                i.forEach(function (e) {
                  var o = e.$,
                    i = e.i;
                  if (w(o)) {
                    var s = [];
                    r.forEach(function (e, r) {
                      s.push.apply(
                        s,
                        h(
                          t._findMatches({
                            key: e,
                            value: o[r],
                            searcher: n,
                          })
                        )
                      );
                    }),
                      s.length &&
                        a.push({
                          idx: i,
                          item: o,
                          matches: s,
                        });
                  }
                }),
                a
              );
            },
          },
          {
            key: '_findMatches',
            value: function (e) {
              var t = e.key,
                n = e.value,
                o = e.searcher;
              if (!w(n)) return [];
              var r = [];
              if (p(n))
                n.forEach(function (e) {
                  var n = e.v,
                    i = e.i,
                    a = e.n;
                  if (w(n)) {
                    var s = o.searchIn(n),
                      c = s.isMatch,
                      l = s.score,
                      d = s.indices;
                    c &&
                      r.push({
                        score: l,
                        key: t,
                        value: n,
                        idx: i,
                        norm: a,
                        indices: d,
                      });
                  }
                });
              else {
                var i = n.v,
                  a = n.n,
                  s = o.searchIn(i),
                  c = s.isMatch,
                  l = s.score,
                  d = s.indices;
                c &&
                  r.push({
                    score: l,
                    key: t,
                    value: i,
                    norm: a,
                    indices: d,
                  });
              }
              return r;
            },
          },
        ]),
        e
      );
    })();
    return (
      (ye.version = '6.6.2'),
      (ye.createIndex = O),
      (ye.parseIndex = function (e) {
        var t =
            arguments.length > 1 && void 0 !== arguments[1] ? arguments[1] : {},
          n = t.getFn,
          o = void 0 === n ? A.getFn : n,
          r = t.fieldNormWeight,
          i = void 0 === r ? A.fieldNormWeight : r,
          a = e.keys,
          s = e.records,
          c = new B({
            getFn: o,
            fieldNormWeight: i,
          });
        return c.setKeys(a), c.setIndexRecords(s), c;
      }),
      (ye.config = A),
      (ye.parseQuery = he),
      (function () {
        ne.push.apply(ne, arguments);
      })(te),
      ye
    );
  });
  var k = {};
  !(function (e, t) {
    'object' == typeof k
      ? (k = t())
      : 'function' == typeof define && define.amd
      ? define(t)
      : (e.Mark = t());
  })(k, function () {
    'use strict';
    var e =
        'function' == typeof Symbol && 'symbol' == typeof Symbol.iterator
          ? function (e) {
              return typeof e;
            }
          : function (e) {
              return e &&
                'function' == typeof Symbol &&
                e.constructor === Symbol &&
                e !== Symbol.prototype
                ? 'symbol'
                : typeof e;
            },
      t = function (e, t) {
        if (!(e instanceof t))
          throw new TypeError('Cannot call a class as a function');
      },
      n = (function () {
        function e(e, t) {
          for (var n = 0; n < t.length; n++) {
            var o = t[n];
            (o.enumerable = o.enumerable || !1),
              (o.configurable = !0),
              'value' in o && (o.writable = !0),
              Object.defineProperty(e, o.key, o);
          }
        }
        return function (t, n, o) {
          return n && e(t.prototype, n), o && e(t, o), t;
        };
      })(),
      o =
        Object.assign ||
        function (e) {
          for (var t = 1; t < arguments.length; t++) {
            var n = arguments[t];
            for (var o in n)
              Object.prototype.hasOwnProperty.call(n, o) && (e[o] = n[o]);
          }
          return e;
        },
      r = (function () {
        function e(n) {
          var o =
              !(arguments.length > 1 && void 0 !== arguments[1]) ||
              arguments[1],
            r =
              arguments.length > 2 && void 0 !== arguments[2]
                ? arguments[2]
                : [],
            i =
              arguments.length > 3 && void 0 !== arguments[3]
                ? arguments[3]
                : 5e3;
          t(this, e),
            (this.ctx = n),
            (this.iframes = o),
            (this.exclude = r),
            (this.iframesTimeout = i);
        }
        return (
          n(
            e,
            [
              {
                key: 'getContexts',
                value: function () {
                  var e = [];
                  return (
                    (void 0 !== this.ctx && this.ctx
                      ? NodeList.prototype.isPrototypeOf(this.ctx)
                        ? Array.prototype.slice.call(this.ctx)
                        : Array.isArray(this.ctx)
                        ? this.ctx
                        : 'string' == typeof this.ctx
                        ? Array.prototype.slice.call(
                            document.querySelectorAll(this.ctx)
                          )
                        : [this.ctx]
                      : []
                    ).forEach(function (t) {
                      var n =
                        e.filter(function (e) {
                          return e.contains(t);
                        }).length > 0;
                      -1 !== e.indexOf(t) || n || e.push(t);
                    }),
                    e
                  );
                },
              },
              {
                key: 'getIframeContents',
                value: function (e, t) {
                  var n =
                      arguments.length > 2 && void 0 !== arguments[2]
                        ? arguments[2]
                        : function () {},
                    o = void 0;
                  try {
                    var r = e.contentWindow;
                    if (((o = r.document), !r || !o))
                      throw new Error('iframe inaccessible');
                  } catch (e) {
                    n();
                  }
                  o && t(o);
                },
              },
              {
                key: 'isIframeBlank',
                value: function (e) {
                  var t = 'about:blank',
                    n = e.getAttribute('src').trim();
                  return e.contentWindow.location.href === t && n !== t && n;
                },
              },
              {
                key: 'observeIframeLoad',
                value: function (e, t, n) {
                  var o = this,
                    r = !1,
                    i = null,
                    a = function a() {
                      if (!r) {
                        (r = !0), clearTimeout(i);
                        try {
                          o.isIframeBlank(e) ||
                            (e.removeEventListener('load', a),
                            o.getIframeContents(e, t, n));
                        } catch (e) {
                          n();
                        }
                      }
                    };
                  e.addEventListener('load', a),
                    (i = setTimeout(a, this.iframesTimeout));
                },
              },
              {
                key: 'onIframeReady',
                value: function (e, t, n) {
                  try {
                    'complete' === e.contentWindow.document.readyState
                      ? this.isIframeBlank(e)
                        ? this.observeIframeLoad(e, t, n)
                        : this.getIframeContents(e, t, n)
                      : this.observeIframeLoad(e, t, n);
                  } catch (e) {
                    n();
                  }
                },
              },
              {
                key: 'waitForIframes',
                value: function (e, t) {
                  var n = this,
                    o = 0;
                  this.forEachIframe(
                    e,
                    function () {
                      return !0;
                    },
                    function (e) {
                      o++,
                        n.waitForIframes(e.querySelector('html'), function () {
                          --o || t();
                        });
                    },
                    function (e) {
                      e || t();
                    }
                  );
                },
              },
              {
                key: 'forEachIframe',
                value: function (t, n, o) {
                  var r = this,
                    i =
                      arguments.length > 3 && void 0 !== arguments[3]
                        ? arguments[3]
                        : function () {},
                    a = t.querySelectorAll('iframe'),
                    s = a.length,
                    c = 0;
                  a = Array.prototype.slice.call(a);
                  var l = function () {
                    --s <= 0 && i(c);
                  };
                  s || l(),
                    a.forEach(function (t) {
                      e.matches(t, r.exclude)
                        ? l()
                        : r.onIframeReady(
                            t,
                            function (e) {
                              n(t) && (c++, o(e)), l();
                            },
                            l
                          );
                    });
                },
              },
              {
                key: 'createIterator',
                value: function (e, t, n) {
                  return document.createNodeIterator(e, t, n, !1);
                },
              },
              {
                key: 'createInstanceOnIframe',
                value: function (t) {
                  return new e(t.querySelector('html'), this.iframes);
                },
              },
              {
                key: 'compareNodeIframe',
                value: function (e, t, n) {
                  if (
                    e.compareDocumentPosition(n) &
                    Node.DOCUMENT_POSITION_PRECEDING
                  ) {
                    if (null === t) return !0;
                    if (
                      t.compareDocumentPosition(n) &
                      Node.DOCUMENT_POSITION_FOLLOWING
                    )
                      return !0;
                  }
                  return !1;
                },
              },
              {
                key: 'getIteratorNode',
                value: function (e) {
                  var t = e.previousNode();
                  return {
                    prevNode: t,
                    node: (null === t || e.nextNode()) && e.nextNode(),
                  };
                },
              },
              {
                key: 'checkIframeFilter',
                value: function (e, t, n, o) {
                  var r = !1,
                    i = !1;
                  return (
                    o.forEach(function (e, t) {
                      e.val === n && ((r = t), (i = e.handled));
                    }),
                    this.compareNodeIframe(e, t, n)
                      ? (!1 !== r || i
                          ? !1 === r || i || (o[r].handled = !0)
                          : o.push({
                              val: n,
                              handled: !0,
                            }),
                        !0)
                      : (!1 === r &&
                          o.push({
                            val: n,
                            handled: !1,
                          }),
                        !1)
                  );
                },
              },
              {
                key: 'handleOpenIframes',
                value: function (e, t, n, o) {
                  var r = this;
                  e.forEach(function (e) {
                    e.handled ||
                      r.getIframeContents(e.val, function (e) {
                        r.createInstanceOnIframe(e).forEachNode(t, n, o);
                      });
                  });
                },
              },
              {
                key: 'iterateThroughNodes',
                value: function (e, t, n, o, r) {
                  for (
                    var i,
                      a = this,
                      s = this.createIterator(t, e, o),
                      c = [],
                      l = [],
                      d = void 0,
                      u = void 0;
                    (i = void 0),
                      (i = a.getIteratorNode(s)),
                      (u = i.prevNode),
                      (d = i.node);

                  )
                    this.iframes &&
                      this.forEachIframe(
                        t,
                        function (e) {
                          return a.checkIframeFilter(d, u, e, c);
                        },
                        function (t) {
                          a.createInstanceOnIframe(t).forEachNode(
                            e,
                            function (e) {
                              return l.push(e);
                            },
                            o
                          );
                        }
                      ),
                      l.push(d);
                  l.forEach(function (e) {
                    n(e);
                  }),
                    this.iframes && this.handleOpenIframes(c, e, n, o),
                    r();
                },
              },
              {
                key: 'forEachNode',
                value: function (e, t, n) {
                  var o = this,
                    r =
                      arguments.length > 3 && void 0 !== arguments[3]
                        ? arguments[3]
                        : function () {},
                    i = this.getContexts(),
                    a = i.length;
                  a || r(),
                    i.forEach(function (i) {
                      var s = function () {
                        o.iterateThroughNodes(e, i, t, n, function () {
                          --a <= 0 && r();
                        });
                      };
                      o.iframes ? o.waitForIframes(i, s) : s();
                    });
                },
              },
            ],
            [
              {
                key: 'matches',
                value: function (e, t) {
                  var n = 'string' == typeof t ? [t] : t,
                    o =
                      e.matches ||
                      e.matchesSelector ||
                      e.msMatchesSelector ||
                      e.mozMatchesSelector ||
                      e.oMatchesSelector ||
                      e.webkitMatchesSelector;
                  if (o) {
                    var r = !1;
                    return (
                      n.every(function (t) {
                        return !o.call(e, t) || ((r = !0), !1);
                      }),
                      r
                    );
                  }
                  return !1;
                },
              },
            ]
          ),
          e
        );
      })(),
      i = (function () {
        function i(e) {
          t(this, i), (this.ctx = e), (this.ie = !1);
          var n = window.navigator.userAgent;
          (n.indexOf('MSIE') > -1 || n.indexOf('Trident') > -1) &&
            (this.ie = !0);
        }
        return (
          n(i, [
            {
              key: 'log',
              value: function (t) {
                var n =
                    arguments.length > 1 && void 0 !== arguments[1]
                      ? arguments[1]
                      : 'debug',
                  o = this.opt.log;
                this.opt.debug &&
                  'object' === (void 0 === o ? 'undefined' : e(o)) &&
                  'function' == typeof o[n] &&
                  o[n]('mark.js: ' + t);
              },
            },
            {
              key: 'escapeStr',
              value: function (e) {
                return e.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, '\\$&');
              },
            },
            {
              key: 'createRegExp',
              value: function (e) {
                return (
                  'disabled' !== this.opt.wildcards &&
                    (e = this.setupWildcardsRegExp(e)),
                  (e = this.escapeStr(e)),
                  Object.keys(this.opt.synonyms).length &&
                    (e = this.createSynonymsRegExp(e)),
                  (this.opt.ignoreJoiners ||
                    this.opt.ignorePunctuation.length) &&
                    (e = this.setupIgnoreJoinersRegExp(e)),
                  this.opt.diacritics && (e = this.createDiacriticsRegExp(e)),
                  (e = this.createMergedBlanksRegExp(e)),
                  (this.opt.ignoreJoiners ||
                    this.opt.ignorePunctuation.length) &&
                    (e = this.createJoinersRegExp(e)),
                  'disabled' !== this.opt.wildcards &&
                    (e = this.createWildcardsRegExp(e)),
                  (e = this.createAccuracyRegExp(e))
                );
              },
            },
            {
              key: 'createSynonymsRegExp',
              value: function (e) {
                var t = this.opt.synonyms,
                  n = this.opt.caseSensitive ? '' : 'i',
                  o =
                    this.opt.ignoreJoiners || this.opt.ignorePunctuation.length
                      ? '\0'
                      : '';
                for (var r in t)
                  if (t.hasOwnProperty(r)) {
                    var i = t[r],
                      a =
                        'disabled' !== this.opt.wildcards
                          ? this.setupWildcardsRegExp(r)
                          : this.escapeStr(r),
                      s =
                        'disabled' !== this.opt.wildcards
                          ? this.setupWildcardsRegExp(i)
                          : this.escapeStr(i);
                    '' !== a &&
                      '' !== s &&
                      (e = e.replace(
                        new RegExp(
                          '(' +
                            this.escapeStr(a) +
                            '|' +
                            this.escapeStr(s) +
                            ')',
                          'gm' + n
                        ),
                        o +
                          '(' +
                          this.processSynomyms(a) +
                          '|' +
                          this.processSynomyms(s) +
                          ')' +
                          o
                      ));
                  }
                return e;
              },
            },
            {
              key: 'processSynomyms',
              value: function (e) {
                return (
                  (this.opt.ignoreJoiners ||
                    this.opt.ignorePunctuation.length) &&
                    (e = this.setupIgnoreJoinersRegExp(e)),
                  e
                );
              },
            },
            {
              key: 'setupWildcardsRegExp',
              value: function (e) {
                return (e = e.replace(/(?:\\)*\?/g, function (e) {
                  return '\\' === e.charAt(0) ? '?' : '';
                })).replace(/(?:\\)*\*/g, function (e) {
                  return '\\' === e.charAt(0) ? '*' : '';
                });
              },
            },
            {
              key: 'createWildcardsRegExp',
              value: function (e) {
                var t = 'withSpaces' === this.opt.wildcards;
                return e
                  .replace(/\u0001/g, t ? '[\\S\\s]?' : '\\S?')
                  .replace(/\u0002/g, t ? '[\\S\\s]*?' : '\\S*');
              },
            },
            {
              key: 'setupIgnoreJoinersRegExp',
              value: function (e) {
                return e.replace(/[^(|)\\]/g, function (e, t, n) {
                  var o = n.charAt(t + 1);
                  return /[(|)\\]/.test(o) || '' === o ? e : e + '\0';
                });
              },
            },
            {
              key: 'createJoinersRegExp',
              value: function (e) {
                var t = [],
                  n = this.opt.ignorePunctuation;
                return (
                  Array.isArray(n) &&
                    n.length &&
                    t.push(this.escapeStr(n.join(''))),
                  this.opt.ignoreJoiners &&
                    t.push('\\u00ad\\u200b\\u200c\\u200d'),
                  t.length
                    ? e.split(/\u0000+/).join('[' + t.join('') + ']*')
                    : e
                );
              },
            },
            {
              key: 'createDiacriticsRegExp',
              value: function (e) {
                var t = this.opt.caseSensitive ? '' : 'i',
                  n = this.opt.caseSensitive
                    ? [
                        'aàáảãạăằắẳẵặâầấẩẫậäåāą',
                        'AÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬÄÅĀĄ',
                        'cçćč',
                        'CÇĆČ',
                        'dđď',
                        'DĐĎ',
                        'eèéẻẽẹêềếểễệëěēę',
                        'EÈÉẺẼẸÊỀẾỂỄỆËĚĒĘ',
                        'iìíỉĩịîïī',
                        'IÌÍỈĨỊÎÏĪ',
                        'lł',
                        'LŁ',
                        'nñňń',
                        'NÑŇŃ',
                        'oòóỏõọôồốổỗộơởỡớờợöøō',
                        'OÒÓỎÕỌÔỒỐỔỖỘƠỞỠỚỜỢÖØŌ',
                        'rř',
                        'RŘ',
                        'sšśșş',
                        'SŠŚȘŞ',
                        'tťțţ',
                        'TŤȚŢ',
                        'uùúủũụưừứửữựûüůū',
                        'UÙÚỦŨỤƯỪỨỬỮỰÛÜŮŪ',
                        'yýỳỷỹỵÿ',
                        'YÝỲỶỸỴŸ',
                        'zžżź',
                        'ZŽŻŹ',
                      ]
                    : [
                        'aàáảãạăằắẳẵặâầấẩẫậäåāąAÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬÄÅĀĄ',
                        'cçćčCÇĆČ',
                        'dđďDĐĎ',
                        'eèéẻẽẹêềếểễệëěēęEÈÉẺẼẸÊỀẾỂỄỆËĚĒĘ',
                        'iìíỉĩịîïīIÌÍỈĨỊÎÏĪ',
                        'lłLŁ',
                        'nñňńNÑŇŃ',
                        'oòóỏõọôồốổỗộơởỡớờợöøōOÒÓỎÕỌÔỒỐỔỖỘƠỞỠỚỜỢÖØŌ',
                        'rřRŘ',
                        'sšśșşSŠŚȘŞ',
                        'tťțţTŤȚŢ',
                        'uùúủũụưừứửữựûüůūUÙÚỦŨỤƯỪỨỬỮỰÛÜŮŪ',
                        'yýỳỷỹỵÿYÝỲỶỸỴŸ',
                        'zžżźZŽŻŹ',
                      ],
                  o = [];
                return (
                  e.split('').forEach(function (r) {
                    n.every(function (n) {
                      if (-1 !== n.indexOf(r)) {
                        if (o.indexOf(n) > -1) return !1;
                        (e = e.replace(
                          new RegExp('[' + n + ']', 'gm' + t),
                          '[' + n + ']'
                        )),
                          o.push(n);
                      }
                      return !0;
                    });
                  }),
                  e
                );
              },
            },
            {
              key: 'createMergedBlanksRegExp',
              value: function (e) {
                return e.replace(/[\s]+/gim, '[\\s]+');
              },
            },
            {
              key: 'createAccuracyRegExp',
              value: function (e) {
                var t = this,
                  n = this.opt.accuracy,
                  o = 'string' == typeof n ? n : n.value,
                  r = 'string' == typeof n ? [] : n.limiters,
                  i = '';
                switch (
                  (r.forEach(function (e) {
                    i += '|' + t.escapeStr(e);
                  }),
                  o)
                ) {
                  case 'partially':
                  default:
                    return '()(' + e + ')';
                  case 'complementary':
                    return (
                      '()([^' +
                      (i =
                        '\\s' +
                        (i ||
                          this.escapeStr(
                            '!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~¡¿'
                          ))) +
                      ']*' +
                      e +
                      '[^' +
                      i +
                      ']*)'
                    );
                  case 'exactly':
                    return '(^|\\s' + i + ')(' + e + ')(?=$|\\s' + i + ')';
                }
              },
            },
            {
              key: 'getSeparatedKeywords',
              value: function (e) {
                var t = this,
                  n = [];
                return (
                  e.forEach(function (e) {
                    t.opt.separateWordSearch
                      ? e.split(' ').forEach(function (e) {
                          e.trim() && -1 === n.indexOf(e) && n.push(e);
                        })
                      : e.trim() && -1 === n.indexOf(e) && n.push(e);
                  }),
                  {
                    keywords: n.sort(function (e, t) {
                      return t.length - e.length;
                    }),
                    length: n.length,
                  }
                );
              },
            },
            {
              key: 'isNumeric',
              value: function (e) {
                return Number(parseFloat(e)) == e;
              },
            },
            {
              key: 'checkRanges',
              value: function (e) {
                var t = this;
                if (
                  !Array.isArray(e) ||
                  '[object Object]' !== Object.prototype.toString.call(e[0])
                )
                  return (
                    this.log(
                      'markRanges() will only accept an array of objects'
                    ),
                    this.opt.noMatch(e),
                    []
                  );
                var n = [],
                  o = 0;
                return (
                  e
                    .sort(function (e, t) {
                      return e.start - t.start;
                    })
                    .forEach(function (e) {
                      var r = t.callNoMatchOnInvalidRanges(e, o),
                        i = r.start,
                        a = r.end;
                      r.valid &&
                        ((e.start = i), (e.length = a - i), n.push(e), (o = a));
                    }),
                  n
                );
              },
            },
            {
              key: 'callNoMatchOnInvalidRanges',
              value: function (e, t) {
                var n = void 0,
                  o = void 0,
                  r = !1;
                return (
                  e && void 0 !== e.start
                    ? ((o =
                        (n = parseInt(e.start, 10)) + parseInt(e.length, 10)),
                      this.isNumeric(e.start) &&
                      this.isNumeric(e.length) &&
                      o - t > 0 &&
                      o - n > 0
                        ? (r = !0)
                        : (this.log(
                            'Ignoring invalid or overlapping range: ' +
                              JSON.stringify(e)
                          ),
                          this.opt.noMatch(e)))
                    : (this.log('Ignoring invalid range: ' + JSON.stringify(e)),
                      this.opt.noMatch(e)),
                  {
                    start: n,
                    end: o,
                    valid: r,
                  }
                );
              },
            },
            {
              key: 'checkWhitespaceRanges',
              value: function (e, t, n) {
                var o = void 0,
                  r = !0,
                  i = n.length,
                  a = t - i,
                  s = parseInt(e.start, 10) - a;
                return (
                  (o = (s = s > i ? i : s) + parseInt(e.length, 10)) > i &&
                    ((o = i),
                    this.log(
                      'End range automatically set to the max value of ' + i
                    )),
                  s < 0 || o - s < 0 || s > i || o > i
                    ? ((r = !1),
                      this.log('Invalid range: ' + JSON.stringify(e)),
                      this.opt.noMatch(e))
                    : '' === n.substring(s, o).replace(/\s+/g, '') &&
                      ((r = !1),
                      this.log(
                        'Skipping whitespace only range: ' + JSON.stringify(e)
                      ),
                      this.opt.noMatch(e)),
                  {
                    start: s,
                    end: o,
                    valid: r,
                  }
                );
              },
            },
            {
              key: 'getTextNodes',
              value: function (e) {
                var t = this,
                  n = '',
                  o = [];
                this.iterator.forEachNode(
                  NodeFilter.SHOW_TEXT,
                  function (e) {
                    o.push({
                      start: n.length,
                      end: (n += e.textContent).length,
                      node: e,
                    });
                  },
                  function (e) {
                    return t.matchesExclude(e.parentNode)
                      ? NodeFilter.FILTER_REJECT
                      : NodeFilter.FILTER_ACCEPT;
                  },
                  function () {
                    e({
                      value: n,
                      nodes: o,
                    });
                  }
                );
              },
            },
            {
              key: 'matchesExclude',
              value: function (e) {
                return r.matches(
                  e,
                  this.opt.exclude.concat([
                    'script',
                    'style',
                    'title',
                    'head',
                    'html',
                  ])
                );
              },
            },
            {
              key: 'wrapRangeInTextNode',
              value: function (e, t, n) {
                var o = this.opt.element ? this.opt.element : 'mark',
                  r = e.splitText(t),
                  i = r.splitText(n - t),
                  a = document.createElement(o);
                return (
                  a.setAttribute('data-markjs', 'true'),
                  this.opt.className &&
                    a.setAttribute('class', this.opt.className),
                  (a.textContent = r.textContent),
                  r.parentNode.replaceChild(a, r),
                  i
                );
              },
            },
            {
              key: 'wrapRangeInMappedTextNode',
              value: function (e, t, n, o, r) {
                var i = this;
                e.nodes.every(function (a, s) {
                  var c = e.nodes[s + 1];
                  if (void 0 === c || c.start > t) {
                    if (!o(a.node)) return !1;
                    var l = t - a.start,
                      d = (n > a.end ? a.end : n) - a.start,
                      u = e.value.substr(0, a.start),
                      h = e.value.substr(d + a.start);
                    if (
                      ((a.node = i.wrapRangeInTextNode(a.node, l, d)),
                      (e.value = u + h),
                      e.nodes.forEach(function (t, n) {
                        n >= s &&
                          (e.nodes[n].start > 0 &&
                            n !== s &&
                            (e.nodes[n].start -= d),
                          (e.nodes[n].end -= d));
                      }),
                      (n -= d),
                      r(a.node.previousSibling, a.start),
                      !(n > a.end))
                    )
                      return !1;
                    t = a.end;
                  }
                  return !0;
                });
              },
            },
            {
              key: 'wrapMatches',
              value: function (e, t, n, o, r) {
                var i = this,
                  a = 0 === t ? 0 : t + 1;
                this.getTextNodes(function (t) {
                  t.nodes.forEach(function (t) {
                    t = t.node;
                    for (
                      var r = void 0;
                      null !== (r = e.exec(t.textContent)) && '' !== r[a];

                    )
                      if (n(r[a], t)) {
                        var s = r.index;
                        if (0 !== a)
                          for (var c = 1; c < a; c++) s += r[c].length;
                        (t = i.wrapRangeInTextNode(t, s, s + r[a].length)),
                          o(t.previousSibling),
                          (e.lastIndex = 0);
                      }
                  }),
                    r();
                });
              },
            },
            {
              key: 'wrapMatchesAcrossElements',
              value: function (e, t, n, o, r) {
                var i = this,
                  a = 0 === t ? 0 : t + 1;
                this.getTextNodes(function (t) {
                  for (
                    var s = void 0;
                    null !== (s = e.exec(t.value)) && '' !== s[a];

                  ) {
                    var c = s.index;
                    if (0 !== a) for (var l = 1; l < a; l++) c += s[l].length;
                    var d = c + s[a].length;
                    i.wrapRangeInMappedTextNode(
                      t,
                      c,
                      d,
                      function (e) {
                        return n(s[a], e);
                      },
                      function (t, n) {
                        (e.lastIndex = n), o(t);
                      }
                    );
                  }
                  r();
                });
              },
            },
            {
              key: 'wrapRangeFromIndex',
              value: function (e, t, n, o) {
                var r = this;
                this.getTextNodes(function (i) {
                  var a = i.value.length;
                  e.forEach(function (e, o) {
                    var s = r.checkWhitespaceRanges(e, a, i.value),
                      c = s.start,
                      l = s.end;
                    s.valid &&
                      r.wrapRangeInMappedTextNode(
                        i,
                        c,
                        l,
                        function (n) {
                          return t(n, e, i.value.substring(c, l), o);
                        },
                        function (t) {
                          n(t, e);
                        }
                      );
                  }),
                    o();
                });
              },
            },
            {
              key: 'unwrapMatches',
              value: function (e) {
                for (
                  var t = e.parentNode, n = document.createDocumentFragment();
                  e.firstChild;

                )
                  n.appendChild(e.removeChild(e.firstChild));
                t.replaceChild(n, e),
                  this.ie ? this.normalizeTextNode(t) : t.normalize();
              },
            },
            {
              key: 'normalizeTextNode',
              value: function (e) {
                if (e) {
                  if (3 === e.nodeType)
                    for (; e.nextSibling && 3 === e.nextSibling.nodeType; )
                      (e.nodeValue += e.nextSibling.nodeValue),
                        e.parentNode.removeChild(e.nextSibling);
                  else this.normalizeTextNode(e.firstChild);
                  this.normalizeTextNode(e.nextSibling);
                }
              },
            },
            {
              key: 'markRegExp',
              value: function (e, t) {
                var n = this;
                (this.opt = t),
                  this.log('Searching with expression "' + e + '"');
                var o = 0,
                  r = 'wrapMatches';
                this.opt.acrossElements && (r = 'wrapMatchesAcrossElements'),
                  this[r](
                    e,
                    this.opt.ignoreGroups,
                    function (e, t) {
                      return n.opt.filter(t, e, o);
                    },
                    function (e) {
                      o++, n.opt.each(e);
                    },
                    function () {
                      0 === o && n.opt.noMatch(e), n.opt.done(o);
                    }
                  );
              },
            },
            {
              key: 'mark',
              value: function (e, t) {
                var n = this;
                this.opt = t;
                var o = 0,
                  r = 'wrapMatches',
                  i = this.getSeparatedKeywords('string' == typeof e ? [e] : e),
                  a = i.keywords,
                  s = i.length,
                  c = this.opt.caseSensitive ? '' : 'i';
                this.opt.acrossElements && (r = 'wrapMatchesAcrossElements'),
                  0 === s
                    ? this.opt.done(o)
                    : (function e(t) {
                        var i = new RegExp(n.createRegExp(t), 'gm' + c),
                          l = 0;
                        n.log('Searching with expression "' + i + '"'),
                          n[r](
                            i,
                            1,
                            function (e, r) {
                              return n.opt.filter(r, t, o, l);
                            },
                            function (e) {
                              l++, o++, n.opt.each(e);
                            },
                            function () {
                              0 === l && n.opt.noMatch(t),
                                a[s - 1] === t
                                  ? n.opt.done(o)
                                  : e(a[a.indexOf(t) + 1]);
                            }
                          );
                      })(a[0]);
              },
            },
            {
              key: 'markRanges',
              value: function (e, t) {
                var n = this;
                this.opt = t;
                var o = 0,
                  r = this.checkRanges(e);
                r && r.length
                  ? (this.log(
                      'Starting to mark with the following ranges: ' +
                        JSON.stringify(r)
                    ),
                    this.wrapRangeFromIndex(
                      r,
                      function (e, t, o, r) {
                        return n.opt.filter(e, t, o, r);
                      },
                      function (e, t) {
                        o++, n.opt.each(e, t);
                      },
                      function () {
                        n.opt.done(o);
                      }
                    ))
                  : this.opt.done(o);
              },
            },
            {
              key: 'unmark',
              value: function (e) {
                var t = this;
                this.opt = e;
                var n = this.opt.element ? this.opt.element : '*';
                (n += '[data-markjs]'),
                  this.opt.className && (n += '.' + this.opt.className),
                  this.log('Removal selector "' + n + '"'),
                  this.iterator.forEachNode(
                    NodeFilter.SHOW_ELEMENT,
                    function (e) {
                      t.unwrapMatches(e);
                    },
                    function (e) {
                      var o = r.matches(e, n),
                        i = t.matchesExclude(e);
                      return !o || i
                        ? NodeFilter.FILTER_REJECT
                        : NodeFilter.FILTER_ACCEPT;
                    },
                    this.opt.done
                  );
              },
            },
            {
              key: 'opt',
              set: function (e) {
                this._opt = o(
                  {},
                  {
                    element: '',
                    className: '',
                    exclude: [],
                    iframes: !1,
                    iframesTimeout: 5e3,
                    separateWordSearch: !0,
                    diacritics: !0,
                    synonyms: {},
                    accuracy: 'partially',
                    acrossElements: !1,
                    caseSensitive: !1,
                    ignoreJoiners: !1,
                    ignoreGroups: 0,
                    ignorePunctuation: [],
                    wildcards: 'disabled',
                    each: function () {},
                    noMatch: function () {},
                    filter: function () {
                      return !0;
                    },
                    done: function () {},
                    debug: !1,
                    log: window.console,
                  },
                  e
                );
              },
              get: function () {
                return this._opt;
              },
            },
            {
              key: 'iterator',
              get: function () {
                return new r(
                  this.ctx,
                  this.opt.iframes,
                  this.opt.exclude,
                  this.opt.iframesTimeout
                );
              },
            },
          ]),
          i
        );
      })();
    return function (e) {
      var t = this,
        n = new i(e);
      return (
        (this.mark = function (e, o) {
          return n.mark(e, o), t;
        }),
        (this.markRegExp = function (e, o) {
          return n.markRegExp(e, o), t;
        }),
        (this.markRanges = function (e, o) {
          return n.markRanges(e, o), t;
        }),
        (this.unmark = function (e) {
          return n.unmark(e), t;
        }),
        this
      );
    };
  });
  var R = (e, t = 'Internal Logic Error') => {
    if (!e) throw new Error('function' == typeof t ? t() : t);
  };
  class M {
    constructor(e, t) {
      (this.value = e),
        (this.excluded = t),
        (this.isSimpleStarRec = '**' === e),
        (this.isRegexStarRec = e.startsWith('**(') && e.endsWith(')')),
        (this.isStarRec = this.isSimpleStarRec || this.isRegexStarRec);
    }
  }
  class A {
    constructor(e, t = null) {
      (this.left = null === t),
        (this.link = null === t ? new A(e, this) : t),
        (this.type = e),
        (this.isStarRec = '**' === this.type),
        (this.node = null),
        (this.pointer = null);
    }
    setPointer(e) {
      (this.pointer = e), (this.link.pointer = e);
    }
    setNode(e) {
      (this.node = e), (this.link.node = e);
    }
  }
  const S = (e, t, n = {}) => {
      throw new Error(
        Object.entries(n).reduce((e, [t, n]) => `${e}, ${t} ${n}`, `${e}: ${t}`)
      );
    },
    L = (e) => (1 === e.length ? e[0] : e),
    B = /^[?*+\d]+$/;
  const O = (e, t, n = {}) => {
    throw new Error(
      Object.entries(n).reduce((e, [t, n]) => `${e}, ${t} ${n}`, `${e}: ${t}`)
    );
  };
  var z = (e, t) => {
      if ('' === e) return new M('', !1);
      const n = ((e) => {
          let t = [];
          t.or = !0;
          let n = !1,
            o = !1,
            r = 0;
          const i = [],
            a = (e) => {
              !0 === t.excluded && (R(!1 === o), (o = !0)),
                i.push(t),
                (t = []),
                (t.or = e);
            },
            s = () => {
              const e = i.pop(),
                n = L(t);
              !0 === e.or && !0 === n.or ? e.push(...n) : e.push(n), (t = e);
            };
          return (
            a(!1),
            {
              setInArray: (t, o) => {
                n === t &&
                  S(n ? 'Bad Array Start' : 'Bad Array Terminator', e, {
                    char: o,
                  }),
                  (n = t);
              },
              finishElement: (
                i,
                a,
                s,
                { finReq: c = !1, group: l = !1 } = {}
              ) => {
                if (r === i)
                  s.includes(e[i - 1] || null) ||
                    S(a, e, {
                      char: i,
                    }),
                    (r += 1);
                else {
                  c &&
                    S(a, e, {
                      char: i,
                    });
                  const s = e.slice(r, i);
                  l &&
                    !['**', '++'].includes(s) &&
                    S('Bad Group Start', e, {
                      char: i,
                    }),
                    n &&
                      !(B.test(s) || (s.startsWith('(') && s.endsWith(')'))) &&
                      S('Bad Array Selector', e, {
                        selector: s,
                      }),
                    l
                      ? t.push(new A(s))
                      : (t.push(new M(n ? `[${s}]` : s, o)), (o = !1)),
                    (r = i + 1);
                }
              },
              startExclusion: (t) => {
                !1 !== o &&
                  S('Redundant Exclusion', e, {
                    char: t,
                  }),
                  (o = !0);
              },
              startGroup: () => {
                a(!0), o && ((t.excluded = !0), (o = !1)), a(!1);
              },
              newGroupElement: () => {
                s(), a(!1);
              },
              finishGroup: (n) => {
                i.length < 2 &&
                  S('Unexpected Group Terminator', e, {
                    char: n,
                  }),
                  s(),
                  s(),
                  R(Array.isArray(t));
                const o = t[t.length - 2];
                o instanceof A && !0 === o.left && t.push(o.link);
              },
              finalizeResult: () => (
                s(),
                R(!1 === o),
                0 !== i.length && S('Non Terminated Group', e),
                n && S('Non Terminated Array', e),
                L(t)
              ),
            }
          );
        })(e),
        o = e.length;
      let r = !1,
        i = 0;
      for (let a = 0; a < o; a += 1) {
        const o = e[a];
        if (!1 === r) {
          if (0 === i)
            switch (o) {
              case '.':
                n.finishElement(a, 'Bad Path Separator', [']', '}']);
                break;
              case '[':
                t.useArraySelector ||
                  O('Forbidden Array Selector', e, {
                    char: a,
                  }),
                  n.finishElement(a, 'Bad Array Start', [
                    null,
                    '!',
                    '{',
                    ',',
                    '}',
                    ']',
                  ]),
                  n.setInArray(!0, a);
                break;
              case ']':
                n.finishElement(a, 'Bad Array Terminator', ['}']),
                  n.setInArray(!1, a);
                break;
              case '{':
                n.finishElement(
                  a,
                  'Bad Group Start',
                  [null, '!', '.', '[', '{', ','],
                  {
                    group: !0,
                  }
                ),
                  n.startGroup();
                break;
              case ',':
                n.finishElement(a, 'Bad Group Separator', [']', '}']),
                  n.newGroupElement();
                break;
              case '}':
                n.finishElement(a, 'Bad Group Terminator', [']', '}']),
                  n.finishGroup(a);
                break;
              case '!':
                n.finishElement(
                  a,
                  'Bad Exclusion',
                  [null, '.', ',', '{', '['],
                  {
                    finReq: !0,
                  }
                ),
                  n.startExclusion(a);
            }
          switch (o) {
            case '(':
              i += 1;
              break;
            case ')':
              0 === i &&
                O('Unexpected Parentheses', e, {
                  char: a,
                }),
                (i -= 1);
          }
        }
        r = '\\' === o && !r;
      }
      return (
        !1 !== r &&
          O('Dangling Escape', e, {
            char: o - 1,
          }),
        0 !== i && O('Unterminated Parentheses', e),
        n.finishElement(o, 'Bad Terminator', [']', '}']),
        n.finalizeResult()
      );
    },
    N = (e, t, n, { onAdd: o, onFin: r }) => {
      const i = [[[e, null]]];
      let a = !1;
      ((e, t) => {
        const n = [e],
          o = [null],
          r = [],
          i = [];
        let a = 0,
          s = !0;
        for (; -1 !== a; ) {
          const e = n[a];
          Array.isArray(e)
            ? !0 !== e.or
              ? (n.splice(a, 1, ...e),
                o.splice(a, 1, ...new Array(e.length).fill(o[a])),
                null !== o[a] && (i[o[a]] += e.length - 1))
              : (void 0 === r[a]
                  ? ((r[a] = 0), (i[a] = 0))
                  : 0 !== i[a] &&
                    (n.splice(a + 1, i[a]), o.splice(a + 1, i[a]), (i[a] = 0)),
                r[a] < e.length
                  ? (n.splice(a + 1, 0, e[r[a]]),
                    o.splice(a + 1, 0, a),
                    (r[a] = (r[a] || 0) + 1),
                    (i[a] += 1),
                    (s = !0),
                    (a += 1))
                  : ((r[a] = 0), (a -= 1)))
            : !0 === s
            ? (t('ADD', e),
              a === n.length - 1 ? (t('FIN', e), (s = !1)) : (a += 1))
            : (t('RM', e), (a -= 1));
        }
      })(n, (n, s) => {
        if ('RM' === n) !0 === s.excluded && (a = !1), (i.length -= 2);
        else if ('ADD' === n) {
          if (!0 === s.excluded) {
            if (a) throw new Error(`Redundant Exclusion: "${t}"`);
            a = !0;
          }
          const e = [],
            n = i[i.length - 2];
          i[i.length - 1].forEach(([t, r]) =>
            o(t, r, s, n, (n) => e.push([n, t]))
          ),
            i.push(s, e);
        } else
          i[i.length - 1]
            .filter(([t]) => t !== e)
            .forEach(([e, t]) => r(e, t, s, a));
      });
    };
  const $ = /[?!,.*+[\](){}\\]/g,
    P = /^\^?[^-/\\^$*+?.()|[\]{}]*\$?$/g,
    j = (e) => {
      if (P.test(e)) {
        const t = e.startsWith('^'),
          n = e.endsWith('$');
        if (t && n) {
          const t = e.slice(1, -1);
          return {
            test: (e) => e === t,
          };
        }
        if (t) {
          const t = e.slice(1);
          return {
            test: (e) => e.startsWith(t),
          };
        }
        if (n) {
          const t = e.slice(0, -1);
          return {
            test: (e) => e.endsWith(t),
          };
        }
        return {
          test: (t) => t.includes(e),
        };
      }
      try {
        return new RegExp(e);
      } catch (t) {
        throw new Error(`Invalid Regex: "${e}"`);
      }
    },
    F = (e) =>
      e.reduce(
        (e, t) =>
          `${e}${
            'number' == typeof t
              ? `[${t}]`
              : `${e ? '.' : ''}${((e) => e.replace($, '\\$&'))(t)}`
          }`,
        ''
      ),
    U = [
      '-',
      '/',
      '\\',
      '^',
      '$',
      '*',
      '+',
      '?',
      '.',
      '(',
      ')',
      '|',
      '[',
      ']',
      '{',
      '}',
    ],
    D = (e) => {
      let t = '',
        n = !1,
        o = !0;
      for (let r = 0; r < e.length; r += 1) {
        const i = e[r];
        n || '\\' !== i
          ? n || '*' !== i
            ? n || '+' !== i
              ? n || '?' !== i
                ? (U.includes(i) && ((o = !1), (t += '\\')), (t += i), (n = !1))
                : ((o = !1), (t += '.'))
              : ((o = !1), (t += '.+'))
            : ((o = !1), (t += '.*'))
          : (n = !0);
      }
      return o
        ? {
            test: (e) => e === t,
          }
        : '.+' === t
        ? {
            test: (e) => '' !== e,
          }
        : new RegExp(`^${t}$`);
    };
  class V {
    constructor(e, t) {
      if (
        (t.nodes.push(this),
        (this.value = e),
        (this.ctx = t),
        (this.order = t.counter),
        (this.children = []),
        (this.match = !1),
        (this.matches = !1),
        (this.needles = []),
        (this.leafNeedles = []),
        (this.leafNeedlesExclude = []),
        (this.leafNeedlesMatch = []),
        (this.isArrayTarget = e.startsWith('[') && e.endsWith(']')),
        (this.isSimpleStarRec = '**' === e),
        (this.isSimplePlusRec = '++' === e),
        (this.isSimpleRec = this.isSimpleStarRec || this.isSimplePlusRec),
        (this.isRegexStarRec = e.startsWith('**(') && e.endsWith(')')),
        (this.isRegexPlusRec = e.startsWith('++(') && e.endsWith(')')),
        (this.isStarRec = this.isSimpleStarRec || this.isRegexStarRec),
        (this.isPlusRec = this.isSimplePlusRec || this.isRegexPlusRec),
        (this.isRec = this.isStarRec || this.isPlusRec),
        (this.isAnyArrayTarget = '[*]' === e),
        (this.isAnyObjTarget = '*' === e),
        this.isSimpleRec || this.isAnyObjTarget || this.isAnyArrayTarget)
      )
        this.regex = null;
      else {
        const { regex: n } = t;
        e in n ||
          (n[e] = ((e) =>
            (e.startsWith('**(') || e.startsWith('++(')) && e.endsWith(')')
              ? j(e.slice(3, -1))
              : e.startsWith('[(') && e.endsWith(')]')
              ? j(e.slice(2, -2))
              : e.startsWith('(') && e.endsWith(')')
              ? j(e.slice(1, -1))
              : e.startsWith('[') && e.endsWith(']')
              ? D(e.slice(1, -1))
              : D(e))(e)),
          (this.regex = n[e]);
      }
    }
    recMatch(e) {
      return !!this.isRec && (!!this.isSimpleRec || this.regex.test(e));
    }
    typeMatch(e, t) {
      return (
        !!this.isSimpleRec ||
        (this.isAnyArrayTarget
          ? t
          : this.isAnyObjTarget
          ? !t
          : !(t !== this.isArrayTarget && !this.isRec) && this.regex.test(e))
      );
    }
    add(e) {
      this.children.push(e);
    }
    get(e) {
      return this.children.find(({ value: t }) => t === e);
    }
    markMatches() {
      this.matches = !0;
    }
    addNeedle(e) {
      this.needles.includes(e) || this.needles.push(e);
    }
    setRoots(e) {
      this.roots = e;
    }
    finish(e, t, n) {
      this.addNeedle(e),
        this.leafNeedles.includes(e) || this.leafNeedles.push(e);
      const o = t ? this.leafNeedlesExclude : this.leafNeedlesMatch;
      o.includes(e) || o.push(e),
        (this.match = !t),
        (this.matches = this.match),
        (this.index = n);
    }
  }
  const H = (e, t, n, o) => {
      N(e, t, n, {
        onAdd: (e, n, r, i, a) => {
          if ((e.addNeedle(t), r instanceof A))
            return void (!0 === r.left
              ? (r.isStarRec && r.setPointer(e),
                r.setNode(new V('*', o)),
                o.links.push(e, r.node),
                a(r.node))
              : ((r.target = 'target' in i ? i.target : n.get(i.value)),
                o.links.push(r.target, r.node),
                null !== r.pointer && (a(r.pointer), r.setPointer(null)),
                a(e)));
          const s = r.isStarRec && r.value === (null == i ? void 0 : i.value);
          if (s && o.strict) throw new Error(`Redundant Recursion: "${t}"`);
          if (s) r.target = e;
          else {
            let t = e.get(r.value);
            void 0 === t && ((t = new V(r.value, o)), e.add(t)), a(t);
          }
          r.isStarRec && a(e);
        },
        onFin: (e, n, r, i) => {
          if (o.strict && r.isSimpleStarRec) {
            const e = n.children.filter(
              ({ value: e }) => !['', '**'].includes(e)
            );
            if (0 !== e.length)
              throw new Error(
                `Needle Target Invalidated: "${e[0].needles[0]}" by "${t}"`
              );
          }
          if (o.strict && 0 !== e.leafNeedles.length)
            throw new Error(
              `Redundant Needle Target: "${e.leafNeedles[0]}" vs "${t}"`
            );
          e.finish(t, i, o.counter), (o.counter += 1);
        },
      });
    },
    G = (e, t) => {
      const n = [];
      for (let o = 0, r = e.length; o < r; o += 1) {
        const r = e[o][t];
        for (let e = 0, t = r.length; e < t; e += 1) {
          const t = r[e];
          n.includes(t) || n.push(t);
        }
      }
      return n;
    },
    q = (e) => {
      let t = -1,
        n = !1,
        o = e.length;
      for (; o--; ) {
        const { index: r, match: i } = e[o];
        r > t && ((t = r), (n = i));
      }
      return n;
    },
    W = (e, t) => (t.joined ? F(e) : [...e]);
  var J, Y, K;
  (Y = function (e) {
    var t,
      n,
      o = ie(e),
      r = o[0],
      i = o[1],
      a = new te(
        (function (e, t, n) {
          return (3 * (t + n)) / 4 - n;
        })(0, r, i)
      ),
      s = 0,
      c = i > 0 ? r - 4 : r;
    for (n = 0; n < c; n += 4)
      (t =
        (ee[e.charCodeAt(n)] << 18) |
        (ee[e.charCodeAt(n + 1)] << 12) |
        (ee[e.charCodeAt(n + 2)] << 6) |
        ee[e.charCodeAt(n + 3)]),
        (a[s++] = (t >> 16) & 255),
        (a[s++] = (t >> 8) & 255),
        (a[s++] = 255 & t);
    2 === i &&
      ((t = (ee[e.charCodeAt(n)] << 2) | (ee[e.charCodeAt(n + 1)] >> 4)),
      (a[s++] = 255 & t));
    1 === i &&
      ((t =
        (ee[e.charCodeAt(n)] << 10) |
        (ee[e.charCodeAt(n + 1)] << 4) |
        (ee[e.charCodeAt(n + 2)] >> 2)),
      (a[s++] = (t >> 8) & 255),
      (a[s++] = 255 & t));
    return a;
  }),
    (K = function (e) {
      for (
        var t, n = e.length, o = n % 3, r = [], i = 16383, a = 0, s = n - o;
        a < s;
        a += i
      )
        r.push(ae(e, a, a + i > s ? s : a + i));
      1 === o
        ? ((t = e[n - 1]), r.push(Z[t >> 2] + Z[(t << 4) & 63] + '=='))
        : 2 === o &&
          ((t = (e[n - 2] << 8) + e[n - 1]),
          r.push(Z[t >> 10] + Z[(t >> 4) & 63] + Z[(t << 2) & 63] + '='));
      return r.join('');
    });
  for (
    var X,
      Q,
      Z = [],
      ee = [],
      te = 'undefined' != typeof Uint8Array ? Uint8Array : Array,
      ne = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',
      oe = 0,
      re = ne.length;
    oe < re;
    ++oe
  )
    (Z[oe] = ne[oe]), (ee[ne.charCodeAt(oe)] = oe);
  function ie(e) {
    var t = e.length;
    if (t % 4 > 0)
      throw new Error('Invalid string. Length must be a multiple of 4');
    var n = e.indexOf('=');
    return -1 === n && (n = t), [n, n === t ? 0 : 4 - (n % 4)];
  }
  function ae(e, t, n) {
    for (var o, r, i = [], a = t; a < n; a += 3)
      (o =
        ((e[a] << 16) & 16711680) +
        ((e[a + 1] << 8) & 65280) +
        (255 & e[a + 2])),
        i.push(
          Z[((r = o) >> 18) & 63] +
            Z[(r >> 12) & 63] +
            Z[(r >> 6) & 63] +
            Z[63 & r]
        );
    return i.join('');
  }
  (ee['-'.charCodeAt(0)] = 62),
    (ee['_'.charCodeAt(0)] = 63),
    (X = function (e, t, n, o, r) {
      var i,
        a,
        s = 8 * r - o - 1,
        c = (1 << s) - 1,
        l = c >> 1,
        d = -7,
        u = n ? r - 1 : 0,
        h = n ? -1 : 1,
        m = e[t + u];
      for (
        u += h, i = m & ((1 << -d) - 1), m >>= -d, d += s;
        d > 0;
        i = 256 * i + e[t + u], u += h, d -= 8
      );
      for (
        a = i & ((1 << -d) - 1), i >>= -d, d += o;
        d > 0;
        a = 256 * a + e[t + u], u += h, d -= 8
      );
      if (0 === i) i = 1 - l;
      else {
        if (i === c) return a ? NaN : (1 / 0) * (m ? -1 : 1);
        (a += Math.pow(2, o)), (i -= l);
      }
      return (m ? -1 : 1) * a * Math.pow(2, i - o);
    }),
    (Q = function (e, t, n, o, r, i) {
      var a,
        s,
        c,
        l = 8 * i - r - 1,
        d = (1 << l) - 1,
        u = d >> 1,
        h = 23 === r ? Math.pow(2, -24) - Math.pow(2, -77) : 0,
        m = o ? 0 : i - 1,
        p = o ? 1 : -1,
        f = t < 0 || (0 === t && 1 / t < 0) ? 1 : 0;
      for (
        t = Math.abs(t),
          isNaN(t) || t === 1 / 0
            ? ((s = isNaN(t) ? 1 : 0), (a = d))
            : ((a = Math.floor(Math.log(t) / Math.LN2)),
              t * (c = Math.pow(2, -a)) < 1 && (a--, (c *= 2)),
              (t += a + u >= 1 ? h / c : h * Math.pow(2, 1 - u)) * c >= 2 &&
                (a++, (c /= 2)),
              a + u >= d
                ? ((s = 0), (a = d))
                : a + u >= 1
                ? ((s = (t * c - 1) * Math.pow(2, r)), (a += u))
                : ((s = t * Math.pow(2, u - 1) * Math.pow(2, r)), (a = 0)));
        r >= 8;
        e[n + m] = 255 & s, m += p, s /= 256, r -= 8
      );
      for (
        a = (a << r) | s, l += r;
        l > 0;
        e[n + m] = 255 & a, m += p, a /= 256, l -= 8
      );
      e[n + m - p] |= 128 * f;
    });
  var se =
    'function' == typeof Symbol && 'function' == typeof Symbol.for
      ? Symbol.for('nodejs.util.inspect.custom')
      : null;
  J = de;
  var ce = 2147483647;
  function le(e) {
    if (e > ce)
      throw new RangeError(
        'The value "' + e + '" is invalid for option "size"'
      );
    var t = new Uint8Array(e);
    return Object.setPrototypeOf(t, de.prototype), t;
  }
  function de(e, t, n) {
    if ('number' == typeof e) {
      if ('string' == typeof t)
        throw new TypeError(
          'The "string" argument must be of type string. Received type number'
        );
      return me(e);
    }
    return ue(e, t, n);
  }
  function ue(e, t, n) {
    if ('string' == typeof e)
      return (function (e, t) {
        ('string' == typeof t && '' !== t) || (t = 'utf8');
        if (!de.isEncoding(t)) throw new TypeError('Unknown encoding: ' + t);
        var n = 0 | ye(e, t),
          o = le(n),
          r = o.write(e, t);
        r !== n && (o = o.slice(0, r));
        return o;
      })(e, t);
    if (ArrayBuffer.isView(e))
      return (function (e) {
        if (Ve(e, Uint8Array)) {
          var t = new Uint8Array(e);
          return fe(t.buffer, t.byteOffset, t.byteLength);
        }
        return pe(e);
      })(e);
    if (null == e)
      throw new TypeError(
        'The first argument must be one of type string, Buffer, ArrayBuffer, Array, or Array-like Object. Received type ' +
          typeof e
      );
    if (Ve(e, ArrayBuffer) || (e && Ve(e.buffer, ArrayBuffer)))
      return fe(e, t, n);
    if (
      'undefined' != typeof SharedArrayBuffer &&
      (Ve(e, SharedArrayBuffer) || (e && Ve(e.buffer, SharedArrayBuffer)))
    )
      return fe(e, t, n);
    if ('number' == typeof e)
      throw new TypeError(
        'The "value" argument must not be of type number. Received type number'
      );
    var o = e.valueOf && e.valueOf();
    if (null != o && o !== e) return de.from(o, t, n);
    var r = (function (e) {
      if (de.isBuffer(e)) {
        var t = 0 | ve(e.length),
          n = le(t);
        return 0 === n.length || e.copy(n, 0, 0, t), n;
      }
      if (void 0 !== e.length)
        return 'number' != typeof e.length || He(e.length) ? le(0) : pe(e);
      if ('Buffer' === e.type && Array.isArray(e.data)) return pe(e.data);
    })(e);
    if (r) return r;
    if (
      'undefined' != typeof Symbol &&
      null != Symbol.toPrimitive &&
      'function' == typeof e[Symbol.toPrimitive]
    )
      return de.from(e[Symbol.toPrimitive]('string'), t, n);
    throw new TypeError(
      'The first argument must be one of type string, Buffer, ArrayBuffer, Array, or Array-like Object. Received type ' +
        typeof e
    );
  }
  function he(e) {
    if ('number' != typeof e)
      throw new TypeError('"size" argument must be of type number');
    if (e < 0)
      throw new RangeError(
        'The value "' + e + '" is invalid for option "size"'
      );
  }
  function me(e) {
    return he(e), le(e < 0 ? 0 : 0 | ve(e));
  }
  function pe(e) {
    for (
      var t = e.length < 0 ? 0 : 0 | ve(e.length), n = le(t), o = 0;
      o < t;
      o += 1
    )
      n[o] = 255 & e[o];
    return n;
  }
  function fe(e, t, n) {
    if (t < 0 || e.byteLength < t)
      throw new RangeError('"offset" is outside of buffer bounds');
    if (e.byteLength < t + (n || 0))
      throw new RangeError('"length" is outside of buffer bounds');
    var o;
    return (
      (o =
        void 0 === t && void 0 === n
          ? new Uint8Array(e)
          : void 0 === n
          ? new Uint8Array(e, t)
          : new Uint8Array(e, t, n)),
      Object.setPrototypeOf(o, de.prototype),
      o
    );
  }
  function ve(e) {
    if (e >= ce)
      throw new RangeError(
        'Attempt to allocate Buffer larger than maximum size: 0x' +
          ce.toString(16) +
          ' bytes'
      );
    return 0 | e;
  }
  function ye(e, t) {
    if (de.isBuffer(e)) return e.length;
    if (ArrayBuffer.isView(e) || Ve(e, ArrayBuffer)) return e.byteLength;
    if ('string' != typeof e)
      throw new TypeError(
        'The "string" argument must be one of type string, Buffer, or ArrayBuffer. Received type ' +
          typeof e
      );
    var n = e.length,
      o = arguments.length > 2 && !0 === arguments[2];
    if (!o && 0 === n) return 0;
    for (var r = !1; ; )
      switch (t) {
        case 'ascii':
        case 'latin1':
        case 'binary':
          return n;
        case 'utf8':
        case 'utf-8':
          return Fe(e).length;
        case 'ucs2':
        case 'ucs-2':
        case 'utf16le':
        case 'utf-16le':
          return 2 * n;
        case 'hex':
          return n >>> 1;
        case 'base64':
          return Ue(e).length;
        default:
          if (r) return o ? -1 : Fe(e).length;
          (t = ('' + t).toLowerCase()), (r = !0);
      }
  }
  function ge(e, t, n) {
    var o = !1;
    if (((void 0 === t || t < 0) && (t = 0), t > this.length)) return '';
    if (((void 0 === n || n > this.length) && (n = this.length), n <= 0))
      return '';
    if ((n >>>= 0) <= (t >>>= 0)) return '';
    for (e || (e = 'utf8'); ; )
      switch (e) {
        case 'hex':
          return Le(this, t, n);
        case 'utf8':
        case 'utf-8':
          return Re(this, t, n);
        case 'ascii':
          return Ae(this, t, n);
        case 'latin1':
        case 'binary':
          return Se(this, t, n);
        case 'base64':
          return ke(this, t, n);
        case 'ucs2':
        case 'ucs-2':
        case 'utf16le':
        case 'utf-16le':
          return Be(this, t, n);
        default:
          if (o) throw new TypeError('Unknown encoding: ' + e);
          (e = (e + '').toLowerCase()), (o = !0);
      }
  }
  function we(e, t, n) {
    var o = e[t];
    (e[t] = e[n]), (e[n] = o);
  }
  function be(e, t, n, o, r) {
    if (0 === e.length) return -1;
    if (
      ('string' == typeof n
        ? ((o = n), (n = 0))
        : n > 2147483647
        ? (n = 2147483647)
        : n < -2147483648 && (n = -2147483648),
      He((n = +n)) && (n = r ? 0 : e.length - 1),
      n < 0 && (n = e.length + n),
      n >= e.length)
    ) {
      if (r) return -1;
      n = e.length - 1;
    } else if (n < 0) {
      if (!r) return -1;
      n = 0;
    }
    if (('string' == typeof t && (t = de.from(t, o)), de.isBuffer(t)))
      return 0 === t.length ? -1 : xe(e, t, n, o, r);
    if ('number' == typeof t)
      return (
        (t &= 255),
        'function' == typeof Uint8Array.prototype.indexOf
          ? r
            ? Uint8Array.prototype.indexOf.call(e, t, n)
            : Uint8Array.prototype.lastIndexOf.call(e, t, n)
          : xe(e, [t], n, o, r)
      );
    throw new TypeError('val must be string, number or Buffer');
  }
  function xe(e, t, n, o, r) {
    var i,
      a = 1,
      s = e.length,
      c = t.length;
    if (
      void 0 !== o &&
      ('ucs2' === (o = String(o).toLowerCase()) ||
        'ucs-2' === o ||
        'utf16le' === o ||
        'utf-16le' === o)
    ) {
      if (e.length < 2 || t.length < 2) return -1;
      (a = 2), (s /= 2), (c /= 2), (n /= 2);
    }
    function l(e, t) {
      return 1 === a ? e[t] : e.readUInt16BE(t * a);
    }
    if (r) {
      var d = -1;
      for (i = n; i < s; i++)
        if (l(e, i) === l(t, -1 === d ? 0 : i - d)) {
          if ((-1 === d && (d = i), i - d + 1 === c)) return d * a;
        } else -1 !== d && (i -= i - d), (d = -1);
    } else
      for (n + c > s && (n = s - c), i = n; i >= 0; i--) {
        for (var u = !0, h = 0; h < c; h++)
          if (l(e, i + h) !== l(t, h)) {
            u = !1;
            break;
          }
        if (u) return i;
      }
    return -1;
  }
  function _e(e, t, n, o) {
    n = Number(n) || 0;
    var r = e.length - n;
    o ? (o = Number(o)) > r && (o = r) : (o = r);
    var i = t.length;
    o > i / 2 && (o = i / 2);
    for (var a = 0; a < o; ++a) {
      var s = parseInt(t.substr(2 * a, 2), 16);
      if (He(s)) return a;
      e[n + a] = s;
    }
    return a;
  }
  function Ce(e, t, n, o) {
    return De(Fe(t, e.length - n), e, n, o);
  }
  function Ee(e, t, n, o) {
    return De(
      (function (e) {
        for (var t = [], n = 0; n < e.length; ++n)
          t.push(255 & e.charCodeAt(n));
        return t;
      })(t),
      e,
      n,
      o
    );
  }
  function Te(e, t, n, o) {
    return De(Ue(t), e, n, o);
  }
  function Ie(e, t, n, o) {
    return De(
      (function (e, t) {
        for (var n, o, r, i = [], a = 0; a < e.length && !((t -= 2) < 0); ++a)
          (o = (n = e.charCodeAt(a)) >> 8), (r = n % 256), i.push(r), i.push(o);
        return i;
      })(t, e.length - n),
      e,
      n,
      o
    );
  }
  function ke(e, t, n) {
    return 0 === t && n === e.length ? K(e) : K(e.slice(t, n));
  }
  function Re(e, t, n) {
    n = Math.min(e.length, n);
    for (var o = [], r = t; r < n; ) {
      var i,
        a,
        s,
        c,
        l = e[r],
        d = null,
        u = l > 239 ? 4 : l > 223 ? 3 : l > 191 ? 2 : 1;
      if (r + u <= n)
        switch (u) {
          case 1:
            l < 128 && (d = l);
            break;
          case 2:
            128 == (192 & (i = e[r + 1])) &&
              (c = ((31 & l) << 6) | (63 & i)) > 127 &&
              (d = c);
            break;
          case 3:
            (i = e[r + 1]),
              (a = e[r + 2]),
              128 == (192 & i) &&
                128 == (192 & a) &&
                (c = ((15 & l) << 12) | ((63 & i) << 6) | (63 & a)) > 2047 &&
                (c < 55296 || c > 57343) &&
                (d = c);
            break;
          case 4:
            (i = e[r + 1]),
              (a = e[r + 2]),
              (s = e[r + 3]),
              128 == (192 & i) &&
                128 == (192 & a) &&
                128 == (192 & s) &&
                (c =
                  ((15 & l) << 18) |
                  ((63 & i) << 12) |
                  ((63 & a) << 6) |
                  (63 & s)) > 65535 &&
                c < 1114112 &&
                (d = c);
        }
      null === d
        ? ((d = 65533), (u = 1))
        : d > 65535 &&
          ((d -= 65536),
          o.push(((d >>> 10) & 1023) | 55296),
          (d = 56320 | (1023 & d))),
        o.push(d),
        (r += u);
    }
    return (function (e) {
      var t = e.length;
      if (t <= Me) return String.fromCharCode.apply(String, e);
      var n = '',
        o = 0;
      for (; o < t; )
        n += String.fromCharCode.apply(String, e.slice(o, (o += Me)));
      return n;
    })(o);
  }
  (de.TYPED_ARRAY_SUPPORT = (function () {
    try {
      var e = new Uint8Array(1),
        t = {
          foo: function () {
            return 42;
          },
        };
      return (
        Object.setPrototypeOf(t, Uint8Array.prototype),
        Object.setPrototypeOf(e, t),
        42 === e.foo()
      );
    } catch (e) {
      return !1;
    }
  })()),
    !de.TYPED_ARRAY_SUPPORT && 'undefined' != typeof console && console.error,
    Object.defineProperty(de.prototype, 'parent', {
      enumerable: !0,
      get: function () {
        if (de.isBuffer(this)) return this.buffer;
      },
    }),
    Object.defineProperty(de.prototype, 'offset', {
      enumerable: !0,
      get: function () {
        if (de.isBuffer(this)) return this.byteOffset;
      },
    }),
    (de.poolSize = 8192),
    (de.from = function (e, t, n) {
      return ue(e, t, n);
    }),
    Object.setPrototypeOf(de.prototype, Uint8Array.prototype),
    Object.setPrototypeOf(de, Uint8Array),
    (de.alloc = function (e, t, n) {
      return (function (e, t, n) {
        return (
          he(e),
          e <= 0
            ? le(e)
            : void 0 !== t
            ? 'string' == typeof n
              ? le(e).fill(t, n)
              : le(e).fill(t)
            : le(e)
        );
      })(e, t, n);
    }),
    (de.allocUnsafe = function (e) {
      return me(e);
    }),
    (de.allocUnsafeSlow = function (e) {
      return me(e);
    }),
    (de.isBuffer = function (e) {
      return null != e && !0 === e._isBuffer && e !== de.prototype;
    }),
    (de.compare = function (e, t) {
      if (
        (Ve(e, Uint8Array) && (e = de.from(e, e.offset, e.byteLength)),
        Ve(t, Uint8Array) && (t = de.from(t, t.offset, t.byteLength)),
        !de.isBuffer(e) || !de.isBuffer(t))
      )
        throw new TypeError(
          'The "buf1", "buf2" arguments must be one of type Buffer or Uint8Array'
        );
      if (e === t) return 0;
      for (
        var n = e.length, o = t.length, r = 0, i = Math.min(n, o);
        r < i;
        ++r
      )
        if (e[r] !== t[r]) {
          (n = e[r]), (o = t[r]);
          break;
        }
      return n < o ? -1 : o < n ? 1 : 0;
    }),
    (de.isEncoding = function (e) {
      switch (String(e).toLowerCase()) {
        case 'hex':
        case 'utf8':
        case 'utf-8':
        case 'ascii':
        case 'latin1':
        case 'binary':
        case 'base64':
        case 'ucs2':
        case 'ucs-2':
        case 'utf16le':
        case 'utf-16le':
          return !0;
        default:
          return !1;
      }
    }),
    (de.concat = function (e, t) {
      if (!Array.isArray(e))
        throw new TypeError('"list" argument must be an Array of Buffers');
      if (0 === e.length) return de.alloc(0);
      var n;
      if (void 0 === t) for (t = 0, n = 0; n < e.length; ++n) t += e[n].length;
      var o = de.allocUnsafe(t),
        r = 0;
      for (n = 0; n < e.length; ++n) {
        var i = e[n];
        if (Ve(i, Uint8Array))
          r + i.length > o.length
            ? de.from(i).copy(o, r)
            : Uint8Array.prototype.set.call(o, i, r);
        else {
          if (!de.isBuffer(i))
            throw new TypeError('"list" argument must be an Array of Buffers');
          i.copy(o, r);
        }
        r += i.length;
      }
      return o;
    }),
    (de.byteLength = ye),
    (de.prototype._isBuffer = !0),
    (de.prototype.swap16 = function () {
      var e = this.length;
      if (e % 2 != 0)
        throw new RangeError('Buffer size must be a multiple of 16-bits');
      for (var t = 0; t < e; t += 2) we(this, t, t + 1);
      return this;
    }),
    (de.prototype.swap32 = function () {
      var e = this.length;
      if (e % 4 != 0)
        throw new RangeError('Buffer size must be a multiple of 32-bits');
      for (var t = 0; t < e; t += 4) we(this, t, t + 3), we(this, t + 1, t + 2);
      return this;
    }),
    (de.prototype.swap64 = function () {
      var e = this.length;
      if (e % 8 != 0)
        throw new RangeError('Buffer size must be a multiple of 64-bits');
      for (var t = 0; t < e; t += 8)
        we(this, t, t + 7),
          we(this, t + 1, t + 6),
          we(this, t + 2, t + 5),
          we(this, t + 3, t + 4);
      return this;
    }),
    (de.prototype.toString = function () {
      var e = this.length;
      return 0 === e
        ? ''
        : 0 === arguments.length
        ? Re(this, 0, e)
        : ge.apply(this, arguments);
    }),
    (de.prototype.toLocaleString = de.prototype.toString),
    (de.prototype.equals = function (e) {
      if (!de.isBuffer(e)) throw new TypeError('Argument must be a Buffer');
      return this === e || 0 === de.compare(this, e);
    }),
    (de.prototype.inspect = function () {
      var e = '';
      return (
        (e = this.toString('hex', 0, 50)
          .replace(/(.{2})/g, '$1 ')
          .trim()),
        this.length > 50 && (e += ' ... '),
        '<Buffer ' + e + '>'
      );
    }),
    se && (de.prototype[se] = de.prototype.inspect),
    (de.prototype.compare = function (e, t, n, o, r) {
      if (
        (Ve(e, Uint8Array) && (e = de.from(e, e.offset, e.byteLength)),
        !de.isBuffer(e))
      )
        throw new TypeError(
          'The "target" argument must be one of type Buffer or Uint8Array. Received type ' +
            typeof e
        );
      if (
        (void 0 === t && (t = 0),
        void 0 === n && (n = e ? e.length : 0),
        void 0 === o && (o = 0),
        void 0 === r && (r = this.length),
        t < 0 || n > e.length || o < 0 || r > this.length)
      )
        throw new RangeError('out of range index');
      if (o >= r && t >= n) return 0;
      if (o >= r) return -1;
      if (t >= n) return 1;
      if (this === e) return 0;
      for (
        var i = (r >>>= 0) - (o >>>= 0),
          a = (n >>>= 0) - (t >>>= 0),
          s = Math.min(i, a),
          c = this.slice(o, r),
          l = e.slice(t, n),
          d = 0;
        d < s;
        ++d
      )
        if (c[d] !== l[d]) {
          (i = c[d]), (a = l[d]);
          break;
        }
      return i < a ? -1 : a < i ? 1 : 0;
    }),
    (de.prototype.includes = function (e, t, n) {
      return -1 !== this.indexOf(e, t, n);
    }),
    (de.prototype.indexOf = function (e, t, n) {
      return be(this, e, t, n, !0);
    }),
    (de.prototype.lastIndexOf = function (e, t, n) {
      return be(this, e, t, n, !1);
    }),
    (de.prototype.write = function (e, t, n, o) {
      if (void 0 === t) (o = 'utf8'), (n = this.length), (t = 0);
      else if (void 0 === n && 'string' == typeof t)
        (o = t), (n = this.length), (t = 0);
      else {
        if (!isFinite(t))
          throw new Error(
            'Buffer.write(string, encoding, offset[, length]) is no longer supported'
          );
        (t >>>= 0),
          isFinite(n)
            ? ((n >>>= 0), void 0 === o && (o = 'utf8'))
            : ((o = n), (n = void 0));
      }
      var r = this.length - t;
      if (
        ((void 0 === n || n > r) && (n = r),
        (e.length > 0 && (n < 0 || t < 0)) || t > this.length)
      )
        throw new RangeError('Attempt to write outside buffer bounds');
      o || (o = 'utf8');
      for (var i = !1; ; )
        switch (o) {
          case 'hex':
            return _e(this, e, t, n);
          case 'utf8':
          case 'utf-8':
            return Ce(this, e, t, n);
          case 'ascii':
          case 'latin1':
          case 'binary':
            return Ee(this, e, t, n);
          case 'base64':
            return Te(this, e, t, n);
          case 'ucs2':
          case 'ucs-2':
          case 'utf16le':
          case 'utf-16le':
            return Ie(this, e, t, n);
          default:
            if (i) throw new TypeError('Unknown encoding: ' + o);
            (o = ('' + o).toLowerCase()), (i = !0);
        }
    }),
    (de.prototype.toJSON = function () {
      return {
        type: 'Buffer',
        data: Array.prototype.slice.call(this._arr || this, 0),
      };
    });
  var Me = 4096;
  function Ae(e, t, n) {
    var o = '';
    n = Math.min(e.length, n);
    for (var r = t; r < n; ++r) o += String.fromCharCode(127 & e[r]);
    return o;
  }
  function Se(e, t, n) {
    var o = '';
    n = Math.min(e.length, n);
    for (var r = t; r < n; ++r) o += String.fromCharCode(e[r]);
    return o;
  }
  function Le(e, t, n) {
    var o = e.length;
    (!t || t < 0) && (t = 0), (!n || n < 0 || n > o) && (n = o);
    for (var r = '', i = t; i < n; ++i) r += Ge[e[i]];
    return r;
  }
  function Be(e, t, n) {
    for (var o = e.slice(t, n), r = '', i = 0; i < o.length - 1; i += 2)
      r += String.fromCharCode(o[i] + 256 * o[i + 1]);
    return r;
  }
  function Oe(e, t, n) {
    if (e % 1 != 0 || e < 0) throw new RangeError('offset is not uint');
    if (e + t > n)
      throw new RangeError('Trying to access beyond buffer length');
  }
  function ze(e, t, n, o, r, i) {
    if (!de.isBuffer(e))
      throw new TypeError('"buffer" argument must be a Buffer instance');
    if (t > r || t < i)
      throw new RangeError('"value" argument is out of bounds');
    if (n + o > e.length) throw new RangeError('Index out of range');
  }
  function Ne(e, t, n, o, r, i) {
    if (n + o > e.length) throw new RangeError('Index out of range');
    if (n < 0) throw new RangeError('Index out of range');
  }
  function $e(e, t, n, o, r) {
    return (
      (t = +t), (n >>>= 0), r || Ne(e, 0, n, 4), Q(e, t, n, o, 23, 4), n + 4
    );
  }
  function Pe(e, t, n, o, r) {
    return (
      (t = +t), (n >>>= 0), r || Ne(e, 0, n, 8), Q(e, t, n, o, 52, 8), n + 8
    );
  }
  (de.prototype.slice = function (e, t) {
    var n = this.length;
    (e = ~~e) < 0 ? (e += n) < 0 && (e = 0) : e > n && (e = n),
      (t = void 0 === t ? n : ~~t) < 0
        ? (t += n) < 0 && (t = 0)
        : t > n && (t = n),
      t < e && (t = e);
    var o = this.subarray(e, t);
    return Object.setPrototypeOf(o, de.prototype), o;
  }),
    (de.prototype.readUintLE = de.prototype.readUIntLE =
      function (e, t, n) {
        (e >>>= 0), (t >>>= 0), n || Oe(e, t, this.length);
        for (var o = this[e], r = 1, i = 0; ++i < t && (r *= 256); )
          o += this[e + i] * r;
        return o;
      }),
    (de.prototype.readUintBE = de.prototype.readUIntBE =
      function (e, t, n) {
        (e >>>= 0), (t >>>= 0), n || Oe(e, t, this.length);
        for (var o = this[e + --t], r = 1; t > 0 && (r *= 256); )
          o += this[e + --t] * r;
        return o;
      }),
    (de.prototype.readUint8 = de.prototype.readUInt8 =
      function (e, t) {
        return (e >>>= 0), t || Oe(e, 1, this.length), this[e];
      }),
    (de.prototype.readUint16LE = de.prototype.readUInt16LE =
      function (e, t) {
        return (
          (e >>>= 0), t || Oe(e, 2, this.length), this[e] | (this[e + 1] << 8)
        );
      }),
    (de.prototype.readUint16BE = de.prototype.readUInt16BE =
      function (e, t) {
        return (
          (e >>>= 0), t || Oe(e, 2, this.length), (this[e] << 8) | this[e + 1]
        );
      }),
    (de.prototype.readUint32LE = de.prototype.readUInt32LE =
      function (e, t) {
        return (
          (e >>>= 0),
          t || Oe(e, 4, this.length),
          (this[e] | (this[e + 1] << 8) | (this[e + 2] << 16)) +
            16777216 * this[e + 3]
        );
      }),
    (de.prototype.readUint32BE = de.prototype.readUInt32BE =
      function (e, t) {
        return (
          (e >>>= 0),
          t || Oe(e, 4, this.length),
          16777216 * this[e] +
            ((this[e + 1] << 16) | (this[e + 2] << 8) | this[e + 3])
        );
      }),
    (de.prototype.readIntLE = function (e, t, n) {
      (e >>>= 0), (t >>>= 0), n || Oe(e, t, this.length);
      for (var o = this[e], r = 1, i = 0; ++i < t && (r *= 256); )
        o += this[e + i] * r;
      return o >= (r *= 128) && (o -= Math.pow(2, 8 * t)), o;
    }),
    (de.prototype.readIntBE = function (e, t, n) {
      (e >>>= 0), (t >>>= 0), n || Oe(e, t, this.length);
      for (var o = t, r = 1, i = this[e + --o]; o > 0 && (r *= 256); )
        i += this[e + --o] * r;
      return i >= (r *= 128) && (i -= Math.pow(2, 8 * t)), i;
    }),
    (de.prototype.readInt8 = function (e, t) {
      return (
        (e >>>= 0),
        t || Oe(e, 1, this.length),
        128 & this[e] ? -1 * (255 - this[e] + 1) : this[e]
      );
    }),
    (de.prototype.readInt16LE = function (e, t) {
      (e >>>= 0), t || Oe(e, 2, this.length);
      var n = this[e] | (this[e + 1] << 8);
      return 32768 & n ? 4294901760 | n : n;
    }),
    (de.prototype.readInt16BE = function (e, t) {
      (e >>>= 0), t || Oe(e, 2, this.length);
      var n = this[e + 1] | (this[e] << 8);
      return 32768 & n ? 4294901760 | n : n;
    }),
    (de.prototype.readInt32LE = function (e, t) {
      return (
        (e >>>= 0),
        t || Oe(e, 4, this.length),
        this[e] | (this[e + 1] << 8) | (this[e + 2] << 16) | (this[e + 3] << 24)
      );
    }),
    (de.prototype.readInt32BE = function (e, t) {
      return (
        (e >>>= 0),
        t || Oe(e, 4, this.length),
        (this[e] << 24) | (this[e + 1] << 16) | (this[e + 2] << 8) | this[e + 3]
      );
    }),
    (de.prototype.readFloatLE = function (e, t) {
      return (e >>>= 0), t || Oe(e, 4, this.length), X(this, e, !0, 23, 4);
    }),
    (de.prototype.readFloatBE = function (e, t) {
      return (e >>>= 0), t || Oe(e, 4, this.length), X(this, e, !1, 23, 4);
    }),
    (de.prototype.readDoubleLE = function (e, t) {
      return (e >>>= 0), t || Oe(e, 8, this.length), X(this, e, !0, 52, 8);
    }),
    (de.prototype.readDoubleBE = function (e, t) {
      return (e >>>= 0), t || Oe(e, 8, this.length), X(this, e, !1, 52, 8);
    }),
    (de.prototype.writeUintLE = de.prototype.writeUIntLE =
      function (e, t, n, o) {
        ((e = +e), (t >>>= 0), (n >>>= 0), o) ||
          ze(this, e, t, n, Math.pow(2, 8 * n) - 1, 0);
        var r = 1,
          i = 0;
        for (this[t] = 255 & e; ++i < n && (r *= 256); )
          this[t + i] = (e / r) & 255;
        return t + n;
      }),
    (de.prototype.writeUintBE = de.prototype.writeUIntBE =
      function (e, t, n, o) {
        ((e = +e), (t >>>= 0), (n >>>= 0), o) ||
          ze(this, e, t, n, Math.pow(2, 8 * n) - 1, 0);
        var r = n - 1,
          i = 1;
        for (this[t + r] = 255 & e; --r >= 0 && (i *= 256); )
          this[t + r] = (e / i) & 255;
        return t + n;
      }),
    (de.prototype.writeUint8 = de.prototype.writeUInt8 =
      function (e, t, n) {
        return (
          (e = +e),
          (t >>>= 0),
          n || ze(this, e, t, 1, 255, 0),
          (this[t] = 255 & e),
          t + 1
        );
      }),
    (de.prototype.writeUint16LE = de.prototype.writeUInt16LE =
      function (e, t, n) {
        return (
          (e = +e),
          (t >>>= 0),
          n || ze(this, e, t, 2, 65535, 0),
          (this[t] = 255 & e),
          (this[t + 1] = e >>> 8),
          t + 2
        );
      }),
    (de.prototype.writeUint16BE = de.prototype.writeUInt16BE =
      function (e, t, n) {
        return (
          (e = +e),
          (t >>>= 0),
          n || ze(this, e, t, 2, 65535, 0),
          (this[t] = e >>> 8),
          (this[t + 1] = 255 & e),
          t + 2
        );
      }),
    (de.prototype.writeUint32LE = de.prototype.writeUInt32LE =
      function (e, t, n) {
        return (
          (e = +e),
          (t >>>= 0),
          n || ze(this, e, t, 4, 4294967295, 0),
          (this[t + 3] = e >>> 24),
          (this[t + 2] = e >>> 16),
          (this[t + 1] = e >>> 8),
          (this[t] = 255 & e),
          t + 4
        );
      }),
    (de.prototype.writeUint32BE = de.prototype.writeUInt32BE =
      function (e, t, n) {
        return (
          (e = +e),
          (t >>>= 0),
          n || ze(this, e, t, 4, 4294967295, 0),
          (this[t] = e >>> 24),
          (this[t + 1] = e >>> 16),
          (this[t + 2] = e >>> 8),
          (this[t + 3] = 255 & e),
          t + 4
        );
      }),
    (de.prototype.writeIntLE = function (e, t, n, o) {
      if (((e = +e), (t >>>= 0), !o)) {
        var r = Math.pow(2, 8 * n - 1);
        ze(this, e, t, n, r - 1, -r);
      }
      var i = 0,
        a = 1,
        s = 0;
      for (this[t] = 255 & e; ++i < n && (a *= 256); )
        e < 0 && 0 === s && 0 !== this[t + i - 1] && (s = 1),
          (this[t + i] = (((e / a) >> 0) - s) & 255);
      return t + n;
    }),
    (de.prototype.writeIntBE = function (e, t, n, o) {
      if (((e = +e), (t >>>= 0), !o)) {
        var r = Math.pow(2, 8 * n - 1);
        ze(this, e, t, n, r - 1, -r);
      }
      var i = n - 1,
        a = 1,
        s = 0;
      for (this[t + i] = 255 & e; --i >= 0 && (a *= 256); )
        e < 0 && 0 === s && 0 !== this[t + i + 1] && (s = 1),
          (this[t + i] = (((e / a) >> 0) - s) & 255);
      return t + n;
    }),
    (de.prototype.writeInt8 = function (e, t, n) {
      return (
        (e = +e),
        (t >>>= 0),
        n || ze(this, e, t, 1, 127, -128),
        e < 0 && (e = 255 + e + 1),
        (this[t] = 255 & e),
        t + 1
      );
    }),
    (de.prototype.writeInt16LE = function (e, t, n) {
      return (
        (e = +e),
        (t >>>= 0),
        n || ze(this, e, t, 2, 32767, -32768),
        (this[t] = 255 & e),
        (this[t + 1] = e >>> 8),
        t + 2
      );
    }),
    (de.prototype.writeInt16BE = function (e, t, n) {
      return (
        (e = +e),
        (t >>>= 0),
        n || ze(this, e, t, 2, 32767, -32768),
        (this[t] = e >>> 8),
        (this[t + 1] = 255 & e),
        t + 2
      );
    }),
    (de.prototype.writeInt32LE = function (e, t, n) {
      return (
        (e = +e),
        (t >>>= 0),
        n || ze(this, e, t, 4, 2147483647, -2147483648),
        (this[t] = 255 & e),
        (this[t + 1] = e >>> 8),
        (this[t + 2] = e >>> 16),
        (this[t + 3] = e >>> 24),
        t + 4
      );
    }),
    (de.prototype.writeInt32BE = function (e, t, n) {
      return (
        (e = +e),
        (t >>>= 0),
        n || ze(this, e, t, 4, 2147483647, -2147483648),
        e < 0 && (e = 4294967295 + e + 1),
        (this[t] = e >>> 24),
        (this[t + 1] = e >>> 16),
        (this[t + 2] = e >>> 8),
        (this[t + 3] = 255 & e),
        t + 4
      );
    }),
    (de.prototype.writeFloatLE = function (e, t, n) {
      return $e(this, e, t, !0, n);
    }),
    (de.prototype.writeFloatBE = function (e, t, n) {
      return $e(this, e, t, !1, n);
    }),
    (de.prototype.writeDoubleLE = function (e, t, n) {
      return Pe(this, e, t, !0, n);
    }),
    (de.prototype.writeDoubleBE = function (e, t, n) {
      return Pe(this, e, t, !1, n);
    }),
    (de.prototype.copy = function (e, t, n, o) {
      if (!de.isBuffer(e)) throw new TypeError('argument should be a Buffer');
      if (
        (n || (n = 0),
        o || 0 === o || (o = this.length),
        t >= e.length && (t = e.length),
        t || (t = 0),
        o > 0 && o < n && (o = n),
        o === n)
      )
        return 0;
      if (0 === e.length || 0 === this.length) return 0;
      if (t < 0) throw new RangeError('targetStart out of bounds');
      if (n < 0 || n >= this.length) throw new RangeError('Index out of range');
      if (o < 0) throw new RangeError('sourceEnd out of bounds');
      o > this.length && (o = this.length),
        e.length - t < o - n && (o = e.length - t + n);
      var r = o - n;
      return (
        this === e && 'function' == typeof Uint8Array.prototype.copyWithin
          ? this.copyWithin(t, n, o)
          : Uint8Array.prototype.set.call(e, this.subarray(n, o), t),
        r
      );
    }),
    (de.prototype.fill = function (e, t, n, o) {
      if ('string' == typeof e) {
        if (
          ('string' == typeof t
            ? ((o = t), (t = 0), (n = this.length))
            : 'string' == typeof n && ((o = n), (n = this.length)),
          void 0 !== o && 'string' != typeof o)
        )
          throw new TypeError('encoding must be a string');
        if ('string' == typeof o && !de.isEncoding(o))
          throw new TypeError('Unknown encoding: ' + o);
        if (1 === e.length) {
          var r = e.charCodeAt(0);
          (('utf8' === o && r < 128) || 'latin1' === o) && (e = r);
        }
      } else
        'number' == typeof e
          ? (e &= 255)
          : 'boolean' == typeof e && (e = Number(e));
      if (t < 0 || this.length < t || this.length < n)
        throw new RangeError('Out of range index');
      if (n <= t) return this;
      var i;
      if (
        ((t >>>= 0),
        (n = void 0 === n ? this.length : n >>> 0),
        e || (e = 0),
        'number' == typeof e)
      )
        for (i = t; i < n; ++i) this[i] = e;
      else {
        var a = de.isBuffer(e) ? e : de.from(e, o),
          s = a.length;
        if (0 === s)
          throw new TypeError(
            'The value "' + e + '" is invalid for argument "value"'
          );
        for (i = 0; i < n - t; ++i) this[i + t] = a[i % s];
      }
      return this;
    });
  var je = /[^+/0-9A-Za-z-_]/g;
  function Fe(e, t) {
    var n;
    t = t || 1 / 0;
    for (var o = e.length, r = null, i = [], a = 0; a < o; ++a) {
      if ((n = e.charCodeAt(a)) > 55295 && n < 57344) {
        if (!r) {
          if (n > 56319) {
            (t -= 3) > -1 && i.push(239, 191, 189);
            continue;
          }
          if (a + 1 === o) {
            (t -= 3) > -1 && i.push(239, 191, 189);
            continue;
          }
          r = n;
          continue;
        }
        if (n < 56320) {
          (t -= 3) > -1 && i.push(239, 191, 189), (r = n);
          continue;
        }
        n = 65536 + (((r - 55296) << 10) | (n - 56320));
      } else r && (t -= 3) > -1 && i.push(239, 191, 189);
      if (((r = null), n < 128)) {
        if ((t -= 1) < 0) break;
        i.push(n);
      } else if (n < 2048) {
        if ((t -= 2) < 0) break;
        i.push((n >> 6) | 192, (63 & n) | 128);
      } else if (n < 65536) {
        if ((t -= 3) < 0) break;
        i.push((n >> 12) | 224, ((n >> 6) & 63) | 128, (63 & n) | 128);
      } else {
        if (!(n < 1114112)) throw new Error('Invalid code point');
        if ((t -= 4) < 0) break;
        i.push(
          (n >> 18) | 240,
          ((n >> 12) & 63) | 128,
          ((n >> 6) & 63) | 128,
          (63 & n) | 128
        );
      }
    }
    return i;
  }
  function Ue(e) {
    return Y(
      (function (e) {
        if ((e = (e = e.split('=')[0]).trim().replace(je, '')).length < 2)
          return '';
        for (; e.length % 4 != 0; ) e += '=';
        return e;
      })(e)
    );
  }
  function De(e, t, n, o) {
    for (var r = 0; r < o && !(r + n >= t.length || r >= e.length); ++r)
      t[r + n] = e[r];
    return r;
  }
  function Ve(e, t) {
    return (
      e instanceof t ||
      (null != e &&
        null != e.constructor &&
        null != e.constructor.name &&
        e.constructor.name === t.name)
    );
  }
  function He(e) {
    return e != e;
  }
  var Ge = (function () {
      for (var e = '0123456789abcdef', t = new Array(256), n = 0; n < 16; ++n)
        for (var o = 16 * n, r = 0; r < 16; ++r) t[o + r] = e[n] + e[r];
      return t;
    })(),
    qe = J,
    We = (e, t, n) => {
      const o = {
        haystack: e,
        context: n.context,
      };
      if (void 0 !== n.beforeFn) {
        const e = n.beforeFn(o);
        void 0 !== e && (o.haystack = e);
      }
      const r = [!1, [t], null, 0],
        i = [],
        a = [];
      let s,
        c,
        l,
        d,
        u = o.haystack;
      const h = {
          getKey: () => W(i, n),
          get key() {
            return h.getKey();
          },
          getValue: () => u,
          get value() {
            return h.getValue();
          },
          getEntry: () => [W(i, n), u],
          get entry() {
            return h.getEntry();
          },
          getIsMatch: () => d,
          get isMatch() {
            return h.getIsMatch();
          },
          getMatchedBy: () => ((e) => G(e, 'leafNeedlesMatch'))(l),
          get matchedBy() {
            return h.getMatchedBy();
          },
          getExcludedBy: () => ((e) => G(e, 'leafNeedlesExclude'))(l),
          get excludedBy() {
            return h.getExcludedBy();
          },
          getTraversedBy: () => ((e) => G(e, 'needles'))(l),
          get traversedBy() {
            return h.getTraversedBy();
          },
          getGproperty: () => i[i.length - 2],
          get gproperty() {
            return h.getGproperty();
          },
          getProperty: () => i[i.length - 1],
          get property() {
            return h.getProperty();
          },
          getGparent: () => a[a.length - 2],
          get gparent() {
            return h.getGparent();
          },
          getParent: () => a[a.length - 1],
          get parent() {
            return h.getParent();
          },
          getParents: () => [...a].reverse(),
          get parents() {
            return h.getParents();
          },
          getIsCircular: () => a.includes(u),
          get isCircular() {
            return h.getIsCircular();
          },
          getIsLeaf: () => !(u instanceof Object),
          get isLeaf() {
            return h.getIsLeaf();
          },
          getDepth: () => i.length,
          get depth() {
            return h.getDepth();
          },
          get result() {
            return h.getResult();
          },
          context: o.context,
        },
        m = ((e, t) => {
          if ('context' === t.rtn)
            return {
              onMatch: () => {},
              get: () => e.context,
            };
          if ('bool' === t.rtn) {
            let e = !1;
            return {
              onMatch: () => {
                e = !0;
              },
              get: () => e,
            };
          }
          if ('count' === t.rtn) {
            let e = 0;
            return {
              onMatch: () => {
                e += 1;
              },
              get: () => e,
            };
          }
          if ('sum' === t.rtn) {
            let e = 0;
            return {
              onMatch: ({ value: t }) => {
                e += t;
              },
              get: () => e,
            };
          }
          const n = [];
          return {
            onMatch:
              'function' == typeof t.rtn
                ? () => n.push(t.rtn(e))
                : Array.isArray(t.rtn)
                ? () => n.push(t.rtn.map((t) => e[t]))
                : () => n.push(e[t.rtn]),
            get: () => (t.abort ? n[0] : n),
          };
        })(h, n);
      if (
        ((h.getResult = () => m.get()),
        n.useArraySelector || !Array.isArray(o.haystack))
      ) {
        const e = t.get('');
        void 0 !== e && r[1].push(e);
      }
      do {
        (s = r.pop()), (c = r.pop()), (l = r.pop()), (d = r.pop());
        const e = i.length - s;
        for (let t = 0; t < e; t += 1) a.pop(), i.pop();
        if (
          (-1 === e
            ? (a.push(u), i.push(c), (u = u[c]))
            : null !== c
            ? ((i[i.length - 1] = c), (u = a[a.length - 1][c]))
            : (u = o.haystack),
          d)
        ) {
          (void 0 !== n.filterFn && !1 === n.filterFn(h)) ||
            (m.onMatch(h), n.abort && (r.length = 0));
          continue;
        }
        if (!l.some(({ matches: e }) => e)) continue;
        const p = !1 === n.useArraySelector && Array.isArray(u);
        if (
          (!p && q(l) && (r.push(!0, l, c, s), (d = !0)),
          (void 0 === n.breakFn || !0 !== n.breakFn(h)) && u instanceof Object)
        ) {
          const e = Array.isArray(u),
            o = Object.keys(u);
          !e && n.compareFn && o.sort(n.compareFn(h)), n.reverse || o.reverse();
          for (let i = 0, a = o.length; i < a; i += 1) {
            const a = o[i],
              c = [];
            if (p) c.push(...l), 0 === s && c.push(...t.roots);
            else
              for (let t = 0, n = l.length; t !== n; t += 1) {
                const n = l[t];
                n.recMatch(a) && c.push(n);
                const { children: o } = n;
                let r = o.length;
                for (; r--; ) {
                  const t = o[r];
                  t.typeMatch(a, e) && c.push(t);
                }
              }
            if (n.orderByNeedles) {
              c.index = qe.from(c.map(({ order: e }) => e).sort());
              let t = r.length - 3;
              const n = t - 4 * i;
              for (; t !== n && 1 === qe.compare(c.index, r[t].index); ) t -= 4;
              r.splice(t + 3, 0, !1, c, e ? Number(a) : a, s + 1);
            } else r.push(!1, c, e ? Number(a) : a, s + 1);
          }
        }
      } while (0 !== r.length);
      if (((o.result = m.get()), void 0 !== n.afterFn)) {
        const e = n.afterFn(o);
        void 0 !== e && (o.result = e);
      }
      return o.result;
    };
  const Je = (e, t, n) => {
    R(
      n.includes(typeof e[t]),
      () => `Option "${t}" not one of [${n.join(', ')}]`
    );
  };
  // https://github.com/blackflux/object-scan
  var objectScan = (e, t = {}) => {
      if (
        (R(Array.isArray(e), 'Argument "needles" expected to be Array'),
        R(
          t instanceof Object && !Array.isArray(t),
          'Argument "opts" expected to be Object'
        ),
        0 === e.length)
      )
        return (e, t) => (void 0 === t ? [] : t);
      const n = ((e) => {
          const t = {
            filterFn: void 0,
            breakFn: void 0,
            beforeFn: void 0,
            afterFn: void 0,
            compareFn: void 0,
            reverse: !0,
            orderByNeedles: !1,
            abort: !1,
            rtn: void 0,
            joined: !1,
            useArraySelector: !0,
            strict: !0,
            ...e,
          };
          return (
            R(12 === Object.keys(t).length, 'Unexpected Option provided'),
            Je(t, 'filterFn', ['function', 'undefined']),
            Je(t, 'breakFn', ['function', 'undefined']),
            Je(t, 'beforeFn', ['function', 'undefined']),
            Je(t, 'afterFn', ['function', 'undefined']),
            Je(t, 'compareFn', ['function', 'undefined']),
            Je(t, 'reverse', ['boolean']),
            Je(t, 'orderByNeedles', ['boolean']),
            Je(t, 'abort', ['boolean']),
            R(
              ('function' == typeof t.rtn && 1 === t.rtn.length) ||
                [
                  void 0,
                  'context',
                  'key',
                  'value',
                  'entry',
                  'property',
                  'gproperty',
                  'parent',
                  'gparent',
                  'parents',
                  'isMatch',
                  'matchedBy',
                  'excludedBy',
                  'traversedBy',
                  'isCircular',
                  'isLeaf',
                  'depth',
                  'bool',
                  'count',
                  'sum',
                ].includes(t.rtn) ||
                (Array.isArray(t.rtn) &&
                  t.rtn.every((e) =>
                    [
                      'key',
                      'value',
                      'entry',
                      'property',
                      'gproperty',
                      'parent',
                      'gparent',
                      'parents',
                      'isMatch',
                      'matchedBy',
                      'excludedBy',
                      'traversedBy',
                      'isCircular',
                      'isLeaf',
                      'depth',
                    ].includes(e)
                  )),
              'Option "rtn" is malformed'
            ),
            Je(t, 'joined', ['boolean']),
            Je(t, 'useArraySelector', ['boolean']),
            Je(t, 'strict', ['boolean']),
            t
          );
        })(t),
        o = ((e, t) => {
          (t.counter = 0),
            (t.links = []),
            (t.nodes = []),
            (t.regex = Object.create(null));
          const n = new V('*', t);
          for (let o = 0; o < e.length; o += 1) {
            const r = e[o],
              i = [z(r, t)];
            H(n, r, i, t);
          }
          return (
            ((e, t) => {
              const { links: n } = t;
              for (; 0 !== n.length; ) {
                const e = n.pop(),
                  t = n.pop(),
                  { children: o } = t;
                t.children = [
                  ...e.children.filter((e) => !o.includes(e)),
                  ...o,
                ];
              }
              !1 === t.useArraySelector &&
                e.setRoots(
                  e.children.filter(
                    ({ isStarRec: e, value: t }) => e || '' === t
                  )
                );
              const { nodes: o } = t;
              for (; 0 !== o.length; ) {
                const e = o.pop(),
                  { children: t } = e;
                t.reverse(), t.some(({ matches: e }) => e) && e.markMatches();
              }
            })(n, t),
            n
          );
        })(e, n);
      return (e, t) =>
        We(e, o, {
          context: t,
          ...n,
          rtn: n.rtn || (void 0 === t ? 'key' : 'context'),
        });
    },
    Ke = {};
  Object.defineProperty(Ke, '__esModule', {
    value: !0,
  });
  var Xe = {},
    Qe = Object.prototype.hasOwnProperty,
    Ze = '~';
  function et() {}
  function tt(e, t, n) {
    (this.fn = e), (this.context = t), (this.once = n || !1);
  }
  function nt(e, t, n, o, r) {
    if ('function' != typeof n)
      throw new TypeError('The listener must be a function');
    var i = new tt(n, o || e, r),
      a = Ze ? Ze + t : t;
    return (
      e._events[a]
        ? e._events[a].fn
          ? (e._events[a] = [e._events[a], i])
          : e._events[a].push(i)
        : ((e._events[a] = i), e._eventsCount++),
      e
    );
  }
  function ot(e, t) {
    0 == --e._eventsCount ? (e._events = new et()) : delete e._events[t];
  }
  function rt() {
    (this._events = new et()), (this._eventsCount = 0);
  }
  Object.create &&
    ((et.prototype = Object.create(null)), new et().__proto__ || (Ze = !1)),
    (rt.prototype.eventNames = function () {
      var e,
        t,
        n = [];
      if (0 === this._eventsCount) return n;
      for (t in (e = this._events))
        Qe.call(e, t) && n.push(Ze ? t.slice(1) : t);
      return Object.getOwnPropertySymbols
        ? n.concat(Object.getOwnPropertySymbols(e))
        : n;
    }),
    (rt.prototype.listeners = function (e) {
      var t = Ze ? Ze + e : e,
        n = this._events[t];
      if (!n) return [];
      if (n.fn) return [n.fn];
      for (var o = 0, r = n.length, i = new Array(r); o < r; o++)
        i[o] = n[o].fn;
      return i;
    }),
    (rt.prototype.listenerCount = function (e) {
      var t = Ze ? Ze + e : e,
        n = this._events[t];
      return n ? (n.fn ? 1 : n.length) : 0;
    }),
    (rt.prototype.emit = function (e, t, n, o, r, i) {
      var a = Ze ? Ze + e : e;
      if (!this._events[a]) return !1;
      var s,
        c,
        l = this._events[a],
        d = arguments.length;
      if (l.fn) {
        switch ((l.once && this.removeListener(e, l.fn, void 0, !0), d)) {
          case 1:
            return l.fn.call(l.context), !0;
          case 2:
            return l.fn.call(l.context, t), !0;
          case 3:
            return l.fn.call(l.context, t, n), !0;
          case 4:
            return l.fn.call(l.context, t, n, o), !0;
          case 5:
            return l.fn.call(l.context, t, n, o, r), !0;
          case 6:
            return l.fn.call(l.context, t, n, o, r, i), !0;
        }
        for (c = 1, s = new Array(d - 1); c < d; c++) s[c - 1] = arguments[c];
        l.fn.apply(l.context, s);
      } else {
        var u,
          h = l.length;
        for (c = 0; c < h; c++)
          switch (
            (l[c].once && this.removeListener(e, l[c].fn, void 0, !0), d)
          ) {
            case 1:
              l[c].fn.call(l[c].context);
              break;
            case 2:
              l[c].fn.call(l[c].context, t);
              break;
            case 3:
              l[c].fn.call(l[c].context, t, n);
              break;
            case 4:
              l[c].fn.call(l[c].context, t, n, o);
              break;
            default:
              if (!s)
                for (u = 1, s = new Array(d - 1); u < d; u++)
                  s[u - 1] = arguments[u];
              l[c].fn.apply(l[c].context, s);
          }
      }
      return !0;
    }),
    (rt.prototype.on = function (e, t, n) {
      return nt(this, e, t, n, !1);
    }),
    (rt.prototype.once = function (e, t, n) {
      return nt(this, e, t, n, !0);
    }),
    (rt.prototype.removeListener = function (e, t, n, o) {
      var r = Ze ? Ze + e : e;
      if (!this._events[r]) return this;
      if (!t) return ot(this, r), this;
      var i = this._events[r];
      if (i.fn)
        i.fn !== t || (o && !i.once) || (n && i.context !== n) || ot(this, r);
      else {
        for (var a = 0, s = [], c = i.length; a < c; a++)
          (i[a].fn !== t || (o && !i[a].once) || (n && i[a].context !== n)) &&
            s.push(i[a]);
        s.length ? (this._events[r] = 1 === s.length ? s[0] : s) : ot(this, r);
      }
      return this;
    }),
    (rt.prototype.removeAllListeners = function (e) {
      var t;
      return (
        e
          ? ((t = Ze ? Ze + e : e), this._events[t] && ot(this, t))
          : ((this._events = new et()), (this._eventsCount = 0)),
        this
      );
    }),
    (rt.prototype.off = rt.prototype.removeListener),
    (rt.prototype.addListener = rt.prototype.on),
    (rt.prefixed = Ze),
    (rt.EventEmitter = rt),
    (Xe = rt);
  var it,
    at = {};
  it = (e, t) => (
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
  class st extends Error {
    constructor(e) {
      super(e), (this.name = 'TimeoutError');
    }
  }
  const ct = (e, t, n) =>
    new Promise((o, r) => {
      if ('number' != typeof t || t < 0)
        throw new TypeError('Expected `milliseconds` to be a positive number');
      if (t === 1 / 0) return void o(e);
      const i = setTimeout(() => {
        if ('function' == typeof n) {
          try {
            o(n());
          } catch (e) {
            r(e);
          }
          return;
        }
        const i =
          n instanceof Error
            ? n
            : new st(
                'string' == typeof n
                  ? n
                  : `Promise timed out after ${t} milliseconds`
              );
        'function' == typeof e.cancel && e.cancel(), r(i);
      }, t);
      it(e.then(o, r), () => {
        clearTimeout(i);
      });
    });
  ((at = ct).default = ct), (at.TimeoutError = st);
  var lt = {};
  Object.defineProperty(lt, '__esModule', {
    value: !0,
  });
  var dt = {};
  Object.defineProperty(dt, '__esModule', {
    value: !0,
  }),
    (dt.default = function (e, t, n) {
      let o = 0,
        r = e.length;
      for (; r > 0; ) {
        const i = (r / 2) | 0;
        let a = o + i;
        n(e[a], t) <= 0 ? ((o = ++a), (r -= i + 1)) : (r = i);
      }
      return o;
    });
  lt.default = class {
    constructor() {
      this._queue = [];
    }
    enqueue(e, t) {
      const n = {
        priority: (t = Object.assign(
          {
            priority: 0,
          },
          t
        )).priority,
        run: e,
      };
      if (this.size && this._queue[this.size - 1].priority >= t.priority)
        return void this._queue.push(n);
      const o = dt.default(this._queue, n, (e, t) => t.priority - e.priority);
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
  const ut = () => {},
    ht = new at.TimeoutError();
  Ke.default = class extends Xe {
    constructor(e) {
      var t, n, o, r;
      if (
        (super(),
        (this._intervalCount = 0),
        (this._intervalEnd = 0),
        (this._pendingCount = 0),
        (this._resolveEmpty = ut),
        (this._resolveIdle = ut),
        !(
          'number' ==
            typeof (e = Object.assign(
              {
                carryoverConcurrencyCount: !1,
                intervalCap: 1 / 0,
                interval: 0,
                concurrency: 1 / 0,
                autoStart: !0,
                queueClass: lt.default,
              },
              e
            )).intervalCap && e.intervalCap >= 1
        ))
      )
        throw new TypeError(
          `Expected \`intervalCap\` to be a number from 1 and up, got \`${
            null !==
              (n =
                null === (t = e.intervalCap) || void 0 === t
                  ? void 0
                  : t.toString()) && void 0 !== n
              ? n
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
              (r =
                null === (o = e.interval) || void 0 === o
                  ? void 0
                  : o.toString()) && void 0 !== r
              ? r
              : ''
          }\` (${typeof e.interval})`
        );
      (this._carryoverConcurrencyCount = e.carryoverConcurrencyCount),
        (this._isIntervalIgnored = e.intervalCap === 1 / 0 || 0 === e.interval),
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
      return this._isIntervalIgnored || this._intervalCount < this._intervalCap;
    }
    get _doesConcurrentAllowAnother() {
      return this._pendingCount < this._concurrency;
    }
    _next() {
      this._pendingCount--, this._tryToStartAnother(), this.emit('next');
    }
    _resolvePromises() {
      this._resolveEmpty(),
        (this._resolveEmpty = ut),
        0 === this._pendingCount &&
          (this._resolveIdle(), (this._resolveIdle = ut), this.emit('idle'));
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
      return new Promise((n, o) => {
        this._queue.enqueue(async () => {
          this._pendingCount++, this._intervalCount++;
          try {
            const r =
              void 0 === this._timeout && void 0 === t.timeout
                ? e()
                : at.default(
                    Promise.resolve(e()),
                    void 0 === t.timeout ? this._timeout : t.timeout,
                    () => {
                      (void 0 === t.throwOnTimeout
                        ? this._throwOnTimeout
                        : t.throwOnTimeout) && o(ht);
                    }
                  );
            n(await r);
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
  var mt,
    pt = {};
  const ft = (e) =>
      e && e.includeBoundaries
        ? '(?:(?<=\\s|^)(?=[a-fA-F\\d:])|(?<=[a-fA-F\\d:])(?=\\s|$))'
        : '',
    vt =
      '(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]\\d|\\d)(?:\\.(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]\\d|\\d)){3}',
    yt =
      `\n(?:\n(?:[a-fA-F\\d]{1,4}:){7}(?:[a-fA-F\\d]{1,4}|:)|                                    // 1:2:3:4:5:6:7::  1:2:3:4:5:6:7:8\n(?:[a-fA-F\\d]{1,4}:){6}(?:${vt}|:[a-fA-F\\d]{1,4}|:)|                             // 1:2:3:4:5:6::    1:2:3:4:5:6::8   1:2:3:4:5:6::8  1:2:3:4:5:6::1.2.3.4\n(?:[a-fA-F\\d]{1,4}:){5}(?::${vt}|(?::[a-fA-F\\d]{1,4}){1,2}|:)|                   // 1:2:3:4:5::      1:2:3:4:5::7:8   1:2:3:4:5::8    1:2:3:4:5::7:1.2.3.4\n(?:[a-fA-F\\d]{1,4}:){4}(?:(?::[a-fA-F\\d]{1,4}){0,1}:${vt}|(?::[a-fA-F\\d]{1,4}){1,3}|:)| // 1:2:3:4::        1:2:3:4::6:7:8   1:2:3:4::8      1:2:3:4::6:7:1.2.3.4\n(?:[a-fA-F\\d]{1,4}:){3}(?:(?::[a-fA-F\\d]{1,4}){0,2}:${vt}|(?::[a-fA-F\\d]{1,4}){1,4}|:)| // 1:2:3::          1:2:3::5:6:7:8   1:2:3::8        1:2:3::5:6:7:1.2.3.4\n(?:[a-fA-F\\d]{1,4}:){2}(?:(?::[a-fA-F\\d]{1,4}){0,3}:${vt}|(?::[a-fA-F\\d]{1,4}){1,5}|:)| // 1:2::            1:2::4:5:6:7:8   1:2::8          1:2::4:5:6:7:1.2.3.4\n(?:[a-fA-F\\d]{1,4}:){1}(?:(?::[a-fA-F\\d]{1,4}){0,4}:${vt}|(?::[a-fA-F\\d]{1,4}){1,6}|:)| // 1::              1::3:4:5:6:7:8   1::8            1::3:4:5:6:7:1.2.3.4\n(?::(?:(?::[a-fA-F\\d]{1,4}){0,5}:${vt}|(?::[a-fA-F\\d]{1,4}){1,7}|:))             // ::2:3:4:5:6:7:8  ::2:3:4:5:6:7:8  ::8             ::1.2.3.4\n)(?:%[0-9a-zA-Z]{1,})?                                             // %eth0            %1\n`
        .replace(/\s*\/\/.*$/gm, '')
        .replace(/\n/g, '')
        .trim(),
    gt = new RegExp(`(?:^${vt}$)|(?:^${yt}$)`),
    wt = new RegExp(`^${vt}$`),
    bt = new RegExp(`^${yt}$`),
    xt = (e) =>
      e && e.exact
        ? gt
        : new RegExp(
            `(?:${ft(e)}${vt}${ft(e)})|(?:${ft(e)}${yt}${ft(e)})`,
            'g'
          );
  (xt.v4 = (e) =>
    e && e.exact ? wt : new RegExp(`${ft(e)}${vt}${ft(e)}`, 'g')),
    (xt.v6 = (e) =>
      e && e.exact ? bt : new RegExp(`${ft(e)}${yt}${ft(e)}`, 'g')),
    (pt = xt);
  var _t = {};
  (_t = JSON.parse(
    '["aaa","aarp","abarth","abb","abbott","abbvie","abc","able","abogado","abudhabi","ac","academy","accenture","accountant","accountants","aco","actor","ad","adac","ads","adult","ae","aeg","aero","aetna","af","afl","africa","ag","agakhan","agency","ai","aig","airbus","airforce","airtel","akdn","al","alfaromeo","alibaba","alipay","allfinanz","allstate","ally","alsace","alstom","am","amazon","americanexpress","americanfamily","amex","amfam","amica","amsterdam","analytics","android","anquan","anz","ao","aol","apartments","app","apple","aq","aquarelle","ar","arab","aramco","archi","army","arpa","art","arte","as","asda","asia","associates","at","athleta","attorney","au","auction","audi","audible","audio","auspost","author","auto","autos","avianca","aw","aws","ax","axa","az","azure","ba","baby","baidu","banamex","bananarepublic","band","bank","bar","barcelona","barclaycard","barclays","barefoot","bargains","baseball","basketball","bauhaus","bayern","bb","bbc","bbt","bbva","bcg","bcn","bd","be","beats","beauty","beer","bentley","berlin","best","bestbuy","bet","bf","bg","bh","bharti","bi","bible","bid","bike","bing","bingo","bio","biz","bj","black","blackfriday","blockbuster","blog","bloomberg","blue","bm","bms","bmw","bn","bnpparibas","bo","boats","boehringer","bofa","bom","bond","boo","book","booking","bosch","bostik","boston","bot","boutique","box","br","bradesco","bridgestone","broadway","broker","brother","brussels","bs","bt","bugatti","build","builders","business","buy","buzz","bv","bw","by","bz","bzh","ca","cab","cafe","cal","call","calvinklein","cam","camera","camp","cancerresearch","canon","capetown","capital","capitalone","car","caravan","cards","care","career","careers","cars","casa","case","cash","casino","cat","catering","catholic","cba","cbn","cbre","cbs","cc","cd","center","ceo","cern","cf","cfa","cfd","cg","ch","chanel","channel","charity","chase","chat","cheap","chintai","christmas","chrome","church","ci","cipriani","circle","cisco","citadel","citi","citic","city","cityeats","ck","cl","claims","cleaning","click","clinic","clinique","clothing","cloud","club","clubmed","cm","cn","co","coach","codes","coffee","college","cologne","com","comcast","commbank","community","company","compare","computer","comsec","condos","construction","consulting","contact","contractors","cooking","cookingchannel","cool","coop","corsica","country","coupon","coupons","courses","cpa","cr","credit","creditcard","creditunion","cricket","crown","crs","cruise","cruises","cu","cuisinella","cv","cw","cx","cy","cymru","cyou","cz","dabur","dad","dance","data","date","dating","datsun","day","dclk","dds","de","deal","dealer","deals","degree","delivery","dell","deloitte","delta","democrat","dental","dentist","desi","design","dev","dhl","diamonds","diet","digital","direct","directory","discount","discover","dish","diy","dj","dk","dm","dnp","do","docs","doctor","dog","domains","dot","download","drive","dtv","dubai","dunlop","dupont","durban","dvag","dvr","dz","earth","eat","ec","eco","edeka","edu","education","ee","eg","email","emerck","energy","engineer","engineering","enterprises","epson","equipment","er","ericsson","erni","es","esq","estate","et","etisalat","eu","eurovision","eus","events","exchange","expert","exposed","express","extraspace","fage","fail","fairwinds","faith","family","fan","fans","farm","farmers","fashion","fast","fedex","feedback","ferrari","ferrero","fi","fiat","fidelity","fido","film","final","finance","financial","fire","firestone","firmdale","fish","fishing","fit","fitness","fj","fk","flickr","flights","flir","florist","flowers","fly","fm","fo","foo","food","foodnetwork","football","ford","forex","forsale","forum","foundation","fox","fr","free","fresenius","frl","frogans","frontdoor","frontier","ftr","fujitsu","fun","fund","furniture","futbol","fyi","ga","gal","gallery","gallo","gallup","game","games","gap","garden","gay","gb","gbiz","gd","gdn","ge","gea","gent","genting","george","gf","gg","ggee","gh","gi","gift","gifts","gives","giving","gl","glass","gle","global","globo","gm","gmail","gmbh","gmo","gmx","gn","godaddy","gold","goldpoint","golf","goo","goodyear","goog","google","gop","got","gov","gp","gq","gr","grainger","graphics","gratis","green","gripe","grocery","group","gs","gt","gu","guardian","gucci","guge","guide","guitars","guru","gw","gy","hair","hamburg","hangout","haus","hbo","hdfc","hdfcbank","health","healthcare","help","helsinki","here","hermes","hgtv","hiphop","hisamitsu","hitachi","hiv","hk","hkt","hm","hn","hockey","holdings","holiday","homedepot","homegoods","homes","homesense","honda","horse","hospital","host","hosting","hot","hoteles","hotels","hotmail","house","how","hr","hsbc","ht","hu","hughes","hyatt","hyundai","ibm","icbc","ice","icu","id","ie","ieee","ifm","ikano","il","im","imamat","imdb","immo","immobilien","in","inc","industries","infiniti","info","ing","ink","institute","insurance","insure","int","international","intuit","investments","io","ipiranga","iq","ir","irish","is","ismaili","ist","istanbul","it","itau","itv","jaguar","java","jcb","je","jeep","jetzt","jewelry","jio","jll","jm","jmp","jnj","jo","jobs","joburg","jot","joy","jp","jpmorgan","jprs","juegos","juniper","kaufen","kddi","ke","kerryhotels","kerrylogistics","kerryproperties","kfh","kg","kh","ki","kia","kids","kim","kinder","kindle","kitchen","kiwi","km","kn","koeln","komatsu","kosher","kp","kpmg","kpn","kr","krd","kred","kuokgroup","kw","ky","kyoto","kz","la","lacaixa","lamborghini","lamer","lancaster","lancia","land","landrover","lanxess","lasalle","lat","latino","latrobe","law","lawyer","lb","lc","lds","lease","leclerc","lefrak","legal","lego","lexus","lgbt","li","lidl","life","lifeinsurance","lifestyle","lighting","like","lilly","limited","limo","lincoln","linde","link","lipsy","live","living","lk","llc","llp","loan","loans","locker","locus","loft","lol","london","lotte","lotto","love","lpl","lplfinancial","lr","ls","lt","ltd","ltda","lu","lundbeck","luxe","luxury","lv","ly","ma","macys","madrid","maif","maison","makeup","man","management","mango","map","market","marketing","markets","marriott","marshalls","maserati","mattel","mba","mc","mckinsey","md","me","med","media","meet","melbourne","meme","memorial","men","menu","merckmsd","mg","mh","miami","microsoft","mil","mini","mint","mit","mitsubishi","mk","ml","mlb","mls","mm","mma","mn","mo","mobi","mobile","moda","moe","moi","mom","monash","money","monster","mormon","mortgage","moscow","moto","motorcycles","mov","movie","mp","mq","mr","ms","msd","mt","mtn","mtr","mu","museum","music","mutual","mv","mw","mx","my","mz","na","nab","nagoya","name","natura","navy","nba","nc","ne","nec","net","netbank","netflix","network","neustar","new","news","next","nextdirect","nexus","nf","nfl","ng","ngo","nhk","ni","nico","nike","nikon","ninja","nissan","nissay","nl","no","nokia","northwesternmutual","norton","now","nowruz","nowtv","np","nr","nra","nrw","ntt","nu","nyc","nz","obi","observer","office","okinawa","olayan","olayangroup","oldnavy","ollo","om","omega","one","ong","onl","online","ooo","open","oracle","orange","org","organic","origins","osaka","otsuka","ott","ovh","pa","page","panasonic","paris","pars","partners","parts","party","passagens","pay","pccw","pe","pet","pf","pfizer","pg","ph","pharmacy","phd","philips","phone","photo","photography","photos","physio","pics","pictet","pictures","pid","pin","ping","pink","pioneer","pizza","pk","pl","place","play","playstation","plumbing","plus","pm","pn","pnc","pohl","poker","politie","porn","post","pr","pramerica","praxi","press","prime","pro","prod","productions","prof","progressive","promo","properties","property","protection","pru","prudential","ps","pt","pub","pw","pwc","py","qa","qpon","quebec","quest","racing","radio","re","read","realestate","realtor","realty","recipes","red","redstone","redumbrella","rehab","reise","reisen","reit","reliance","ren","rent","rentals","repair","report","republican","rest","restaurant","review","reviews","rexroth","rich","richardli","ricoh","ril","rio","rip","ro","rocher","rocks","rodeo","rogers","room","rs","rsvp","ru","rugby","ruhr","run","rw","rwe","ryukyu","sa","saarland","safe","safety","sakura","sale","salon","samsclub","samsung","sandvik","sandvikcoromant","sanofi","sap","sarl","sas","save","saxo","sb","sbi","sbs","sc","sca","scb","schaeffler","schmidt","scholarships","school","schule","schwarz","science","scot","sd","se","search","seat","secure","security","seek","select","sener","services","ses","seven","sew","sex","sexy","sfr","sg","sh","shangrila","sharp","shaw","shell","shia","shiksha","shoes","shop","shopping","shouji","show","showtime","si","silk","sina","singles","site","sj","sk","ski","skin","sky","skype","sl","sling","sm","smart","smile","sn","sncf","so","soccer","social","softbank","software","sohu","solar","solutions","song","sony","soy","spa","space","sport","spot","sr","srl","ss","st","stada","staples","star","statebank","statefarm","stc","stcgroup","stockholm","storage","store","stream","studio","study","style","su","sucks","supplies","supply","support","surf","surgery","suzuki","sv","swatch","swiss","sx","sy","sydney","systems","sz","tab","taipei","talk","taobao","target","tatamotors","tatar","tattoo","tax","taxi","tc","tci","td","tdk","team","tech","technology","tel","temasek","tennis","teva","tf","tg","th","thd","theater","theatre","tiaa","tickets","tienda","tiffany","tips","tires","tirol","tj","tjmaxx","tjx","tk","tkmaxx","tl","tm","tmall","tn","to","today","tokyo","tools","top","toray","toshiba","total","tours","town","toyota","toys","tr","trade","trading","training","travel","travelchannel","travelers","travelersinsurance","trust","trv","tt","tube","tui","tunes","tushu","tv","tvs","tw","tz","ua","ubank","ubs","ug","uk","unicom","university","uno","uol","ups","us","uy","uz","va","vacations","vana","vanguard","vc","ve","vegas","ventures","verisign","vermögensberater","vermögensberatung","versicherung","vet","vg","vi","viajes","video","vig","viking","villas","vin","vip","virgin","visa","vision","viva","vivo","vlaanderen","vn","vodka","volkswagen","volvo","vote","voting","voto","voyage","vu","vuelos","wales","walmart","walter","wang","wanggou","watch","watches","weather","weatherchannel","webcam","weber","website","wed","wedding","weibo","weir","wf","whoswho","wien","wiki","williamhill","win","windows","wine","winners","wme","wolterskluwer","woodside","work","works","world","wow","ws","wtc","wtf","xbox","xerox","xfinity","xihuan","xin","xxx","xyz","yachts","yahoo","yamaxun","yandex","ye","yodobashi","yoga","yokohama","you","youtube","yt","yun","za","zappos","zara","zero","zip","zm","zone","zuerich","zw","ελ","ευ","бг","бел","дети","ею","католик","ком","мкд","мон","москва","онлайн","орг","рус","рф","сайт","срб","укр","қаз","հայ","ישראל","קום","ابوظبي","اتصالات","ارامكو","الاردن","البحرين","الجزائر","السعودية","العليان","المغرب","امارات","ایران","بارت","بازار","بيتك","بھارت","تونس","سودان","سورية","شبكة","عراق","عرب","عمان","فلسطين","قطر","كاثوليك","كوم","مصر","مليسيا","موريتانيا","موقع","همراه","پاکستان","ڀارت","कॉम","नेट","भारत","भारतम्","भारोत","संगठन","বাংলা","ভারত","ভাৰত","ਭਾਰਤ","ભારત","ଭାରତ","இந்தியா","இலங்கை","சிங்கப்பூர்","భారత్","ಭಾರತ","ഭാരതം","ලංකා","คอม","ไทย","ລາວ","გე","みんな","アマゾン","クラウド","グーグル","コム","ストア","セール","ファッション","ポイント","世界","中信","中国","中國","中文网","亚马逊","企业","佛山","信息","健康","八卦","公司","公益","台湾","台灣","商城","商店","商标","嘉里","嘉里大酒店","在线","大拿","天主教","娱乐","家電","广东","微博","慈善","我爱你","手机","招聘","政务","政府","新加坡","新闻","时尚","書籍","机构","淡马锡","游戏","澳門","点看","移动","组织机构","网址","网店","网站","网络","联通","诺基亚","谷歌","购物","通販","集团","電訊盈科","飞利浦","食品","餐厅","香格里拉","香港","닷넷","닷컴","삼성","한국"]'
  )),
    (mt = (e) => {
      const t = `(?:${
        '(?:(?:[a-z]+:)?//)' +
        ((e = {
          strict: !0,
          ...e,
        }).strict
          ? ''
          : '?')
      }|www\\.)(?:\\S+(?::\\S*)?@)?(?:localhost|${
        pt.v4().source
      }|(?:(?:[a-z\\u00a1-\\uffff0-9][-_]*)*[a-z\\u00a1-\\uffff0-9]+)(?:\\.(?:[a-z\\u00a1-\\uffff0-9]-*)*[a-z\\u00a1-\\uffff0-9]+)*${`(?:\\.${
        e.strict
          ? '(?:[a-z\\u00a1-\\uffff]{2,})'
          : `(?:${_t.sort((e, t) => t.length - e.length).join('|')})`
      })\\.?`})(?::\\d{2,5})?(?:[/?#][^\\s"]*)?`;
      return e.exact ? new RegExp(`(?:^${t}$)`, 'i') : new RegExp(t, 'ig');
    });
  var Ct = {};
  !(function (e, t) {
    'object' == typeof Ct
      ? (Ct = t())
      : 'function' == typeof define && define.amd
      ? define(t)
      : ((e =
          'undefined' != typeof globalThis
            ? globalThis
            : e || self).fetchRetry = t());
  })(Ct, function () {
    'use strict';
    function e(e) {
      return Number.isInteger(e) && e >= 0;
    }
    function t(e) {
      (this.name = 'ArgumentError'), (this.message = e);
    }
    return function (n, o) {
      if (((o = o || {}), 'function' != typeof n))
        throw new t('fetch must be a function');
      if ('object' != typeof o) throw new t('defaults must be an object');
      if (void 0 !== o.retries && !e(o.retries))
        throw new t('retries must be a positive integer');
      if (
        void 0 !== o.retryDelay &&
        !e(o.retryDelay) &&
        'function' != typeof o.retryDelay
      )
        throw new t(
          'retryDelay must be a positive integer or a function returning a positive integer'
        );
      if (
        void 0 !== o.retryOn &&
        !Array.isArray(o.retryOn) &&
        'function' != typeof o.retryOn
      )
        throw new t('retryOn property expects an array or function');
      return (
        (o = Object.assign(
          {
            retries: 3,
            retryDelay: 1e3,
            retryOn: [],
          },
          o
        )),
        function (r, i) {
          var a = o.retries,
            s = o.retryDelay,
            c = o.retryOn;
          if (i && void 0 !== i.retries) {
            if (!e(i.retries))
              throw new t('retries must be a positive integer');
            a = i.retries;
          }
          if (i && void 0 !== i.retryDelay) {
            if (!e(i.retryDelay) && 'function' != typeof i.retryDelay)
              throw new t(
                'retryDelay must be a positive integer or a function returning a positive integer'
              );
            s = i.retryDelay;
          }
          if (i && i.retryOn) {
            if (!Array.isArray(i.retryOn) && 'function' != typeof i.retryOn)
              throw new t('retryOn property expects an array or function');
            c = i.retryOn;
          }
          return new Promise(function (e, t) {
            var o = function (o) {
              var s =
                'undefined' != typeof Request && r instanceof Request
                  ? r.clone()
                  : r;
              n(s, i)
                .then(function (n) {
                  if (Array.isArray(c) && -1 === c.indexOf(n.status)) e(n);
                  else if ('function' == typeof c)
                    try {
                      return Promise.resolve(c(o, null, n))
                        .then(function (t) {
                          t ? l(o, null, n) : e(n);
                        })
                        .catch(t);
                    } catch (e) {
                      t(e);
                    }
                  else o < a ? l(o, null, n) : e(n);
                })
                .catch(function (e) {
                  if ('function' == typeof c)
                    try {
                      Promise.resolve(c(o, e, null))
                        .then(function (n) {
                          n ? l(o, e, null) : t(e);
                        })
                        .catch(function (e) {
                          t(e);
                        });
                    } catch (e) {
                      t(e);
                    }
                  else o < a ? l(o, e, null) : t(e);
                });
            };
            function l(e, t, n) {
              var r = 'function' == typeof s ? s(e, t, n) : s;
              setTimeout(function () {
                o(++e);
              }, r);
            }
            o(0);
          });
        }
      );
    };
  });
  let Et, Tt;
  const It = new WeakMap(),
    kt = new WeakMap(),
    Rt = new WeakMap(),
    Mt = new WeakMap(),
    At = new WeakMap();
  let St = {
    get(e, t, n) {
      if (e instanceof IDBTransaction) {
        if ('done' === t) return kt.get(e);
        if ('objectStoreNames' === t) return e.objectStoreNames || Rt.get(e);
        if ('store' === t)
          return n.objectStoreNames[1]
            ? void 0
            : n.objectStore(n.objectStoreNames[0]);
      }
      return Ot(e[t]);
    },
    set: (e, t, n) => ((e[t] = n), !0),
    has: (e, t) =>
      (e instanceof IDBTransaction && ('done' === t || 'store' === t)) ||
      t in e,
  };
  function Lt(e) {
    return e !== IDBDatabase.prototype.transaction ||
      'objectStoreNames' in IDBTransaction.prototype
      ? (
          Tt ||
          (Tt = [
            IDBCursor.prototype.advance,
            IDBCursor.prototype.continue,
            IDBCursor.prototype.continuePrimaryKey,
          ])
        ).includes(e)
        ? function (...t) {
            return e.apply(zt(this), t), Ot(It.get(this));
          }
        : function (...t) {
            return Ot(e.apply(zt(this), t));
          }
      : function (t, ...n) {
          const o = e.call(zt(this), t, ...n);
          return Rt.set(o, t.sort ? t.sort() : [t]), Ot(o);
        };
  }
  function Bt(e) {
    return 'function' == typeof e
      ? Lt(e)
      : (e instanceof IDBTransaction &&
          (function (e) {
            if (kt.has(e)) return;
            const t = new Promise((t, n) => {
              const o = () => {
                  e.removeEventListener('complete', r),
                    e.removeEventListener('error', i),
                    e.removeEventListener('abort', i);
                },
                r = () => {
                  t(), o();
                },
                i = () => {
                  n(e.error || new DOMException('AbortError', 'AbortError')),
                    o();
                };
              e.addEventListener('complete', r),
                e.addEventListener('error', i),
                e.addEventListener('abort', i);
            });
            kt.set(e, t);
          })(e),
        (t = e),
        (
          Et ||
          (Et = [
            IDBDatabase,
            IDBObjectStore,
            IDBIndex,
            IDBCursor,
            IDBTransaction,
          ])
        ).some((e) => t instanceof e)
          ? new Proxy(e, St)
          : e);
    var t;
  }
  function Ot(e) {
    if (e instanceof IDBRequest)
      return (function (e) {
        const t = new Promise((t, n) => {
          const o = () => {
              e.removeEventListener('success', r),
                e.removeEventListener('error', i);
            },
            r = () => {
              t(Ot(e.result)), o();
            },
            i = () => {
              n(e.error), o();
            };
          e.addEventListener('success', r), e.addEventListener('error', i);
        });
        return (
          t
            .then((t) => {
              t instanceof IDBCursor && It.set(t, e);
            })
            .catch(() => {}),
          At.set(t, e),
          t
        );
      })(e);
    if (Mt.has(e)) return Mt.get(e);
    const t = Bt(e);
    return t !== e && (Mt.set(e, t), At.set(t, e)), t;
  }
  const zt = (e) => At.get(e);
  const Nt = ['get', 'getKey', 'getAll', 'getAllKeys', 'count'],
    $t = ['put', 'add', 'delete', 'clear'],
    Pt = new Map();
  function jt(e, t) {
    if (!(e instanceof IDBDatabase) || t in e || 'string' != typeof t) return;
    if (Pt.get(t)) return Pt.get(t);
    const n = t.replace(/FromIndex$/, ''),
      o = t !== n,
      r = $t.includes(n);
    if (
      !(n in (o ? IDBIndex : IDBObjectStore).prototype) ||
      (!r && !Nt.includes(n))
    )
      return;
    const i = async function (e, ...t) {
      const i = this.transaction(e, r ? 'readwrite' : 'readonly');
      let a = i.store;
      return (
        o && (a = a.index(t.shift())),
        (await Promise.all([a[n](...t), r && i.done]))[0]
      );
    };
    return Pt.set(t, i), i;
  }
  St = ((e) => ({
    ...e,
    get: (t, n, o) => jt(t, n) || e.get(t, n, o),
    has: (t, n) => !!jt(t, n) || e.has(t, n),
  }))(St);
  const Ft = e(Ct)(fetch, {
      retries: 100,
      retryDelay: (e, t, n) =>
        'AbortError' !== (null == t ? void 0 : t.name) &&
        (e > 50 ? 6e4 : e > 20 ? 1e4 : 2e3),
      retryOn: (e, t, n) =>
        'AbortError' !== (null == t ? void 0 : t.name) &&
        (null !== t || n.status >= 400 ? !(e > 100) : void 0),
    }),
    ycsOptions =
      ((function (
        e,
        t,
        { blocked: n, upgrade: o, blocking: r, terminated: i } = {}
      ) {
        const a = indexedDB.open(e, t),
          s = Ot(a);
        o &&
          a.addEventListener('upgradeneeded', (e) => {
            o(Ot(a.result), e.oldVersion, e.newVersion, Ot(a.transaction));
          }),
          n && a.addEventListener('blocked', () => n()),
          s
            .then((e) => {
              i && e.addEventListener('close', () => i()),
                r && e.addEventListener('versionchange', () => r());
            })
            .catch(() => {});
      })('IDB_YCS', 1, {
        upgrade(e) {
          e.createObjectStore('STORE_CACHE_YCS');
        },
      }),
      (() => {
        const e = {};
        return () => e;
      })());
  function Dt(e) {
    let t = '';
    const n = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
      o = n.length;
    for (let r = 0; r < e; r++) t += n.charAt(Math.floor(Math.random() * o));
    return t;
  }
  function Vt(e, t) {
    return (
      (e = Math.ceil(e)),
      (t = Math.floor(t)),
      Math.floor(Math.random() * (t - e + 1) + e)
    );
  }
  function removeClassName(elementMap, className) {
    try {
      if (
        !elementMap ||
        Object.keys(elementMap).length === 0 ||
        typeof className !== 'string'
      ) {
        return;
      }
      let removed = [];
      const elements = Object.values(elementMap);
      for (const element of elements) {
        if (element.classList.contains(className)) {
          element.classList.remove(className);
          removed.push(element);
        }
      }
      return removed;
    } catch (error) {
      return [];
    }
  }
  function toggleVisibility(selector, on) {
    const elm = document.querySelector(selector);
    if (elm) {
      if (typeof on === 'boolean') {
        elm.classList.toggle('ycs-hidden', !on);
      } else {
        const v = elm.classList.contains('ycs-hidden');
        elm.classList.toggle('ycs-hidden', !v);
      }
    }
  }
  function Gt(e, t, n) {
    try {
      const o = (function (e) {
        if ('string' != typeof e) return e;
        const t = [];
        return (
          e.split('.').forEach(function (e) {
            e.split(/\[([^}]+)\]/g).forEach(function (e) {
              e.length > 0 && t.push(e);
            });
          }),
          t
        );
      })(t);
      let r = e;
      for (let e = 0; e < o.length; e++) {
        if (!r[o[e]]) return n;
        r = r[o[e]];
      }
      return r;
    } catch (e) {
      return n;
    }
  }
  function qt(e) {
    try {
      return e();
    } catch (e) {
      return;
    }
  }
  function Wt(e, t) {
    const n = [];
    try {
      (function e(o, r) {
        let i, a;
        const s = function (e) {
          return r ? r + '.' + e : e;
        };
        for (a in ((null == o ? void 0 : o.hasOwnProperty(t)) &&
          ((i = {}), (i[s(t)] = o[t]), n.push(i)),
        o))
          (null == o ? void 0 : o.hasOwnProperty(a)) &&
            'object' == typeof o[a] &&
            e(o[a], s(a));
      })(e);
    } catch (e) {
      return [];
    }
    return n;
  }
  function getVideoId(url) {
    try {
      if ('string' != typeof url) return;
      return new URL(url).searchParams.get('v');
    } catch (e) {
      return;
    }
  }
  function Yt() {
    return window.location.href.includes('/watch?');
  }
  function Kt(e, t) {
    t && (t.textContent = e.toString());
  }
  function Xt(e) {
    try {
      if ('string' != typeof e) return;
      const t = new URL(e),
        n = t.searchParams.get('v');
      if (n) {
        const e = new URL(t.origin);
        return (e.pathname = '/watch'), e.searchParams.set('v', n), e.href;
      }
      return;
    } catch (e) {
      return;
    }
  }
  async function Qt(e, t) {
    try {
      if (!e) return;
      const _ = ((n = window),
      JSON.parse(
        JSON.stringify({
          ctoken: null,
          continuation: null,
          itct: null,
          params: {
            credentials: 'include',
            headers: {
              accept: '*/*',
              'accept-language':
                (null === (o = n.ytcfg) ||
                void 0 === o ||
                null === (r = o.data_) ||
                void 0 === r ||
                null === (i = r.GOOGLE_FEEDBACK_PRODUCT_DATA) ||
                void 0 === i
                  ? void 0
                  : i.accept_language) || 'en-US,en;q=0.9',
              'cache-control': 'no-cache',
              'content-type': 'application/x-www-form-urlencoded',
              pragma: 'no-cache',
              'sec-fetch-dest': 'empty',
              'sec-fetch-mode': 'cors',
              'sec-fetch-site': 'same-origin',
              'x-spf-previous': Xt(n.location.href),
              'x-spf-referer': Xt(n.location.href),
              'x-youtube-identity-token':
                null === (a = n.ytcfg) ||
                void 0 === a ||
                null === (s = a.data_) ||
                void 0 === s
                  ? void 0
                  : s.ID_TOKEN,
              'x-youtube-client-name':
                (null === (c = n.ytcfg) ||
                void 0 === c ||
                null === (l = c.data_) ||
                void 0 === l
                  ? void 0
                  : l.INNERTUBE_CONTEXT_CLIENT_NAME) || '1',
              'x-youtube-client-version':
                null === (d = n.ytcfg) ||
                void 0 === d ||
                null === (u = d.data_) ||
                void 0 === u
                  ? void 0
                  : u.INNERTUBE_CONTEXT_CLIENT_VERSION,
              'x-youtube-device':
                (null === (h = n.ytcfg) ||
                void 0 === h ||
                null === (m = h.data_) ||
                void 0 === m
                  ? void 0
                  : m.DEVICE) || 'cbr=Chrome&cplatform=DESKTOP',
              'x-youtube-page-cl':
                null === (p = n.ytcfg) ||
                void 0 === p ||
                null === (f = p.data_) ||
                void 0 === f
                  ? void 0
                  : f.PAGE_CL,
              'x-youtube-page-label':
                null === (v = n.ytcfg) ||
                void 0 === v ||
                null === (y = v.data_) ||
                void 0 === y
                  ? void 0
                  : y.PAGE_BUILD_LABEL,
              'x-youtube-time-zone':
                Intl.DateTimeFormat().resolvedOptions().timeZone,
              'x-youtube-utc-offset': Math.abs(new Date().getTimezoneOffset()),
              'x-youtube-variants-checksum':
                null === (g = n.ytcfg) ||
                void 0 === g ||
                null === (w = g.data_) ||
                void 0 === w
                  ? void 0
                  : w.VARIANTS_CHECKSUM,
            },
            referrer: Xt(n.location.href),
            referrerPolicy: 'origin-when-cross-origin',
            body: `session_token=${
              null === (b = n.ytcfg) ||
              void 0 === b ||
              null === (x = b.data_) ||
              void 0 === x
                ? void 0
                : x.XSRF_TOKEN
            }`,
            method: 'POST',
            mode: 'cors',
          },
        })
      )).params;
      (_.method = 'GET'), delete _.headers['content-type'], delete _.body;
      const C = await fetch(`${Xt(e)}&pbj=1`, {
          ..._,
          signal: t,
          cache: 'no-store',
        }),
        E = await C.json();
      return (ycsOptions.getInitYtData = E), E;
    } catch (e) {
      return;
    }
    var n, o, r, i, a, s, c, l, d, u, h, m, p, f, v, y, g, w, b, x;
  }
  function Zt(e, t, n) {
    if (t)
      try {
        var o, r, i, a, s, c, l, d, u, h;
        return JSON.parse(
          JSON.stringify({
            headers: {
              accept: '*/*',
              'accept-language':
                (null === (o = e.ytcfg) ||
                void 0 === o ||
                null === (r = o.data_) ||
                void 0 === r ||
                null === (i = r.GOOGLE_FEEDBACK_PRODUCT_DATA) ||
                void 0 === i
                  ? void 0
                  : i.accept_language) || 'en-US,en;q=0.9',
              'content-type': 'application/json',
              pragma: 'no-cache',
              'cache-control': 'no-store',
              'x-youtube-client-name':
                (null === (a = e.ytcfg) ||
                void 0 === a ||
                null === (s = a.data_) ||
                void 0 === s
                  ? void 0
                  : s.INNERTUBE_CONTEXT_CLIENT_NAME) || '1',
              'x-youtube-client-version':
                null === (c = e.ytcfg) ||
                void 0 === c ||
                null === (l = c.data_) ||
                void 0 === l
                  ? void 0
                  : l.INNERTUBE_CONTEXT_CLIENT_VERSION,
            },
            referrerPolicy: 'strict-origin-when-cross-origin',
            body: JSON.stringify({
              context: {
                client:
                  null === (d = e.ytcfg) ||
                  void 0 === d ||
                  null === (u = d.data_) ||
                  void 0 === u ||
                  null === (h = u.INNERTUBE_CONTEXT) ||
                  void 0 === h
                    ? void 0
                    : h.client,
              },
              continuation: t.continuation,
              currentPlayerState: {
                playerOffsetMs: n.toString(),
              },
            }),
            method: 'POST',
            mode: 'cors',
            credentials: 'include',
          })
        );
      } catch (e) {
        return;
      }
  }
  function en(e, t) {
    try {
      var n, o, r, i, a, s, c, l, d, u;
      return JSON.parse(
        JSON.stringify({
          headers: {
            accept: '*/*',
            'accept-language':
              (null === (n = e.ytcfg) ||
              void 0 === n ||
              null === (o = n.data_) ||
              void 0 === o ||
              null === (r = o.GOOGLE_FEEDBACK_PRODUCT_DATA) ||
              void 0 === r
                ? void 0
                : r.accept_language) || 'en-US,en;q=0.9',
            'content-type': 'application/json',
            pragma: 'no-cache',
            'cache-control': 'no-store',
            'x-youtube-client-name':
              (null === (i = e.ytcfg) ||
              void 0 === i ||
              null === (a = i.data_) ||
              void 0 === a
                ? void 0
                : a.INNERTUBE_CONTEXT_CLIENT_NAME) || '1',
            'x-youtube-client-version':
              null === (s = e.ytcfg) ||
              void 0 === s ||
              null === (c = s.data_) ||
              void 0 === c
                ? void 0
                : c.INNERTUBE_CONTEXT_CLIENT_VERSION,
          },
          referrerPolicy: 'strict-origin-when-cross-origin',
          body: JSON.stringify({
            context: {
              client:
                null === (l = e.ytcfg) ||
                void 0 === l ||
                null === (d = l.data_) ||
                void 0 === d ||
                null === (u = d.INNERTUBE_CONTEXT) ||
                void 0 === u
                  ? void 0
                  : u.client,
            },
            clickTracking: {
              clickTrackingParams: t.clickTrackingParams,
            },
            continuation: t.continue,
          }),
          method: 'POST',
          mode: 'cors',
          credentials: 'include',
        })
      );
    } catch (e) {
      return;
    }
  }
  function tn(e, t) {
    try {
      var n, o, r, i, a, s, c, l, d, u;
      return JSON.parse(
        JSON.stringify({
          headers: {
            accept: '*/*',
            'accept-language':
              (null === (n = e.ytcfg) ||
              void 0 === n ||
              null === (o = n.data_) ||
              void 0 === o ||
              null === (r = o.GOOGLE_FEEDBACK_PRODUCT_DATA) ||
              void 0 === r
                ? void 0
                : r.accept_language) || 'en-US,en;q=0.9',
            'content-type': 'application/json',
            pragma: 'no-cache',
            'cache-control': 'no-store',
            'x-youtube-client-name':
              (null === (i = e.ytcfg) ||
              void 0 === i ||
              null === (a = i.data_) ||
              void 0 === a
                ? void 0
                : a.INNERTUBE_CONTEXT_CLIENT_NAME) || '1',
            'x-youtube-client-version':
              null === (s = e.ytcfg) ||
              void 0 === s ||
              null === (c = s.data_) ||
              void 0 === c
                ? void 0
                : c.INNERTUBE_CONTEXT_CLIENT_VERSION,
          },
          referrerPolicy: 'strict-origin-when-cross-origin',
          body: JSON.stringify({
            context: {
              client:
                null === (l = e.ytcfg) ||
                void 0 === l ||
                null === (d = l.data_) ||
                void 0 === d ||
                null === (u = d.INNERTUBE_CONTEXT) ||
                void 0 === u
                  ? void 0
                  : u.client,
            },
            clickTracking: {
              clickTrackingParams: t.clickTracking,
            },
            continuation: t.continue,
          }),
          method: 'POST',
          mode: 'cors',
          credentials: 'include',
        })
      );
    } catch (e) {
      return;
    }
  }
  function nn() {
    try {
      var e,
        t,
        n,
        o,
        r,
        i,
        a,
        s,
        c,
        l,
        d,
        u,
        h,
        m,
        p,
        f,
        v,
        y,
        g,
        w,
        b,
        x,
        _,
        C,
        E,
        T,
        I,
        k,
        R,
        M;
      return (
        (null ===
          (t =
            null === (e = window) || void 0 === e ? void 0 : e.ytcfg.data_) ||
        void 0 === t
          ? void 0
          : t.INNERTUBE_API_KEY) ||
        (null === (n = window) ||
        void 0 === n ||
        null === (o = n.ytcfg) ||
        void 0 === o ||
        null === (r = o.data_) ||
        void 0 === r ||
        null === (i = r.WEB_PLAYER_CONTEXT_CONFIGS) ||
        void 0 === i ||
        null === (a = i.WEB_PLAYER_CONTEXT_CONFIG_ID_KEVLAR_WATCH) ||
        void 0 === a
          ? void 0
          : a.innertubeApiKey) ||
        (null === (s = window) ||
        void 0 === s ||
        null === (c = s.ytcfg) ||
        void 0 === c ||
        null === (l = c.data_) ||
        void 0 === l ||
        null === (d = l.WEB_PLAYER_CONTEXT_CONFIGS) ||
        void 0 === d ||
        null === (u = d.WEB_PLAYER_CONTEXT_CONFIG_ID_KEVLAR_CHANNEL_TRAILER) ||
        void 0 === u
          ? void 0
          : u.innertubeApiKey) ||
        (null === (h = window) ||
        void 0 === h ||
        null === (m = h.ytcfg) ||
        void 0 === m ||
        null === (p = m.data_) ||
        void 0 === p ||
        null === (f = p.WEB_PLAYER_CONTEXT_CONFIGS) ||
        void 0 === f ||
        null ===
          (v = f.WEB_PLAYER_CONTEXT_CONFIG_ID_KEVLAR_PLAYLIST_OVERVIEW) ||
        void 0 === v
          ? void 0
          : v.innertubeApiKey) ||
        (null === (y = window) ||
        void 0 === y ||
        null === (g = y.ytcfg) ||
        void 0 === g ||
        null === (w = g.data_) ||
        void 0 === w ||
        null === (b = w.WEB_PLAYER_CONTEXT_CONFIGS) ||
        void 0 === b ||
        null ===
          (x =
            b.WEB_PLAYER_CONTEXT_CONFIG_ID_KEVLAR_VERTICAL_LANDING_PAGE_PROMO) ||
        void 0 === x
          ? void 0
          : x.innertubeApiKey) ||
        (null === (_ = window) ||
        void 0 === _ ||
        null === (C = _.ytcfg) ||
        void 0 === C ||
        null === (E = C.data_) ||
        void 0 === E ||
        null === (T = E.WEB_PLAYER_CONTEXT_CONFIGS) ||
        void 0 === T ||
        null ===
          (I = T.WEB_PLAYER_CONTEXT_CONFIG_ID_KEVLAR_SPONSORSHIPS_OFFER) ||
        void 0 === I
          ? void 0
          : I.innertubeApiKey) ||
        (null === (k = window) ||
        void 0 === k ||
        null === (R = k.ytplayer) ||
        void 0 === R ||
        null === (M = R.web_player_context_config) ||
        void 0 === M
          ? void 0
          : M.innertubeApiKey)
      );
    } catch (e) {
      return;
    }
  }
  async function on(e) {
    try {
      const t = await Qt(window.location.href, e);
      if (t) {
        if (
          qt(
            () =>
              t[3].response.contents.twoColumnWatchNextResults.conversationBar
                .liveChatRenderer.header.liveChatHeaderRenderer.viewSelector
                .sortFilterSubMenuRenderer.subMenuItems[1].continuation
                .reloadContinuationData
          )
        )
          return qt(
            () =>
              t[3].response.contents.twoColumnWatchNextResults.conversationBar
                .liveChatRenderer.header.liveChatHeaderRenderer.viewSelector
                .sortFilterSubMenuRenderer.subMenuItems[1].continuation
                .reloadContinuationData
          );
        const e = Wt(t, 'reloadContinuationData');
        if (e.length > 0) return Object.values(e[e.length - 1])[0];
      }
      return;
    } catch (e) {
      return;
    }
  }
  async function loadChatReplay(signal) {
    try {
      const n = await on(signal),
        o = (function (e, t) {
          if (t)
            try {
              var n, o, r, i, a, s, c, l, d, u;
              return JSON.parse(
                JSON.stringify({
                  headers: {
                    accept: '*/*',
                    'accept-language':
                      (null === (n = e.ytcfg) ||
                      void 0 === n ||
                      null === (o = n.data_) ||
                      void 0 === o ||
                      null === (r = o.GOOGLE_FEEDBACK_PRODUCT_DATA) ||
                      void 0 === r
                        ? void 0
                        : r.accept_language) || 'en-US,en;q=0.9',
                    'content-type': 'application/json',
                    pragma: 'no-cache',
                    'cache-control': 'no-store',
                    'x-youtube-client-name':
                      (null === (i = e.ytcfg) ||
                      void 0 === i ||
                      null === (a = i.data_) ||
                      void 0 === a
                        ? void 0
                        : a.INNERTUBE_CONTEXT_CLIENT_NAME) || '1',
                    'x-youtube-client-version':
                      null === (s = e.ytcfg) ||
                      void 0 === s ||
                      null === (c = s.data_) ||
                      void 0 === c
                        ? void 0
                        : c.INNERTUBE_CONTEXT_CLIENT_VERSION,
                  },
                  referrerPolicy: 'strict-origin-when-cross-origin',
                  body: JSON.stringify({
                    context: {
                      client:
                        null === (l = e.ytcfg) ||
                        void 0 === l ||
                        null === (d = l.data_) ||
                        void 0 === d ||
                        null === (u = d.INNERTUBE_CONTEXT) ||
                        void 0 === u
                          ? void 0
                          : u.client,
                    },
                    continuation: t.continuation,
                  }),
                  method: 'POST',
                  mode: 'cors',
                  credentials: 'include',
                })
              );
            } catch (e) {
              return;
            }
        })(window, n);
      if (o) {
        var t;
        const n = await fetch(
            `https://www.youtube.com/youtubei/v1/live_chat/get_live_chat?key=${nn()}`,
            {
              ...o,
              signal,
              cache: 'no-store',
            }
          ),
          r = await n.json();
        return null == r ||
          null === (t = r.continuationContents) ||
          void 0 === t
          ? void 0
          : t.liveChatContinuation;
      }
      return;
    } catch (e) {
      return;
    }
  }
  async function loadTranscript(signal) {
    const getTimedTextUrl = async () => {
      const videoId = getVideoId(window.location.href);
      const response = await fetch(
        `https://www.youtube.com/watch?v=${videoId}`,
        {
          method: 'GET',
          mode: 'no-cors',
          credentials: 'include',
          signal,
          cache: 'no-store',
        }
      );
      const html = await response.text();
      const splittedHtml = html.split('"captions":');
      if (splittedHtml.length <= 1) {
        throw new Error('Fail to load video html');
      }
      const captions = JSON.parse(
        splittedHtml[1].split(',"videoDetails')[0].replace('\n', '')
      ).playerCaptionsTracklistRenderer;
      const generatedTracks = captions.captionTracks.filter(
        ({ kind }) => kind === 'asr'
      );
      const englishTracks = generatedTracks.filter(
        ({ languageCode }) => languageCode === 'en'
      );
      return englishTracks.length > 0
        ? englishTracks[0].baseUrl
        : generatedTracks[0].baseUrl;
    };

    const getRawTranscript = async (url) => {
      const response = await fetch(url, {
        method: 'GET',
        mode: 'no-cors',
        credentials: 'include',
        signal,
        cache: 'no-store',
      });
      const xmlText = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlText, 'application/xml');
      return [].slice.call(doc.childNodes[0].childNodes).map((node) => {
        return {
          text: node.textContent,
          start: Number(qt(() => node.attributes.start.value) || 0),
          duration: Number(qt(() => node.attributes.dur.value) || 0),
        };
      });
    };

    const toFormatted = (seconds) => {
      let left = seconds;
      const h = (left / 3600) >>> 0;
      left -= h * 3600;
      const m = (left / 60) >>> 0;
      left -= m * 60;
      const s = left >>> 0;

      let output = `${s}`.padStart(2, '0');

      if (m || h) {
        let seg;

        if (!m) {
          seg = '00';
        } else {
          if (h) {
            seg = `${m}`.padStart(2, '0');
          } else {
            seg = m;
          }
        }

        output = `${seg}:${output}`;
      }

      if (h) {
        output = `${h}:${output}`;
      }

      if (!m && !h) {
        output = `0:${output}`;
      }

      return output;
    };

    const migrateTranscript = (rawTranscript) => {
      const cueGroups = rawTranscript.map(({ text, start, duration }) => {
        return {
          transcriptCueGroupRenderer: {
            formattedStartOffset: {
              simpleText: toFormatted(start),
            },
            cues: [
              {
                transcriptCueRenderer: {
                  startOffsetMs: start * 1000,
                  cue: {
                    simpleText: text,
                  },
                },
              },
            ],
          },
        };
      });

      return {
        actions: [
          {
            updateEngagementPanelAction: {
              content: {
                transcriptRenderer: {
                  body: {
                    transcriptBodyRenderer: {
                      cueGroups,
                    },
                  },
                },
              },
            },
          },
        ],
      };
    };

    try {
      const url = await getTimedTextUrl();
      const rawTranscript = await getRawTranscript(url);
      return migrateTranscript(rawTranscript);
    } catch (e) {
      return;
    }
  }
  function sn(e) {
    if ('string' != typeof e) return;
    const t = document.querySelectorAll(e);
    for (const e of t) e.remove();
  }
  async function cn(t, n, o) {
    const r = async () => {
        try {
          const e = await (async function (e, t, n) {
              try {
                var o, r, i, a, s, c, l, d, u, h;
                if ('string' != typeof t) return;
                const m = JSON.parse(
                    JSON.stringify({
                      headers: {
                        accept: '*/*',
                        'accept-language':
                          (null === (o = e.ytcfg) ||
                          void 0 === o ||
                          null === (r = o.data_) ||
                          void 0 === r ||
                          null === (i = r.GOOGLE_FEEDBACK_PRODUCT_DATA) ||
                          void 0 === i
                            ? void 0
                            : i.accept_language) || 'en-US,en;q=0.9',
                        'content-type': 'application/json',
                        pragma: 'no-cache',
                        'cache-control': 'no-store',
                        'x-youtube-client-name':
                          (null === (a = e.ytcfg) ||
                          void 0 === a ||
                          null === (s = a.data_) ||
                          void 0 === s
                            ? void 0
                            : s.INNERTUBE_CONTEXT_CLIENT_NAME) || '1',
                        'x-youtube-client-version':
                          null === (c = e.ytcfg) ||
                          void 0 === c ||
                          null === (l = c.data_) ||
                          void 0 === l
                            ? void 0
                            : l.INNERTUBE_CONTEXT_CLIENT_VERSION,
                      },
                      referrer: t,
                      referrerPolicy: 'strict-origin-when-cross-origin',
                      body: JSON.stringify({
                        context: {
                          client:
                            null === (d = e.ytcfg) ||
                            void 0 === d ||
                            null === (u = d.data_) ||
                            void 0 === u ||
                            null === (h = u.INNERTUBE_CONTEXT) ||
                            void 0 === h
                              ? void 0
                              : h.client,
                        },
                        videoId: getVideoId(t),
                      }),
                      method: 'POST',
                      mode: 'cors',
                      credentials: 'include',
                    })
                  ),
                  p = await fetch(
                    `https://www.youtube.com/youtubei/v1/next?key=${nn()}`,
                    {
                      ...m,
                      signal: n,
                      cache: 'no-store',
                    }
                  );
                return await p.json();
              } catch (e) {
                return;
              }
            })(window, Xt(window.location.href), n),
            t = objectScan(
              [
                '**.contents.twoColumnWatchNextResults.results.results.contents[?].itemSectionRenderer.contents[?].continuationItemRenderer.continuationEndpoint.continuationCommand.token',
              ],
              {
                joined: !0,
                rtn: 'value',
                abort: !0,
              }
            )(e),
            o = await (async function (e, t, n) {
              try {
                var o, r, i, a, s, c, l, d, u, h;
                if ('object' != typeof t) return;
                const m = JSON.parse(
                    JSON.stringify({
                      headers: {
                        accept: '*/*',
                        'accept-language':
                          (null === (o = e.ytcfg) ||
                          void 0 === o ||
                          null === (r = o.data_) ||
                          void 0 === r ||
                          null === (i = r.GOOGLE_FEEDBACK_PRODUCT_DATA) ||
                          void 0 === i
                            ? void 0
                            : i.accept_language) || 'en-US,en;q=0.9',
                        'content-type': 'application/json',
                        pragma: 'no-cache',
                        'cache-control': 'no-store',
                        'x-youtube-client-name':
                          (null === (a = e.ytcfg) ||
                          void 0 === a ||
                          null === (s = a.data_) ||
                          void 0 === s
                            ? void 0
                            : s.INNERTUBE_CONTEXT_CLIENT_NAME) || '1',
                        'x-youtube-client-version':
                          null === (c = e.ytcfg) ||
                          void 0 === c ||
                          null === (l = c.data_) ||
                          void 0 === l
                            ? void 0
                            : l.INNERTUBE_CONTEXT_CLIENT_VERSION,
                      },
                      referrer: t.url,
                      referrerPolicy: 'strict-origin-when-cross-origin',
                      body: JSON.stringify({
                        context: {
                          client:
                            null === (d = e.ytcfg) ||
                            void 0 === d ||
                            null === (u = d.data_) ||
                            void 0 === u ||
                            null === (h = u.INNERTUBE_CONTEXT) ||
                            void 0 === h
                              ? void 0
                              : h.client,
                        },
                        clickTracking: {
                          clickTrackingParams: '',
                        },
                        continuation: t.continue,
                      }),
                      method: 'POST',
                      mode: 'cors',
                      credentials: 'include',
                    })
                  ),
                  p = await fetch(
                    `https://www.youtube.com/youtubei/v1/next?key=${nn()}`,
                    {
                      ...m,
                      signal: n,
                      cache: 'no-store',
                    }
                  );
                return await p.json();
              } catch (e) {
                return;
              }
            })(
              window,
              {
                url: Xt(window.location.href),
                continue: t,
              },
              n
            ),
            r = [
              '**.sortMenu.sortFilterSubMenuRenderer.subMenuItems[?].serviceEndpoint.clickTrackingParams',
              '**.sortMenu.sortFilterSubMenuRenderer.subMenuItems[?].serviceEndpoint.continuationCommand.command.clickTrackingParams',
              '**.sortMenu.sortFilterSubMenuRenderer.subMenuItems[?].trackingParams',
            ];
          let i;
          for (const e of r)
            try {
              if (
                ((i = objectScan([`${e}`], {
                  joined: !0,
                  rtn: 'value',
                  abort: !0,
                })(o)),
                i)
              )
                break;
            } catch (e) {
              continue;
            }
          return {
            continue: objectScan(
              [
                '**.sortMenu.sortFilterSubMenuRenderer.subMenuItems[?].serviceEndpoint.continuationCommand.token',
              ],
              {
                joined: !0,
                rtn: 'value',
                abort: !0,
              }
            )(o),
            clickTrackingParams: i,
          };
        } catch (e) {
          return;
        }
      },
      i = (e) => {
        try {
          if (
            qt(
              () =>
                e.commentRenderer.actionButtons.commentActionButtonsRenderer
                  .creatorHeart
            )
          )
            try {
              e.commentRenderer.creatorHeart = {
                name: qt(
                  () =>
                    e.commentRenderer.actionButtons.commentActionButtonsRenderer
                      .creatorHeart.creatorHeartRenderer.creatorThumbnail
                      .accessibility.accessibilityData.label
                ),
              };
            } catch (e) {}
          if (
            qt(
              () =>
                e.commentRenderer.authorCommentBadge.authorCommentBadgeRenderer.icon.iconType.indexOf(
                  'CHECK'
                ) >= 0
            ) ||
            qt(
              () =>
                e.commentRenderer.authorCommentBadge.authorCommentBadgeRenderer.iconTooltip.indexOf(
                  'Verified'
                ) >= 0
            )
          )
            try {
              e.commentRenderer.verifiedAuthor = !0;
            } catch (e) {}
          const t = [
            'actionButtons',
            'authorCommentBadge',
            'collapseButton',
            'expandButton',
            'loggingDirectives',
            'voteStatus',
            'trackingParams',
            'isLiked',
          ];
          for (const n of t) qt(() => delete e.commentRenderer[n]);
          if (
            (qt(() => delete e.commentRenderer.authorThumbnail.accessibility),
            qt(() => (e.commentRenderer.authorThumbnail.thumbnails.length = 1)),
            qt(
              () =>
                delete e.commentRenderer.authorThumbnail.thumbnails[0].height
            ),
            qt(
              () => delete e.commentRenderer.authorThumbnail.thumbnails[0].width
            ),
            qt(
              () =>
                delete e.commentRenderer.publishedTimeText.runs[0]
                  .navigationEndpoint.commandMetadata.webCommandMetadata.rootVe
            ),
            qt(
              () =>
                delete e.commentRenderer.publishedTimeText.runs[0]
                  .navigationEndpoint.commandMetadata.webCommandMetadata
                  .webPageType
            ),
            qt(
              () =>
                delete e.commentRenderer.publishedTimeText.runs[0]
                  .navigationEndpoint.watchEndpoint.params
            ),
            qt(
              () => delete e.commentRenderer.authorEndpoint.clickTrackingParams
            ),
            qt(
              () =>
                delete e.commentRenderer.authorEndpoint.commandMetadata
                  .webCommandMetadata.apiUrl
            ),
            qt(
              () =>
                delete e.commentRenderer.authorEndpoint.commandMetadata
                  .webCommandMetadata.rootVe
            ),
            qt(
              () =>
                delete e.commentRenderer.authorEndpoint.commandMetadata
                  .webCommandMetadata.webPageType
            ),
            qt(
              () =>
                delete e.commentRenderer.authorEndpoint.browseEndpoint.browseId
            ),
            qt(
              () =>
                delete e.commentRenderer.publishedTimeText.runs[0]
                  .navigationEndpoint.clickTrackingParams
            ),
            qt(() => e.commentRenderer.contentText.runs.length > 0))
          )
            for (const [t, n] of e.commentRenderer.contentText.runs.entries())
              n.navigationEndpoint
                ? (qt(
                    () =>
                      delete e.commentRenderer.contentText.runs[t]
                        .navigationEndpoint.commandMetadata.webCommandMetadata
                        .apiUrl
                  ),
                  qt(
                    () =>
                      delete e.commentRenderer.contentText.runs[t]
                        .navigationEndpoint.commandMetadata.webCommandMetadata
                        .rootVe
                  ),
                  qt(
                    () =>
                      delete e.commentRenderer.contentText.runs[t]
                        .navigationEndpoint.commandMetadata.webCommandMetadata
                        .webPageType
                  ),
                  qt(
                    () =>
                      delete e.commentRenderer.contentText.runs[t]
                        .navigationEndpoint.clickTrackingParams
                  ),
                  qt(() => delete e.commentRenderer.contentText.runs[t].text))
                : qt(() => delete e.commentRenderer.contentText.runs[t]);
          return e;
        } catch (t) {
          return e;
        }
      },
      a = o || [],
      s = new (e(Ke))({
        concurrency: 4,
      });
    const currentVideoId = getVideoId(window.location.href);
    async function processComments(continuationItems, t) {
      if (!continuationItems) return;
      for (const item of continuationItems) {
        try {
          if (item.commentThreadRenderer.comment) {
            const contentText =
              item.commentThreadRenderer.comment.commentRenderer.contentText;
            let fullText = '';
            let renderFullText = '';
            const runs = contentText.runs || [];
            for (const run of runs) {
              fullText += run.text || '';
              run.text = stopXSS(run.text); // this might not be adequate enough for XSS prevention.
              try {
                if (run.attachment) {
                  let image;
                  if ((image = run.attachment.image)) {
                    const { url, width, height, margin } = image;
                    const alt = run.text || '';
                    const style = `margin-left: ${margin.left}px; margin-right: ${margin.right}px;`;
                    renderFullText += `<img src="${url}" alt="${alt}" title="${alt}" width="${width}" height="${height}" style="${style}" class="ycs-attachment" />`;
                  } else {
                    renderFullText += run.text || '';
                  }
                } else if (run.navigationEndpoint) {
                  if (
                    parseInt(
                      run.navigationEndpoint.watchEndpoint.startTimeSeconds
                    ) >= 0
                  ) {
                    renderFullText += `<a class="ycs-cpointer ycs-gotochat-video" href="https://www.youtube.com/watch?v=${
                      run.navigationEndpoint.watchEndpoint.videoId
                    }&t=${
                      run.navigationEndpoint.watchEndpoint.startTimeSeconds
                    }s" data-offsetvideo="${
                      run.navigationEndpoint.watchEndpoint.startTimeSeconds
                    }" data-video-id="${
                      run.navigationEndpoint.watchEndpoint.videoId
                    }">${run.text || ''}</a>`;

                    if (
                      currentVideoId ===
                      run.navigationEndpoint.watchEndpoint.videoId
                    ) {
                      item.commentThreadRenderer.comment.commentRenderer.isTimeLine =
                        'timeline';
                    }
                  } else {
                    if (run.navigationEndpoint.browseEndpoint) {
                      renderFullText += `<a class="ycs-cpointer ycs-comment-link" href="${
                        run.navigationEndpoint.browseEndpoint.canonicalBaseUrl
                      }" target="_blank">${run.text || ''}</a>`;
                    } else if (run.navigationEndpoint.urlEndpoint) {
                      renderFullText += `<a class="ycs-cpointer ycs-comment-link" href="${
                        run.navigationEndpoint.urlEndpoint.url
                      }" target="_blank">${run.text || ''}</a>`;
                    } else if (
                      run.navigationEndpoint.commandMetadata &&
                      run.navigationEndpoint.commandMetadata.webCommandMetadata
                    ) {
                      renderFullText += `<a class="ycs-cpointer ycs-comment-link" href="${
                        run.navigationEndpoint.commandMetadata
                          .webCommandMetadata.url
                      }" target="_blank">${run.text || ''}</a>`;
                    } else {
                      renderFullText += run.text || '';
                    }
                  }
                } else {
                  renderFullText += run.text || '';
                }
              } catch (e) {
                renderFullText += run.text || '';
                continue;
              }
            }
            if (
              item.commentThreadRenderer.comment.commentRenderer.contentText
            ) {
              item.commentThreadRenderer.comment.commentRenderer.contentText.fullText =
                fullText;
              item.commentThreadRenderer.comment.commentRenderer.contentText.renderFullText =
                renderFullText;
            }
            item.commentThreadRenderer.comment.typeComment = 'C';
            a.push(i(item.commentThreadRenderer.comment));
            Kt(a.length, t);
          }

          const continuationData =
            item.commentThreadRenderer.replies.commentRepliesRenderer
              .continuations[0].nextContinuationData;
          const token = continuationData.continuation;
          const cTrParams = continuationData.clickTrackingParams;
          if (token) {
            s.add(async () => {
              try {
                const data = {
                  continue: token,
                  clickTracking: cTrParams,
                };
                const requestOptions = tn(window, data);
                const response = await Ft(
                  `https://www.youtube.com/youtubei/v1/next?key=${nn()}`,
                  {
                    ...requestOptions,
                    signal: n,
                    cache: 'no-store',
                  }
                );
                let responseData = await response.json();
                if (
                  responseData.onResponseReceivedEndpoints[0]
                    .appendContinuationItemsAction.continuationItems
                ) {
                  const continuationItems =
                    responseData.onResponseReceivedEndpoints[0]
                      .appendContinuationItemsAction.continuationItems;
                  const frameworkUpdatesById =
                    getFrameworkUpdatesById(responseData);
                  const subItems = migrateContinuationSubItems(
                    continuationItems,
                    frameworkUpdatesById
                  );
                  for (const subItem of subItems) {
                    if (!subItem.commentRenderer) continue;
                    let fullText = '';
                    let renderFullText = '';
                    const runs = subItem.commentRenderer.contentText.runs || [];
                    for (const run of runs) {
                      try {
                        if (run.text) {
                          fullText += run.text;
                          run.text = stopXSS(run.text); // this might not be adequate enough for XSS prevention.
                          if (
                            parseInt(
                              run.navigationEndpoint.watchEndpoint
                                .startTimeSeconds
                            ) >= 0
                          ) {
                            let targetStr = '';

                            if (
                              currentVideoId ===
                              run.navigationEndpoint.watchEndpoint.videoId
                            ) {
                              subItem.commentRenderer.isTimeLine = 'timeline';
                            } else {
                              targetStr =
                                ' target="_blank" rel="noopener noreferrer" ';
                            }

                            renderFullText += `<a class="ycs-cpointer ycs-gotochat-video" href="https://www.youtube.com/watch?v=${
                              run.navigationEndpoint.watchEndpoint.videoId
                            }&t=${
                              run.navigationEndpoint.watchEndpoint
                                .startTimeSeconds
                            }s" data-offsetvideo="${
                              run.navigationEndpoint.watchEndpoint
                                .startTimeSeconds
                            }" data-video-id="${
                              run.navigationEndpoint.watchEndpoint.videoId
                            }"${targetStr}>${run.text || ''}</a>`;
                          } else {
                            if (run.navigationEndpoint.browseEndpoint) {
                              renderFullText += `<a class="ycs-cpointer ycs-comment-link" href="${
                                run.navigationEndpoint.browseEndpoint
                                  .canonicalBaseUrl
                              }" target="_blank">${run.text || ''}</a>`;
                            } else if (run.navigationEndpoint.urlEndpoint) {
                              renderFullText += `<a class="ycs-cpointer ycs-comment-link" href="${
                                run.navigationEndpoint.urlEndpoint.url
                              }" target="_blank">${run.text || ''}</a>`;
                            } else if (
                              run.navigationEndpoint.commandMetadata &&
                              run.navigationEndpoint.commandMetadata
                                .webCommandMetadata
                            ) {
                              renderFullText += `<a class="ycs-cpointer ycs-comment-link" href="${
                                run.navigationEndpoint.commandMetadata
                                  .webCommandMetadata.url
                              }" target="_blank">${run.text || ''}</a>`;
                            } else {
                              renderFullText += run.text || '';
                            }
                          }
                        }
                      } catch (t) {
                        renderFullText += run.text || '';
                      }
                    }
                    if (subItem.commentRenderer.contentText) {
                      subItem.commentRenderer.contentText.fullText = fullText;
                      subItem.commentRenderer.contentText.renderFullText =
                        renderFullText;
                    }
                    subItem.typeComment = 'R';
                    subItem.originComment = item.commentThreadRenderer.comment;
                    a.push(i(subItem));
                    Kt(a.length, t);
                  }
                }
                while (
                  responseData.onResponseReceivedEndpoints[0]
                    .appendContinuationItemsAction.continuationItems[
                    responseData.onResponseReceivedEndpoints[0]
                      .appendContinuationItemsAction.continuationItems.length -
                      1
                  ].continuationItemRenderer.button.buttonRenderer.command
                    .continuationCommand
                ) {
                  const token =
                    responseData.onResponseReceivedEndpoints[0]
                      .appendContinuationItemsAction.continuationItems[
                      responseData.onResponseReceivedEndpoints[0]
                        .appendContinuationItemsAction.continuationItems
                        .length - 1
                    ].continuationItemRenderer.button.buttonRenderer.command
                      .continuationCommand.token;
                  const clickTrackingParams =
                    responseData.onResponseReceivedEndpoints[0]
                      .appendContinuationItemsAction.continuationItems[
                      responseData.onResponseReceivedEndpoints[0]
                        .appendContinuationItemsAction.continuationItems
                        .length - 1
                    ].continuationItemRenderer.button.buttonRenderer.command
                      .clickTrackingParams;
                  const data = {
                    continue: token,
                    clickTracking: clickTrackingParams,
                  };
                  const requestOptions = tn(window, data);
                  const response = await Ft(
                    `https://www.youtube.com/youtubei/v1/next?key=${nn()}`,
                    {
                      ...requestOptions,
                      signal: n,
                      cache: 'no-store',
                    }
                  );
                  responseData = await response.json();
                  if (
                    responseData.onResponseReceivedEndpoints[0]
                      .appendContinuationItemsAction.continuationItems
                  ) {
                    const continuationItems =
                      responseData.onResponseReceivedEndpoints[0]
                        .appendContinuationItemsAction.continuationItems;
                    const frameworkUpdatesById =
                      getFrameworkUpdatesById(responseData);
                    const subItems = migrateContinuationSubItems(
                      continuationItems,
                      frameworkUpdatesById
                    );
                    for (const subItem of subItems) {
                      if (!subItem.commentRenderer) continue;
                      let fullText = '';
                      let renderFullText = '';
                      const runs =
                        subItem.commentRenderer.contentText.runs || [];
                      for (const run of runs) {
                        try {
                          if (run.text) {
                            fullText += run.text;
                            run.text = stopXSS(run.text); // this might not be adequate enough for XSS prevention.
                            if (
                              parseInt(
                                run.navigationEndpoint.watchEndpoint
                                  .startTimeSeconds
                              ) >= 0
                            ) {
                              let targetStr = '';

                              if (
                                currentVideoId ===
                                run.navigationEndpoint.watchEndpoint.videoId
                              ) {
                                subItem.commentRenderer.isTimeLine = 'timeline';
                              } else {
                                targetStr =
                                  ' target="_blank" rel="noopener noreferrer" ';
                              }

                              renderFullText += `<a class="ycs-cpointer ycs-gotochat-video" href="https://www.youtube.com/watch?v=${
                                run.navigationEndpoint.watchEndpoint.videoId
                              }&t=${
                                run.navigationEndpoint.watchEndpoint
                                  .startTimeSeconds
                              }s" data-offsetvideo="${
                                run.navigationEndpoint.watchEndpoint
                                  .startTimeSeconds
                              }" data-video-id="${
                                run.navigationEndpoint.watchEndpoint.videoId
                              }"${targetStr}>${run.text || ''}</a>`;
                            } else {
                              if (run.navigationEndpoint.browseEndpoint) {
                                renderFullText += `<a class="ycs-cpointer ycs-comment-link" href="${
                                  run.navigationEndpoint.browseEndpoint
                                    .canonicalBaseUrl
                                }" target="_blank">${run.text || ''}</a>`;
                              } else if (run.navigationEndpoint.urlEndpoint) {
                                renderFullText += `<a class="ycs-cpointer ycs-comment-link" href="${
                                  run.navigationEndpoint.urlEndpoint.url
                                }" target="_blank">${run.text || ''}</a>`;
                              } else if (
                                run.navigationEndpoint.commandMetadata &&
                                run.navigationEndpoint.commandMetadata
                                  .webCommandMetadata
                              ) {
                                renderFullText += `<a class="ycs-cpointer ycs-comment-link" href="${
                                  run.navigationEndpoint.commandMetadata
                                    .webCommandMetadata.url
                                }" target="_blank">${run.text || ''}</a>`;
                              } else {
                                renderFullText += run.text || '';
                              }
                            }
                          }
                        } catch (t) {
                          renderFullText += run.text || '';
                        }
                      }
                      if (subItem.commentRenderer.contentText) {
                        subItem.commentRenderer.contentText.fullText = fullText;
                        subItem.commentRenderer.contentText.renderFullText =
                          renderFullText;
                      }
                      subItem.typeComment = 'R';
                      subItem.originComment =
                        item.commentThreadRenderer.comment;
                      a.push(i(subItem));
                      Kt(a.length, t);
                    }
                  }
                }
              } catch (e) {}
            });
          }
        } catch (e) {
          continue;
        }
      }
    }
    function getFrameworkUpdatesById(data) {
      const mutations = data?.frameworkUpdates?.entityBatchUpdate?.mutations;

      if (!mutations || mutations.length === 0) {
        return {};
      }

      return mutations.reduce((acc, mutation) => {
        const commentEntityPayload = mutation.payload?.commentEntityPayload;
        if (commentEntityPayload) {
          const { properties } = commentEntityPayload;
          const commentId = properties?.commentId;
          if (commentId) {
            acc[commentId] = commentEntityPayload;
          }
        }

        // support commentSurfaceEntityKey
        const commentSurfaceEntityPayload =
          mutation.payload?.commentSurfaceEntityPayload;
        if (commentSurfaceEntityPayload) {
          const { key } = commentSurfaceEntityPayload;
          acc[key] = commentSurfaceEntityPayload;
        }

        // support engagementToolbarStateEntityKey
        const engagementToolbarStateEntityPayload =
          mutation.payload?.engagementToolbarStateEntityPayload;
        if (engagementToolbarStateEntityPayload) {
          const { key } = engagementToolbarStateEntityPayload;
          acc[key] = engagementToolbarStateEntityPayload;
        }
        return acc;
      }, {});
    }
    /**
     * Migrate command runs to previous version
     * @param {string} baseText
     * @param {Array} runs
     * @returns {Array}
     *
     * @example
     * migrateRuns('Hello world', [{startIndex: 6, length: 5, navigationEndpoint: {watchEndpoint: {videoId: 'abc'}}}])
     * [{text: 'Hello '}, {text: 'world', navigationEndpoint: {watchEndpoint: {videoId: 'abc'}}}]
     */
    function migrateRuns(baseText, rawRuns) {
      let curr = 0;
      let currRun;
      const runs = [];
      while ((currRun = rawRuns.shift())) {
        const { startIndex, length } = currRun;
        if (curr !== startIndex) {
          runs.push({
            text: baseText.slice(curr, startIndex),
          });
        }
        runs.push(currRun);
        curr = startIndex + length;
      }
      if (curr < baseText.length) {
        runs.push({
          text: baseText.slice(curr),
        });
      }
      return runs;
    }
    /**
     * Generate comment object from update
     */
    function generateCommentObject({
      commentId,
      update,
      surfaceUpdate,
      toolbarStateUpdate,
    }) {
      const propContent = update.properties.content;

      const baseText = propContent.content;
      let runs = [
        {
          // full text as first run
          text: baseText,
        },
      ];

      // from commandRuns to runs
      const rawRuns = [];
      if (propContent.commandRuns) {
        propContent.commandRuns.forEach((commandRun) => {
          const watchEndpoint = qt(
            () => commandRun.onTap.innertubeCommand.watchEndpoint
          );
          const browseEndpoint = qt(
            () => commandRun.onTap.innertubeCommand.browseEndpoint
          );
          if (watchEndpoint || browseEndpoint) {
            const { startIndex, length } = commandRun;

            let text;
            if (typeof startIndex === 'number' && typeof length === 'number') {
              text = propContent.content.slice(startIndex, startIndex + length);
            }

            if (watchEndpoint) {
              const { videoId, startTimeSeconds } = watchEndpoint;
              rawRuns.push({
                text,
                startIndex,
                length,
                navigationEndpoint: {
                  watchEndpoint: {
                    videoId,
                    startTimeSeconds: startTimeSeconds || 0,
                  },
                },
              });
            } else if (browseEndpoint) {
              const { browseId } = browseEndpoint;
              const url = qt(
                () =>
                  commandRun.onTap.innertubeCommand.commandMetadata
                    .webCommandMetadata.url
              );
              const canonicalBaseUrl = url
                ? `https://www.youtube.com${url}`
                : '';
              rawRuns.push({
                text,
                startIndex,
                length,
                navigationEndpoint: {
                  watchEndpoint: {
                    // error tolerance
                    startTimeSeconds: -1,
                  },
                  browseEndpoint: {
                    browseId,
                    canonicalBaseUrl,
                  },
                },
              });
            }
            return;
          }
        });
      }
      if (propContent.attachmentRuns) {
        propContent.attachmentRuns.forEach((attachmentRun) => {
          const image = qt(() => attachmentRun.element.type.imageType.image);
          if (!image) {
            return;
          }
          const { startIndex, length } = attachmentRun;

          let text;
          if (typeof startIndex === 'number' && typeof length === 'number') {
            text = propContent.content.slice(startIndex, startIndex + length);
          }

          const imageSource = image.sources[0];
          const imageMargin = qt(
            () => attachmentRun.element.properties.layoutProperties.margin
          );
          rawRuns.push({
            text,
            startIndex,
            length,
            attachment: {
              image: {
                width: imageSource.width,
                height: imageSource.height,
                url: imageSource.url,
                margin: {
                  left: qt(() => imageMargin.left.value) || 0,
                  right: qt(() => imageMargin.right.value) || 0,
                },
              },
            },
          });
        });
      }
      // sort runs by startIndex
      rawRuns.sort((a, b) => a.startIndex - b.startIndex);

      // migrate runs
      runs = [...migrateRuns(baseText, rawRuns)];

      const { author } = update;

      const likeCountLiked = update.toolbar.likeCountLiked;
      let likeCount;
      if (likeCountLiked === '1') {
        likeCount = 0;
      } else {
        // likeCountLike is always one more than actual like count
        const { number, multiply } = parseFormattedNumber(likeCountLiked);
        if (multiply === 1) {
          likeCount = number - 1;
        } else {
          likeCount = number;
        }
      }

      let replyCount;
      {
        const { number } = parseFormattedNumber(
          update.toolbar.replyCount || '0'
        );
        replyCount = number;
      }

      const comment = {
        commentRenderer: {
          commentId,
          likeCount,
          replyCount,
          authorText: {
            simpleText: author.displayName,
          },
          authorThumbnail: {
            thumbnails: [
              {
                url: author.avatarThumbnailUrl,
              },
            ],
          },
          authorEndpoint: author.channelCommand.innertubeCommand,
          contentText: {
            runs,
            fullText: baseText,
          },
        },
      };
      if (surfaceUpdate) {
        comment.commentRenderer.publishedTimeText = {
          runs: [
            {
              text: update.properties.publishedTime,
              navigationEndpoint: {
                commandMetadata:
                  surfaceUpdate.publishedTimeCommand.innertubeCommand
                    .commandMetadata,
              },
            },
          ],
        };
        if (surfaceUpdate.pdgCommentChip) {
          comment.commentRenderer.pdgCommentChip = {
            chipText:
              surfaceUpdate.pdgCommentChip.pdgCommentChipRenderer.chipText
                .simpleText,
          };
        }
      }
      if (
        toolbarStateUpdate &&
        toolbarStateUpdate.heartState === 'TOOLBAR_HEART_STATE_HEARTED'
      ) {
        comment.commentRenderer.creatorHeart = {
          tooltip: update.toolbar.heartActiveTooltip,
        };
      }

      if (author.sponsorBadgeUrl) {
        comment.commentRenderer.sponsorCommentBadge = {
          sponsorCommentBadgeRenderer: {
            tooltip: author.sponsorBadgeA11y,
            customBadge: {
              thumbnails: [
                {
                  url: author.sponsorBadgeUrl,
                },
              ],
            },
          },
        };
      }

      if (author.isVerified) {
        comment.commentRenderer.verifiedAuthor = true;
      }

      if (author.isCreator) {
        comment.commentRenderer.authorIsChannelOwner = true;
      }

      return comment;
    }
    function migrateContinuationItems(
      continuationItems,
      frameworkUpdatesByCommentId
    ) {
      return continuationItems
        .map((item) => {
          let newItem = { ...item };
          if (!item.commentThreadRenderer) {
            return item;
          }

          const vm =
            item.commentThreadRenderer.commentViewModel.commentViewModel;
          const commentId = vm.commentId;
          const update = frameworkUpdatesByCommentId[commentId];

          const commentSurfaceKey = vm.commentSurfaceKey;
          const surfaceUpdate = frameworkUpdatesByCommentId[commentSurfaceKey];

          const engagementToolbarStateKey = vm.toolbarStateKey;
          const toolbarStateUpdate =
            frameworkUpdatesByCommentId[engagementToolbarStateKey];

          if (!update) {
            return item;
          }

          const comment = generateCommentObject({
            commentId,
            update,
            surfaceUpdate,
            toolbarStateUpdate,
          });

          newItem.commentThreadRenderer = {
            ...newItem.commentThreadRenderer,
            comment,
          };

          // check if replies continuation exists
          if (item.commentThreadRenderer.replies) {
            const continuationEndpoint = qt(
              () =>
                item.commentThreadRenderer.replies.commentRepliesRenderer
                  .contents[0].continuationItemRenderer.continuationEndpoint
            );
            if (continuationEndpoint) {
              // add structure for replies continuation
              newItem.commentThreadRenderer.replies = {
                ...newItem.commentThreadRenderer.replies,
                commentRepliesRenderer: {
                  continuations: [
                    {
                      nextContinuationData: {
                        continuation:
                          continuationEndpoint.continuationCommand.token,
                        clickTrackingParams:
                          continuationEndpoint.clickTrackingParams,
                      },
                    },
                  ],
                },
              };
            }
          }

          return newItem;
        })
        .filter((item) => !!item);
    }
    function migrateContinuationSubItems(
      continuationItems,
      frameworkUpdatesById
    ) {
      return continuationItems
        .map((item) => {
          let newItem = { ...item };
          if (!item.commentViewModel) {
            return item;
          }

          const vm = item.commentViewModel;
          const commentId = vm.commentId;
          const update = frameworkUpdatesById[commentId];

          const commentSurfaceKey = vm.commentSurfaceKey;
          const surfaceUpdate = frameworkUpdatesById[commentSurfaceKey];

          if (!update) {
            return item;
          }

          const comment = generateCommentObject({
            commentId,
            update,
            surfaceUpdate,
          });

          newItem.commentRenderer = comment.commentRenderer;

          return newItem;
        })
        .filter((item) => !!item);
    }
    try {
      let e, o;
      try {
        const t = await r();
        let i;
        if (
          ((i = t.clickTrackingParams
            ? en(window, {
                continue: t.continue,
                clickTrackingParams: t.clickTrackingParams,
              })
            : en(window, {
                continue: qt(() =>
                  objectScan(
                    [
                      '**.sortMenu.sortFilterSubMenuRenderer.subMenuItems[?].serviceEndpoint.continuationCommand.token',
                    ],
                    {
                      joined: !0,
                      rtn: 'value',
                      abort: !0,
                    }
                  )(window.ytInitialData)
                ),
                clickTrackingParams: qt(() =>
                  objectScan(
                    [
                      '**.sortMenu.sortFilterSubMenuRenderer.subMenuItems[?].serviceEndpoint.clickTrackingParams',
                    ],
                    {
                      joined: !0,
                      rtn: 'value',
                      abort: !0,
                    }
                  )(window.ytInitialData)
                ),
              })),
          i &&
            (e = await fetch(
              `https://www.youtube.com/youtubei/v1/next?key=${nn()}`,
              {
                ...i,
                signal: n,
                cache: 'no-store',
              }
            )),
          200 !== (null == e ? void 0 : e.status))
        )
          return [];
        {
          const t = await e.json();
          o = t;
        }
      } catch (e) {
        return [];
      }
      let i = qt(
        () =>
          o.onResponseReceivedEndpoints[1].reloadContinuationItemsCommand
            .continuationItems
      );
      // temporarily store last response
      let contData;
      for (; (null == i ? void 0 : i.length) > 0; ) {
        var l, d, u;
        const updatesById = getFrameworkUpdatesById(contData || o);
        i = migrateContinuationItems(i, updatesById);
        await processComments(i, t);
        const e = i[i.length - 1];
        if (
          null == e ||
          null === (l = e.continuationItemRenderer) ||
          void 0 === l ||
          null === (d = l.continuationEndpoint) ||
          void 0 === d ||
          null === (u = d.continuationCommand) ||
          void 0 === u
            ? void 0
            : u.token
        ) {
          var h, m, p;
          const t = {
              continue:
                null == e ||
                null === (h = e.continuationItemRenderer) ||
                void 0 === h ||
                null === (m = h.continuationEndpoint) ||
                void 0 === m ||
                null === (p = m.continuationCommand) ||
                void 0 === p
                  ? void 0
                  : p.token,
            },
            o = en(window, t),
            r = await Ft(
              `https://www.youtube.com/youtubei/v1/next?key=${nn()}`,
              {
                ...o,
                signal: n,
                cache: 'no-store',
              }
            );
          if (200 === (null == r ? void 0 : r.status)) {
            const e = await r.json();
            i =
              qt(
                () =>
                  e.onResponseReceivedEndpoints[0].appendContinuationItemsAction
                    .continuationItems
              ) || [];
            // update last response
            contData = e;
          } else i = [];
        } else i = [];
      }
    } catch (e) {
      return a;
    }
    return await s.onIdle(), a;
  }
  function ln(e) {
    try {
      const t = new URL(window.location.href),
        n = `https://youtu.be/${t.searchParams.get('v')}?t=${
          (function (e) {
            try {
              return e && e > 0 ? parseInt(e / 1e3, 10) : void 0;
            } catch (e) {
              return;
            }
          })(e) || 0
        }`;
      return n;
    } catch (e) {
      return;
    }
  }
  function postTextMessage(e, t) {
    try {
      ('string' != typeof t && 'number' != typeof t) ||
        'string' != typeof e ||
        window.postMessage(
          {
            type: e.toString(),
            text: t.toString(),
          },
          window.location.origin
        );
    } catch (e) {}
  }
  function un(e) {
    if (e && e > 0) {
      const t = new Date(e / 1e3);
      return `${t.toISOString().split('T')[0]}, ${t
        .toISOString()
        .split('T')[1]
        .split('.')[0]
        .slice(0, 5)}`;
    }
    return '';
  }
  function hn(e, t, n) {
    try {
      const o = document.createElement('a'),
        r = new Blob([e], {
          type: n,
        });
      (o.href = URL.createObjectURL(r)),
        (o.download = t),
        o.click(),
        URL.revokeObjectURL(o.href);
    } catch (e) {
      return;
    }
  }
  function mn(e) {
    if (Array.isArray(e))
      try {
        let h = '',
          m = 0;
        const p = new Set(),
          f = new Set();
        for (const t of e)
          'C' === (null == t ? void 0 : t.typeComment)
            ? ((t.commentRenderer.ycsReplies = []), p.add(t))
            : 'R' === (null == t ? void 0 : t.typeComment) && f.add(t);
        for (const e of p)
          if (qt(() => e.commentRenderer.replyCount > 0))
            for (const t of f)
              (null == t
                ? void 0
                : t.originComment.commentRenderer.commentId) ===
                e.commentRenderer.commentId &&
                (e.commentRenderer.ycsReplies.push(t), f.delete(t));
        const v = (e) => {
            try {
              var t, n, o;
              if (
                null == e ||
                null === (t = e.commentRenderer) ||
                void 0 === t ||
                null === (n = t.sponsorCommentBadge) ||
                void 0 === n ||
                null === (o = n.sponsorCommentBadgeRenderer) ||
                void 0 === o
                  ? void 0
                  : o.tooltip
              ) {
                return ` | member: ${e.commentRenderer.sponsorCommentBadge.sponsorCommentBadgeRenderer.tooltip}`;
              }
              return '';
            } catch (e) {
              return '';
            }
          },
          y = (e) => {
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
          g = (e) => {
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
              var t, n;
              if (
                (null == e ||
                null === (t = e.commentRenderer) ||
                void 0 === t ||
                null === (n = t.ycsReplies) ||
                void 0 === n
                  ? void 0
                  : n.length) > 0
              ) {
                let t = '\nReplies:\n';
                for (const n of e.commentRenderer.ycsReplies) {
                  var o, r, i, a, s, c, l, d, u, h, p;
                  m++,
                    (t += `\n${y(n)}\n${
                      (null == n ||
                      null === (o = n.commentRenderer) ||
                      void 0 === o ||
                      null === (r = o.authorText) ||
                      void 0 === r
                        ? void 0
                        : r.simpleText) || ''
                    }\nyoutube.com${
                      (null == n ||
                      null === (i = n.commentRenderer) ||
                      void 0 === i ||
                      null === (a = i.authorEndpoint) ||
                      void 0 === a ||
                      null === (s = a.commandMetadata) ||
                      void 0 === s ||
                      null === (c = s.webCommandMetadata) ||
                      void 0 === c
                        ? void 0
                        : c.url) || ''
                    }\n\nyoutube.com${
                      qt(
                        () =>
                          n.commentRenderer.publishedTimeText.runs[0]
                            .navigationEndpoint.commandMetadata
                            .webCommandMetadata.url
                      ) || ''
                    }\n${
                      qt(
                        () => n.commentRenderer.publishedTimeText.runs[0].text
                      ) || ''
                    } | like: ${
                      (null == n ||
                      null === (l = n.commentRenderer) ||
                      void 0 === l
                        ? void 0
                        : l.likeCount) ||
                      (null == n ||
                      null === (d = n.commentRenderer) ||
                      void 0 === d ||
                      null === (u = d.voteCount) ||
                      void 0 === u
                        ? void 0
                        : u.simpleText) ||
                      0
                    }${g(n)}${v(n)}\n\n${
                      (null == n ||
                      null === (h = n.commentRenderer) ||
                      void 0 === h ||
                      null === (p = h.contentText) ||
                      void 0 === p
                        ? void 0
                        : p.fullText) || ''
                    }\n\n                        `);
                }
                return t;
              }
              return '';
            } catch (e) {
              return '';
            }
          };
        for (const e of p)
          try {
            var t, n, o, r, i, a, s, c, l, d, u;
            m++,
              (h += `\n\n#####\n\n${y(e)}\n${
                (null == e ||
                null === (t = e.commentRenderer) ||
                void 0 === t ||
                null === (n = t.authorText) ||
                void 0 === n
                  ? void 0
                  : n.simpleText) || ''
              }\nyoutube.com${
                (null == e ||
                null === (o = e.commentRenderer) ||
                void 0 === o ||
                null === (r = o.authorEndpoint) ||
                void 0 === r ||
                null === (i = r.commandMetadata) ||
                void 0 === i ||
                null === (a = i.webCommandMetadata) ||
                void 0 === a
                  ? void 0
                  : a.url) || ''
              }\n\nyoutube.com${
                qt(
                  () =>
                    e.commentRenderer.publishedTimeText.runs[0]
                      .navigationEndpoint.commandMetadata.webCommandMetadata.url
                ) || ''
              }\n${
                qt(() => e.commentRenderer.publishedTimeText.runs[0].text) || ''
              } | like: ${
                (null == e || null === (s = e.commentRenderer) || void 0 === s
                  ? void 0
                  : s.likeCount) ||
                (null == e ||
                null === (c = e.commentRenderer) ||
                void 0 === c ||
                null === (l = c.voteCount) ||
                void 0 === l
                  ? void 0
                  : l.simpleText) ||
                0
              }${g(e)}${v(e)}\n\n${
                (null == e ||
                null === (d = e.commentRenderer) ||
                void 0 === d ||
                null === (u = d.contentText) ||
                void 0 === u
                  ? void 0
                  : u.fullText) || ''
              }\n${w(e)}\n#####\n`);
          } catch (e) {
            continue;
          }
        return {
          count: m,
          html: h,
        };
      } catch (e) {
        return;
      }
  }
  function pn(e) {
    if (Array.isArray(e))
      try {
        let t = '',
          n = 0;
        for (const o of e)
          try {
            n++,
              (t += `\n\n#####\n\n${
                qt(
                  () =>
                    o.replayChatItemAction.actions[0].addChatItemAction.item
                      .liveChatTextMessageRenderer.authorName.simpleText
                ) || ''
              }\nyoutube.com/channel/${
                qt(
                  () =>
                    o.replayChatItemAction.actions[0].addChatItemAction.item
                      .liveChatTextMessageRenderer.authorExternalChannelId
                ) || ''
              }\n\ndate: ${
                qt(() =>
                  new Date(
                    o.replayChatItemAction.actions[0].addChatItemAction.item
                      .liveChatTextMessageRenderer.timestampUsec / 1e3
                  )
                    .toISOString()
                    .slice(0, -5)
                ) || ''
              }\n\n${
                qt(
                  () =>
                    o.replayChatItemAction.actions[0].addChatItemAction.item
                      .liveChatTextMessageRenderer.purchaseAmountText.simpleText
                )
                  ? 'donated: ' +
                    o.replayChatItemAction.actions[0].addChatItemAction.item
                      .liveChatTextMessageRenderer.purchaseAmountText
                      .simpleText +
                    '\n'
                  : ''
              }\n${
                qt(
                  () =>
                    o.replayChatItemAction.actions[0].addChatItemAction.item
                      .liveChatTextMessageRenderer.message.fullText
                ) || ''
              }\n\n#####\n`);
          } catch (e) {
            continue;
          }
        return {
          count: n,
          html: t,
        };
      } catch (e) {
        return;
      }
  }
  function fn(e) {
    if (Array.isArray(e)) {
      try {
        let formattedTranscript = '';
        let count = 0;
        for (const item of e) {
          try {
            let time =
              item.transcriptCueGroupRenderer.formattedStartOffset.simpleText ||
              0;
            let cue =
              qt(
                () =>
                  item.transcriptCueGroupRenderer.cues[0].transcriptCueRenderer
                    .cue.simpleText
              ) || '';
            count++;
            formattedTranscript += `\n\n#####\n\nTime: ${time}\n\n${cue}\n\n#####\n`;
          } catch (error) {
            continue;
          }
        }
        return {
          count: count,
          html: formattedTranscript,
        };
      } catch (error) {
        return;
      }
    }
  }
  function vn() {
    try {
      if ('undefined' == typeof document)
        return {
          supported: !1,
        };
      const e = document.createElement('video');
      return document.pictureInPictureEnabled && !e.disablePictureInPicture
        ? {
            supported: !0,
            request: (e) => e.requestPictureInPicture(),
            exit: () => document.exitPictureInPicture(),
            isActive: (e) => e === document.pictureInPictureElement,
          }
        : 'function' == typeof e.webkitSetPresentationMode
        ? /ipad|iphone/i.test(window.navigator.userAgent)
          ? {
              supported: !1,
            }
          : {
              supported: !0,
              request: (e) => e.webkitSetPresentationMode('picture-in-picture'),
              exit: (e) => e.webkitSetPresentationMode('inline'),
              isActive: (e) =>
                'picture-in-picture' === e.webkitPresentationMode,
            }
        : {
            supported: !1,
          };
    } catch (e) {
      return {
        supported: !1,
      };
    }
  }
  function markElements(selector, searchText) {
    try {
      if (
        !searchText ||
        !selector ||
        !(null == ycsOptions ? void 0 : ycsOptions.highlightText)
      ) {
        return;
      }
      if (document.getElementById('ycs_extended_search').checked) {
        return;
      }

      if (!ycsOptions.highlightExact) {
        const magic = (e) => {
          try {
            if ('string' != typeof e) return;
            let t = '';
            return (
              e.length <= 2
                ? (t = e)
                : e.length >= 3 && e.length <= 5
                ? (t = e.slice(0, -1))
                : e.length >= 6 && e.length <= 8
                ? (t = e.slice(0, -3))
                : e.length >= 9 && (t = e.slice(0, -4)),
              t
            );
          } catch (t) {
            return e;
          }
        };

        if (searchText.split(' ').length === 1) {
          searchText = magic(searchText) || searchText;
        } else if (searchText.split(' ').length > 1) {
          let modifiedSearchText = '';
          for (const word of searchText.split(' ')) {
            modifiedSearchText += magic(word) + ' ';
          }
          searchText = modifiedSearchText.trim();
        }
      }

      const markOptions = {
        element: 'span',
        className: 'ycs-mark-words',
        separateWordSearch: !ycsOptions.highlightExact,
      };

      if (typeof selector !== 'string') {
        const titleElements = new (e(k))(
          selector?.querySelectorAll('.ycs-head__title')
        );
        const textElements = new (e(k))(
          selector?.querySelectorAll('.ycs-comment__main-text')
        );
        titleElements.mark(searchText, markOptions);
        textElements.mark(searchText, markOptions);
      } else {
        const titleElements = new (e(k))(`${selector} .ycs-head__title`);
        const textElements = new (e(k))(`${selector} .ycs-comment__main-text`);
        titleElements.mark(searchText, markOptions);
        textElements.mark(searchText, markOptions);
      }
    } catch (error) {}
  }
  function saveCache(e, t, n) {
    try {
      window.postMessage(
        {
          type: 'YCS_CACHE_STORAGE_SET',
          body: {
            url: t,
            videoId: getVideoId(Xt(t)),
            date: new Date().getTime(),
            titleVideo: n,
            comments: e.comments,
            commentsChat: e.commentsChat,
            commentsTrVideo: e.commentsTrVideo,
          },
        },
        window.location.origin
      );
    } catch (e) {}
  }
  function wn(e, t, n = !0, o) {
    if (!e) return;
    const r = (e) => {
        try {
          if ('string' == typeof e || 'number' == typeof e)
            return `\n                    <div class="ycs-wrap-like">\n                        <span class="ycs-icon-like">\n                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" preserveAspectRatio="xMidYMid meet">\n                                <g>\n                                    <path\n                                        d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-1.91l-.01-.01L23 10z"></path>\n                                </g>\n                            </svg>\n                        </span>\n                        <span class="ycs-like-count">${e}</span>\n                    </div>\n                `;
        } catch (e) {}
        return '';
      },
      i = (e) => {
        try {
          var t, n, o, r;
          if (
            null === (t = e.item) ||
            void 0 === t ||
            null === (n = t.commentRenderer) ||
            void 0 === n ||
            null === (o = n.sponsorCommentBadge) ||
            void 0 === o ||
            null === (r = o.sponsorCommentBadgeRenderer) ||
            void 0 === r
              ? void 0
              : r.tooltip
          ) {
            const t =
              e.item.commentRenderer.sponsorCommentBadge
                .sponsorCommentBadgeRenderer.tooltip;
            return `\n                    <img alt="${t}" height="14" width="14"\n                         title="${t}"\n                         class="ycs-user-member"\n                         src="${
              qt(
                () =>
                  e.item.commentRenderer.sponsorCommentBadge
                    .sponsorCommentBadgeRenderer.customBadge.thumbnails[0].url
              ) || ''
            }" loading="lazy">\n                `;
          }
          return '';
        } catch (e) {
          return '';
        }
      },
      a = (e) => {
        try {
          var t, n;
          if (
            null == e ||
            null === (t = e.item) ||
            void 0 === t ||
            null === (n = t.commentRenderer) ||
            void 0 === n
              ? void 0
              : n.creatorHeart
          ) {
            return `\n                    <div class="ycs-heart-wrap" title="${e.item.commentRenderer.creatorHeart.tooltip}">\n                        <span class="ycs-heart-icon">❤</span>\n                    </div>\n                `;
          }
        } catch (e) {}
        return '';
      },
      s = (e) => {
        try {
          var t, n;
          if (
            null == e ||
            null === (t = e.item) ||
            void 0 === t ||
            null === (n = t.commentRenderer) ||
            void 0 === n
              ? void 0
              : n.verifiedAuthor
          ) {
            return `\n                    <div class="ycs-verified-wrap" title="${'Verified user'}">\n                        <span class="ycs-verified-icon">✔</span>\n                    </div>\n                `;
          }
        } catch (e) {}
        return '';
      },
      c = document.createElement('div');
    let l;
    if (
      ((c.id = 'ycs_wrap_comments'),
      (l = 'string' == typeof e ? document.querySelector(e) : e),
      null == l || l.appendChild(c),
      l)
    ) {
      const l = [],
        H = 200;
      let G = 0,
        q = 0;
      for (const e of t)
        try {
          var d,
            u,
            h,
            m,
            p,
            f,
            v,
            y,
            g,
            w,
            b,
            x,
            _,
            C,
            E,
            T,
            I,
            k,
            R,
            M,
            A,
            S,
            L,
            B,
            O,
            z,
            N,
            $,
            P,
            j,
            F,
            U;
          l.push({
            html: `\n                    <div id="ycs-number-comment-${++q}" class="ycs-render-comment">\n                        <div class="ycs-left">\n                            <a href="${
              (null === (d = e.item) ||
              void 0 === d ||
              null === (u = d.commentRenderer) ||
              void 0 === u ||
              null === (h = u.authorEndpoint) ||
              void 0 === h ||
              null === (m = h.commandMetadata) ||
              void 0 === m ||
              null === (p = m.webCommandMetadata) ||
              void 0 === p
                ? void 0
                : p.url) || ''
            }" target="_blank">\n                                <div class="ycs-render-img">\n                                    <img alt="${
              (null === (f = e.item) ||
              void 0 === f ||
              null === (v = f.commentRenderer) ||
              void 0 === v ||
              null === (y = v.authorText) ||
              void 0 === y
                ? void 0
                : y.simpleText) || ''
            }" height="40" width="40"\n                                    src="${
              qt(
                () => e.item.commentRenderer.authorThumbnail.thumbnails[0].url
              ) || ''
            }" loading="lazy">\n                                </div>\n                            </a>\n                        </div>\n                        <div class="ycs-comment-block">\n                            <div class="ycs-head-block__dib ycs-head-block ycs-head__title-main">\n                                <a class="ycs-head__title"\n                                href="${
              (null === (g = e.item) ||
              void 0 === g ||
              null === (w = g.commentRenderer) ||
              void 0 === w ||
              null === (b = w.authorEndpoint) ||
              void 0 === b ||
              null === (x = b.commandMetadata) ||
              void 0 === x ||
              null === (_ = x.webCommandMetadata) ||
              void 0 === _
                ? void 0
                : _.url) || ''
            }" target="_blank">\n                                    <span>\n                                        ${
              (null === (C = e.item) ||
              void 0 === C ||
              null === (E = C.commentRenderer) ||
              void 0 === E ||
              null === (T = E.authorText) ||
              void 0 === T
                ? void 0
                : T.simpleText) || ''
            }\n                                    </span>\n                                </a>\n                                ${s(
              e
            )}\n                                <div class="ycs-head-block__dib ycs-head-block__lh">\n                                    ${i(
              e
            )}\n                                    <a\n                                        class="ycs-datetime-goto"\n                                        href="${
              qt(
                () =>
                  e.item.commentRenderer.publishedTimeText.runs[0]
                    .navigationEndpoint.commandMetadata.webCommandMetadata.url
              ) || ''
            }" target="_blank" title="Open a comment, a reply, in a new window, for edit">\n                                            ${
              qt(() => e.item.commentRenderer.publishedTimeText.runs[0].text) ||
              ''
            }\n                                    </a>\n                                    ${a(
              e
            )}\n                                    ${r(
              (null == e ||
              null === (I = e.item) ||
              void 0 === I ||
              null === (k = I.commentRenderer) ||
              void 0 === k
                ? void 0
                : k.likeCount) ||
                (null == e ||
                null === (R = e.item) ||
                void 0 === R ||
                null === (M = R.commentRenderer) ||
                void 0 === M ||
                null === (A = M.voteCount) ||
                void 0 === A
                  ? void 0
                  : A.simpleText)
            )}\n                                    ${
              ((D =
                null == e ||
                null === (S = e.item) ||
                void 0 === S ||
                null === (L = S.commentRenderer) ||
                void 0 === L
                  ? void 0
                  : L.replyCount),
              (V =
                null === (B = e.item) ||
                void 0 === B ||
                null === (O = B.commentRenderer) ||
                void 0 === O
                  ? void 0
                  : O.commentId),
              'string' == typeof D || ('number' == typeof D && 0 !== D)
                ? `\n                <div class="ycs-wrap-like">\n                    <span class="ycs-icons__speech">\n                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="14px" height="14px">\n                            <linearGradient x1="12.686" x2="35.58" y1="4.592" y2="41.841"\n                                gradientUnits="userSpaceOnUse">\n                                <stop offset="0" stop-color="#21ad64" />\n                                <stop offset="1" stop-color="#088242" />\n                            </linearGradient>\n                            <path\n                                d="M42,8H6c-1.105,0-2,0.895-2,2v26c0,1.105,0.895,2,2,2h8v7.998\tc0,0.891,1.077,1.337,1.707,0.707L24.412,38H42c1.105,0,2-0.895,2-2V10C44,8.895,43.105,8,42,8z" />\n                        </svg>\n                    </span>\n                    <span class="ycs-like-count">${D}</span>\n                    <button class="ycs-open-reply" data-idcom="${V}" title="Open replies to the comment">+</button>\n                </div>\n            `
                : '')
            }\n                                    ${
              'R' ===
                (null === (z = e.item) || void 0 === z
                  ? void 0
                  : z.typeComment) && n
                ? `<span class="ycs-datetime-goto">(reply)</span><button id=${e.refIndex} title="Open the comment to the reply here." class="ycs-open-comment">▼</button>`
                : ''
            }\n                                </div>\n                            </div>\n                            <div class="ycs-comment__main-text">${
              (null === (N = e.item) ||
              void 0 === N ||
              null === ($ = N.commentRenderer) ||
              void 0 === $ ||
              null === (P = $.contentText) ||
              void 0 === P
                ? void 0
                : P.renderFullText) ||
              (null === (j = e.item) ||
              void 0 === j ||
              null === (F = j.commentRenderer) ||
              void 0 === F ||
              null === (U = F.contentText) ||
              void 0 === U
                ? void 0
                : U.fullText) ||
              ''
            }${
              IS_DEBUG ? ` [${[e.item._index, e.item._score]}]` : ''
            }</div>\n                        </div>\n                    </div>\n                `,
          });
        } catch (e) {
          continue;
        }
      try {
        const e = l.slice(G, H);
        if (e.length > 0) {
          for (const t of e) c.insertAdjacentHTML('beforeend', t.html), G++;
          if (l.length > H) {
            c.insertAdjacentHTML(
              'beforeend',
              `\n                        <div id="ycs_search_show_more" class="ycs-render-comment ycs-show_more_block">\n                            <div id="ycs__show-more-button"\n                                class="ycs-title">\n                                Show more, found comments (${
                l.length - G
              }) \n        <span class="ycs-icons__coll_exp">\n            <svg version="1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" enable-background="new 0 0 48 48">\n                <polygon fill="#2196F3" points="43,17.1 39.9,14 24,29.9 8.1,14 5,17.1 24,36"/>\n            </svg>    \n        </span>\n    \n                            </div>\n                        </div>\n                    `
            );
            const e = document.getElementById('ycs_search_show_more');
            null == e ||
              e.addEventListener('click', () => {
                const t = l.slice(G, H + G);
                if (t.length > 0) {
                  const n = Dt(15);
                  e.insertAdjacentHTML(
                    'beforebegin',
                    `<div class="${n}"></div>`
                  );
                  const r = document.getElementsByClassName(n)[0];
                  for (const e of t)
                    r.insertAdjacentHTML('beforeend', e.html), G++;
                  if ((o && markElements(`.${n}`, o), l.length - G <= 0)) {
                    const e = document.getElementById('ycs_search_show_more');
                    e && e.remove();
                  } else {
                    const e = document.querySelector(
                      '#ycs_search_show_more #ycs__show-more-button'
                    );
                    e &&
                      (e.innerHTML = `Show more, found comments (${
                        l.length - G
                      }) \n        <span class="ycs-icons__coll_exp">\n            <svg version="1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" enable-background="new 0 0 48 48">\n                <polygon fill="#2196F3" points="43,17.1 39.9,14 24,29.9 8.1,14 5,17.1 24,36"/>\n            </svg>    \n        </span>\n    `);
                  }
                }
              });
          }
        }
      } catch (e) {
        G = 0;
        for (const e of l) c.insertAdjacentHTML('beforeend', e.html);
      }
      o && markElements(e, o);
    }
    var D, V;
  }
  function bn(e, t, n) {
    if ('string' != typeof e) return;
    const o = document.createElement('div');
    o.id = 'ycs_wrap_comments_chat';
    const r = document.querySelector(e);
    null == r || r.appendChild(o);
    const i = (e) => {
        try {
          var t, n, o, r;
          return (
            null === (t = e.item) ||
            void 0 === t ||
            null === (n = t.replayChatItemAction) ||
            void 0 === n
              ? void 0
              : n.videoOffsetTimeMsec
          )
            ? `\n                    <span class="ycs-cpointer ycs-gotochat-video ycs_goto_chat" data-offsetvideo="${
                (null === (o = e.item) ||
                void 0 === o ||
                null === (r = o.replayChatItemAction) ||
                void 0 === r
                  ? void 0
                  : r.videoOffsetTimeMsec) || 0
              }"\n                        title="Go to the video by time.">\n                        \n        |▶\n     Go to: ${
                qt(
                  () =>
                    e.item.replayChatItemAction.actions[0].addChatItemAction
                      .item.liveChatTextMessageRenderer.timestampText.simpleText
                ) || ''
              }\n                    </span>\n                `
            : '';
        } catch (e) {
          return '';
        }
      },
      a = (e) => {
        try {
          const o = qt(
            () =>
              e.item.replayChatItemAction.actions[0].addChatItemAction.item
                .liveChatTextMessageRenderer.authorBadges
          );
          let r;
          var t;
          if ((null == o ? void 0 : o.length) > 0)
            for (const e of o)
              if (
                null == e ||
                null === (t = e.liveChatAuthorBadgeRenderer) ||
                void 0 === t
                  ? void 0
                  : t.customThumbnail
              ) {
                r = e;
                break;
              }
          if (o && r) {
            var n;
            const e =
              null == r ||
              null === (n = r.liveChatAuthorBadgeRenderer) ||
              void 0 === n
                ? void 0
                : n.tooltip;
            return `\n                    <img alt="${e}" height="14" width="14"\n                         title="${e}"\n                         class="ycs-user-member"\n                         src="${
              qt(
                () =>
                  r.liveChatAuthorBadgeRenderer.customThumbnail.thumbnails[0]
                    .url
              ) || ''
            }" loading="lazy">\n                `;
          }
          return '';
        } catch (e) {
          return '';
        }
      },
      s = (e) => {
        try {
          if (
            qt(() => {
              var t;
              return null ===
                (t =
                  e.item.replayChatItemAction.actions[0].addChatItemAction
                    .item) || void 0 === t
                ? void 0
                : t.liveChatTextMessageRenderer.verifiedAuthor;
            })
          ) {
            return `\n                    <div class="ycs-verified-wrap" title="${'Verified user'}">\n                        <span class="ycs-verified-icon">✔</span>\n                    </div>\n                `;
          }
        } catch (e) {}
        return '';
      };
    if (r) {
      const r = [],
        d = 200;
      let u = 0,
        h = 0;
      for (const e of t)
        try {
          var c, l;
          r.push({
            html: `\n                    <div id="ycs-number-comment-${++h}" class="ycs-render-comment">\n                        <div class="ycs-left">\n                            <a href="/channel/${
              qt(
                () =>
                  e.item.replayChatItemAction.actions[0].addChatItemAction.item
                    .liveChatTextMessageRenderer.authorExternalChannelId
              ) || ''
            }" target="_blank">\n                                <div class="ycs-render-img">\n                                    <img alt="${
              qt(
                () =>
                  e.item.replayChatItemAction.actions[0].addChatItemAction.item
                    .liveChatTextMessageRenderer.authorName.simpleText
              ) || ''
            }" height="40" width="40"\n                                    src="${
              qt(
                () =>
                  e.item.replayChatItemAction.actions[0].addChatItemAction.item
                    .liveChatTextMessageRenderer.authorPhoto.thumbnails[0].url
              ) || ''
            }" loading="lazy">\n                                </div>\n                            </a>\n                        </div>\n                        <div class="ycs-comment-block">\n                            <div class="ycs-head-block__dib ycs-head-block ycs-head__title-main">\n                                <a class="ycs-head__title""\n                                href="/channel/${
              qt(
                () =>
                  e.item.replayChatItemAction.actions[0].addChatItemAction.item
                    .liveChatTextMessageRenderer.authorExternalChannelId
              ) || ''
            }" target="_blank">\n                                    <span>\n                                    ${
              qt(
                () =>
                  e.item.replayChatItemAction.actions[0].addChatItemAction.item
                    .liveChatTextMessageRenderer.authorName.simpleText
              ) || ''
            }\n                                    </span>\n                                </a>\n                                ${s(
              e
            )}\n                                <div class="ycs-head-block__dib ycs-head-block__lh ycs-time-size">\n                                    ${a(
              e
            )}\n                                    <a\n                                        class="ycs-datetime-goto" title="GMT0"\n                                        href="${
              ln(
                null === (c = e.item) ||
                  void 0 === c ||
                  null === (l = c.replayChatItemAction) ||
                  void 0 === l
                  ? void 0
                  : l.videoOffsetTimeMsec
              ) || ''
            }" target="_blank">\n                                            ${un(
              qt(
                () =>
                  e.item.replayChatItemAction.actions[0].addChatItemAction.item
                    .liveChatTextMessageRenderer.timestampUsec
              )
            )}\n                                    </a>\n                                    <span class="ycs_chat_info">(chat)</span>\n                                    ${i(
              e
            )}\n                                </div>\n                            </div>\n                            <div class="ycs-comment__main-text">${
              qt(
                () =>
                  e.item.replayChatItemAction.actions[0].addChatItemAction.item
                    .liveChatTextMessageRenderer.message.renderFullText
              ) ||
              qt(
                () =>
                  e.item.replayChatItemAction.actions[0].addChatItemAction.item
                    .liveChatTextMessageRenderer.message.fullText
              ) ||
              ''
            }</div>\n                        </div>\n                    </div>\n                `,
          });
        } catch (e) {
          continue;
        }
      try {
        const t = r.slice(u, d);
        if (t.length > 0) {
          for (const e of t) o.insertAdjacentHTML('beforeend', e.html), u++;
          if (r.length > d) {
            o.insertAdjacentHTML(
              'beforeend',
              `\n                        <div id="ycs_search_chat_show_more" class="ycs-render-comment ycs-show_more_block">\n                            <div id="ycs__show-more-button"\n                                class="ycs-title">\n                                Show more, found chat replay (${
                r.length - u
              }) \n        <span class="ycs-icons__coll_exp">\n            <svg version="1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" enable-background="new 0 0 48 48">\n                <polygon fill="#2196F3" points="43,17.1 39.9,14 24,29.9 8.1,14 5,17.1 24,36"/>\n            </svg>    \n        </span>\n    \n                            </div>\n                        </div>\n                    `
            );
            const e = document.getElementById('ycs_search_chat_show_more');
            null == e ||
              e.addEventListener('click', () => {
                const t = r.slice(u, d + u);
                if (t.length > 0) {
                  const o = Dt(15);
                  e.insertAdjacentHTML(
                    'beforebegin',
                    `<div class="${o}"></div>`
                  );
                  const i = document.getElementsByClassName(o)[0];
                  for (const e of t)
                    i.insertAdjacentHTML('beforeend', e.html), u++;
                  if ((n && markElements(`.${o}`, n), r.length - u <= 0)) {
                    const e = document.getElementById(
                      'ycs_search_chat_show_more'
                    );
                    e && e.remove();
                  } else {
                    const e = document.querySelector(
                      '#ycs_search_chat_show_more #ycs__show-more-button'
                    );
                    e &&
                      (e.innerHTML = `Show more, found chat replay (${
                        r.length - u
                      }) \n        <span class="ycs-icons__coll_exp">\n            <svg version="1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" enable-background="new 0 0 48 48">\n                <polygon fill="#2196F3" points="43,17.1 39.9,14 24,29.9 8.1,14 5,17.1 24,36"/>\n            </svg>    \n        </span>\n    `);
                  }
                }
              });
          }
        }
        n && markElements(e, n);
      } catch (e) {
        u = 0;
        for (const e of r) o.insertAdjacentHTML('beforeend', e.html);
      }
    }
  }
  function xn(elementSelector, comments, searchText) {
    if (typeof elementSelector !== 'string') {
      return;
    }

    const container = document.createElement('div');
    container.id = 'ycs_wrap_comments_trvideo';

    const targetElement = document.querySelector(elementSelector);
    if (targetElement) {
      targetElement.appendChild(container);

      const renderedComments = [];
      const batchSize = 200;
      let startIndex = 0;
      let endIndex = 0;

      for (const comment of comments) {
        try {
          const startOffsetMs = qt(
            () =>
              comment.item.transcriptCueGroupRenderer.cues[0]
                .transcriptCueRenderer.startOffsetMs
          );
          const formattedStartOffset = qt(
            () =>
              comment.item.transcriptCueGroupRenderer.formattedStartOffset
                .simpleText
          );
          const cueText = qt(
            () =>
              comment.item.transcriptCueGroupRenderer.cues[0]
                .transcriptCueRenderer.cue.simpleText
          );

          renderedComments.push({
            html: `
              <div id="ycs-number-comment-${++endIndex}" class="ycs-render-comment ycs-oc-ml">
                <div class="ycs-left">
                  <a class="ycs-goto-video ycs-cpointer" href="${
                    ln(startOffsetMs) || ''
                  }" target="_blank" data-offsetvideo="${
              startOffsetMs || ''
            }" title="Go to the video by time.">
                    |▶ Go to: ${formattedStartOffset || 0}
                  </a>
                  <div class="ycs-head-block__dib ycs-head-block ycs-head__title-main">
                    <a class="ycs-datetime-goto" href="${
                      ln(startOffsetMs) || ''
                    }" target="_blank" title="Timestamp link">
                      Share link
                    </a>
                  </div>
                </div>
                <div class="ycs-comment__main-text ycs-clear">
                  ${cueText || ''}
                </div>
              </div>
            `,
          });
        } catch (error) {
          continue;
        }
      }

      try {
        const batch = renderedComments.slice(startIndex, batchSize);
        if (batch.length > 0) {
          for (const comment of batch) {
            container.insertAdjacentHTML('beforeend', comment.html);
            startIndex++;
          }

          if (renderedComments.length > batchSize) {
            container.insertAdjacentHTML(`
              <div id="ycs_search_trvideo_show_more" class="ycs-render-comment ycs-show_more_block">
                <div id="ycs__show-more-button" class="ycs-title">
                  Show more, found transcript video (${
                    renderedComments.length - startIndex
                  })
                  <span class="ycs-icons__coll_exp">
                    <svg version="1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" enable-background="new 0 0 48 48">
                      <polygon fill="#2196F3" points="43,17.1 39.9,14 24,29.9 8.1,14 5,17.1 24,36"/>
                    </svg>
                  </span>
                </div>
              </div>
            `);

            const showMoreButton = document.getElementById(
              'ycs_search_trvideo_show_more'
            );
            if (showMoreButton) {
              showMoreButton.addEventListener('click', () => {
                const nextBatch = renderedComments.slice(
                  startIndex,
                  batchSize + startIndex
                );
                if (nextBatch.length > 0) {
                  const uniqueClass = Dt(15);
                  container.insertAdjacentHTML(
                    'beforebegin',
                    `<div class="${uniqueClass}"></div>`
                  );
                  const batchContainer =
                    document.getElementsByClassName(uniqueClass)[0];
                  for (const comment of nextBatch) {
                    batchContainer.insertAdjacentHTML(
                      'beforeend',
                      comment.html
                    );
                    startIndex++;
                  }

                  if (searchText) {
                    markElements(`.${uniqueClass}`, searchText);
                  }

                  if (renderedComments.length - startIndex <= 0) {
                    const showMoreButton = document.getElementById(
                      'ycs_search_trvideo_show_more'
                    );
                    if (showMoreButton) {
                      showMoreButton.remove();
                    }
                  } else {
                    const showMoreButton = document.querySelector(
                      '#ycs_search_trvideo_show_more #ycs__show-more-button'
                    );
                    if (showMoreButton) {
                      showMoreButton.innerHTML = `Show more, found transcript video (${
                        renderedComments.length - startIndex
                      })
                        <span class="ycs-icons__coll_exp">
                          <svg version="1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" enable-background="new 0 0 48 48">
                            <polygon fill="#2196F3" points="43,17.1 39.9,14 24,29.9 8.1,14 5,17.1 24,36"/>
                          </svg>
                        </span>
                      `;
                    }
                  }
                }
              });
            }
          }
        }

        if (searchText) {
          markElements(elementSelector, searchText);
        }
      } catch (error) {
        startIndex = 0;
        for (const comment of renderedComments) {
          container.insertAdjacentHTML('beforeend', comment.html);
        }
      }
    }
  }
  function _n(e) {
    if ('string' != typeof e) return;
    const t = document.querySelector(e),
      n = document.createElement('div');
    (n.className = 'ycs-app'),
      (n.innerHTML = `\n        <div class="ycs-app-main">\n            <div class="ycs-head-search">\n                <p class="ycs-title ycs-left" id="ycs_title_information">\n                    YouTube Comment Search <span id="ycs-count-load"></span>\n                </p>\n                <div class="ycs_load_all ycs-right">\n                    <button id="ycs-load-all" class="ycs-btn-search ycs-title ycs_noselect" name="Load all comments" type="button"\n                        title="Load all available comments">\n                        Load all\n                    </button>\n                    <button id="ycs_load_stop" class="ycs_btn_load-stop ycs-title ycs_noselect" name="Stop load all comments" type="button"\n                        title="Stop load all available comments">\n                        stop\n                    </button>\n                </div>\n            </div>\n            <div class="ycs-title ycs-clear ycs-infobar">\n                <div id="ycs-desc__search">\n                    \n                    <div>\n                        <p class="ycs-infobar-field"><span id="ycs_status_cmnt">\n        <span class="ycs-icons">\n            <svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="48" height="48" viewBox="0 0 48 48">\n                <path fill="#ff6f02" d="M31 7.002l13 1.686L33.296 19 31 7.002zM17 41L4 39.314 14.704 29 17 41z"></path>\n                <path fill="#ff6f00"\n                    d="M8 24c0-8.837 7.163-16 16-16 1.024 0 2.021.106 2.992.29l.693-3.865C26.525 4.112 25.262 4.005 24 4.005c-11.053 0-20 8.947-20 20 0 4.844 1.686 9.474 4.844 13.051l3.037-2.629C9.468 31.625 8 27.987 8 24zM39.473 11.267l-3.143 2.537C38.622 16.572 40 20.125 40 24c0 8.837-7.163 16-16 16-1.029 0-2.033-.106-3.008-.292l-.676 3.771c1.262.21 2.525.317 3.684.317 11.053 0 20-8.947 20-20C44 19.375 42.421 14.848 39.473 11.267z">\n                </path>\n            </svg>\n        </span>\n    </span> Comments: </p>\n                        <div class="ycs-infobar__search">\n                            <span id="ycs_cmnts">0</span>\n\n                            <div class="ycs_infobar_btns ycs_noselect">\n                                <div class="ycs_load_wrap">\n                                    <button id="ycs-load-cmnts" class="ycs-btn-search ycs-title" name="Load comments" type="button"\n                                        title="Load comments">\n                                        load\n                                    </button>\n                                </div>\n                                <div class="ycs_open_wrap">\n                                    <button id="ycs_open_all_comments_window" class="ycs-btn-search ycs-title"\n                                        name="Open comments in the new popup window" title="Open comments in the new popup window">\n                                        open\n                                    </button>\n                                </div>\n                                <div class="ycs_save_wrap">\n                                    <button id="ycs_save_all_comments" class="ycs-btn-search ycs-title" name="Save comments to file"\n                                        title="Save comments to file">\n                                        save\n                                    </button>\n                                </div>\n                            </div>\n                        </div>\n                    </div>\n                    <span id="ycs_anchor_vmode" class="ycs-hidden"></span>\n                    <div>\n                        <p class="ycs-infobar-field"><span id="ycs_status_chat">\n        <span class="ycs-icons">\n            <svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="48" height="48" viewBox="0 0 48 48">\n                <path fill="#ff6f02" d="M31 7.002l13 1.686L33.296 19 31 7.002zM17 41L4 39.314 14.704 29 17 41z"></path>\n                <path fill="#ff6f00"\n                    d="M8 24c0-8.837 7.163-16 16-16 1.024 0 2.021.106 2.992.29l.693-3.865C26.525 4.112 25.262 4.005 24 4.005c-11.053 0-20 8.947-20 20 0 4.844 1.686 9.474 4.844 13.051l3.037-2.629C9.468 31.625 8 27.987 8 24zM39.473 11.267l-3.143 2.537C38.622 16.572 40 20.125 40 24c0 8.837-7.163 16-16 16-1.029 0-2.033-.106-3.008-.292l-.676 3.771c1.262.21 2.525.317 3.684.317 11.053 0 20-8.947 20-20C44 19.375 42.421 14.848 39.473 11.267z">\n                </path>\n            </svg>\n        </span>\n    </span> Chat replay: </p>\n                        <div class="ycs-infobar__search">\n                            <span id="ycs_cmnts_chat">0</span>\n\n                            <div class="ycs_infobar_btns ycs_noselect">\n                                <div class="ycs_load_wrap">\n                                    <button id="ycs-load-chat" class="ycs-btn-search ycs-title" name="Load chat replay" type="button"\n                                        title="Load chat replay">\n                                        load\n                                    </button>\n                                </div>\n                                <div class="ycs_open_wrap">\n                                    <button id="ycs_open_all_comments_chat_window" class="ycs-btn-search ycs-title"\n                                        name="Open chat comments in the new popup window"\n                                        title="Open chat comments in the new popup window">\n                                        open\n                                    </button>\n                                </div>\n                                <div class="ycs_save_wrap">\n                                    <button id="ycs_save_all_comments_chat" class="ycs-btn-search ycs-title"\n                                        name="Save chat comments to file" title="Save chat comments to file">\n                                        save\n                                    </button>\n                                </div>\n                            </div>\n                        </div>\n                    </div>\n                    <div>\n                        <p class="ycs-infobar-field"><span id="ycs_status_trvideo">\n        <span class="ycs-icons">\n            <svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="48" height="48" viewBox="0 0 48 48">\n                <path fill="#ff6f02" d="M31 7.002l13 1.686L33.296 19 31 7.002zM17 41L4 39.314 14.704 29 17 41z"></path>\n                <path fill="#ff6f00"\n                    d="M8 24c0-8.837 7.163-16 16-16 1.024 0 2.021.106 2.992.29l.693-3.865C26.525 4.112 25.262 4.005 24 4.005c-11.053 0-20 8.947-20 20 0 4.844 1.686 9.474 4.844 13.051l3.037-2.629C9.468 31.625 8 27.987 8 24zM39.473 11.267l-3.143 2.537C38.622 16.572 40 20.125 40 24c0 8.837-7.163 16-16 16-1.029 0-2.033-.106-3.008-.292l-.676 3.771c1.262.21 2.525.317 3.684.317 11.053 0 20-8.947 20-20C44 19.375 42.421 14.848 39.473 11.267z">\n                </path>\n            </svg>\n        </span>\n    </span> Transcript video: </p>\n                        <div class="ycs-infobar__search">\n                            <span id="ycs_cmnts_video">0</span>\n                            \n                            <div class="ycs_infobar_btns ycs_noselect">\n                                <div class="ycs_load_wrap">\n                                    <button id="ycs-load-transcript-video" class="ycs-btn-search ycs-title" name="Load transcript video"\n                                        type="button" title="Load transcript video">\n                                        load\n                                    </button>\n                                </div>\n                                <div class="ycs_open_wrap">\n                                    <button id="ycs_open_all_comments_trvideo_window" class="ycs-btn-search ycs-title"\n                                        name="Open transcript video in the new popup window"\n                                        title="Open transcript video in the new popup window">\n                                        open\n                                    </button>\n                                </div>\n                                <div class="ycs_save_wrap">\n                                    <button id="ycs_save_all_comments_trvideo" class="ycs-btn-search ycs-title"\n                                        name="Save transcript video to file" title="Save transcript video to file">\n                                        save\n                                    </button>\n                                </div>\n                            </div>\n                        </div>\n                    </div>\n                </div>\n\n            </div>\n            \n            <div id="ycs-search"></div>\n            <div><p class="ycs-title ycs_notify_box"><i></i></p></div>\n\n            <div class="ycs_extra_panel ycs-right">\n                <div>\n                    ${(() => {
        try {
          return vn().supported
            ? '<button id="ycs_view_mode" class="ycs-btn-search ycs-title ycs_noselect" name="View Mode" type="button" title="⌨ HOTKEY: [ Alt + ~ ] Viewer mode for more easier searches and video watching">V. Mode</button>'
            : '';
        } catch (e) {
          return '';
        }
      })()}\n                </div>\n            </div>\n\n            <div id="ycs-search-result" class="ycs-clear"></div>\n\n            <div id="ycs_modal_window" class="ycs_modal">\n                <div class="ycs_modal-content">\n                    <button id="ycs_btn_close_modal" class="ycs_btn_close ycs_noselect">✖</button>\n                    <div class="ycs_modal_body">\n                        <h2>Instructions</h2>\n                        <ol>\n                            <li>Open video on YouTube</li>\n                            <li>Find the YCS extension under the current video and click the button "Load all" or choose to load the categories\n                            </li>\n                            <li>Write the search query, press Enter or click the button Search</li>\n                        </ol>\n                        <hr />\n                        <h2>FAQ</h2>\n                        <ol>\n                            <li>\n                                <p><strong>How to like, reply to a comment?</strong><br />In the search results, click on the date (like, "2\n                                    months ago") of the comment and will open a new window with an active comment or reply under the video,\n                                    where you can do any action.</p>\n                            </li>\n                            <li>\n                                <p><strong>How do I find all timestamped comments and replies on a video?</strong><br />Click on the "Timestamps" button under the search bar.</p>\n                            </li>\n                            <li>\n                                <p><strong>How can I find addressed to user's comments, replies?</strong><br />Write&nbsp;<code>@</code>&nbsp;in\n                                    the input field.</p>\n                            </li>\n                            <li>\n                                <p><strong>How can I view the contents of the video transcript at a specific minute?</strong><br />You can write\n                                    a search query for Trp. Video, in the&nbsp;<code>mm:ss</code>&nbsp;format. For\n                                    example:<br /><code>:</code>&nbsp;- all the text of the video transcript.<br /><code>15:</code>&nbsp;- all\n                                    the text in the 15th minute.</p>\n                            </li>\n                            <li>\n                                <p><strong>How can I view the comment for a found reply?</strong><br />Click on\n                                    the&nbsp;<strong>▼</strong>&nbsp;button.</p>\n                            </li>\n                            <li>\n                                <p><strong>How can I see the all replies to the found comment?</strong><br />In the header of the found comment,\n                                    you can find the reply icon and the count, to see the replies click on\n                                    the&nbsp;<strong>+</strong>&nbsp;button.</p>\n                            </li>\n                            <li>\n                                <p><strong>How to use search in YouTube shorts?</strong><br />\n                                    Open a YouTube video short. Click badge <strong>YCS</strong> (right of the address bar) and click on the button <strong>Open YT short</strong>.</p>\n                            </li>\n                        </ol>\n\n                        <div>\n                            <p>You can use the search engine (YCS), while loading comments, chat, transcript video.</p>\n                            &nbsp;&nbsp;\n                        </div>\n\n                    </div>\n                </div>\n            </div>\n\n        </div>\n    `),
      null == t || t.appendChild(n);
  }
  function buildSearchUI(element) {
    element.innerHTML = `
      <div>
        <div>
          <div class="ycs-searchbox">
            <input
              title="Write the search query, press Enter or click the button Search."
              class="ycs-search__input ycs_noselect"
              type="text"
              id="ycs-input-search"
              placeholder="Search"
            />
          </div>
          <select
            title="Select a search category."
            name="ycs_search_select"
            id="ycs_search_select"
            class="ycs-btn-search ycs-title ycs-search-select ycs_noselect"
          >
            <option value="comments">Comments</option>
            <option value="chat">Chat replay</option>
            <option value="video">Trpt. video</option>
            <option selected value="all">All</option>
          </select>
          <button
            id="ycs_btn_search"
            class="ycs-btn-search ycs-title ycs_noselect"
            type="button"
          >
            Search
          </button><button
            id="ycs_btn_clear_search"
            class="ycs-btn-search ycs-title ycs_noselect ycs-hidden"
            type="button"
          >
            X
          </button>

          <div class="ycs-ext-search_block">
            <p id="ycs-search-total-result" class="ycs-title"></p>
            <div class="ycs-ext-search_option">
              <label
                for="ycs_extended_search"
                class="ycs_noselect ycs-title"
                title="Enables the use of unix-like search commands"
              >
                <input
                  type="checkbox"
                  name="ycs_extended_search"
                  id="ycs_extended_search"
                />
                <span class="ycs-ext-search_title">Extended search</span>
              </label>
              <div class="ycs-ext-search-opts">
                <fieldset>
                  <label
                    for="ycs_extended_search_title"
                    class="ycs_noselect ycs-title"
                    title="Extended search by title"
                  >
                    <input
                      type="radio"
                      id="ycs_extended_search_title"
                      name="ycs_ext_search_opts"
                      value="title"
                      disabled
                    />
                    <span class="ycs-ext-search_title">Title</span>
                  </label>

                  <label
                    for="ycs_extended_search_main"
                    class="ycs_noselect ycs-title"
                    title="Extended search by main text"
                  >
                    <input
                      type="radio"
                      id="ycs_extended_search_main"
                      name="ycs_ext_search_opts"
                      value="main"
                      disabled
                      checked
                    />
                    <span class="ycs-ext-search_title">Main</span>
                  </label>
                </fieldset>
              </div>
              <a
                href="https://github.com/sonigy/YCS#extended-search"
                class="ycs-title ycs-ext-search_link"
                target="_blank"
                rel="noopener noreferrer"
                title="How to use"
                >?</a
              >
            </div>
          </div>

          <button id="ycs_btn_open_modal" class="ycs_noselect" title="FAQ">?</button>
        </div>
        <div class="ycs-search-result-infobar">
          <div class="ycs-btn-panel ycs_noselect">
            <button
              id="ycs_btn_timestamps"
              data-sort="oldest"
              data-sort-chat="oldest"
              data-sort-all="oldest"
              class="ycs-btn-search ycs-title"
              name="timestamps"
              type="button"
              title="Show comments, replies, chat with time stamps (Newest)"
            >
              Time stamps

              <span class="ycs-icons">
                <svg
                  width="16px"
                  height="16px"
                  viewBox="0 0 16 16"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="currentColor"
                  class="bi bi-sort-down"
                >
                  <path
                    d="M3.5 2.5a.5.5 0 0 0-1 0v8.793l-1.146-1.147a.5.5 0 0 0-.708.708l2 1.999.007.007a.497.497 0 0 0 .7-.006l2-2a.5.5 0 0 0-.707-.708L3.5 11.293V2.5zm3.5 1a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zM7.5 6a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1h-5zm0 3a.5.5 0 0 0 0 1h3a.5.5 0 0 0 0-1h-3zm0 3a.5.5 0 0 0 0 1h1a.5.5 0 0 0 0-1h-1z"
                  />
                </svg>
              </span>
            </button>
            <button
              id="ycs_btn_author"
              data-sort="oldest"
              data-sort-chat="oldest"
              data-sort-all="oldest"
              class="ycs-btn-search ycs-title"
              name="author"
              type="button"
              title="Show comments, replies, chat from the author (Newest)"
            >
              Author

              <span class="ycs-icons">
                <svg
                  width="16px"
                  height="16px"
                  viewBox="0 0 16 16"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="currentColor"
                  class="bi bi-sort-down"
                >
                  <path
                    d="M3.5 2.5a.5.5 0 0 0-1 0v8.793l-1.146-1.147a.5.5 0 0 0-.708.708l2 1.999.007.007a.497.497 0 0 0 .7-.006l2-2a.5.5 0 0 0-.707-.708L3.5 11.293V2.5zm3.5 1a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zM7.5 6a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1h-5zm0 3a.5.5 0 0 0 0 1h3a.5.5 0 0 0 0-1h-3zm0 3a.5.5 0 0 0 0 1h1a.5.5 0 0 0 0-1h-1z"
                  />
                </svg>
              </span>
            </button>
            <button
              id="ycs_btn_heart"
              data-sort="oldest"
              data-sort-all="oldest"
              class="ycs-btn-search ycs-title"
              name="heart"
              type="button"
              title="Show comments and replies that the author likes (Newest)"
            >
              <span class="ycs-creator-heart_icon">❤</span>

              <span class="ycs-icons">
                <svg
                  width="16px"
                  height="16px"
                  viewBox="0 0 16 16"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="currentColor"
                  class="bi bi-sort-down"
                >
                  <path
                    d="M3.5 2.5a.5.5 0 0 0-1 0v8.793l-1.146-1.147a.5.5 0 0 0-.708.708l2 1.999.007.007a.497.497 0 0 0 .7-.006l2-2a.5.5 0 0 0-.707-.708L3.5 11.293V2.5zm3.5 1a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zM7.5 6a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1h-5zm0 3a.5.5 0 0 0 0 1h3a.5.5 0 0 0 0-1h-3zm0 3a.5.5 0 0 0 0 1h1a.5.5 0 0 0 0-1h-1z"
                  />
                </svg>
              </span>
            </button>
            <button
              id="ycs_btn_verified"
              data-sort="oldest"
              data-sort-chat="oldest"
              data-sort-all="oldest"
              class="ycs-btn-search ycs-title"
              name="verified"
              type="button"
              title="Show comments, replies and chat from a verified authors (Newest)"
            >
              <span class="ycs-creator-verified_icon">✔</span>

              <span class="ycs-icons">
                <svg
                  width="16px"
                  height="16px"
                  viewBox="0 0 16 16"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="currentColor"
                  class="bi bi-sort-down"
                >
                  <path
                    d="M3.5 2.5a.5.5 0 0 0-1 0v8.793l-1.146-1.147a.5.5 0 0 0-.708.708l2 1.999.007.007a.497.497 0 0 0 .7-.006l2-2a.5.5 0 0 0-.707-.708L3.5 11.293V2.5zm3.5 1a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zM7.5 6a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1h-5zm0 3a.5.5 0 0 0 0 1h3a.5.5 0 0 0 0-1h-3zm0 3a.5.5 0 0 0 0 1h1a.5.5 0 0 0 0-1h-1z"
                  />
                </svg>
              </span>
            </button>
            <button
              id="ycs_btn_links"
              data-sort="oldest"
              data-sort-chat="oldest"
              data-sort-trp="oldest"
              data-sort-all="oldest"
              class="ycs-btn-search ycs-title"
              name="links"
              type="button"
              title="Shows links in comments, replies, chat, video transcript (Newest)"
            >
              Links

              <span class="ycs-icons">
                <svg
                  width="16px"
                  height="16px"
                  viewBox="0 0 16 16"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="currentColor"
                  class="bi bi-sort-down"
                >
                  <path
                    d="M3.5 2.5a.5.5 0 0 0-1 0v8.793l-1.146-1.147a.5.5 0 0 0-.708.708l2 1.999.007.007a.497.497 0 0 0 .7-.006l2-2a.5.5 0 0 0-.707-.708L3.5 11.293V2.5zm3.5 1a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zM7.5 6a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1h-5zm0 3a.5.5 0 0 0 0 1h3a.5.5 0 0 0 0-1h-3zm0 3a.5.5 0 0 0 0 1h1a.5.5 0 0 0 0-1h-1z"
                  />
                </svg>
              </span>
            </button>
            <button
              id="ycs_btn_likes"
              class="ycs-btn-search ycs-title"
              name="likes"
              type="button"
              title="Show comments, replies by number of likes (sort largest to smallest)"
            >
              Likes
            </button>
            <button
              id="ycs_btn_replied_comments"
              class="ycs-btn-search ycs-title"
              name="replied"
              type="button"
              title="Show comments by number of replies (sort largest to smallest)"
            >
              Replied
            </button>
            <button
              id="ycs_btn_members"
              data-sort="oldest"
              data-sort-chat="oldest"
              data-sort-all="oldest"
              class="ycs-btn-search ycs-title"
              name="members"
              type="button"
              title="Show comments, replies, chat from channel members (Newest)"
            >
              Members

              <span class="ycs-icons">
                <svg
                  width="16px"
                  height="16px"
                  viewBox="0 0 16 16"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="currentColor"
                  class="bi bi-sort-down"
                >
                  <path
                    d="M3.5 2.5a.5.5 0 0 0-1 0v8.793l-1.146-1.147a.5.5 0 0 0-.708.708l2 1.999.007.007a.497.497 0 0 0 .7-.006l2-2a.5.5 0 0 0-.707-.708L3.5 11.293V2.5zm3.5 1a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zM7.5 6a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1h-5zm0 3a.5.5 0 0 0 0 1h3a.5.5 0 0 0 0-1h-3zm0 3a.5.5 0 0 0 0 1h1a.5.5 0 0 0 0-1h-1z"
                  />
                </svg>
              </span>
            </button>
            <button
              id="ycs_btn_donated"
              data-sort-chat="oldest"
              data-sort-all="oldest"
              class="ycs-btn-search ycs-title"
              name="donated"
              type="button"
              title="Show chat comments from users who have donated (Newest)"
            >
              Donated

              <span class="ycs-icons">
                <svg
                  width="16px"
                  height="16px"
                  viewBox="0 0 16 16"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="currentColor"
                  class="bi bi-sort-down"
                >
                  <path
                    d="M3.5 2.5a.5.5 0 0 0-1 0v8.793l-1.146-1.147a.5.5 0 0 0-.708.708l2 1.999.007.007a.497.497 0 0 0 .7-.006l2-2a.5.5 0 0 0-.707-.708L3.5 11.293V2.5zm3.5 1a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zM7.5 6a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1h-5zm0 3a.5.5 0 0 0 0 1h3a.5.5 0 0 0 0-1h-3zm0 3a.5.5 0 0 0 0 1h1a.5.5 0 0 0 0-1h-1z"
                  />
                </svg>
              </span>
            </button>
            <button
              id="ycs_btn_sort_first"
              data-sort="oldest"
              data-sort-chat="oldest"
              data-sort-trp="oldest"
              data-sort-all="oldest"
              class="ycs-btn-search ycs-title"
              name="sortFirst"
              type="button"
              title="Show all comments, chat, video transcript sorted by date (Newest)"
            >
              All

              <span class="ycs-icons">
                <svg
                  width="16px"
                  height="16px"
                  viewBox="0 0 16 16"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="currentColor"
                  class="bi bi-sort-down"
                >
                  <path
                    d="M3.5 2.5a.5.5 0 0 0-1 0v8.793l-1.146-1.147a.5.5 0 0 0-.708.708l2 1.999.007.007a.497.497 0 0 0 .7-.006l2-2a.5.5 0 0 0-.707-.708L3.5 11.293V2.5zm3.5 1a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zM7.5 6a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1h-5zm0 3a.5.5 0 0 0 0 1h3a.5.5 0 0 0 0-1h-3zm0 3a.5.5 0 0 0 0 1h1a.5.5 0 0 0 0-1h-1z"
                  />
                </svg>
              </span>
            </button>
            <button
              id="ycs_btn_random"
              class="ycs-btn-search ycs-title"
              name="random"
              type="button"
              title="Show a random comment"
            >
              Random
            </button>
            <button
              id="ycs_btn_clear"
              class="ycs-btn-search ycs-title ycs-search-clear ycs-hidden"
              name="clear"
              type="button"
              title="Clear search"
            >
              X
            </button>
          </div>
        </div>
      </div>

    `;
  }
  !(function () {
    const t = setInterval(() => {
      Yt() &&
        document.querySelector('#meta.style-scope.ytd-watch-flexy') &&
        (clearInterval(t),
        (function () {
          let t, n;
          function o() {
            if (!Yt()) return;
            n && window.removeEventListener('message', n);
            // counters to be used for action button display
            const countsAct = {
                comments: 0,
                commentsChat: 0,
                commentsTrVideo: 0,
              },
              // counters to be used for search results
              countsReport = {
                comments: 0,
                commentsChat: 0,
                commentsTrVideo: 0,
              };
            let transcriptDataBuf,
              commentsDataBuf = [],
              chatDataBuf = new Map();

            // block the filter button from update its order state
            let filterSortLock = false;
            let filterSortLockTimeout = null;
            const lockFilterSort = (ms) => {
              clearTimeout(filterSortLockTimeout);
              filterSortLock = true;
              filterSortLockTimeout = setTimeout(() => {
                filterSortLock = false;
              }, ms);
            };
            const getLockedFilterSortOrder = (sortOrder) => {
              if (filterSortLock) {
                // reverse sort order state if we want to preserve the sort order
                if (sortOrder === 'newest') {
                  return 'oldest';
                }
                return 'newest';
              }
              return sortOrder;
            };

            t = new AbortController();
            const fuseOptionsBase = {
              isCaseSensitive: !1,
              findAllMatches: !1,
              includeMatches: !1,
              includeScore: !0,
              ignoreLocation: !0,
              useExtendedSearch: !1,
              minMatchCharLength: 1,
              shouldSort: !0,
              threshold: 0.15,
              distance: 1e5,
            };
            if (
              (postTextMessage('NUMBER_COMMENTS', ''),
              sn('.ycs-app'),
              document.querySelector('#meta.style-scope.ytd-watch-flexy'))
            )
              _n('#meta.style-scope.ytd-watch-flexy');
            else {
              if (!document.querySelector('#meta.style-scope')) return;
              _n('#meta.style-scope');
            }
            const l = document.getElementById('ycs-search');
            buildSearchUI(l);

            const btnPool = (() => ({
              elPTimeStamps: document.getElementById('ycs_btn_timestamps'),
              elPAuthor: document.getElementById('ycs_btn_author'),
              elPHeart: document.getElementById('ycs_btn_heart'),
              elPVerified: document.getElementById('ycs_btn_verified'),
              elPLinks: document.getElementById('ycs_btn_links'),
              elPLikes: document.getElementById('ycs_btn_likes'),
              elPReplied: document.getElementById('ycs_btn_replied_comments'),
              elPMembers: document.getElementById('ycs_btn_members'),
              elPDonated: document.getElementById('ycs_btn_donated'),
              elPClear: document.getElementById('ycs_btn_clear'),
              elPRandom: document.getElementById('ycs_btn_random'),
              elFirstComments: document.getElementById('ycs_btn_sort_first'),
            }))();
            ((pool) => {
              if (pool) {
                var t, n, o, i, a, s, c, l, d, h, m, p;
                const f = () => {
                  (countsReport.comments = 0),
                    (countsReport.commentsChat = 0),
                    (countsReport.commentsTrVideo = 0);
                };
                null == pool ||
                  null === (t = pool.elPTimeStamps) ||
                  void 0 === t ||
                  t.addEventListener('click', (e) => {
                    try {
                      var t;
                      const n = e.currentTarget;
                      toggleVisibility('#ycs_btn_clear', true);
                      const removed = removeClassName(pool, 'ycs_btn_active');
                      if (!removed.includes(n)) {
                        lockFilterSort(100);
                      }
                      removed.length = 0;

                      f(),
                        null === (t = n) ||
                          void 0 === t ||
                          t.classList.add('ycs_btn_active'),
                        dispatchSearch({ timestamp: !0 });
                    } catch (e) {}
                  }),
                  null == pool ||
                    null === (n = pool.elPAuthor) ||
                    void 0 === n ||
                    n.addEventListener('click', (e) => {
                      try {
                        var t;
                        const n = e.currentTarget;
                        toggleVisibility('#ycs_btn_clear', true);
                        const removed = removeClassName(pool, 'ycs_btn_active');
                        if (!removed.includes(n)) {
                          lockFilterSort(100);
                        }
                        removed.length = 0;
                        f(),
                          null === (t = n) ||
                            void 0 === t ||
                            t.classList.add('ycs_btn_active'),
                          dispatchSearch({ author: !0 });
                      } catch (e) {}
                    }),
                  null == pool ||
                    null === (o = pool.elPHeart) ||
                    void 0 === o ||
                    o.addEventListener('click', (e) => {
                      try {
                        var t;
                        const n = e.currentTarget;
                        toggleVisibility('#ycs_btn_clear', true);
                        const removed = removeClassName(pool, 'ycs_btn_active');
                        if (!removed.includes(n)) {
                          lockFilterSort(100);
                        }
                        removed.length = 0;
                        f(),
                          null === (t = n) ||
                            void 0 === t ||
                            t.classList.add('ycs_btn_active'),
                          dispatchSearch({ heart: !0 });
                      } catch (e) {}
                    }),
                  null == pool ||
                    null === (i = pool.elPVerified) ||
                    void 0 === i ||
                    i.addEventListener('click', (e) => {
                      try {
                        var t;
                        const n = e.currentTarget;
                        toggleVisibility('#ycs_btn_clear', true);
                        const removed = removeClassName(pool, 'ycs_btn_active');
                        if (!removed.includes(n)) {
                          lockFilterSort(100);
                        }
                        removed.length = 0;
                        f(),
                          null === (t = n) ||
                            void 0 === t ||
                            t.classList.add('ycs_btn_active'),
                          dispatchSearch({ verified: !0 });
                      } catch (e) {}
                    }),
                  null == pool ||
                    null === (a = pool.elPLinks) ||
                    void 0 === a ||
                    a.addEventListener('click', (e) => {
                      try {
                        var t;
                        const n = e.currentTarget;
                        toggleVisibility('#ycs_btn_clear', true);
                        const removed = removeClassName(pool, 'ycs_btn_active');
                        if (!removed.includes(n)) {
                          lockFilterSort(100);
                        }
                        removed.length = 0;
                        f(),
                          null === (t = n) ||
                            void 0 === t ||
                            t.classList.add('ycs_btn_active'),
                          dispatchSearch({ links: !0 });
                      } catch (e) {}
                    }),
                  null == pool ||
                    null === (s = pool.elPLikes) ||
                    void 0 === s ||
                    s.addEventListener('click', (e) => {
                      try {
                        var t;
                        const n = e.currentTarget;
                        toggleVisibility('#ycs_btn_clear', true);
                        removeClassName(pool, 'ycs_btn_active'),
                          f(),
                          null === (t = n) ||
                            void 0 === t ||
                            t.classList.add('ycs_btn_active'),
                          dispatchSearch({ likes: !0 });
                      } catch (e) {}
                    }),
                  null == pool ||
                    null === (c = pool.elPReplied) ||
                    void 0 === c ||
                    c.addEventListener('click', (e) => {
                      try {
                        var t;
                        const n = e.currentTarget;
                        toggleVisibility('#ycs_btn_clear', true);
                        removeClassName(pool, 'ycs_btn_active'),
                          f(),
                          null === (t = n) ||
                            void 0 === t ||
                            t.classList.add('ycs_btn_active'),
                          dispatchSearch({ replied: !0 });
                      } catch (e) {}
                    }),
                  null == pool ||
                    null === (l = pool.elPMembers) ||
                    void 0 === l ||
                    l.addEventListener('click', (e) => {
                      try {
                        var t;
                        const n = e.currentTarget;
                        toggleVisibility('#ycs_btn_clear', true);
                        const removed = removeClassName(pool, 'ycs_btn_active');
                        if (!removed.includes(n)) {
                          lockFilterSort(100);
                        }
                        removed.length = 0;
                        f(),
                          null === (t = n) ||
                            void 0 === t ||
                            t.classList.add('ycs_btn_active'),
                          dispatchSearch({ members: !0 });
                      } catch (e) {}
                    }),
                  null == pool ||
                    null === (d = pool.elPDonated) ||
                    void 0 === d ||
                    d.addEventListener('click', (e) => {
                      try {
                        var t;
                        const n = e.currentTarget;
                        toggleVisibility('#ycs_btn_clear', true);
                        const removed = removeClassName(pool, 'ycs_btn_active');
                        if (!removed.includes(n)) {
                          lockFilterSort(100);
                        }
                        removed.length = 0;
                        f(),
                          null === (t = n) ||
                            void 0 === t ||
                            t.classList.add('ycs_btn_active'),
                          dispatchSearch({ donated: !0 });
                      } catch (e) {}
                    }),
                  null == pool ||
                    null === (h = pool.elPClear) ||
                    void 0 === h ||
                    h.addEventListener('click', (e) => {
                      try {
                        toggleVisibility('#ycs_btn_clear', false);
                        removeClassName(pool, 'ycs_btn_active'), f();

                        const eInputSearch =
                          document.getElementById('ycs-input-search');
                        // if search input is not empty, trigger search again for results without button filter
                        if (eInputSearch.value && eInputSearch.value.trim()) {
                          requestAnimationFrame(() => {
                            document.getElementById('ycs_btn_search').click();
                          });
                        } else {
                          const e =
                              document.getElementById('ycs-search-result'),
                            t = document.getElementById(
                              'ycs-search-total-result'
                            );
                          e &&
                            ((e.innerText = ''),
                            (t.innerText = 'Search cleared'));
                        }
                      } catch (e) {}
                    }),
                  null == pool ||
                    null === (m = pool.elPRandom) ||
                    void 0 === m ||
                    m.addEventListener('click', (e) => {
                      try {
                        var t;
                        const n = e.currentTarget;
                        toggleVisibility('#ycs_btn_clear', true);
                        removeClassName(pool, 'ycs_btn_active'),
                          f(),
                          null === (t = n) ||
                            void 0 === t ||
                            t.classList.add('ycs_btn_active'),
                          dispatchSearch({ random: !0 });
                      } catch (e) {}
                    }),
                  null == pool ||
                    null === (p = pool.elFirstComments) ||
                    void 0 === p ||
                    p.addEventListener('click', (e) => {
                      try {
                        var t;
                        const n = e.currentTarget;
                        toggleVisibility('#ycs_btn_clear', true);
                        const removed = removeClassName(pool, 'ycs_btn_active');
                        if (!removed.includes(n)) {
                          lockFilterSort(100);
                        }
                        removed.length = 0;
                        f(),
                          null === (t = n) ||
                            void 0 === t ||
                            t.classList.add('ycs_btn_active'),
                          dispatchSearch({ sortFirst: !0 });
                      } catch (e) {}
                    });
              }
            })(btnPool);
            const h = document.getElementsByClassName('ycs-app')[0],
              m = document.getElementById('ycs-count-load'),
              p = document.getElementById('ycs-load-cmnts');
            p &&
              p.addEventListener('click', async function (e) {
                if (!h.parentNode || !h.parentElement) return;
                commentsDataBuf.length = 0;
                const n = e.currentTarget;
                (n.disabled = !0), (n.innerText = 'reload');
                const r = document.getElementById('ycs_status_cmnt'),
                  c = document.getElementById('ycs_cmnts');
                c &&
                  r &&
                  ((c.textContent = '0'),
                  (r.innerHTML =
                    '\n        <span class="ycs-icons">\n            <svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="48" height="48" viewBox="0 0 48 48">\n                <path fill="#ff6f02" d="M31 7.002l13 1.686L33.296 19 31 7.002zM17 41L4 39.314 14.704 29 17 41z"></path>\n                <path fill="#ff6f00"\n                    d="M8 24c0-8.837 7.163-16 16-16 1.024 0 2.021.106 2.992.29l.693-3.865C26.525 4.112 25.262 4.005 24 4.005c-11.053 0-20 8.947-20 20 0 4.844 1.686 9.474 4.844 13.051l3.037-2.629C9.468 31.625 8 27.987 8 24zM39.473 11.267l-3.143 2.537C38.622 16.572 40 20.125 40 24c0 8.837-7.163 16-16 16-1.029 0-2.033-.106-3.008-.292l-.676 3.771c1.262.21 2.525.317 3.684.317 11.053 0 20-8.947 20-20C44 19.375 42.421 14.848 39.473 11.267z">\n                </path>\n            </svg>\n        </span>\n    '),
                  await cn(c, t.signal, commentsDataBuf),
                  commentsDataBuf.length > 0 &&
                    ((r.innerHTML =
                      '\n        <span class="ycs-icons">\n            <svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px"\n            width="48" height="48"\n            viewBox="0 0 48 48"\n            style=" fill:#000000;"><linearGradient id="I9GV0SozQFknxHSR6DCx5a_70yRC8npwT3d_gr1" x1="9.858" x2="38.142" y1="9.858" y2="38.142" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#21ad64"></stop><stop offset="1" stop-color="#088242"></stop></linearGradient><path fill="url(#I9GV0SozQFknxHSR6DCx5a_70yRC8npwT3d_gr1)" d="M44,24c0,11.045-8.955,20-20,20S4,35.045,4,24S12.955,4,24,4S44,12.955,44,24z"></path><path d="M32.172,16.172L22,26.344l-5.172-5.172c-0.781-0.781-2.047-0.781-2.828,0l-1.414,1.414\tc-0.781,0.781-0.781,2.047,0,2.828l8,8c0.781,0.781,2.047,0.781,2.828,0l13-13c0.781-0.781,0.781-2.047,0-2.828L35,16.172\tC34.219,15.391,32.953,15.391,32.172,16.172z" opacity=".05"></path><path d="M20.939,33.061l-8-8c-0.586-0.586-0.586-1.536,0-2.121l1.414-1.414c0.586-0.586,1.536-0.586,2.121,0\tL22,27.051l10.525-10.525c0.586-0.586,1.536-0.586,2.121,0l1.414,1.414c0.586,0.586,0.586,1.536,0,2.121l-13,13\tC22.475,33.646,21.525,33.646,20.939,33.061z" opacity=".07"></path><path fill="#fff" d="M21.293,32.707l-8-8c-0.391-0.391-0.391-1.024,0-1.414l1.414-1.414c0.391-0.391,1.024-0.391,1.414,0\tL22,27.758l10.879-10.879c0.391-0.391,1.024-0.391,1.414,0l1.414,1.414c0.391,0.391,0.391,1.024,0,1.414l-13,13\tC22.317,33.098,21.683,33.098,21.293,32.707z"></path></svg>\n        </span>\n    '),
                    saveCache(
                      {
                        comments: commentsDataBuf,
                        commentsChat: JSON.stringify(
                          Array.from(chatDataBuf.entries())
                        ),
                        commentsTrVideo: transcriptDataBuf,
                      },
                      window.location.href,
                      document.title
                    ))),
                  commentsDataBuf.length > 0 &&
                    (countsAct.comments = commentsDataBuf.length);
                const l =
                  countsAct.comments +
                  countsAct.commentsChat +
                  countsAct.commentsTrVideo;
                postTextMessage('NUMBER_COMMENTS', l),
                  c && (c.textContent = `${commentsDataBuf.length}`),
                  m && (m.textContent = `(${l})`),
                  (n.disabled = !1);
              });
            const f = document.getElementById('ycs-load-chat');
            f &&
              f.addEventListener('click', async function (e) {
                if (!h.parentNode || !h.parentElement) return;
                chatDataBuf.clear();
                const n = e.currentTarget;
                (n.disabled = !0), (n.innerText = 'reload');
                const r = document.getElementById('ycs_status_chat'),
                  c = document.getElementById('ycs_cmnts_chat');
                c &&
                  r &&
                  ((c.textContent = '0'),
                  (r.innerHTML =
                    '\n        <span class="ycs-icons">\n            <svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="48" height="48" viewBox="0 0 48 48">\n                <path fill="#ff6f02" d="M31 7.002l13 1.686L33.296 19 31 7.002zM17 41L4 39.314 14.704 29 17 41z"></path>\n                <path fill="#ff6f00"\n                    d="M8 24c0-8.837 7.163-16 16-16 1.024 0 2.021.106 2.992.29l.693-3.865C26.525 4.112 25.262 4.005 24 4.005c-11.053 0-20 8.947-20 20 0 4.844 1.686 9.474 4.844 13.051l3.037-2.629C9.468 31.625 8 27.987 8 24zM39.473 11.267l-3.143 2.537C38.622 16.572 40 20.125 40 24c0 8.837-7.163 16-16 16-1.029 0-2.033-.106-3.008-.292l-.676 3.771c1.262.21 2.525.317 3.684.317 11.053 0 20-8.947 20-20C44 19.375 42.421 14.848 39.473 11.267z">\n                </path>\n            </svg>\n        </span>\n    '),
                  await (async function (signal, t, n) {
                    function processChatRun(run, { item }) {
                      let plainText = '';
                      let htmlText = '';
                      try {
                        let text = run?.text || '';

                        if (
                          parseInt(
                            run?.navigationEndpoint?.watchEndpoint
                              ?.startTimeSeconds
                          ) >= 0
                        ) {
                          const videoId =
                            run?.navigationEndpoint?.watchEndpoint?.videoId;
                          const startTime =
                            run?.navigationEndpoint?.watchEndpoint
                              ?.startTimeSeconds;

                          htmlText += `<a class="ycs-cpointer ycs-gotochat-video" href="https://www.youtube.com/watch?v=${videoId}&t=${startTime}s" data-offsetvideo="${startTime}">${text}</a>`;

                          if (
                            qt(
                              () =>
                                item.replayChatItemAction.actions[0]
                                  .addChatItemAction.item
                                  .liveChatTextMessageRenderer
                            )
                          ) {
                            item.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer.isTimeLine =
                              'timeline';
                          }
                        } else if (run?.navigationEndpoint) {
                          const baseUrl =
                            run?.navigationEndpoint?.browseEndpoint
                              ?.canonicalBaseUrl;
                          const url = run?.navigationEndpoint?.urlEndpoint?.url;
                          const webUrl =
                            run?.navigationEndpoint?.commandMetadata
                              ?.webCommandMetadata?.url;

                          const link = baseUrl || url || webUrl || text;
                          htmlText += `<a class="ycs-cpointer ycs-comment-link" href="${link}" target="_blank">${text}</a>`;
                        } else if (run?.emoji) {
                          const url = qt(() => {
                            const thumbnails = run.emoji.image.thumbnails;
                            // retrieve best resolution url
                            return thumbnails[thumbnails.length - 1].url;
                          });
                          const alt = run.emoji.shortcuts?.[0] || '';
                          const style = `margin-left: 2px; margin-right: 2px;`;
                          htmlText += `<img src="${url}" alt="${alt}" title="${alt}" width="24" height="24" style="${style}" class="ycs-attachment" />`;
                        } else {
                          htmlText += text || '';
                        }

                        plainText +=
                          run.text || run.emoji?.shortcuts?.[0] || '';
                      } catch (e) {
                        htmlText += run?.text || '';
                      }

                      return { plainText, htmlText };
                    }

                    try {
                      const N = (e) => {
                          try {
                            if (
                              qt(
                                () =>
                                  e.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer.authorBadges[0].liveChatAuthorBadgeRenderer.icon.iconType.indexOf(
                                    'VERIFIED'
                                  ) >= 0
                              ) ||
                              qt(
                                () =>
                                  e.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer.authorBadges[0].liveChatAuthorBadgeRenderer.icon.iconType.indexOf(
                                    'CHECK'
                                  ) >= 0
                              ) ||
                              qt(
                                () =>
                                  e.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer.authorBadges[0].liveChatAuthorBadgeRenderer.tooltip.indexOf(
                                    'Verified'
                                  ) >= 0
                              )
                            )
                              try {
                                e.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer.verifiedAuthor =
                                  !0;
                              } catch (e) {}
                            return e;
                          } catch (t) {
                            return e;
                          }
                        },
                        $ = await on(signal);
                      if (!$) return;
                      const P = n || new Map(),
                        j = await loadChatReplay(signal);
                      if (j)
                        try {
                          var o;
                          if (
                            (null == j ||
                            null === (o = j.actions) ||
                            void 0 === o
                              ? void 0
                              : o.length) > 0
                          )
                            for (const e of j.actions)
                              try {
                                const n = {
                                  replayChatItemAction: {
                                    actions: [
                                      {
                                        addChatItemAction: {},
                                      },
                                    ],
                                  },
                                };
                                n.replayChatItemAction.actions[0] = e;
                                const o = n;
                                if (
                                  !qt(
                                    () =>
                                      o.replayChatItemAction.actions[0]
                                        .addChatItemAction.item
                                        .liveChatTextMessageRenderer
                                        .timestampUsec
                                  )
                                )
                                  if (
                                    qt(
                                      () =>
                                        o.replayChatItemAction.actions[0]
                                          .addChatItemAction.item
                                          .liveChatPaidMessageRenderer
                                    )
                                  )
                                    o.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer =
                                      o.replayChatItemAction.actions[0].addChatItemAction.item.liveChatPaidMessageRenderer;
                                  else if (
                                    qt(
                                      () =>
                                        o.replayChatItemAction.actions[0]
                                          .addBannerToLiveChatCommand
                                          .bannerRenderer.liveChatBannerRenderer
                                          .contents.liveChatTextMessageRenderer
                                    )
                                  )
                                    (o.replayChatItemAction.actions[0].addChatItemAction =
                                      {
                                        item: {
                                          liveChatTextMessageRenderer: {},
                                        },
                                      }),
                                      (o.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer =
                                        o.replayChatItemAction.actions[0].addBannerToLiveChatCommand.bannerRenderer.liveChatBannerRenderer.contents.liveChatTextMessageRenderer);
                                  else if (
                                    qt(
                                      () =>
                                        o.replayChatItemAction.actions[0]
                                          .addLiveChatTickerItemAction.item
                                          .liveChatTickerPaidMessageItemRenderer
                                          .showItemEndpoint
                                          .showLiveChatItemEndpoint.renderer
                                          .liveChatPaidMessageRenderer
                                    )
                                  )
                                    (o.replayChatItemAction.actions[0].addChatItemAction =
                                      {
                                        item: {
                                          liveChatTextMessageRenderer: {},
                                        },
                                      }),
                                      (o.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer =
                                        o.replayChatItemAction.actions[0].addLiveChatTickerItemAction.item.liveChatTickerPaidMessageItemRenderer.showItemEndpoint.showLiveChatItemEndpoint.renderer.liveChatPaidMessageRenderer);
                                  else {
                                    const e = qt(() =>
                                      Object.keys(Wt(o, 'timestampUsec')[0])[0]
                                        .split('.')
                                        .slice(0, -1)
                                        .join('.')
                                    );
                                    if (e) {
                                      const t = Gt(o, e, void 0);
                                      t &&
                                        (null == t ? void 0 : t.authorName) &&
                                        (null == t ? void 0 : t.message) &&
                                        ((o.replayChatItemAction.actions[0].addChatItemAction =
                                          {
                                            item: {
                                              liveChatTextMessageRenderer: {},
                                            },
                                          }),
                                        (o.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer =
                                          t));
                                    }
                                  }
                                const w = qt(
                                  () =>
                                    o.replayChatItemAction.actions[0]
                                      .addChatItemAction.item
                                      .liveChatTextMessageRenderer.timestampUsec
                                );
                                if (w && !P.has(parseInt(w, 10))) {
                                  const runs =
                                    qt(
                                      () =>
                                        o.replayChatItemAction.actions[0]
                                          .addChatItemAction.item
                                          .liveChatTextMessageRenderer.message
                                          .runs
                                    ) || [];
                                  let fullText = '';
                                  let renderFullText = '';

                                  if (
                                    o.replayChatItemAction.actions[0]
                                      .addChatItemAction.item
                                      .liveChatTextMessageRenderer
                                      .purchaseAmountText.simpleText
                                  ) {
                                    renderFullText += `<span class="ycs-chat_donation ycs-chat_donation__title">Donated: </span><span class="ycs-chat_donation ycs-chat_donation__bg">${o.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer.purchaseAmountText.simpleText}</span><br><br>`;
                                    fullText += `${o.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer.purchaseAmountText.simpleText} `;
                                  }

                                  for (const run of runs) {
                                    const { plainText, htmlText } =
                                      processChatRun(run, { item: o });
                                    fullText += plainText;
                                    renderFullText += htmlText;
                                  }
                                  fullText &&
                                    ((o.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer.message.fullText =
                                      fullText),
                                    (o.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer.message.renderFullText =
                                      renderFullText || fullText)),
                                    qt(
                                      () =>
                                        o.replayChatItemAction.actions[0]
                                          .addChatItemAction.item
                                          .liveChatTextMessageRenderer
                                          .authorName
                                    ) &&
                                      (P.set(parseInt(w, 10), N(o)),
                                      Kt(P.size, t));
                                }
                              } catch (e) {
                                continue;
                              }
                        } catch (e) {
                          return P;
                        }
                      else
                        try {
                          let n = 0,
                            o = !0;
                          for (; o; ) {
                            const r = Zt(window, $, n);
                            if (!r) return (o = !1), P;
                            {
                              var w, b;
                              const i = await Ft(
                                `https://www.youtube.com/youtubei/v1/live_chat/get_live_chat_replay?key=${nn()}`,
                                {
                                  ...r,
                                  signal,
                                  cache: 'no-store',
                                }
                              );
                              let a = await i.json();
                              if (
                                ((a =
                                  null == a ||
                                  null === (w = a.continuationContents) ||
                                  void 0 === w ||
                                  null === (b = w.liveChatContinuation) ||
                                  void 0 === b
                                    ? void 0
                                    : b.actions),
                                a && a.length > 0)
                              ) {
                                const [, e] = Object.entries(
                                  Wt(a[a.length - 1], 'videoOffsetTimeMsec')[0]
                                )[0];
                                if (n === e) {
                                  o = !1;
                                  break;
                                }
                                for (const e of a)
                                  try {
                                    if (
                                      !qt(
                                        () =>
                                          e.replayChatItemAction.actions[0]
                                            .addChatItemAction.item
                                            .liveChatTextMessageRenderer
                                            .timestampUsec
                                      )
                                    )
                                      if (
                                        qt(
                                          () =>
                                            e.replayChatItemAction.actions[0]
                                              .addChatItemAction.item
                                              .liveChatPaidMessageRenderer
                                        )
                                      )
                                        e.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer =
                                          e.replayChatItemAction.actions[0].addChatItemAction.item.liveChatPaidMessageRenderer;
                                      else if (
                                        qt(
                                          () =>
                                            e.replayChatItemAction.actions[0]
                                              .addBannerToLiveChatCommand
                                              .bannerRenderer
                                              .liveChatBannerRenderer.contents
                                              .liveChatTextMessageRenderer
                                        )
                                      )
                                        (e.replayChatItemAction.actions[0].addChatItemAction =
                                          {
                                            item: {
                                              liveChatTextMessageRenderer: {},
                                            },
                                          }),
                                          (e.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer =
                                            e.replayChatItemAction.actions[0].addBannerToLiveChatCommand.bannerRenderer.liveChatBannerRenderer.contents.liveChatTextMessageRenderer);
                                      else if (
                                        qt(
                                          () =>
                                            e.replayChatItemAction.actions[0]
                                              .addLiveChatTickerItemAction.item
                                              .liveChatTickerPaidMessageItemRenderer
                                              .showItemEndpoint
                                              .showLiveChatItemEndpoint.renderer
                                              .liveChatPaidMessageRenderer
                                        )
                                      )
                                        (e.replayChatItemAction.actions[0].addChatItemAction =
                                          {
                                            item: {
                                              liveChatTextMessageRenderer: {},
                                            },
                                          }),
                                          (e.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer =
                                            e.replayChatItemAction.actions[0].addLiveChatTickerItemAction.item.liveChatTickerPaidMessageItemRenderer.showItemEndpoint.showLiveChatItemEndpoint.renderer.liveChatPaidMessageRenderer);
                                      else {
                                        const t = qt(() =>
                                          Object.keys(
                                            Wt(e, 'timestampUsec')[0]
                                          )[0]
                                            .split('.')
                                            .slice(0, -1)
                                            .join('.')
                                        );
                                        if (t) {
                                          const n = Gt(e, t, void 0);
                                          n &&
                                            (null == n
                                              ? void 0
                                              : n.authorName) &&
                                            (null == n ? void 0 : n.message) &&
                                            ((e.replayChatItemAction.actions[0].addChatItemAction =
                                              {
                                                item: {
                                                  liveChatTextMessageRenderer:
                                                    {},
                                                },
                                              }),
                                            (e.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer =
                                              n));
                                        }
                                      }
                                    const n = qt(
                                      () =>
                                        e.replayChatItemAction.actions[0]
                                          .addChatItemAction.item
                                          .liveChatTextMessageRenderer
                                          .timestampUsec
                                    );
                                    if (n && !P.has(parseInt(n, 10))) {
                                      const runs =
                                        qt(
                                          () =>
                                            e.replayChatItemAction.actions[0]
                                              .addChatItemAction.item
                                              .liveChatTextMessageRenderer
                                              .message.runs
                                        ) || [];
                                      let fullText = '';
                                      let renderFullText = '';

                                      qt(
                                        () =>
                                          e.replayChatItemAction.actions[0]
                                            .addChatItemAction.item
                                            .liveChatTextMessageRenderer
                                            .purchaseAmountText.simpleText
                                      ) &&
                                        ((renderFullText += `<span class="ycs-chat_donation ycs-chat_donation__title">Donated: </span><span class="ycs-chat_donation ycs-chat_donation__bg">${e.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer.purchaseAmountText.simpleText}</span><br><br>`),
                                        (fullText += `${e.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer.purchaseAmountText.simpleText} `));

                                      for (const run of runs) {
                                        const { plainText, htmlText } =
                                          processChatRun(run, { item: e });
                                        fullText += plainText;
                                        renderFullText += htmlText;
                                      }
                                      fullText &&
                                        ((e.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer.message.fullText =
                                          fullText),
                                        (e.replayChatItemAction.actions[0].addChatItemAction.item.liveChatTextMessageRenderer.message.renderFullText =
                                          renderFullText || fullText)),
                                        qt(
                                          () =>
                                            e.replayChatItemAction.actions[0]
                                              .addChatItemAction.item
                                              .liveChatTextMessageRenderer
                                              .authorName
                                        ) &&
                                          (P.set(parseInt(n, 10), N(e)),
                                          Kt(P.size, t));
                                    }
                                  } catch (e) {
                                    continue;
                                  }
                                n = e;
                              }
                            }
                          }
                          return P;
                        } catch (e) {
                          return P;
                        }
                    } catch (e) {
                      return;
                    }
                  })(t.signal, c, chatDataBuf),
                  chatDataBuf &&
                    chatDataBuf.size > 0 &&
                    ((c.textContent = chatDataBuf.size.toString()),
                    (r.innerHTML =
                      '\n        <span class="ycs-icons">\n            <svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px"\n            width="48" height="48"\n            viewBox="0 0 48 48"\n            style=" fill:#000000;"><linearGradient id="I9GV0SozQFknxHSR6DCx5a_70yRC8npwT3d_gr1" x1="9.858" x2="38.142" y1="9.858" y2="38.142" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#21ad64"></stop><stop offset="1" stop-color="#088242"></stop></linearGradient><path fill="url(#I9GV0SozQFknxHSR6DCx5a_70yRC8npwT3d_gr1)" d="M44,24c0,11.045-8.955,20-20,20S4,35.045,4,24S12.955,4,24,4S44,12.955,44,24z"></path><path d="M32.172,16.172L22,26.344l-5.172-5.172c-0.781-0.781-2.047-0.781-2.828,0l-1.414,1.414\tc-0.781,0.781-0.781,2.047,0,2.828l8,8c0.781,0.781,2.047,0.781,2.828,0l13-13c0.781-0.781,0.781-2.047,0-2.828L35,16.172\tC34.219,15.391,32.953,15.391,32.172,16.172z" opacity=".05"></path><path d="M20.939,33.061l-8-8c-0.586-0.586-0.586-1.536,0-2.121l1.414-1.414c0.586-0.586,1.536-0.586,2.121,0\tL22,27.051l10.525-10.525c0.586-0.586,1.536-0.586,2.121,0l1.414,1.414c0.586,0.586,0.586,1.536,0,2.121l-13,13\tC22.475,33.646,21.525,33.646,20.939,33.061z" opacity=".07"></path><path fill="#fff" d="M21.293,32.707l-8-8c-0.391-0.391-0.391-1.024,0-1.414l1.414-1.414c0.391-0.391,1.024-0.391,1.414,0\tL22,27.758l10.879-10.879c0.391-0.391,1.024-0.391,1.414,0l1.414,1.414c0.391,0.391,0.391,1.024,0,1.414l-13,13\tC22.317,33.098,21.683,33.098,21.293,32.707z"></path></svg>\n        </span>\n    '),
                    saveCache(
                      {
                        comments: commentsDataBuf,
                        commentsChat: JSON.stringify(
                          Array.from(chatDataBuf.entries())
                        ),
                        commentsTrVideo: transcriptDataBuf,
                      },
                      window.location.href,
                      document.title
                    ))),
                  chatDataBuf &&
                    chatDataBuf.size > 0 &&
                    (h.parentNode || h.parentElement) &&
                    (countsAct.commentsChat = chatDataBuf.size);
                const l =
                  countsAct.comments +
                  countsAct.commentsChat +
                  countsAct.commentsTrVideo;
                postTextMessage('NUMBER_COMMENTS', l),
                  m && (m.textContent = `(${l})`),
                  (n.disabled = !1);
              });
            const v = document.getElementById('ycs-load-transcript-video');
            v &&
              v.addEventListener('click', async function (e) {
                // Ensure the element has a parent node or parent element
                if (!h.parentNode || !h.parentElement) return;

                const button = e.currentTarget;
                button.disabled = true;
                button.innerText = 'reload';

                const statusElement =
                  document.getElementById('ycs_status_trvideo');
                const commentsElement =
                  document.getElementById('ycs_cmnts_video');

                if (statusElement && commentsElement) {
                  commentsElement.textContent = '0';
                  statusElement.innerHTML = `
                      <span class="ycs-icons">
                          <svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="48" height="48" viewBox="0 0 48 48">
                              <path fill="#ff6f02" d="M31 7.002l13 1.686L33.296 19 31 7.002zM17 41L4 39.314 14.704 29 17 41z"></path>
                              <path fill="#ff6f00" d="M8 24c0-8.837 7.163-16 16-16 1.024 0 2.021.106 2.992.29l.693-3.865C26.525 4.112 25.262 4.005 24 4.005c-11.053 0-20 8.947-20 20 0 4.844 1.686 9.474 4.844 13.051l3.037-2.629C9.468 31.625 8 27.987 8 24zM39.473 11.267l-3.143 2.537C38.622 16.572 40 20.125 40 24c0 8.837-7.163 16-16 16-1.029 0-2.033-.106-3.008-.292l-.676 3.771c1.262.21 2.525.317 3.684.317 11.053 0 20-8.947 20-20C44 19.375 42.421 14.848 39.473 11.267z"></path>
                          </svg>
                      </span>
                  `;

                  let transcriptData;
                  let cueGroups;
                  try {
                    transcriptData = await loadTranscript(t.signal);
                    transcriptDataBuf = transcriptData;

                    cueGroups =
                      transcriptData?.actions?.[0]?.updateEngagementPanelAction
                        ?.content?.transcriptRenderer?.body
                        ?.transcriptBodyRenderer?.cueGroups;
                    const cueGroupLength = cueGroups?.length || 0;

                    if (cueGroupLength > 0) {
                      Kt(cueGroupLength, commentsElement);
                      saveCache(
                        {
                          comments: commentsDataBuf,
                          commentsChat: JSON.stringify(
                            Array.from(chatDataBuf.entries())
                          ),
                          commentsTrVideo: transcriptData,
                        },
                        window.location.href,
                        document.title
                      );
                    } else {
                      transcriptData = undefined;
                    }
                  } catch (error) {
                    transcriptData = undefined;
                  }

                  if (hasCueGroups(transcriptData)) {
                    statusElement.innerHTML = `
                        <span class="ycs-icons">
                            <svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="48" height="48" viewBox="0 0 48 48" style="fill:#000000;">
                                <linearGradient id="I9GV0SozQFknxHSR6DCx5a_70yRC8npwT3d_gr1" x1="9.858" x2="38.142" y1="9.858" y2="38.142" gradientUnits="userSpaceOnUse">
                                    <stop offset="0" stop-color="#21ad64"></stop>
                                    <stop offset="1" stop-color="#088242"></stop>
                                </linearGradient>
                                <path fill="url(#I9GV0SozQFknxHSR6DCx5a_70yRC8npwT3d_gr1)" d="M44,24c0,11.045-8.955,20-20,20S4,35.045,4,24S12.955,4,24,4S44,12.955,44,24z"></path>
                                <path d="M32.172,16.172L22,26.344l-5.172-5.172c-0.781-0.781-2.047-0.781-2.828,0l-1.414,1.414c-0.781,0.781-0.781,2.047,0,2.828l8,8c0.781,0.781,2.047,0.781,2.828,0l13-13c0.781-0.781,0.781-2.047,0-2.828L35,16.172C34.219,15.391,32.953,15.391,32.172,16.172z" opacity=".05"></path>
                                <path d="M20.939,33.061l-8-8c-0.586-0.586-0.586-1.536,0-2.121l1.414-1.414c0.586-0.586,1.536-0.586,2.121,0L22,27.051l10.525-10.525c0.586-0.586,1.536-0.586,2.121,0l1.414,1.414c0.586,0.586,0.586,1.536,0,2.121l-13,13C22.475,33.646,21.525,33.646,20.939,33.061z" opacity=".07"></path>
                                <path fill="#fff" d="M21.293,32.707l-8-8c-0.391-0.391-0.391-1.024,0-1.414l1.414-1.414c0.391-0.391,1.024-0.391,1.414,0L22,27.758l10.879-10.879c0.391-0.391,1.024-0.391,1.414,0l1.414,1.414c0.391,0.391,0.391,1.024,0,1.414l-13,13C22.317,33.098,21.683,33.098,21.293,32.707z"></path>
                            </svg>
                        </span>
                    `;
                  }

                  if (
                    hasCueGroups(transcriptData) &&
                    (h.parentNode || h.parentElement)
                  ) {
                    countsAct.commentsTrVideo = cueGroups.length;
                  }

                  const totalComments =
                    countsAct.comments +
                    countsAct.commentsChat +
                    countsAct.commentsTrVideo;
                  postTextMessage('NUMBER_COMMENTS', totalComments);

                  if (m) {
                    m.textContent = `(${totalComments})`;
                  }

                  button.disabled = false;
                }
              });

            function hasCueGroups(transcriptData) {
              return !!transcriptData?.actions?.[0]?.updateEngagementPanelAction
                ?.content?.transcriptRenderer?.body?.transcriptBodyRenderer
                ?.cueGroups?.length;
            }
            const y = document.getElementById('ycs-load-all');
            y &&
              y.addEventListener('click', function () {
                const e = document.getElementById('ycs-load-cmnts'),
                  t = document.getElementById('ycs-load-chat'),
                  n = document.getElementById('ycs-load-transcript-video');
                null == e || e.click(),
                  null == t || t.click(),
                  null == n || n.click();
              });
            const g = document.getElementById('ycs_load_stop');
            g &&
              g.addEventListener('click', () => {
                try {
                  t.abort(), (t = new AbortController());
                } catch (e) {}
              });
            const w = document.getElementById('ycs_btn_search'),
              b = document.getElementById('ycs-input-search'),
              eClearSearchBtn = document.getElementById('ycs_btn_clear_search');
            if (b) {
              b.onkeyup = (e) => {
                if (e.key === 'Enter' || e.code === 'Enter') {
                  if (w) {
                    w.click();
                  }
                } else if (e.key === 'Escape' || e.code === 'Escape') {
                  if (w) {
                    b.value = '';
                    w.click();
                  }
                }
              };
            }
            const x = document.getElementById('ycs_open_all_comments_window');
            null == x ||
              x.addEventListener('click', () => {
                if (0 !== commentsDataBuf.length)
                  try {
                    !(function (e) {
                      if (e.count || e.html)
                        try {
                          const t = window.open(
                            '',
                            'CommentsNewWindow',
                            'width=640,height=700,menubar=0,toolbar=0,location=0,status=0,resizable=1,scrollbars=1,directories=0,channelmode=0,titlebar=0,top=25,left=25'
                          );
                          if (t) {
                            t.document.title = `Comments, ${document.title} (${e.count})`;
                            const n = document.createElement('pre');
                            return (
                              (n.style.cssText =
                                'word-wrap: break-word; white-space: pre-wrap;'),
                              n.insertAdjacentText(
                                'afterbegin',
                                `\nYCS - YouTube Comment Search\n\nComments\nFile created by ${new Date().toString()}\nVideo URL: ${Xt(
                                  window.location.href
                                )}\nTitle: ${document.title}\nTotal: ${
                                  e.count
                                }\n${e.html}`
                              ),
                              (t.document.body.textContent = ''),
                              t.document.body.appendChild(n),
                              t
                            );
                          }
                        } catch (e) {
                          return;
                        }
                    })(mn(commentsDataBuf));
                  } catch (e) {
                    return;
                  }
              });
            const _ = document.getElementById('ycs_save_all_comments');
            null == _ ||
              _.addEventListener('click', () => {
                if (0 !== commentsDataBuf.length)
                  try {
                    const e = mn(commentsDataBuf);
                    hn(
                      `\nYCS - YouTube Comment Search\n\nComments\nFile created by ${new Date().toString()}\nVideo URL: ${Xt(
                        window.location.href
                      )}\nTitle: ${document.title}\nTotal: ${e.count}\n${
                        e.html
                      }`,
                      `Comments, ${document.title} (${e.count}).txt`,
                      'text/plain'
                    );
                  } catch (e) {
                    return;
                  }
              });
            const C = document.getElementById(
              'ycs_open_all_comments_chat_window'
            );
            null == C ||
              C.addEventListener('click', () => {
                if (0 !== chatDataBuf.size)
                  try {
                    !(function (e) {
                      if (e.count || e.html)
                        try {
                          const t = window.open(
                            '',
                            'CommentsChatNewWindow',
                            'width=640,height=700,menubar=0,toolbar=0,location=0,status=0,resizable=1,scrollbars=1,directories=0,channelmode=0,titlebar=0,top=50,left=50'
                          );
                          if (t) {
                            t.document.title = `Comments chat, ${document.title} (${e.count})`;
                            const n = document.createElement('pre');
                            return (
                              (n.style.cssText =
                                'word-wrap: break-word; white-space: pre-wrap;'),
                              n.insertAdjacentText(
                                'afterbegin',
                                `\nYCS - YouTube Comment Search\n\nComments chat\nFile created by ${new Date().toString()}\nVideo URL: ${Xt(
                                  window.location.href
                                )}\nTitle: ${document.title}\nTotal: ${
                                  e.count
                                }\n${e.html}`
                              ),
                              (t.document.body.textContent = ''),
                              t.document.body.appendChild(n),
                              t
                            );
                          }
                        } catch (e) {
                          return;
                        }
                    })(pn([...chatDataBuf.values()]));
                  } catch (e) {
                    return;
                  }
              });
            const E = document.getElementById('ycs_save_all_comments_chat');
            null == E ||
              E.addEventListener('click', () => {
                if (0 !== chatDataBuf.size)
                  try {
                    const e = pn([...chatDataBuf.values()]);
                    hn(
                      `\nYCS - YouTube Comment Search\n\nComments chat\nFile created by ${new Date().toString()}\nVideo URL: ${Xt(
                        window.location.href
                      )}\nTitle: ${document.title}\nTotal: ${e.count}\n${
                        e.html
                      }`,
                      `Comments chat, ${document.title} (${e.count}).txt`,
                      'text/plain'
                    );
                  } catch (e) {
                    return;
                  }
              });
            const T = document.getElementById(
              'ycs_open_all_comments_trvideo_window'
            );
            null == T ||
              T.addEventListener('click', () => {
                try {
                  var e, t, n, o, r, a, s, c, l, d;
                  transcriptDataBuf &&
                    (null === (e = transcriptDataBuf) ||
                    void 0 === e ||
                    null === (t = e.actions) ||
                    void 0 === t
                      ? void 0
                      : t.length) > 0 &&
                    (null ===
                      (o =
                        null === (n = transcriptDataBuf) || void 0 === n
                          ? void 0
                          : n.actions[0]) ||
                    void 0 === o ||
                    null === (r = o.updateEngagementPanelAction) ||
                    void 0 === r ||
                    null === (a = r.content) ||
                    void 0 === a ||
                    null === (s = a.transcriptRenderer) ||
                    void 0 === s ||
                    null === (c = s.body) ||
                    void 0 === c ||
                    null === (l = c.transcriptBodyRenderer) ||
                    void 0 === l ||
                    null === (d = l.cueGroups) ||
                    void 0 === d
                      ? void 0
                      : d.length) > 0 &&
                    (function (e) {
                      if (e.count || e.html)
                        try {
                          const t = window.open(
                            '',
                            'CommentsTrVideoNewWindow',
                            'width=640,height=700,menubar=0,toolbar=0,location=0,status=0,resizable=1,scrollbars=1,directories=0,channelmode=0,titlebar=0,top=75,left=75'
                          );
                          if (t) {
                            t.document.title = `Transcript video, ${document.title} (${e.count})`;
                            const n = document.createElement('pre');
                            return (
                              (n.style.cssText =
                                'word-wrap: break-word; white-space: pre-wrap;'),
                              n.insertAdjacentText(
                                'afterbegin',
                                `\nYCS - YouTube Comment Search\n\nTranscript video\nFile created by ${new Date().toString()}\nVideo URL: ${Xt(
                                  window.location.href
                                )}\nTitle: ${document.title}\nTotal: ${
                                  e.count
                                }\n${e.html}`
                              ),
                              (t.document.body.textContent = ''),
                              t.document.body.appendChild(n),
                              t
                            );
                          }
                        } catch (e) {
                          return;
                        }
                    })(
                      fn(
                        transcriptDataBuf.actions[0].updateEngagementPanelAction
                          .content.transcriptRenderer.body
                          .transcriptBodyRenderer.cueGroups
                      )
                    );
                } catch (e) {
                  return;
                }
              });
            const k = document.getElementById('ycs_save_all_comments_trvideo');
            null == k ||
              k.addEventListener('click', () => {
                try {
                  var e, t, n, o, r, a, s, c, l;
                  if (
                    transcriptDataBuf &&
                    (null === (e = transcriptDataBuf) ||
                    void 0 === e ||
                    null === (t = e.actions) ||
                    void 0 === t
                      ? void 0
                      : t.length) > 0 &&
                    (null === (n = transcriptDataBuf.actions[0]) ||
                    void 0 === n ||
                    null === (o = n.updateEngagementPanelAction) ||
                    void 0 === o ||
                    null === (r = o.content) ||
                    void 0 === r ||
                    null === (a = r.transcriptRenderer) ||
                    void 0 === a ||
                    null === (s = a.body) ||
                    void 0 === s ||
                    null === (c = s.transcriptBodyRenderer) ||
                    void 0 === c ||
                    null === (l = c.cueGroups) ||
                    void 0 === l
                      ? void 0
                      : l.length) > 0
                  ) {
                    const e = fn(
                      transcriptDataBuf.actions[0].updateEngagementPanelAction
                        .content.transcriptRenderer.body.transcriptBodyRenderer
                        .cueGroups
                    );
                    hn(
                      `\nYCS - YouTube Comment Search\n\nTranscript video\nFile created by ${new Date().toString()}\nVideo URL: ${Xt(
                        window.location.href
                      )}\nTitle: ${document.title}\nTotal: ${e.count}\n${
                        e.html
                      }`,
                      `Transcript video, ${document.title} (${e.count}).txt`,
                      'text/plain'
                    );
                  }
                } catch (e) {
                  return;
                }
              });
            const handleCommentsSearch = (t, _n) => {
              const n = _n
                ? {
                    ..._n,
                    sortKey: _n.sortKey ?? 'sort',
                  }
                : undefined;

              try {
                if (
                  0 === commentsDataBuf.length ||
                  (null == n ? void 0 : n.donated)
                )
                  return;
                const o = document.getElementById('ycs-input-search'),
                  i = null == o ? void 0 : o.value,
                  s = document.querySelector(t);
                s && (s.textContent = '');
                const l = document.getElementById('ycs_extended_search_title'),
                  d = document.getElementById('ycs_extended_search_main');
                let u = fuseOptionsBase,
                  h = [
                    'commentRenderer.authorText.simpleText',
                    'commentRenderer.contentText.fullText',
                  ];
                L.checked &&
                  ((u = JSON.parse(JSON.stringify(fuseOptionsBase))),
                  (u.useExtendedSearch = !0),
                  l.checked && (h = ['commentRenderer.authorText.simpleText']),
                  d.checked && (h = ['commentRenderer.contentText.fullText']));
                const m = {
                  ...u,
                  keys: h,
                };
                const searchText = i.trim();
                const commentsCount = commentsDataBuf.length;
                const indexedBuf = commentsDataBuf.map((d, index) => ({
                  ...d,
                  _index: index,
                }));
                const textSearchFuseResults = searchText
                  ? new (e(I))(indexedBuf, m).search(searchText).map((d) => ({
                      ...d,
                      item: {
                        ...d.item,
                        _score: d.score,
                      },
                    }))
                  : null;
                const textSearchResults =
                  textSearchFuseResults !== null
                    ? textSearchFuseResults.map(({ item }) => item)
                    : indexedBuf;
                let p = [];
                if (null == n ? void 0 : n.likes) {
                  const e = (function (e) {
                    if (0 === e.length) return [];
                    try {
                      const i = [],
                        a = [];
                      for (const [s, c] of e.entries()) {
                        var t, n, o;
                        let e =
                          (null == c ||
                          null === (t = c.commentRenderer) ||
                          void 0 === t ||
                          null === (n = t.voteCount) ||
                          void 0 === n
                            ? void 0
                            : n.simpleText) ||
                          (null == c ||
                          null === (o = c.commentRenderer) ||
                          void 0 === o
                            ? void 0
                            : o.likeCount);
                        if (
                          ('string' != typeof (r = e) &&
                            'number' != typeof r) ||
                          isNaN(r) ||
                          isNaN(parseFloat(r))
                        ) {
                          if ('string' == typeof e || 'number' == typeof e) {
                            const t = 1e3 * parseFloat(e);
                            t == t
                              ? (e = t)
                              : 'string' == typeof e &&
                                a.push({
                                  item: c,
                                  refIndex: c._index,
                                });
                          }
                        } else e = parseInt(e);
                        'number' == typeof e &&
                          e == e &&
                          ((c.commentRenderer.likesForSort = e),
                          i.push({
                            item: c,
                            refIndex: c._index,
                          }));
                      }
                      if (
                        (i.length > 0 &&
                          i.sort(
                            (e, t) =>
                              t.item.commentRenderer.likesForSort -
                              e.item.commentRenderer.likesForSort
                          ),
                        a.length > 0)
                      ) {
                        a.sort((e, t) =>
                          e.item.commentRenderer.voteCount.simpleText >
                          t.item.commentRenderer.voteCount.simpleText
                            ? 1
                            : e.item.commentRenderer.voteCount.simpleText <
                              t.item.commentRenderer.voteCount.simpleText
                            ? -1
                            : 0
                        );
                        for (const e of a) i.unshift(e);
                      }
                      return i;
                    } catch (e) {
                      return [];
                    }
                    var r;
                  })(textSearchResults);
                  (p = e), wn(t, p, !0, i);
                } else if (null == n ? void 0 : n.links) {
                  const n = (function (t) {
                    if (0 === t.length) return [];
                    try {
                      const n = [];
                      for (const [o, r] of t.entries())
                        try {
                          e(mt)().test(
                            r.commentRenderer.contentText.fullText
                          ) &&
                            n.push({
                              item: r,
                              refIndex: r._index,
                            });
                        } catch (e) {
                          continue;
                        }
                      return n;
                    } catch (e) {
                      return [];
                    }
                  })(textSearchResults);
                  if (((p = n), p.length > 0)) {
                    null == p || p.sort((e, t) => e.refIndex - t.refIndex);
                    const e = document.getElementById('ycs_btn_links'),
                      order = getLockedFilterSortOrder(e.dataset[n.sortKey]);
                    'newest' === order
                      ? (wn(t, p, !0, i),
                        !n.skipButtonUIUpdate &&
                          ((e.dataset[n.sortKey] = 'oldest'),
                          (e.innerHTML =
                            'Links \n        <span class="ycs-icons">\n            <svg width="16px" height="16px" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor" class="bi bi-sort-down">\n                <path d="M3.5 2.5a.5.5 0 0 0-1 0v8.793l-1.146-1.147a.5.5 0 0 0-.708.708l2 1.999.007.007a.497.497 0 0 0 .7-.006l2-2a.5.5 0 0 0-.707-.708L3.5 11.293V2.5zm3.5 1a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zM7.5 6a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1h-5zm0 3a.5.5 0 0 0 0 1h3a.5.5 0 0 0 0-1h-3zm0 3a.5.5 0 0 0 0 1h1a.5.5 0 0 0 0-1h-1z"/>\n            </svg>\n        </span>\n    '),
                          (e.title =
                            'Shows links in comments, replies, chat, video transcript (Newest)')))
                      : 'oldest' === order
                      ? (wn(t, null == p ? void 0 : p.reverse(), !0, i),
                        !n.skipButtonUIUpdate &&
                          ((e.dataset[n.sortKey] = 'newest'),
                          (e.innerHTML =
                            'Links \n        <span class="ycs-icons">\n            <svg width="16px" height="16px" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor" class="bi bi-sort-up">\n                <path d="M3.5 12.5a.5.5 0 0 1-1 0V3.707L1.354 4.854a.5.5 0 1 1-.708-.708l2-1.999.007-.007a.498.498 0 0 1 .7.006l2 2a.5.5 0 1 1-.707.708L3.5 3.707V12.5zm3.5-9a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zM7.5 6a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1h-5zm0 3a.5.5 0 0 0 0 1h3a.5.5 0 0 0 0-1h-3zm0 3a.5.5 0 0 0 0 1h1a.5.5 0 0 0 0-1h-1z"/>\n            </svg>\n        </span>\n    '),
                          (e.title =
                            'Shows links in comments, replies, chat, video transcript (Oldest)')))
                      : (wn(t, p, !0, i),
                        !n.skipButtonUIUpdate &&
                          (e.innerHTML =
                            'Links \n        <span class="ycs-icons">\n            <svg width="16px" height="16px" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor" class="bi bi-sort-down">\n                <path d="M3.5 2.5a.5.5 0 0 0-1 0v8.793l-1.146-1.147a.5.5 0 0 0-.708.708l2 1.999.007.007a.497.497 0 0 0 .7-.006l2-2a.5.5 0 0 0-.707-.708L3.5 11.293V2.5zm3.5 1a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zM7.5 6a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1h-5zm0 3a.5.5 0 0 0 0 1h3a.5.5 0 0 0 0-1h-3zm0 3a.5.5 0 0 0 0 1h1a.5.5 0 0 0 0-1h-1z"/>\n            </svg>\n        </span>\n    '));
                  }
                } else if (null == n ? void 0 : n.members) {
                  const e = (function (e) {
                    if (0 === e.length) return [];
                    try {
                      const r = [];
                      for (const [i, a] of e.entries()) {
                        var t, n, o;
                        (null == a ||
                        null === (t = a.commentRenderer) ||
                        void 0 === t ||
                        null === (n = t.sponsorCommentBadge) ||
                        void 0 === n ||
                        null === (o = n.sponsorCommentBadgeRenderer) ||
                        void 0 === o
                          ? void 0
                          : o.tooltip) &&
                          r.push({
                            item: a,
                            refIndex: a._index,
                          });
                      }
                      return r;
                    } catch (e) {
                      return [];
                    }
                  })(textSearchResults);
                  if (((p = e), p.length > 0)) {
                    null == p || p.sort((e, t) => e.refIndex - t.refIndex);
                    const e = document.getElementById('ycs_btn_members'),
                      order = getLockedFilterSortOrder(e.dataset[n.sortKey]);
                    'newest' === order
                      ? (wn(t, p, !0, i),
                        !n.skipButtonUIUpdate &&
                          ((e.dataset[n.sortKey] = 'oldest'),
                          (e.innerHTML =
                            'Members \n        <span class="ycs-icons">\n            <svg width="16px" height="16px" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor" class="bi bi-sort-down">\n                <path d="M3.5 2.5a.5.5 0 0 0-1 0v8.793l-1.146-1.147a.5.5 0 0 0-.708.708l2 1.999.007.007a.497.497 0 0 0 .7-.006l2-2a.5.5 0 0 0-.707-.708L3.5 11.293V2.5zm3.5 1a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zM7.5 6a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1h-5zm0 3a.5.5 0 0 0 0 1h3a.5.5 0 0 0 0-1h-3zm0 3a.5.5 0 0 0 0 1h1a.5.5 0 0 0 0-1h-1z"/>\n            </svg>\n        </span>\n    '),
                          (e.title =
                            'Show comments, replies, chat from channel members (Newest)')))
                      : 'oldest' === order
                      ? (wn(t, null == p ? void 0 : p.reverse(), !0, i),
                        !n.skipButtonUIUpdate &&
                          ((e.dataset[n.sortKey] = 'newest'),
                          (e.innerHTML =
                            'Members \n        <span class="ycs-icons">\n            <svg width="16px" height="16px" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor" class="bi bi-sort-up">\n                <path d="M3.5 12.5a.5.5 0 0 1-1 0V3.707L1.354 4.854a.5.5 0 1 1-.708-.708l2-1.999.007-.007a.498.498 0 0 1 .7.006l2 2a.5.5 0 1 1-.707.708L3.5 3.707V12.5zm3.5-9a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zM7.5 6a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1h-5zm0 3a.5.5 0 0 0 0 1h3a.5.5 0 0 0 0-1h-3zm0 3a.5.5 0 0 0 0 1h1a.5.5 0 0 0 0-1h-1z"/>\n            </svg>\n        </span>\n    '),
                          (e.title =
                            'Show comments, replies, chat from channel members (Oldest)')))
                      : (wn(t, p, !0, i),
                        !n.skipButtonUIUpdate &&
                          (e.innerHTML =
                            'Members \n        <span class="ycs-icons">\n            <svg width="16px" height="16px" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor" class="bi bi-sort-down">\n                <path d="M3.5 2.5a.5.5 0 0 0-1 0v8.793l-1.146-1.147a.5.5 0 0 0-.708.708l2 1.999.007.007a.497.497 0 0 0 .7-.006l2-2a.5.5 0 0 0-.707-.708L3.5 11.293V2.5zm3.5 1a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zM7.5 6a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1h-5zm0 3a.5.5 0 0 0 0 1h3a.5.5 0 0 0 0-1h-3zm0 3a.5.5 0 0 0 0 1h1a.5.5 0 0 0 0-1h-1z"/>\n            </svg>\n        </span>\n    '));
                  }
                } else if (null == n ? void 0 : n.replied) {
                  const e = (function (e) {
                    if (0 === e.length) return [];
                    try {
                      const n = [];
                      for (const [o, r] of e.entries()) {
                        var t;
                        let e =
                          null == r ||
                          null === (t = r.commentRenderer) ||
                          void 0 === t
                            ? void 0
                            : t.replyCount;
                        (e = parseInt(e)),
                          e &&
                            ((r.commentRenderer.repliedForSort = e),
                            n.push({
                              item: r,
                              refIndex: r._index,
                            }));
                      }
                      return n.length > 0
                        ? (n.sort(
                            (e, t) =>
                              t.item.commentRenderer.repliedForSort -
                              e.item.commentRenderer.repliedForSort
                          ),
                          n)
                        : [];
                    } catch (e) {
                      return [];
                    }
                  })(textSearchResults);
                  (p = e), wn(t, p, !0, i);
                } else if (null == n ? void 0 : n.author) {
                  const e = (function (e) {
                    if (0 === e.length) return [];
                    try {
                      var t;
                      const n = [];
                      for (const [o, r] of e.entries())
                        (null == r ||
                        null === (t = r.commentRenderer) ||
                        void 0 === t
                          ? void 0
                          : t.authorIsChannelOwner) &&
                          n.push({
                            item: r,
                            refIndex: r._index,
                          });
                      return n;
                    } catch (e) {
                      return [];
                    }
                  })(textSearchResults);
                  if (((p = e), p.length > 0)) {
                    null == p || p.sort((e, t) => e.refIndex - t.refIndex);
                    const e = document.getElementById('ycs_btn_author'),
                      order = getLockedFilterSortOrder(e.dataset[n.sortKey]);
                    'newest' === order
                      ? (wn(t, p, !0, i),
                        !n.skipButtonUIUpdate &&
                          ((e.dataset[n.sortKey] = 'oldest'),
                          (e.innerHTML =
                            'Author \n        <span class="ycs-icons">\n            <svg width="16px" height="16px" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor" class="bi bi-sort-down">\n                <path d="M3.5 2.5a.5.5 0 0 0-1 0v8.793l-1.146-1.147a.5.5 0 0 0-.708.708l2 1.999.007.007a.497.497 0 0 0 .7-.006l2-2a.5.5 0 0 0-.707-.708L3.5 11.293V2.5zm3.5 1a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zM7.5 6a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1h-5zm0 3a.5.5 0 0 0 0 1h3a.5.5 0 0 0 0-1h-3zm0 3a.5.5 0 0 0 0 1h1a.5.5 0 0 0 0-1h-1z"/>\n            </svg>\n        </span>\n    '),
                          (e.title =
                            'Show comments, replies, chat from the author (Newest)')))
                      : 'oldest' === order
                      ? (wn(t, null == p ? void 0 : p.reverse(), !0, i),
                        !n.skipButtonUIUpdate &&
                          ((e.dataset[n.sortKey] = 'newest'),
                          (e.innerHTML =
                            'Author \n        <span class="ycs-icons">\n            <svg width="16px" height="16px" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor" class="bi bi-sort-up">\n                <path d="M3.5 12.5a.5.5 0 0 1-1 0V3.707L1.354 4.854a.5.5 0 1 1-.708-.708l2-1.999.007-.007a.498.498 0 0 1 .7.006l2 2a.5.5 0 1 1-.707.708L3.5 3.707V12.5zm3.5-9a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zM7.5 6a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1h-5zm0 3a.5.5 0 0 0 0 1h3a.5.5 0 0 0 0-1h-3zm0 3a.5.5 0 0 0 0 1h1a.5.5 0 0 0 0-1h-1z"/>\n            </svg>\n        </span>\n    '),
                          (e.title =
                            'Show comments, replies, chat from the author (Oldest)')))
                      : (wn(t, p, !0, i),
                        !n.skipButtonUIUpdate &&
                          (e.innerHTML =
                            'Author \n        <span class="ycs-icons">\n            <svg width="16px" height="16px" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor" class="bi bi-sort-down">\n                <path d="M3.5 2.5a.5.5 0 0 0-1 0v8.793l-1.146-1.147a.5.5 0 0 0-.708.708l2 1.999.007.007a.497.497 0 0 0 .7-.006l2-2a.5.5 0 0 0-.707-.708L3.5 11.293V2.5zm3.5 1a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zM7.5 6a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1h-5zm0 3a.5.5 0 0 0 0 1h3a.5.5 0 0 0 0-1h-3zm0 3a.5.5 0 0 0 0 1h1a.5.5 0 0 0 0-1h-1z"/>\n            </svg>\n        </span>\n    '));
                  }
                } else if (null == n ? void 0 : n.heart) {
                  const e = (function (e) {
                    if (0 === e.length) return [];
                    try {
                      var t;
                      const n = [];
                      for (const [o, r] of e.entries())
                        (null == r ||
                        null === (t = r.commentRenderer) ||
                        void 0 === t
                          ? void 0
                          : t.creatorHeart) &&
                          n.push({
                            item: r,
                            refIndex: r._index,
                          });
                      return n;
                    } catch (e) {
                      return [];
                    }
                  })(textSearchResults);
                  if (((p = e), p.length > 0)) {
                    null == p || p.sort((e, t) => e.refIndex - t.refIndex);
                    const e = document.getElementById('ycs_btn_heart'),
                      order = getLockedFilterSortOrder(e.dataset[n.sortKey]);
                    'newest' === order
                      ? (wn(t, p, !0, i),
                        !n.skipButtonUIUpdate &&
                          ((e.dataset[n.sortKey] = 'oldest'),
                          (e.innerHTML =
                            '<span class="ycs-creator-heart_icon">❤</span> \n        <span class="ycs-icons">\n            <svg width="16px" height="16px" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor" class="bi bi-sort-down">\n                <path d="M3.5 2.5a.5.5 0 0 0-1 0v8.793l-1.146-1.147a.5.5 0 0 0-.708.708l2 1.999.007.007a.497.497 0 0 0 .7-.006l2-2a.5.5 0 0 0-.707-.708L3.5 11.293V2.5zm3.5 1a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zM7.5 6a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1h-5zm0 3a.5.5 0 0 0 0 1h3a.5.5 0 0 0 0-1h-3zm0 3a.5.5 0 0 0 0 1h1a.5.5 0 0 0 0-1h-1z"/>\n            </svg>\n        </span>\n    '),
                          (e.title =
                            'Show comments and replies that the author likes (Newest)')))
                      : 'oldest' === order
                      ? (wn(t, null == p ? void 0 : p.reverse(), !0, i),
                        !n.skipButtonUIUpdate &&
                          ((e.dataset[n.sortKey] = 'newest'),
                          (e.innerHTML =
                            '<span class="ycs-creator-heart_icon">❤</span> \n        <span class="ycs-icons">\n            <svg width="16px" height="16px" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor" class="bi bi-sort-up">\n                <path d="M3.5 12.5a.5.5 0 0 1-1 0V3.707L1.354 4.854a.5.5 0 1 1-.708-.708l2-1.999.007-.007a.498.498 0 0 1 .7.006l2 2a.5.5 0 1 1-.707.708L3.5 3.707V12.5zm3.5-9a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zM7.5 6a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1h-5zm0 3a.5.5 0 0 0 0 1h3a.5.5 0 0 0 0-1h-3zm0 3a.5.5 0 0 0 0 1h1a.5.5 0 0 0 0-1h-1z"/>\n            </svg>\n        </span>\n    '),
                          (e.title =
                            'Show comments and replies that the author likes (Oldest)')))
                      : (wn(t, p, !0, i),
                        !n.skipButtonUIUpdate &&
                          (e.innerHTML =
                            '<span class="ycs-creator-heart_icon">❤</span> \n        <span class="ycs-icons">\n            <svg width="16px" height="16px" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor" class="bi bi-sort-down">\n                <path d="M3.5 2.5a.5.5 0 0 0-1 0v8.793l-1.146-1.147a.5.5 0 0 0-.708.708l2 1.999.007.007a.497.497 0 0 0 .7-.006l2-2a.5.5 0 0 0-.707-.708L3.5 11.293V2.5zm3.5 1a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zM7.5 6a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1h-5zm0 3a.5.5 0 0 0 0 1h3a.5.5 0 0 0 0-1h-3zm0 3a.5.5 0 0 0 0 1h1a.5.5 0 0 0 0-1h-1z"/>\n            </svg>\n        </span>\n    '));
                  }
                } else if (null == n ? void 0 : n.verified) {
                  const e = (function (e) {
                    if (0 === e.length) return [];
                    try {
                      const t = [];
                      for (const [n, o] of e.entries())
                        o.commentRenderer.verifiedAuthor &&
                          t.push({
                            item: o,
                            refIndex: o._index,
                          });
                      return t;
                    } catch (e) {
                      return [];
                    }
                  })(textSearchResults);
                  if (((p = e), p.length > 0)) {
                    null == p || p.sort((e, t) => e.refIndex - t.refIndex);
                    const e = document.getElementById('ycs_btn_verified'),
                      order = getLockedFilterSortOrder(e.dataset[n.sortKey]);
                    'newest' === order
                      ? (wn(t, p, !0, i),
                        !n.skipButtonUIUpdate &&
                          ((e.dataset[n.sortKey] = 'oldest'),
                          (e.innerHTML =
                            '<span class="ycs-creator-verified_icon">✔</span> \n        <span class="ycs-icons">\n            <svg width="16px" height="16px" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor" class="bi bi-sort-down">\n                <path d="M3.5 2.5a.5.5 0 0 0-1 0v8.793l-1.146-1.147a.5.5 0 0 0-.708.708l2 1.999.007.007a.497.497 0 0 0 .7-.006l2-2a.5.5 0 0 0-.707-.708L3.5 11.293V2.5zm3.5 1a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zM7.5 6a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1h-5zm0 3a.5.5 0 0 0 0 1h3a.5.5 0 0 0 0-1h-3zm0 3a.5.5 0 0 0 0 1h1a.5.5 0 0 0 0-1h-1z"/>\n            </svg>\n        </span>\n    '),
                          (e.title =
                            'Show comments,  replies and chat from a verified authors (Newest)')))
                      : 'oldest' === order
                      ? (wn(t, null == p ? void 0 : p.reverse(), !0, i),
                        !n.skipButtonUIUpdate &&
                          ((e.dataset[n.sortKey] = 'newest'),
                          (e.innerHTML =
                            '<span class="ycs-creator-verified_icon">✔</span> \n        <span class="ycs-icons">\n            <svg width="16px" height="16px" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor" class="bi bi-sort-up">\n                <path d="M3.5 12.5a.5.5 0 0 1-1 0V3.707L1.354 4.854a.5.5 0 1 1-.708-.708l2-1.999.007-.007a.498.498 0 0 1 .7.006l2 2a.5.5 0 1 1-.707.708L3.5 3.707V12.5zm3.5-9a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zM7.5 6a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1h-5zm0 3a.5.5 0 0 0 0 1h3a.5.5 0 0 0 0-1h-3zm0 3a.5.5 0 0 0 0 1h1a.5.5 0 0 0 0-1h-1z"/>\n            </svg>\n        </span>\n    '),
                          (e.title =
                            'Show comments,  replies and chat from a verified authors (Oldest)')))
                      : (wn(t, p, !0, i),
                        !n.skipButtonUIUpdate &&
                          (e.innerHTML =
                            '<span class="ycs-creator-verified_icon">✔</span> \n        <span class="ycs-icons">\n            <svg width="16px" height="16px" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor" class="bi bi-sort-down">\n                <path d="M3.5 2.5a.5.5 0 0 0-1 0v8.793l-1.146-1.147a.5.5 0 0 0-.708.708l2 1.999.007.007a.497.497 0 0 0 .7-.006l2-2a.5.5 0 0 0-.707-.708L3.5 11.293V2.5zm3.5 1a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zM7.5 6a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1h-5zm0 3a.5.5 0 0 0 0 1h3a.5.5 0 0 0 0-1h-3zm0 3a.5.5 0 0 0 0 1h1a.5.5 0 0 0 0-1h-1z"/>\n            </svg>\n        </span>\n    '));
                  }
                } else if (null == n ? void 0 : n.random) {
                  const e = (function (e) {
                    if (0 === e.length) return [];
                    try {
                      const t = new Map();
                      for (const [n, o] of e.entries())
                        'C' === (null == o ? void 0 : o.typeComment) &&
                          (t.has(
                            qt(
                              () =>
                                o.commentRenderer.authorEndpoint.browseEndpoint
                                  .canonicalBaseUrl
                            )
                          )
                            ? t
                                .get(
                                  o.commentRenderer.authorEndpoint
                                    .browseEndpoint.canonicalBaseUrl
                                )
                                .add(n)
                            : qt(
                                () =>
                                  o.commentRenderer.authorEndpoint
                                    .browseEndpoint.canonicalBaseUrl
                              ) &&
                              t.set(
                                o.commentRenderer.authorEndpoint.browseEndpoint
                                  .canonicalBaseUrl,
                                new Set().add(n)
                              ));
                      if (!(t.size > 0)) return [];
                      {
                        const n = Vt(0, t.size - 1);
                        let o = 0;
                        for (const [, r] of t.entries()) {
                          if (o === n) {
                            const t = Vt(0, r.size - 1);
                            let n = 0;
                            for (const [, o] of r.entries()) {
                              if (n === t)
                                return [
                                  {
                                    item: e[o],
                                    refIndex: o,
                                  },
                                ];
                              n++;
                            }
                            break;
                          }
                          o++;
                        }
                      }
                      return [];
                    } catch (e) {
                      return [];
                    }
                  })(textSearchResults);
                  (p = e), wn(t, p, !0, i);
                } else if (null == n ? void 0 : n.timestamp) {
                  p = (function (e) {
                    if (0 === e.length) return [];
                    try {
                      const t = [];
                      for (const [n, o] of e.entries())
                        o.commentRenderer?.isTimeLine === 'timeline' &&
                          t.push({
                            item: o,
                            refIndex: o._index,
                          });
                      return t;
                    } catch (e) {
                      return [];
                    }
                  })(textSearchResults);

                  if (p.length > 0) {
                    null == p || p.sort((e, t) => e.refIndex - t.refIndex);
                    const e = document.getElementById('ycs_btn_timestamps'),
                      order = getLockedFilterSortOrder(e.dataset[n.sortKey]);
                    'newest' === order
                      ? (wn(t, p, !0, i),
                        !n.skipButtonUIUpdate &&
                          ((e.dataset[n.sortKey] = 'oldest'),
                          (e.innerHTML =
                            'Time stamps \n        <span class="ycs-icons">\n            <svg width="16px" height="16px" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor" class="bi bi-sort-down">\n                <path d="M3.5 2.5a.5.5 0 0 0-1 0v8.793l-1.146-1.147a.5.5 0 0 0-.708.708l2 1.999.007.007a.497.497 0 0 0 .7-.006l2-2a.5.5 0 0 0-.707-.708L3.5 11.293V2.5zm3.5 1a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zM7.5 6a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1h-5zm0 3a.5.5 0 0 0 0 1h3a.5.5 0 0 0 0-1h-3zm0 3a.5.5 0 0 0 0 1h1a.5.5 0 0 0 0-1h-1z"/>\n            </svg>\n        </span>\n    '),
                          (e.title =
                            'Show comments, replies, chat with time stamps (Newest)')))
                      : 'oldest' === order
                      ? (wn(t, null == p ? void 0 : p.reverse(), !0, i),
                        !n.skipButtonUIUpdate &&
                          ((e.dataset[n.sortKey] = 'newest'),
                          (e.innerHTML =
                            'Time stamps \n        <span class="ycs-icons">\n            <svg width="16px" height="16px" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor" class="bi bi-sort-up">\n                <path d="M3.5 12.5a.5.5 0 0 1-1 0V3.707L1.354 4.854a.5.5 0 1 1-.708-.708l2-1.999.007-.007a.498.498 0 0 1 .7.006l2 2a.5.5 0 1 1-.707.708L3.5 3.707V12.5zm3.5-9a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zM7.5 6a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1h-5zm0 3a.5.5 0 0 0 0 1h3a.5.5 0 0 0 0-1h-3zm0 3a.5.5 0 0 0 0 1h1a.5.5 0 0 0 0-1h-1z"/>\n            </svg>\n        </span>\n    '),
                          (e.title =
                            'Show comments, replies, chat with time stamps (Oldest)')))
                      : (wn(t, p, !0, i),
                        !n.skipButtonUIUpdate &&
                          (e.innerHTML =
                            'Time stamps \n        <span class="ycs-icons">\n            <svg width="16px" height="16px" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor" class="bi bi-sort-down">\n                <path d="M3.5 2.5a.5.5 0 0 0-1 0v8.793l-1.146-1.147a.5.5 0 0 0-.708.708l2 1.999.007.007a.497.497 0 0 0 .7-.006l2-2a.5.5 0 0 0-.707-.708L3.5 11.293V2.5zm3.5 1a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zM7.5 6a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1h-5zm0 3a.5.5 0 0 0 0 1h3a.5.5 0 0 0 0-1h-3zm0 3a.5.5 0 0 0 0 1h1a.5.5 0 0 0 0-1h-1z"/>\n            </svg>\n        </span>\n    '));
                  }
                } else if (null == n ? void 0 : n.sortFirst) {
                  const e = (function (e) {
                    try {
                      if (e && 0 === e.length) return;
                      const t = [];
                      for (const [n, o] of e.entries())
                        try {
                          'C' === (null == o ? void 0 : o.typeComment) &&
                            t.push({
                              item: o,
                              refIndex: o._index,
                            });
                        } catch (e) {
                          continue;
                        }
                      if (t.length > 0) return t;
                    } catch (e) {}
                  })(textSearchResults);
                  if (((p = e), p.length > 0)) {
                    null == p || p.sort((e, t) => e.refIndex - t.refIndex);
                    const e = document.getElementById('ycs_btn_sort_first'),
                      order = getLockedFilterSortOrder(e.dataset[n.sortKey]);
                    'newest' === order
                      ? (wn(t, p, !0, i),
                        !n.skipButtonUIUpdate &&
                          ((e.dataset[n.sortKey] = 'oldest'),
                          (e.innerHTML =
                            'All \n        <span class="ycs-icons">\n            <svg width="16px" height="16px" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor" class="bi bi-sort-down">\n                <path d="M3.5 2.5a.5.5 0 0 0-1 0v8.793l-1.146-1.147a.5.5 0 0 0-.708.708l2 1.999.007.007a.497.497 0 0 0 .7-.006l2-2a.5.5 0 0 0-.707-.708L3.5 11.293V2.5zm3.5 1a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zM7.5 6a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1h-5zm0 3a.5.5 0 0 0 0 1h3a.5.5 0 0 0 0-1h-3zm0 3a.5.5 0 0 0 0 1h1a.5.5 0 0 0 0-1h-1z"/>\n            </svg>\n        </span>\n    '),
                          (e.title =
                            'Show all comments, chat, video transcript sorted by date (Newest)')))
                      : 'oldest' === order
                      ? (wn(t, null == p ? void 0 : p.reverse(), !0, i),
                        !n.skipButtonUIUpdate &&
                          ((e.dataset[n.sortKey] = 'newest'),
                          (e.innerHTML =
                            'All \n        <span class="ycs-icons">\n            <svg width="16px" height="16px" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor" class="bi bi-sort-up">\n                <path d="M3.5 12.5a.5.5 0 0 1-1 0V3.707L1.354 4.854a.5.5 0 1 1-.708-.708l2-1.999.007-.007a.498.498 0 0 1 .7.006l2 2a.5.5 0 1 1-.707.708L3.5 3.707V12.5zm3.5-9a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zM7.5 6a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1h-5zm0 3a.5.5 0 0 0 0 1h3a.5.5 0 0 0 0-1h-3zm0 3a.5.5 0 0 0 0 1h1a.5.5 0 0 0 0-1h-1z"/>\n            </svg>\n        </span>\n    '),
                          (e.title =
                            'Show all comments, chat, video transcript sorted by date (Oldest)')))
                      : (wn(t, p, !0, i),
                        !n.skipButtonUIUpdate &&
                          (e.innerHTML =
                            'All \n        <span class="ycs-icons">\n            <svg width="16px" height="16px" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor" class="bi bi-sort-down">\n                <path d="M3.5 2.5a.5.5 0 0 0-1 0v8.793l-1.146-1.147a.5.5 0 0 0-.708.708l2 1.999.007.007a.497.497 0 0 0 .7-.006l2-2a.5.5 0 0 0-.707-.708L3.5 11.293V2.5zm3.5 1a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zM7.5 6a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1h-5zm0 3a.5.5 0 0 0 0 1h3a.5.5 0 0 0 0-1h-3zm0 3a.5.5 0 0 0 0 1h1a.5.5 0 0 0 0-1h-1z"/>\n            </svg>\n        </span>\n    '));
                  }
                } else {
                  (p = textSearchFuseResults ?? []), wn(t, p, !0, i);
                }
                const f = document.getElementById('ycs-search-total-result');
                f && (f.innerText = `(Comments) Found: ${p.length}`),
                  (countsReport.comments = p.length);
                const currentVideoId = getVideoId(window.location.href);
                const v = document.getElementById('ycs_wrap_comments');
                v &&
                  v.addEventListener('click', (e) => {
                    try {
                      var t, n, o, r, s, c;
                      if (
                        null === (t = e.target) ||
                        void 0 === t ||
                        null === (n = t.classList) ||
                        void 0 === n
                          ? void 0
                          : n.contains('ycs-open-comment')
                      ) {
                        const t = parseInt(e.target.getAttribute('id'), 10),
                          n = e.target.closest('.ycs-render-comment');
                        if (n && t && !document.getElementById('ycs-com-' + t))
                          try {
                            var l, d, u, h;
                            const o = {
                                item: commentsDataBuf[t].originComment,
                                refIndex: t,
                              },
                              r = document.createElement('div');
                            let s;
                            if (
                              ((r.id = 'ycs-com-' + t.toString()),
                              (r.className = r.id),
                              n.insertAdjacentElement('beforebegin', r),
                              wn('#' + r.id, [o], !0, i),
                              n.classList.add('ycs-oc-ml'),
                              (null === (l = commentsDataBuf[t]) ||
                              void 0 === l ||
                              null === (d = l.commentRenderer) ||
                              void 0 === d ||
                              null === (u = d.contentText) ||
                              void 0 === u ||
                              null === (h = u.runs) ||
                              void 0 === h
                                ? void 0
                                : h.length) > 0)
                            )
                              for (const e of commentsDataBuf[t].commentRenderer
                                .contentText.runs)
                                try {
                                  var m, p;
                                  if (
                                    null === (m = e.navigationEndpoint) ||
                                    void 0 === m ||
                                    null === (p = m.browseEndpoint) ||
                                    void 0 === p
                                      ? void 0
                                      : p.canonicalBaseUrl
                                  ) {
                                    var f, v;
                                    s =
                                      null === (f = e.navigationEndpoint) ||
                                      void 0 === f ||
                                      null === (v = f.browseEndpoint) ||
                                      void 0 === v
                                        ? void 0
                                        : v.canonicalBaseUrl;
                                    break;
                                  }
                                } catch (e) {
                                  continue;
                                }
                            const c = [];
                            if (s)
                              for (const e of commentsDataBuf)
                                try {
                                  var y, g, w;
                                  'R' === e.typeComment &&
                                    e.originComment ===
                                      commentsDataBuf[t].originComment &&
                                    (null === (y = e.commentRenderer) ||
                                    void 0 === y ||
                                    null === (g = y.authorEndpoint) ||
                                    void 0 === g ||
                                    null === (w = g.browseEndpoint) ||
                                    void 0 === w
                                      ? void 0
                                      : w.canonicalBaseUrl) === s &&
                                    c.push({
                                      item: e,
                                      refIndex: t,
                                    });
                                } catch (e) {
                                  continue;
                                }
                            if (c.length > 0) {
                              const e = document.createElement('div');
                              (e.id = 'ycs-com-rauth-' + t.toString()),
                                (e.className = `ycs-com-${t} ycs-oc-ml`),
                                n.insertAdjacentElement('beforebegin', e),
                                wn('#' + e.id, c, !1, i);
                            }
                            (e.target.innerHTML = '▲'),
                              (e.target.title =
                                'Close the comment to the reply here.');
                          } catch (e) {}
                        else
                          n &&
                            t &&
                            document.getElementById('ycs-com-' + t) &&
                            (sn('.ycs-com-' + t),
                            n.classList.remove('ycs-oc-ml'),
                            (e.target.innerHTML = '▼'),
                            (e.target.title =
                              'Open the comment to the reply here.'));
                      } else if (
                        null === (o = e.target) ||
                        void 0 === o ||
                        null === (r = o.classList) ||
                        void 0 === r
                          ? void 0
                          : r.contains('ycs-gotochat-video')
                      ) {
                        if (o.dataset.videoId === currentVideoId) {
                          e.preventDefault();
                          const t = document.getElementsByTagName('video')[0];
                          if (t) {
                            const n = e.target.dataset.offsetvideo;
                            n && (t.currentTime = parseInt(n));
                          }
                        }
                      } else if (
                        null === (s = e.target) ||
                        void 0 === s ||
                        null === (c = s.classList) ||
                        void 0 === c
                          ? void 0
                          : c.contains('ycs-open-reply')
                      ) {
                        const t = e.target.dataset.idcom,
                          n = e.target.closest('.ycs-render-comment');
                        if (
                          null == n
                            ? void 0
                            : n.querySelector(`.ycs-com-replies-${t}`)
                        ) {
                          const o = n.querySelector(`.ycs-com-replies-${t}`);
                          return (
                            null == o || o.remove(),
                            (e.target.innerHTML = '+'),
                            void (e.target.title =
                              'Open replies to the comment')
                          );
                        }
                        const o = [];
                        if (t) {
                          let e;
                          for (const [n, o] of commentsDataBuf.entries())
                            try {
                              var b;
                              if (
                                (null === (b = o.commentRenderer) ||
                                void 0 === b
                                  ? void 0
                                  : b.commentId) === t
                              ) {
                                e = n;
                                break;
                              }
                            } catch (e) {
                              continue;
                            }
                          if (Number.isInteger(e) && e >= 0)
                            for (const n of commentsDataBuf)
                              try {
                                commentsDataBuf[e] === n.originComment &&
                                  o.push({
                                    item: n,
                                    refIndex: t,
                                  });
                              } catch (e) {
                                continue;
                              }
                        }
                        if (o.length > 0) {
                          const n = e.target.closest('.ycs-render-comment'),
                            r = document.createElement('div');
                          (r.id = 'ycs-com-replies-' + t),
                            (r.className = `ycs-com-replies-${t} ycs-oc-ml ycs-com-replies ycs-com-rp`),
                            null == n ||
                              n.insertAdjacentElement('beforeend', r),
                            wn(r, o, !1, i),
                            (e.target.innerHTML = String.fromCharCode(8722)),
                            (e.target.title = 'Close replies to the comment');
                        }
                      }
                    } catch (e) {}
                  });
              } catch (e) {}
            };
            const handleChatSearch = (t, _n) => {
              const n = _n
                ? {
                    ..._n,
                    sortKey: _n.sortKey ?? 'sortChat',
                  }
                : undefined;

              function rebuildChatData(chatItems) {
                const chatData = new Map();
                chatItems.forEach((chatItem) => {
                  const key = qt(() =>
                    Number(
                      chatItem.replayChatItemAction.actions[0].addChatItemAction
                        .item.liveChatTextMessageRenderer.timestampUsec
                    )
                  );
                  chatData.set(key, chatItem);
                });
                return chatData;
              }

              try {
                if (
                  (null == n ? void 0 : n.likes) ||
                  (null == n ? void 0 : n.replied) ||
                  (null == n ? void 0 : n.random) ||
                  (null == n ? void 0 : n.heart)
                )
                  return;
                if (chatDataBuf && chatDataBuf.size > 0) {
                  const o = document.querySelector(t),
                    i = document.getElementById('ycs-input-search'),
                    // chat data is a Map keyed with microsecond timestamp
                    chatItemsBuf = [...chatDataBuf.values()];
                  let l = '';
                  i && (l = i.value), o && (o.textContent = '');
                  const d = document.getElementById(
                      'ycs_extended_search_title'
                    ),
                    u = document.getElementById('ycs_extended_search_main');
                  let h = fuseOptionsBase,
                    m = [
                      'replayChatItemAction.actions.addChatItemAction.item.liveChatTextMessageRenderer.authorName.simpleText',
                      'replayChatItemAction.actions.addChatItemAction.item.liveChatTextMessageRenderer.message.fullText',
                    ];
                  L.checked &&
                    ((h = JSON.parse(JSON.stringify(fuseOptionsBase))),
                    (h.useExtendedSearch = !0),
                    d.checked &&
                      (m = [
                        'replayChatItemAction.actions.addChatItemAction.item.liveChatTextMessageRenderer.authorName.simpleText',
                      ]),
                    u.checked &&
                      (m = [
                        'replayChatItemAction.actions.addChatItemAction.item.liveChatTextMessageRenderer.message.fullText',
                      ]));
                  const p = {
                    ...h,
                    keys: m,
                  };
                  const searchText = l.trim();
                  const textSearchFuseResults = searchText
                    ? new (e(I))(chatItemsBuf, p).search(searchText)
                    : null;
                  const textSearchResults =
                    textSearchFuseResults !== null
                      ? textSearchFuseResults.map(({ item }) => item)
                      : chatItemsBuf;
                  let f = [];
                  if (null == n ? void 0 : n.author) {
                    const e = (function (e) {
                      if (0 === e.length) return [];
                      try {
                        const t = [],
                          n = qt(
                            () =>
                              ycsOptions.getInitYtData[2].playerResponse
                                .videoDetails.channelId
                          );
                        if (n)
                          for (const [o, r] of e.entries())
                            try {
                              qt(
                                () =>
                                  r.replayChatItemAction.actions[0]
                                    .addChatItemAction.item
                                    .liveChatTextMessageRenderer
                                    .authorExternalChannelId
                              ) === n &&
                                t.push({
                                  item: r,
                                  refIndex: o,
                                });
                            } catch (e) {
                              continue;
                            }
                        return t;
                      } catch (e) {
                        return [];
                      }
                    })(textSearchResults);
                    if (((f = e), (null == f ? void 0 : f.length) > 0)) {
                      null == f || f.sort((a, b) => b.refIndex - a.refIndex);
                      const e = document.getElementById('ycs_btn_author'),
                        order = getLockedFilterSortOrder(e.dataset[n.sortKey]);
                      if ('newest' === order) {
                        bn(t, f, l);
                        if (!n.skipButtonUIUpdate) {
                          e.dataset[n.sortKey] = 'oldest';
                          e.innerHTML = `
                            Author 
                            <span class="ycs-icons">
                                <svg width="16px" height="16px" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor" class="bi bi-sort-down">
                                    <path d="M3.5 2.5a.5.5 0 0 0-1 0v8.793l-1.146-1.147a.5.5 0 0 0-.708.708l2 1.999.007.007a.497.497 0 0 0 .7-.006l2-2a.5.5 0 0 0-.707-.708L3.5 11.293V2.5zm3.5 1a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zM7.5 6a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1h-5zm0 3a.5.5 0 0 0 0 1h3a.5.5 0 0 0 0-1h-3zm0 3a.5.5 0 0 0 0 1h1a.5.5 0 0 0 0-1h-1z"/>
                                </svg>
                            </span>
                          `;
                        }
                        e.title =
                          'Show comments, replies, chat from the author (Newest)';
                      } else if ('oldest' === order) {
                        bn(t, null == f ? void 0 : f.reverse(), l);
                        if (!n.skipButtonUIUpdate) {
                          e.dataset[n.sortKey] = 'newest';
                          e.innerHTML = `
                            Author 
                            <span class="ycs-icons">
                                <svg width="16px" height="16px" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor" class="bi bi-sort-up">
                                    <path d="M3.5 12.5a.5.5 0 0 1-1 0V3.707L1.354 4.854a.5.5 0 1 1-.708-.708l2-1.999.007-.007a.498.498 0 0 1 .7.006l2 2a.5.5 0 1 1-.707.708L3.5 3.707V12.5zm3.5-9a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zM7.5 6a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1h-5zm0 3a.5.5 0 0 0 0 1h3a.5.5 0 0 0 0-1h-3zm0 3a.5.5 0 0 0 0 1h1a.5.5 0 0 0 0-1h-1z"/>
                                </svg>
                            </span>
                          `;
                          e.title =
                            'Show comments, replies, chat from the author (Oldest)';
                        }
                      } else {
                        bn(t, f, l);
                      }
                    }
                  } else if (null == n ? void 0 : n.donated) {
                    const e = (function (e) {
                      if (0 === e.length) return [];
                      try {
                        const t = [];
                        for (const n of e)
                          qt(
                            () =>
                              n.replayChatItemAction.actions[0]
                                .addChatItemAction.item
                                .liveChatTextMessageRenderer.purchaseAmountText
                                .simpleText
                          ) &&
                            t.push({
                              item: n,
                              refIndex: qt(
                                () =>
                                  Number(
                                    n.replayChatItemAction.actions[0]
                                      .addChatItemAction.item
                                      .liveChatTextMessageRenderer.timestampUsec
                                  ) ?? 0
                              ),
                            });
                        return t;
                      } catch (e) {
                        return [];
                      }
                    })(textSearchResults);
                    if (((f = e), (null == f ? void 0 : f.length) > 0)) {
                      null == f || f.sort((a, b) => b.refIndex - a.refIndex);
                      const e = document.getElementById('ycs_btn_donated'),
                        order = getLockedFilterSortOrder(e.dataset[n.sortKey]);
                      'newest' === order
                        ? (bn(t, f, l),
                          !n.skipButtonUIUpdate &&
                            ((e.dataset[n.sortKey] = 'oldest'),
                            (e.innerHTML =
                              'Donated \n        <span class="ycs-icons">\n            <svg width="16px" height="16px" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor" class="bi bi-sort-down">\n                <path d="M3.5 2.5a.5.5 0 0 0-1 0v8.793l-1.146-1.147a.5.5 0 0 0-.708.708l2 1.999.007.007a.497.497 0 0 0 .7-.006l2-2a.5.5 0 0 0-.707-.708L3.5 11.293V2.5zm3.5 1a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zM7.5 6a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1h-5zm0 3a.5.5 0 0 0 0 1h3a.5.5 0 0 0 0-1h-3zm0 3a.5.5 0 0 0 0 1h1a.5.5 0 0 0 0-1h-1z"/>\n            </svg>\n        </span>\n    '),
                            (e.title =
                              'Show chat comments from users who have donated (Newest)')))
                        : 'oldest' === order
                        ? (bn(t, null == f ? void 0 : f.reverse(), l),
                          !n.skipButtonUIUpdate &&
                            ((e.dataset[n.sortKey] = 'newest'),
                            (e.innerHTML =
                              'Donated \n        <span class="ycs-icons">\n            <svg width="16px" height="16px" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor" class="bi bi-sort-up">\n                <path d="M3.5 12.5a.5.5 0 0 1-1 0V3.707L1.354 4.854a.5.5 0 1 1-.708-.708l2-1.999.007-.007a.498.498 0 0 1 .7.006l2 2a.5.5 0 1 1-.707.708L3.5 3.707V12.5zm3.5-9a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zM7.5 6a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1h-5zm0 3a.5.5 0 0 0 0 1h3a.5.5 0 0 0 0-1h-3zm0 3a.5.5 0 0 0 0 1h1a.5.5 0 0 0 0-1h-1z"/>\n            </svg>\n        </span>\n    '),
                            (e.title =
                              'Show chat comments from users who have donated (Oldest)')))
                        : (bn(t, f, l),
                          !n.skipButtonUIUpdate &&
                            (e.innerHTML =
                              'Donated \n        <span class="ycs-icons">\n            <svg width="16px" height="16px" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor" class="bi bi-sort-down">\n                <path d="M3.5 2.5a.5.5 0 0 0-1 0v8.793l-1.146-1.147a.5.5 0 0 0-.708.708l2 1.999.007.007a.497.497 0 0 0 .7-.006l2-2a.5.5 0 0 0-.707-.708L3.5 11.293V2.5zm3.5 1a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zM7.5 6a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1h-5zm0 3a.5.5 0 0 0 0 1h3a.5.5 0 0 0 0-1h-3zm0 3a.5.5 0 0 0 0 1h1a.5.5 0 0 0 0-1h-1z"/>\n            </svg>\n        </span>\n    '));
                    }
                  } else if (null == n ? void 0 : n.members) {
                    const e = (function (e) {
                      if (0 === e.length) return [];
                      try {
                        const n = [];
                        for (const o of e) {
                          const e = qt(
                            () =>
                              o.replayChatItemAction.actions[0]
                                .addChatItemAction.item
                                .liveChatTextMessageRenderer.authorBadges
                          );
                          let r;
                          var t;
                          if ((null == e ? void 0 : e.length) > 0)
                            for (const n of e)
                              if (
                                null == n ||
                                null === (t = n.liveChatAuthorBadgeRenderer) ||
                                void 0 === t
                                  ? void 0
                                  : t.customThumbnail
                              ) {
                                r = n;
                                break;
                              }
                          r &&
                            n.push({
                              item: o,
                              refIndex: qt(
                                () =>
                                  Number(
                                    o.replayChatItemAction.actions[0]
                                      .addChatItemAction.item
                                      .liveChatTextMessageRenderer.timestampUsec
                                  ) ?? 0
                              ),
                            });
                        }
                        return n;
                      } catch (e) {
                        return [];
                      }
                    })(textSearchResults);
                    if (((f = e), (null == f ? void 0 : f.length) > 0)) {
                      null == f || f.sort((a, b) => b.refIndex - a.refIndex);
                      const e = document.getElementById('ycs_btn_members'),
                        order = getLockedFilterSortOrder(e.dataset[n.sortKey]);
                      'newest' === order
                        ? (bn(t, f, l),
                          !n.skipButtonUIUpdate &&
                            ((e.dataset[n.sortKey] = 'oldest'),
                            (e.innerHTML =
                              'Members \n        <span class="ycs-icons">\n            <svg width="16px" height="16px" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor" class="bi bi-sort-down">\n                <path d="M3.5 2.5a.5.5 0 0 0-1 0v8.793l-1.146-1.147a.5.5 0 0 0-.708.708l2 1.999.007.007a.497.497 0 0 0 .7-.006l2-2a.5.5 0 0 0-.707-.708L3.5 11.293V2.5zm3.5 1a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zM7.5 6a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1h-5zm0 3a.5.5 0 0 0 0 1h3a.5.5 0 0 0 0-1h-3zm0 3a.5.5 0 0 0 0 1h1a.5.5 0 0 0 0-1h-1z"/>\n            </svg>\n        </span>\n    '),
                            (e.title =
                              'Show comments, replies, chat from channel members (Newest)')))
                        : 'oldest' === order
                        ? (bn(t, null == f ? void 0 : f.reverse(), l),
                          !n.skipButtonUIUpdate &&
                            ((e.dataset[n.sortKey] = 'newest'),
                            (e.innerHTML =
                              'Members \n        <span class="ycs-icons">\n            <svg width="16px" height="16px" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor" class="bi bi-sort-up">\n                <path d="M3.5 12.5a.5.5 0 0 1-1 0V3.707L1.354 4.854a.5.5 0 1 1-.708-.708l2-1.999.007-.007a.498.498 0 0 1 .7.006l2 2a.5.5 0 1 1-.707.708L3.5 3.707V12.5zm3.5-9a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zM7.5 6a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1h-5zm0 3a.5.5 0 0 0 0 1h3a.5.5 0 0 0 0-1h-3zm0 3a.5.5 0 0 0 0 1h1a.5.5 0 0 0 0-1h-1z"/>\n            </svg>\n        </span>\n    '),
                            (e.title =
                              'Show comments, replies, chat from channel members (Oldest)')))
                        : bn(t, f, l);
                    }
                  } else if (null == n ? void 0 : n.timestamp) {
                    p.keys = [
                      'replayChatItemAction.actions.addChatItemAction.item.liveChatTextMessageRenderer.isTimeLine',
                    ];
                    if (
                      ((f = new (e(I))(textSearchResults, p).search(
                        'timeline'
                      )),
                      (null == f ? void 0 : f.length) > 0)
                    ) {
                      null == f || f.sort((a, b) => b.refIndex - a.refIndex);
                      const e = document.getElementById('ycs_btn_timestamps'),
                        order = getLockedFilterSortOrder(e.dataset[n.sortKey]);
                      'newest' === order
                        ? (bn(t, f, l),
                          !n.skipButtonUIUpdate &&
                            ((e.dataset[n.sortKey] = 'oldest'),
                            (e.innerHTML =
                              'Time stamps \n        <span class="ycs-icons">\n            <svg width="16px" height="16px" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor" class="bi bi-sort-down">\n                <path d="M3.5 2.5a.5.5 0 0 0-1 0v8.793l-1.146-1.147a.5.5 0 0 0-.708.708l2 1.999.007.007a.497.497 0 0 0 .7-.006l2-2a.5.5 0 0 0-.707-.708L3.5 11.293V2.5zm3.5 1a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zM7.5 6a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1h-5zm0 3a.5.5 0 0 0 0 1h3a.5.5 0 0 0 0-1h-3zm0 3a.5.5 0 0 0 0 1h1a.5.5 0 0 0 0-1h-1z"/>\n            </svg>\n        </span>\n    '),
                            (e.title =
                              'Show comments, replies, chat with time stamps (Newest)')))
                        : 'oldest' === order
                        ? (bn(t, null == f ? void 0 : f.reverse(), l),
                          !n.skipButtonUIUpdate &&
                            ((e.dataset[n.sortKey] = 'newest'),
                            (e.innerHTML =
                              'Time stamps \n        <span class="ycs-icons">\n            <svg width="16px" height="16px" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor" class="bi bi-sort-up">\n                <path d="M3.5 12.5a.5.5 0 0 1-1 0V3.707L1.354 4.854a.5.5 0 1 1-.708-.708l2-1.999.007-.007a.498.498 0 0 1 .7.006l2 2a.5.5 0 1 1-.707.708L3.5 3.707V12.5zm3.5-9a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zM7.5 6a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1h-5zm0 3a.5.5 0 0 0 0 1h3a.5.5 0 0 0 0-1h-3zm0 3a.5.5 0 0 0 0 1h1a.5.5 0 0 0 0-1h-1z"/>\n            </svg>\n        </span>\n    '),
                            (e.title =
                              'Show comments, replies, chat with time stamps (Oldest)')))
                        : bn(t, f, l);
                    }
                  } else if (null == n ? void 0 : n.sortFirst) {
                    const e = (function (e) {
                      try {
                        if (0 === e.size) return;
                        const t = [];
                        for (const [n, o] of e.entries())
                          try {
                            t.push({
                              item: o,
                              refIndex: n,
                            });
                          } catch (e) {
                            continue;
                          }
                        if ((null == t ? void 0 : t.length) > 0) return t;
                      } catch (e) {}
                    })(rebuildChatData(textSearchResults));
                    if (((f = e), (null == f ? void 0 : f.length) > 0)) {
                      null == f || f.sort((a, b) => b.refIndex - a.refIndex);
                      const e = document.getElementById('ycs_btn_sort_first'),
                        order = getLockedFilterSortOrder(e.dataset[n.sortKey]);
                      'newest' === order
                        ? (bn(t, f, l),
                          !n.skipButtonUIUpdate &&
                            ((e.dataset[n.sortKey] = 'oldest'),
                            (e.innerHTML =
                              'All \n        <span class="ycs-icons">\n            <svg width="16px" height="16px" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor" class="bi bi-sort-down">\n                <path d="M3.5 2.5a.5.5 0 0 0-1 0v8.793l-1.146-1.147a.5.5 0 0 0-.708.708l2 1.999.007.007a.497.497 0 0 0 .7-.006l2-2a.5.5 0 0 0-.707-.708L3.5 11.293V2.5zm3.5 1a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zM7.5 6a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1h-5zm0 3a.5.5 0 0 0 0 1h3a.5.5 0 0 0 0-1h-3zm0 3a.5.5 0 0 0 0 1h1a.5.5 0 0 0 0-1h-1z"/>\n            </svg>\n        </span>\n    '),
                            (e.title =
                              'Show all comments, chat, video transcript sorted by date (Newest)')))
                        : 'oldest' === order
                        ? (bn(t, null == f ? void 0 : f.reverse(), l),
                          !n.skipButtonUIUpdate &&
                            ((e.dataset[n.sortKey] = 'newest'),
                            (e.innerHTML =
                              'All \n        <span class="ycs-icons">\n            <svg width="16px" height="16px" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor" class="bi bi-sort-up">\n                <path d="M3.5 12.5a.5.5 0 0 1-1 0V3.707L1.354 4.854a.5.5 0 1 1-.708-.708l2-1.999.007-.007a.498.498 0 0 1 .7.006l2 2a.5.5 0 1 1-.707.708L3.5 3.707V12.5zm3.5-9a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zM7.5 6a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1h-5zm0 3a.5.5 0 0 0 0 1h3a.5.5 0 0 0 0-1h-3zm0 3a.5.5 0 0 0 0 1h1a.5.5 0 0 0 0-1h-1z"/>\n            </svg>\n        </span>\n    '),
                            (e.title =
                              'Show all comments, chat, video transcript sorted by date (Oldest)')))
                        : bn(t, f, l);
                    }
                  } else if (null == n ? void 0 : n.verified) {
                    const e = (function (e) {
                      if (0 === e.length) return [];
                      try {
                        const t = [];
                        for (const [n, o] of e.entries())
                          qt(
                            () =>
                              o.replayChatItemAction.actions[0]
                                .addChatItemAction.item
                                .liveChatTextMessageRenderer.verifiedAuthor
                          ) &&
                            t.push({
                              item: o,
                              refIndex: n,
                            });
                        return t;
                      } catch (e) {
                        return [];
                      }
                    })(rebuildChatData(textSearchResults));
                    if (((f = e), (null == f ? void 0 : f.length) > 0)) {
                      null == f || f.sort((a, b) => b.refIndex - a.refIndex);
                      const e = document.getElementById('ycs_btn_verified'),
                        order = getLockedFilterSortOrder(e.dataset[n.sortKey]);
                      'newest' === order
                        ? (bn(t, f, l),
                          !n.skipButtonUIUpdate &&
                            ((e.dataset[n.sortKey] = 'oldest'),
                            (e.innerHTML =
                              '<span class="ycs-creator-verified_icon">✔</span> \n        <span class="ycs-icons">\n            <svg width="16px" height="16px" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor" class="bi bi-sort-down">\n                <path d="M3.5 2.5a.5.5 0 0 0-1 0v8.793l-1.146-1.147a.5.5 0 0 0-.708.708l2 1.999.007.007a.497.497 0 0 0 .7-.006l2-2a.5.5 0 0 0-.707-.708L3.5 11.293V2.5zm3.5 1a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zM7.5 6a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1h-5zm0 3a.5.5 0 0 0 0 1h3a.5.5 0 0 0 0-1h-3zm0 3a.5.5 0 0 0 0 1h1a.5.5 0 0 0 0-1h-1z"/>\n            </svg>\n        </span>\n    '),
                            (e.title =
                              'Show comments,  replies and chat from a verified authors (Newest)')))
                        : 'oldest' === order
                        ? (bn(t, null == f ? void 0 : f.reverse(), l),
                          !n.skipButtonUIUpdate &&
                            ((e.dataset[n.sortKey] = 'newest'),
                            (e.innerHTML =
                              '<span class="ycs-creator-verified_icon">✔</span> \n        <span class="ycs-icons">\n            <svg width="16px" height="16px" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor" class="bi bi-sort-up">\n                <path d="M3.5 12.5a.5.5 0 0 1-1 0V3.707L1.354 4.854a.5.5 0 1 1-.708-.708l2-1.999.007-.007a.498.498 0 0 1 .7.006l2 2a.5.5 0 1 1-.707.708L3.5 3.707V12.5zm3.5-9a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zM7.5 6a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1h-5zm0 3a.5.5 0 0 0 0 1h3a.5.5 0 0 0 0-1h-3zm0 3a.5.5 0 0 0 0 1h1a.5.5 0 0 0 0-1h-1z"/>\n            </svg>\n        </span>\n    '),
                            (e.title =
                              'Show comments,  replies and chat from a verified authors (Oldest)')))
                        : bn(t, f, l);
                    }
                  } else if (null == n ? void 0 : n.links) {
                    const n = (function (t) {
                      if (0 === t.length) return [];
                      try {
                        const n = [];
                        for (const [o, r] of t.entries())
                          qt(() =>
                            e(mt)().test(
                              r.replayChatItemAction.actions[0]
                                .addChatItemAction.item
                                .liveChatTextMessageRenderer.message.fullText
                            )
                          ) &&
                            n.push({
                              item: r,
                              refIndex: o,
                            });
                        return n;
                      } catch (e) {
                        return [];
                      }
                    })(rebuildChatData(textSearchResults));
                    if (((f = n), (null == f ? void 0 : f.length) > 0)) {
                      null == f || f.sort((a, b) => b.refIndex - a.refIndex);
                      const e = document.getElementById('ycs_btn_links'),
                        order = getLockedFilterSortOrder(e.dataset[n.sortKey]);
                      'newest' === order
                        ? (bn(t, f, l),
                          !n.skipButtonUIUpdate &&
                            ((e.dataset[n.sortKey] = 'oldest'),
                            (e.innerHTML =
                              'Links \n        <span class="ycs-icons">\n            <svg width="16px" height="16px" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor" class="bi bi-sort-down">\n                <path d="M3.5 2.5a.5.5 0 0 0-1 0v8.793l-1.146-1.147a.5.5 0 0 0-.708.708l2 1.999.007.007a.497.497 0 0 0 .7-.006l2-2a.5.5 0 0 0-.707-.708L3.5 11.293V2.5zm3.5 1a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zM7.5 6a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1h-5zm0 3a.5.5 0 0 0 0 1h3a.5.5 0 0 0 0-1h-3zm0 3a.5.5 0 0 0 0 1h1a.5.5 0 0 0 0-1h-1z"/>\n            </svg>\n        </span>\n    '),
                            (e.title =
                              'Shows links in comments, replies, chat, video transcript (Newest)')))
                        : 'oldest' === order
                        ? (bn(t, null == f ? void 0 : f.reverse(), l),
                          !n.skipButtonUIUpdate &&
                            ((e.dataset[n.sortKey] = 'newest'),
                            (e.innerHTML =
                              'Links \n        <span class="ycs-icons">\n            <svg width="16px" height="16px" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor" class="bi bi-sort-up">\n                <path d="M3.5 12.5a.5.5 0 0 1-1 0V3.707L1.354 4.854a.5.5 0 1 1-.708-.708l2-1.999.007-.007a.498.498 0 0 1 .7.006l2 2a.5.5 0 1 1-.707.708L3.5 3.707V12.5zm3.5-9a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zM7.5 6a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1h-5zm0 3a.5.5 0 0 0 0 1h3a.5.5 0 0 0 0-1h-3zm0 3a.5.5 0 0 0 0 1h1a.5.5 0 0 0 0-1h-1z"/>\n            </svg>\n        </span>\n    '),
                            (e.title =
                              'Shows links in comments, replies, chat, video transcript (Oldest)')))
                        : bn(t, f, l);
                    }
                  } else {
                    (f = textSearchFuseResults ?? []), bn(t, f, l);
                  }
                  const v = document.getElementById('ycs-search-total-result');
                  v && (v.innerText = `(Chat replay) Found: ${f.length}`),
                    (countsReport.commentsChat = f.length);
                  const y = document.getElementById('ycs_wrap_comments_chat');
                  null == y ||
                    y.addEventListener('click', (e) => {
                      try {
                        var t, n;
                        if (
                          null === (t = e.target) ||
                          void 0 === t ||
                          null === (n = t.classList) ||
                          void 0 === n
                            ? void 0
                            : n.contains('ycs-gotochat-video')
                        ) {
                          const t = document.getElementsByTagName('video')[0];
                          if ((e.preventDefault(), t)) {
                            const n = e.target.dataset.offsetvideo;
                            n && (t.currentTime = parseInt(n) / 1e3);
                          }
                        }
                      } catch (e) {
                        return;
                      }
                    });
                }
              } catch (e) {}
            };
            const handleTranscriptSearch = (t, _n) => {
              const n = _n
                ? {
                    ..._n,
                    sortKey: _n.sortKey ?? 'sortTrp',
                  }
                : undefined;

              try {
                if (
                  transcriptDataBuf &&
                  transcriptDataBuf.actions[0].updateEngagementPanelAction
                    .content.transcriptRenderer.body.transcriptBodyRenderer
                    .cueGroups.length > 0
                ) {
                  const o = document.querySelector(t),
                    a = document.getElementById('ycs-input-search'),
                    cueGroupsBuf =
                      transcriptDataBuf.actions[0].updateEngagementPanelAction
                        .content.transcriptRenderer.body.transcriptBodyRenderer
                        .cueGroups;
                  let l = '';
                  a && (l = a.value), o && (o.textContent = '');
                  const d = document.getElementById(
                      'ycs_extended_search_title'
                    ),
                    u = document.getElementById('ycs_extended_search_main');
                  let h = fuseOptionsBase,
                    m = [
                      'transcriptCueGroupRenderer.cues.transcriptCueRenderer.cue.simpleText',
                      'transcriptCueGroupRenderer.formattedStartOffset.simpleText',
                    ];
                  L.checked &&
                    ((h = JSON.parse(JSON.stringify(fuseOptionsBase))),
                    (h.useExtendedSearch = !0),
                    d.checked &&
                      (m = [
                        'transcriptCueGroupRenderer.formattedStartOffset.simpleText',
                      ]),
                    u.checked &&
                      (m = [
                        'transcriptCueGroupRenderer.cues.transcriptCueRenderer.cue.simpleText',
                      ]));
                  const p = {
                    ...h,
                    keys: m,
                  };
                  const searchText = l.trim();
                  const textSearchFuseResults = searchText
                    ? new (e(I))(cueGroupsBuf, p).search(searchText)
                    : null;
                  const textSearchResults =
                    textSearchFuseResults !== null
                      ? textSearchFuseResults.map(({ item }) => item)
                      : cueGroupsBuf;
                  let f = [];
                  if (n)
                    if (null == n ? void 0 : n.links) {
                      const n = (function (t) {
                        if (0 === t.length) return [];
                        try {
                          const n = [];
                          for (const o of t)
                            try {
                              e(mt)().test(
                                o.transcriptCueGroupRenderer.cues[0]
                                  .transcriptCueRenderer.cue.simpleText
                              ) &&
                                n.push({
                                  item: o,
                                  refIndex:
                                    o.transcriptCueGroupRenderer.cues[0]
                                      .transcriptCueRenderer.startOffsetMs,
                                });
                            } catch (e) {
                              continue;
                            }
                          return n;
                        } catch (e) {
                          return [];
                        }
                      })(textSearchResults);
                      if (((f = n), (null == f ? void 0 : f.length) > 0)) {
                        null == f || f.sort((a, b) => b.refIndex - a.refIndex);
                        const e = document.getElementById('ycs_btn_links'),
                          order = getLockedFilterSortOrder(
                            e.dataset[n.sortKey]
                          );
                        'newest' === order
                          ? (xn(t, f, l),
                            !n.skipButtonUIUpdate &&
                              ((e.dataset[n.sortKey] = 'oldest'),
                              (e.innerHTML =
                                'Links \n        <span class="ycs-icons">\n            <svg width="16px" height="16px" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor" class="bi bi-sort-down">\n                <path d="M3.5 2.5a.5.5 0 0 0-1 0v8.793l-1.146-1.147a.5.5 0 0 0-.708.708l2 1.999.007.007a.497.497 0 0 0 .7-.006l2-2a.5.5 0 0 0-.707-.708L3.5 11.293V2.5zm3.5 1a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zM7.5 6a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1h-5zm0 3a.5.5 0 0 0 0 1h3a.5.5 0 0 0 0-1h-3zm0 3a.5.5 0 0 0 0 1h1a.5.5 0 0 0 0-1h-1z"/>\n            </svg>\n        </span>\n    '),
                              (e.title =
                                'Shows links in comments, replies, chat, video transcript (Newest)')))
                          : 'oldest' === order
                          ? (xn(t, null == f ? void 0 : f.reverse(), l),
                            !n.skipButtonUIUpdate &&
                              ((e.dataset[n.sortKey] = 'newest'),
                              (e.innerHTML =
                                'Links \n        <span class="ycs-icons">\n            <svg width="16px" height="16px" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor" class="bi bi-sort-up">\n                <path d="M3.5 12.5a.5.5 0 0 1-1 0V3.707L1.354 4.854a.5.5 0 1 1-.708-.708l2-1.999.007-.007a.498.498 0 0 1 .7.006l2 2a.5.5 0 1 1-.707.708L3.5 3.707V12.5zm3.5-9a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zM7.5 6a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1h-5zm0 3a.5.5 0 0 0 0 1h3a.5.5 0 0 0 0-1h-3zm0 3a.5.5 0 0 0 0 1h1a.5.5 0 0 0 0-1h-1z"/>\n            </svg>\n        </span>\n    '),
                              (e.title =
                                'Shows links in comments, replies, chat, video transcript (Oldest)')))
                          : xn(t, f, l);
                      }
                    } else {
                      if (!(null == n ? void 0 : n.sortFirst)) return;
                      {
                        const e = (function (e) {
                          if (0 === e.length) return [];
                          try {
                            const t = [];
                            for (const n of e)
                              try {
                                t.push({
                                  item: n,
                                  refIndex:
                                    n.transcriptCueGroupRenderer.cues[0]
                                      .transcriptCueRenderer.startOffsetMs,
                                });
                              } catch (e) {
                                continue;
                              }
                            return t;
                          } catch (e) {
                            return [];
                          }
                        })(textSearchResults);
                        if (((f = e), (null == f ? void 0 : f.length) > 0)) {
                          null == f ||
                            f.sort((a, b) => b.refIndex - a.refIndex);
                          const e =
                              document.getElementById('ycs_btn_sort_first'),
                            order = getLockedFilterSortOrder(
                              e.dataset[n.sortKey]
                            );
                          'newest' === order
                            ? (xn(t, f, l),
                              !n.skipButtonUIUpdate &&
                                ((e.dataset[n.sortKey] = 'oldest'),
                                (e.innerHTML =
                                  'All \n        <span class="ycs-icons">\n            <svg width="16px" height="16px" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor" class="bi bi-sort-down">\n                <path d="M3.5 2.5a.5.5 0 0 0-1 0v8.793l-1.146-1.147a.5.5 0 0 0-.708.708l2 1.999.007.007a.497.497 0 0 0 .7-.006l2-2a.5.5 0 0 0-.707-.708L3.5 11.293V2.5zm3.5 1a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zM7.5 6a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1h-5zm0 3a.5.5 0 0 0 0 1h3a.5.5 0 0 0 0-1h-3zm0 3a.5.5 0 0 0 0 1h1a.5.5 0 0 0 0-1h-1z"/>\n            </svg>\n        </span>\n    '),
                                (e.title =
                                  'Show all comments, chat, video transcript sorted by date (Newest)')))
                            : 'oldest' === order
                            ? (xn(t, null == f ? void 0 : f.reverse(), l),
                              !n.skipButtonUIUpdate &&
                                ((e.dataset[n.sortKey] = 'newest'),
                                (e.innerHTML =
                                  'All \n        <span class="ycs-icons">\n            <svg width="16px" height="16px" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor" class="bi bi-sort-up">\n                <path d="M3.5 12.5a.5.5 0 0 1-1 0V3.707L1.354 4.854a.5.5 0 1 1-.708-.708l2-1.999.007-.007a.498.498 0 0 1 .7.006l2 2a.5.5 0 1 1-.707.708L3.5 3.707V12.5zm3.5-9a.5.5 0 0 1 .5-.5h7a.5.5 0 0 1 0 1h-7a.5.5 0 0 1-.5-.5zM7.5 6a.5.5 0 0 0 0 1h5a.5.5 0 0 0 0-1h-5zm0 3a.5.5 0 0 0 0 1h3a.5.5 0 0 0 0-1h-3zm0 3a.5.5 0 0 0 0 1h1a.5.5 0 0 0 0-1h-1z"/>\n            </svg>\n        </span>\n    '),
                                (e.title =
                                  'Show all comments, chat, video transcript sorted by date (Oldest)')))
                            : xn(t, f, l);
                        }
                      }
                    }
                  else {
                    (f = textSearchFuseResults ?? []), xn(t, f, l);
                  }
                  const v = document.getElementById('ycs-search-total-result');
                  v && (v.innerText = `(Tr. video) Found: ${f.length}`),
                    (countsReport.commentsTrVideo = f.length);
                  const y = document.getElementById(
                    'ycs_wrap_comments_trvideo'
                  );
                  null == y ||
                    y.addEventListener('click', (e) => {
                      try {
                        var t, n;
                        if (
                          null === (t = e.target) ||
                          void 0 === t ||
                          null === (n = t.classList) ||
                          void 0 === n
                            ? void 0
                            : n.contains('ycs-goto-video')
                        ) {
                          e.preventDefault();
                          const t = document.getElementsByTagName('video')[0];
                          if (t) {
                            const n = e.target.dataset.offsetvideo;
                            n && (t.currentTime = parseInt(n) / 1e3);
                          }
                        }
                      } catch (e) {
                        return;
                      }
                    });
                }
              } catch (e) {}
            };
            const handleAllSearch = (targetSelector, searchOptions) => {
              const n = document.querySelector(targetSelector);
              const o = document.getElementById('ycs-search-total-result');

              if (o) {
                o.classList.add('ycs-hidden');
              }

              if (n) {
                n.textContent = '';
              }

              const c = document.createElement('div');
              c.id = 'ycs_allsearch__wrap_comments';

              const l = document.createElement('div');
              l.id = 'ycs_allsearch__wrap_comments_chat';

              const d = document.createElement('div');
              d.id = 'ycs_allsearch__wrap_comments_trvideo';

              try {
                // only one of the search functions should update the UI when searching with type "all"
                let skipButtonUIUpdate = false;

                if (commentsDataBuf.length > 0) {
                  if (n) {
                    n.appendChild(c);
                  }
                  handleCommentsSearch(
                    '#ycs_allsearch__wrap_comments',
                    searchOptions
                      ? {
                          ...searchOptions,
                          skipButtonUIUpdate,
                          sortKey: 'sortAll',
                        }
                      : undefined
                  );
                  skipButtonUIUpdate = true;
                }

                if (chatDataBuf && chatDataBuf.size > 0) {
                  if (n) {
                    n.appendChild(l);
                  }
                  handleChatSearch(
                    '#ycs_allsearch__wrap_comments_chat',
                    searchOptions
                      ? {
                          ...searchOptions,
                          skipButtonUIUpdate,
                          sortKey: 'sortAll',
                        }
                      : undefined
                  );
                  skipButtonUIUpdate = true;
                }

                if (
                  transcriptDataBuf &&
                  qt(
                    () =>
                      transcriptDataBuf.actions[0].updateEngagementPanelAction
                        .content.transcriptRenderer.body.transcriptBodyRenderer
                        .cueGroups.length
                  ) > 0
                ) {
                  if (n) {
                    n.appendChild(d);
                  }
                  handleTranscriptSearch(
                    '#ycs_allsearch__wrap_comments_trvideo',
                    searchOptions
                      ? {
                          ...searchOptions,
                          skipButtonUIUpdate,
                          sortKey: 'sortAll',
                        }
                      : undefined
                  );
                  skipButtonUIUpdate = true;
                }

                if (o) {
                  const e =
                    countsReport.comments +
                    countsReport.commentsChat +
                    countsReport.commentsTrVideo;

                  if (searchOptions && searchOptions.timestamp) {
                    o.innerText = `Time stamps, found: ${e}`;
                  } else if (searchOptions && searchOptions.author) {
                    o.innerText = `Author, found: ${e}`;
                  } else if (searchOptions && searchOptions.heart) {
                    o.innerText = `Heart, found: ${e}`;
                  } else if (searchOptions && searchOptions.verified) {
                    o.innerText = `Verified authors, found: ${e}`;
                  } else if (searchOptions && searchOptions.links) {
                    o.innerText = `Links, found: ${e}`;
                  } else if (searchOptions && searchOptions.likes) {
                    o.innerText = `Likes, found: ${e}`;
                  } else if (searchOptions && searchOptions.replied) {
                    o.innerText = `Replied, found: ${e}`;
                  } else if (searchOptions && searchOptions.members) {
                    o.innerText = `Members, found: ${e}`;
                  } else if (searchOptions && searchOptions.donated) {
                    o.innerText = `Donated, found: ${e}`;
                  } else if (searchOptions && searchOptions.random) {
                    o.innerText = `Random, found: ${e}`;
                  } else if (searchOptions && searchOptions.sortFirst) {
                    o.innerText = `All comments, found: ${e}`;
                  } else {
                    o.innerText = `(All) Found: ${e}`;
                  }

                  o.classList.remove('ycs-hidden');
                }
              } catch (e) {}
            };

            function dispatchSearch(
              searchOptions,
              { typeSelector = '#ycs_search_select', type: optType } = {}
            ) {
              let type = optType;
              if (typeSelector) {
                const eSearchSelect =
                  document.getElementById('ycs_search_select');
                type = eSearchSelect?.value;
              }

              const eSearchInput = document.getElementById('ycs-input-search');
              const value = eSearchInput.value.trim();
              toggleVisibility('#ycs_btn_clear_search', !!value);

              switch (type) {
                case 'comments':
                  handleCommentsSearch('#ycs-search-result', searchOptions);
                  break;
                case 'chat':
                  handleChatSearch('#ycs-search-result', searchOptions);
                  break;
                case 'video':
                  handleTranscriptSearch('#ycs-search-result', searchOptions);
                  break;
                case 'all':
                  handleAllSearch('#ycs-search-result', searchOptions);
                  break;
                default:
                  handleAllSearch('#ycs-search-result', searchOptions);
                  break;
              }
            }

            eClearSearchBtn &&
              eClearSearchBtn.addEventListener('click', () => {
                if (w) {
                  const eSearchInput =
                    document.getElementById('ycs-input-search');
                  eSearchInput.value = '';
                  w.click();
                }
              });

            w &&
              w.addEventListener('click', () => {
                // removeClassName() function cleans up the active states of buttons
                // removeClassName(btnPool, 'ycs_btn_active');

                // lock filter button sort state for 1 sec
                lockFilterSort(100);

                const searchOptions = getSearchOptions(btnPool);
                dispatchSearch(searchOptions);
              }),
              window.postMessage(
                {
                  type: 'GET_OPTIONS',
                },
                window.location.origin
              ),
              (n = (e) => {
                var t, n, r, c;
                if (e.origin === window.location.origin) {
                  if (
                    'YCS_OPTIONS' ===
                      (null === (t = e.data) || void 0 === t
                        ? void 0
                        : t.type) &&
                    (null === (n = e.data) || void 0 === n ? void 0 : n.text)
                  ) {
                    const t = (e) => {
                        !0 === e && (null == y || y.click());
                      },
                      n = (e, n) => {
                        n.cache || t(e);
                      },
                      o = (e) => {
                        try {
                          ycsOptions.highlightText = e;
                        } catch (e) {}
                      },
                      handleHighlightExact = (value) => {
                        try {
                          ycsOptions.highlightExact = value;
                        } catch (e) {}
                      },
                      r = (e) => {
                        try {
                          if (!e) return;
                          !(function (e) {
                            try {
                              window.postMessage(
                                {
                                  type: 'YCS_CACHE_STORAGE_GET',
                                  body: {
                                    videoId: getVideoId(Xt(e)),
                                  },
                                },
                                window.location.origin
                              );
                            } catch (e) {}
                          })(window.location.href);
                        } catch (e) {}
                      };
                    try {
                      const t = e.data.text;
                      for (const e of Object.keys(t))
                        switch (e) {
                          case 'autoload':
                            n(t[e], t);
                            break;
                          case 'highlightText':
                            o(t[e]);
                            break;
                          case 'highlightExact':
                            handleHighlightExact(t[e]);
                            break;
                          case 'cache':
                            r(t[e]);
                        }
                    } catch (e) {}
                  }
                  var l;
                  if (
                    'YCS_CACHE_STORAGE_GET_RESPONSE' ===
                    (null === (r = e.data) || void 0 === r ? void 0 : r.type)
                  )
                    if (
                      null === (l = e.data) || void 0 === l ? void 0 : l.body
                    ) {
                      try {
                        if (e.data.body.comments.length > 0) {
                          const originCommentById = e.data.body.comments.reduce(
                            (acc, c) => {
                              if (c.typeComment === 'C') {
                                acc[c.commentRenderer.commentId] = c;
                              }
                              return acc;
                            },
                            {}
                          );
                          for (const t of e.data.body.comments)
                            if ('R' === t.typeComment) {
                              const originComment =
                                originCommentById[
                                  t.originComment.commentRenderer.commentId
                                ];
                              if (originComment) {
                                t.originComment = originComment;
                              }
                            }
                          commentsDataBuf = e.data.body.comments;
                        }
                      } catch (e) {}
                      transcriptDataBuf = e.data.body.commentsTrVideo;
                      const t = e.data.body.date,
                        n = document.getElementById('ycs_status_cmnt');
                      commentsDataBuf.length > 0 &&
                        n &&
                        (n.innerHTML =
                          '\n        <span class="ycs-icons">\n            <svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px"\n            width="48" height="48"\n            viewBox="0 0 48 48"\n            style=" fill:#000000;"><linearGradient id="I9GV0SozQFknxHSR6DCx5a_70yRC8npwT3d_gr1" x1="9.858" x2="38.142" y1="9.858" y2="38.142" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#21ad64"></stop><stop offset="1" stop-color="#088242"></stop></linearGradient><path fill="url(#I9GV0SozQFknxHSR6DCx5a_70yRC8npwT3d_gr1)" d="M44,24c0,11.045-8.955,20-20,20S4,35.045,4,24S12.955,4,24,4S44,12.955,44,24z"></path><path d="M32.172,16.172L22,26.344l-5.172-5.172c-0.781-0.781-2.047-0.781-2.828,0l-1.414,1.414\tc-0.781,0.781-0.781,2.047,0,2.828l8,8c0.781,0.781,2.047,0.781,2.828,0l13-13c0.781-0.781,0.781-2.047,0-2.828L35,16.172\tC34.219,15.391,32.953,15.391,32.172,16.172z" opacity=".05"></path><path d="M20.939,33.061l-8-8c-0.586-0.586-0.586-1.536,0-2.121l1.414-1.414c0.586-0.586,1.536-0.586,2.121,0\tL22,27.051l10.525-10.525c0.586-0.586,1.536-0.586,2.121,0l1.414,1.414c0.586,0.586,0.586,1.536,0,2.121l-13,13\tC22.475,33.646,21.525,33.646,20.939,33.061z" opacity=".07"></path><path fill="#fff" d="M21.293,32.707l-8-8c-0.391-0.391-0.391-1.024,0-1.414l1.414-1.414c0.391-0.391,1.024-0.391,1.414,0\tL22,27.758l10.879-10.879c0.391-0.391,1.024-0.391,1.414,0l1.414,1.414c0.391,0.391,0.391,1.024,0,1.414l-13,13\tC22.317,33.098,21.683,33.098,21.293,32.707z"></path></svg>\n        </span>\n    '),
                        commentsDataBuf.length > 0 &&
                          (h.parentNode || h.parentElement) &&
                          (countsAct.comments = commentsDataBuf.length);
                      chatDataBuf = new Map(
                        JSON.parse(e.data.body.commentsChat)
                      );
                      const r = document.getElementById('ycs_cmnts');
                      if (
                        (r && (r.textContent = `${commentsDataBuf.length}`),
                        chatDataBuf && chatDataBuf.size > 0)
                      ) {
                        const e = document.getElementById('ycs_cmnts_chat'),
                          t = document.getElementById('ycs_status_chat');
                        (e.textContent = chatDataBuf.size.toString()),
                          (t.innerHTML =
                            '\n        <span class="ycs-icons">\n            <svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px"\n            width="48" height="48"\n            viewBox="0 0 48 48"\n            style=" fill:#000000;"><linearGradient id="I9GV0SozQFknxHSR6DCx5a_70yRC8npwT3d_gr1" x1="9.858" x2="38.142" y1="9.858" y2="38.142" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#21ad64"></stop><stop offset="1" stop-color="#088242"></stop></linearGradient><path fill="url(#I9GV0SozQFknxHSR6DCx5a_70yRC8npwT3d_gr1)" d="M44,24c0,11.045-8.955,20-20,20S4,35.045,4,24S12.955,4,24,4S44,12.955,44,24z"></path><path d="M32.172,16.172L22,26.344l-5.172-5.172c-0.781-0.781-2.047-0.781-2.828,0l-1.414,1.414\tc-0.781,0.781-0.781,2.047,0,2.828l8,8c0.781,0.781,2.047,0.781,2.828,0l13-13c0.781-0.781,0.781-2.047,0-2.828L35,16.172\tC34.219,15.391,32.953,15.391,32.172,16.172z" opacity=".05"></path><path d="M20.939,33.061l-8-8c-0.586-0.586-0.586-1.536,0-2.121l1.414-1.414c0.586-0.586,1.536-0.586,2.121,0\tL22,27.051l10.525-10.525c0.586-0.586,1.536-0.586,2.121,0l1.414,1.414c0.586,0.586,0.586,1.536,0,2.121l-13,13\tC22.475,33.646,21.525,33.646,20.939,33.061z" opacity=".07"></path><path fill="#fff" d="M21.293,32.707l-8-8c-0.391-0.391-0.391-1.024,0-1.414l1.414-1.414c0.391-0.391,1.024-0.391,1.414,0\tL22,27.758l10.879-10.879c0.391-0.391,1.024-0.391,1.414,0l1.414,1.414c0.391,0.391,0.391,1.024,0,1.414l-13,13\tC22.317,33.098,21.683,33.098,21.293,32.707z"></path></svg>\n        </span>\n    ');
                      }
                      if (
                        (chatDataBuf &&
                          chatDataBuf.size > 0 &&
                          (h.parentNode || h.parentElement) &&
                          (countsAct.commentsChat = chatDataBuf.size),
                        qt(() => {
                          var e, t, n, o, r, a, s, c;
                          return (
                            (null ===
                              (t =
                                null === (e = transcriptDataBuf) || void 0 === e
                                  ? void 0
                                  : e.actions[0]) ||
                            void 0 === t ||
                            null === (n = t.updateEngagementPanelAction) ||
                            void 0 === n ||
                            null === (o = n.content) ||
                            void 0 === o ||
                            null === (r = o.transcriptRenderer) ||
                            void 0 === r ||
                            null === (a = r.body) ||
                            void 0 === a ||
                            null === (s = a.transcriptBodyRenderer) ||
                            void 0 === s ||
                            null === (c = s.cueGroups) ||
                            void 0 === c
                              ? void 0
                              : c.length) > 0
                          );
                        }))
                      ) {
                        const e = document.getElementById('ycs_status_trvideo'),
                          t = document.getElementById('ycs_cmnts_video');
                        Kt(
                          transcriptDataBuf.actions[0]
                            .updateEngagementPanelAction.content
                            .transcriptRenderer.body.transcriptBodyRenderer
                            .cueGroups.length,
                          t
                        ),
                          (e.innerHTML =
                            '\n        <span class="ycs-icons">\n            <svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px"\n            width="48" height="48"\n            viewBox="0 0 48 48"\n            style=" fill:#000000;"><linearGradient id="I9GV0SozQFknxHSR6DCx5a_70yRC8npwT3d_gr1" x1="9.858" x2="38.142" y1="9.858" y2="38.142" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#21ad64"></stop><stop offset="1" stop-color="#088242"></stop></linearGradient><path fill="url(#I9GV0SozQFknxHSR6DCx5a_70yRC8npwT3d_gr1)" d="M44,24c0,11.045-8.955,20-20,20S4,35.045,4,24S12.955,4,24,4S44,12.955,44,24z"></path><path d="M32.172,16.172L22,26.344l-5.172-5.172c-0.781-0.781-2.047-0.781-2.828,0l-1.414,1.414\tc-0.781,0.781-0.781,2.047,0,2.828l8,8c0.781,0.781,2.047,0.781,2.828,0l13-13c0.781-0.781,0.781-2.047,0-2.828L35,16.172\tC34.219,15.391,32.953,15.391,32.172,16.172z" opacity=".05"></path><path d="M20.939,33.061l-8-8c-0.586-0.586-0.586-1.536,0-2.121l1.414-1.414c0.586-0.586,1.536-0.586,2.121,0\tL22,27.051l10.525-10.525c0.586-0.586,1.536-0.586,2.121,0l1.414,1.414c0.586,0.586,0.586,1.536,0,2.121l-13,13\tC22.475,33.646,21.525,33.646,20.939,33.061z" opacity=".07"></path><path fill="#fff" d="M21.293,32.707l-8-8c-0.391-0.391-0.391-1.024,0-1.414l1.414-1.414c0.391-0.391,1.024-0.391,1.414,0\tL22,27.758l10.879-10.879c0.391-0.391,1.024-0.391,1.414,0l1.414,1.414c0.391,0.391,0.391,1.024,0,1.414l-13,13\tC22.317,33.098,21.683,33.098,21.293,32.707z"></path></svg>\n        </span>\n    ');
                      }
                      qt(() => {
                        var e, t, n, o, r, a, s, c;
                        return (
                          (null ===
                            (t =
                              null === (e = transcriptDataBuf) || void 0 === e
                                ? void 0
                                : e.actions[0]) ||
                          void 0 === t ||
                          null === (n = t.updateEngagementPanelAction) ||
                          void 0 === n ||
                          null === (o = n.content) ||
                          void 0 === o ||
                          null === (r = o.transcriptRenderer) ||
                          void 0 === r ||
                          null === (a = r.body) ||
                          void 0 === a ||
                          null === (s = a.transcriptBodyRenderer) ||
                          void 0 === s ||
                          null === (c = s.cueGroups) ||
                          void 0 === c
                            ? void 0
                            : c.length) > 0
                        );
                      }) &&
                        (h.parentNode || h.parentElement) &&
                        (countsAct.commentsTrVideo =
                          transcriptDataBuf.actions[0].updateEngagementPanelAction.content.transcriptRenderer.body.transcriptBodyRenderer.cueGroups.length);
                      const c =
                        countsAct.comments +
                        countsAct.commentsChat +
                        countsAct.commentsTrVideo;
                      postTextMessage('NUMBER_COMMENTS', c),
                        m && (m.textContent = `(${c})`);
                      document
                        .getElementById('ycs-count-load')
                        .insertAdjacentHTML(
                          'beforeend',
                          `\n                            <span class="ycs-title-cache-info" title="${new Date(
                            t
                          )}">Cached</span>\n                        `
                        );
                    } else
                      window.postMessage(
                        {
                          type: 'YCS_AUTOLOAD',
                        },
                        window.location.origin
                      );
                  'YCS_AUTOLOAD' ===
                    (null === (c = e.data) || void 0 === c ? void 0 : c.type) &&
                    (null == y || y.click());
                }
              }),
              window.addEventListener('message', n),
              (function () {
                try {
                  const e = (t) => {
                      try {
                        const n = document.getElementById('ycs_modal_window');
                        if (t.target == n) {
                          n.style.display = 'none';
                          const t =
                            document.getElementsByClassName('ycs-app')[0];
                          null == t || t.removeEventListener('click', e);
                        }
                      } catch (e) {}
                    },
                    t = () => {
                      try {
                        document.getElementById(
                          'ycs_modal_window'
                        ).style.display = 'block';
                        const t = document.getElementsByClassName('ycs-app')[0];
                        null == t || t.addEventListener('click', e);
                      } catch (e) {}
                    },
                    n = () => {
                      try {
                        document.getElementById(
                          'ycs_modal_window'
                        ).style.display = 'none';
                      } catch (e) {}
                    },
                    o = document.getElementById('ycs_btn_close_modal'),
                    r = document.getElementById('ycs_btn_open_modal');
                  null == o || o.addEventListener('click', n),
                    null == r || r.addEventListener('click', t);
                } catch (e) {}
              })(),
              (function () {
                try {
                  if (!vn().supported) return;
                  const e = () => {
                      try {
                        const e = async (e) => {
                          try {
                            e.altKey && 'Backquote' === e.code && (await t());
                          } catch (e) {}
                        };
                        document.addEventListener('keyup', e, !1);
                      } catch (e) {}
                    },
                    t = async () => {
                      try {
                        const o = (e) => {
                            const t = document.getElementById(e).offsetTop;
                            window.scrollTo(0, t);
                          },
                          r = document.getElementsByTagName('video')[0],
                          i = vn();
                        var e, t, n;
                        r &&
                          i.supported &&
                          (i.isActive(r)
                            ? (await i.exit(),
                              window.scrollTo(0, 0),
                              null ===
                                (e =
                                  document.getElementById(
                                    'ycs-input-search'
                                  )) ||
                                void 0 === e ||
                                e.blur(),
                              null ===
                                (t = document.getElementById('search')) ||
                                void 0 === t ||
                                t.focus())
                            : (await i.request(r),
                              null ===
                                (n =
                                  document.getElementById(
                                    'ycs-input-search'
                                  )) ||
                                void 0 === n ||
                                n.focus(),
                              o('ycs_anchor_vmode')));
                      } catch (e) {}
                    },
                    n = document.getElementById('ycs_view_mode');
                  null == n || n.addEventListener('click', t), e();
                } catch (e) {}
              })();
            const L = document.getElementById('ycs_extended_search');
            if (L) {
              const e = document.getElementById('ycs_extended_search_title'),
                t = document.getElementById('ycs_extended_search_main');
              null == L ||
                L.addEventListener('click', () => {
                  try {
                    L.checked
                      ? e && t && ((e.disabled = !1), (t.disabled = !1))
                      : e && t && ((e.disabled = !0), (t.disabled = !0));
                  } catch (e) {}
                });
            }
          }
          function r() {
            let e = Xt(window.location.href);
            setInterval(() => {
              Yt() &&
                document.querySelector('#meta.style-scope.ytd-watch-flexy') &&
                e !== Xt(window.location.href) &&
                ((e = Xt(window.location.href)), t.abort(), o());
            }, 1e3);
          }
          r();
          try {
            Yt() && o();
          } catch (e) {
            Yt() && o();
          }
        })());
    }, 1e3);
  })();
})();
