import { Router, Request, Response } from "express";
import * as debounceService from "../services/debounce.js";
import {
  extractPhoneFromJid,
  extractMessageText,
} from "../services/evolution.js";
import type { EvolutionWebhookPayload } from "../types/index.js";

export const webhookRouter = Router();

/**
 * Webhook para receber mensagens do WhatsApp via Evolution API
 * Evento: MESSAGES_UPSERT
 *
 * Usa debounce para acumular mensagens do mesmo usuário
 * antes de processar (evita múltiplas respostas)
 */
webhookRouter.post("/messages-upsert", async (req: Request, res: Response) => {
  try {
    const payload = req.body as EvolutionWebhookPayload;

    // Valida payload
    if (!payload?.data?.key) {
      console.log("[Webhook] Payload inválido recebido");
      return res.sendStatus(400);
    }

    const { key, message, pushName } = payload.data;

    // Ignora mensagens enviadas pelo bot
    if (key.fromMe) {
      return res.sendStatus(200);
    }

    // Ignora mensagens de grupos
    if (key.remoteJid.endsWith("@g.us")) {
      console.log("[Webhook] Mensagem de grupo ignorada");
      return res.sendStatus(200);
    }

    // Extrai texto da mensagem
    const text = extractMessageText(message);
    if (!text) {
      console.log("[Webhook] Mensagem sem texto ignorada");
      return res.sendStatus(200);
    }

    // Extrai telefone
    const phone = extractPhoneFromJid(key.remoteJid);

    console.log(
      `[Webhook] Mensagem recebida de ${phone}: ${text.substring(0, 50)}...`
    );

    // Adiciona ao debounce (será processado após período de inatividade)
    debounceService.addMessage({
      phone,
      text,
      name: pushName,
      messageId: key.id,
      timestamp: Date.now(),
    });

    // Responde rapidamente para não bloquear o webhook
    res.sendStatus(200);
  } catch (error) {
    console.error("[Webhook] Erro ao processar:", error);
    res.sendStatus(500);
  }
});

/**
 * Webhook para status de conexão
 * Evento: CONNECTION_UPDATE
 */
webhookRouter.post("/connection-update", (req: Request, res: Response) => {
  const { data } = req.body;
  console.log("[Webhook] Connection update:", data?.state);
  res.sendStatus(200);
});

/**
 * Webhook genérico para outros eventos
 */
webhookRouter.post("/:event", (req: Request, res: Response) => {
  const { event } = req.params;
  console.log(`[Webhook] Evento ${event} recebido`);
  res.sendStatus(200);
});

/**
 * Health check do webhook
 */
webhookRouter.get("/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    pendingDebounce: debounceService.getPendingCount(),
  });
});
