import { Router } from 'express';
import {
  createMateria,
  deleteMateria,
  getMateriaFlashcards,
  getMateriaById,
  getMateriaQuestoes,
  getMateriasByUser,
  updateMateria,
} from '../controllers/materiaController';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.use(requireAuth);
router.get('/', getMateriasByUser);
router.get('/:id/flashcards', getMateriaFlashcards);
router.get('/:id/questoes', getMateriaQuestoes);
router.get('/:id', getMateriaById);
router.post('/', createMateria);
router.put('/:id', updateMateria);
router.delete('/:id', deleteMateria);

export default router;
