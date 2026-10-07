import { createHash } from "node:crypto";

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_IMAGE_PIXELS = 40_000_000;

export type ValidatedImage = {
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  width?: number;
  height?: number;
  sha256: string;
  sizeBytes: number;
};

export type ImageStorage = {
  put(input: { buffer: Buffer; mimeType: ValidatedImage["mimeType"]; sha256: string; ownerUserId: string; analysisPublicId: string }): Promise<{ provider: string; key: string }>;
  delete?(input: { provider: string; key: string }): Promise<void>;
};

export type OcrProvider = {
  readonly name: string;
  extractText(input: { imageStorageKey: string; mimeType: ValidatedImage["mimeType"] }): Promise<unknown>;
};

export type ImageTextExtraction =
  | { status: "complete"; provider: string; text: string }
  | { status: "unavailable" | "failed"; provider?: string; reason: string };

function readPngDimensions(buffer: Buffer): { width: number; height: number } | undefined {
  if (buffer.length < 24 || !buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return undefined;
  if (buffer.subarray(12, 16).toString("ascii") !== "IHDR") return undefined;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function readJpegDimensions(buffer: Buffer): { width: number; height: number } | undefined {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return undefined;
  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) { offset += 1; continue; }
    const marker = buffer[offset + 1]!;
    offset += 2;
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > buffer.length) return undefined;
    const segmentLength = buffer.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > buffer.length) return undefined;
    if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) {
      return { height: buffer.readUInt16BE(offset + 3), width: buffer.readUInt16BE(offset + 5) };
    }
    offset += segmentLength;
  }
  return undefined;
}

function readWebpDimensions(buffer: Buffer): { width: number; height: number } | undefined {
  if (buffer.length < 30 || buffer.subarray(0, 4).toString("ascii") !== "RIFF" || buffer.subarray(8, 12).toString("ascii") !== "WEBP") return undefined;
  const chunk = buffer.subarray(12, 16).toString("ascii");
  if (chunk === "VP8X") return { width: 1 + buffer.readUIntLE(24, 3), height: 1 + buffer.readUIntLE(27, 3) };
  if (chunk === "VP8L" && buffer[20] === 0x2f) {
    const bits = buffer.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  return undefined;
}

/** Validates bytes rather than trusting a file name or Content-Type header. */
export function validateImageUpload(buffer: Buffer, declaredMimeType?: string): ValidatedImage {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) throw new ImageUploadError("empty_file", "An image file is required.");
  if (buffer.length > MAX_IMAGE_BYTES) throw new ImageUploadError("file_too_large", "Images must be 10 MB or smaller.");

  let mimeType: ValidatedImage["mimeType"] | undefined;
  let dimensions: { width: number; height: number } | undefined;
  dimensions = readPngDimensions(buffer);
  if (dimensions) mimeType = "image/png";
  if (!mimeType) {
    dimensions = readJpegDimensions(buffer);
    if (dimensions) mimeType = "image/jpeg";
  }
  if (!mimeType) {
    dimensions = readWebpDimensions(buffer);
    if (dimensions) mimeType = "image/webp";
  }
  if (!mimeType) throw new ImageUploadError("unsupported_file", "Only JPEG, PNG, and WebP image bytes are accepted.");
  if (declaredMimeType && declaredMimeType !== mimeType) throw new ImageUploadError("mime_mismatch", "The file content does not match the declared image type.");
  if (dimensions && (dimensions.width < 1 || dimensions.height < 1 || dimensions.width * dimensions.height > MAX_IMAGE_PIXELS)) {
    throw new ImageUploadError("image_dimensions", "The image dimensions are not safe to process.");
  }
  return { mimeType, width: dimensions?.width, height: dimensions?.height, sha256: createHash("sha256").update(buffer).digest("hex"), sizeBytes: buffer.length };
}

export class ImageUploadError extends Error {
  constructor(readonly code: "empty_file" | "file_too_large" | "unsupported_file" | "mime_mismatch" | "image_dimensions", message: string) {
    super(message);
    this.name = "ImageUploadError";
  }
}

/**
 * OCR is optional. If it is absent or malformed, no text is invented and the
 * caller can show an explicit limitation on the result screen.
 */
export async function extractImageText(input: { provider?: OcrProvider; storageKey: string; mimeType: ValidatedImage["mimeType"] }): Promise<ImageTextExtraction> {
  if (!input.provider) return { status: "unavailable", reason: "Screenshot text extraction is not configured for this deployment." };
  try {
    const result = await input.provider.extractText({ imageStorageKey: input.storageKey, mimeType: input.mimeType });
    if (!result || typeof result !== "object" || typeof (result as { text?: unknown }).text !== "string") {
      return { status: "failed", provider: input.provider.name, reason: "The screenshot text provider returned an invalid result." };
    }
    const text = (result as { text: string }).text.normalize("NFKC").replace(/\u0000/g, "").trim();
    if (!text) return { status: "unavailable", provider: input.provider.name, reason: "No readable text was extracted from the screenshot." };
    return { status: "complete", provider: input.provider.name, text: text.slice(0, 50_000) };
  } catch {
    return { status: "failed", provider: input.provider.name, reason: "Screenshot text extraction did not complete." };
  }
}
