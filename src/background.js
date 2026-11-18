let creationPromise;
const ENGINE_URL = 'offscreen.html';

async function ensureEngine() {
  if (creationPromise) return creationPromise;
  creationPromise = (async () => {
    const contexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT'],
      documentUrls: [chrome.runtime.getURL(ENGINE_URL)]
    });
    if (contexts.length === 0) {
      await chrome.offscreen.createDocument({
        url: ENGINE_URL,
        reasons: ['WORKERS'],
        justification: 'WebAssembly worker でPLaMoのローカル翻訳を実行するため'
      });
    }
    // createDocument may resolve before offscreen.js has installed its listener.
    for (let attempt = 0; attempt < 30; attempt++) {
      const response = await chrome.runtime.sendMessage({ type: 'ENGINE_PING' }).catch(() => null);
      if (response?.ready) return;
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    throw new Error('翻訳エンジンを起動できませんでした。拡張機能を再読み込みしてください。');
  })();
  try {
    return await creationPromise;
  } finally {
    creationPromise = null;
  }
}

async function startJob({ text, language, tabId = null, sessionId = null, id = crypto.randomUUID() }) {
  await ensureEngine();
  // Offscreen document is the only processor of ENGINE_JOB.
  await chrome.runtime.sendMessage({ type: 'ENGINE_JOB', job: { id, text, language, tabId, sessionId } });
  return id;
}

async function translateCurrentField(tabId) {
  const id = crypto.randomUUID();
  await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
  const response = await chrome.tabs.sendMessage(tabId, { type: 'CAPTURE_FIELD', id });
  if (!response?.text) throw new Error(response?.error || '編集可能な入力欄にカーソルを置いてください。');
  const { targetLanguage = 'en' } = await chrome.storage.local.get('targetLanguage');
  return startJob({ text: response.text, language: targetLanguage, tabId, id });
}

async function activeTabId() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tabs[0]?.id) throw new Error('アクティブなタブがありません。');
  return tabs[0].id;
}

function notifyPopup(message) {
  // This goes to extension views only; no servers are contacted.
  chrome.runtime.sendMessage({ type: 'UI_EVENT', ...message }).catch(() => {});
}

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'translate-input') return;
  try {
    await translateCurrentField(await activeTabId());
  } catch (error) {
    notifyPopup({ status: 'error', message: error.message });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'TRANSLATE_TEXT') {
    startJob({ text: message.text, language: message.language, sessionId: message.sessionId })
      .then((id) => sendResponse({ ok: true, id }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  if (message.type === 'TRANSLATE_ACTIVE_FIELD') {
    activeTabId().then(translateCurrentField)
      .then((id) => sendResponse({ ok: true, id }))
      .catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  if (message.type === 'ENGINE_EVENT') {
    const { event } = message;
    if (event.status === 'done') {
      if (event.tabId !== null) {
        chrome.tabs.sendMessage(event.tabId, { type: 'APPLY_TRANSLATION', ...event })
          .catch(() => {});
      }

    }
    if (event.status === 'error' && event.tabId !== null) {
      chrome.tabs.sendMessage(event.tabId, { type: 'TRANSLATION_ERROR', ...event })
        .catch(() => {});
    }
    notifyPopup(event);
  }
  return false;
});
