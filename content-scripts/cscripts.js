!(function () {
  const e = document.querySelectorAll(
    `script[src="chrome-extension://${chrome.runtime.id}/web-resources/wresources.js"]`
  );
  for (const t of e) t.remove();
})(),
  chrome.runtime.onMessage.addListener((e, t, o) => {
    try {
      'YCS_CACHE_STORAGE_GET_SEND' === (null == e ? void 0 : e.type) &&
        (null == e ? void 0 : e.body) &&
        window.postMessage(
          { type: 'YCS_CACHE_STORAGE_GET_RESPONSE', body: e.body },
          window.location.origin
        ),
        'YCS_AUTOLOAD' === (null == e ? void 0 : e.type) &&
          window.postMessage({ type: 'YCS_AUTOLOAD' }, window.location.origin);
    } catch (e) {}
  }),
  window.addEventListener(
    'message',
    async (e) => {
      try {
        var t, o, i, r, n;
        if (e.source != window) return;
        if (
          (e.data.type &&
            'NUMBER_COMMENTS' === e.data.type &&
            chrome.runtime.sendMessage(`${chrome.runtime.id}`, {
              type: 'YCS_SET_BADGE',
              text: e.data.text.toString() || '',
            }),
          'GET_OPTIONS' ===
            (null === (t = e.data) || void 0 === t ? void 0 : t.type))
        )
          try {
            const e = await chrome.storage.local.get();
            window.postMessage(
              { type: 'YCS_OPTIONS', text: e },
              window.location.origin
            );
          } catch (e) {}
        'YCS_CACHE_STORAGE_SET' ===
          (null === (o = e.data) || void 0 === o ? void 0 : o.type) &&
          (null === (i = e.data) || void 0 === i ? void 0 : i.body) &&
          chrome.runtime.sendMessage(`${chrome.runtime.id}`, e.data, (e) => {}),
          'YCS_CACHE_STORAGE_GET' ===
            (null === (r = e.data) || void 0 === r ? void 0 : r.type) &&
            (null === (n = e.data) || void 0 === n ? void 0 : n.body) &&
            chrome.runtime.sendMessage(
              `${chrome.runtime.id}`,
              e.data,
              (e) => {}
            );
      } catch (e) {}
    },
    false
  ),
  (function (e, t) {
    try {
      const o = document.querySelector(t),
        i = document.createElement('script');
      i.setAttribute('type', 'text/javascript'),
        i.setAttribute('src', e),
        null == o || o.appendChild(i);
    } catch (e) {
      throw e;
    }
  })(chrome.runtime.getURL('web-resources/wresources.js'), 'body');
