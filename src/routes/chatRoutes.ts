import { Router } from 'express';
import { createAprenderChat, getSavedChat, listSavedChats } from '../controllers/chatController';
import { optionalAuth, requireAuth } from '../middleware/auth';

const router = Router();

router.get('/conversations', requireAuth, listSavedChats);
router.get('/conversations/:chatId', requireAuth, getSavedChat);
router.post('/aprender', optionalAuth, createAprenderChat);

export default router;
