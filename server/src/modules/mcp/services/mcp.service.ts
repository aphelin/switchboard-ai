import { Injectable, Logger } from '@nestjs/common';
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/server';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { GenerationService } from '../../generation/services/generation.service';
import { DocumentsService } from '../../documents/services/documents.service';
import { RetrievalService } from '../../documents/services/retrieval.service';
import { ChatService } from '../../chat/services/chat.service';
import { ImageModel } from '../../../shared/constants/models.constants';
import {
  DEFAULT_IMAGE_MODEL,
  RAG,
} from '../../../shared/constants/app.constants';
import { SEARCH_MODES } from '../../documents/dto/search-documents.dto';
import { GenerationType, JobPriority, JobStatus } from 'generated/prisma/enums';
import type { SearchMode } from '../../documents/types/documents.types';

export const MCP_SERVER_INFO = {
  name: 'mini-ai-toolkit',
  version: '1.0.0',
} as const;

/** How long a generation tool waits for the queued job before returning its current status. */
const GENERATION_WAIT_MS = 120_000;
const DOCUMENT_LIST_LIMIT = 50;

const IMAGE_MODELS = Object.values(ImageModel) as [ImageModel, ...ImageModel[]];
const GENERATION_STATUSES = Object.values(JobStatus) as [
  JobStatus,
  ...JobStatus[],
];
const GENERATION_TYPES = Object.values(GenerationType) as [
  GenerationType,
  ...GenerationType[],
];
const MODES = SEARCH_MODES as [SearchMode, ...SearchMode[]];

interface ToolResult {
  [key: string]: unknown;
  content: Array<{ type: 'text'; text: string }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

const ok = (
  text: string,
  structuredContent?: Record<string, unknown>,
): ToolResult => ({
  content: [{ type: 'text', text }],
  structuredContent,
});

/** MCP convention: tool failures are results with isError, not protocol errors. */
const fail = (error: unknown): ToolResult => ({
  isError: true,
  content: [
    {
      type: 'text',
      text: error instanceof Error ? error.message : String(error),
    },
  ],
});

const documentIdsSchema = z
  .array(z.uuid())
  .max(50)
  .optional()
  .describe('Restrict to these document ids (default: all indexed documents)');

/**
 * Exposes the toolkit to MCP clients (Claude Code, Claude Desktop, MCP Inspector).
 * Every tool is a thin, typed wrapper over an existing service, so an agent can
 * only do what the HTTP API already allows, with the same validation, limits
 * and per-user scoping. The user is the owner of the API key used to connect.
 */
@Injectable()
export class McpService {
  private readonly logger = new Logger(McpService.name);

  constructor(
    private readonly generations: GenerationService,
    private readonly documents: DocumentsService,
    private readonly retrieval: RetrievalService,
    private readonly chat: ChatService,
  ) {}

  /** Builds a fresh server bound to one user; stateless transports use one per request. */
  createServer(userId: string): McpServer {
    const server = new McpServer(MCP_SERVER_INFO, {
      instructions:
        'Mini AI Toolkit: generate images/text through an async job pipeline and search or ask questions over uploaded documents (RAG). ' +
        'Use ask_documents for questions that documents may answer; use search_documents for raw passages.',
    });

    this.registerGenerationTools(server, userId);
    this.registerDocumentTools(server, userId);
    this.registerDocumentResource(server, userId);

    return server;
  }

  private registerGenerationTools(server: McpServer, userId: string): void {
    server.registerTool(
      'generate_image',
      {
        title: 'Generate image',
        description:
          'Generate an image with the toolkit image pipeline (queued job). Waits up to 2 minutes and returns the image URL. Write a detailed, visual prompt.',
        inputSchema: z.object({
          prompt: z
            .string()
            .min(1)
            .max(5000)
            .describe('Detailed visual description of the image'),
          model: z
            .enum(IMAGE_MODELS)
            .optional()
            .describe(`Image model id (default "${DEFAULT_IMAGE_MODEL}")`),
          width: z
            .number()
            .int()
            .min(256)
            .max(2048)
            .optional()
            .describe('Width in pixels'),
          height: z
            .number()
            .int()
            .min(256)
            .max(2048)
            .optional()
            .describe('Height in pixels'),
          seed: z
            .number()
            .int()
            .optional()
            .describe('Seed for reproducible output'),
          enhance: z
            .boolean()
            .optional()
            .describe(
              'Let the toolkit rewrite the prompt with an LLM before generating (default false)',
            ),
        }),
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: true,
        },
      },
      async ({ prompt, model, width, height, seed, enhance }) => {
        try {
          const created = await this.generations.create(userId, {
            prompt,
            type: GenerationType.IMAGE,
            enhance: enhance ?? false,
            priority: JobPriority.HIGH,
            parameters: { model, width, height, seed },
          });
          const final = await this.generations.waitForTerminalStatus(
            userId,
            created.id,
            GENERATION_WAIT_MS,
          );
          const structured = {
            id: final.id,
            status: final.status,
            imageUrl: final.imageUrl,
            enhancedPrompt: final.enhancedPrompt,
            error: final.error,
          };
          const text =
            final.status === JobStatus.COMPLETED
              ? `Image generated (id ${final.id}): ${final.imageUrl}`
              : `Generation ${final.id} is ${final.status}${final.error ? `: ${final.error}` : ' (still running; check get_generation later)'}`;
          return ok(text, structured);
        } catch (error) {
          return fail(error);
        }
      },
    );

    server.registerTool(
      'generate_text',
      {
        title: 'Generate text',
        description:
          'Generate text with the toolkit text pipeline (queued LLM job). Waits up to 2 minutes and returns the text.',
        inputSchema: z.object({
          prompt: z.string().min(1).max(5000).describe('The user prompt'),
          systemPrompt: z
            .string()
            .max(2000)
            .optional()
            .describe('Optional system instructions'),
          temperature: z
            .number()
            .min(0)
            .max(2)
            .optional()
            .describe('Sampling temperature'),
        }),
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: true,
        },
      },
      async ({ prompt, systemPrompt, temperature }) => {
        try {
          const created = await this.generations.create(userId, {
            prompt,
            type: GenerationType.TEXT,
            priority: JobPriority.HIGH,
            parameters: { systemPrompt, temperature },
          });
          const final = await this.generations.waitForTerminalStatus(
            userId,
            created.id,
            GENERATION_WAIT_MS,
          );
          const structured = {
            id: final.id,
            status: final.status,
            text: final.textResult,
            error: final.error,
          };
          const text =
            final.status === JobStatus.COMPLETED
              ? (final.textResult ?? '')
              : `Generation ${final.id} is ${final.status}${final.error ? `: ${final.error}` : ''}`;
          return ok(text, structured);
        } catch (error) {
          return fail(error);
        }
      },
    );

    server.registerTool(
      'list_generations',
      {
        title: 'List generations',
        description: 'List recent image/text generations, newest first.',
        inputSchema: z.object({
          status: z
            .enum(GENERATION_STATUSES)
            .optional()
            .describe('Filter by job status'),
          type: z
            .enum(GENERATION_TYPES)
            .optional()
            .describe('Filter by generation type'),
          limit: z
            .number()
            .int()
            .min(1)
            .max(50)
            .optional()
            .describe('Max results (default 10)'),
        }),
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      async ({ status, type, limit }) => {
        try {
          const page = await this.generations.findAll(userId, {
            status,
            type,
            page: 1,
            limit: limit ?? 10,
          });
          const generations = page.data.map((gen) => ({
            id: gen.id,
            type: gen.type,
            status: gen.status,
            prompt: gen.prompt,
            imageUrl: gen.imageUrl,
            textResult: gen.textResult?.slice(0, 300),
            error: gen.error,
            createdAt: gen.createdAt,
          }));
          const lines = generations.map(
            (g) =>
              `- ${g.id} [${g.type}/${g.status}] ${g.prompt.slice(0, 80)}${g.imageUrl ? ` -> ${g.imageUrl}` : ''}`,
          );
          return ok(
            `${page.total} generation(s) total, showing ${generations.length}:\n${lines.join('\n') || '(none)'}`,
            { total: page.total, generations },
          );
        } catch (error) {
          return fail(error);
        }
      },
    );

    server.registerTool(
      'get_generation',
      {
        title: 'Get generation',
        description:
          'Get one generation by id, including its result (image URL or text).',
        inputSchema: z.object({ id: z.uuid().describe('Generation id') }),
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      async ({ id }) => {
        try {
          const gen = await this.generations.findOne(userId, id);
          const structured = {
            id: gen.id,
            type: gen.type,
            status: gen.status,
            prompt: gen.prompt,
            enhancedPrompt: gen.enhancedPrompt,
            imageUrl: gen.imageUrl,
            textResult: gen.textResult,
            error: gen.error,
            parameters: gen.parameters,
            createdAt: gen.createdAt,
          };
          const result =
            gen.imageUrl ?? gen.textResult ?? gen.error ?? '(no result yet)';
          return ok(
            `${gen.type} generation ${gen.id} is ${gen.status}. Prompt: ${gen.prompt}\nResult: ${result}`,
            structured,
          );
        } catch (error) {
          return fail(error);
        }
      },
    );
  }

  private registerDocumentTools(server: McpServer, userId: string): void {
    server.registerTool(
      'search_documents',
      {
        title: 'Search documents',
        description:
          "Hybrid (semantic + keyword) search over the user's uploaded documents. Returns the most relevant passages with document title and chunk index.",
        inputSchema: z.object({
          query: z
            .string()
            .min(1)
            .max(1000)
            .describe('Natural-language search query'),
          topK: z
            .number()
            .int()
            .min(1)
            .max(20)
            .optional()
            .describe(`Passages to return (default ${RAG.TOP_K})`),
          documentIds: documentIdsSchema,
          mode: z
            .enum(MODES)
            .optional()
            .describe('Retrieval mode (default hybrid)'),
        }),
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      async ({ query, topK, documentIds, mode }) => {
        try {
          const results = await this.retrieval.search({
            userId,
            query,
            topK,
            documentIds,
            mode,
            traceId: `mcp:${randomUUID()}`,
          });
          const passages = results.map((r, i) => ({
            ref: i + 1,
            chunkId: r.chunkId,
            documentId: r.documentId,
            document: r.documentTitle,
            chunkIndex: r.chunkIndex,
            score: r.score,
            vectorScore: r.vectorScore,
            keywordScore: r.keywordScore,
            flagged: r.flagged,
            content: r.content,
          }));
          const text = passages.length
            ? passages
                .map(
                  (p) =>
                    `[${p.ref}] ${p.document} #${p.chunkIndex}${p.flagged ? ' (flagged: untrusted content)' : ''}\n${p.content}`,
                )
                .join('\n\n')
            : 'No matching passages found.';
          return ok(text, { query, mode: mode ?? 'hybrid', passages });
        } catch (error) {
          return fail(error);
        }
      },
    );

    server.registerTool(
      'ask_documents',
      {
        title: 'Ask the documents',
        description:
          "Answer a question from the user's uploaded documents (RAG). Returns a cited answer and the passages it relied on; says so when the documents do not contain the answer.",
        inputSchema: z.object({
          question: z
            .string()
            .min(1)
            .max(2000)
            .describe('The question to answer'),
          documentIds: documentIdsSchema,
        }),
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: false,
        },
      },
      async ({ question, documentIds }) => {
        try {
          const answer = await this.chat.answer({
            userId,
            question,
            documentIds,
            traceId: `mcp:${randomUUID()}`,
          });
          const sources = answer.sources.map((s) => ({
            ref: s.ref,
            document: s.document,
            documentId: s.documentId,
            chunkIndex: s.chunkIndex,
            untrusted: s.untrusted,
          }));
          const sourceLines = sources.map(
            (s) => `[${s.ref}] ${s.document} #${s.chunkIndex}`,
          );
          const text = sourceLines.length
            ? `${answer.text}\n\nSources:\n${sourceLines.join('\n')}`
            : answer.text;
          return ok(text, {
            answer: answer.text,
            sources,
            searches: answer.searches,
            steps: answer.steps,
            usage: answer.usage,
          });
        } catch (error) {
          return fail(error);
        }
      },
    );

    server.registerTool(
      'list_documents',
      {
        title: 'List documents',
        description:
          'List uploaded documents with their indexing status and chunk count.',
        inputSchema: z.object({}),
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      async () => {
        try {
          const page = await this.documents.findAll(userId, {
            page: 1,
            limit: DOCUMENT_LIST_LIMIT,
          });
          const documents = page.data.map((doc) => ({
            id: doc.id,
            title: doc.title,
            status: doc.status,
            chunkCount: doc.chunkCount,
            source: doc.source,
            error: doc.error,
            createdAt: doc.createdAt,
          }));
          const lines = documents.map(
            (d) =>
              `- ${d.id} "${d.title}" [${d.status}, ${d.chunkCount} chunks]`,
          );
          return ok(
            `${page.total} document(s):\n${lines.join('\n') || '(none)'}`,
            { total: page.total, documents },
          );
        } catch (error) {
          return fail(error);
        }
      },
    );

    server.registerTool(
      'add_document',
      {
        title: 'Add document',
        description:
          'Add a text document to the knowledge base. Indexing (chunking + embedding) runs asynchronously; poll list_documents until the status is READY before searching it.',
        inputSchema: z.object({
          title: z.string().min(1).max(200).describe('Document title'),
          content: z
            .string()
            .min(1)
            .max(RAG.MAX_DOCUMENT_CHARS)
            .describe('Plain text or markdown content'),
        }),
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: false,
        },
      },
      async ({ title, content }) => {
        try {
          const doc = await this.documents.create(
            userId,
            { title, content },
            { source: 'mcp' },
          );
          return ok(
            `Document "${doc.title}" created with id ${doc.id}; status ${doc.status}. Indexing runs in the background.`,
            { id: doc.id, title: doc.title, status: doc.status },
          );
        } catch (error) {
          return fail(error);
        }
      },
    );

    server.registerTool(
      'delete_document',
      {
        title: 'Delete document',
        description: 'Permanently delete a document and its index.',
        inputSchema: z.object({ id: z.uuid().describe('Document id') }),
        annotations: {
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      async ({ id }) => {
        try {
          await this.documents.remove(userId, id);
          return ok(`Document ${id} deleted.`, { id, deleted: true });
        } catch (error) {
          return fail(error);
        }
      },
    );
  }

  /** `document://{id}` resources expose the full text of the user's indexed documents. */
  private registerDocumentResource(server: McpServer, userId: string): void {
    const template = new ResourceTemplate('document://{id}', {
      list: async () => {
        const documents = await this.documents.findReady(userId);
        return {
          resources: documents.map((doc) => ({
            uri: `document://${doc.id}`,
            name: doc.title,
            description: `${doc.chunkCount} chunks${doc.source ? `, from ${doc.source}` : ''}`,
            mimeType: 'text/plain',
          })),
        };
      },
    });

    server.registerResource(
      'document',
      template,
      {
        title: 'Uploaded document',
        description: 'Full text of a document in the knowledge base',
        mimeType: 'text/plain',
      },
      async (uri, variables) => {
        const id = String(variables.id);
        const doc = await this.documents.findOne(userId, id);
        return {
          contents: [
            { uri: uri.href, mimeType: 'text/plain', text: doc.content },
          ],
        };
      },
    );
  }
}
