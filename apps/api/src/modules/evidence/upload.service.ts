import { config } from '../../config/index.js';
import { AppError } from '../../lib/AppError.js';
import { privateImageStorage } from '../storage/privateImageStorage.service.js';

import { ImageUploadError, validateImageUpload } from './imageEvidence.service.js';
import { Upload } from './upload.model.js';

export type SafeUploadDto = Readonly<{
  id: string;
  kind: 'image';
  status: 'ready';
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  sizeBytes: number;
  width?: number;
  height?: number;
  expiresAt: string;
}>;

const toSafeUploadDto = (upload: {
  publicId: string;
  kind: 'image';
  status: string;
  storage: { mimeType: 'image/jpeg' | 'image/png' | 'image/webp'; sizeBytes: number; width?: number | null; height?: number | null };
  expiresAt: Date;
}): SafeUploadDto => ({
  id: upload.publicId,
  kind: upload.kind,
  status: 'ready',
  mimeType: upload.storage.mimeType,
  sizeBytes: upload.storage.sizeBytes,
  ...(upload.storage.width ? { width: upload.storage.width } : {}),
  ...(upload.storage.height ? { height: upload.storage.height } : {}),
  expiresAt: upload.expiresAt.toISOString()
});

/**
 * Places a byte-validated image into short-lived, private staging. No original
 * filename, raw bytes, object key or digest escapes this service's DTO.
 */
export async function stageImageUpload(input: {
  ownerUserId: string;
  file: { buffer: Buffer; mimetype?: string };
}): Promise<SafeUploadDto> {
  let image;
  try {
    image = validateImageUpload(input.file.buffer, input.file.mimetype);
  } catch (error) {
    if (error instanceof ImageUploadError) {
      throw new AppError(
        error.code === 'file_too_large' ? 413 : 400,
        `UPLOAD_${error.code.toUpperCase()}`,
        error.message
      );
    }
    throw error;
  }

  const expiresAt = new Date(Date.now() + config.privacy.uploadRetentionHours * 60 * 60 * 1_000);
  // The storage interface accepts an analysis ID for providers that arrange
  // files by analysis. A staged upload intentionally has no analysis yet.
  const stored = await privateImageStorage.put({
    buffer: input.file.buffer,
    mimeType: image.mimeType,
    sha256: image.sha256,
    ownerUserId: input.ownerUserId,
    analysisPublicId: 'staged'
  });

  try {
    const upload = await Upload.create({
      ownerUserId: input.ownerUserId,
      kind: 'image',
      status: 'ready',
      storage: {
        provider: stored.provider,
        key: stored.key,
        mimeType: image.mimeType,
        sizeBytes: image.sizeBytes,
        sha256: image.sha256,
        ...(image.width ? { width: image.width } : {}),
        ...(image.height ? { height: image.height } : {})
      },
      expiresAt
    });
    const uploadStorage = upload.storage;
    if (!uploadStorage) {
      throw new AppError(500, 'UPLOAD_STORAGE_MISSING', 'The image could not be stored safely.');
    }
    return toSafeUploadDto({
      publicId: upload.publicId,
      kind: 'image',
      status: upload.status,
      storage: uploadStorage,
      expiresAt: upload.expiresAt
    });
  } catch (error) {
    await privateImageStorage.delete(stored);
    throw error;
  }
}

export type ConsumedImageUpload = {
  publicId: string;
  storage: {
    provider: string;
    key: string;
    mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
    sizeBytes: number;
    sha256: string;
    width?: number | null;
    height?: number | null;
  };
};

/** Atomically reserves an upload so a private object cannot be attached twice. */
export async function consumeImageUpload(input: {
  publicId: string;
  ownerUserId: string;
  analysisId: unknown;
}): Promise<ConsumedImageUpload> {
  const upload = await Upload.findOneAndUpdate(
    {
      publicId: input.publicId,
      ownerUserId: input.ownerUserId,
      kind: 'image',
      status: 'ready',
      expiresAt: { $gt: new Date() }
    },
    { $set: { status: 'consumed', consumedAt: new Date(), analysisId: input.analysisId } },
    { new: true }
  )
    .select('+storage.key +storage.sha256')
    .exec();

  if (!upload) {
    throw new AppError(400, 'UPLOAD_UNAVAILABLE', 'The image upload is unavailable, expired, or already attached to an analysis.');
  }

  const storage = upload.storage;
  if (!storage) {
    throw new AppError(500, 'UPLOAD_STORAGE_MISSING', 'The uploaded image could not be attached safely.');
  }

  return {
    publicId: upload.publicId,
    storage: {
      provider: storage.provider,
      key: storage.key,
      mimeType: storage.mimeType,
      sizeBytes: storage.sizeBytes,
      sha256: storage.sha256,
      ...(storage.width ? { width: storage.width } : {}),
      ...(storage.height ? { height: storage.height } : {})
    }
  };
}

/**
 * Used only after a failed analysis creation has removed all partial evidence
 * and derived records. Do not call this while an Evidence record still points
 * to the staged object.
 */
export async function restoreConsumedImageUpload(input: { publicId: string; ownerUserId: string }): Promise<void> {
  await Upload.updateOne(
    { publicId: input.publicId, ownerUserId: input.ownerUserId, status: 'consumed' },
    { $set: { status: 'ready' }, $unset: { consumedAt: 1, analysisId: 1 } }
  ).exec();
}

export async function deleteStoredUpload(input: { provider?: string; key?: string }): Promise<void> {
  if (!input.provider || !input.key) return;
  await privateImageStorage.delete({ provider: input.provider, key: input.key });
}

/**
 * Removes expired, unattached upload bytes before deleting their metadata.
 * Consumed uploads are retained because their private object belongs to a
 * completed analysis and is governed by that analysis' retention policy.
 */
export async function purgeExpiredImageUploads(input: { now?: Date; limit?: number } = {}): Promise<{
  considered: number;
  purged: number;
  failed: number;
}> {
  const now = input.now ?? new Date();
  const limit = Math.min(Math.max(input.limit ?? 100, 1), 1_000);
  const uploads = await Upload.find({
    status: { $in: ['pending_scan', 'ready', 'rejected', 'expired'] },
    expiresAt: { $lte: now }
  })
    .select('+storage.key')
    .sort({ expiresAt: 1 })
    .limit(limit)
    .exec();

  let purged = 0;
  let failed = 0;
  for (const upload of uploads) {
    try {
      await deleteStoredUpload({ provider: upload.storage?.provider, key: upload.storage?.key });
      const result = await Upload.deleteOne({
        _id: upload._id,
        status: { $in: ['pending_scan', 'ready', 'rejected', 'expired'] },
        expiresAt: { $lte: now }
      }).exec();
      if (result.deletedCount === 1) purged += 1;
    } catch {
      // Keep the database record when byte deletion fails so the next sweep
      // can retry. Callers log only aggregate counts, never object keys.
      failed += 1;
    }
  }
  return { considered: uploads.length, purged, failed };
}
