import { Wllama } from '@wllama/wllama';
import { MODEL_URL, STOP_TOKENS, makePrompt, cleanOutput } from './core/prompt.mjs';

const engine = new Wllama({ default: chrome.runtime.getURL('wasm/wllama.wasm') });
let modelPromise = null;
let pending = Promise.resolve();

function send(job, status, extra = {}) {
  chrome.runtime.sendMessage({ type: 'ENGINE_EVENT', event: {
    id: job.id, tabId: job.tabId, sessionId: job.sessionId, status, ...extra
  } }).catch(() => {});
}

async function ensureModel(job) {
  if (modelPromise) return modelPromise;
  modelPromise = engine.loadModelFromUrl(MODEL_URL, {
    n_ctx: 4096,
    progressCallback: ({ loaded, total }) => {
      const percentage = total ? Math.min(100, Math.round(loaded / total * 100)) : null;
      send(job, 'download', { percentage });
    }
  }).catch((error) => {
    modelPromise = null;
    throw error;
  });
  return modelPromise;
}

async function translate(job) {
  try {
    const prompt = makePrompt(job.text, job.language);
    send(job, 'loading');
    await ensureModel(job);
    send(job, 'translating');
    const response = await engine.createCompletion({
      prompt,
      temperature: 0,
      max_tokens: 1024,
      stop: STOP_TOKENS
    });
    const translated = cleanOutput(response.choices?.[0]?.text);
    send(job, 'done', { translated });
  } catch (error) {
    send(job, 'error', { message: error?.message || String(error) });
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'ENGINE_PING') {
    sendResponse({ ready: true });
    return false;
  }
  if (message.type !== 'ENGINE_JOB') return false;
  const job = message.job;
  // Serialize requests: a single wllama instance cannot generate in parallel.
  pending = pending.catch(() => {}).then(() => translate(job));
  sendResponse({ accepted: true });
  return false;
});
