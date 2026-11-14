import assert from 'node:assert/strict';
import { test } from 'node:test';
import handler from './site-assistant.js';

function createResponse() {
  return {
    headers: {},
    statusCode: 200,
    payload: undefined,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    }
  };
}

function createRequest(messages, ip = '192.0.2.40') {
  return {
    method: 'POST',
    headers: { 'x-real-ip': ip },
    body: { messages }
  };
}

test('site assistant validates requests, calls Gemini, and limits requests per client', async () => {
  const originalApiKey = process.env.GEMINI_API_KEY;
  const originalOpenRouterApiKey = process.env.OPENROUTER_API_KEY;
  const originalGroqApiKey = process.env.GROQ_API_KEY;
  const originalFetch = globalThis.fetch;
  let providerCalls = 0;
  let providerStatus = 200;
  process.env.GEMINI_API_KEY = 'test-secret';
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.GROQ_API_KEY;
  globalThis.fetch = async (url, options) => {
    providerCalls += 1;
    assert.match(url, /models\/gemini-3\.5-flash-lite:generateContent$/);
    assert.equal(options.headers['x-goog-api-key'], 'test-secret');
    const requestBody = JSON.parse(options.body);
    const instruction = requestBody.systemInstruction.parts[0].text;
    assert.ok(instruction.includes('Alpha: $20 per month'));
    assert.ok(instruction.includes('main_pricing.html'));
    assert.ok(instruction.includes('Never provide personalized financial advice'));
    return {
      ok: providerStatus === 200,
      status: providerStatus,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: 'MGL Signal provides public site information.' }] } }]
      })
    };
  };

  try {
    const invalidResponse = createResponse();
    await handler(createRequest([{ role: 'user', text: '  ' }]), invalidResponse);
    assert.equal(invalidResponse.statusCode, 400);

    const oversizedResponse = createResponse();
    await handler({
      ...createRequest([{ role: 'user', text: 'Question' }]),
      headers: { 'content-length': '12001' }
    }, oversizedResponse);
    assert.equal(oversizedResponse.statusCode, 413);

    const messages = [{ role: 'user', text: 'What is MGL Signal?' }];
    const firstResponse = createResponse();
    await handler(createRequest(messages), firstResponse);
    assert.equal(firstResponse.statusCode, 200);
    assert.equal(firstResponse.payload.answer, 'MGL Signal provides public site information.');
    assert.equal(firstResponse.headers['Cache-Control'], 'no-store');

    for (let requestNumber = 0; requestNumber < 5; requestNumber += 1) {
      const response = createResponse();
      await handler(createRequest(messages), response);
      assert.equal(response.statusCode, 200);
    }

    const limitedResponse = createResponse();
    await handler(createRequest(messages), limitedResponse);
    assert.equal(limitedResponse.statusCode, 429);
    assert.equal(limitedResponse.headers['Retry-After'], '60');
    assert.equal(providerCalls, 6);

    providerStatus = 429;
    const providerLimitResponse = createResponse();
    await handler(createRequest(messages, '192.0.2.41'), providerLimitResponse);
    assert.equal(providerLimitResponse.statusCode, 503);
    assert.equal(providerLimitResponse.payload.error, 'assistant_unavailable');

    const methodResponse = createResponse();
    await handler({ method: 'GET', headers: {} }, methodResponse);
    assert.equal(methodResponse.statusCode, 405);
    assert.equal(methodResponse.headers.Allow, 'POST');
  } finally {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalApiKey;
    if (originalOpenRouterApiKey === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = originalOpenRouterApiKey;
    if (originalGroqApiKey === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = originalGroqApiKey;
  }
});

test('site assistant falls back from Gemini to OpenRouter and Groq', async () => {
  const originalKeys = {
    gemini: process.env.GEMINI_API_KEY,
    openRouter: process.env.OPENROUTER_API_KEY,
    groq: process.env.GROQ_API_KEY
  };
  const originalFetch = globalThis.fetch;
  const calls = [];
  process.env.GEMINI_API_KEY = 'gemini-test-key';
  process.env.OPENROUTER_API_KEY = 'openrouter-test-key';
  process.env.GROQ_API_KEY = 'groq-test-key';

  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    if (url.includes('generativelanguage.googleapis.com')) {
      assert.equal(options.headers['x-goog-api-key'], 'gemini-test-key');
      return { ok: false, status: 503 };
    }

    const requestBody = JSON.parse(options.body);
    assert.equal(requestBody.messages[0].role, 'system');
    assert.ok(requestBody.messages[0].content.includes('MGL Signal'));

    if (url === 'https://openrouter.ai/api/v1/chat/completions') {
      assert.equal(options.headers.Authorization, 'Bearer openrouter-test-key');
      assert.equal(requestBody.model, 'openrouter/free');
      return { ok: false, status: 429 };
    }

    assert.equal(url, 'https://api.groq.com/openai/v1/chat/completions');
    assert.equal(options.headers.Authorization, 'Bearer groq-test-key');
    assert.equal(requestBody.model, 'llama-3.3-70b-versatile');
    return {
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: 'Groq fallback response.' } }]
      })
    };
  };

  try {
    const response = createResponse();
    await handler(createRequest([{ role: 'user', text: 'MGL Signal гэж юу вэ?' }], '192.0.2.42'), response);

    assert.equal(response.statusCode, 200);
    assert.equal(response.payload.answer, 'Groq fallback response.');
    assert.deepEqual(calls.map(call => call.url), [
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent',
      'https://openrouter.ai/api/v1/chat/completions',
      'https://api.groq.com/openai/v1/chat/completions'
    ]);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKeys.gemini === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKeys.gemini;
    if (originalKeys.openRouter === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = originalKeys.openRouter;
    if (originalKeys.groq === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = originalKeys.groq;
  }
});

test('site assistant uses a configured fallback when Gemini has no API key', async () => {
  const originalKeys = {
    gemini: process.env.GEMINI_API_KEY,
    openRouter: process.env.OPENROUTER_API_KEY,
    groq: process.env.GROQ_API_KEY
  };
  const originalFetch = globalThis.fetch;
  const calls = [];
  delete process.env.GEMINI_API_KEY;
  process.env.OPENROUTER_API_KEY = 'openrouter-test-key';
  delete process.env.GROQ_API_KEY;
  globalThis.fetch = async (url, options) => {
    calls.push(url);
    assert.equal(url, 'https://openrouter.ai/api/v1/chat/completions');
    assert.equal(JSON.parse(options.body).model, 'openrouter/free');
    return {
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: 'OpenRouter response.' } }]
      })
    };
  };

  try {
    const response = createResponse();
    await handler(createRequest([{ role: 'user', text: 'Question' }], '192.0.2.43'), response);

    assert.equal(response.statusCode, 200);
    assert.equal(response.payload.answer, 'OpenRouter response.');
    assert.deepEqual(calls, ['https://openrouter.ai/api/v1/chat/completions']);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalKeys.gemini === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalKeys.gemini;
    if (originalKeys.openRouter === undefined) delete process.env.OPENROUTER_API_KEY;
    else process.env.OPENROUTER_API_KEY = originalKeys.openRouter;
    if (originalKeys.groq === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = originalKeys.groq;
  }
});
