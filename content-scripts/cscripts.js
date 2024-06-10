// scripts injected into the page by the content script
const SCRIPT_SRCS = [
  'web-resources/htmlEntities.js',
  'web-resources/wresources.js',
];

const fullSrcs = SCRIPT_SRCS.map((src) => chrome.runtime.getURL(src));

(function () {
  fullSrcs.forEach((src) => {
    const scripts = document.querySelectorAll(`script[src="${src}"]`);
    for (const script of scripts) {
      script.remove();
    }
  });
})();

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  try {
    if (
      message &&
      message.type === 'YCS_CACHE_STORAGE_GET_SEND' &&
      message.body
    ) {
      window.postMessage(
        { type: 'YCS_CACHE_STORAGE_GET_RESPONSE', body: message.body },
        window.location.origin
      );
    }

    if (message && message.type === 'YCS_AUTOLOAD') {
      window.postMessage({ type: 'YCS_AUTOLOAD' }, window.location.origin);
    }
  } catch (error) {}
});

window.addEventListener('message', async (event) => {
  try {
    if (event.source !== window) {
      return;
    }

    if (event.data.type && event.data.type === 'NUMBER_COMMENTS') {
      chrome.runtime.sendMessage(`${chrome.runtime.id}`, {
        type: 'YCS_SET_BADGE',
        text: event.data.text.toString() || '',
      });
    }

    if (event.data && event.data.type === 'GET_OPTIONS') {
      try {
        const options = await chrome.storage.local.get();
        window.postMessage(
          { type: 'YCS_OPTIONS', text: options },
          window.location.origin
        );
      } catch (error) {}
    }

    if (
      event.data &&
      event.data.type === 'YCS_CACHE_STORAGE_SET' &&
      event.data.body
    ) {
      chrome.runtime.sendMessage(
        `${chrome.runtime.id}`,
        event.data,
        (response) => {}
      );
    }

    if (
      event.data &&
      event.data.type === 'YCS_CACHE_STORAGE_GET' &&
      event.data.body
    ) {
      chrome.runtime.sendMessage(
        `${chrome.runtime.id}`,
        event.data,
        (response) => {}
      );
    }
  } catch (error) {}
});

(async function (srcs, target) {
  const load = (src) => {
    return new Promise((resolve) => {
      try {
        const targetElement = document.querySelector(target);
        const scriptElement = document.createElement('script');

        const onLoad = () => {
          resolve(src);
          scriptElement.removeEventListener('load', onLoad);
        };

        scriptElement.addEventListener('load', onLoad);
        scriptElement.setAttribute('type', 'text/javascript');
        scriptElement.setAttribute('src', src);
        if (targetElement) {
          targetElement.appendChild(scriptElement);
        } else {
          resolve(null);
        }
      } catch (error) {
        throw error;
      }
    });
  };

  for (const src of srcs) {
    await load(src);
  }
})(fullSrcs, 'body');
