import { Router } from 'express';
import {
  createFlashcard,
  deleteFlashcard,
  getFlashcardById,
  getFlashcardsByMateria,
  getFlashcardsForReview,
  getPendingReviewCount,
  reviewFlashcard,
  updateFlashcard,
} from '../controllers/flashcardController';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.use(requireAuth);
router.get('/materia/:materiaId', getFlashcardsByMateria);
router.get('/review', getFlashcardsForReview);
router.get('/pending-count', getPendingReviewCount);
router.get('/:id', getFlashcardById);
router.post('/', createFlashcard);
router.post('/:id/review', reviewFlashcard);
router.put('/:id', updateFlashcard);
router.delete('/:id', deleteFlashcard);

export default router;
