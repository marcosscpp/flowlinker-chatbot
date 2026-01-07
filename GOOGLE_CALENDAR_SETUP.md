# Configuracao do Google Calendar

Este guia explica como configurar o Google Calendar para o chatbot de agendamento.

## 1. Criar Projeto no Google Cloud Console

1. Acesse [Google Cloud Console](https://console.cloud.google.com/)
2. Clique em **Selecionar projeto** > **Novo projeto**
3. Nome: `chatbot-agendamento` (ou outro de sua preferencia)
4. Clique em **Criar**

## 2. Ativar a API do Google Calendar

1. No menu lateral, va em **APIs e servicos** > **Biblioteca**
2. Pesquise por **Google Calendar API**
3. Clique no resultado e depois em **Ativar**

## 3. Criar Service Account

1. Va em **APIs e servicos** > **Credenciais**
2. Clique em **Criar credenciais** > **Conta de servico**
3. Preencha:
   - Nome: `chatbot-calendar`
   - ID: sera gerado automaticamente
4. Clique em **Criar e continuar**
5. Pule as etapas de permissoes opcionais
6. Clique em **Concluido**

## 4. Gerar Chave JSON

1. Na lista de contas de servico, clique na conta criada
2. Va na aba **Chaves**
3. Clique em **Adicionar chave** > **Criar nova chave**
4. Selecione **JSON**
5. Clique em **Criar**
6. O arquivo sera baixado automaticamente

## 5. Configurar Credenciais no Projeto

1. Crie a pasta `credentials` na raiz do projeto:
   ```
   mkdir credentials
   ```

2. Mova o arquivo JSON baixado para:
   ```
   credentials/credentials.json
   ```

3. A estrutura deve ficar:
   ```
   chatbot/
   ├── credentials/
   │   └── credentials.json    <-- Arquivo aqui
   ├── src/
   ├── prisma/
   └── ...
   ```

## 6. Compartilhar Calendarios com a Service Account

**IMPORTANTE**: Cada calendario dos vendedores precisa ser compartilhado com a Service Account.

1. Abra o arquivo `credentials/credentials.json`
2. Copie o valor de `client_email` (exemplo: `chatbot-calendar@projeto.iam.gserviceaccount.com`)

3. Para cada vendedor, no Google Calendar:
   - Acesse [Google Calendar](https://calendar.google.com/)
   - Clique nos 3 pontos ao lado do calendario > **Configuracoes e compartilhamento**
   - Em **Compartilhar com pessoas especificas**, clique em **Adicionar pessoas**
   - Cole o email da Service Account
   - Selecione **Fazer alteracoes nos eventos**
   - Clique em **Enviar**

## 7. Atualizar Vendedores no Banco de Dados

Atualize os `calendarId` dos vendedores com os emails dos calendarios reais:

```sql
-- Exemplo de update via Prisma Studio
-- Execute: npx prisma studio

-- Ou via SQL:
UPDATE Seller SET calendarId = 'email-real-do-vendedor@gmail.com' WHERE id = '...';
```

### Encontrar o ID do Calendario

O `calendarId` geralmente e o email do dono do calendario:
- Calendario principal: `usuario@gmail.com`
- Calendario secundario: encontre em **Configuracoes do calendario** > **Integrar calendario** > **ID do calendario**

## 8. Testar a Configuracao

Execute o script de teste:

```bash
npm run test:calendar
```

Se tudo estiver correto, voce vera a disponibilidade dos vendedores.

## Troubleshooting

### Erro: "credentials.json nao encontrado"
- Verifique se o arquivo esta em `credentials/credentials.json`
- Verifique se o nome esta correto (sem espacos, lowercase)

### Erro: "Not Found" ou "403 Forbidden"
- Verifique se o calendario foi compartilhado com a Service Account
- Confirme se a permissao e "Fazer alteracoes nos eventos"
- Aguarde alguns minutos apos compartilhar (pode demorar para propagar)

### Erro: "Calendar API has not been used"
- Ative a Google Calendar API no Cloud Console
- Aguarde alguns minutos apos ativar

### Erro: "Invalid grant"
- O arquivo de credenciais pode estar corrompido
- Gere uma nova chave JSON

## Estrutura do credentials.json

O arquivo deve ter esta estrutura (valores de exemplo):

```json
{
  "type": "service_account",
  "project_id": "seu-projeto",
  "private_key_id": "abc123...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...",
  "client_email": "chatbot-calendar@seu-projeto.iam.gserviceaccount.com",
  "client_id": "123456789",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/..."
}
```

## Checklist Final

- [ ] Projeto criado no Google Cloud Console
- [ ] Google Calendar API ativada
- [ ] Service Account criada
- [ ] Chave JSON gerada e salva em `credentials/credentials.json`
- [ ] Calendarios dos vendedores compartilhados com a Service Account
- [ ] `calendarId` dos vendedores atualizados no banco de dados
- [ ] Teste executado com sucesso
