import { Router } from 'express';

import { requireAuth, validate } from '../../middleware/index.js';

import { createIncidentController, listIncidentsController } from './incident.controller.js';
import { createIncidentSchema } from './incident.schemas.js';

export const incidentRouter = Router();
incidentRouter.use(requireAuth);
incidentRouter.get('/', listIncidentsController);
incidentRouter.post('/', validate({ body: createIncidentSchema }), createIncidentController);
