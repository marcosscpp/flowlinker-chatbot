import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Array com mensagens de reativação otimizadas
// As primeiras são as mais efetivas (abertas, geram mais engajamento)
// As últimas são alternativas caso precise de mais variação
const mensagens = [
  // TOP 5 - Mais efetivas (abertas, geram conversa)
  "Olá! Aqui é da Flowlinker. Desculpe a demora, nosso lançamento foi um sucesso total e estamos respondendo a todos individualmente. Tenho poucas vagas para os primeiros passos nas próximas semanas. Como posso te ajudar hoje?",
  "Oi! Tudo bem? Pedimos desculpas pela espera. O lançamento da Flowlinker superou o que prevíamos! Estamos reorganizando a agenda para dar atenção total a cada cliente. O que você gostaria de saber sobre a Flowlinker?",
  "Olá! Devido ao alto volume do nosso lançamento, demoramos um pouco, mas cheguei! Queremos dar atenção individual a você. Temos poucas vagas exclusivas para iniciar o projeto agora. Qual é sua principal dúvida sobre a ferramenta?",
  "Tudo bem? O sucesso do lançamento da Flowlinker foi gigante e estamos correndo para atender todo mundo com qualidade. Estou aqui para te ajudar! O que você precisa saber para começar?",
  "Olá, desculpe a demora! Nosso lançamento foi incrível e estamos selecionando os próximos clientes para o acompanhamento individual. Posso reservar uma das poucas vagas de início para você. Como prefere prosseguir?",
  
  // Boas alternativas (ainda abertas)
  "Oi! Passando para pedir desculpas pelo atraso. A Flowlinker decolou mais rápido do que esperávamos! Estamos com vagas limitadas para as próximas semanas. Vamos conversar sobre como podemos ajudar você?",
  "Olá! O lançamento da Flowlinker foi um marco e agora estamos focados no atendimento personalizado. Tenho poucas janelas de início disponíveis. O que te trouxe até aqui hoje?",
  "Tudo certo? Desculpe o sumiço, estávamos ajustando tudo após o sucesso do lançamento. Estamos priorizando novos clientes agora. Me conta: qual seu maior desafio nas redes sociais?",
  "Olá! Priorizamos a qualidade e, por isso, a demora. O lançamento da Flowlinker foi um sucesso e estamos com agenda concorrida. Tenho poucas vagas para iniciarmos nos próximos dias. O que você precisa?",
  "Oi, aqui é da equipe Flowlinker! O volume de pedidos foi enorme, mas queremos te atender pessoalmente. Como posso te ajudar a entender melhor a ferramenta?",
  
  // Alternativas com call-to-action mais direto
  "Olá! Vencemos a primeira onda do lançamento e agora estamos organizando o atendimento individual. Restam poucas vagas para começar este mês. Posso te ajudar?",
  "Tudo bem? Peço desculpas pela demora, o lançamento da Flowlinker superou todas as metas. Estamos focados em dar atenção exclusiva a cada novo cliente. Me avise para reservarmos sua vaga de início.",
  "Olá! A Flowlinker cresceu rápido demais e estamos ajustando a agenda para te dar a melhor experiência. Temos vagas limitadas para as próximas semanas para começar o trabalho. Vamos avançar?",
  "Oi! O sucesso do nosso lançamento nos deixou ocupados, mas não esquecemos de você. Estamos abrindo novas vagas para acompanhamento individual. Posso priorizar seu contato?",
  "Olá, desculpe o atraso! Estamos respondendo a todos pessoalmente após o sucesso do lançamento da Flowlinker. Me avise para eu organizar seu atendimento prioritário de boas-vindas.",
  
  // Últimas opções (ainda funcionam, mas são mais fechadas)
  "Tudo bem por aí? O lançamento da Flowlinker foi incrível e agora estamos selecionando quem entra na próxima fase de implementação. Se sim, me avise agora para eu garantir sua vaga!",
  "Olá! Pedimos desculpas pela espera, o lançamento foi um sucesso absoluto. Estamos reorganizando o time para te atender com exclusividade. Posso te colocar na lista de prioridade para os primeiros passos?",
  "Oi! A Flowlinker está com pouquíssimas vagas para novos clientes após o sucesso do lançamento. Se sim, me avise rápido para eu conseguir te encaixar na agenda das próximas semanas.",
  "Olá! Peço desculpas pela demora. Nosso lançamento foi além do esperado e estamos cuidando de cada caso individualmente. Me avise para eu priorizar seu início agora.",
  "Tudo bem? Estamos finalmente conseguindo responder a todos após o lançamento da Flowlinker! Tenho poucas vagas exclusivas para atendimento. Podemos prosseguir?"
];

/**
 * Escolhe uma mensagem do array
 * Prioriza as TOP 5 (mais efetivas) com 60% de chance
 * Resto com 40% de chance para variação
 */
function getRandomMessage(): string {
  const random = Math.random();
  
  // 60% de chance de usar uma das TOP 5 (mais efetivas)
  if (random < 0.6) {
    const top5Index = Math.floor(Math.random() * 5);
    return mensagens[top5Index];
  }
  
  // 40% de chance de usar outras mensagens (para variação)
  const otherIndex = Math.floor(Math.random() * (mensagens.length - 5)) + 5;
  return mensagens[otherIndex];
}

async function main() {
  console.log('Adicionando mensagens de reativação ao histórico...\n');

  // Busca todos os contatos do ConversationLog
  const contacts = await prisma.conversationLog.findMany({
    select: {
      phone: true,
      messages: true,
    },
  });

  console.log(`Encontrados ${contacts.length} contatos.\n`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const contact of contacts) {
    try {
      const currentMessages = (contact.messages as Array<{ role: string; content: string }>) || [];
      
      // Verifica se já tem uma mensagem de reativação (contém "Flowlinker" e "lançamento")
      const hasReactivationMessage = currentMessages.some(
        msg => msg.role === 'assistant' && 
               msg.content.includes('Flowlinker') && 
               msg.content.includes('lançamento')
      );

      if (hasReactivationMessage) {
        console.log(`⏭️  ${contact.phone} já tem mensagem de reativação, pulando...`);
        skipped++;
        continue;
      }

      // Escolhe uma mensagem aleatória
      const reactivationMessage = getRandomMessage();

      // Adiciona a mensagem de reativação como "assistant" no histórico
      const updatedMessages = [
        ...currentMessages,
        { role: 'assistant', content: reactivationMessage }
      ];

      // Limita a 20 mensagens (mantém as mais recentes)
      const limitedMessages = updatedMessages.slice(-20);

      // Atualiza o registro
      await prisma.conversationLog.update({
        where: { phone: contact.phone },
        data: {
          messages: limitedMessages as any,
          conversationStatus: 'REACTIVATING',
          lastContactAt: new Date(),
        },
      });

      updated++;
      if (updated % 50 === 0) {
        console.log(`✅ ${updated} contatos atualizados...`);
      }
    } catch (error) {
      console.error(`❌ Erro ao atualizar ${contact.phone}:`, error);
      errors++;
    }
  }

  console.log('\n--- Processamento finalizado! ---');
  console.log(`✅ Contatos atualizados: ${updated}`);
  console.log(`⏭️  Contatos pulados (já tinham mensagem): ${skipped}`);
  console.log(`❌ Erros: ${errors}`);
  console.log(`📊 Total processado: ${contacts.length}`);
  console.log('\n💡 Cada contato recebeu uma mensagem de reativação aleatória.');
  console.log('💡 Quando o cliente responder, o bot vai usar essa mensagem como contexto.');
}

main()
  .catch((e) => {
    console.error('Erro na execução:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

