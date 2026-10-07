import type { RequestHandler } from 'express';

import { sendSuccess } from '../../lib/apiResponse.js';
import { asyncHandler } from '../../lib/asyncHandler.js';
import { createPublicId } from '../analyses/publicId.js';

import type { InspectUrlInput } from './urlAnalysis.schemas.js';
import { UrlAnalysisService } from './urlAnalysis.service.js';

const urlAnalysisService = new UrlAnalysisService();

export const inspectUrl: RequestHandler = asyncHandler(async (req, res) => {
  const input = req.validated?.body as InspectUrlInput;
  const result = await urlAnalysisService.analyze({
    url: input.url,
    // This endpoint is intentionally ephemeral. It does not save a raw URL or
    // create a public evidence record; the opaque identifier is presentation-only.
    evidencePublicId: createPublicId('url')
  });
  sendSuccess(res, {
    findings: result.findings,
    limitations: result.limitations,
    providerResults: result.providerResults.map((provider) => ({
      provider: provider.provider,
      status: provider.status,
      ...(provider.verdict ? { verdict: provider.verdict } : {}),
      ...(provider.reference ? { reference: provider.reference } : {})
    })),
    ...(result.normalized
      ? {
          technicalSummary: {
            hostname: result.normalized.hostname,
            protocol: result.normalized.protocol,
            safeForRemoteLookup: result.normalized.safeForRemoteLookup,
            safetyIssues: result.normalized.safetyIssues
          }
        }
      : {})
  });
});
