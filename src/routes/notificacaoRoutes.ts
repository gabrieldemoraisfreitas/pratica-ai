import { Router } from 'express';
import {
  getNotificacoes,
  markNotificacaoAsRead,
} from '../controllers/notificacaoController';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.use(requireAuth);
router.get('/', getNotificacoes);
router.patch('/:id', markNotificacaoAsRead);

export default router;
