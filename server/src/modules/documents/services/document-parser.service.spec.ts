import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import {
  DocumentParserService,
  normalizeText,
} from './document-parser.service';

const file = (name: string, mimetype: string, content: string) => ({
  originalname: name,
  mimetype,
  buffer: Buffer.from(content, 'utf8'),
  size: Buffer.byteLength(content),
});

describe('normalizeText', () => {
  it('normalises line endings, trailing whitespace and blank-line runs', () => {
    expect(normalizeText('a  \r\nb\r\n\r\n\r\n\r\nc\t\n')).toBe('a\nb\n\nc');
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeText('\n\n  hello  \n\n')).toBe('hello');
  });
});

describe('DocumentParserService', () => {
  const parser = new DocumentParserService();

  it('parses plain text and markdown uploads as UTF-8', async () => {
    const md = await parser.parse(
      file('notes.md', 'text/markdown', '# Title\r\n\r\nBody'),
    );
    expect(md).toEqual({ text: '# Title\n\nBody', mimeType: 'text/markdown' });

    const txt = await parser.parse(
      file('notes.txt', 'text/plain', 'Plain  \n\n\n\ntext'),
    );
    expect(txt).toEqual({ text: 'Plain\n\ntext', mimeType: 'text/plain' });
  });

  it('accepts text-like extensions even when the browser sends a generic mime type', async () => {
    const parsed = await parser.parse(
      file('data.csv', 'application/octet-stream', 'a,b\n1,2'),
    );
    expect(parsed.text).toBe('a,b\n1,2');
  });

  it('rejects unsupported binary uploads with a 400', async () => {
    await expect(
      parser.parse(file('archive.zip', 'application/zip', 'PK')),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      parser.parse(file('image.png', 'image/png', 'PNG')),
    ).rejects.toThrow(/Unsupported file type/);
  });
});
