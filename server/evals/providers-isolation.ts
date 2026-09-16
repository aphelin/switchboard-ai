/**
 * Bring-your-own-key end-to-end check against a running API. Proves that:
 *   - the API never returns a provider key, only its last 4 characters
 *   - a stored key only ever serves its owner; other users get "Provider Key Required"
 *   - unknown models, unlisted platform models and bad key submissions are rejected
 *   - calls on a user's key are traced as keySource "user", with provider errors redacted
 *   - removing a key only affects the caller
 *
 *   npm run test:providers   # API running with CREDENTIALS_ENCRYPTION_KEY set (reads server/.env.development)
 *
 * No provider account is needed: Alice's key is a fake written straight into the
 * database exactly as the API stores it, so Anthropic rejects it, which exercises
 * the error path. Set E2E_ANTHROPIC_API_KEY to also save a real key through the API
 * and run one chat turn on it (a fraction of a cent on that key).
 * Creates throwaway accounts: point it at a dev or test database, never production.
 */
import { config } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { SecretBox } from '../src/shared/crypto/secret-box';
import { credentialContext } from '../src/modules/providers/utils/credential-context';
import {
  API_URL,
  Client,
  check,
  failureCount,
  sleep,
  type HttpResult,
} from './e2e-client';

config({ path: process.env.ENV_FILE ?? '.env.development', quiet: true });

const LIVE_ANTHROPIC_KEY = process.env.E2E_ANTHROPIC_API_KEY;
const HAIKU = 'anthropic:claude-haiku-4-5';
const NANO_BANANA = 'google:gemini-3.1-flash-image';
const TRACE_TIMEOUT_MS = 15_000;
const GENERATION_TIMEOUT_MS = 60_000;
const TERMINAL_STATUSES = ['COMPLETED', 'FAILED', 'CANCELLED'];
/** Polling stays well under the per-user limit of 30 requests a minute. */
const TRACE_POLL_MS = 2_500;

interface ProviderStatus {
  id: string;
  connected: boolean;
  keyHint: string | null;
  models: Array<{ id: string; pricing: unknown }>;
  imageModels?: Array<{ id: string; pricePerImageUsd: number | null }>;
}

interface ProvidersBody {
  byokEnabled: boolean;
  defaultModel: string;
  defaultImageModel?: string;
  providers: ProviderStatus[];
}

interface GenerationBody {
  id: string;
  status: string;
  error: string | null;
}

interface ErrorBody {
  error?: string;
  message?: string;
}

interface TraceCall {
  name: string;
  provider: string;
  keySource: string;
  status: string;
  error: string | null;
  costUsd: number | null;
}

interface MeBody {
  usage: { spentTodayUsd: number; ownKeysSpentTodayUsd: number };
}

/** Every key this run submitted or stored; no response may contain one. */
const secrets: string[] = [];

async function send<T = any>(
  client: Client,
  method: string,
  path: string,
  body?: unknown,
): Promise<HttpResult<T>> {
  const res = await client.request<T>(method, path, body);
  const raw =
    typeof res.body === 'string' ? res.body : JSON.stringify(res.body);
  if (secrets.some((secret) => raw.includes(secret))) {
    check(false, `${method} ${path} response contains a provider key`);
  }
  return res;
}

const anthropicOf = (body: ProvidersBody | undefined) =>
  body?.providers?.find((provider) => provider.id === 'anthropic');

const chatBody = (conversationId: string, model: string) => ({
  id: conversationId,
  trigger: 'submit-message',
  model,
  messages: [
    {
      id: `msg-${conversationId}`,
      role: 'user',
      parts: [{ type: 'text', text: 'Reply with the single word: ok' }],
    },
  ],
});

const isError = (res: HttpResult<ErrorBody>, error: string) =>
  res.status === 400 && res.body?.error === error;

async function signUp(
  client: Client,
  name: string,
  stamp: number,
  password: string,
): Promise<string> {
  const res = await send<{ user?: { id: string } }>(
    client,
    'POST',
    '/api/auth/sign-up/email',
    {
      name,
      email: `${name.toLowerCase()}+byok${stamp}@example.test`,
      password,
    },
  );
  check(
    res.status === 200 && !!res.body?.user?.id,
    `${name} signed up (${res.status})`,
  );
  return res.body?.user?.id ?? '';
}

/** Traces are written when a stream ends, slightly after the response. */
async function waitForCall(
  client: Client,
  traceId: string,
  match: (call: TraceCall) => boolean,
): Promise<TraceCall | undefined> {
  const deadline = Date.now() + TRACE_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const res = await send<{ data: TraceCall[] }>(
      client,
      'GET',
      `/api/traces?traceId=${encodeURIComponent(traceId)}`,
    );
    const call = res.body?.data?.find(match);
    if (call) return call;
    await sleep(TRACE_POLL_MS);
  }
  return undefined;
}

async function waitForGeneration(
  client: Client,
  id: string,
): Promise<GenerationBody | undefined> {
  const deadline = Date.now() + GENERATION_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const res = await send<GenerationBody>(
      client,
      'GET',
      `/api/generations/${id}`,
    );
    if (TERMINAL_STATUSES.includes(res.body?.status)) return res.body;
    await sleep(TRACE_POLL_MS);
  }
  return undefined;
}

async function main(): Promise<void> {
  const encryptionKey = process.env.CREDENTIALS_ENCRYPTION_KEY;
  const databaseUrl = process.env.DATABASE_URL;
  if (!encryptionKey || !databaseUrl) {
    throw new Error(
      'CREDENTIALS_ENCRYPTION_KEY and DATABASE_URL must be set to the values the running API uses',
    );
  }
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });

  const stamp = Date.now();
  const password = `e2e-${stamp}-Password!`;
  console.log(`Bring-your-own-key test against ${API_URL}`);

  try {
    console.log('\n[sign up two users]');
    const alice = new Client();
    const bob = new Client();
    const aliceId = await signUp(alice, 'Alice', stamp, password);
    await signUp(bob, 'Bob', stamp, password);

    console.log('\n[model catalog]');
    const catalog = await send<ProvidersBody>(alice, 'GET', '/api/providers');
    check(catalog.status === 200, `GET /api/providers (${catalog.status})`);
    check(
      catalog.body?.byokEnabled === true,
      'bring-your-own-key is enabled on the server',
    );
    check(
      catalog.body?.providers?.[0]?.id === 'platform' &&
        catalog.body.providers[0].connected,
      'included models work without a key',
    );
    check(
      anthropicOf(catalog.body)?.connected === false,
      'Anthropic starts disconnected',
    );
    check(
      anthropicOf(catalog.body)?.models.some(
        (model) => model.id === HAIKU && model.pricing,
      ),
      `${HAIKU} is listed with a price`,
    );
    const google = catalog.body?.providers?.find((p) => p.id === 'google');
    check(
      google?.imageModels?.some(
        (model) => model.id === NANO_BANANA && model.pricePerImageUsd,
      ),
      `${NANO_BANANA} is listed with a per-image price`,
    );
    check(
      catalog.body?.providers?.[0]?.imageModels?.some(
        (model) => model.id === catalog.body.defaultImageModel,
      ),
      `the default image model (${catalog.body?.defaultImageModel}) is an included model`,
    );

    console.log('\n[key submission]');
    const badProvider = await send(
      alice,
      'PUT',
      '/api/providers/mistral/key',
      { apiKey: 'x'.repeat(40) },
    );
    check(
      badProvider.status === 400,
      `unknown provider is rejected (${badProvider.status})`,
    );
    const tooShort = 'sk-ant-tiny9';
    secrets.push(tooShort);
    const shortKey = await send<ErrorBody>(
      alice,
      'PUT',
      '/api/providers/anthropic/key',
      { apiKey: tooShort },
    );
    check(
      shortKey.status === 400,
      `malformed key is rejected before calling the provider (${shortKey.status})`,
    );
    const rejectedKey = `sk-ant-api03-e2e-rejected-${stamp}-${'r'.repeat(48)}`;
    secrets.push(rejectedKey);
    const rejected = await send<ErrorBody>(
      alice,
      'PUT',
      '/api/providers/anthropic/key',
      { apiKey: rejectedKey },
    );
    if (rejected.status === 502) {
      console.log(
        '  skip Anthropic unreachable: cannot check how a rejected key is reported',
      );
    } else {
      check(
        isError(rejected, 'Invalid Provider Key'),
        `a key the provider rejects is not saved (${rejected.status} ${rejected.body?.error})`,
      );
    }
    const afterRejected = await send<ProvidersBody>(
      alice,
      'GET',
      '/api/providers',
    );
    check(
      anthropicOf(afterRejected.body)?.connected === false,
      'Anthropic is still disconnected',
    );

    console.log('\n[choosing a model without a key]');
    const noKeyChat = await send<ErrorBody>(
      bob,
      'POST',
      '/api/chat',
      chatBody(`byok-bob-${stamp}`, HAIKU),
    );
    check(
      isError(noKeyChat, 'Provider Key Required'),
      `chat on ${HAIKU} needs a key (${noKeyChat.status} ${noKeyChat.body?.error})`,
    );
    const unknown = await send<ErrorBody>(
      bob,
      'POST',
      '/api/chat',
      chatBody(`byok-bob-unknown-${stamp}`, 'anthropic:claude-9000'),
    );
    check(
      isError(unknown, 'Unknown Model'),
      `unknown model is rejected (${unknown.status})`,
    );
    const unlisted = await send<ErrorBody>(
      bob,
      'POST',
      '/api/chat',
      chatBody(`byok-bob-unlisted-${stamp}`, 'platform:openai/o3-pro'),
    );
    check(
      isError(unlisted, 'Unknown Model'),
      `a platform model that is not offered is rejected (${unlisted.status})`,
    );
    const noKeyText = await send<ErrorBody>(bob, 'POST', '/api/generations', {
      prompt: 'Say ok',
      type: 'TEXT',
      llmModel: HAIKU,
    });
    check(
      isError(noKeyText, 'Provider Key Required'),
      `text generation on ${HAIKU} needs a key (${noKeyText.status})`,
    );
    const noKeyImage = await send<ErrorBody>(bob, 'POST', '/api/generations', {
      prompt: 'A red lighthouse at sunrise',
      type: 'IMAGE',
      parameters: { model: NANO_BANANA },
    });
    check(
      isError(noKeyImage, 'Provider Key Required'),
      `image generation on ${NANO_BANANA} needs a key (${noKeyImage.status})`,
    );
    const retiredImage = await send<ErrorBody>(
      bob,
      'POST',
      '/api/generations',
      {
        prompt: 'A red lighthouse at sunrise',
        type: 'IMAGE',
        parameters: { model: 'seedream' },
      },
    );
    check(
      isError(retiredImage, 'Unknown Model'),
      `an image model Pollinations no longer offers is rejected (${retiredImage.status})`,
    );

    console.log('\n[a stored key only serves its owner]');
    const storedKey = `sk-ant-api03-e2e-stored-${stamp}-${'s'.repeat(48)}`;
    secrets.push(storedKey);
    const encryptedKey = SecretBox.fromBase64Key(encryptionKey).encrypt(
      storedKey,
      credentialContext(aliceId, 'anthropic'),
    );
    const keyHint = storedKey.slice(-4);
    await prisma.providerCredential.upsert({
      where: { userId_provider: { userId: aliceId, provider: 'anthropic' } },
      create: { userId: aliceId, provider: 'anthropic', encryptedKey, keyHint },
      update: { encryptedKey, keyHint },
    });

    const aliceCatalog = await send<ProvidersBody>(
      alice,
      'GET',
      '/api/providers',
    );
    check(
      anthropicOf(aliceCatalog.body)?.connected === true &&
        anthropicOf(aliceCatalog.body)?.keyHint === keyHint,
      'Alice sees Anthropic connected, with only the last 4 characters',
    );
    check(
      !JSON.stringify(aliceCatalog.body).includes('encryptedKey'),
      'the encrypted key is not returned either',
    );
    const bobCatalog = await send<ProvidersBody>(bob, 'GET', '/api/providers');
    check(
      anthropicOf(bobCatalog.body)?.connected === false &&
        anthropicOf(bobCatalog.body)?.keyHint === null,
      "Bob does not see Alice's key",
    );
    const bobSameModel = await send<ErrorBody>(
      bob,
      'POST',
      '/api/chat',
      chatBody(`byok-bob-same-${stamp}`, HAIKU),
    );
    check(
      isError(bobSameModel, 'Provider Key Required'),
      `Bob asking for the same model is not served by Alice's key (${bobSameModel.status})`,
    );
    const bobDelete = await send(bob, 'DELETE', '/api/providers/anthropic/key');
    check(bobDelete.status === 204, `Bob's delete is a no-op (${bobDelete.status})`);
    const row = await prisma.providerCredential.findUnique({
      where: { userId_provider: { userId: aliceId, provider: 'anthropic' } },
    });
    check(!!row, "Alice's key survives Bob's delete");
    check(
      !!row && !row.encryptedKey.includes(storedKey),
      'the database holds ciphertext, not the key',
    );

    console.log("\n[calls on Alice's key]");
    const conversationId = `byok-alice-${stamp}`;
    const aliceChat = await send<unknown>(
      alice,
      'POST',
      '/api/chat',
      chatBody(conversationId, HAIKU),
    );
    const streamed =
      typeof aliceChat.body === 'string'
        ? aliceChat.body
        : JSON.stringify(aliceChat.body);
    check(
      aliceChat.status === 200 && streamed.includes('rejected your API key'),
      `Anthropic's rejection of the fake key reaches Alice as a clear message (${aliceChat.status})`,
    );
    const failedCall = await waitForCall(
      alice,
      conversationId,
      (call) => call.name === 'chat.stream',
    );
    check(
      failedCall?.provider === 'anthropic' &&
        failedCall.keySource === 'user' &&
        failedCall.status === 'error',
      `traced as Anthropic on Alice's key (${failedCall?.provider}/${failedCall?.keySource}/${failedCall?.status})`,
    );
    const bobTraces = await send<{ data: TraceCall[] }>(
      bob,
      'GET',
      `/api/traces?traceId=${encodeURIComponent(conversationId)}`,
    );
    check(
      bobTraces.status === 200 && bobTraces.body.data.length === 0,
      "Bob can't see the trace",
    );

    console.log("\n[image generation on Alice's Google key]");
    const googleKey = `AIzaSyE2E${stamp}${'g'.repeat(24)}`;
    secrets.push(googleKey);
    const encryptedGoogleKey = SecretBox.fromBase64Key(encryptionKey).encrypt(
      googleKey,
      credentialContext(aliceId, 'google'),
    );
    await prisma.providerCredential.upsert({
      where: { userId_provider: { userId: aliceId, provider: 'google' } },
      create: {
        userId: aliceId,
        provider: 'google',
        encryptedKey: encryptedGoogleKey,
        keyHint: googleKey.slice(-4),
      },
      update: { encryptedKey: encryptedGoogleKey, keyHint: googleKey.slice(-4) },
    });
    const imageJob = await send<GenerationBody>(
      alice,
      'POST',
      '/api/generations',
      {
        prompt: 'A red lighthouse at sunrise',
        type: 'IMAGE',
        parameters: { model: NANO_BANANA, width: 1920, height: 1080 },
      },
    );
    check(
      imageJob.status === 201,
      `Alice can queue ${NANO_BANANA} with her key (${imageJob.status})`,
    );
    const imageResult = imageJob.body?.id
      ? await waitForGeneration(alice, imageJob.body.id)
      : undefined;
    check(
      imageResult?.status === 'FAILED' &&
        (imageResult.error ?? '').includes('Google Gemini'),
      `Google's rejection of the fake key fails the job with a clear error (${imageResult?.status}: ${imageResult?.error})`,
    );
    const imageCall = imageJob.body?.id
      ? await waitForCall(
          alice,
          imageJob.body.id,
          (call) => call.name === 'generation.image',
        )
      : undefined;
    check(
      imageCall?.provider === 'google' &&
        imageCall.keySource === 'user' &&
        imageCall.status === 'error',
      `traced as Google on Alice's key (${imageCall?.provider}/${imageCall?.keySource}/${imageCall?.status})`,
    );

    if (!LIVE_ANTHROPIC_KEY) {
      console.log(
        '\n[real key] skipped (set E2E_ANTHROPIC_API_KEY to run one real chat turn)',
      );
    } else {
      console.log('\n[real key]');
      secrets.push(LIVE_ANTHROPIC_KEY);
      const saved = await send<{ keyHint: string; warning: string | null }>(
        alice,
        'PUT',
        '/api/providers/anthropic/key',
        { apiKey: LIVE_ANTHROPIC_KEY },
      );
      check(
        saved.status === 200 &&
          saved.body.keyHint === LIVE_ANTHROPIC_KEY.slice(-4),
        `real key verified and saved (${saved.status})`,
      );
      const before = await send<MeBody>(alice, 'GET', '/api/me');
      const liveConversation = `byok-alice-live-${stamp}`;
      const liveChat = await send<unknown>(
        alice,
        'POST',
        '/api/chat',
        chatBody(liveConversation, HAIKU),
      );
      check(
        liveChat.status === 200 &&
          !JSON.stringify(liveChat.body).includes('"type":"error"'),
        `chat turn on the real key (${liveChat.status})`,
      );
      const okCall = await waitForCall(
        alice,
        liveConversation,
        (call) => call.name === 'chat.stream' && call.status === 'ok',
      );
      check(
        okCall?.keySource === 'user' && (okCall.costUsd ?? 0) > 0,
        `traced on Alice's key with a cost ($${okCall?.costUsd})`,
      );
      const after = await send<MeBody>(alice, 'GET', '/api/me');
      check(
        after.body.usage.spentTodayUsd === before.body.usage.spentTodayUsd,
        'the daily budget is untouched',
      );
      check(
        after.body.usage.ownKeysSpentTodayUsd >
          before.body.usage.ownKeysSpentTodayUsd,
        'the cost shows up as own-key spend',
      );
    }

    console.log('\n[remove the key]');
    const removed = await send(alice, 'DELETE', '/api/providers/anthropic/key');
    check(removed.status === 204, `Alice removed her key (${removed.status})`);
    const removedGoogle = await send(
      alice,
      'DELETE',
      '/api/providers/google/key',
    );
    check(
      removedGoogle.status === 204,
      `Alice removed her Google key (${removedGoogle.status})`,
    );
    const afterRemove = await send<ProvidersBody>(
      alice,
      'GET',
      '/api/providers',
    );
    check(
      anthropicOf(afterRemove.body)?.connected === false,
      'Anthropic is disconnected again',
    );
    const afterRemoveChat = await send<ErrorBody>(
      alice,
      'POST',
      '/api/chat',
      chatBody(`byok-alice-after-${stamp}`, HAIKU),
    );
    check(
      isError(afterRemoveChat, 'Provider Key Required'),
      `the removed key is no longer used (${afterRemoveChat.status})`,
    );
  } finally {
    await prisma.$disconnect();
  }

  const failures = failureCount();
  console.log(
    failures === 0
      ? '\nBring-your-own-key test passed'
      : `\nBring-your-own-key test FAILED (${failures} check(s))`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('Bring-your-own-key test crashed:', error);
  process.exit(1);
});
