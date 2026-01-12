import amqp, { Connection, Channel, ConsumeMessage } from 'amqplib';
import { env } from '../config/env.js';

const QUEUE_MESSAGES = 'whatsapp_messages';
const QUEUE_DEAD_LETTER = 'whatsapp_messages_dlq';

let connection: Connection | null = null;
let channel: Channel | null = null;

/**
 * Conecta ao RabbitMQ
 */
export async function connect(): Promise<void> {
  try {
    connection = await amqp.connect(env.rabbitmqUrl);
    channel = await connection.createChannel();

    // Configura prefetch para processar 1 mensagem por vez por worker
    await channel.prefetch(1);

    // Cria fila principal com Dead Letter Queue
    await channel.assertQueue(QUEUE_DEAD_LETTER, {
      durable: true,
    });

    await channel.assertQueue(QUEUE_MESSAGES, {
      durable: true,
      deadLetterExchange: '',
      deadLetterRoutingKey: QUEUE_DEAD_LETTER,
    });

    console.log('[RabbitMQ] Conectado com sucesso');

    // Reconecta em caso de erro
    connection.on('error', (err) => {
      console.error('[RabbitMQ] Erro na conexao:', err);
      setTimeout(connect, 5000);
    });

    connection.on('close', () => {
      console.log('[RabbitMQ] Conexao fechada, reconectando...');
      setTimeout(connect, 5000);
    });
  } catch (error) {
    console.error('[RabbitMQ] Falha ao conectar:', error);
    setTimeout(connect, 5000);
  }
}

/**
 * Publica mensagem na fila
 */
export async function publishMessage(data: {
  instance: string;
  phone: string;
  text: string;
  name?: string;
  messageId: string;
  timestamp: number;
}): Promise<boolean> {
  if (!channel) {
    console.error('[RabbitMQ] Canal nao disponivel');
    return false;
  }

  try {
    const message = Buffer.from(JSON.stringify(data));

    channel.sendToQueue(QUEUE_MESSAGES, message, {
      persistent: true, // Mensagem sobrevive a restart do RabbitMQ
      messageId: data.messageId,
      timestamp: data.timestamp,
    });

    console.log(`[RabbitMQ] Mensagem enfileirada: ${data.phone}@${data.instance}`);
    return true;
  } catch (error) {
    console.error('[RabbitMQ] Erro ao publicar:', error);
    return false;
  }
}

/**
 * Consome mensagens da fila
 */
export async function consumeMessages(
  handler: (data: {
    instance: string;
    phone: string;
    text: string;
    name?: string;
    messageId: string;
    timestamp: number;
  }) => Promise<void>
): Promise<void> {
  if (!channel) {
    throw new Error('[RabbitMQ] Canal nao disponivel');
  }

  await channel.consume(
    QUEUE_MESSAGES,
    async (msg: ConsumeMessage | null) => {
      if (!msg) return;

      try {
        const data = JSON.parse(msg.content.toString());
        console.log(`[RabbitMQ] Processando mensagem de: ${data.phone}@${data.instance}`);

        await handler(data);

        // Confirma processamento
        channel!.ack(msg);
        console.log(`[RabbitMQ] Mensagem processada: ${data.phone}@${data.instance}`);
      } catch (error) {
        console.error('[RabbitMQ] Erro ao processar:', error);

        // Rejeita e envia para DLQ apos falha
        channel!.nack(msg, false, false);
      }
    },
    { noAck: false }
  );

  console.log('[RabbitMQ] Consumidor iniciado');
}

/**
 * Fecha conexao
 */
export async function disconnect(): Promise<void> {
  try {
    if (channel) await channel.close();
    if (connection) await connection.close();
    console.log('[RabbitMQ] Desconectado');
  } catch (error) {
    console.error('[RabbitMQ] Erro ao desconectar:', error);
  }
}

/**
 * Verifica status da conexao
 */
export function isConnected(): boolean {
  return connection !== null && channel !== null;
}

/**
 * Retorna quantidade de mensagens na fila
 */
export async function getQueueStatus(): Promise<{ messageCount: number; consumerCount: number } | null> {
  if (!channel) return null;

  try {
    const info = await channel.checkQueue(QUEUE_MESSAGES);
    return {
      messageCount: info.messageCount,
      consumerCount: info.consumerCount,
    };
  } catch {
    return null;
  }
}
