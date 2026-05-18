import { app, authHeader, createTestUser, request } from './testHelpers';

const mockFetch = jest.fn();

function mockOpenRouterContent(content: string) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      choices: [
        {
          message: {
            content,
          },
        },
      ],
    }),
  });
}

let userToken = '';

async function postAprenderWithMockedContent(content: string, options: { authenticated?: boolean } = { authenticated: true }) {
  mockOpenRouterContent(content);

  const apiRequest = request(app).post('/chat/aprender');

  if (options.authenticated !== false) {
    apiRequest.set(authHeader(userToken));
  }

  return apiRequest.send({ topic: 'Tema de teste' });
}

describe('POST /chat/aprender parsing', () => {
  const originalFetch = global.fetch;
  const originalApiKey = process.env.OPENROUTER_API_KEY;
  const originalFallbackModels = process.env.FALLBACK_MODELS;
  let warnSpy: jest.SpyInstance;

  beforeAll(async () => {
    const testUser = await createTestUser();
    userToken = testUser.token;
  });

  beforeEach(() => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    process.env.FALLBACK_MODELS = 'test/model:free';
    global.fetch = mockFetch as unknown as typeof fetch;
    mockFetch.mockReset();
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.OPENROUTER_API_KEY = originalApiKey;
    process.env.FALLBACK_MODELS = originalFallbackModels;
    warnSpy.mockRestore();
  });

  it('retorna texto, materia e flashcard quando o JSON final e valido', async () => {
    mockOpenRouterContent(`Explicacao curta sobre regra de tres.

---JSON---
{
  "materia": "Matemática",
  "flashcard": {
    "frente": "Quando usar regra de tres?",
    "verso": "Quando duas grandezas proporcionais tem um valor desconhecido."
  }
}
---FIM---`);

    const response = await request(app)
      .post('/chat/aprender')
      .set(authHeader(userToken))
      .send({ topic: 'Me explica regra de tres' });

    expect(response.status).toBe(200);
    expect(response.body.aiReply).toBe('Explicacao curta sobre regra de tres.');
    expect(response.body.resposta).toBe('Explicacao curta sobre regra de tres.');
    expect(response.body.materia).toBe('Matemática');
    expect(response.body.flashcard).toEqual({
      frente: 'Quando usar regra de tres?',
      verso: 'Quando duas grandezas proporcionais tem um valor desconhecido.',
    });
  });

  it('retorna HTTP 200 e texto completo quando a IA ignora o bloco JSON', async () => {
    mockOpenRouterContent('Aqui vai uma explicacao em texto livre, mas sem metadados estruturados.');

    const response = await request(app)
      .post('/chat/aprender')
      .set(authHeader(userToken))
      .send({ topic: 'O que e fotossintese?' });

    expect(response.status).toBe(200);
    expect(response.body.aiReply).toBe('Aqui vai uma explicacao em texto livre, mas sem metadados estruturados.');
    expect(response.body.materia).toBeNull();
    expect(response.body.flashcard).toBeNull();
  });

  it('retorna HTTP 200 e texto completo quando o JSON esta malformado', async () => {
    mockOpenRouterContent(`Explicacao antes dos metadados.

---JSON---
{ "materia": "Física", "flashcard": { "frente": "O que e velocidade?", "verso":  }
---FIM---`);

    const response = await request(app)
      .post('/chat/aprender')
      .set(authHeader(userToken))
      .send({ topic: 'O que e velocidade media?' });

    expect(response.status).toBe(200);
    expect(response.body.aiReply).toContain('Explicacao antes dos metadados.');
    expect(response.body.materia).toBeNull();
    expect(response.body.flashcard).toBeNull();
  });

  it('extrai JSON dentro de fenced code block', async () => {
    const response = await postAprenderWithMockedContent(`Aqui está a resposta do tutor.

---JSON---
\`\`\`json
{ "materia": "Matemática", "flashcard": { "frente": "O que é proporção?", "verso": "É uma igualdade entre razões." } }
\`\`\`
---FIM---`);

    expect(response.status).toBe(200);
    expect(response.body.resposta).toBe('Aqui está a resposta do tutor.');
    expect(response.body.materia).toBe('Matemática');
    expect(response.body.flashcard).toEqual({
      frente: 'O que é proporção?',
      verso: 'É uma igualdade entre razões.',
    });
  });

  it('aceita delimitadores em minusculas', async () => {
    const response = await postAprenderWithMockedContent(`Resposta do tutor.

---json---
{ "materia": "Física" }
---fim---`);

    expect(response.status).toBe(200);
    expect(response.body.resposta).toBe('Resposta do tutor.');
    expect(response.body.materia).toBe('Física');
    expect(response.body.flashcard).toBeNull();
  });

  it('ignora texto depois do delimitador final', async () => {
    const response = await postAprenderWithMockedContent(`Resposta do tutor.

---JSON---
{ "materia": "Biologia", "flashcard": null }
---FIM---

Espero que tenha ajudado!`);

    expect(response.status).toBe(200);
    expect(response.body.resposta).toBe('Resposta do tutor.');
    expect(response.body.materia).toBe('Biologia');
    expect(response.body.flashcard).toBeNull();
  });

  it('normaliza aspas curly antes do parse', async () => {
    const response = await postAprenderWithMockedContent(`Explicação de história.

---JSON---
{ “materia”: “História”, “flashcard”: { “frente”: “O que foi a Revolução Francesa?”, “verso”: “Um processo político e social iniciado em 1789 na França.” } }
---FIM---`);

    expect(response.status).toBe(200);
    expect(response.body.resposta).toBe('Explicação de história.');
    expect(response.body.materia).toBe('História');
    expect(response.body.flashcard).toEqual({
      frente: 'O que foi a Revolução Francesa?',
      verso: 'Um processo político e social iniciado em 1789 na França.',
    });
  });

  it('trata flashcard ausente como null', async () => {
    const response = await postAprenderWithMockedContent(`Resumo de química.

---JSON---
{ "materia": "Química" }
---FIM---`);

    expect(response.status).toBe(200);
    expect(response.body.resposta).toBe('Resumo de química.');
    expect(response.body.materia).toBe('Química');
    expect(response.body.flashcard).toBeNull();
  });

  it('retorna HTTP 200 quando nao ha delimitador nem JSON', async () => {
    const response = await postAprenderWithMockedContent('A fotossíntese é o processo pelo qual plantas produzem glicose usando luz.');

    expect(response.status).toBe(200);
    expect(response.body.resposta).toBe('A fotossíntese é o processo pelo qual plantas produzem glicose usando luz.');
    expect(response.body.materia).toBeNull();
    expect(response.body.flashcard).toBeNull();
  });

  it('nao retorna nem exibe JSON de metadados para visitante', async () => {
    const response = await postAprenderWithMockedContent(`SLA significa Service Level Agreement.

---
JSON
{
  "materia": "Programação",
  "flashcard": {
    "frente": "O que é SLA?",
    "verso": "Acordo de nível de serviço."
  }
}`, { authenticated: false });

    expect(response.status).toBe(200);
    expect(response.body.resposta).toBe('SLA significa Service Level Agreement.');
    expect(response.body.aiReply).toBe('SLA significa Service Level Agreement.');
    expect(response.body.materia).toBeNull();
    expect(response.body.flashcard).toBeNull();
    expect(response.body.flashcardSuggestion).toBeNull();
  });
});
