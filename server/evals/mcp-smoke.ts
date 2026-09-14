/**
 * MCP smoke test: talks to the running API over Streamable HTTP like a real
 * MCP client would (Claude Code, Claude Desktop, MCP Inspector).
 *
 *   npm run mcp:smoke              # full run (needs an LLM key for ask_documents)
 *   npm run mcp:smoke -- --skip-llm
 *   MCP_URL=http://host:4000/api/mcp npm run mcp:smoke
 */
import {
  Client,
  StreamableHTTPClientTransport,
} from '@modelcontextprotocol/client';

const MCP_URL = process.env.MCP_URL ?? 'http://localhost:4000/api/mcp';
const SKIP_LLM = process.argv.includes('--skip-llm');
const READY_TIMEOUT_MS = 20_000;

const FIXTURE_TITLE = `MCP smoke fixture ${new Date().toISOString()}`;
const FIXTURE_CONTENT = `# Zephyr Kite Rentals

Zephyr Kite Rentals is a fictional shop on Pärnu beach. It opens at 09:30 and closes at 20:00 in summer.
A two-hour kite rental costs 18 euro; a full day costs 45 euro. The shop manager is Liis Kask.
Lessons for beginners run every Saturday at 11:00 and last 90 minutes.`;

interface ToolCallResult {
  content?: Array<{ type: string; text?: string }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

let failures = 0;

const check = (condition: unknown, message: string): void => {
  if (condition) {
    console.log(`  ok   ${message}`);
  } else {
    failures++;
    console.log(`  FAIL ${message}`);
  }
};

const textOf = (result: ToolCallResult): string =>
  (result.content ?? [])
    .filter((c) => c.type === 'text' && typeof c.text === 'string')
    .map((c) => c.text as string)
    .join('\n');

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main(): Promise<void> {
  console.log(`Connecting to ${MCP_URL}`);
  const client = new Client({
    name: 'mini-ai-toolkit-smoke',
    version: '1.0.0',
  });
  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL));
  await client.connect(transport);
  console.log('Connected');

  const call = async (
    name: string,
    args: Record<string, unknown> = {},
  ): Promise<ToolCallResult> =>
    (await client.callTool({ name, arguments: args })) as ToolCallResult;

  let documentId: string | undefined;

  try {
    console.log('\n[tools/list]');
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    console.log(`  ${names.join(', ')}`);
    for (const expected of [
      'generate_image',
      'generate_text',
      'search_documents',
      'ask_documents',
      'list_documents',
      'add_document',
      'delete_document',
      'list_generations',
      'get_generation',
    ]) {
      check(names.includes(expected), `tool ${expected} is listed`);
    }

    console.log('\n[add_document]');
    const added = await call('add_document', {
      title: FIXTURE_TITLE,
      content: FIXTURE_CONTENT,
    });
    check(
      !added.isError,
      `add_document succeeded: ${textOf(added).slice(0, 100)}`,
    );
    documentId = added.structuredContent?.id as string | undefined;
    check(
      typeof documentId === 'string',
      `returned document id ${documentId ?? '(none)'}`,
    );

    console.log('\n[list_documents] waiting for READY');
    const startedAt = Date.now();
    let status: string | undefined;
    while (Date.now() - startedAt < READY_TIMEOUT_MS) {
      const listed = await call('list_documents');
      const documents = (listed.structuredContent?.documents ?? []) as Array<{
        id: string;
        status: string;
        chunkCount: number;
      }>;
      const mine = documents.find((d) => d.id === documentId);
      status = mine?.status;
      if (status === 'READY' || status === 'FAILED') {
        console.log(
          `  status ${status} with ${mine?.chunkCount ?? 0} chunks after ${Date.now() - startedAt}ms`,
        );
        break;
      }
      await sleep(1000);
    }
    check(
      status === 'READY',
      `document indexed (status ${status ?? 'unknown'})`,
    );

    console.log('\n[search_documents]');
    const searched = await call('search_documents', {
      query: 'How much does a full day kite rental cost?',
      topK: 3,
      documentIds: documentId ? [documentId] : undefined,
    });
    const passages = (searched.structuredContent?.passages ?? []) as Array<{
      document: string;
      content: string;
    }>;
    check(
      !searched.isError && passages.length > 0,
      `returned ${passages.length} passage(s)`,
    );
    check(
      passages.some((p) => p.content.includes('45 euro')),
      'top passages contain the answer ("45 euro")',
    );

    console.log('\n[resources]');
    const { resources } = await client.listResources();
    const mineResource = resources.find(
      (r) => r.uri === `document://${documentId}`,
    );
    check(!!mineResource, `document://${documentId} listed as a resource`);
    if (mineResource) {
      const read = await client.readResource({ uri: mineResource.uri });
      const text = read.contents
        .map((c) => ('text' in c ? String(c.text) : ''))
        .join('');
      check(
        text.includes('Liis Kask'),
        'resource read returns the document text',
      );
    }

    if (SKIP_LLM) {
      console.log('\n[ask_documents] skipped (--skip-llm)');
    } else {
      console.log('\n[ask_documents]');
      const asked = await call('ask_documents', {
        question:
          'Who manages Zephyr Kite Rentals and what does a full day rental cost?',
        documentIds: documentId ? [documentId] : undefined,
      });
      const answer = textOf(asked);
      console.log(`  ${answer.replace(/\n/g, '\n  ').slice(0, 600)}`);
      check(!asked.isError, 'ask_documents succeeded');
      check(
        /Liis Kask/.test(answer) && /45/.test(answer),
        'answer mentions the manager and the price',
      );
      check(/\[\d+\]/.test(answer), 'answer contains citations like [1]');
    }

    console.log('\n[list_generations]');
    const generations = await call('list_generations', { limit: 3 });
    check(
      !generations.isError &&
        typeof generations.structuredContent?.total === 'number',
      `listed (total ${String(generations.structuredContent?.total)})`,
    );
  } finally {
    if (documentId) {
      console.log('\n[delete_document] cleanup');
      const deleted = await call('delete_document', { id: documentId });
      check(!deleted.isError, 'fixture document deleted');
    }
    await client.close();
  }

  console.log(
    failures === 0
      ? '\nMCP smoke test passed'
      : `\nMCP smoke test FAILED (${failures} check(s))`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error('MCP smoke test crashed:', error);
  process.exit(1);
});
