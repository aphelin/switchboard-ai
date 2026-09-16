/**
 * Demo guest check against a running API. Proves that:
 *   - GET /api/demo is public and the demo is open
 *   - one request opens a guest session, marked as a guest with an expiry and the guest budget
 *   - guests cannot store provider keys or create API keys
 *   - two guests are isolated from each other like any two accounts
 *
 *   npm run test:demo   # needs the API running (API_URL, default http://localhost:4000)
 *
 * Makes no LLM calls. Creates throwaway guests, deleted by the demo sweep after
 * DEMO_GUEST_TTL_HOURS: point it at a dev or test database, never production.
 */
import { API_URL, Client, check, failureCount } from './e2e-client';

interface DemoStatus {
  enabled: boolean;
  guestTtlHours: number;
  guestDailyBudgetUsd: number | null;
}

async function main(): Promise<void> {
  const stamp = Date.now();
  console.log(`Demo guest test against ${API_URL}`);

  console.log('\n[demo status]');
  const status = await new Client().request<DemoStatus>('GET', '/api/demo');
  check(
    status.status === 200 && status.body.enabled === true,
    `GET /api/demo is public and enabled (${status.status})`,
  );

  console.log('\n[open a guest session]');
  const alice = new Client();
  const signIn = await alice.request<{ user?: { id: string } }>(
    'POST',
    '/api/auth/sign-in/anonymous',
  );
  check(
    signIn.status === 200 && !!signIn.body?.user?.id,
    `guest session opened (${signIn.status})`,
  );
  const again = await alice.request('POST', '/api/auth/sign-in/anonymous');
  check(
    again.status === 400,
    `a guest cannot open a second guest session (${again.status})`,
  );

  const me = await alice.request<{
    user: { isGuest: boolean };
    usage: { dailyBudgetUsd: number | null };
    guest: { expiresAt: string } | null;
  }>('GET', '/api/me');
  check(
    me.status === 200 && me.body.user.isGuest === true,
    `GET /api/me marks the guest (${me.status})`,
  );
  const expiresAt = me.body.guest ? Date.parse(me.body.guest.expiresAt) : NaN;
  const expectedMs = status.body.guestTtlHours * 60 * 60 * 1000;
  check(
    Math.abs(expiresAt - (stamp + expectedMs)) < 5 * 60 * 1000,
    `guest expires in ${status.body.guestTtlHours} h (${me.body.guest?.expiresAt})`,
  );
  check(
    me.body.usage.dailyBudgetUsd === status.body.guestDailyBudgetUsd,
    `guest gets the demo budget ($${me.body.usage.dailyBudgetUsd})`,
  );

  const starting = await alice.request<{ total: number }>(
    'GET',
    '/api/documents',
  );
  console.log(
    `  info guest started with ${starting.body.total} document(s) copied from the demo template`,
  );

  console.log('\n[guest restrictions]');
  const providers = await alice.request<{
    byokEnabled: boolean;
    byokDisabledReason: string | null;
  }>('GET', '/api/providers');
  check(
    providers.status === 200 &&
      providers.body.byokEnabled === false &&
      providers.body.byokDisabledReason === 'guest',
    `providers list says keys are off for guests (${providers.body.byokDisabledReason})`,
  );
  const saveKey = await alice.request('PUT', '/api/providers/openai/key', {
    apiKey: 'sk-demo-guest-test-not-a-real-key',
  });
  check(
    saveKey.status === 403,
    `guest cannot store a provider key (${saveKey.status})`,
  );
  const apiKey = await alice.request('POST', '/api/auth/api-key/create', {
    name: `guest ${stamp}`,
  });
  check(
    apiKey.status === 403,
    `guest cannot create an API key (${apiKey.status})`,
  );

  console.log('\n[two guests are isolated]');
  const created = await alice.request<{ id: string }>(
    'POST',
    '/api/documents',
    {
      title: `Guest notes ${stamp}`,
      content: 'The demo passphrase of this guest is JUNIPER-7.',
    },
  );
  check(created.status === 201, `guest created a document (${created.status})`);
  const documentId = created.body?.id;

  const bob = new Client();
  const bobSignIn = await bob.request('POST', '/api/auth/sign-in/anonymous');
  check(bobSignIn.status === 200, `second guest opened (${bobSignIn.status})`);
  const bobGet = await bob.request('GET', `/api/documents/${documentId}`);
  check(
    bobGet.status === 404,
    `second guest GET first guest's document -> ${bobGet.status}`,
  );
  const bobList = await bob.request<{ data: Array<{ id: string }> }>(
    'GET',
    '/api/documents?limit=100',
  );
  check(
    bobList.status === 200 &&
      bobList.body.data.every((doc) => doc.id !== documentId),
    "second guest's list doesn't include it",
  );

  console.log('\n[end the demo]');
  if (documentId) {
    await alice.request('DELETE', `/api/documents/${documentId}`);
  }
  const signOut = await alice.request('POST', '/api/auth/sign-out', {});
  check(signOut.status === 200, `guest signed out (${signOut.status})`);
  const afterSignOut = await alice.request('GET', '/api/me');
  check(
    afterSignOut.status === 401,
    `the guest session no longer works (${afterSignOut.status})`,
  );

  const failures = failureCount();
  console.log(
    failures === 0
      ? '\nDemo guest test passed'
      : `\nDemo guest test FAILED (${failures} check(s))`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('Demo guest test crashed:', error);
  process.exit(1);
});
