import test from 'node:test';
import assert from 'node:assert/strict';
import { LANGUAGES } from '../src/core/languages.mjs';
import { MODEL_URL, makePrompt, cleanOutput, validateTranslation } from '../src/core/prompt.mjs';

test('model supports exactly 53 distinct languages and requested examples', () => {
  assert.equal(LANGUAGES.length, 53);
  assert.equal(new Set(LANGUAGES.map(([code]) => code)).size, 53);
  for (const code of ['ja', 'en', 'ru', 'zh-hans', 'ko', 'uk']) {
    assert.ok(LANGUAGES.some(([item]) => item === code));
  }
});
test('PFML3 prompt follows official format with target language', () => {
  assert.equal(makePrompt('こんにちは', 'ru'),
    '<|plamo:tag|>dataset<|plamo:msg|>translation'
    + '<|plamo:tag|>input<|plamo:key|>lang<|plamo:val|>ja<|plamo:msg|>こんにちは'
    + '<|plamo:tag|>output<|plamo:key|>lang<|plamo:val|>ru<|plamo:msg|>');
});
test('invalid requests fail before model load', () => {
  assert.throws(() => validateTranslation('', 'en'), /入力/);
  assert.throws(() => validateTranslation('test', 'xx'), /対応/);
  assert.throws(() => validateTranslation('a'.repeat(3001), 'ru'), /3000/);
});
test('completion stop tokens are removed from translation', () => {
  assert.equal(cleanOutput('Hello.\n<|plamo:tag|>input'), 'Hello.');
  assert.equal(cleanOutput('Привет!<|plamo:bos|>'), 'Привет!');
  assert.throws(() => cleanOutput('<|plamo:tag|>'), /空/);
});
test('model URL is fixed to official Q4_K_M GGUF', () => {
  assert.match(MODEL_URL, /^https:\/\/huggingface\.co\/pfnet\/plamo-3-translate-0\.8b-GGUF\/resolve\/main\//);
  assert.match(MODEL_URL, /Q4_K_M\.gguf$/);
});
