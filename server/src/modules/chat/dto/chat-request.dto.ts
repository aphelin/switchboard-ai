import { z } from 'zod';

/**
 * Request body sent by the AI SDK `useChat` transport, plus our own
 * `documentIds` (which documents the assistant may search) and `model`
 * (a catalog id from GET /api/providers; default: the included model).
 * Message contents are validated separately with `validateUIMessages`.
 */
export const ChatRequestSchema = z.object({
  id: z.string().min(1).max(64),
  messages: z.array(z.unknown()).min(1).max(200),
  trigger: z.enum(['submit-message', 'regenerate-message']).optional(),
  messageId: z.string().optional(),
  requestMetadata: z.unknown().optional(),
  documentIds: z.array(z.uuid()).max(50).optional(),
  model: z.string().min(1).max(120).optional(),
});

export type ChatRequestDto = z.infer<typeof ChatRequestSchema>;
