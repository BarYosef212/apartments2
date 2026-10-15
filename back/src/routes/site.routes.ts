import { NextFunction, Request, Response, Router } from 'express';
import { MulterError } from 'multer';
import { requireAdmin } from '../middleware/auth.middleware';
import { SiteController } from '../controllers/site.controller';
import { upload } from '../services/uploads.service';

const sc = new SiteController();

/** Public: what the site needs to render (media, copy, contact). */
export const publicSiteRouter = Router();
publicSiteRouter.get('/', sc.handleGet.bind(sc));

export const adminSiteRouter = Router();
adminSiteRouter.use(requireAdmin);
adminSiteRouter.get('/settings', sc.handleGetAdmin.bind(sc));
adminSiteRouter.put('/settings', sc.handleUpdate.bind(sc));
adminSiteRouter.post('/mail/test', sc.handleTestMail.bind(sc));
adminSiteRouter.post(
  '/uploads',
  (req: Request, res: Response, next: NextFunction) =>
    upload.single('file')(req, res, (err: unknown) => {
      if (err instanceof MulterError && err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ message: 'File is too large' });
      }
      if (err) return next(err);
      next();
    }),
  sc.handleUpload.bind(sc)
);
