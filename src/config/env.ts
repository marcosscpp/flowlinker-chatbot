import 'dotenv/config';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Variavel de ambiente ${name} nao definida`);
  }
  return value;
}

function optionalEnv(name: string, defaultValue: string): string {
  return process.env[name] || defaultValue;
}

export const env = {
  // OpenAI
  openaiApiKey: requireEnv('OPENAI_API_KEY'),

  // Evolution API
  evolutionApiUrl: requireEnv('EVOLUTION_API_URL'),
  evolutionApiKey: requireEnv('EVOLUTION_API_KEY'),
  evolutionInstance: requireEnv('EVOLUTION_INSTANCE'),

  // Database
  databaseUrl: requireEnv('DATABASE_URL'),

  // RabbitMQ
  rabbitmqUrl: requireEnv('RABBITMQ_URL'),

  // App
  port: parseInt(optionalEnv('PORT', '3000'), 10),
  nodeEnv: optionalEnv('NODE_ENV', 'development'),
  isDev: optionalEnv('NODE_ENV', 'development') === 'development',

  // Debounce - tempo de espera antes de processar mensagens (em ms)
  debounceDelay: parseInt(optionalEnv('DEBOUNCE_DELAY', '3000'), 10),
};
