import { Router, Request, Response } from "express";
import {
  getKPIs,
  getFunnelData,
  getLeadsOverTime,
  getPeakHours,
  getLeadsList,
  getLeadDetails,
} from "../services/dashboard-stats.js";
import {
  generateOrGetSummary,
  forceRegenerateSummary,
} from "../services/summary-generator.js";

export const dashboardRouter = Router();

/**
 * Parseia datas dos query params
 */
function parseDateRange(query: Request["query"]): {
  startDate?: Date;
  endDate?: Date;
} {
  const startDate = query.startDate
    ? new Date(query.startDate as string)
    : undefined;
  const endDate = query.endDate ? new Date(query.endDate as string) : undefined;

  return { startDate, endDate };
}

/**
 * GET /api/dashboard/kpis
 * Retorna KPIs do dashboard
 */
dashboardRouter.get("/kpis", async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = parseDateRange(req.query);
    const kpis = await getKPIs(startDate, endDate);
    res.json(kpis);
  } catch (error: any) {
    console.error("[Dashboard] Erro ao buscar KPIs:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/dashboard/funnel
 * Retorna dados do funil de vendas
 */
dashboardRouter.get("/funnel", async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = parseDateRange(req.query);
    const funnel = await getFunnelData(startDate, endDate);
    res.json(funnel);
  } catch (error: any) {
    console.error("[Dashboard] Erro ao buscar funil:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/dashboard/leads-over-time
 * Retorna leads ao longo do tempo
 */
dashboardRouter.get("/leads-over-time", async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = parseDateRange(req.query);
    const granularity =
      (req.query.granularity as "day" | "week" | "month") || "day";

    // Se não passar datas, usa últimos 30 dias
    const now = new Date();
    const defaultStart = new Date(now);
    defaultStart.setDate(defaultStart.getDate() - 30);

    const data = await getLeadsOverTime(
      startDate || defaultStart,
      endDate || now,
      granularity
    );

    res.json(data);
  } catch (error: any) {
    console.error("[Dashboard] Erro ao buscar leads over time:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/dashboard/peak-hours
 * Retorna horários de pico
 */
dashboardRouter.get("/peak-hours", async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = parseDateRange(req.query);
    const data = await getPeakHours(startDate, endDate);
    res.json(data);
  } catch (error: any) {
    console.error("[Dashboard] Erro ao buscar peak hours:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/dashboard/leads
 * Retorna lista de leads paginada
 */
dashboardRouter.get("/leads", async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const status = req.query.status as string | undefined;
    const search = req.query.search as string | undefined;

    const data = await getLeadsList(page, limit, status, search);
    res.json(data);
  } catch (error: any) {
    console.error("[Dashboard] Erro ao buscar leads:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/dashboard/leads/:id
 * Retorna detalhes de um lead com resumo
 */
dashboardRouter.get("/leads/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const lead = await getLeadDetails(id);

    if (!lead) {
      return res.status(404).json({ error: "Lead não encontrado" });
    }

    // Busca ou gera resumo
    const summary = await generateOrGetSummary(id);

    res.json({
      lead,
      summary: summary
        ? {
            text: summary.summary,
            keyPoints: summary.keyPoints,
            sentiment: summary.sentiment,
            isCached: summary.isCached,
          }
        : null,
    });
  } catch (error: any) {
    console.error("[Dashboard] Erro ao buscar lead:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/dashboard/leads/:id/regenerate-summary
 * Força regeneração do resumo
 */
dashboardRouter.post(
  "/leads/:id/regenerate-summary",
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const summary = await forceRegenerateSummary(id);

      if (!summary) {
        return res.status(404).json({ error: "Lead não encontrado" });
      }

      res.json({
        text: summary.summary,
        keyPoints: summary.keyPoints,
        sentiment: summary.sentiment,
        isCached: false,
      });
    } catch (error: any) {
      console.error("[Dashboard] Erro ao regenerar resumo:", error);
      res.status(500).json({ error: error.message });
    }
  }
);
