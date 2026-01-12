import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { prisma } from "../../database/client.js";
import * as evolutionService from "../../services/evolution.js";
import { getDefaultInstance } from "../../config/instances.js";
import { env } from "../../config/env.js";

export const transferToHumanTool = tool(
  async ({ clientPhone, clientName, reason }) => {
    try {
      // Verifica se o grupo está configurado
      if (!env.sellersGroupId) {
        return JSON.stringify({
          success: false,
          error: "Grupo de vendedores nao configurado. Defina SELLERS_GROUP_ID no .env",
        });
      }

      // Desabilita o bot para este cliente
      await prisma.conversationLog.upsert({
        where: { phone: clientPhone },
        update: { disabled: true },
        create: {
          phone: clientPhone,
          disabled: true,
          messages: [],
        },
      });

      // Monta mensagem para o grupo de vendedores
      const now = new Date();
      const groupMsg =
        `🙋 *Solicitacao de atendimento humano*\n\n` +
        `Cliente: ${clientName || "Nao informado"}\n` +
        `Telefone: ${clientPhone}\n` +
        `Data/Hora: ${now.toLocaleString("pt-BR")}\n` +
        (reason ? `\nMotivo: ${reason}\n` : "") +
        `\n_Bot desabilitado para este cliente. Digite ".." na conversa para reativar._`;

      // Envia notificacao para o grupo
      const instance = getDefaultInstance();
      await evolutionService.sendText(instance, env.sellersGroupId, groupMsg);

      return JSON.stringify({
        success: true,
        message:
          "Entendido! Estou transferindo voce para um de nossos atendentes. " +
          "Em breve alguem da equipe entrara em contato. Aguarde um momento, por favor.",
      });
    } catch (error: any) {
      console.error("Erro ao transferir para humano:", error);
      return JSON.stringify({
        success: false,
        error: `Erro ao transferir: ${error.message}`,
      });
    }
  },
  {
    name: "transfer_to_human",
    description:
      "Transfere o atendimento para um vendedor humano. " +
      "Use quando o cliente solicitar explicitamente falar com um humano/atendente, " +
      "ou quando a situacao exigir atendimento especializado que o bot nao consegue resolver. " +
      "IMPORTANTE: O bot sera desabilitado para este cliente apos a transferencia.",
    schema: z.object({
      clientPhone: z
        .string()
        .describe("Numero de telefone do cliente (fornecido pelo sistema)"),
      clientName: z
        .string()
        .nullable()
        .optional()
        .describe("Nome do cliente (se conhecido)"),
      reason: z
        .string()
        .nullable()
        .optional()
        .describe("Motivo da transferencia ou resumo do que o cliente precisa"),
    }),
  }
);
