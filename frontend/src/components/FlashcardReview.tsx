import { useMemo, useState } from 'react';
import { revisarFlashcard } from '../services/flashcards';
import type { Flashcard } from '../types';

type FlashcardReviewProps = {
  flashcardsPendentes: Flashcard[];
  onReviewed?: () => void;
  onFinish?: (result: { acertos: number; erros: number }) => void;
};

type ReviewStatus = 'idle' | 'saving' | 'done';

function FlashcardReview({ flashcardsPendentes, onReviewed, onFinish }: FlashcardReviewProps) {
  const [reviewQueue] = useState<Flashcard[]>(() => flashcardsPendentes);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [acertos, setAcertos] = useState(0);
  const [erros, setErros] = useState(0);
  const [status, setStatus] = useState<ReviewStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const currentFlashcard = reviewQueue[currentIndex] || null;
  const finished = currentIndex >= reviewQueue.length;
  const total = reviewQueue.length;
  const reviewedCount = useMemo(() => acertos + erros, [acertos, erros]);

  async function handleAnswer(acertou: boolean) {
    if (!currentFlashcard || status === 'saving') {
      return;
    }

    setStatus('saving');
    setErrorMessage('');

    try {
      await revisarFlashcard(currentFlashcard.id, { acertou });
      const nextAcertos = acertou ? acertos + 1 : acertos;
      const nextErros = acertou ? erros : erros + 1;
      const nextIndex = currentIndex + 1;

      setAcertos(nextAcertos);
      setErros(nextErros);
      setCurrentIndex(nextIndex);
      setFlipped(false);
      onReviewed?.();

      if (nextIndex >= total) {
        setStatus('done');
        onFinish?.({ acertos: nextAcertos, erros: nextErros });
        return;
      }

      setStatus('idle');
    } catch {
      setErrorMessage('Não foi possível registrar a revisão. Tente novamente.');
      setStatus('idle');
    }
  }

  function restartReview() {
    setCurrentIndex(0);
    setFlipped(false);
    setAcertos(0);
    setErros(0);
    setErrorMessage('');
    setStatus('idle');
  }

  if (!total) {
    return (
      <div className="flashcard-review-empty">
        <h3>Nenhum flashcard pendente</h3>
        <p>Quando houver revisões vencidas, elas aparecerão aqui.</p>
      </div>
    );
  }

  if (finished) {
    return (
      <div className="flashcard-review-complete">
        <div className="flashcards-kicker">Revisão concluída</div>
        <h3>Você terminou todos os flashcards.</h3>
        <div className="flashcard-review-score">
          <span>{acertos} acerto(s)</span>
          <span>{erros} erro(s)</span>
        </div>
        <button className="flashcards-secondary" type="button" onClick={restartReview}>
          Revisar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="flashcard-review">
      <div className="flashcard-review-progress">
        <span>
          Card {currentIndex + 1} de {total}
        </span>
        <span>
          {acertos} acerto(s) · {erros} erro(s)
        </span>
      </div>

      <div
        className={`flashcard-flip-card${flipped ? ' flipped' : ''}`}
      >
        <div className="flashcard-flip-inner">
          <div className="flashcard-flip-face flashcard-flip-front">
            <span className="flashcard-flip-kicker">Pergunta</span>
            <strong>{currentFlashcard?.pergunta}</strong>
            <button className="flashcards-primary flashcard-reveal-btn" type="button" onClick={() => setFlipped(true)}>
              Revelar resposta
            </button>
          </div>
          <div className="flashcard-flip-face flashcard-flip-back">
            <span className="flashcard-flip-kicker">Resposta</span>
            <strong>{currentFlashcard?.resposta}</strong>
            <small>Como foi sua resposta?</small>
          </div>
        </div>
      </div>

      {errorMessage ? <div className="flashcards-form-error">{errorMessage}</div> : null}

      {flipped ? (
        <div className="flashcard-review-actions">
          <button
            className="flashcard-review-btn wrong"
            type="button"
            onClick={() => void handleAnswer(false)}
            disabled={status === 'saving'}
          >
            Errei 😓
          </button>
          <button
            className="flashcard-review-btn right"
            type="button"
            onClick={() => void handleAnswer(true)}
            disabled={status === 'saving'}
          >
            Acertei ✅
          </button>
        </div>
      ) : (
        <div className="flashcard-review-hint">{reviewedCount} revisado(s) nesta sessão.</div>
      )}
    </div>
  );
}

export default FlashcardReview;
