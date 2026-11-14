import assert from 'node:assert/strict';
import { test } from 'node:test';
import handler from './admin-ai-room.js';

const ADMIN_USER_ID = '21f19ae0-b35e-4984-b8dc-dc8e463b0155';

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

function createRequest(messages, token = 'admin-session-token', mode = 'roundtable') {
  return {
    method: 'POST',
    headers: token ? { authorization: `Bearer ${token}` } : {},
    body: { mode, provider: 'Gemini', messages }
  };
}

function setEnvironment(values) {
  const originalValues = Object.fromEntries(
    Object.keys(values).map(key => [key, process.env[key]])
  );
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  return () => {
    for (const [key, value] of Object.entries(originalValues)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
}

test('admin AI room rejects requests without an authenticated admin session', async () => {
  const restoreEnvironment = setEnvironment({
    SUPABASE_URL: 'https://supabase.example',
    SUPABASE_ANON_KEY: 'test-anon-key'
  });
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = async () => {
    fetchCalls += 1;
    return {
      ok: true,
      json: async () => ({ id: 'not-the-admin-user' })
    };
  };

  try {
    const missingTokenResponse = createResponse();
    await handler(createRequest([{ role: 'user', text: 'Hello' }], null), missingTokenResponse);
    assert.equal(missingTokenResponse.statusCode, 401);
    assert.equal(fetchCalls, 0);

    const otherUserResponse = createResponse();
    await handler(createRequest([{ role: 'user', text: 'Hello' }]), otherUserResponse);
    assert.equal(otherUserResponse.statusCode, 403);
    assert.equal(fetchCalls, 1);
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnvironment();
  }
});

test('admin AI room runs a roundtable and passes earlier AI replies to later providers', async () => {
  const restoreEnvironment = setEnvironment({
    SUPABASE_URL: 'https://supabase.example',
    SUPABASE_ANON_KEY: 'test-anon-key',
    GEMINI_API_KEY: 'gemini-test-key',
    OPENROUTER_API_KEY: 'openrouter-test-key',
    GROQ_API_KEY: 'groq-test-key'
  });
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    if (url === 'https://supabase.example/auth/v1/user') {
      assert.equal(options.headers.apikey, 'test-anon-key');
      assert.equal(options.headers.Authorization, 'Bearer admin-session-token');
      return { ok: true, json: async () => ({ id: ADMIN_USER_ID }) };
    }

    const body = JSON.parse(options.body);
    if (url.includes('generativelanguage.googleapis.com')) {
      assert.equal(options.headers['x-goog-api-key'], 'gemini-test-key');
      assert.ok(body.systemInstruction.parts[0].text.includes('Cyrillic script'));
      assert.ok(body.systemInstruction.parts[0].text.includes('never guess or claim their status'));
      return {
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: 'Gemini opening thought.' }] } }]
        })
      };
    }

    if (url === 'https://openrouter.ai/api/v1/chat/completions') {
      assert.equal(options.headers.Authorization, 'Bearer openrouter-test-key');
      assert.equal(body.model, 'openrouter/free');
      assert.ok(body.messages[0].content.includes('Cyrillic script'));
      assert.ok(body.messages.at(-1).content.includes('[Gemini]: Gemini opening thought.'));
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'OpenRouter agrees with Gemini.' } }]
        })
      };
    }

    assert.equal(url, 'https://api.groq.com/openai/v1/chat/completions');
    assert.equal(options.headers.Authorization, 'Bearer groq-test-key');
    assert.equal(body.model, 'llama-3.3-70b-versatile');
    assert.ok(body.messages.at(-1).content.includes('[Gemini]: Gemini opening thought.'));
    assert.ok(body.messages.at(-1).content.includes('[OpenRouter]: OpenRouter agrees with Gemini.'));
    return {
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'Groq adds another perspective.' } }]
      })
    };
  };

  try {
    const response = createResponse();
    await handler(createRequest([{ role: 'user', text: 'What should we build next?' }]), response);

    assert.equal(response.statusCode, 200);
    assert.equal(response.headers['Cache-Control'], 'no-store');
    assert.deepEqual(response.payload.results.map(result => result.provider), [
      'Gemini',
      'OpenRouter',
      'Groq'
    ]);
    assert.equal(response.payload.results[2].answer, 'Groq adds another perspective.');
    assert.equal(calls.length, 4);
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnvironment();
  }
});

test('admin AI room reports provider status codes without exposing provider response bodies', async () => {
  const restoreEnvironment = setEnvironment({
    SUPABASE_URL: 'https://supabase.example',
    SUPABASE_ANON_KEY: 'test-anon-key',
    GEMINI_API_KEY: 'gemini-test-key',
    OPENROUTER_API_KEY: undefined,
    GROQ_API_KEY: undefined
  });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async url => {
    if (url === 'https://supabase.example/auth/v1/user') {
      return { ok: true, json: async () => ({ id: ADMIN_USER_ID }) };
    }
    return {
      ok: false,
      status: 429,
      json: async () => ({ error: { message: 'Provider private error detail' } })
    };
  };

  try {
    const response = createResponse();
    await handler(createRequest(
      [{ role: 'user', text: 'Hello' }],
      'admin-session-token',
      'direct'
    ), response);

    assert.equal(response.statusCode, 503);
    assert.deepEqual(response.payload, {
      error: 'provider_unavailable',
      provider: 'Gemini',
      reason: 'rate_limited'
    });
    assert.equal(JSON.stringify(response.payload).includes('Provider private error detail'), false);
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnvironment();
  }
});
