import { Router } from 'express';
import {
  createDesafio,
  getDesafio,
  getDesafioByToken,
  submitDesafioRespostas,
} from '../controllers/desafioController';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.use(requireAuth);
router.get('/convite', getDesafioByToken);
router.get('/:id', getDesafio);
router.post('/', createDesafio);
router.post('/:id/respostas', submitDesafioRespostas);

export default router;
