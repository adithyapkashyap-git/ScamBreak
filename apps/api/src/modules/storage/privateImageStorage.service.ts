import { randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';

import { config } from '../../config/index.js';
import type { ImageStorage, ValidatedImage } from '../evidence/imageEvidence.service.js';

/**
 * Development storage implementation. Files are placed outside any static
 * directory, use restrictive modes where the platform supports them, and are
 * never exposed by an HTTP route. Production deployments should bind the same
 * interface to a private encrypted object store.
 */
export class PrivateFilesystemImageStorage implements ImageStorage {
  private readonly root = resolve(config.privacy.privateStoragePath);

  private pathFor(key: string): string {
    const candidate = resolve(this.root, key);
    if (candidate !== this.root && !candidate.startsWith(`${this.root}${sep}`)) {
      throw new Error('Unsafe private-storage key.');
    }
    return candidate;
  }

  async put(input: {
    buffer: Buffer;
    mimeType: ValidatedImage['mimeType'];
    sha256: string;
    ownerUserId: string;
    analysisPublicId: string;
  }): Promise<{ provider: string; key: string }> {
    await mkdir(this.root, { recursive: true, mode: 0o700 });
    const extension = input.mimeType === 'image/jpeg' ? 'jpg' : input.mimeType === 'image/png' ? 'png' : 'webp';
    // The storage key intentionally contains no original file name or raw user identifier.
    const key = `image/${randomUUID()}.${extension}`;
    const target = this.pathFor(key);
    await mkdir(resolve(target, '..'), { recursive: true, mode: 0o700 });
    await writeFile(target, input.buffer, { encoding: undefined, mode: 0o600, flag: 'wx' });
    return { provider: 'local_private_filesystem', key };
  }

  async delete(input: { provider: string; key: string }): Promise<void> {
    if (input.provider !== 'local_private_filesystem') return;
    await rm(this.pathFor(input.key), { force: true });
  }
}

export const privateImageStorage = new PrivateFilesystemImageStorage();
