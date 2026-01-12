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
  { name: "flowlinker-chat1", description: "Número principal" },
  { name: "flowlinker-chat2", description: "Número secundário" },
];

/**
 * Valida se uma instância está configurada
 */
export function isValidInstance(name: string): boolean {
  return instances.some((i) => i.name === name);
}

/**ve
 * Retorna lista de nomes das instâncias
 */
export function getInstanceNames(): string[] {
  return instances.map((i) => i.name);
}
