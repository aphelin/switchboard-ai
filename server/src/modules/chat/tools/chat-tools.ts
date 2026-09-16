import { tool, type ToolApprovalStatus } from 'ai';
import { z } from 'zod';
import { RetrievalService } from '../../documents/services/retrieval.service';
import { DocumentsService } from '../../documents/services/documents.service';
import { GenerationService } from '../../generation/services/generation.service';
import {
  ATTACHMENT_FILE_ID,
  type ChatAttachmentsService,
} from '../services/chat-attachments.service';
import { CHAT, RAG } from '../../../shared/constants/app.constants';
import { GenerationType, JobPriority, JobStatus } from 'generated/prisma/enums';
import type { SearchToolOutput } from '../types/chat.types';

export interface ChatToolsDeps {
  retrieval: RetrievalService;
  documents: DocumentsService;
  generations: GenerationService;
  /** Images attached in this conversation, for edit_image. Absent outside the interactive chat. */
  attachments?: ChatAttachmentsService;
  /** The conversation the tools run in; attachments are only looked up inside it. */
  conversationId?: string;
  /** Owner of the conversation, taken from the session. Never a tool input the model can set. */
  userId: string;
  /** Restrict searches to these documents (undefined = all of the user's documents). */
  documentIds?: string[];
  /** The user switched documents off for this conversation: no search tools. */
  documentsDisabled?: boolean;
  traceId?: string;
}

const GENERATION_STATUSES = Object.values(JobStatus) as [
  JobStatus,
  ...JobStatus[],
];
const GENERATION_TYPES = Object.values(GenerationType) as [
  GenerationType,
  ...GenerationType[],
];

/** Tools that require explicit user approval before they run (human-in-the-loop). */
export const CHAT_TOOL_APPROVAL: Record<string, ToolApprovalStatus> = {
  generate_image: 'user-approval',
  edit_image: 'user-approval',
};

/**
 * The agent's tools. Each one is a thin, typed wrapper over an existing
 * service, so the model can only do what the API already allows, with the
 * same validation, limits and per-user scoping.
 */
export function buildChatTools(deps: ChatToolsDeps) {
  const { userId } = deps;

  const search_documents = tool({
    description:
      "Search the user's uploaded documents (semantic + keyword search). Returns the most relevant passages with a ref number to cite. Use it for any question that might be answered by the documents.",
    inputSchema: z.object({
      query: z
        .string()
        .min(1)
        .max(500)
        .describe('A focused natural-language search query'),
      topK: z
        .number()
        .int()
        .min(1)
        .max(10)
        .optional()
        .describe(`How many passages to return (default ${RAG.TOP_K})`),
    }),
    execute: async ({ query, topK }): Promise<SearchToolOutput> => {
      const results = await deps.retrieval.search({
        userId,
        query,
        topK,
        documentIds: deps.documentIds,
        traceId: deps.traceId,
      });
      return {
        query,
        scope: deps.documentIds?.length
          ? 'selected documents'
          : 'all documents',
        passages: results.map((result, i) => ({
          ref: i + 1,
          chunkId: result.chunkId,
          documentId: result.documentId,
          document: result.documentTitle,
          chunkIndex: result.chunkIndex,
          untrusted: result.flagged,
          content: result.content,
        })),
      };
    },
  });

  const list_documents = tool({
    description: 'List the documents that are indexed and available to search.',
    inputSchema: z.object({}),
    execute: async () => {
      const documents = await deps.documents.findReady(userId);
      return {
        documents: documents.map((doc) => ({
          id: doc.id,
          title: doc.title,
          chunks: doc.chunkCount,
          source: doc.source,
        })),
      };
    },
  });

  const list_generations = tool({
    description: 'List recent image/text generations made in the toolkit.',
    inputSchema: z.object({
      status: z.enum(GENERATION_STATUSES).optional(),
      type: z.enum(GENERATION_TYPES).optional(),
      limit: z.number().int().min(1).max(20).optional(),
    }),
    execute: async ({ status, type, limit }) => {
      const page = await deps.generations.findAll(userId, {
        status,
        type,
        page: 1,
        limit: limit ?? 5,
      });
      return {
        total: page.total,
        generations: page.data.map((gen) => ({
          id: gen.id,
          type: gen.type,
          status: gen.status,
          prompt: gen.prompt,
          imageUrl: gen.imageUrl,
          textResult: gen.textResult?.slice(0, 500),
          error: gen.error,
          createdAt: gen.createdAt,
        })),
      };
    },
  });

  const get_generation = tool({
    description: 'Get one generation by id, including its result.',
    inputSchema: z.object({ id: z.uuid() }),
    execute: async ({ id }) => {
      const gen = await deps.generations.findOne(userId, id);
      return {
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
    },
  });

  const generate_image = tool({
    description:
      'Generate an image with the toolkit image pipeline. The user must approve the call. Waits for the result and returns the image URL. Write a detailed, visual prompt.',
    inputSchema: z.object({
      prompt: z.string().min(3).max(2000).describe('Detailed image prompt'),
      model: z
        .string()
        .max(120)
        .optional()
        .describe(
          'Image model id, e.g. "platform:flux" (default) or "google:gemini-3.1-flash-image". Only set it when the user asks for a specific model.',
        ),
      width: z.number().int().min(256).max(2048).optional(),
      height: z.number().int().min(256).max(2048).optional(),
      seed: z
        .number()
        .int()
        .optional()
        .describe('Seed for reproducible output'),
    }),
    execute: async (
      { prompt, model, width, height, seed },
      { abortSignal },
    ) => {
      const created = await deps.generations.create(userId, {
        prompt,
        type: GenerationType.IMAGE,
        enhance: false,
        priority: JobPriority.HIGH,
        parameters: { model, width, height, seed },
      });
      let final = await deps.generations.waitForTerminalStatus(
        userId,
        created.id,
        CHAT.TOOL_WAIT_TIMEOUT_MS,
        abortSignal,
      );
      // The user pressed stop: the job they approved is cancelled rather than left running unseen.
      if (
        abortSignal?.aborted &&
        (final.status === JobStatus.PENDING ||
          final.status === JobStatus.GENERATING)
      ) {
        final = await deps.generations
          .cancel(userId, created.id)
          .catch(() => final);
      }
      return {
        generationId: final.id,
        status: final.status,
        imageUrl: final.imageUrl,
        error: final.error,
        note:
          final.status === JobStatus.COMPLETED
            ? undefined
            : 'The generation has not completed yet; the user can follow it on the History page.',
      };
    },
  });

  /** An image attached in this conversation, saved as one of the user's finished images; returns its generation id. */
  const importAttachment = async (attachmentId: string): Promise<string> => {
    const file =
      deps.attachments && deps.conversationId
        ? await deps.attachments.readForEdit(deps.conversationId, attachmentId)
        : null;
    if (!file) {
      throw new Error(
        `Attached image ${attachmentId} was not found in this conversation`,
      );
    }
    const imported = await deps.generations.importImage(userId, {
      attachmentKey: file.key,
      data: file.data,
      contentType: file.contentType,
    });
    return imported.id;
  };

  const edit_image = tool({
    description:
      "Change an image with a text instruction (image-to-image). The user must approve the call. Waits for the result and returns the new image URL. Pass exactly one source: attachmentId for an image the user attached in this chat (shown as [Attached image id: ...] before it), or generationId for one of the user's finished generations (find it with list_generations). Never invent an id. Write the instruction as what should change.",
    inputSchema: z.object({
      generationId: z
        .uuid()
        .optional()
        .describe("Id of one of the user's finished image generations"),
      attachmentId: z
        .string()
        .regex(ATTACHMENT_FILE_ID)
        .optional()
        .describe(
          'Id of an image attached in this chat, exactly as written in [Attached image id: ...]',
        ),
      prompt: z
        .string()
        .min(3)
        .max(2000)
        .describe('What to change, e.g. "make it night and add rain"'),
      model: z
        .string()
        .max(120)
        .optional()
        .describe(
          'An image model that can edit (capabilities.edit). Only set it when the user asks for a specific model; the default is the included editing model.',
        ),
    }),
    execute: async (
      { generationId, attachmentId, prompt, model },
      { abortSignal },
    ) => {
      if (!generationId === !attachmentId) {
        throw new Error('Pass exactly one of generationId or attachmentId');
      }
      const sourceGenerationId =
        generationId ?? (await importAttachment(attachmentId!));
      const created = await deps.generations.create(userId, {
        prompt,
        type: GenerationType.IMAGE,
        enhance: false,
        priority: JobPriority.HIGH,
        parameters: { model, sourceGenerationId },
      });
      let final = await deps.generations.waitForTerminalStatus(
        userId,
        created.id,
        CHAT.TOOL_WAIT_TIMEOUT_MS,
        abortSignal,
      );
      if (
        abortSignal?.aborted &&
        (final.status === JobStatus.PENDING ||
          final.status === JobStatus.GENERATING)
      ) {
        final = await deps.generations
          .cancel(userId, created.id)
          .catch(() => final);
      }
      return {
        generationId: final.id,
        sourceGenerationId,
        status: final.status,
        imageUrl: final.imageUrl,
        error: final.error,
        note:
          final.status === JobStatus.COMPLETED
            ? undefined
            : 'The edit has not completed yet; the user can follow it on the History page.',
      };
    },
  });

  const generationTools = {
    list_generations,
    get_generation,
    generate_image,
    edit_image,
  };
  // With documents switched off the model never sees the search tools, so it cannot reach them.
  if (deps.documentsDisabled) return generationTools;

  return {
    search_documents,
    list_documents,
    ...generationTools,
  };
}

export type ChatTools = ReturnType<typeof buildChatTools>;
