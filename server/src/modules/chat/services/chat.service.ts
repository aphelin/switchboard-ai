import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  generateId,
  convertToModelMessages,
  isStepCount,
  pipeUIMessageStreamToResponse,
  toUIMessageStream,
  validateUIMessages,
  type UIMessage,
} from 'ai';
import { LlmService } from '../../llm/services/llm.service';
import { RetrievalService } from '../../documents/services/retrieval.service';
import { DocumentsService } from '../../documents/services/documents.service';
import { GenerationService } from '../../generation/services/generation.service';
import { BudgetService } from '../../auth/services/budget.service';
import { ModelRouterService } from '../../providers/services/model-router.service';
import { ChatRepository } from '../repositories/chat.repository';
import { ChatAttachmentsService } from './chat-attachments.service';
import type { ChatRequestDto } from '../dto/chat-request.dto';
import { QueryConversationsDto } from '../dto/query-conversations.dto';
import { buildChatTools, CHAT_TOOL_APPROVAL } from '../tools/chat-tools';
import {
  ASSISTANT_PROMPT_VERSION,
  buildAssistantInstructions,
} from '../prompts/assistant.prompt';
import { textOfMessage, trimHistory } from '../utils/history';
import { CHAT } from '../../../shared/constants/app.constants';
import { summarizeUsage, type ModelRoute } from '../../llm/types/llm.types';
import type {
  AnswerParams,
  AnswerResult,
  SearchToolOutput,
} from '../types/chat.types';

const TITLE_INSTRUCTIONS =
  'Write a short title (3 to 6 words) for a conversation that starts with the given message. Return only the title, without quotes.';

/**
 * The chat agent: a tool-calling loop over the LLM with RAG search, generation
 * lookups and an approval-gated image tool. Responses stream to the browser as
 * AI SDK UI message chunks (text deltas, tool calls, tool results).
 */
@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly llm: LlmService,
    private readonly retrieval: RetrievalService,
    private readonly documents: DocumentsService,
    private readonly generations: GenerationService,
    private readonly repository: ChatRepository,
    private readonly budget: BudgetService,
    private readonly router: ModelRouterService,
    private readonly attachments: ChatAttachmentsService,
  ) {}

  async stream(
    userId: string,
    dto: ChatRequestDto,
    res: Response,
    abortSignal?: AbortSignal,
  ): Promise<void> {
    const route = await this.routeFor(userId, dto.model);
    const conversation = await this.ensureConversation(userId, dto.id);
    const uiMessages = await validateUIMessages({ messages: dto.messages });
    // Attached images leave the messages here (stored, small URL left behind) before anything is persisted.
    await this.attachments.store(conversation.id, uiMessages);
    // "Pick" with nothing ticked means nothing is allowed, not everything.
    const documentsDisabled =
      dto.documentScope === 'none' ||
      (dto.documentScope === 'selected' && !dto.documentIds?.length);
    const documentIds =
      !documentsDisabled && dto.documentIds?.length
        ? dto.documentIds
        : undefined;

    // The user id comes from the session, never from the model: tools cannot be steered to another user's data.
    const tools = buildChatTools({
      retrieval: this.retrieval,
      documents: this.documents,
      generations: this.generations,
      attachments: this.attachments,
      conversationId: conversation.id,
      userId,
      documentIds,
      documentsDisabled,
      traceId: conversation.id,
    });

    const history = trimHistory(uiMessages, CHAT.MAX_CONTEXT_MESSAGES);
    // The model gets the attachment bytes inline: the provider cannot fetch URLs behind this user's session.
    const modelMessages = await convertToModelMessages(
      await this.attachments.inline(conversation.id, history),
      { tools, ignoreIncompleteToolCalls: true },
    );

    const result = this.llm.streamText({
      name: 'chat.stream',
      traceId: conversation.id,
      userId,
      metadata: {
        promptVersion: ASSISTANT_PROMPT_VERSION,
        documentIds,
        documentScope: dto.documentScope,
        modelChoice: dto.model,
      },
      route,
      model: 'main',
      instructions: buildAssistantInstructions({
        selectedDocuments: documentIds?.length ?? 0,
        documentsDisabled,
      }),
      // The system prompt and tool definitions are identical on every turn.
      cacheInstructions: true,
      messages: modelMessages,
      tools,
      toolApproval: CHAT_TOOL_APPROVAL,
      stopWhen: isStepCount(CHAT.MAX_STEPS),
      // Reaches running tools too: a stopped chat cancels the image job it was waiting on.
      abortSignal,
    });

    const stream = toUIMessageStream({
      stream: result.stream,
      tools,
      originalMessages: uiMessages,
      // Without this the reply's id is "", so every conversation's reply upserts into one shared row.
      generateMessageId: generateId,
      messageMetadata: ({ part }) =>
        part.type === 'start' ? { conversationId: conversation.id } : undefined,
      // Streamed to the browser: provider named, key problems explained, secrets masked.
      onError: (error) => this.llm.describeError(error, route),
      onEnd: async ({ messages, isAborted }) => {
        await this.persistMessages(conversation.id, messages);
        if (!isAborted && !conversation.title) {
          void this.generateTitle(userId, conversation.id, messages, route);
        }
      },
    });

    await pipeUIMessageStreamToResponse({ response: res, stream });
  }

  /**
   * Non-streaming question answering with the same prompt and search tool as
   * the chat (image generation excluded). Used by evals and the MCP server.
   */
  async answer(params: AnswerParams): Promise<AnswerResult> {
    const route = await this.routeFor(params.userId, params.model);

    const documentIds = params.documentIds?.length
      ? params.documentIds
      : undefined;
    const tools = buildChatTools({
      retrieval: this.retrieval,
      documents: this.documents,
      generations: this.generations,
      userId: params.userId,
      documentIds,
      traceId: params.traceId,
    });
    // No side effects without a human: the image tools are only available in the interactive chat.
    const readOnlyTools = Object.fromEntries(
      Object.entries(tools).filter(
        ([name]) => name !== 'generate_image' && name !== 'edit_image',
      ),
    );

    const result = await this.llm.generateText({
      name: 'chat.answer',
      traceId: params.traceId,
      userId: params.userId,
      metadata: {
        promptVersion: ASSISTANT_PROMPT_VERSION,
        modelChoice: params.model,
      },
      route,
      model: 'main',
      instructions: buildAssistantInstructions({
        selectedDocuments: documentIds?.length ?? 0,
      }),
      cacheInstructions: true,
      prompt: params.question,
      tools: readOnlyTools,
      stopWhen: isStepCount(CHAT.MAX_STEPS),
    });

    const searchOutputs = result.steps
      .flatMap((step) => step.toolResults)
      .filter((toolResult) => toolResult.toolName === 'search_documents')
      .map((toolResult) => toolResult.output as SearchToolOutput);

    return {
      text: result.text,
      sources: searchOutputs.flatMap((output) => output.passages),
      searches: searchOutputs.length,
      steps: result.steps.length,
      usage: summarizeUsage(result.totalUsage),
      model: this.llm.resolveModelId('main', route),
    };
  }

  /**
   * Validates the requested model (the agent needs tool calling) and picks the
   * key it runs on. Only calls on the app's key count toward the daily budget.
   */
  private async routeFor(
    userId: string,
    modelChoice: string | undefined,
  ): Promise<ModelRoute> {
    const route = await this.router.resolve(userId, modelChoice, {
      tools: true,
    });
    if (route.source === 'platform') {
      await this.budget.assertWithinBudget(userId);
    }
    return route;
  }

  listConversations(userId: string, query: QueryConversationsDto) {
    return this.repository.listConversations({
      userId,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });
  }

  async getConversation(userId: string, id: string) {
    const conversation = await this.findOwnedConversation(userId, id);
    const messages = await this.repository.getMessages(id);
    return { ...conversation, messages };
  }

  async deleteConversation(userId: string, id: string): Promise<void> {
    await this.findOwnedConversation(userId, id);
    await this.repository.deleteConversation(id);
  }

  /** Throws not-found unless the conversation is this user's (attachments are served through it). */
  async assertOwner(userId: string, id: string): Promise<void> {
    await this.findOwnedConversation(userId, id);
  }

  /** Reads never reveal whether another user's conversation exists. */
  private async findOwnedConversation(userId: string, id: string) {
    const conversation = await this.repository.findConversation(id);
    if (!conversation || conversation.userId !== userId) {
      throw new NotFoundException(`Conversation ${id} not found`);
    }
    return conversation;
  }

  private async ensureConversation(userId: string, id: string) {
    const existing = await this.repository.findConversation(id);
    if (!existing) return this.repository.createConversation(id, userId);

    // Conversation ids are generated by the client, so a request can name any id:
    // writing into someone else's conversation must be rejected explicitly.
    if (existing.userId !== userId) {
      throw new ForbiddenException('This conversation belongs to another user');
    }
    return existing;
  }

  private async persistMessages(
    conversationId: string,
    messages: UIMessage[],
  ): Promise<void> {
    try {
      await this.repository.upsertMessages(
        conversationId,
        // An empty id would upsert over another conversation's message (ids are the primary key).
        messages
          .filter((message) => message.id)
          .map((message) => ({
            id: message.id,
            role: message.role,
            parts: message.parts,
            metadata: message.metadata,
          })),
      );
    } catch (error) {
      this.logger.error(
        `Failed to persist conversation ${conversationId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async generateTitle(
    userId: string,
    conversationId: string,
    messages: UIMessage[],
    route: ModelRoute,
  ): Promise<void> {
    try {
      const firstUserText = textOfMessage(
        messages.find((m) => m.role === 'user'),
      );
      if (!firstUserText) return;

      const result = await this.llm.generateText({
        name: 'chat.title',
        traceId: conversationId,
        userId,
        // Same key as the conversation: the provider's fast model.
        route,
        model: 'fast',
        instructions: TITLE_INSTRUCTIONS,
        prompt: firstUserText.slice(0, 500),
      });

      const title = result.text
        .trim()
        .replace(/^["']+|["']+$/g, '')
        .slice(0, 80);
      if (title) await this.repository.updateTitle(conversationId, title);
    } catch (error) {
      this.logger.warn(
        `Title generation failed for ${conversationId}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
