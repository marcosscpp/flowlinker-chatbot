# Integração Microsoft Teams - Criação Automática de Reuniões

> **Status**: Pesquisa concluída - Aguardando decisão para implementação
>
> **Última atualização**: Janeiro/2026

---

## Índice

1. [Resumo Executivo](#resumo-executivo)
2. [Pré-requisitos](#pré-requisitos)
3. [Arquitetura da Solução](#arquitetura-da-solução)
4. [Passo a Passo: Configuração no Azure](#passo-a-passo-configuração-no-azure)
5. [Passo a Passo: Application Access Policy](#passo-a-passo-application-access-policy)
6. [Implementação em Node.js](#implementação-em-nodejs)
7. [Estrutura da API](#estrutura-da-api)
8. [Limitações e Considerações](#limitações-e-considerações)
9. [Custos e Licenciamento](#custos-e-licenciamento)
10. [Referências Oficiais](#referências-oficiais)

---

## Resumo Executivo

### O que é possível fazer?

Criar reuniões do Microsoft Teams **automaticamente** via código, retornando um link (`joinWebUrl`) que pode ser enviado ao cliente pelo WhatsApp.

### Exemplo de link gerado:
```
https://teams.microsoft.com/l/meetup-join/19%3ameeting_abc123%40thread.skype/0?context=...
```

### Viabilidade

| Aspecto | Status |
|---------|--------|
| API disponível | ✅ Microsoft Graph API |
| Suporte a Node.js | ✅ SDK oficial disponível |
| Funciona com conta Business | ✅ Business Basic ou superior |
| Complexidade | ⚠️ Média (requer config no Azure) |
| Tempo estimado de implementação | 2-4 horas |

---

## Pré-requisitos

### 1. Licença Microsoft 365

Qualquer um destes planos funciona:

| Plano | Preço aproximado | Funciona? |
|-------|------------------|-----------|
| Microsoft 365 Business Basic | ~R$28/usuário/mês | ✅ Sim |
| Microsoft 365 Business Standard | ~R$60/usuário/mês | ✅ Sim |
| Microsoft 365 Business Premium | ~R$110/usuário/mês | ✅ Sim |

**Limite**: 2.000 reuniões por usuário por mês (mais que suficiente).

### 2. Acesso ao Azure Portal

- URL: https://portal.azure.com
- Usar a mesma conta do Microsoft 365

### 3. Permissões de Administrador

- Acesso de **administrador global** ou **administrador de aplicativos** no Azure AD
- Acesso ao **PowerShell do Skype for Business Online** (para criar policies)

### 4. Pacotes Node.js necessários

```bash
npm install @microsoft/microsoft-graph-client @azure/identity
```

---

## Arquitetura da Solução

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│                 │     │                  │     │                 │
│  Chatbot        │────▶│  Microsoft       │────▶│  Microsoft      │
│  (Node.js)      │     │  Graph API       │     │  Teams          │
│                 │◀────│                  │◀────│                 │
└─────────────────┘     └──────────────────┘     └─────────────────┘
        │                       │
        │                       │
        ▼                       ▼
   joinWebUrl              Reunião criada
   enviado ao              no calendário
   cliente                 do organizador
```

### Fluxo:

1. Cliente agenda reunião via WhatsApp
2. Bot chama Microsoft Graph API
3. API cria reunião no Teams
4. Retorna `joinWebUrl`
5. Bot salva link no banco e envia ao cliente

---

## Passo a Passo: Configuração no Azure

### Etapa 1: Registrar o Aplicativo

1. Acesse https://portal.azure.com
2. Vá em **Microsoft Entra ID** (antigo Azure AD)
3. No menu lateral, clique em **App registrations**
4. Clique em **+ New registration**
5. Preencha:
   - **Name**: `Flowlinker Bot`
   - **Supported account types**: `Accounts in this organizational directory only`
   - **Redirect URI**: Deixe em branco (não é necessário para app daemon)
6. Clique em **Register**

### Etapa 2: Anotar IDs importantes

Após registrar, anote:

| Campo | Onde encontrar | Exemplo |
|-------|----------------|---------|
| **Application (client) ID** | Página Overview | `12345678-abcd-1234-efgh-123456789abc` |
| **Directory (tenant) ID** | Página Overview | `87654321-dcba-4321-hgfe-cba987654321` |

### Etapa 3: Criar Client Secret

1. No menu lateral do app, clique em **Certificates & secrets**
2. Clique em **+ New client secret**
3. Preencha:
   - **Description**: `Flowlinker Production`
   - **Expires**: `24 months` (recomendado)
4. Clique em **Add**
5. **IMPORTANTE**: Copie o **Value** imediatamente (não será mostrado novamente)

### Etapa 4: Configurar Permissões da API

1. No menu lateral, clique em **API permissions**
2. Clique em **+ Add a permission**
3. Selecione **Microsoft Graph**
4. Selecione **Application permissions**
5. Busque e marque:
   - `OnlineMeetings.ReadWrite.All`
   - `User.Read.All` (opcional, para buscar usuários)
6. Clique em **Add permissions**
7. Clique em **Grant admin consent for [sua org]** (botão azul)
8. Confirme clicando em **Yes**

### Etapa 5: Identificar o User ID do Organizador

As reuniões precisam ser criadas "em nome de" um usuário. Para isso:

1. Vá em **Microsoft Entra ID** > **Users**
2. Clique no usuário que será o organizador das reuniões
3. Copie o **Object ID** (este é o `userId`)

---

## Passo a Passo: Application Access Policy

**Por que isso é necessário?**

Por segurança, a Microsoft exige que você crie uma "política de acesso" que autoriza seu app a criar reuniões em nome de usuários específicos.

### Etapa 1: Instalar módulo PowerShell

Abra o PowerShell como Administrador:

```powershell
Install-Module -Name MicrosoftTeams -Force -AllowClobber
```

### Etapa 2: Conectar ao Teams

```powershell
Connect-MicrosoftTeams
```

Uma janela de login aparecerá. Use sua conta de administrador.

### Etapa 3: Criar a Application Access Policy

Substitua `{APP_ID}` pelo Application (client) ID do seu app:

```powershell
New-CsApplicationAccessPolicy -Identity "FlowlinkerBot-Policy" -AppIds "{APP_ID}" -Description "Permite ao bot Flowlinker criar reunioes do Teams"
```

### Etapa 4: Conceder a Policy ao Usuário Organizador

Substitua `{USER_OBJECT_ID}` pelo Object ID do usuário:

```powershell
Grant-CsApplicationAccessPolicy -PolicyName "FlowlinkerBot-Policy" -Identity "{USER_OBJECT_ID}"
```

**OU** para conceder globalmente (todos os usuários):

```powershell
Grant-CsApplicationAccessPolicy -PolicyName "FlowlinkerBot-Policy" -Global
```

### Etapa 5: Verificar a Policy

```powershell
Get-CsApplicationAccessPolicy
```

**IMPORTANTE**: As mudanças podem levar **até 30 minutos** para ter efeito.

---

## Implementação em Node.js

### Estrutura de arquivos sugerida

```
src/
├── config/
│   └── microsoft.ts       # Configuração do client Microsoft Graph
├── services/
│   └── teams.ts           # Serviço para criar reuniões do Teams
```

### Variáveis de ambiente necessárias

Adicionar ao `.env`:

```env
# Microsoft Teams / Azure AD
MICROSOFT_TENANT_ID=seu-tenant-id
MICROSOFT_CLIENT_ID=seu-client-id
MICROSOFT_CLIENT_SECRET=seu-client-secret
MICROSOFT_USER_ID=object-id-do-usuario-organizador
```

### Código: config/microsoft.ts

```typescript
import { ClientSecretCredential } from "@azure/identity";
import { Client } from "@microsoft/microsoft-graph-client";
import { TokenCredentialAuthenticationProvider } from "@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials";

const credential = new ClientSecretCredential(
  process.env.MICROSOFT_TENANT_ID!,
  process.env.MICROSOFT_CLIENT_ID!,
  process.env.MICROSOFT_CLIENT_SECRET!
);

const authProvider = new TokenCredentialAuthenticationProvider(credential, {
  scopes: ["https://graph.microsoft.com/.default"],
});

export const graphClient = Client.initWithMiddleware({
  authProvider,
});

export const ORGANIZER_USER_ID = process.env.MICROSOFT_USER_ID!;
```

### Código: services/teams.ts

```typescript
import { graphClient, ORGANIZER_USER_ID } from "../config/microsoft.js";

export interface TeamsMeetingResult {
  success: boolean;
  meetingId?: string;
  joinUrl?: string;
  error?: string;
}

/**
 * Cria uma reunião do Microsoft Teams
 */
export async function createTeamsMeeting(params: {
  subject: string;
  startTime: Date;
  endTime: Date;
}): Promise<TeamsMeetingResult> {
  const { subject, startTime, endTime } = params;

  try {
    const meeting = await graphClient
      .api(`/users/${ORGANIZER_USER_ID}/onlineMeetings`)
      .post({
        subject,
        startDateTime: startTime.toISOString(),
        endDateTime: endTime.toISOString(),
        lobbyBypassSettings: {
          scope: "everyone", // Todos podem entrar sem esperar no lobby
        },
      });

    return {
      success: true,
      meetingId: meeting.id,
      joinUrl: meeting.joinWebUrl,
    };
  } catch (error: any) {
    console.error("[Teams] Erro ao criar reunião:", error);
    return {
      success: false,
      error: error.message || "Erro desconhecido ao criar reunião do Teams",
    };
  }
}
```

### Código: Integração com calendar.ts

```typescript
// No arquivo src/services/calendar.ts, substituir o retorno do meetLink:

import { createTeamsMeeting } from "./teams.js";

// Dentro da função createCalendarEvent, antes do return:
const teamsMeeting = await createTeamsMeeting({
  subject: summary,
  startTime,
  endTime,
});

return {
  eventId: response.data.id,
  meetLink: teamsMeeting.success ? teamsMeeting.joinUrl : null,
};
```

---

## Estrutura da API

### Request: Criar Reunião

```http
POST https://graph.microsoft.com/v1.0/users/{userId}/onlineMeetings
Authorization: Bearer {token}
Content-Type: application/json

{
  "subject": "Demo Flowlinker - João",
  "startDateTime": "2026-01-15T14:30:00Z",
  "endDateTime": "2026-01-15T15:00:00Z",
  "lobbyBypassSettings": {
    "scope": "everyone"
  }
}
```

### Response: Reunião Criada

```json
{
  "id": "MSpkYzE3Njct...",
  "creationDateTime": "2026-01-15T10:00:00Z",
  "startDateTime": "2026-01-15T14:30:00Z",
  "endDateTime": "2026-01-15T15:00:00Z",
  "subject": "Demo Flowlinker - João",
  "joinWebUrl": "https://teams.microsoft.com/l/meetup-join/19%3ameeting_abc123...",
  "audioConferencing": {
    "tollNumber": "+55 11 1234-5678",
    "conferenceId": "123456789",
    "dialinUrl": "https://dialin.teams.microsoft.com/..."
  },
  "participants": {
    "organizer": {
      "identity": {
        "user": {
          "id": "user-id",
          "displayName": "Vendedor Flowlinker"
        }
      }
    }
  }
}
```

### Campos importantes da resposta

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | string | ID único da reunião |
| `joinWebUrl` | string | **Link para entrar na reunião** |
| `audioConferencing.tollNumber` | string | Número para entrar por telefone |
| `audioConferencing.conferenceId` | string | ID da conferência (para acesso por telefone) |

---

## Limitações e Considerações

### Limitações técnicas

| Limitação | Valor |
|-----------|-------|
| Reuniões por usuário/mês | 2.000 |
| Validade do link | 60 dias após a data de início |
| Participantes máximos | 1.000 pessoas |
| Membros no chat | 150 pessoas |

### Considerações importantes

1. **Reunião NÃO aparece no calendário por padrão**
   - A API `onlineMeetings` cria reuniões "standalone"
   - Se quiser que apareça no calendário, use a API de `events` com `isOnlineMeeting: true`

2. **Delay na Application Access Policy**
   - Mudanças podem levar até 30 minutos para ter efeito
   - Testar em ambiente de desenvolvimento primeiro

3. **Renovação do Client Secret**
   - O secret expira (máximo 24 meses)
   - Configurar lembrete para renovar antes de expirar

4. **Fallback**
   - Implementar tratamento de erro caso a API falhe
   - Considerar ter o Jitsi como fallback gratuito

---

## Custos e Licenciamento

### Custo da API

A Microsoft Graph API para `onlineMeetings` **não tem custo adicional** além da licença Microsoft 365.

### Comparativo de planos

| Plano | Preço/usuário/mês | Teams | Graph API |
|-------|-------------------|-------|-----------|
| Business Basic | ~R$28 | ✅ | ✅ |
| Business Standard | ~R$60 | ✅ | ✅ |
| Business Premium | ~R$110 | ✅ | ✅ |

### Recomendação

Se já possuem **Microsoft 365 Business Basic ou superior**, não há custo adicional para usar a API.

---

## Referências Oficiais

### Documentação Microsoft

- [Create onlineMeeting - Microsoft Graph API](https://learn.microsoft.com/en-us/graph/api/application-post-onlinemeetings?view=graph-rest-1.0)
- [Choose an API to create online meetings](https://learn.microsoft.com/en-us/graph/choose-online-meeting-api)
- [Cloud communications online meetings](https://learn.microsoft.com/en-us/graph/cloud-communications-online-meetings)
- [Application Access Policy](https://learn.microsoft.com/en-us/graph/cloud-communication-online-meeting-application-access-policy)
- [Register an application](https://learn.microsoft.com/en-us/graph/auth-register-app-v2)

### Tutoriais

- [Dynamically Create a Teams Meeting using Microsoft Graph](https://learn.microsoft.com/en-us/microsoft-cloud/dev/tutorials/acs-to-teams-meeting/04-create-teams-meeting)
- [Node.js console daemon app tutorial](https://learn.microsoft.com/en-us/entra/identity-platform/tutorial-v2-nodejs-console)

### SDKs

- [Microsoft Graph JavaScript SDK](https://github.com/microsoftgraph/msgraph-sdk-javascript)
- [Azure Identity for JavaScript](https://github.com/Azure/azure-sdk-for-js/tree/main/sdk/identity/identity)

---

## Checklist para Implementação

Quando decidir implementar, siga este checklist:

- [ ] Verificar qual plano Microsoft 365 está ativo
- [ ] Acessar Azure Portal com conta de administrador
- [ ] Registrar aplicativo no Azure AD
- [ ] Anotar: Tenant ID, Client ID
- [ ] Criar Client Secret e anotar o valor
- [ ] Configurar permissões da API (OnlineMeetings.ReadWrite.All)
- [ ] Conceder admin consent
- [ ] Identificar Object ID do usuário organizador
- [ ] Instalar módulo PowerShell do Teams
- [ ] Criar Application Access Policy
- [ ] Conceder policy ao usuário organizador
- [ ] Aguardar até 30 minutos para propagação
- [ ] Adicionar variáveis ao .env
- [ ] Instalar pacotes npm
- [ ] Implementar código
- [ ] Testar criação de reunião
- [ ] Integrar com fluxo de agendamento

---

**Documento gerado em**: Janeiro/2026
**Autor**: Claude (assistente de desenvolvimento)
**Versão**: 1.0
