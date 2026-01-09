import OpenAI, { toFile } from "openai";
import { env } from "../config/env.js";

const openai = new OpenAI({
  apiKey: env.openaiApiKey,
});

/**
 * Transcreve áudio usando OpenAI Whisper
 * @param base64Audio - Áudio em formato base64
 * @param mimeType - Tipo do arquivo (ex: audio/ogg; codecs=opus)
 * @returns Texto transcrito ou null se falhar
 */
export async function transcribeAudio(
  base64Audio: string,
  mimeType: string = "audio/ogg"
): Promise<string | null> {
  try {
    console.log(`[Transcription] Iniciando transcrição (${mimeType})...`);

    // Remove prefixo data URI se existir
    const base64Data = base64Audio.replace(/^data:audio\/[^;]+;base64,/, "");

    // Converte base64 para buffer
    const audioBuffer = Buffer.from(base64Data, "base64");

    console.log(`[Transcription] Buffer size: ${audioBuffer.length} bytes`);

    // Extrai o tipo base do mimeType (remove codec info como "; codecs=opus")
    const baseMimeType = mimeType.split(";")[0].trim();

    // Determina extensão pelo mimeType base
    const extensionMap: Record<string, string> = {
      "audio/ogg": "ogg",
      "audio/mp4": "mp4",
      "audio/mpeg": "mp3",
      "audio/wav": "wav",
      "audio/webm": "webm",
      "audio/x-m4a": "m4a",
      "audio/aac": "aac",
    };
    const extension = extensionMap[baseMimeType] || "ogg";
    const fileName = `audio.${extension}`;

    console.log(`[Transcription] Enviando como ${fileName}`);

    // Usa toFile do SDK para criar arquivo compatível com a API
    const audioFile = await toFile(audioBuffer, fileName, {
      type: baseMimeType,
    });

    // Chama a API do Whisper
    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: "whisper-1",
      language: "pt",
    });

    console.log(
      `[Transcription] Sucesso: "${transcription.text.substring(0, 50)}..."`
    );

    return transcription.text;
  } catch (error: any) {
    console.error("[Transcription] Erro:", error.message);
    if (error.response?.data) {
      console.error("[Transcription] Detalhes:", error.response.data);
    }
    return null;
  }
}
