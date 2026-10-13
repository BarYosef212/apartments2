import { Request, Response } from 'express';
import { validateUserCredentials } from '../services/auth.service';
import * as CONS from '../config/constants'

export class AuthController {
  async handleLogin(req: Request, res: Response) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: CONS.DETAILS_REQUIRED });
      }

      const result = await validateUserCredentials(email, password);


      if (!result) {
        return res.status(401).json({ message: CONS.INVALID_DETAILS });
      }

      return res.json(result);
    } catch (error) {
      console.error(CONS.ERROR_LOGIN, error);
      return res.status(500).json({ message: CONS.ERROR_LOGIN });
    }
  }

}


