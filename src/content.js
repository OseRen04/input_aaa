// Injected on demand using activeTab; the extension does NOT read pages in the background.
(() => {
  if (globalThis.__localInputTranslatorInstalled) return;
  globalThis.__localInputTranslatorInstalled = true;

  const captures = new Map();
  let toastTimer;
  const writableInput = (element) => element instanceof HTMLTextAreaElement ||
    (element instanceof HTMLInputElement && ['text', 'search', 'url', 'tel'].includes(element.type));

  function inform(message, isError = false) {
    const previous = document.getElementById('plamo-translator-toast');
    previous?.remove();
    const host = document.createElement('div');
    host.id = 'plamo-translator-toast';
    host.style.cssText = 'position:fixed;z-index:2147483647;bottom:24px;right:24px;max-width:370px;pointer-events:none';
    const shadow = host.attachShadow({ mode: 'closed' });
    const bubble = document.createElement('div');
    bubble.textContent = message;
    bubble.style.cssText = 'font:13px/1.5 system-ui,sans-serif;padding:12px 16px;color:#fff;border-radius:12px;box-shadow:0 4px 24px #0004;background:' + (isError ? '#a22838' : '#1a2337');
    shadow.append(bubble);
    document.documentElement.append(host);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => host.remove(), isError ? 7000 : 3500);
  }

  function capture() {
    const element = document.activeElement;
    if (writableInput(element) && !element.disabled && !element.readOnly) {
      const full = element.value;
      const selectStart = element.selectionStart ?? 0;
      const selectEnd = element.selectionEnd ?? full.length;
      const start = selectStart === selectEnd ? 0 : selectStart;
      const end = selectStart === selectEnd ? full.length : selectEnd;
      const text = full.slice(start, end);
      if (!text.trim()) throw new Error('入力欄に文章がありません。');
      return { kind: 'input', element, full, start, end, text };
    }
    if (element?.isContentEditable) {
      const selected = window.getSelection();
      if (!selected?.rangeCount || selected.isCollapsed) {
        throw new Error('リッチテキスト欄では翻訳したい範囲を選択してください。');
      }
      const range = selected.getRangeAt(0);
      if (!element.contains(range.commonAncestorContainer)) {
        throw new Error('入力欄内の文章を選択してください。');
      }
      const text = range.toString();
      if (!text.trim()) throw new Error('選択した文章が空です。');
      return { kind: 'contenteditable', element, range: range.cloneRange(), text };
    }
    throw new Error('テキスト入力欄または選択した編集可能テキストにカーソルを置いてください。');
  }

  function apply(original, translated) {
    if (!original.element.isConnected) throw new Error('元の入力欄がなくなったため、置換を中止しました。');
    if (original.kind === 'input') {
      if (original.element.value !== original.full) {
        throw new Error('翻訳中に文章が変更されたため、置換しませんでした。');
      }
      const nextValue = original.full.slice(0, original.start) + translated + original.full.slice(original.end);
      const prototype = original.element instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(prototype, 'value').set.call(original.element, nextValue);
      original.element.dispatchEvent(new InputEvent('input', {
        bubbles: true, inputType: 'insertReplacementText', data: translated
      }));
      const nextCursor = original.start + translated.length;
      original.element.focus();
      original.element.setSelectionRange(nextCursor, nextCursor);
      return;
    }
    if (original.range.toString() !== original.text) {
      throw new Error('翻訳中に選択範囲が変更されたため、置換しませんでした。');
    }
    original.range.deleteContents();
    original.range.insertNode(document.createTextNode(translated));
    original.element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertReplacementText', data: translated }));
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'CAPTURE_FIELD') {
      try {
        const original = capture();
        captures.set(message.id, original);
        inform('PLaMo：翻訳を準備しています…');
        sendResponse({ text: original.text });
      } catch (error) {
        inform(error.message, true);
        sendResponse({ error: error.message });
      }
      return false;
    }
    if (message.type === 'APPLY_TRANSLATION') {
      try {
        const original = captures.get(message.id);
        if (!original) throw new Error('入力欄の状態が見つかりませんでした。');
        apply(original, message.translated);
        inform('PLaMo：翻訳結果で置換しました。');
      } catch (error) {
        inform(error.message, true);
      } finally {
        captures.delete(message.id);
      }
      return false;
    }
    if (message.type === 'TRANSLATION_ERROR') {
      captures.delete(message.id);
      inform(`翻訳失敗：${message.message}`, true);
    }
    return false;
  });
})();
