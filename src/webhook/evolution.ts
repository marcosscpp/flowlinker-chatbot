import { Router, Request, Response } from "express";
import * as debounceService from "../services/debounce.js";
import {
  extractPhoneFromJid,
  extractMessageText,
  hasAudioMessage,
  getAudioInfo,
  getBase64FromMediaMessage,
} from "../services/evolution.js";
import { transcribeAudio } from "../services/transcription.js";
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

    // Extrai telefone
    const phone = extractPhoneFromJid(key.remoteJid);

    // Tenta extrair texto da mensagem
    let text = extractMessageText(message);

    // Se não tem texto, verifica se é áudio
    if (!text && hasAudioMessage(message)) {
      const audioInfo = getAudioInfo(message);
      console.log(
        `[Webhook] Áudio recebido de ${phone} (${audioInfo?.seconds}s, ${audioInfo?.mimetype})`
      );

      // Busca o base64 do áudio via Evolution API
      const mediaData = await getBase64FromMediaMessage(key.id, key.remoteJid);

      if (mediaData?.base64) {
        // Transcreve o áudio
        const transcription = await transcribeAudio(
          mediaData.base64,
          mediaData.mimetype
        );

        if (transcription) {
          text = transcription;
          console.log(
            `[Webhook] Áudio transcrito de ${phone}: "${text.substring(0, 50)}..."`
          );
        } else {
          console.log("[Webhook] Falha ao transcrever áudio, ignorando");
          return res.sendStatus(200);
        }
      } else {
        console.log("[Webhook] Não foi possível obter base64 do áudio");
        return res.sendStatus(200);
      }
    }

    // Se ainda não tem texto, ignora
    if (!text) {
      console.log("[Webhook] Mensagem sem texto e sem áudio ignorada");
      return res.sendStatus(200);
    }

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
