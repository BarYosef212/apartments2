import { Router } from 'express';
import { requireAdmin } from '../middleware/auth.middleware';
import { FacebookController } from '../controllers/facebook.controller';
import { FacebookQueueController, requireExtensionKey } from '../controllers/facebookQueue.controller';

const fc = new FacebookController();
const qc = new FacebookQueueController();
const router = Router();

router.use(requireAdmin);
router.get('/queue', qc.getSettings.bind(qc));
router.put('/queue', qc.saveSettings.bind(qc));
router.post('/queue/resume', qc.resume.bind(qc));
router.post('/queue/key', qc.issueKey.bind(qc));
router.get('/queue/today', qc.today.bind(qc));
router.post('/queue/replan', qc.replan.bind(qc));
router.get('/page', fc.getPage.bind(fc));
router.put('/page', fc.savePage.bind(fc));
router.post('/page/test', fc.testPage.bind(fc));
router.get('/page/posts', fc.listPagePosts.bind(fc));
router.post('/page/posts', fc.publishPagePost.bind(fc));
router.get('/groups', fc.listGroups.bind(fc));
router.post('/groups', fc.addGroup.bind(fc));
router.patch('/groups/:id', fc.updateGroup.bind(fc));
router.delete('/groups/:id', fc.deleteGroup.bind(fc));
router.get('/template', fc.getTemplate.bind(fc));
router.put('/template', fc.saveTemplate.bind(fc));
router.get('/posts', fc.listPosts.bind(fc));
router.post('/posts', fc.markPosted.bind(fc));
router.delete('/posts', fc.unmarkPosted.bind(fc));
router.get('/apartments/:id/images.zip', fc.downloadImages.bind(fc));

export default router;

/** For the Chrome extension, authenticated by its own key (not the admin login). */
export const extensionRouter = Router();
extensionRouter.use(requireExtensionKey);
extensionRouter.get('/queue/next', qc.next.bind(qc));
extensionRouter.post('/queue/jobs/:id/result', qc.result.bind(qc));
