var e =
    'undefined' != typeof globalThis
      ? globalThis
      : 'undefined' != typeof self
      ? self
      : 'undefined' != typeof window
      ? window
      : 'undefined' != typeof global
      ? global
      : {},
  t = {},
  a = {},
  o = e.parcelRequireb06e;
null == o &&
  (((o = function (e) {
    if (e in t) return t[e].exports;
    if (e in a) {
      var o = a[e];
      delete a[e];
      var c = { id: e, exports: {} };
      return (t[e] = c), o.call(c.exports, c, c.exports), c.exports;
    }
    var n = new Error("Cannot find module '" + e + "'");
    throw ((n.code = 'MODULE_NOT_FOUND'), n);
  }).register = function (e, t) {
    a[e] = t;
  }),
  (e.parcelRequireb06e = o));
var n = o('epVyJ'),
  s = o('bRhBe');

const defaultOptions = {
  autoload: true,
  highlightText: true,
  highlightExact: false,
  cache: true,
  autoClear: 200,
};
window.onload = async () => {
  try {
    const setAutoload = (value) => {
      if (typeof value === 'boolean') {
        document.getElementById('y_opts_autoload').checked = value;
      }
    };

    const saveAutoload = async (checkbox) => {
      try {
        await chrome.storage.local.set({ autoload: checkbox.checked });
      } catch (error) {}
    };

    const setHighlightText = (value) => {
      if (typeof value === 'boolean') {
        document.getElementById('y_opts_highlight').checked = value;
        document
          .getElementById('ycs-highlight-group')
          .classList.toggle('ycs_group--enabled', value);
      }
    };

    const saveHighlightText = async (checkbox) => {
      try {
        await chrome.storage.local.set({ highlightText: checkbox.checked });
      } catch (error) {}
    };

    const setHighlightExact = (value) => {
      if (typeof value === 'boolean') {
        document.getElementById('y_opts_highlight_exact').checked = value;
      }
    };

    const saveHighlightExact = async (checkbox) => {
      try {
        await chrome.storage.local.set({ highlightExact: checkbox.checked });
      } catch (error) {}
    };

    const setCache = (value) => {
      if (typeof value === 'boolean') {
        document.getElementById('y_opts_cache').checked = value;
      }
    };

    const saveCache = async (checkbox) => {
      try {
        await chrome.storage.local.set({ cache: checkbox.checked });
      } catch (error) {}
    };

    const setAutoClear = (value) => {
      if (value) {
        document.getElementById('y_opts_cache_quota').value = value.toString();
      }
    };

    const saveAutoClear = async (input) => {
      try {
        if (n.isNumeric(input.target.value)) {
          await chrome.storage.local.set({ autoClear: input.target.value });
        }
      } catch (error) {}
    };

    const updateCacheInfo = async () => {
      try {
        const idb = await s.idb;
        const storageEstimate = await navigator.storage.estimate();
        const totalCacheElement = document.getElementById('ycs_total_cache');
        const usedCacheElement = document.getElementById('ycs_used_cache');
        const browserStorageElement = document.getElementById(
          'ycs_browser_av_storage'
        );
        const quotaStorageElement = document.getElementById(
          'ycs_quota_av_storage'
        );

        totalCacheElement.textContent =
          (await idb.count('STORE_CACHE_YCS')) + '';
        usedCacheElement.textContent = n.formatBytes(
          storageEstimate.usageDetails?.indexedDB || storageEstimate.usage
        );
        browserStorageElement.textContent =
          ((storageEstimate.usage / storageEstimate.quota) * 100).toFixed(2) +
          '%';
        quotaStorageElement.textContent = n.formatBytes(storageEstimate.quota);
      } catch (error) {}
    };

    const clearCache = async () => {
      try {
        const idb = await s.idb;
        await idb.clear('STORE_CACHE_YCS');
        await updateCacheInfo();
      } catch (error) {}
    };

    const initialSettings = await chrome.storage.local.get();
    await chrome.storage.local.set({ ...defaultOptions, ...initialSettings });

    const updatedSettings = await chrome.storage.local.get();
    if (updatedSettings) {
      for (const key of Object.keys(updatedSettings)) {
        switch (key) {
          case 'autoload':
            setAutoload(updatedSettings[key]);
            break;
          case 'highlightText':
            setHighlightText(updatedSettings[key]);
            break;
          case 'highlightExact':
            setHighlightExact(updatedSettings[key]);
            break;
          case 'cache':
            setCache(updatedSettings[key]);
            break;
          case 'autoClear':
            setAutoClear(updatedSettings[key]);
            break;
        }
      }
    }

    const innerWrapElement =
      document.getElementsByClassName('ycs_inner_wrap')[0];
    if (innerWrapElement) {
      innerWrapElement.addEventListener('click', async (event) => {
        switch (event.target.id) {
          case 'y_opts_autoload':
            saveAutoload(event.target);
            break;
          case 'y_opts_highlight':
            saveHighlightText(event.target);
            // to update UI
            setHighlightText(event.target.checked);
            break;
          case 'y_opts_highlight_exact':
            saveHighlightExact(event.target);
            break;
          case 'y_opts_cache':
            saveCache(event.target);
            break;
          case 'ycs_opts_btn_cache':
            event.target.disabled = true;
            await clearCache();
            event.target.disabled = false;
            break;
        }
      });
    }

    const cacheQuotaElement = document.getElementById('y_opts_cache_quota');
    if (cacheQuotaElement) {
      cacheQuotaElement.addEventListener('input', saveAutoClear);
    }

    document.getElementById('ycs_opts_btn_export_page').onclick = () => {
      try {
        chrome.tabs.create({
          url: chrome.runtime.getURL('./options/export.html'),
        });
      } catch (error) {}
    };

    await updateCacheInfo();
  } catch (error) {}
};
