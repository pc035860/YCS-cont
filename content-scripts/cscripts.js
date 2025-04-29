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

    if (message && message.type === 'CHATGPT_RESPONSE' && message.body) {
      window.postMessage(
        { type: 'CHATGPT_RESPONSE', body: message.body },
        window.location.origin
      );
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

    if (event.data && event.data.type === 'ASK_CHATGPT' && event.data.body) {
      chrome.runtime.sendMessage(
        `${chrome.runtime.id}`,
        { type: 'ASK_CHATGPT', body: event.data.body },
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

document.addEventListener('DOMContentLoaded', () => {
  const askButton = document.createElement('button');
  askButton.id = 'askButton';
  askButton.innerText = 'Ask';
  askButton.classList.add('ycs-btn-search');
  askButton.style.marginLeft = '5px';

  const searchButton = document.getElementById('ycs_btn_search');
  if (searchButton && searchButton.parentNode) {
    searchButton.parentNode.insertBefore(askButton, searchButton.nextSibling);
  }

  const commentsCheckbox = document.createElement('input');
  commentsCheckbox.type = 'checkbox';
  commentsCheckbox.id = 'includeComments';
  commentsCheckbox.checked = true;
  commentsCheckbox.style.marginLeft = '5px';

  const commentsLabel = document.createElement('label');
  commentsLabel.htmlFor = 'includeComments';
  commentsLabel.innerText = 'Include Comments';
  commentsLabel.style.marginLeft = '5px';

  const transcriptCheckbox = document.createElement('input');
  transcriptCheckbox.type = 'checkbox';
  transcriptCheckbox.id = 'includeTranscript';
  transcriptCheckbox.checked = true;
  transcriptCheckbox.style.marginLeft = '5px';

  const transcriptLabel = document.createElement('label');
  transcriptLabel.htmlFor = 'includeTranscript';
  transcriptLabel.innerText = 'Include Transcript';
  transcriptLabel.style.marginLeft = '5px';

  if (searchButton && searchButton.parentNode) {
    searchButton.parentNode.insertBefore(commentsCheckbox, askButton.nextSibling);
    searchButton.parentNode.insertBefore(commentsLabel, commentsCheckbox.nextSibling);
    searchButton.parentNode.insertBefore(transcriptCheckbox, commentsLabel.nextSibling);
    searchButton.parentNode.insertBefore(transcriptLabel, transcriptCheckbox.nextSibling);
  }

  askButton.addEventListener('click', async () => {
    const searchInput = document.getElementById('ycs-input-search');
    if (!searchInput) {
      return;
    }

    const query = searchInput.value;
    const includeComments = document.getElementById('includeComments').checked;
    const includeTranscript = document.getElementById('includeTranscript').checked;

    let comments = '';
    let transcript = '';

    if (includeComments) {
      comments = await fetchComments();
    }

    if (includeTranscript) {
      transcript = await fetchTranscript();
    }

    const prompt = `Query: ${query}\nComments: ${comments}\nTranscript: ${transcript}`;

    window.postMessage(
      { type: 'ASK_CHATGPT', body: { prompt } },
      window.location.origin
    );
  });
});

async function fetchComments() {
  // Implement the logic to fetch comments
  return 'Sample comments';
}

async function fetchTranscript() {
  // Implement the logic to fetch transcript
  return 'Sample transcript';
}
