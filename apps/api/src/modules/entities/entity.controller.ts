import type { RequestHandler } from 'express';

import { sendSuccess } from '../../lib/apiResponse.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { AppError } from '../../lib/AppError.js';
import { recordAuditEvent } from '../audit/audit.service.js';

import { EntityVerificationService } from './entityVerification.service.js';
import { TrustedEntity } from './trustedEntity.model.js';
import type { TrustedEntityInput } from './trustedEntity.schemas.js';

const verification = new EntityVerificationService();

export const verifyEntityClaim: RequestHandler = asyncHandler(async (req, res) => {
  const { name, domain } = req.validated?.query as { name: string; domain?: string };
  const result = await verification.verifyClaim(name, domain);
  sendSuccess(res, { verification: result });
});

export const listVerifiedEntities: RequestHandler = asyncHandler(async (req, res) => {
  const { limit } = req.validated?.query as { limit: number };
  const entities = await TrustedEntity.find({ verificationStatus: 'verified' })
    .select({ publicId: 1, name: 1, aliases: 1, category: 1, officialDomains: 1, officialApps: 1, officialSupportChannels: 1, lastVerifiedAt: 1 })
    .sort({ name: 1 })
    .limit(limit)
    .lean()
    .exec();
  sendSuccess(res, {
    entities: entities.map((entity) => ({
      id: entity.publicId,
      name: entity.name,
      aliases: entity.aliases,
      category: entity.category,
      officialDomains: entity.officialDomains,
      officialApps: entity.officialApps,
      officialSupportChannels: entity.officialSupportChannels.filter((channel) => channel.verified),
      ...(entity.lastVerifiedAt ? { lastVerifiedAt: entity.lastVerifiedAt.toISOString() } : {})
    }))
  });
});

export const getTrustedEntityForAdmin: RequestHandler = asyncHandler(async (req, res) => {
  const { entityId } = req.validated?.params as { entityId: string };
  const entity = await TrustedEntity.findOne({ publicId: entityId }).exec();
  if (!entity) throw new AppError(404, 'TRUSTED_ENTITY_NOT_FOUND', 'The trusted entity was not found.');
  sendSuccess(res, {
    entity: {
      id: entity.publicId,
      name: entity.name,
      aliases: entity.aliases,
      category: entity.category,
      officialDomains: entity.officialDomains,
      officialApps: entity.officialApps,
      officialSupportChannels: entity.officialSupportChannels,
      verificationStatus: entity.verificationStatus,
      verificationSource: entity.verificationSource,
      ...(entity.lastVerifiedAt ? { lastVerifiedAt: entity.lastVerifiedAt.toISOString() } : {})
    }
  });
});

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

export const createTrustedEntity: RequestHandler = asyncHandler(async (req, res) => {
  const body = req.validated?.body as TrustedEntityInput;
  const entity = await TrustedEntity.create({
    ...body,
    normalizedName: normalizeName(body.name),
    aliases: body.aliases.map(normalizeName),
    createdByUserId: req.auth!.id,
    updatedByUserId: req.auth!.id,
    ...(body.verificationStatus === 'verified' ? { lastVerifiedAt: new Date() } : {})
  });
  await recordAuditEvent({
    actorUserId: req.auth!.id,
    action: 'trusted_entity.create',
    resourceType: 'trusted_entity',
    resourcePublicId: entity.publicId,
    outcome: 'success',
    requestId: req.requestId,
    metadata: { verificationStatus: entity.verificationStatus }
  });
  sendSuccess(res, { entity: { id: entity.publicId, name: entity.name, verificationStatus: entity.verificationStatus } }, 201);
});

export const updateTrustedEntity: RequestHandler = asyncHandler(async (req, res) => {
  const { entityId } = req.validated?.params as { entityId: string };
  const body = req.validated?.body as TrustedEntityInput;
  const entity = await TrustedEntity.findOneAndUpdate(
    { publicId: entityId },
    {
      $set: {
        ...body,
        normalizedName: normalizeName(body.name),
        aliases: body.aliases.map(normalizeName),
        updatedByUserId: req.auth!.id,
        ...(body.verificationStatus === 'verified' ? { lastVerifiedAt: new Date() } : {})
      }
    },
    { new: true, runValidators: true }
  ).exec();
  if (!entity) throw new AppError(404, 'TRUSTED_ENTITY_NOT_FOUND', 'The trusted entity was not found.');
  await recordAuditEvent({
    actorUserId: req.auth!.id,
    action: 'trusted_entity.update',
    resourceType: 'trusted_entity',
    resourcePublicId: entity.publicId,
    outcome: 'success',
    requestId: req.requestId,
    metadata: { verificationStatus: entity.verificationStatus }
  });
  sendSuccess(res, { entity: { id: entity.publicId, name: entity.name, verificationStatus: entity.verificationStatus } });
});
