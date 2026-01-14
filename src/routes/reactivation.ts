import { Router, Request, Response } from "express";
import {
  runReactivationCycle,
  analyzeAndQueueContacts,
  processReactivationQueue,
  getReactivationStats,
  type ReactivationConfig,
} from "../services/reactivation.js";
import { getDefaultInstance } from "../config/instances.js";
import { recoverAllInstances, recoverOfflineMessages } from "../services/offline-recovery.js";

export const reactivationRouter = Router();

/**
 * Configuração padrão
 * Pode ser sobrescrita via query params
 */
const DEFAULT_CONFIG: ReactivationConfig = {
  inactiveDays: 2,
  maxAttempts: 3,
  dailyLimit: 50,
  delayBetweenMessages: 45000, // 45 segundos
  instance: getDefaultInstance(),
};

/**
 * Extrai configuração dos query params
 */
function getConfigFromQuery(query: Request["query"]): Partial<ReactivationConfig> {
  const config: Partial<ReactivationConfig> = {};

  if (query.inactiveDays) {
    config.inactiveDays = parseInt(query.inactiveDays as string, 10);
  }
  if (query.maxAttempts) {
    config.maxAttempts = parseInt(query.maxAttempts as string, 10);
  }
  if (query.dailyLimit) {
    config.dailyLimit = parseInt(query.dailyLimit as string, 10);
  }
  if (query.delayBetweenMessages) {
    config.delayBetweenMessages = parseInt(query.delayBetweenMessages as string, 10);
  }
  if (query.instance) {
    config.instance = query.instance as string;
  }

  return config;
}

/**
 * POST /reactivation/run
 * Executa o ciclo completo de reativação (análise + envio)
 * Este é o endpoint principal para o cronjob do Render
 */
reactivationRouter.post("/run", async (req: Request, res: Response) => {
  console.log("[Reactivation API] POST /run iniciado");

  try {
    const config = {
      ...DEFAULT_CONFIG,
      ...getConfigFromQuery(req.query),
      ...(req.body || {}),
    };

    const result = await runReactivationCycle(config);

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      config,
      result,
    });
  } catch (error) {
    console.error("[Reactivation API] Erro em /run:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Erro desconhecido",
    });
  }
});

/**
 * POST /reactivation/analyze
 * Apenas analisa e enfileira contatos (não envia)
 * Útil para separar o cronjob de análise do cronjob de envio
 */
reactivationRouter.post("/analyze", async (req: Request, res: Response) => {
  console.log("[Reactivation API] POST /analyze iniciado");

  try {
    const config = {
      ...DEFAULT_CONFIG,
      ...getConfigFromQuery(req.query),
      ...(req.body || {}),
    };

    const result = await analyzeAndQueueContacts(config);

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      config,
      result,
    });
  } catch (error) {
    console.error("[Reactivation API] Erro em /analyze:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Erro desconhecido",
    });
  }
});

/**
 * POST /reactivation/send
 * Apenas processa a fila de envio (não analisa novos contatos)
 * Útil para separar o cronjob de análise do cronjob de envio
 */
reactivationRouter.post("/send", async (req: Request, res: Response) => {
  console.log("[Reactivation API] POST /send iniciado");

  try {
    const config = {
      ...DEFAULT_CONFIG,
      ...getConfigFromQuery(req.query),
      ...(req.body || {}),
    };

    const result = await processReactivationQueue(config);

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      config,
      result,
    });
  } catch (error) {
    console.error("[Reactivation API] Erro em /send:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Erro desconhecido",
    });
  }
});

/**
 * GET /reactivation/stats
 * Retorna estatísticas de reativação
 */
reactivationRouter.get("/stats", async (_req: Request, res: Response) => {
  try {
    const stats = await getReactivationStats();

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      stats,
    });
  } catch (error) {
    console.error("[Reactivation API] Erro em /stats:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Erro desconhecido",
    });
  }
});

/**
 * GET /reactivation/health
 * Health check específico para reativação
 */
reactivationRouter.get("/health", async (_req: Request, res: Response) => {
  try {
    const stats = await getReactivationStats();

    res.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      pendingMessages: stats.pendingQueue,
      sentToday: stats.sentToday,
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      error: error instanceof Error ? error.message : "Erro desconhecido",
    });
  }
});

/**
 * POST /reactivation/recover-offline
 * Recupera mensagens perdidas enquanto o WhatsApp estava offline
 * Busca mensagens diretamente do Evolution API que não chegaram ao webhook
 */
reactivationRouter.post("/recover-offline", async (req: Request, res: Response) => {
  console.log("[Reactivation API] POST /recover-offline iniciado");

  try {
    const hoursBack = parseInt(req.query.hoursBack as string || req.body?.hoursBack || "48", 10);
    const instance = req.query.instance as string || req.body?.instance;

    let results;
    if (instance) {
      // Recupera de uma instância específica
      results = [await recoverOfflineMessages(instance, hoursBack)];
    } else {
      // Recupera de todas as instâncias
      results = await recoverAllInstances(hoursBack);
    }

    const totals = {
      chatsScanned: results.reduce((sum, r) => sum + r.chatsScanned, 0),
      messagesFound: results.reduce((sum, r) => sum + r.messagesFound, 0),
      messagesProcessed: results.reduce((sum, r) => sum + r.messagesProcessed, 0),
      errors: results.reduce((sum, r) => sum + r.errors, 0),
    };

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      hoursBack,
      totals,
      results,
    });
  } catch (error) {
    console.error("[Reactivation API] Erro em /recover-offline:", error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Erro desconhecido",
    });
  }
});
