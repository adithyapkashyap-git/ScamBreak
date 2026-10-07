import type { RequestHandler } from 'express';

import { sendSuccess } from '../../lib/apiResponse.js';
import { asyncHandler } from '../../lib/asyncHandler.js';

import type { CreateIncidentInput } from './incident.schemas.js';
import { createIncident, listIncidents } from './incident.service.js';

export const createIncidentController: RequestHandler = asyncHandler(async (req, res) => {
  const incident = await createIncident(req.auth!.id, req.validated?.body as CreateIncidentInput);
  res.setHeader('Cache-Control', 'no-store');
  sendSuccess(res, { incident }, 201);
});

export const listIncidentsController: RequestHandler = asyncHandler(async (req, res) => {
  const incidents = await listIncidents(req.auth!.id);
  res.setHeader('Cache-Control', 'no-store');
  sendSuccess(res, { incidents });
});
