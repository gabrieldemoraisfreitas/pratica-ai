import {
  app,
  authHeader,
  cleanTestData,
  createTestUser,
  disconnectPrisma,
  request,
} from './testHelpers';

function isSameDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

async function createMateriaAndFlashcard(token: string) {
  const materia = await request(app)
    .post('/materias')
    .set(authHeader(token))
    .send({ nome: `Materia ${Date.now()}`, cor: '#22c55e' });

  const flashcard = await request(app)
    .post('/flashcards')
    .set(authHeader(token))
    .send({
      materiaId: materia.body.id,
      pergunta: 'Pergunta de teste',
      resposta: 'Resposta de teste',
    });

  return {
    materia: materia.body,
    flashcard: flashcard.body,
  };
}

describe('flashcards', () => {
  beforeAll(async () => {
    await cleanTestData();
  });

  afterAll(async () => {
    await cleanTestData();
    await disconnectPrisma();
  });

  it('criar flashcard define nextReview para hoje', async () => {
    const user = await createTestUser();
    const { flashcard } = await createMateriaAndFlashcard(user.token);

    expect(isSameDay(new Date(flashcard.nextReview), new Date())).toBe(true);
  });

  it('revisar com acerto dobra o intervalo', async () => {
    const user = await createTestUser();
    const { flashcard } = await createMateriaAndFlashcard(user.token);

    const response = await request(app)
      .post(`/flashcards/${flashcard.id}/review`)
      .set(authHeader(user.token))
      .send({ acertou: true });

    expect(response.status).toBe(200);
    expect(response.body.reviewInterval).toBe(2);
  });

  it('revisar com erro volta o intervalo para 1 dia', async () => {
    const user = await createTestUser();
    const { flashcard } = await createMateriaAndFlashcard(user.token);

    await request(app)
      .post(`/flashcards/${flashcard.id}/review`)
      .set(authHeader(user.token))
      .send({ acertou: true });

    const response = await request(app)
      .post(`/flashcards/${flashcard.id}/review`)
      .set(authHeader(user.token))
      .send({ acertou: false });

    expect(response.status).toBe(200);
    expect(response.body.reviewInterval).toBe(1);
  });

  it('deletar materia com flashcards funciona sem erro 500', async () => {
    const user = await createTestUser();
    const { materia } = await createMateriaAndFlashcard(user.token);

    const response = await request(app).delete(`/materias/${materia.id}`).set(authHeader(user.token));

    expect(response.status).toBe(204);
  });
});
