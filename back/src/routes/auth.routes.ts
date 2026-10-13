import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';

const ac = new AuthController()

const router = Router();

router.post('/login', ac.handleLogin.bind(ac));


export default router;
