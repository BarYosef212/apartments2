import { Router } from 'express';
import { requireAdmin } from '../middleware/auth.middleware';
import { ScraperController } from '../controllers/scraper.controller';

const sc = new ScraperController();
const router = Router();

router.use(requireAdmin);
router.get('/settings', sc.handleGetSettings.bind(sc));
router.put('/settings', sc.handleUpdateSettings.bind(sc));
router.post('/run', sc.handleRun.bind(sc));
router.get('/status', sc.handleStatus.bind(sc));
router.get('/logs', sc.handleLogs.bind(sc));

export default router;
