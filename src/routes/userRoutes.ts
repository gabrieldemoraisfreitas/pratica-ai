import { Router } from 'express';
import {
  createUser,
  getCurrentUser,
  getUserById,
  getUsers,
  loginUser,
  updateUser,
} from '../controllers/userControllers';
import { loginRateLimit, requireAuth } from '../middleware/auth';

const router = Router();

router.post('/login', loginRateLimit, loginUser);
router.post('/register', createUser);
router.post('/', createUser);
router.get('/me', requireAuth, getCurrentUser);
router.patch('/me', requireAuth, updateUser);
router.get('/', requireAuth, getUsers);
router.get('/:id', requireAuth, getUserById);
router.patch('/:id', requireAuth, updateUser);

export default router;
