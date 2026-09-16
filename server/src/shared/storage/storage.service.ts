import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createReadStream, type ReadStream } from 'node:fs';
import { mkdir, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import type { AppConfiguration } from '../../config/configuration.interface';

export interface StoredObject {
  key: string;
  size: number;
  contentType: string;
}

const CONTENT_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

const EXTENSIONS: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

/**
 * Local-disk object storage. Generated images are stored here and served by the
 * API instead of exposing upstream URLs (which would leak the provider API key).
 * The interface is deliberately S3-shaped so an S3 implementation can replace it.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly rootDir: string;

  constructor(configService: ConfigService<AppConfiguration, true>) {
    this.rootDir = resolve(configService.get('storage', { infer: true }).dir);
  }

  extensionFor(contentType: string): string {
    return EXTENSIONS[contentType.split(';')[0].trim()] ?? '.bin';
  }

  contentTypeFor(key: string): string {
    return (
      CONTENT_TYPES[extname(key).toLowerCase()] ?? 'application/octet-stream'
    );
  }

  async put(key: string, data: Buffer): Promise<StoredObject> {
    const path = this.resolvePath(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, data);
    this.logger.debug(`Stored ${key} (${data.byteLength} bytes)`);
    return {
      key,
      size: data.byteLength,
      contentType: this.contentTypeFor(key),
    };
  }

  async head(key: string): Promise<StoredObject | null> {
    try {
      const info = await stat(this.resolvePath(key));
      return { key, size: info.size, contentType: this.contentTypeFor(key) };
    } catch {
      return null;
    }
  }

  createReadStream(key: string): ReadStream {
    return createReadStream(this.resolvePath(key));
  }

  /** The whole object in memory (images are a few MB at most). */
  get(key: string): Promise<Buffer> {
    return readFile(this.resolvePath(key));
  }

  async delete(key: string): Promise<void> {
    await unlink(this.resolvePath(key)).catch(() => undefined);
  }

  private resolvePath(key: string): string {
    const path = resolve(this.rootDir, key);
    if (!path.startsWith(this.rootDir + sep)) {
      throw new Error(`Invalid storage key: ${key}`);
    }
    return path;
  }
}
