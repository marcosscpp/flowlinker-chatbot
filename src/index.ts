import "dotenv/config";
import express from "express";
import { env } from "./config/env.js";
import { webhookRouter } from "./webhook/evolution.js";
import * as queueService from "./services/queue.js";
import * as debounceService from "./services/debounce.js";

const app = express();

// Middleware para JSON
app.use(express.json());

// Log de requisicoes
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Rotas do webhook
app.use("/webhook", webhookRouter);

// Health check geral
app.get("/health", async (_req, res) => {
  const queueStatus = await queueService.getQueueStatus();

  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    queue: queueStatus
      ? {
          connected: true,
          messages: queueStatus.messageCount,
          consumers: queueStatus.consumerCount,
        }
      : { connected: false },
  });
});

// Rota raiz
app.get("/", (_req, res) => {
  res.json({
    name: "Chatbot Agendamento",
    version: "1.0.0",
    endpoints: {
      webhook: "/webhook/messages-upsert",
      health: "/health",
    },
  });
});

async function start(): Promise<void> {
  // Conecta ao RabbitMQ
  console.log("[Server] Conectando ao RabbitMQ...");
  await queueService.connect();

  // Inicia o servidor
  app.listen(env.port, () => {
    console.log(`[Server] Rodando na porta ${env.port}`);
    console.log(
      `[Server] Webhook URL: http://localhost:${env.port}/webhook/messages-upsert`
    );
    console.log("[Server] Aguardando mensagens...");
  });

  // Graceful shutdown
  process.on("SIGINT", async () => {
    console.log("\n[Server] Encerrando...");
    // Processa mensagens pendentes no debounce antes de fechar
    await debounceService.flushAll();
    await queueService.disconnect();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    console.log("\n[Server] Encerrando...");
    // Processa mensagens pendentes no debounce antes de fechar
    await debounceService.flushAll();
    await queueService.disconnect();
    process.exit(0);
  });
}

start().catch((error) => {
  console.error("[Server] Erro fatal:", error);
  process.exit(1);
});
