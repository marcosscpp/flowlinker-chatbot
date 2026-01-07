# Como Configurar Google Credentials no Render

O arquivo `credentials.json` não pode ser commitado no Git (por segurança). No Render, você deve usar **variável de ambiente**.

## 📋 Passo a Passo

### 1. Obter o conteúdo do credentials.json

Abra o arquivo `credentials/credentials.json` localmente e copie **todo o conteúdo** (o JSON completo).

Exemplo de estrutura:
```json
{
  "type": "service_account",
  "project_id": "seu-projeto-123",
  "private_key_id": "abc123...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "chatbot@seu-projeto.iam.gserviceaccount.com",
  "client_id": "123456789",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/..."
}
```

### 2. Converter para String Única

O JSON precisa ser convertido em uma **string de uma linha** para a variável de ambiente.

#### Opção A: Online (mais fácil)
1. Acesse https://www.freeformatter.com/json-escape.html
2. Cole o JSON completo
3. Clique em **Escape JSON**
4. Copie o resultado

#### Opção B: Manualmente
- Remova todas as quebras de linha
- Mantenha as aspas duplas
- O resultado deve ser uma linha só

### 3. Adicionar no Render

1. Acesse o **Dashboard do Render**
2. Vá no seu serviço (chatbot-server)
3. Clique em **Environment**
4. Clique em **Add Environment Variable**
5. Configure:

| Key | Value |
|-----|-------|
| `GOOGLE_CREDENTIALS_JSON` | Cole o JSON escapado (string de uma linha) |

6. **Repita o mesmo processo** no serviço `chatbot-worker`

### 4. Formato da Variável

A variável `GOOGLE_CREDENTIALS_JSON` deve conter o JSON completo como string:

```
{"type":"service_account","project_id":"seu-projeto","private_key_id":"abc123","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n","client_email":"chatbot@seu-projeto.iam.gserviceaccount.com",...}
```

### 5. Verificar se Funcionou

Após adicionar a variável e fazer deploy:

1. Acesse os **Logs** do serviço no Render
2. Procure por erros relacionados a credenciais
3. Se não houver erros, está funcionando! ✅

---

## 🔄 Como o Código Funciona

O código agora tem **duas opções**:

1. **Produção (Render)**: Lê de `GOOGLE_CREDENTIALS_JSON`
2. **Desenvolvimento (Local)**: Lê de `credentials/credentials.json`

Isso permite:
- ✅ Desenvolver localmente com arquivo
- ✅ Deploy no Render com variável de ambiente
- ✅ Segurança (credenciais não vão pro Git)

---

## ⚠️ Importante

- **NUNCA** commite o `credentials.json` no Git
- O arquivo está no `.gitignore` por segurança
- Use variável de ambiente **apenas** em produção
- Mantenha o arquivo local apenas para desenvolvimento

---

## 🐛 Troubleshooting

### Erro: "GOOGLE_CREDENTIALS_JSON inválido"
- Verifique se o JSON está completo
- Certifique-se de que está escapado corretamente
- Teste o JSON em um validador online

### Erro: "Credenciais do Google não encontradas"
- Verifique se a variável está configurada nos **dois serviços** (server e worker)
- Confirme que o nome da variável é exatamente `GOOGLE_CREDENTIALS_JSON`
- Faça um novo deploy após adicionar a variável

### Erro: "Invalid grant" ou "403 Forbidden"
- Verifique se os calendários foram compartilhados com a Service Account
- Confirme que o email da Service Account está correto
- Veja mais em `GOOGLE_CALENDAR_SETUP.md`

