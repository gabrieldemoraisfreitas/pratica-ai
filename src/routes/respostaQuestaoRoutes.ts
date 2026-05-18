import { Router } from 'express';
import { createRespostaQuestao } from '../controllers/respostaQuestaoController';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.use(requireAuth);
router.post('/', createRespostaQuestao);

export default router;
