/**
 * Script helper para converter credentials.json em string para variável de ambiente
 * 
 * Uso:
 *   tsx scripts/convert-credentials.ts
 * 
 * Isso vai ler credentials/credentials.json e mostrar o JSON escapado
 * que você pode copiar e colar no Render como GOOGLE_CREDENTIALS_JSON
 */

import * as fs from 'fs';
import * as path from 'path';

const credentialsPath = path.join(process.cwd(), 'credentials', 'credentials.json');

if (!fs.existsSync(credentialsPath)) {
  console.error('❌ Arquivo credentials/credentials.json não encontrado!');
  console.error('   Coloque o arquivo de credenciais do Google Cloud Console lá primeiro.');
  process.exit(1);
}

try {
  const credentialsContent = fs.readFileSync(credentialsPath, 'utf-8');
  
  // Valida se é JSON válido
  JSON.parse(credentialsContent);
  
  // Converte para string de uma linha (escapando)
  const escaped = JSON.stringify(JSON.parse(credentialsContent));
  
  console.log('\n✅ JSON convertido com sucesso!\n');
  console.log('📋 Copie o conteúdo abaixo e cole no Render como GOOGLE_CREDENTIALS_JSON:\n');
  console.log('─'.repeat(80));
  console.log(escaped);
  console.log('─'.repeat(80));
  console.log('\n💡 Dica: Adicione essa variável nos dois serviços (chatbot-server e chatbot-worker)\n');
  
} catch (error) {
  console.error('❌ Erro ao processar credentials.json:');
  console.error(error);
  process.exit(1);
}

