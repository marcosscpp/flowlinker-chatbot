# Google Workspace + Google Meet - Guia Completo

Este guia explica como configurar o Google Workspace para gerar links do Google Meet automaticamente no sistema de agendamento.

---

## Resumo Executivo

| Pergunta | Resposta |
|----------|----------|
| Preciso pagar por usuário? | **Não necessariamente**. Uma licença pode gerenciar múltiplos calendários |
| Qual plano usar? | **Business Starter** (mínimo) ou **Business Standard** (recomendado) |
| Custo mensal | $7-8/mês (Starter) ou $12-14/mês (Standard) |
| Posso usar 1 conta para vários vendedores? | **Sim**, usando calendários secundários |

---

## Modelo de Licenciamento

### Opção 1: Uma Licença com Calendários Secundários (RECOMENDADO)

Com **uma única licença** do Google Workspace, você pode:

1. Criar uma conta principal: `agendamentos@suaempresa.com`
2. Criar **calendários secundários** para cada vendedor:
   - `Vendedor João`
   - `Vendedor Maria`
   - `Vendedor Pedro`
3. O Service Account impersona a conta principal
4. Eventos são criados nos calendários secundários com link do Meet

**Vantagens:**
- Custo fixo (1 licença apenas)
- Gerenciamento centralizado
- Todos os links Meet são gerados pela mesma conta

**Desvantagens:**
- Vendedores não recebem notificações diretas no email pessoal
- Precisa compartilhar calendários manualmente com vendedores

### Opção 2: Uma Licença por Vendedor

Cada vendedor tem sua própria conta Google Workspace.

**Vantagens:**
- Cada um recebe notificações no próprio email
- Mais autonomia para cada vendedor

**Desvantagens:**
- Custo proporcional ao número de vendedores
- 5 vendedores = 5 licenças = ~$35-40/mês

---

## Comparativo de Planos

| Recurso | Business Starter | Business Standard |
|---------|------------------|-------------------|
| Preço/mês (anual) | $7.00 | $12.00 |
| Preço/mês (mensal) | $8.40 | $14.40 |
| Google Meet links | ✅ Sim | ✅ Sim |
| Calendários secundários | ✅ Sim | ✅ Sim |
| Domain-wide delegation | ✅ Sim | ✅ Sim |
| Verificar disponibilidade em múltiplos calendários | ❌ Não | ✅ Sim |
| Armazenamento | 30 GB/usuário | 2 TB/usuário |
| Gravação de reuniões | ❌ Não | ✅ Sim |

**Recomendação:** Para o seu caso, **Business Starter** é suficiente. O sistema já verifica disponibilidade via API, não precisa do recurso nativo do Calendar.

---

## Passo a Passo: Do Pagamento ao Deploy

### FASE 1: Contratar Google Workspace

#### 1.1 Acessar página de compra
1. Acesse: https://workspace.google.com/pricing
2. Clique em **"Começar"** no plano Business Starter

#### 1.2 Configurar domínio
1. Informe o nome da empresa
2. Escolha: **"Usar um domínio que já tenho"** ou **"Comprar um novo domínio"**
3. Se já tem domínio, informe (ex: `flowlinker.com.br`)

#### 1.3 Criar conta de administrador
1. Crie o primeiro usuário (ex: `admin@flowlinker.com.br`)
2. Este será o super administrador
3. Guarde a senha em local seguro

#### 1.4 Verificar propriedade do domínio
1. O Google pedirá para provar que você é dono do domínio
2. Opções comuns:
   - Adicionar registro TXT no DNS
   - Adicionar registro CNAME
   - Upload de arquivo HTML
3. Após verificação, o Workspace é ativado

#### 1.5 Pagamento
1. Adicione forma de pagamento (cartão de crédito)
2. Escolha plano anual (mais barato) ou mensal
3. Confirme a compra

---

### FASE 2: Criar Conta de Agendamentos

#### 2.1 Criar usuário dedicado
1. Acesse: https://admin.google.com
2. Vá em **Diretório > Usuários > Adicionar novo usuário**
3. Crie: `agendamentos@seudominio.com`
4. Esta conta será usada pelo Service Account

#### 2.2 Criar calendários secundários (um por vendedor)
1. Acesse https://calendar.google.com com a conta `agendamentos@`
2. No menu lateral, clique em **"+" ao lado de "Outros calendários"**
3. Selecione **"Criar nova agenda"**
4. Nomeie: `Vendedor João`, `Vendedor Maria`, etc.
5. Anote o **ID do calendário** de cada um (Configurações > Integrar agenda)
   - Formato: `abc123xyz@group.calendar.google.com`

---

### FASE 3: Configurar Service Account

#### 3.1 Criar projeto no Google Cloud
1. Acesse: https://console.cloud.google.com
2. Crie novo projeto: `flowlinker-agendamentos`
3. Ative a **Google Calendar API**:
   - Menu > APIs e Serviços > Biblioteca
   - Busque "Google Calendar API" > Ativar

#### 3.2 Criar Service Account
1. Menu > IAM e Admin > Contas de serviço
2. Clique **"Criar conta de serviço"**
3. Nome: `calendar-bot`
4. Clique em **Continuar** (pule as permissões opcionais)
5. Clique em **Concluído**

#### 3.3 Gerar chave JSON
1. Clique na conta de serviço criada
2. Aba **Chaves > Adicionar chave > Criar nova chave**
3. Selecione **JSON**
4. Baixe o arquivo (guarde com segurança!)

#### 3.4 Ativar Domain-Wide Delegation
1. Na conta de serviço, clique em **Editar**
2. Marque **"Ativar delegação em todo o domínio do Google Workspace"**
3. Salve
4. Copie o **ID do cliente** (número grande)

#### 3.5 Autorizar no Admin Console
1. Acesse: https://admin.google.com
2. Vá em **Segurança > Controles de API > Delegação em todo o domínio**
3. Clique **"Adicionar novo"**
4. Cole o **ID do cliente** do Service Account
5. Em escopos OAuth, adicione:
   ```
   https://www.googleapis.com/auth/calendar
   https://www.googleapis.com/auth/calendar.events
   ```
6. Clique **Autorizar**

---

### FASE 4: Atualizar o Código

#### 4.1 Atualizar config/google.ts

O código precisa **impersonar** o usuário do Workspace para criar links do Meet:

```typescript
// src/config/google.ts
import { google } from "googleapis";

const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON || "{}");

// Email da conta Workspace que será impersonada
const IMPERSONATE_EMAIL = "agendamentos@seudominio.com";

export const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: [
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/calendar.events",
  ],
  // IMPORTANTE: Impersonar usuário do Workspace
  clientOptions: {
    subject: IMPERSONATE_EMAIL,
  },
});

export const calendar = google.calendar({ version: "v3", auth });
```

#### 4.2 Atualizar services/calendar.ts

Adicionar `conferenceData` ao criar evento:

```typescript
// Dentro de createCalendarEvent()
const event = await calendar.events.insert({
  calendarId: seller.calendarId,
  conferenceDataVersion: 1, // IMPORTANTE: Habilita criação de Meet
  requestBody: {
    summary: `Reunião - ${clientName}`,
    description: `Demonstração Flowlinker\nCliente: ${clientName}\nTelefone: ${clientPhone}`,
    start: {
      dateTime: startTime.toISOString(),
      timeZone: "America/Sao_Paulo",
    },
    end: {
      dateTime: endTime.toISOString(),
      timeZone: "America/Sao_Paulo",
    },
    attendees: [{ email: clientEmail }],
    // ADICIONAR ISSO:
    conferenceData: {
      createRequest: {
        requestId: crypto.randomUUID(),
        conferenceSolutionKey: {
          type: "hangoutsMeet",
        },
      },
    },
  },
});

// O link do Meet estará em:
const meetLink = event.data.conferenceData?.entryPoints?.find(
  (e) => e.entryPointType === "video"
)?.uri;
```

#### 4.3 Atualizar banco de dados (vendedores)

Os `calendarId` dos vendedores agora são os IDs dos calendários secundários:

```sql
UPDATE Seller
SET calendarId = 'abc123xyz@group.calendar.google.com'
WHERE email = 'joao@empresa.com';
```

---

### FASE 5: Variáveis de Ambiente

#### 5.1 Adicionar novas variáveis

```env
# Email da conta Workspace para impersonar
GOOGLE_WORKSPACE_EMAIL=agendamentos@seudominio.com

# Credenciais do Service Account (JSON escapado)
GOOGLE_CREDENTIALS_JSON={"type":"service_account","project_id":"..."}
```

#### 5.2 No Render.com

1. Acesse o dashboard do Render
2. Vá em **Environment > Environment Variables**
3. Adicione:
   - `GOOGLE_WORKSPACE_EMAIL`: `agendamentos@seudominio.com`
   - `GOOGLE_CREDENTIALS_JSON`: (JSON completo escapado)

---

### FASE 6: Deploy

```bash
# Build local para testar
npm run build

# Testar criação de evento com Meet
npm run test:calendar

# Se tudo OK, fazer deploy
git add .
git commit -m "feat: adiciona suporte a Google Meet"
git push origin main
```

---

## Troubleshooting

### Erro: "Not Authorized to access this resource"
- Verifique se o Domain-Wide Delegation está ativado
- Confirme que os escopos estão corretos no Admin Console
- Verifique se o email de impersonação existe no Workspace

### Erro: "conferenceData not populated"
- Certifique-se de passar `conferenceDataVersion: 1` nos parâmetros (não no body)
- O Meet pode demorar alguns segundos para ser criado (status "pending")

### Erro: "Invalid grant"
- A conta de serviço não tem permissão para impersonar o usuário
- Refaça a configuração de Domain-Wide Delegation

### Link do Meet não aparece
- Verifique se a conta impersonada tem licença do Workspace
- Business Starter ou superior é obrigatório para Meet

---

## Custos Estimados

| Item | Custo Mensal |
|------|--------------|
| Google Workspace Business Starter (1 licença) | ~R$ 40-45 |
| Google Cloud Platform (Calendar API) | **Grátis** |
| **Total** | ~R$ 40-45/mês |

*Valores aproximados considerando cotação do dólar*

---

## Fontes e Referências

- [Google Workspace Pricing](https://workspace.google.com/pricing)
- [Domain-Wide Delegation](https://support.google.com/a/answer/162106)
- [Calendar API - Create Events](https://developers.google.com/workspace/calendar/api/guides/create-events)
- [Google Meet in Calendar API](https://workspace.google.com/blog/product-announcements/hangouts-meet-now-available-in-google)
- [Service Account Authentication](https://developers.google.com/identity/protocols/oauth2/service-account)

---

## Checklist Final

- [ ] Google Workspace contratado e verificado
- [ ] Conta `agendamentos@` criada
- [ ] Calendários secundários criados para cada vendedor
- [ ] Service Account criado no Google Cloud
- [ ] Domain-Wide Delegation configurado no Admin Console
- [ ] Código atualizado com impersonação e conferenceData
- [ ] Variáveis de ambiente configuradas no Render
- [ ] Teste de criação de evento com Meet funcionando
- [ ] Deploy realizado
