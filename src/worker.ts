/**
 * Worker que processa mensagens da fila RabbitMQ
 *
 * Pode rodar em paralelo com o servidor principal para escalar horizontalmente.
 * Execute: npm run worker
 */

import 'dotenv/config';
import * as queueService from './services/queue.js';
import * as evolutionService from './services/evolution.js';
import { processMessage } from './agent/index.js';

async function handleMessage(data: {
  phone: string;
  text: string;
  name?: string;
  messageId: string;
  timestamp: number;
}): Promise<void> {
  const { phone, text, name } = data;

  console.log(`[Worker] Processando mensagem de ${phone}`);
  const startTime = Date.now();

  try {
    // Processa com o agente
    const response = await processMessage(phone, text, name);

    // Envia resposta via WhatsApp
    await evolutionService.sendText(phone, response);

    const elapsed = Date.now() - startTime;
    console.log(`[Worker] Resposta enviada para ${phone} (${elapsed}ms)`);
  } catch (error) {
    console.error(`[Worker] Erro ao processar mensagem de ${phone}:`, error);
    throw error; // Re-throw para que a mensagem va para DLQ
  }
}

async function start(): Promise<void> {
  console.log('[Worker] Iniciando...');

  // Conecta ao RabbitMQ
  await queueService.connect();

  // Inicia o consumidor
  await queueService.consumeMessages(handleMessage);

  console.log('[Worker] Aguardando mensagens...');

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n[Worker] Encerrando...');
    await queueService.disconnect();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n[Worker] Encerrando...');
    await queueService.disconnect();
    process.exit(0);
  });
}

start().catch((error) => {
  console.error('[Worker] Erro fatal:', error);
  process.exit(1);
});
