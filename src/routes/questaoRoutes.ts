import { Router } from 'express';
import { createQuestao, getQuestoes } from '../controllers/questaoController';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.use(requireAuth);
router.get('/', getQuestoes);
router.post('/', createQuestao);

export default router;
