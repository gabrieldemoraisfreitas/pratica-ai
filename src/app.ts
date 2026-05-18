import express from 'express';
import cors from 'cors';
import userRoutes from './routes/userRoutes';
import materiaRoutes from './routes/materiaRoutes';
import flashcardRoutes from './routes/flashcardRoutes';
import questaoRoutes from './routes/questaoRoutes';
import respostaQuestaoRoutes from './routes/respostaQuestaoRoutes';
import desafioRoutes from './routes/desafioRoutes';
import notificacaoRoutes from './routes/notificacaoRoutes';
import chatRoutes from './routes/chatRoutes';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

const app = express();

app.disable('x-powered-by');
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/', (_req, res) => {
  res.json({ status: 'OK', message: 'Servidor funcionando!' });
});

app.use('/users', userRoutes);
app.use('/materias', materiaRoutes);
app.use('/flashcards', flashcardRoutes);
app.use('/questoes', questaoRoutes);
app.use('/respostas', respostaQuestaoRoutes);
app.use('/desafios', desafioRoutes);
app.use('/notificacoes', notificacaoRoutes);
app.use('/chat', chatRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
