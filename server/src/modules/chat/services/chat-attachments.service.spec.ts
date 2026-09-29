import { describe, expect, it } from 'vitest';
import type { UIMessage } from 'ai';
import { posix } from 'node:path';
import { ChatAttachmentsService } from './chat-attachments.service';
import type { StorageService } from '../../../shared/storage/storage.service';

const FILE_ID = '0b7f4a7e-6d1c-4c8e-9a51-1f2d3c4b5a69.png';
const URL = `http://localhost:4000/api/chat/conversations/c1/attachments/${FILE_ID}`;

function service(files: Record<string, Buffer>) {
  // Keys resolve like paths on disk, so "attachments/../images/x" really reaches "images/x".
  const at = (key: string) => files[posix.normalize(key)];
  const storage = {
    get: (key: string) =>
      at(key) ? Promise.resolve(at(key)) : Promise.reject(new Error('missing')),
    contentTypeFor: () => 'image/png',
    extensionFor: () => '.png',
    put: (key: string, data: Buffer) => {
      files[key] = data;
      return Promise.resolve();
    },
    head: (key: string) =>
      Promise.resolve(
        files[key]
          ? { contentType: 'image/png', size: files[key].length }
          : null,
      ),
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
    await expect(attachments.readForEdit('c1', FILE_ID)).resolves.toMatchObject(
      {
        key: `attachments/c1/${FILE_ID}`,
        contentType: 'image/png',
      },
    );
    await expect(attachments.readForEdit('c2', FILE_ID)).resolves.toBeNull();
    await expect(
      attachments.readForEdit('c1', '../images/x.png'),
    ).resolves.toBeNull();
  });

  it('never resolves a key outside the conversation folder', async () => {
    const files = { [`images/${FILE_ID}`]: Buffer.from('someone else') };
    const attachments = service(files);
    await expect(
      attachments.readForEdit('../images', FILE_ID),
    ).resolves.toBeNull();
    await expect(attachments.read('../images', FILE_ID)).resolves.toBeNull();
    await expect(
      attachments.store('../images', [
        {
          id: 'm1',
          role: 'user',
          parts: [
            {
              type: 'file',
              mediaType: 'image/png',
              url: 'data:image/png;base64,cG5n',
            },
          ],
        },
      ]),
    ).rejects.toThrow('Invalid attachment reference');
    expect(Object.keys(files)).toEqual([`images/${FILE_ID}`]);
  });
});
