import type { UIMessage } from 'ai';
import type { SearchToolOutput, SourcePassage } from './types';

export type UIPart = UIMessage['parts'][number];

export type ToolPartState =
  | 'input-streaming'
  | 'input-available'
  | 'approval-requested'
  | 'approval-responded'
  | 'output-available'
  | 'output-error'
  | 'output-denied';

/** Loose view of a tool part: the SDK types are generic over the tool set, we only know tool names at runtime. */
export interface ToolPartLike {
  type: string;
  toolCallId: string;
  toolName?: string;
  state: ToolPartState;
  input?: unknown;
  output?: unknown;
  errorText?: string;
  approval?: { id: string; approved?: boolean; reason?: string };
}

export const TOOL_NAMES = {
  SEARCH_DOCUMENTS: 'search_documents',
  LIST_DOCUMENTS: 'list_documents',
  LIST_GENERATIONS: 'list_generations',
  GET_GENERATION: 'get_generation',
  GENERATE_IMAGE: 'generate_image',
  EDIT_IMAGE: 'edit_image',
} as const;

/** An image the user attached to a message. */
export type ImagePart = UIPart & { type: 'file'; mediaType: string; url: string; filename?: string };

export function isToolPart(part: UIPart): part is UIPart & ToolPartLike {
  return part.type === 'dynamic-tool' || part.type.startsWith('tool-');
}

export function isImagePart(part: UIPart): part is ImagePart {
  return part.type === 'file' && part.mediaType.startsWith('image/');
}

export function toolNameOf(part: ToolPartLike): string {
  if (part.type === 'dynamic-tool') return part.toolName ?? 'tool';
  return part.type.slice('tool-'.length);
}

export function isToolRunning(part: ToolPartLike): boolean {
  return (
    part.state === 'input-streaming' ||
    part.state === 'input-available' ||
    (part.state === 'approval-responded' && part.approval?.approved === true)
  );
}

export function textOfMessage(message: UIMessage): string {
  return message.parts
    .filter((part): part is UIPart & { type: 'text'; text: string } => part.type === 'text')
    .map((part) => part.text)
    .join('\n')
    .trim();
}

export interface SourceGroup {
  toolCallId: string;
  query: string;
  passages: SourcePassage[];
}

/** Passages returned by every completed document search in a message, in order. */
export function collectSources(message: UIMessage): SourceGroup[] {
  const groups: SourceGroup[] = [];
  for (const part of message.parts) {
    if (!isToolPart(part)) continue;
    if (toolNameOf(part) !== TOOL_NAMES.SEARCH_DOCUMENTS) continue;
    if (part.state !== 'output-available') continue;
    const output = part.output as SearchToolOutput | undefined;
    if (!output?.passages) continue;
    groups.push({ toolCallId: part.toolCallId, query: output.query, passages: output.passages });
  }
  return groups;
}
