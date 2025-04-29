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

  askButton.addEventListener('click', async () => {
    const searchInput = document.getElementById('ycs-input-search');
    if (!searchInput) {
      return;
    }

    const query = searchInput.value;
    const comments = await fetchComments();
    const transcript = await fetchTranscript();

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

window.addEventListener('message', (event) => {
  if (event.source !== window) {
    return;
  }

  if (event.data.type && event.data.type === 'CHATGPT_RESPONSE' && event.data.body) {
    displayChatGPTResponse(event.data.body);
  }
});

function displayChatGPTResponse(response) {
  const responseContainer = document.createElement('div');
  responseContainer.id = 'chatgpt-response';
  responseContainer.innerText = response;
  responseContainer.style.marginTop = '10px';

  const searchContainer = document.getElementById('ycs-search');
  if (searchContainer) {
    searchContainer.appendChild(responseContainer);
  }
}
