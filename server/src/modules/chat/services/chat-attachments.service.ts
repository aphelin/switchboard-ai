import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import type { ReadStream } from 'node:fs';
import type { UIMessage } from 'ai';
import { StorageService } from '../../../shared/storage/storage.service';
import { CHAT } from '../../../shared/constants/app.constants';
import type { AppConfiguration } from '../../../config/configuration.interface';

type Part = UIMessage['parts'][number];
type FilePart = Extract<Part, { type: 'file' }>;

/** The id of a stored attachment: the file name under the conversation, e.g. `<uuid>.png`. */
export const ATTACHMENT_FILE_ID = /^[0-9a-f-]{36}\.[a-z0-9]+$/;
const FILE_ID = ATTACHMENT_FILE_ID;
const ATTACHMENT_URL =
  /\/api\/chat\/conversations\/([^/]+)\/attachments\/([^/?#]+)$/;

/** The bytes of a `data:<type>;base64,...` URL. */
function decodeDataUrl(url: string): Buffer {
  const comma = url.indexOf(',');
  if (comma === -1 || !url.slice(0, comma).endsWith(';base64')) {
    throw new BadRequestException('Attachments must be base64 data URLs');
  }
  return Buffer.from(url.slice(comma + 1), 'base64');
}

/**
 * Images a user attaches to a chat message. The browser sends them inline as
 * data URLs; this service moves the bytes to storage and leaves a small API URL
 * in the message, so the conversation stored in Postgres and re-sent on every
 * turn stays small. For the model the bytes are inlined again, because the
 * provider cannot fetch a URL that needs this user's session.
 */
@Injectable()
export class ChatAttachmentsService {
  private readonly publicUrl: string;

  constructor(
    private readonly storage: StorageService,
    configService: ConfigService<AppConfiguration, true>,
  ) {
    this.publicUrl = configService.get('app', { infer: true }).publicUrl;
  }

  /** Rewrites the messages in place: data URLs out, attachment URLs in. */
  async store(conversationId: string, messages: UIMessage[]): Promise<void> {
    for (const message of messages) {
      if (message.role !== 'user') continue;
      let count = 0;
      for (const part of message.parts) {
        if (part.type !== 'file' || !part.url.startsWith('data:')) continue;
        if (!part.mediaType.startsWith('image/')) {
          throw new BadRequestException(
            'Only images can be attached to a message',
          );
        }
        if (++count > CHAT.MAX_ATTACHMENTS) {
          throw new BadRequestException(
            `At most ${CHAT.MAX_ATTACHMENTS} images can be attached to one message`,
          );
        }
        const data = decodeDataUrl(part.url);
        if (data.byteLength > CHAT.MAX_ATTACHMENT_BYTES) {
          throw new BadRequestException(
            `Each attached image must be under ${Math.round(CHAT.MAX_ATTACHMENT_BYTES / 1024 / 1024)} MB`,
          );
        }
        const fileId = `${randomUUID()}${this.storage.extensionFor(part.mediaType)}`;
        await this.storage.put(this.keyFor(conversationId, fileId), data);
        part.url = `${this.publicUrl}/api/chat/conversations/${conversationId}/attachments/${fileId}`;
      }
    }
  }

  /**
   * A copy of the messages for the model: this API's attachment URLs inlined as
   * data URLs, each preceded by a text part naming its id, so the model can pass
   * an attached image to edit_image. The stored messages are left untouched.
   */
  async inline(
    conversationId: string,
    messages: UIMessage[],
  ): Promise<UIMessage[]> {
    return Promise.all(
      messages.map(async (message) => {
        if (message.role !== 'user') return message;
        const parts = await Promise.all(
          message.parts.map(async (part): Promise<Part[]> => {
            if (part.type !== 'file') return [part];
            const match = ATTACHMENT_URL.exec(part.url);
            // Messages come from the browser: a URL naming another conversation (possibly
            // another user's) is never read, so attachments can't be pulled across owners.
            if (
              !match ||
              match[1] !== conversationId ||
              !FILE_ID.test(match[2])
            ) {
              return [part];
            }
            const key = this.keyFor(match[1], match[2]);
            const data = await this.storage.get(key).catch(() => null);
            if (!data) return [part];
            const inlined: FilePart = {
              ...part,
              url: `data:${part.mediaType};base64,${data.toString('base64')}`,
            };
            return [
              { type: 'text', text: `[Attached image id: ${match[2]}]` },
              inlined,
            ];
          }),
        );
        return { ...message, parts: parts.flat() };
      }),
    );
  }

  /** The bytes of an attached image, for an edit. The caller has checked that the conversation is the user's. */
  async readForEdit(
    conversationId: string,
    fileId: string,
  ): Promise<{ key: string; data: Buffer; contentType: string } | null> {
    if (!FILE_ID.test(fileId)) return null;
    const key = this.keyFor(conversationId, fileId);
    const data = await this.storage.get(key).catch(() => null);
    if (!data) return null;
    return { key, data, contentType: this.storage.contentTypeFor(key) };
  }

  /** The stored file, for the owner of its conversation (checked by the caller). */
  async read(
    conversationId: string,
    fileId: string,
  ): Promise<{ stream: ReadStream; contentType: string; size: number } | null> {
    if (!FILE_ID.test(fileId)) return null;
    const key = this.keyFor(conversationId, fileId);
    const object = await this.storage.head(key);
    if (!object) return null;
    return {
      stream: this.storage.createReadStream(key),
      contentType: object.contentType,
      size: object.size,
    };
  }

  private keyFor(conversationId: string, fileId: string): string {
    return `attachments/${conversationId}/${fileId}`;
  }
}
