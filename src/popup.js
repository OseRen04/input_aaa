import { LANGUAGES } from './core/languages.mjs';

const language = document.querySelector('#language');
const input = document.querySelector('#input');
const output = document.querySelector('#output');
const status = document.querySelector('#status');
const translate = document.querySelector('#translate');
const field = document.querySelector('#field');
const copy = document.querySelector('#copy');
const count = document.querySelector('#count');
let sessionId = null;

for (const [code, label] of LANGUAGES) {
  language.add(new Option(label, code));
}
chrome.storage.local.get('targetLanguage').then((saved) => {
  language.value = saved.targetLanguage || 'en';
}).catch(() => { language.value = 'en'; });
language.addEventListener('change', () => {
  chrome.storage.local.set({ targetLanguage: language.value });
});
input.addEventListener('input', () => { count.textContent = `${input.value.length} / 3000`; });

function showStatus(message, error = false) {
  status.textContent = message;
  status.classList.toggle('error', error);
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.type !== 'UI_EVENT') return;
  if (message.sessionId !== sessionId) return;
  if (message.status === 'loading') showStatus('モデルを準備しています…');
  if (message.status === 'download') showStatus(message.percentage === null
    ? 'モデルをダウンロードしています…'
    : `モデルをダウンロード中：${message.percentage}%`);
  if (message.status === 'translating') showStatus('この端末で翻訳しています…');
  if (message.status === 'done') {
    output.value = message.translated;
    copy.disabled = false;
    translate.disabled = false;
    showStatus('翻訳が完了しました。');
  }
  if (message.status === 'error') {
    translate.disabled = false;
    showStatus(`エラー：${message.message}`, true);
  }
});

translate.addEventListener('click', async () => {
  if (!input.value.trim()) { showStatus('翻訳する文章を入力してください。', true); return; }
  output.value = '';
  copy.disabled = true;
  translate.disabled = true;
  sessionId = crypto.randomUUID();
  showStatus('翻訳を開始しています…');
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'TRANSLATE_TEXT', text: input.value, language: language.value, sessionId
    });
    if (!response?.ok) throw new Error(response?.error || '処理を開始できませんでした。');
  } catch (error) {
    translate.disabled = false;
    showStatus(`エラー：${error.message}`, true);
  }
});

copy.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(output.value);
    showStatus('翻訳結果をコピーしました。');
  } catch (error) { showStatus(`コピーに失敗：${error.message}`, true); }
});

field.addEventListener('click', async () => {
  field.disabled = true;
  showStatus('現在の入力欄の翻訳を開始しています…');
  try {
    const response = await chrome.runtime.sendMessage({ type: 'TRANSLATE_ACTIVE_FIELD' });
    if (!response?.ok) throw new Error(response?.error || '入力欄を取得できませんでした。');
    showStatus('ページの入力欄を翻訳中です。結果は元の入力欄に反映されます。');
  } catch (error) {
    showStatus(`エラー：${error.message}`, true);
  } finally {
    field.disabled = false;
  }
});
