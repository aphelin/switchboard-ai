import { BadRequestException, Injectable } from '@nestjs/common';
import { extname } from 'node:path';
import { extractText } from 'unpdf';
import type { UploadedFileLike } from '../types/documents.types';

const TEXT_EXTENSIONS = new Set([
  '.txt',
  '.md',
  '.markdown',
  '.csv',
  '.json',
  '.html',
  '.htm',
]);
const TEXT_MIME_PREFIXES = ['text/', 'application/json'];

export interface ParsedDocument {
  text: string;
  mimeType: string;
}

/**
 * Extracts plain text from uploads. PDF parsing is the messy part of most RAG
 * projects (tables, columns, scanned pages); unpdf covers text-based PDFs, a
 * production system would add OCR / layout-aware parsing (Docling, Unstructured).
 */
@Injectable()
export class DocumentParserService {
  async parse(file: UploadedFileLike): Promise<ParsedDocument> {
    const extension = extname(file.originalname).toLowerCase();

    if (file.mimetype === 'application/pdf' || extension === '.pdf') {
      const { text } = await extractText(new Uint8Array(file.buffer), {
        mergePages: true,
      });
      return { text: normalizeText(text), mimeType: 'application/pdf' };
    }

    const isText =
      TEXT_EXTENSIONS.has(extension) ||
      TEXT_MIME_PREFIXES.some((prefix) => file.mimetype.startsWith(prefix));
    if (isText) {
      return {
        text: normalizeText(file.buffer.toString('utf8')),
        mimeType: file.mimetype || 'text/plain',
      };
    }

    throw new BadRequestException(
      `Unsupported file type "${file.mimetype || extension}". Upload .txt, .md or .pdf files.`,
    );
  }
}

export function normalizeText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
