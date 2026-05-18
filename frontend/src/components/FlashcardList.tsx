import { useMemo, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { criar, deletar } from '../services/flashcards';
import { listarFlashcardsDaMateria } from '../services/materias';
import type { Flashcard, Materia } from '../types';

type FlashcardListProps = {
  materias: Materia[];
  selectedMateriaId: string;
  onSelectMateria: (materiaId: string) => void;
  onClose: () => void;
  onStartReview: () => void;
};

type FlashcardForm = {
  pergunta: string;
  resposta: string;
};

const FLASHCARDS_PAGE_LIMIT = 24;

function formatReviewDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function isPendingReview(flashcard: Flashcard) {
  return new Date(flashcard.nextReview).getTime() <= Date.now();
}

function FlashcardList({ materias, selectedMateriaId, onSelectMateria, onClose, onStartReview }: FlashcardListProps) {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<FlashcardForm>({ pergunta: '', resposta: '' });
  const [formError, setFormError] = useState('');
  const [pagination, setPagination] = useState({ materiaId: '', page: 0 });

  const selectedMateria = materias.find((materia) => materia.id === selectedMateriaId) || null;
  const page = pagination.materiaId === selectedMateriaId ? pagination.page : 0;
  const flashcardsOffset = page * FLASHCARDS_PAGE_LIMIT;

  const flashcardsQuery = useQuery({
    queryKey: ['materia-flashcards', selectedMateriaId, page],
    queryFn: () =>
      listarFlashcardsDaMateria(selectedMateriaId, {
        limit: FLASHCARDS_PAGE_LIMIT,
        offset: flashcardsOffset,
      }),
    enabled: Boolean(selectedMateriaId),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      criar({
        pergunta: form.pergunta.trim(),
        resposta: form.resposta.trim(),
        materiaId: selectedMateriaId,
        dificuldade: 1,
      }),
    onSuccess: async () => {
      setForm({ pergunta: '', resposta: '' });
      setFormError('');
      setModalOpen(false);
      setPagination({ materiaId: selectedMateriaId, page: 0 });
      await queryClient.invalidateQueries({ queryKey: ['materia-flashcards', selectedMateriaId] });
      await queryClient.invalidateQueries({ queryKey: ['flashcards-pending'] });
      await queryClient.invalidateQueries({ queryKey: ['materias'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (flashcardId: string) => deletar(flashcardId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['materia-flashcards', selectedMateriaId] });
      await queryClient.invalidateQueries({ queryKey: ['flashcards-review'] });
      await queryClient.invalidateQueries({ queryKey: ['flashcards-pending'] });
      await queryClient.invalidateQueries({ queryKey: ['materias'] });
    },
  });

  const visibleFlashcards = useMemo(() => {
    if (!selectedMateriaId) {
      return [];
    }

    return flashcardsQuery.data?.items || [];
  }, [flashcardsQuery.data?.items, selectedMateriaId]);

  const pendingCount = useMemo(
    () => selectedMateria?.flashcardsPendentes ?? visibleFlashcards.filter(isPendingReview).length,
    [selectedMateria?.flashcardsPendentes, visibleFlashcards],
  );
  const totalFlashcards = flashcardsQuery.data?.total ?? selectedMateria?._count?.flashcards ?? 0;
  const hasPreviousPage = page > 0;
  const hasNextPage = flashcardsOffset + visibleFlashcards.length < totalFlashcards;
  const loading = flashcardsQuery.isLoading;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedMateriaId) {
      setFormError('Selecione uma matéria antes de criar um flashcard.');
      return;
    }

    if (!form.pergunta.trim() || !form.resposta.trim()) {
      setFormError('Preencha pergunta e resposta.');
      return;
    }

    createMutation.mutate();
  }

  function handleCardKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onStartReview();
    }
  }

  return (
    <section className="flashcards-view" aria-label="Flashcards">
      <div className="flashcards-header">
        <div>
          <div className="flashcards-kicker">Flashcards</div>
          <h2 className="flashcards-title">{selectedMateria?.nome || 'Selecione uma matéria'}</h2>
          <p className="flashcards-subtitle">
            {selectedMateria
              ? `${totalFlashcards} flashcard(s) no total. ${pendingCount} pendente(s) nesta matéria.`
              : 'Escolha uma matéria para listar e criar flashcards.'}
          </p>
        </div>
        <button className="flashcards-close" type="button" onClick={onClose}>
          Voltar
        </button>
      </div>

      <div className="flashcards-toolbar">
        <select
          className="flashcards-select"
          value={selectedMateriaId}
          onChange={(event) => {
            setPagination({ materiaId: event.target.value, page: 0 });
            onSelectMateria(event.target.value);
          }}
        >
          <option value="">Matéria</option>
          {materias.map((materia) => (
            <option key={materia.id} value={materia.id}>
              {materia.nome}
            </option>
          ))}
        </select>
        <button className="flashcards-secondary" type="button" onClick={onStartReview}>
          Estudar pendentes
        </button>
        <button
          className="flashcards-primary"
          type="button"
          onClick={() => setModalOpen(true)}
          disabled={!selectedMateriaId}
        >
          Novo flashcard
        </button>
      </div>

      {!selectedMateriaId ? (
        <div className="flashcards-empty">Selecione uma matéria na lista acima ou na sidebar.</div>
      ) : loading ? (
        <div className="flashcards-empty">Carregando flashcards...</div>
      ) : visibleFlashcards.length ? (
        <>
          <div className="flashcards-grid">
            {visibleFlashcards.map((flashcard) => (
              <article
                className="flashcard-card"
                key={flashcard.id}
                role="button"
                tabIndex={0}
                onClick={onStartReview}
                onKeyDown={handleCardKeyDown}
              >
                <div className="flashcard-card-top">
                  <span className={isPendingReview(flashcard) ? 'flashcard-status pending' : 'flashcard-status'}>
                    {isPendingReview(flashcard) ? 'Pendente' : 'Agendado'}
                  </span>
                  <button
                    className="flashcard-delete"
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      deleteMutation.mutate(flashcard.id);
                    }}
                    disabled={deleteMutation.isPending}
                  >
                    Excluir
                  </button>
                </div>
                <div className="flashcard-question">{flashcard.pergunta}</div>
                <div className="flashcard-answer">{flashcard.resposta}</div>
                <div className="flashcard-meta">
                  <span>Dificuldade {flashcard.dificuldade ?? 1}</span>
                  <span>Próxima revisão: {formatReviewDate(flashcard.nextReview)}</span>
                </div>
              </article>
            ))}
          </div>
          {totalFlashcards > FLASHCARDS_PAGE_LIMIT ? (
            <div className="flashcards-pagination">
              <button
                className="flashcards-secondary"
                type="button"
                onClick={() =>
                  setPagination((current) => ({
                    materiaId: selectedMateriaId,
                    page: Math.max((current.materiaId === selectedMateriaId ? current.page : 0) - 1, 0),
                  }))
                }
                disabled={!hasPreviousPage}
              >
                Anterior
              </button>
              <span>
                {flashcardsOffset + 1}-{flashcardsOffset + visibleFlashcards.length} de {totalFlashcards}
              </span>
              <button
                className="flashcards-secondary"
                type="button"
                onClick={() =>
                  setPagination((current) => ({
                    materiaId: selectedMateriaId,
                    page: (current.materiaId === selectedMateriaId ? current.page : 0) + 1,
                  }))
                }
                disabled={!hasNextPage}
              >
                Próxima
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <div className="flashcards-empty">Nenhum flashcard criado para esta matéria.</div>
      )}

      {modalOpen ? (
        <div className="flashcards-modal-overlay" onClick={() => setModalOpen(false)}>
          <form className="flashcards-modal" onSubmit={handleSubmit} onClick={(event) => event.stopPropagation()}>
            <div className="flashcards-modal-head">
              <div>
                <h3>Novo flashcard</h3>
                <p>{selectedMateria?.nome}</p>
              </div>
              <button className="flashcards-icon-btn" type="button" onClick={() => setModalOpen(false)}>
                Fechar
              </button>
            </div>

            {formError ? <div className="flashcards-form-error">{formError}</div> : null}

            <label className="flashcards-label" htmlFor="flashcard-pergunta">
              Pergunta
            </label>
            <textarea
              id="flashcard-pergunta"
              className="flashcards-textarea"
              value={form.pergunta}
              onChange={(event) => setForm((current) => ({ ...current, pergunta: event.target.value }))}
              rows={3}
            />

            <label className="flashcards-label" htmlFor="flashcard-resposta">
              Resposta
            </label>
            <textarea
              id="flashcard-resposta"
              className="flashcards-textarea"
              value={form.resposta}
              onChange={(event) => setForm((current) => ({ ...current, resposta: event.target.value }))}
              rows={4}
            />

            <button className="flashcards-primary flashcards-submit" type="submit" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Salvando...' : 'Salvar flashcard'}
            </button>
          </form>
        </div>
      ) : null}
    </section>
  );
}

export default FlashcardList;
