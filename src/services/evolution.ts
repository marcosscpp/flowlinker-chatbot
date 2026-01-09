import axios from "axios";
import { env } from "../config/env.js";

const api = axios.create({
  baseURL: env.evolutionApiUrl,
  headers: {
    apikey: env.evolutionApiKey,
    "Content-Type": "application/json",
  },
});

/**
 * Envia mensagem de texto via WhatsApp
 */
export async function sendText(phone: string, text: string): Promise<void> {
  // Formata o numero (remove caracteres especiais, adiciona codigo do pais se necessario)
  const formattedPhone = formatPhone(phone);

  await api.post(`/message/sendText/${env.evolutionInstance}`, {
    number: formattedPhone,
    text,
  });
}

/**
 * Envia mensagem com botoes
 */
export async function sendButtons(
  phone: string,
  title: string,
  description: string,
  buttons: Array<{ buttonId: string; buttonText: { displayText: string } }>
): Promise<void> {
  const formattedPhone = formatPhone(phone);

  await api.post(`/message/sendButtons/${env.evolutionInstance}`, {
    number: formattedPhone,
    title,
    description,
    buttons,
  });
}

/**
 * Envia lista de opcoes
 */
export async function sendList(
  phone: string,
  title: string,
  description: string,
  buttonText: string,
  sections: Array<{
    title: string;
    rows: Array<{ title: string; description?: string; rowId: string }>;
  }>
): Promise<void> {
  const formattedPhone = formatPhone(phone);

  await api.post(`/message/sendList/${env.evolutionInstance}`, {
    number: formattedPhone,
    title,
    description,
    buttonText,
    sections,
  });
}

/**
 * Marca mensagem como lida
 */
export async function markAsRead(
  remoteJid: string,
  messageId: string
): Promise<void> {
  await api.put(`/chat/markMessageAsRead/${env.evolutionInstance}`, {
    readMessages: [
      {
        remoteJid,
        id: messageId,
      },
    ],
  });
}

/**
 * Formata numero de telefone para o padrao do WhatsApp
 */
function formatPhone(phone: string): string {
  // Remove todos os caracteres nao numericos
  let cleaned = phone.replace(/\D/g, "");

  // Se nao comecar com codigo do pais, assume Brasil (55)
  if (!cleaned.startsWith("55") && cleaned.length <= 11) {
    cleaned = "55" + cleaned;
  }

  return cleaned;
}

/**
 * Extrai numero de telefone limpo do remoteJid
 */
export function extractPhoneFromJid(remoteJid: string): string {
  return remoteJid.replace("@s.whatsapp.net", "").replace("@g.us", "");
}

/**
 * Extrai texto da mensagem (considera diferentes formatos)
 */
export function extractMessageText(message: any): string | null {
  return (
    message?.conversation ||
    message?.extendedTextMessage?.text ||
    message?.buttonsResponseMessage?.selectedButtonId ||
    message?.listResponseMessage?.singleSelectReply?.selectedRowId ||
    null
  );
}

/**
 * Verifica se a mensagem contém áudio
 */
export function hasAudioMessage(message: any): boolean {
  return !!message?.audioMessage;
}

/**
 * Extrai informações do áudio da mensagem
 */
export function getAudioInfo(message: any): {
  mimetype: string;
  seconds: number;
} | null {
  if (!message?.audioMessage) return null;
  return {
    mimetype: message.audioMessage.mimetype || "audio/ogg",
    seconds: message.audioMessage.seconds || 0,
  };
}

/**
 * Busca o base64 de uma mídia (áudio, imagem, etc) via Evolution API
 * Usa o endpoint /chat/getBase64FromMediaMessage
 */
export async function getBase64FromMediaMessage(
  messageId: string
): Promise<{ base64: string; mimetype: string } | null> {
  try {
    console.log(`[Evolution] Buscando base64 para mensagem ${messageId}...`);

    const response = await api.post(
      `/chat/getBase64FromMediaMessage/${env.evolutionInstance}`,
      {
        message: {
          key: {
            id: messageId,
          },
        },
        convertToMp4: false,
      }
    );

    if (response.data?.base64) {
      console.log(
        `[Evolution] Base64 obtido com sucesso (${response.data.mimetype})`
      );
      return {
        base64: response.data.base64,
        mimetype: response.data.mimetype || "audio/ogg",
      };
    }

    console.log("[Evolution] Resposta sem base64:", response.data);
    return null;
  } catch (error: any) {
    console.error("[Evolution] Erro ao buscar base64:", error.message);
    return null;
  }
}
