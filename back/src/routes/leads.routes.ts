import { Router } from 'express';
import { requireAdmin } from '../middleware/auth.middleware';
import { LeadsController } from '../controllers/leads.controller';

const lc = new LeadsController();

export const publicLeadsRouter = Router();
publicLeadsRouter.post('/', lc.handleCreate.bind(lc));

export const adminLeadsRouter = Router();
adminLeadsRouter.use(requireAdmin);
adminLeadsRouter.get('/', lc.handleList.bind(lc));
