import "dotenv/config";
import express from "express";
import cors from "cors";
import { env } from "./config/env.js";
import { webhookRouter } from "./webhook/evolution.js";
import { reactivationRouter } from "./routes/reactivation.js";
import { dashboardRouter } from "./routes/dashboard.js";
import * as queueService from "./services/queue.js";
import * as debounceService from "./services/debounce.js";

const app = express();

// CORS para o frontend
app.use(
  cors({
    origin: env.isDev
      ? ["flowlinker.com.br"]
      : env.frontendUrl,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Middleware para JSON
app.use(express.json());

// Log de requisicoes
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Rotas do webhook
app.use("/webhook", webhookRouter);

// Rotas de reativação (para cronjob)
app.use("/reactivation", reactivationRouter);

// Rotas do dashboard (para frontend)
app.use("/api/dashboard", dashboardRouter);

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
      reactivation: {
        run: "POST /reactivation/run - Ciclo completo (envio + análise)",
        analyze: "POST /reactivation/analyze - Apenas analisa e enfileira",
        send: "POST /reactivation/send - Apenas processa fila de envio",
        stats: "GET /reactivation/stats - Estatísticas",
        health: "GET /reactivation/health - Health check",
      },
      dashboard: {
        kpis: "GET /api/dashboard/kpis - KPIs do dashboard",
        funnel: "GET /api/dashboard/funnel - Funil de vendas",
        leadsOverTime: "GET /api/dashboard/leads-over-time - Leads por período",
        peakHours: "GET /api/dashboard/peak-hours - Horários de pico",
        leads: "GET /api/dashboard/leads - Lista de leads paginada",
        leadDetail: "GET /api/dashboard/leads/:id - Detalhes do lead com resumo",
        regenerateSummary: "POST /api/dashboard/leads/:id/regenerate-summary - Regenera resumo",
      },
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
