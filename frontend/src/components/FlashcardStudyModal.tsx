import { useQuery, useQueryClient } from '@tanstack/react-query';
import { listarPendentes } from '../services/flashcards';
import FlashcardReview from './FlashcardReview';

type FlashcardStudyModalProps = {
  open: boolean;
  onClose: () => void;
};

function FlashcardStudyModal({ open, onClose }: FlashcardStudyModalProps) {
  const queryClient = useQueryClient();
  const pendingQuery = useQuery({
    queryKey: ['flashcards-review'],
    queryFn: () => listarPendentes(),
    enabled: open,
  });

  async function refreshFlashcards() {
    await queryClient.invalidateQueries({ queryKey: ['flashcards-review'] });
    await queryClient.invalidateQueries({ queryKey: ['flashcards-pending'] });
    await queryClient.invalidateQueries({ queryKey: ['flashcards'] });
    await queryClient.invalidateQueries({ queryKey: ['materias'] });
  }

  if (!open) {
    return null;
  }

  return (
    <div className="study-modal-overlay" role="dialog" aria-modal="true" aria-label="Estudo de flashcards">
      <section className="study-modal">
        <header className="study-modal-head">
          <div>
            <div className="flashcards-kicker">Modo estudo</div>
            <h2>Revisar flashcards pendentes</h2>
          </div>
          <button className="flashcards-close" type="button" onClick={onClose}>
            Fechar
          </button>
        </header>

        {pendingQuery.isLoading ? (
          <div className="flashcards-empty">Carregando flashcards pendentes...</div>
        ) : pendingQuery.isError ? (
          <div className="flashcards-empty">Nao foi possivel carregar os flashcards.</div>
        ) : (
          <FlashcardReview
            flashcardsPendentes={pendingQuery.data || []}
            onReviewed={() => void refreshFlashcards()}
            onFinish={() => void refreshFlashcards()}
          />
        )}
      </section>
    </div>
  );
}

export default FlashcardStudyModal;
