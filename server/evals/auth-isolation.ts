/**
 * Auth end-to-end check against a running API. Proves that:
 *   - routes require a session, except the public ones
 *   - two users cannot see, search, change or stream each other's data
 *   - API keys authenticate as their owner (x-api-key and Bearer), bad keys are rejected
 *   - a conversation id owned by one user cannot be written by another
 *
 *   npm run test:auth               # needs the API running (API_URL, default http://localhost:4000)
 *   npm run test:auth -- --skip-llm # skips the chat check (the only step that calls an LLM)
 *
 * Creates two throwaway accounts: point it at a dev or test database, never production.
 */
import { API_URL, Client, check, failureCount, sleep } from './e2e-client';

const SKIP_LLM = process.argv.includes('--skip-llm');
const READY_TIMEOUT_MS = 30_000;

const chatBody = (conversationId: string, messageId: string) => ({
  id: conversationId,
  trigger: 'submit-message',
  messages: [
    {
      id: messageId,
      role: 'user',
      parts: [{ type: 'text', text: 'Reply with the single word: ok' }],
    },
  ],
});

async function main(): Promise<void> {
  const stamp = Date.now();
  const password = `e2e-${stamp}-Password!`;
  console.log(`Auth isolation test against ${API_URL}`);

  console.log('\n[public vs protected routes]');
  const anonymous = new Client();
  const health = await anonymous.request('GET', '/api/health');
  check(health.status === 200, `GET /api/health is public (${health.status})`);
  for (const path of [
    '/api/documents',
    '/api/generations',
    '/api/chat/conversations',
    '/api/traces',
    '/api/me',
  ]) {
    const res = await anonymous.request('GET', path);
    check(res.status === 401, `GET ${path} without a session -> ${res.status}`);
  }

  console.log('\n[sign up two users]');
  const alice = new Client();
  const bob = new Client();
  for (const [client, name] of [
    [alice, 'Alice'],
    [bob, 'Bob'],
  ] as const) {
    const res = await client.request<{ user?: { id: string } }>(
      'POST',
      '/api/auth/sign-up/email',
      {
        name,
        email: `${name.toLowerCase()}+${stamp}@example.test`,
        password,
      },
    );
    check(
      res.status === 200 && !!res.body?.user?.id,
      `${name} signed up (${res.status})`,
    );
  }
  const me = await alice.request<{ user: { email: string } }>('GET', '/api/me');
  check(
    me.status === 200 && me.body.user.email.startsWith('alice+'),
    `GET /api/me returns Alice (${me.status})`,
  );

  console.log('\n[Alice indexes a private document]');
  const created = await alice.request<{ id: string }>(
    'POST',
    '/api/documents',
    {
      title: `Team Alpha secrets ${stamp}`,
      content:
        'The access code of team Alpha is ORCHID-42. Only Alice should ever be able to find this passage.',
    },
  );
  check(created.status === 201, `document created (${created.status})`);
  const documentId = created.body?.id;

  const deadline = Date.now() + READY_TIMEOUT_MS;
  let status = '';
  while (documentId && Date.now() < deadline) {
    const doc = await alice.request<{ status: string }>(
      'GET',
      `/api/documents/${documentId}`,
    );
    status = doc.body?.status;
    if (status === 'READY' || status === 'FAILED') break;
    await sleep(750);
  }
  check(status === 'READY', `document indexed (status ${status || 'unknown'})`);

  const aliceSearch = await alice.request<{
    results: Array<{ content: string }>;
  }>('POST', '/api/documents/search', {
    query: 'access code of team Alpha',
    topK: 3,
  });
  check(
    aliceSearch.status === 200 &&
      aliceSearch.body.results.some((r) => r.content.includes('ORCHID-42')),
    'Alice finds her passage',
  );

  console.log("\n[Bob cannot reach Alice's data]");
  const bobList = await bob.request<{ total: number }>('GET', '/api/documents');
  check(
    bobList.status === 200 && bobList.body.total === 0,
    `Bob's document list is empty (total ${bobList.body?.total})`,
  );
  const bobGet = await bob.request('GET', `/api/documents/${documentId}`);
  check(bobGet.status === 404, `Bob GET Alice's document -> ${bobGet.status}`);
  const bobChunks = await bob.request(
    'GET',
    `/api/documents/${documentId}/chunks`,
  );
  check(
    bobChunks.status === 404,
    `Bob GET Alice's chunks -> ${bobChunks.status}`,
  );
  const bobSearch = await bob.request<{ results: unknown[] }>(
    'POST',
    '/api/documents/search',
    { query: 'access code of team Alpha ORCHID-42', topK: 5 },
  );
  check(
    bobSearch.status === 200 && bobSearch.body.results.length === 0,
    `Bob's search finds nothing (${bobSearch.body?.results?.length} results)`,
  );
  const bobScoped = await bob.request<{ results: unknown[] }>(
    'POST',
    '/api/documents/search',
    { query: 'access code', topK: 5, documentIds: [documentId] },
  );
  check(
    bobScoped.status === 200 && bobScoped.body.results.length === 0,
    "Bob can't search Alice's document by naming its id",
  );
  const bobDelete = await bob.request('DELETE', `/api/documents/${documentId}`);
  check(
    bobDelete.status === 404,
    `Bob DELETE Alice's document -> ${bobDelete.status}`,
  );
  const bobTraces = await bob.request<{ data: Array<{ traceId: string }> }>(
    'GET',
    '/api/traces',
  );
  check(
    bobTraces.status === 200 &&
      bobTraces.body.data.every((call) => call.traceId !== documentId),
    "Bob's traces don't include Alice's indexing calls",
  );

  console.log('\n[API keys]');
  const createdKey = await alice.request<{ key: string }>(
    'POST',
    '/api/auth/api-key/create',
    { name: `e2e ${stamp}` },
  );
  check(
    createdKey.status === 200 && typeof createdKey.body?.key === 'string',
    `Alice created an API key (${createdKey.status})`,
  );
  const apiKey = createdKey.body?.key ?? '';
  check(apiKey.startsWith('mat_'), 'key has the mat_ prefix');

  const viaHeader = await new Client().request<{ total: number }>(
    'GET',
    '/api/documents',
    undefined,
    { 'x-api-key': apiKey },
  );
  check(
    viaHeader.status === 200 && viaHeader.body.total >= 1,
    `x-api-key authenticates as Alice (${viaHeader.status}, total ${viaHeader.body?.total})`,
  );
  const viaBearer = await new Client().request<{ total: number }>(
    'GET',
    '/api/documents',
    undefined,
    { Authorization: `Bearer ${apiKey}` },
  );
  check(
    viaBearer.status === 200 && viaBearer.body.total >= 1,
    `Bearer key authenticates as Alice (${viaBearer.status})`,
  );
  const badKey = await new Client().request(
    'GET',
    '/api/documents',
    undefined,
    {
      'x-api-key': 'mat_not-a-real-key',
    },
  );
  check(badKey.status === 401, `invalid key is rejected (${badKey.status})`);

  if (SKIP_LLM) {
    console.log('\n[conversation ownership] skipped (--skip-llm)');
  } else {
    console.log('\n[conversation ownership]');
    const conversationId = `e2e-${stamp}`;
    const aliceChat = await alice.request(
      'POST',
      '/api/chat',
      chatBody(conversationId, `alice-${stamp}`),
    );
    check(aliceChat.status === 200, `Alice chats (${aliceChat.status})`);
    const aliceRead = await alice.request<{
      messages: Array<{ role: string }>;
    }>('GET', `/api/chat/conversations/${conversationId}`);
    check(
      aliceRead.status === 200 &&
        aliceRead.body.messages.some((message) => message.role === 'assistant'),
      `Alice's reply is saved (${aliceRead.body?.messages?.map((message) => message.role).join(', ')})`,
    );
    const bobChat = await bob.request(
      'POST',
      '/api/chat',
      chatBody(conversationId, `bob-${stamp}`),
    );
    check(
      bobChat.status === 403,
      `Bob can't post into Alice's conversation (${bobChat.status})`,
    );
    const bobRead = await bob.request(
      'GET',
      `/api/chat/conversations/${conversationId}`,
    );
    check(
      bobRead.status === 404,
      `Bob can't read Alice's conversation (${bobRead.status})`,
    );
  }

  console.log('\n[sign out]');
  const signOut = await alice.request('POST', '/api/auth/sign-out', {});
  check(signOut.status === 200, `Alice signed out (${signOut.status})`);
  const afterSignOut = await alice.request('GET', '/api/documents');
  check(
    afterSignOut.status === 401,
    `the old session no longer works (${afterSignOut.status})`,
  );

  if (documentId) {
    await new Client().request(
      'DELETE',
      `/api/documents/${documentId}`,
      undefined,
      { 'x-api-key': apiKey },
    );
  }

  const failures = failureCount();
  console.log(
    failures === 0
      ? '\nAuth isolation test passed'
      : `\nAuth isolation test FAILED (${failures} check(s))`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('Auth isolation test crashed:', error);
  process.exit(1);
});
