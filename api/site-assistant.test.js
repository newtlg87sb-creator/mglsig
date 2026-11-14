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
  const originalFetch = globalThis.fetch;
  let providerCalls = 0;
  let providerStatus = 200;
  process.env.GEMINI_API_KEY = 'test-secret';
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
    assert.equal(providerLimitResponse.payload.error, 'provider_quota_exceeded');

    const methodResponse = createResponse();
    await handler({ method: 'GET', headers: {} }, methodResponse);
    assert.equal(methodResponse.statusCode, 405);
    assert.equal(methodResponse.headers.Allow, 'POST');
  } finally {
    globalThis.fetch = originalFetch;
    if (originalApiKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalApiKey;
  }
});
