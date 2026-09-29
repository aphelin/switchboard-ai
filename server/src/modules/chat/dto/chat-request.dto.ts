import { z } from 'zod';

/**
 * Request body sent by the AI SDK `useChat` transport, plus our own
 * `documentIds` (which documents the assistant may search) and `model`
 * (a catalog id from GET /api/providers; default: the included model).
 * Message contents are validated separately with `validateUIMessages`.
 */
/**
 * Conversation ids are chosen by the client and become part of attachment storage
 * paths, so only URL- and path-safe characters are accepted ("../images" is not an id).
 */
export const CONVERSATION_ID = /^[A-Za-z0-9_-]{1,64}$/;

export const ChatRequestSchema = z.object({
  id: z.string().regex(CONVERSATION_ID),
  messages: z.array(z.unknown()).min(1).max(200),
  trigger: z.enum(['submit-message', 'regenerate-message']).optional(),
  messageId: z.string().optional(),
  requestMetadata: z.unknown().optional(),
  documentIds: z.array(z.uuid()).max(50).optional(),
  /** "none" takes the document tools away for this turn; otherwise `documentIds` narrows the search (empty = all). */
  documentScope: z.enum(['all', 'selected', 'none']).optional(),
  model: z.string().min(1).max(120).optional(),
});

export type ChatRequestDto = z.infer<typeof ChatRequestSchema>;
