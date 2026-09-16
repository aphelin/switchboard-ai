import { describe, expect, it } from 'vitest';
import type { UIMessage } from 'ai';
import { ChatAttachmentsService } from './chat-attachments.service';
import type { StorageService } from '../../../shared/storage/storage.service';

const FILE_ID = '0b7f4a7e-6d1c-4c8e-9a51-1f2d3c4b5a69.png';
const URL = `http://localhost:4000/api/chat/conversations/c1/attachments/${FILE_ID}`;

function service(files: Record<string, Buffer>) {
  const storage = {
    get: (key: string) =>
      files[key]
        ? Promise.resolve(files[key])
        : Promise.reject(new Error('missing')),
    contentTypeFor: () => 'image/png',
  } as unknown as StorageService;
  const config = {
    get: () => ({ publicUrl: 'http://localhost:4000' }),
  } as never;
  return new ChatAttachmentsService(storage, config);
}

const userMessage = (url: string): UIMessage => ({
  id: 'm1',
  role: 'user',
  parts: [
    { type: 'file', mediaType: 'image/png', url },
    { type: 'text', text: 'Add a sun' },
  ],
});

describe('ChatAttachmentsService.inline', () => {
  it('names each stored attachment before inlining it, so the model can pass it to a tool', async () => {
    const attachments = service({
      [`attachments/c1/${FILE_ID}`]: Buffer.from('png'),
    });
    const original = userMessage(URL);

    const [message] = await attachments.inline('c1', [original]);

    expect(message.parts).toEqual([
      { type: 'text', text: `[Attached image id: ${FILE_ID}]` },
      {
        type: 'file',
        mediaType: 'image/png',
        url: `data:image/png;base64,${Buffer.from('png').toString('base64')}`,
      },
      { type: 'text', text: 'Add a sun' },
    ]);
    // The stored message keeps its URL and gains no text part.
    expect(original.parts).toHaveLength(2);
  });

  it('leaves attachments it cannot read unchanged and unnamed', async () => {
    const [message] = await service({}).inline('c1', [userMessage(URL)]);
    expect(message.parts).toHaveLength(2);
  });

  it("never reads an attachment URL from another conversation (another user's file)", async () => {
    const attachments = service({
      [`attachments/c1/${FILE_ID}`]: Buffer.from('png'),
    });
    const [message] = await attachments.inline('c2', [userMessage(URL)]);
    expect(message.parts[0]).toMatchObject({ type: 'file', url: URL });
    expect(message.parts).toHaveLength(2);
  });
});

describe('ChatAttachmentsService.readForEdit', () => {
  it('reads only well-formed file ids inside the conversation', async () => {
    const attachments = service({
      [`attachments/c1/${FILE_ID}`]: Buffer.from('png'),
    });
    await expect(attachments.readForEdit('c1', FILE_ID)).resolves.toMatchObject({
      key: `attachments/c1/${FILE_ID}`,
      contentType: 'image/png',
    });
    await expect(attachments.readForEdit('c2', FILE_ID)).resolves.toBeNull();
    await expect(
      attachments.readForEdit('c1', '../images/x.png'),
    ).resolves.toBeNull();
  });
});
