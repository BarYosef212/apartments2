// Runs on Facebook group pages. Fills a new post with the listing's text and
// photos, then stops: the person reviews it and clicks "Post" themselves.
//
// Facebook's page structure changes often; the selectors below look for
// roles and visible Hebrew/English labels rather than generated class names.

const COMPOSER_TRIGGER = /כתבו משהו|כתוב משהו|כתבי משהו|Write something/;
const POST_BUTTON = /^(פרסום|פרסם|פרסמי|Post)$/;
// Groups that don't take broker listings.
const NO_BROKERS = /ללא\s*תיווך|בלי\s*תיווך|ללא\s*מתווכים|לא\s*למתווכים|מתווכים\s*(?:יוסרו|יחסמו)|no\s*brokers/i;
// Facebook's own rate-limit warnings.
const FB_WARNING = /נחסמת זמנית|חסום זמנית|מהר מדי|temporarily blocked|going too fast|misusing this feature/i;

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(find, timeoutMs = 15000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    const el = find();
    if (el) return el;
    await wait(300);
  }
  return null;
}

function banner(text, tone = 'ok') {
  document.getElementById('sharon-banner')?.remove();
  const el = document.createElement('div');
  el.id = 'sharon-banner';
  el.dir = 'rtl';
  el.textContent = text;
  Object.assign(el.style, {
    position: 'fixed',
    top: '72px',
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 2147483647,
    background: tone === 'ok' ? '#191917' : '#7f1d1d',
    color: '#fff',
    padding: '12px 18px',
    font: '600 15px/1.4 system-ui, sans-serif',
    boxShadow: '0 10px 30px rgba(0,0,0,.25)',
    maxWidth: '90vw',
  });
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 15000);
}

/**
 * The group's own name and "About" text. Not the whole page: owners often
 * write "ללא תיווך" in their own posts in the feed.
 */
function groupInfoText() {
  const parts = [document.title, document.querySelector('h1')?.innerText ?? ''];
  const aboutHeading = [...document.querySelectorAll('h2, span')].find((el) =>
    /^(אודות|About)$/.test((el.innerText || '').trim()),
  );
  const aboutBox = aboutHeading?.closest('[role="main"] > div, div[class]');
  if (aboutBox) parts.push(aboutBox.innerText.slice(0, 2000));
  return parts.join('\n');
}

function findComposerTrigger() {
  return [...document.querySelectorAll('[role="button"]')].find((el) =>
    COMPOSER_TRIGGER.test(el.innerText || el.getAttribute('aria-label') || ''),
  );
}

function findTextbox() {
  return document.querySelector('[role="dialog"] [contenteditable="true"][role="textbox"]');
}

function pasteInto(target, dataTransfer) {
  target.dispatchEvent(
    new ClipboardEvent('paste', { clipboardData: dataTransfer, bubbles: true, cancelable: true }),
  );
}

async function insertText(textbox, text) {
  textbox.focus();
  const dt = new DataTransfer();
  dt.setData('text/plain', text);
  pasteInto(textbox, dt);
  await wait(500);
  if ((textbox.innerText || '').trim().length > 0) return true;
  // Fallback for editors that ignore synthetic paste.
  document.execCommand('insertText', false, text);
  await wait(300);
  return (textbox.innerText || '').trim().length > 0;
}

async function insertImages(textbox, dataUrls) {
  if (dataUrls.length === 0) return 0;
  const files = await Promise.all(
    dataUrls.map(async (url, i) => {
      const blob = await (await fetch(url)).blob();
      return new File([blob], `photo-${i + 1}.jpg`, { type: blob.type || 'image/jpeg' });
    }),
  );

  // Facebook's composer accepts pasted images; fall back to its file input.
  const dt = new DataTransfer();
  files.forEach((f) => dt.items.add(f));
  pasteInto(textbox, dt);
  await wait(1500);
  const dialog = textbox.closest('[role="dialog"]');
  if (dialog?.querySelector('img[src^="blob:"]')) return files.length;

  const input = dialog?.querySelector('input[type="file"][accept*="image"]') ?? dialog?.querySelector('input[type="file"]');
  if (!input) return 0;
  const fileDt = new DataTransfer();
  files.forEach((f) => fileDt.items.add(f));
  input.files = fileDt.files;
  input.dispatchEvent(new Event('change', { bubbles: true }));
  return files.length;
}

/** Reports when the person clicks "Post" in the composer, once. */
function watchForPost(jobId) {
  const onClick = (event) => {
    const button = event.target.closest?.('[role="button"], button');
    if (!button || !button.closest('[role="dialog"]')) return;
    const label = (button.getAttribute('aria-label') || button.innerText || '').trim();
    if (!POST_BUTTON.test(label)) return;
    document.removeEventListener('click', onClick, true);
    chrome.runtime.sendMessage({ type: 'POSTED', jobId });
  };
  document.addEventListener('click', onClick, true);
}

/** Stops everything if Facebook shows a rate-limit warning. */
function watchForWarning(jobId) {
  const observer = new MutationObserver(() => {
    if (!FB_WARNING.test(document.body.innerText)) return;
    observer.disconnect();
    banner('פייסבוק הציגה אזהרה. הפרסום בקבוצות הושהה ל־48 שעות כדי להגן על החשבון.', 'warn');
    chrome.runtime.sendMessage({ type: 'WARNING', jobId, message: 'פייסבוק הציגה אזהרת קצב. הפרסום הושהה ל־48 שעות.' });
  });
  observer.observe(document.body, { childList: true, subtree: true });
  setTimeout(() => observer.disconnect(), 10 * 60 * 1000);
}

async function fill({ jobId, text, images }) {
  if (FB_WARNING.test(document.body.innerText)) {
    chrome.runtime.sendMessage({ type: 'WARNING', jobId, message: 'פייסבוק מציגה אזהרת קצב.' });
    return { status: 'warning', message: 'פייסבוק מציגה אזהרת קצב. הפרסום הושהה.' };
  }
  if (NO_BROKERS.test(groupInfoText())) {
    banner('נראה שזו קבוצה ״ללא תיווך״, לכן לא מילאנו פוסט.', 'warn');
    return { status: 'no_brokers', message: 'הקבוצה נראית כ״ללא תיווך״. לא מולא פוסט.' };
  }

  const trigger = await waitFor(findComposerTrigger);
  if (!trigger) return { status: 'error', message: 'לא נמצא כפתור ״כתבו משהו״. ייתכן שאינכם חברים בקבוצה.' };
  trigger.click();

  const textbox = await waitFor(findTextbox);
  if (!textbox) return { status: 'error', message: 'חלון הפוסט לא נפתח.' };
  await wait(800 + Math.random() * 1200);

  const textOk = await insertText(textbox, text);
  await wait(600 + Math.random() * 900);
  const imagesAdded = await insertImages(textbox, images);

  watchForPost(jobId);
  watchForWarning(jobId);
  banner(
    textOk
      ? `הפוסט מולא${imagesAdded ? ` עם ${imagesAdded} תמונות` : ''}. בדקו אותו ולחצו ״פרסום״.`
      : 'לא הצלחנו להכניס את הטקסט. הדביקו אותו ידנית (הוא הועתק).',
    textOk ? 'ok' : 'warn',
  );
  if (!textOk) navigator.clipboard?.writeText(text).catch(() => {});
  return { status: 'filled', textOk, imagesAdded };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'FILL') return;
  fill(message)
    .then(sendResponse)
    .catch((err) => sendResponse({ status: 'error', message: String(err?.message || err) }));
  return true;
});
