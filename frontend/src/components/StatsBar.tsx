type StatsBarProps = {
  materiasCount: number;
  revisoesPendentesCount: number;
  conversasCount: number;
  onStartFlashcardStudy?: () => void;
};

function StatsBar({ materiasCount, revisoesPendentesCount, conversasCount, onStartFlashcardStudy }: StatsBarProps) {
  const flashcardLabel = revisoesPendentesCount === 1 ? '1 pendente' : `${revisoesPendentesCount} pendentes`;

  return (
    <div className="stats-bar" aria-label="Resumo do estudo">
      <div className="stats-item">
        <strong>{materiasCount}</strong>
        <span>matérias</span>
      </div>
      <button className="stats-item stats-item-button" type="button" onClick={onStartFlashcardStudy}>
        <strong>{revisoesPendentesCount}</strong>
        <span>revisões pendentes</span>
        <span className="stats-badge">{flashcardLabel}</span>
      </button>
      <div className="stats-item">
        <strong>{conversasCount}</strong>
        <span>conversas</span>
      </div>
    </div>
  );
}

export default StatsBar;
