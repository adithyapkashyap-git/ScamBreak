import type { RequestHandler } from 'express';

import { sendNoContent, sendSuccess } from '../../lib/apiResponse.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { recordAuditEvent } from '../audit/audit.service.js';

import type { CreateAnalysisInput } from './analysis.schemas.js';
import { analysisService } from './analysis.service.js';

const validated = <T>(value: unknown): T => value as T;

export const createAnalysis: RequestHandler = asyncHandler(async (req, res) => {
  const analysis = await analysisService.create(req.auth!.id, validated<CreateAnalysisInput>(req.validated?.body));
  res.setHeader('Cache-Control', 'no-store');
  sendSuccess(res, { analysis }, 201);
});

export const getAnalysis: RequestHandler = asyncHandler(async (req, res) => {
  const { analysisId } = validated<{ analysisId: string }>(req.validated?.params);
  const analysis = await analysisService.get(req.auth!.id, analysisId);
  res.setHeader('Cache-Control', 'no-store');
  sendSuccess(res, { analysis });
});

export const listAnalyses: RequestHandler = asyncHandler(async (req, res) => {
  const query = validated<{ cursor?: string; limit: number }>(req.validated?.query);
  const result = await analysisService.list(req.auth!.id, query);
  res.setHeader('Cache-Control', 'no-store');
  sendSuccess(res, result);
});

export const deleteAnalysis: RequestHandler = asyncHandler(async (req, res) => {
  const { analysisId } = validated<{ analysisId: string }>(req.validated?.params);
  await analysisService.remove(req.auth!.id, analysisId);
  await recordAuditEvent({
    actorUserId: req.auth!.id,
    action: 'analysis.delete',
    resourceType: 'analysis',
    resourcePublicId: analysisId,
    outcome: 'success',
    requestId: req.requestId
  });
  sendNoContent(res);
});
