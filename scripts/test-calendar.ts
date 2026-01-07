/**
 * Script para testar a integracao com Google Calendar
 *
 * Uso: npm run test:calendar
 *
 * Antes de rodar:
 * 1. Coloque o credentials.json na raiz do projeto
 * 2. Compartilhe seu calendario com o email da Service Account
 *    (email esta no credentials.json como "client_email")
 */

import { calendar, credentials } from '../src/config/google';

const CALENDAR_ID = process.argv[2] || 'primary';

async function testListCalendars() {
  console.log('\n=== TESTE 1: Listar Calendarios Acessiveis ===\n');

  try {
    const response = await calendar.calendarList.list();
    const calendars = response.data.items || [];

    if (calendars.length === 0) {
      console.log('Nenhum calendario encontrado.');
      console.log('Certifique-se de compartilhar seu calendario com:');
      console.log(`  ${credentials.client_email}\n`);
    } else {
      console.log('Calendarios encontrados:');
      calendars.forEach((cal, i) => {
        console.log(`  ${i + 1}. ${cal.summary}`);
        console.log(`     ID: ${cal.id}`);
        console.log(`     Acesso: ${cal.accessRole}\n`);
      });
    }

    return calendars;
  } catch (error: any) {
    console.error('Erro ao listar calendarios:', error.message);
    throw error;
  }
}

async function testFreeBusy(calendarIds: string[]) {
  console.log('\n=== TESTE 2: Verificar Disponibilidade (FreeBusy) ===\n');

  const now = new Date();
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59);

  console.log(`Verificando disponibilidade de ${now.toLocaleString()} ate ${endOfDay.toLocaleString()}\n`);

  try {
    const response = await calendar.freebusy.query({
      requestBody: {
        timeMin: now.toISOString(),
        timeMax: endOfDay.toISOString(),
        timeZone: 'America/Sao_Paulo',
        items: calendarIds.map(id => ({ id })),
      },
    });

    const calendars = response.data.calendars || {};

    for (const [calId, data] of Object.entries(calendars)) {
      console.log(`Calendario: ${calId}`);

      if (data.errors) {
        console.log(`  ERRO: ${JSON.stringify(data.errors)}`);
        continue;
      }

      const busy = data.busy || [];
      if (busy.length === 0) {
        console.log('  Status: LIVRE o dia todo');
      } else {
        console.log('  Horarios ocupados:');
        busy.forEach(slot => {
          const start = new Date(slot.start!).toLocaleTimeString('pt-BR');
          const end = new Date(slot.end!).toLocaleTimeString('pt-BR');
          console.log(`    - ${start} ate ${end}`);
        });
      }
      console.log('');
    }

    return response.data;
  } catch (error: any) {
    console.error('Erro ao verificar disponibilidade:', error.message);
    throw error;
  }
}

async function testCreateEvent(calendarId: string) {
  console.log('\n=== TESTE 3: Criar Evento de Teste ===\n');

  const now = new Date();
  const start = new Date(now.getTime() + 60 * 60 * 1000); // +1 hora
  const end = new Date(start.getTime() + 30 * 60 * 1000); // +30 min

  console.log(`Criando evento de teste em: ${calendarId}`);
  console.log(`Inicio: ${start.toLocaleString()}`);
  console.log(`Fim: ${end.toLocaleString()}\n`);

  try {
    const response = await calendar.events.insert({
      calendarId,
      requestBody: {
        summary: '[TESTE] Reuniao de Teste - Pode Deletar',
        description: 'Evento criado automaticamente para testar a integracao.',
        start: {
          dateTime: start.toISOString(),
          timeZone: 'America/Sao_Paulo',
        },
        end: {
          dateTime: end.toISOString(),
          timeZone: 'America/Sao_Paulo',
        },
      },
    });

    console.log('Evento criado com sucesso!');
    console.log(`  ID: ${response.data.id}`);
    console.log(`  Link: ${response.data.htmlLink}\n`);

    return response.data;
  } catch (error: any) {
    console.error('Erro ao criar evento:', error.message);

    if (error.code === 403) {
      console.log('\nDica: Verifique se a Service Account tem permissao de escrita.');
      console.log('Compartilhe o calendario com permissao "Fazer alteracoes em eventos"');
    }

    throw error;
  }
}

async function testDeleteEvent(calendarId: string, eventId: string) {
  console.log('\n=== TESTE 4: Deletar Evento de Teste ===\n');

  try {
    await calendar.events.delete({
      calendarId,
      eventId,
    });

    console.log('Evento deletado com sucesso!\n');
  } catch (error: any) {
    console.error('Erro ao deletar evento:', error.message);
  }
}

async function main() {
  console.log('==========================================');
  console.log('   TESTE DE INTEGRACAO GOOGLE CALENDAR');
  console.log('==========================================');
  console.log(`\nService Account: ${credentials.client_email}`);
  console.log(`Projeto: ${credentials.project_id}`);

  try {
    // Teste 1: Listar calendarios
    const calendars = await testListCalendars();

    if (calendars.length === 0) {
      console.log('\n--- FIM DOS TESTES (sem calendarios disponiveis) ---');
      return;
    }

    // Usa o primeiro calendario ou o especificado via CLI
    const targetCalendar = CALENDAR_ID === 'primary'
      ? calendars[0]?.id || 'primary'
      : CALENDAR_ID;

    // Teste 2: FreeBusy
    await testFreeBusy([targetCalendar]);

    // Teste 3: Criar evento
    const event = await testCreateEvent(targetCalendar);

    // Teste 4: Deletar evento (limpeza)
    if (event?.id) {
      await testDeleteEvent(targetCalendar, event.id);
    }

    console.log('==========================================');
    console.log('   TODOS OS TESTES PASSARAM!');
    console.log('==========================================\n');

  } catch (error) {
    console.log('\n==========================================');
    console.log('   ALGUNS TESTES FALHARAM');
    console.log('==========================================\n');
    process.exit(1);
  }
}

main();
