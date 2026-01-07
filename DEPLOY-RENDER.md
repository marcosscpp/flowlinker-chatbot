# Deploy no Render

Guia para fazer deploy do chatbot no Render.

## Arquitetura

O projeto precisa de **2 serviços** no Render:

| Serviço | Tipo | Função |
|---------|------|--------|
| `chatbot-server` | Web Service | Recebe webhooks do WhatsApp |
| `chatbot-worker` | Background Worker | Processa mensagens da fila |

## Pré-requisitos

Antes de começar, você precisa ter:

- [ ] Conta no [Render](https://render.com)
- [ ] Repositório no GitHub com o código
- [ ] RabbitMQ rodando (use [CloudAMQP](https://www.cloudamqp.com/) - tem plano grátis)
- [ ] PostgreSQL rodando (use Render PostgreSQL ou externo)
- [ ] Evolution API configurada
- [ ] Chave da OpenAI

---

## Opção 1: Deploy Automático (Blueprint)

O arquivo `render.yaml` já está configurado. Basta:

1. Acesse [Render Dashboard](https://dashboard.render.com)
2. Clique em **New** → **Blueprint**
3. Conecte seu repositório GitHub
4. O Render vai detectar o `render.yaml` automaticamente
5. Configure as variáveis de ambiente (veja abaixo)
6. Clique em **Apply**

---

## Opção 2: Deploy Manual

### Passo 1: Criar Web Service (Server)

1. No Render, clique em **New** → **Web Service**
2. Conecte seu repositório GitHub
3. Configure:

| Campo | Valor |
|-------|-------|
| Name | `chatbot-server` |
| Region | Oregon (ou mais próximo) |
| Branch | `main` |
| Runtime | Node |
| Build Command | `npm install && npm run build && npx prisma generate` |
| Start Command | `npm run start` |
| Plan | Starter ($7/mês) ou Free (com limitações) |

4. Clique em **Create Web Service**

### Passo 2: Criar Background Worker

1. No Render, clique em **New** → **Background Worker**
2. Conecte o mesmo repositório
3. Configure:

| Campo | Valor |
|-------|-------|
| Name | `chatbot-worker` |
| Region | Oregon (mesmo do server) |
| Branch | `main` |
| Runtime | Node |
| Build Command | `npm install && npm run build && npx prisma generate` |
| Start Command | `npm run start:worker` |
| Plan | Starter ($7/mês) |

4. Clique em **Create Background Worker**

---

## Variáveis de Ambiente

Configure as mesmas variáveis nos **dois serviços**:

### Obrigatórias

```env
NODE_ENV=production
OPENAI_API_KEY=sk-proj-xxx
EVOLUTION_API_URL=https://sua-evolution.com
EVOLUTION_API_KEY=sua-chave
EVOLUTION_INSTANCE=sua-instancia
DATABASE_URL=postgresql://user:pass@host:5432/db
RABBITMQ_URL=amqps://user:pass@host/vhost
GOOGLE_CREDENTIALS_JSON={"type":"service_account",...}
```

### Opcionais

```env
PORT=3000
DEBOUNCE_DELAY=3000
```

### Onde conseguir cada variável:

| Variável | Onde conseguir |
|----------|----------------|
| `OPENAI_API_KEY` | [OpenAI Platform](https://platform.openai.com/api-keys) |
| `EVOLUTION_*` | Sua instância Evolution API |
| `DATABASE_URL` | Render PostgreSQL ou seu banco |
| `RABBITMQ_URL` | [CloudAMQP](https://www.cloudamqp.com/) (grátis) |
| `GOOGLE_CREDENTIALS_JSON` | Veja seção abaixo |

---

## Configurar Google Credentials

O arquivo `credentials.json` não pode ir para o Git. Use variável de ambiente no Render.

### Gerar a string automaticamente:

```bash
npm run convert:credentials
```

Isso vai ler `credentials/credentials.json` e mostrar o JSON convertido para uma linha.

### Passos:

1. Execute `npm run convert:credentials` localmente
2. Copie a string gerada (linha inteira entre os traços)
3. No Render, adicione a variável `GOOGLE_CREDENTIALS_JSON` com esse valor
4. Adicione nos **dois serviços** (server e worker)

> **Veja mais detalhes em:** `GOOGLE_CREDENTIALS_RENDER.md`

---

## Configurar RabbitMQ (CloudAMQP)

1. Acesse [CloudAMQP](https://www.cloudamqp.com/)
2. Crie uma conta gratuita
3. Crie uma instância (plano "Little Lemur" é grátis)
4. Copie a URL AMQP (formato: `amqps://user:pass@host/vhost`)
5. Use essa URL na variável `RABBITMQ_URL`

---

## Configurar PostgreSQL no Render

1. No Render, clique em **New** → **PostgreSQL**
2. Configure:
   - Name: `chatbot-db`
   - Region: Oregon (mesmo dos serviços)
   - Plan: Free (90 dias) ou Starter ($7/mês)
3. Após criar, copie a **Internal Database URL**
4. Use na variável `DATABASE_URL`

---

## Configurar Webhook da Evolution API

Após o deploy, pegue a URL do seu Web Service:

```
https://chatbot-server-xxxx.onrender.com
```

Configure na Evolution API:

```
Webhook URL: https://chatbot-server-xxxx.onrender.com/webhook/messages-upsert
Eventos: MESSAGES_UPSERT
```

---

## Verificar se está funcionando

### Health Check

```bash
curl https://chatbot-server-xxxx.onrender.com/health
```

Resposta esperada:
```json
{
  "status": "ok",
  "timestamp": "2026-01-07T15:00:00.000Z",
  "queue": {
    "connected": true,
    "messages": 0,
    "consumers": 1
  }
}
```

### Logs

No dashboard do Render, clique no serviço e vá em **Logs** para ver os logs em tempo real.

---

## Custos Estimados

| Serviço | Plano | Custo |
|---------|-------|-------|
| Web Service | Starter | $7/mês |
| Background Worker | Starter | $7/mês |
| PostgreSQL | Free/Starter | $0-7/mês |
| CloudAMQP | Little Lemur | $0/mês |
| **Total** | | **~$14-21/mês** |

> **Nota**: O plano Free do Render "dorme" após 15min de inatividade, o que pode causar delay nos webhooks. Para produção, use o plano Starter.

---

## Troubleshooting

### Erro: "Cannot connect to RabbitMQ"

- Verifique se a URL do RabbitMQ está correta
- CloudAMQP usa `amqps://` (com SSL), não `amqp://`

### Erro: "Database connection failed"

- Verifique se a `DATABASE_URL` está correta
- Se usar Render PostgreSQL, use a **Internal URL** (não a External)

### Worker não processa mensagens

- Verifique se o Worker está rodando (status "Live")
- Verifique os logs do Worker
- Confirme que `RABBITMQ_URL` é igual nos dois serviços

### Webhook não recebe mensagens

- Confirme a URL do webhook na Evolution API
- Verifique se o evento `MESSAGES_UPSERT` está ativado
- Teste o health check do servidor

### Erro: "Credenciais do Google não encontradas"

- Verifique se `GOOGLE_CREDENTIALS_JSON` está configurado nos **dois serviços**
- Confirme que o JSON está completo e em uma linha só
- Execute `npm run convert:credentials` localmente para gerar a string correta

### Erro: "GOOGLE_CREDENTIALS_JSON inválido"

- O JSON pode estar mal formatado
- Certifique-se de que copiou a string inteira
- Use o script `npm run convert:credentials` para gerar novamente

---

## Comandos úteis locais

```bash
# Build
npm run build

# Rodar servidor local
npm run dev

# Rodar worker local
npm run dev:worker

# Gerar Prisma
npx prisma generate

# Push do schema
npx prisma db push
```

