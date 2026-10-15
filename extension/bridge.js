// Runs on the site's admin pages. Relays between the admin page and the
// extension: the page can't talk to the extension directly.

const FROM_PAGE = 'sharon-admin';
const TO_PAGE = 'sharon-ext';

function toPage(message) {
  window.postMessage({ source: TO_PAGE, ...message }, window.location.origin);
}

window.addEventListener('message', async (event) => {
  // Only this page's own messages.
  if (event.source !== window || event.origin !== window.location.origin) return;
  const data = event.data;
  if (!data || data.source !== FROM_PAGE) return;

  if (data.type === 'PING' || data.type === 'FILL_GROUP' || data.type === 'SET_QUEUE_CONFIG') {
    try {
      const reply = await chrome.runtime.sendMessage(data);
      toPage({ type: data.type === 'PING' ? 'PONG' : 'ACK', jobId: data.jobId, ...reply });
    } catch {
      toPage({ type: 'ACK', jobId: data.jobId, status: 'error', message: 'התוסף לא זמין. רעננו את הדף.' });
    }
  }
});

// Progress of a job, pushed by the extension.
chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === 'RESULT') toPage(message);
});

toPage({ type: 'HELLO' });
