import OpenAI from "openai";
import { env } from "../config/env.js";

const openai = new OpenAI({
  apiKey: env.openaiApiKey,
});

/**
 * Transcreve áudio usando OpenAI Whisper
 * @param base64Audio - Áudio em formato base64
 * @param mimeType - Tipo do arquivo (ex: audio/ogg, audio/mp4)
 * @returns Texto transcrito ou null se falhar
 */
export async function transcribeAudio(
  base64Audio: string,
  mimeType: string = "audio/ogg"
): Promise<string | null> {
  try {
    console.log("[Transcription] Iniciando transcrição de áudio...");

    // Remove prefixo data URI se existir
    const base64Data = base64Audio.replace(/^data:audio\/\w+;base64,/, "");

    // Converte base64 para buffer
    const audioBuffer = Buffer.from(base64Data, "base64");

    // Determina extensão pelo mimeType
    const extensionMap: Record<string, string> = {
      "audio/ogg": "ogg",
      "audio/mp4": "mp4",
      "audio/mpeg": "mp3",
      "audio/wav": "wav",
      "audio/webm": "webm",
      "audio/x-m4a": "m4a",
    };
    const extension = extensionMap[mimeType] || "ogg";

    // Cria um File object para enviar ao Whisper
    const audioFile = new File([audioBuffer], `audio.${extension}`, {
      type: mimeType,
    });

    // Chama a API do Whisper
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
      language: "pt", // Português
    });

    console.log(
      `[Transcription] Áudio transcrito: "${transcription.text.substring(0, 50)}..."`
    );

    return transcription.text;
  } catch (error: any) {
    console.error("[Transcription] Erro ao transcrever áudio:", error.message);
    return null;
  }
}
