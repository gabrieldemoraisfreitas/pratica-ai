import {
  app,
  authHeader,
  cleanTestData,
  createExpiredToken,
  createTestUser,
  disconnectPrisma,
  request,
  TEST_EMAIL_DOMAIN,
  TEST_PASSWORD,
} from './testHelpers';

describe('autenticacao', () => {
  beforeAll(async () => {
    await cleanTestData();
  });

  afterAll(async () => {
    await cleanTestData();
    await disconnectPrisma();
  });

  it('POST /users/register com dados validos retorna 201 e token', async () => {
    const response = await request(app)
      .post('/users/register')
      .send({
        nome: 'Usuario Registro',
        email: `registro.${Date.now()}${TEST_EMAIL_DOMAIN}`,
        senha: TEST_PASSWORD,
      });

    expect(response.status).toBe(201);
    expect(response.body.token).toEqual(expect.any(String));
    expect(response.body.user.email).toContain(TEST_EMAIL_DOMAIN);
  });

  it('POST /users/register sem nome e interesses retorna 201 com campos nulos', async () => {
    const response = await request(app)
      .post('/users/register')
      .send({
        email: `registro-sem-nome.${Date.now()}${TEST_EMAIL_DOMAIN}`,
        senha: TEST_PASSWORD,
      });

    expect(response.status).toBe(201);
    expect(response.body.token).toEqual(expect.any(String));
    expect(response.body.user.nome).toBeNull();
    expect(response.body.user.interests).toBeNull();
  });

  it('POST /users/register com senha menor que 6 caracteres retorna 400', async () => {
    const response = await request(app)
      .post('/users/register')
      .send({
        nome: 'Senha Curta',
        email: `senha-curta.${Date.now()}${TEST_EMAIL_DOMAIN}`,
        senha: '1234',
      });

    expect(response.status).toBe(400);
  });

  it('POST /users/register com email duplicado retorna 400', async () => {
    const email = `duplicado.${Date.now()}${TEST_EMAIL_DOMAIN}`;

    await request(app).post('/users/register').send({
      nome: 'Duplicado',
      email,
      senha: TEST_PASSWORD,
    });

    const response = await request(app).post('/users/register').send({
      nome: 'Duplicado Dois',
      email,
      senha: TEST_PASSWORD,
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Ja existe um usuario com esse email');
  });

  it('POST /users/login com credenciais corretas retorna token', async () => {
    const user = await createTestUser({ email: `login.${Date.now()}${TEST_EMAIL_DOMAIN}` });

    const response = await request(app)
      .post('/users/login')
      .send({
        email: user.user.email,
        senha: user.password,
      });

    expect(response.status).toBe(200);
    expect(response.body.token).toEqual(expect.any(String));
  });

  it('POST /users/login com senha errada retorna 401', async () => {
    const user = await createTestUser({ email: `senha-errada.${Date.now()}${TEST_EMAIL_DOMAIN}` });

    const response = await request(app)
      .post('/users/login')
      .send({
        email: user.user.email,
        senha: 'senha-errada',
      });

    expect(response.status).toBe(401);
  });

  it('GET /materias sem token retorna 401', async () => {
    const response = await request(app).get('/materias');

    expect(response.status).toBe(401);
  });

  it('GET /materias com token expirado retorna 401', async () => {
    const user = await createTestUser({ email: `expirado.${Date.now()}${TEST_EMAIL_DOMAIN}` });
    const expiredToken = createExpiredToken(user.user.id, user.user.tokenVersion);

    const response = await request(app).get('/materias').set(authHeader(expiredToken));

    expect(response.status).toBe(401);
  });
});
