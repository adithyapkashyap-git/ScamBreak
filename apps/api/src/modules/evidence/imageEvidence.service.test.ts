import { describe, expect, it } from 'vitest';

import { ImageUploadError, validateImageUpload } from './imageEvidence.service.js';

function pngHeader(width: number, height: number): Buffer {
  const buffer = Buffer.alloc(24);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buffer, 0);
  buffer.write('IHDR', 12, 'ascii');
  buffer.writeUInt32BE(width, 16);
  buffer.writeUInt32BE(height, 20);
  return buffer;
}

describe('image upload validation', () => {
  it('identifies image bytes rather than trusting a filename or extension', () => {
    const result = validateImageUpload(pngHeader(80, 40), 'image/png');
    expect(result.mimeType).toBe('image/png');
    expect(result.width).toBe(80);
    expect(result.height).toBe(40);
  });

  it('rejects a declared MIME type that does not match image bytes', () => {
    expect(() => validateImageUpload(pngHeader(80, 40), 'image/jpeg')).toThrow(ImageUploadError);
  });

  it('rejects decompression-bomb-sized dimensions before processing', () => {
    expect(() => validateImageUpload(pngHeader(100_000, 100_000), 'image/png')).toThrow(ImageUploadError);
  });
});
