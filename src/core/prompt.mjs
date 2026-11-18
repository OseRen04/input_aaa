import { LANGUAGE_CODES } from './languages.mjs';

export const MODEL_URL = 'https://huggingface.co/pfnet/plamo-3-translate-0.8b-GGUF/resolve/main/plamo-3-translate-0.8b-Q4_K_M.gguf';
export const STOP_TOKENS = ['<|plamo:tag|>', '<|plamo:bos|>'];
const MAX_INPUT_CHARS = 3000;

export function validateTranslation(text, targetLanguage) {
  if (typeof text !== 'string' || !text.trim()) throw new Error('翻訳する文章を入力してください。');
  if (text.length > MAX_INPUT_CHARS) throw new Error(`文章は${MAX_INPUT_CHARS}文字以内にしてください。`);
  if (!LANGUAGE_CODES.has(targetLanguage)) throw new Error('対応していない翻訳先言語です。');
}

/** Official PFML3 format. The model/llama.cpp inserts the BOS token. */
export function makePrompt(text, targetLanguage) {
  validateTranslation(text, targetLanguage);
  return '<|plamo:tag|>dataset<|plamo:msg|>translation'
    + '<|plamo:tag|>input<|plamo:key|>lang<|plamo:val|>ja<|plamo:msg|>' + text
    + '<|plamo:tag|>output<|plamo:key|>lang<|plamo:val|>' + targetLanguage + '<|plamo:msg|>';
}

export function cleanOutput(output) {
  if (typeof output !== 'string') throw new Error('翻訳結果が不正です。');
  // A stop marker may still appear if the runtime fails to apply stop strings.
  const firstTag = STOP_TOKENS.reduce((index, token) => {
    const match = output.indexOf(token);
    return match < 0 ? index : Math.min(index, match);
  }, output.length);
  const clean = output.slice(0, firstTag).trim();
  if (!clean) throw new Error('翻訳結果が空でした。再度実行してください。');
  return clean;
}
