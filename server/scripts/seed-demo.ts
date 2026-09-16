/**
 * Fills the demo template account through the real API, on the included models:
 * documents are chunked and embedded, images and a text generation run through
 * the queue, and the agent answers from the documents. Every new guest starts
 * with a copy, so everything a guest sees (traces included) really happened.
 *
 *   DEMO_TEMPLATE_EMAIL=demo@example.com npm run demo:seed
 *   DEMO_TEMPLATE_EMAIL=demo@example.com DEMO_TEMPLATE_PASSWORD=... npm run demo:seed -- --skip-llm
 *
 * The API must be running (API_URL, default http://localhost:4000) with the same
 * DEMO_TEMPLATE_EMAIL. Without DEMO_TEMPLATE_PASSWORD the account is created with
 * a generated password, printed once. Steps already done are skipped, so it is
 * safe to re-run. --skip-llm only indexes documents (local embeddings, no cost).
 */
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { API_URL, Client, sleep } from '../evals/e2e-client';

const SKIP_LLM = process.argv.includes('--skip-llm');
const FIXTURES_DIR = join(__dirname, '..', 'evals', 'fixtures');
const POLL_MS = 1500;
const DOCUMENTS_TIMEOUT_MS = 120_000;
const GENERATIONS_TIMEOUT_MS = 300_000;

/** The injection test document is included on purpose: the agent should ignore the instruction inside it. */
const DOCUMENT_FILES = [
  'nimbus-vault-runbook.md',
  'acme-cloud-faq.md',
  'remote-work-policy.md',
  'injection-test.md',
];

const GENERATIONS = [
  {
    type: 'IMAGE',
    priority: 'HIGH',
    prompt:
      'A red lighthouse on a rocky shore at sunrise, warm light, long exposure',
  },
  {
    type: 'IMAGE',
    priority: 'NORMAL',
    enhance: true,
    prompt: 'A small data centre hidden in a pine forest, morning fog',
  },
  {
    type: 'IMAGE',
    priority: 'NORMAL',
    prompt:
      'Macro photo of moss and tiny mushrooms growing on an old circuit board',
  },
  {
    type: 'IMAGE',
    priority: 'LOW',
    prompt: 'Tallinn old town street at dusk, rain on cobblestones, film photo',
  },
  {
    type: 'TEXT',
    priority: 'NORMAL',
    prompt:
      'Write a four-line status update for customers: object storage in Frankfurt had elevated error rates for 12 minutes and no data was lost.',
  },
];

/** The last one asks for an image, so the copy shows the agent waiting for approval. */
const CHAT_QUESTIONS = [
  'According to the Nimbus Vault runbook, what must on-call check before freezing a storage cluster? Cite the passage.',
  'Where are the Acme Cloud offices, and how do visitors get access?',
  'Generate an image of a minimal flat icon for Nimbus Vault: a cloud with a small padlock.',
];

interface Page<T> {
  data: T[];
  total: number;
}

const TERMINAL = new Set(['COMPLETED', 'FAILED', 'CANCELLED']);

function fail(message: string): never {
  console.error(`\n${message}`);
  process.exit(1);
}

async function signIn(client: Client, email: string): Promise<string | null> {
  const given = process.env.DEMO_TEMPLATE_PASSWORD;
  if (given) {
    const res = await client.request('POST', '/api/auth/sign-in/email', {
      email,
      password: given,
    });
    if (res.status === 200) return null;
  }

  const password = given ?? `demo-${randomUUID()}`;
  const res = await client.request('POST', '/api/auth/sign-up/email', {
    name: 'Switchboard demo',
    email,
    password,
  });
  if (res.status !== 200) {
    fail(
      `Could not sign in or create ${email} (${res.status}). If the account exists, set DEMO_TEMPLATE_PASSWORD.`,
    );
  }
  return given ? null : password;
}

async function seedDocuments(client: Client): Promise<void> {
  console.log('\n[documents]');
  const list = await client.request<Page<{ id: string; title: string }>>(
    'GET',
    '/api/documents?limit=100',
  );
  const existing = new Set(list.body.data.map((doc) => doc.title));

  for (const file of DOCUMENT_FILES) {
    const content = await readFile(join(FIXTURES_DIR, file), 'utf8');
    const title = content.split('\n')[0].replace(/^#\s*/, '').trim();
    if (existing.has(title)) {
      console.log(`  skip  ${title}`);
      continue;
    }
    const res = await client.request('POST', '/api/documents', {
      title,
      content,
    });
    if (res.status !== 201) fail(`Could not create "${title}" (${res.status})`);
    console.log(`  added ${title}`);
  }

  const deadline = Date.now() + DOCUMENTS_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const docs = await client.request<Page<{ status: string }>>(
      'GET',
      '/api/documents?limit=100',
    );
    const pending = docs.body.data.filter(
      (doc) => doc.status !== 'READY' && doc.status !== 'FAILED',
    );
    if (pending.length === 0) {
      console.log(`  ${docs.body.total} document(s) indexed`);
      return;
    }
    await sleep(POLL_MS);
  }
  fail('Documents did not finish indexing in time');
}

async function seedGenerations(client: Client): Promise<void> {
  console.log('\n[generations]');
  const list = await client.request<
    Page<{ id: string; prompt: string; status: string }>
  >('GET', '/api/generations?limit=100');
  const done = new Set(
    list.body.data
      .filter((gen) => gen.status === 'COMPLETED' || !TERMINAL.has(gen.status))
      .map((gen) => gen.prompt),
  );

  const queued: string[] = [];
  for (const generation of GENERATIONS) {
    if (done.has(generation.prompt)) {
      console.log(`  skip  ${generation.prompt.slice(0, 60)}`);
      continue;
    }
    const res = await client.request<{ id: string }>(
      'POST',
      '/api/generations',
      generation,
    );
    if (res.status !== 201) {
      fail(
        `Could not queue a generation (${res.status}): ${JSON.stringify(res.body)}`,
      );
    }
    queued.push(res.body.id);
    console.log(`  queued ${generation.type} ${generation.priority}`);
  }

  // One list request per round instead of one per generation keeps the script under the rate limit.
  const deadline = Date.now() + GENERATIONS_TIMEOUT_MS;
  const open = new Set(queued);
  while (open.size > 0 && Date.now() < deadline) {
    const res = await client.request<
      Page<{ id: string; status: string; error?: string | null }>
    >('GET', '/api/generations?limit=100');
    for (const generation of res.body.data ?? []) {
      if (!open.has(generation.id) || !TERMINAL.has(generation.status))
        continue;
      open.delete(generation.id);
      console.log(
        `  ${generation.status.toLowerCase()} ${generation.id}${generation.error ? `: ${generation.error}` : ''}`,
      );
    }
    if (open.size > 0) await sleep(POLL_MS);
  }
  if (open.size > 0) fail(`${open.size} generation(s) did not finish in time`);
}

async function seedChats(client: Client): Promise<void> {
  console.log('\n[chat]');
  const list = await client.request<Page<unknown>>(
    'GET',
    '/api/chat/conversations?limit=100',
  );
  if (list.body.total > 0) {
    console.log(`  skip  ${list.body.total} conversation(s) already exist`);
    return;
  }

  for (const question of CHAT_QUESTIONS) {
    const conversationId = randomUUID();
    const res = await client.request('POST', '/api/chat', {
      id: conversationId,
      trigger: 'submit-message',
      messages: [
        {
          id: randomUUID(),
          role: 'user',
          parts: [{ type: 'text', text: question }],
        },
      ],
    });
    if (res.status !== 200) fail(`Chat failed (${res.status})`);

    // Guests get a copy of what was stored, so an unsaved reply would copy as an unanswered question.
    let replied = false;
    for (let attempt = 0; attempt < 10 && !replied; attempt++) {
      const saved = await client.request<{
        messages?: Array<{ role: string }>;
      }>('GET', `/api/chat/conversations/${conversationId}`);
      replied = !!saved.body.messages?.some((m) => m.role === 'assistant');
      if (!replied) await sleep(500);
    }
    if (!replied)
      fail(`The reply to "${question.slice(0, 50)}…" was not saved`);
    console.log(`  asked ${question.slice(0, 60)}…`);
  }
}

async function main(): Promise<void> {
  const email = process.env.DEMO_TEMPLATE_EMAIL?.trim().toLowerCase();
  if (!email) fail('Set DEMO_TEMPLATE_EMAIL (the same value the API uses).');
  console.log(`Seeding demo template ${email} via ${API_URL}`);

  const client = new Client();
  const generatedPassword = await signIn(client, email);

  await seedDocuments(client);
  if (SKIP_LLM) {
    console.log('\n[generations, chat] skipped (--skip-llm)');
  } else {
    await seedGenerations(client);
    await seedChats(client);
  }

  console.log('\nDemo template ready: new guests start with a copy of it.');
  if (generatedPassword) {
    console.log(
      `Created the account with password ${generatedPassword}\nKeep it (DEMO_TEMPLATE_PASSWORD) to re-run this script or sign in and curate the demo.`,
    );
  }
}

main().catch((error) => {
  console.error('Demo seed crashed:', error);
  process.exit(1);
});
