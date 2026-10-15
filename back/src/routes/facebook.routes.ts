import { Router } from 'express';
import { requireAdmin } from '../middleware/auth.middleware';
import { FacebookController } from '../controllers/facebook.controller';

const fc = new FacebookController();
const router = Router();

router.use(requireAdmin);
router.get('/page', fc.getPage.bind(fc));
router.put('/page', fc.savePage.bind(fc));
router.post('/page/test', fc.testPage.bind(fc));
router.get('/page/posts', fc.listPagePosts.bind(fc));
router.post('/page/posts', fc.publishPagePost.bind(fc));
router.get('/groups', fc.listGroups.bind(fc));
router.post('/groups', fc.addGroup.bind(fc));
router.delete('/groups/:id', fc.deleteGroup.bind(fc));
router.get('/template', fc.getTemplate.bind(fc));
router.put('/template', fc.saveTemplate.bind(fc));
router.get('/posts', fc.listPosts.bind(fc));
router.post('/posts', fc.markPosted.bind(fc));
router.delete('/posts', fc.unmarkPosted.bind(fc));
router.get('/apartments/:id/images.zip', fc.downloadImages.bind(fc));

export default router;
