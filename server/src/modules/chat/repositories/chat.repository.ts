import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { Prisma } from 'generated/prisma/client';
import type { ConversationSummary, StoredMessage } from '../types/chat.types';
import type { PaginatedResult } from '../../generation/types/generation.types';

@Injectable()
export class ChatRepository {
  constructor(private readonly prisma: PrismaService) {}

  findConversation(id: string) {
    return this.prisma.conversation.findUnique({ where: { id } });
  }

  createConversation(id: string) {
    return this.prisma.conversation.create({ data: { id } });
  }

  async listConversations(params: {
    page: number;
    limit: number;
  }): Promise<PaginatedResult<ConversationSummary>> {
    const { page, limit } = params;
    const [rows, total] = await Promise.all([
      this.prisma.conversation.findMany({
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { _count: { select: { messages: true } } },
      }),
      this.prisma.conversation.count(),
    ]);

    return {
      data: rows.map((row) => ({
        id: row.id,
        title: row.title,
        messageCount: row._count.messages,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  updateTitle(id: string, title: string) {
    return this.prisma.conversation.update({ where: { id }, data: { title } });
  }

  async deleteConversation(id: string): Promise<void> {
    await this.prisma.conversation.delete({ where: { id } });
  }

  async getMessages(conversationId: string): Promise<StoredMessage[]> {
    const rows = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) => ({
      id: row.id,
      role: row.role,
      parts: row.parts,
      metadata: row.metadata ?? undefined,
    }));
  }

  /** Upserts by message id, so re-sent messages (e.g. after a tool approval) are updated, not duplicated. */
  async upsertMessages(
    conversationId: string,
    messages: StoredMessage[],
  ): Promise<void> {
    if (messages.length === 0) return;

    await this.prisma.$transaction([
      ...messages.map((message) =>
        this.prisma.message.upsert({
          where: { id: message.id },
          create: {
            id: message.id,
            conversationId,
            role: message.role,
            parts: message.parts as Prisma.InputJsonValue,
            metadata: message.metadata as Prisma.InputJsonValue | undefined,
          },
          update: {
            parts: message.parts as Prisma.InputJsonValue,
            metadata: message.metadata as Prisma.InputJsonValue | undefined,
          },
        }),
      ),
      this.prisma.conversation.update({
        where: { id: conversationId },
        data: { updatedAt: new Date() },
      }),
    ]);
  }
}
