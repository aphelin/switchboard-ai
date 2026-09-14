import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { Response } from 'express';
import {
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
import { ChatRepository } from '../repositories/chat.repository';
import type { ChatRequestDto } from '../dto/chat-request.dto';
import { QueryConversationsDto } from '../dto/query-conversations.dto';
import { buildChatTools, CHAT_TOOL_APPROVAL } from '../tools/chat-tools';
import {
  ASSISTANT_PROMPT_VERSION,
  buildAssistantInstructions,
} from '../prompts/assistant.prompt';
import { textOfMessage, trimHistory } from '../utils/history';
import { CHAT } from '../../../shared/constants/app.constants';
import { summarizeUsage } from '../../llm/types/llm.types';
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
  ) {}

  async stream(dto: ChatRequestDto, res: Response): Promise<void> {
    const conversation = await this.ensureConversation(dto.id);
    const uiMessages = await validateUIMessages({ messages: dto.messages });
    const documentIds = dto.documentIds?.length ? dto.documentIds : undefined;

    const tools = buildChatTools({
      retrieval: this.retrieval,
      documents: this.documents,
      generations: this.generations,
      documentIds,
      traceId: conversation.id,
    });

    const history = trimHistory(uiMessages, CHAT.MAX_CONTEXT_MESSAGES);
    const modelMessages = await convertToModelMessages(history, {
      tools,
      ignoreIncompleteToolCalls: true,
    });

    const result = this.llm.streamText({
      name: 'chat.stream',
      traceId: conversation.id,
      metadata: { promptVersion: ASSISTANT_PROMPT_VERSION, documentIds },
      model: 'main',
      instructions: buildAssistantInstructions({
        selectedDocuments: documentIds?.length ?? 0,
      }),
      messages: modelMessages,
      tools,
      toolApproval: CHAT_TOOL_APPROVAL,
      stopWhen: isStepCount(CHAT.MAX_STEPS),
    });

    const stream = toUIMessageStream({
      stream: result.stream,
      tools,
      originalMessages: uiMessages,
      messageMetadata: ({ part }) =>
        part.type === 'start' ? { conversationId: conversation.id } : undefined,
      onError: (error) =>
        error instanceof Error
          ? error.message
          : 'The assistant failed to respond',
      onEnd: async ({ messages, isAborted }) => {
        await this.persistMessages(conversation.id, messages);
        if (!isAborted && !conversation.title) {
          void this.generateTitle(conversation.id, messages);
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
    const documentIds = params.documentIds?.length
      ? params.documentIds
      : undefined;
    const tools = buildChatTools({
      retrieval: this.retrieval,
      documents: this.documents,
      generations: this.generations,
      documentIds,
      traceId: params.traceId,
    });
    // No side effects without a human: the image tool is only available in the interactive chat.
    const readOnlyTools = Object.fromEntries(
      Object.entries(tools).filter(([name]) => name !== 'generate_image'),
    );

    const result = await this.llm.generateText({
      name: 'chat.answer',
      traceId: params.traceId,
      metadata: { promptVersion: ASSISTANT_PROMPT_VERSION },
      model: 'main',
      instructions: buildAssistantInstructions({
        selectedDocuments: documentIds?.length ?? 0,
      }),
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
    };
  }

  listConversations(query: QueryConversationsDto) {
    return this.repository.listConversations({
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });
  }

  async getConversation(id: string) {
    const conversation = await this.repository.findConversation(id);
    if (!conversation)
      throw new NotFoundException(`Conversation ${id} not found`);
    const messages = await this.repository.getMessages(id);
    return { ...conversation, messages };
  }

  async deleteConversation(id: string): Promise<void> {
    const conversation = await this.repository.findConversation(id);
    if (!conversation)
      throw new NotFoundException(`Conversation ${id} not found`);
    await this.repository.deleteConversation(id);
  }

  private async ensureConversation(id: string) {
    return (
      (await this.repository.findConversation(id)) ??
      (await this.repository.createConversation(id))
    );
  }

  private async persistMessages(
    conversationId: string,
    messages: UIMessage[],
  ): Promise<void> {
    try {
      await this.repository.upsertMessages(
        conversationId,
        messages.map((message) => ({
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
    conversationId: string,
    messages: UIMessage[],
  ): Promise<void> {
    try {
      const firstUserText = textOfMessage(
        messages.find((m) => m.role === 'user'),
      );
      if (!firstUserText) return;

      const result = await this.llm.generateText({
        name: 'chat.title',
        traceId: conversationId,
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
