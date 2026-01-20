/**
 * Configuração de instâncias do Evolution API
 *
 * Adicione aqui todas as instâncias (números de WhatsApp) que o bot deve gerenciar.
 * A API key é global (definida no .env), mas cada instância representa um número diferente.
 */

export interface EvolutionInstance {
  name: string; // Nome da instância no Evolution (ex: "flowlinker-chat1")
  description?: string; // Descrição opcional para identificação
}

export const instances: EvolutionInstance[] = [
  { name: "flowlinker-chat2", description: "Número secundário" },
  { name: "flowlinker-chat1", description: "Número principal" },
  { name: "flowlinker-planilhas", description: "Planilhas" },
];

/**
 * Valida se uma instância está configurada
 */
export function isValidInstance(name: string): boolean {
  return instances.some((i) => i.name === name);
}

/**
 * Retorna lista de nomes das instâncias
 */
export function getInstanceNames(): string[] {
  return instances.map((i) => i.name);
}

/**
 * Retorna a instância padrão para notificações do sistema (primeira configurada)
 */
export function getDefaultInstance(): string {
  if (instances.length === 0) {
    throw new Error("Nenhuma instância configurada em instances.ts");
  }
  return instances[0].name;
}
