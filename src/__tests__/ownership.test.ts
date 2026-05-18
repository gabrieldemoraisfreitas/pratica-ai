import {
  app,
  authHeader,
  cleanTestData,
  createTestUser,
  disconnectPrisma,
  request,
} from './testHelpers';

describe('isolamento de propriedade', () => {
  beforeAll(async () => {
    await cleanTestData();
  });

  afterAll(async () => {
    await cleanTestData();
    await disconnectPrisma();
  });

  it('userB nao acessa materia criada por userA', async () => {
    const userA = await createTestUser({ nome: 'User A' });
    const userB = await createTestUser({ nome: 'User B' });

    const materia = await request(app)
      .post('/materias')
      .set(authHeader(userA.token))
      .send({ nome: 'Matematica', cor: '#7c3aed' });

    const response = await request(app).get(`/materias/${materia.body.id}`).set(authHeader(userB.token));

    expect([403, 404]).toContain(response.status);
  });

  it('userB nao revisa flashcard criado por userA', async () => {
    const userA = await createTestUser({ nome: 'User A Flashcard' });
    const userB = await createTestUser({ nome: 'User B Flashcard' });

    const materia = await request(app)
      .post('/materias')
      .set(authHeader(userA.token))
      .send({ nome: 'Fisica', cor: '#0ea5e9' });

    const flashcard = await request(app)
      .post('/flashcards')
      .set(authHeader(userA.token))
      .send({
        materiaId: materia.body.id,
        pergunta: 'O que e gravidade?',
        resposta: 'Atracao entre massas.',
      });

    const response = await request(app)
      .post(`/flashcards/${flashcard.body.id}/review`)
      .set(authHeader(userB.token))
      .send({ acertou: true });

    expect([403, 404]).toContain(response.status);
  });

  it('userB nao deleta materia criada por userA', async () => {
    const userA = await createTestUser({ nome: 'User A Delete' });
    const userB = await createTestUser({ nome: 'User B Delete' });

    const materia = await request(app)
      .post('/materias')
      .set(authHeader(userA.token))
      .send({ nome: 'Historia', cor: '#f59e0b' });

    const response = await request(app).delete(`/materias/${materia.body.id}`).set(authHeader(userB.token));

    expect([403, 404]).toContain(response.status);
  });
});
