import { google } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Carrega credenciais do Google Calendar
 * 
 * Prioridade:
 * 1. Variável de ambiente GOOGLE_CREDENTIALS_JSON (para produção/Render)
 * 2. Arquivo credentials/credentials.json (para desenvolvimento local)
 */
function loadCredentials(): any {
  // Opção 1: Variável de ambiente (usado no Render)
  const envCredentials = process.env.GOOGLE_CREDENTIALS_JSON;
  if (envCredentials) {
    try {
      return JSON.parse(envCredentials);
    } catch (error) {
      throw new Error(
        'GOOGLE_CREDENTIALS_JSON inválido. Deve ser um JSON válido.'
      );
    }
  }

  // Opção 2: Arquivo local (desenvolvimento)
  const credentialsPath = path.join(process.cwd(), 'credentials', 'credentials.json');
  
  if (!fs.existsSync(credentialsPath)) {
    throw new Error(
      'Credenciais do Google não encontradas.\n' +
      'Configure GOOGLE_CREDENTIALS_JSON como variável de ambiente OU\n' +
      'coloque o arquivo credentials.json em credentials/credentials.json'
    );
  }

  return JSON.parse(fs.readFileSync(credentialsPath, 'utf-8'));
}

const credentials = loadCredentials();

export const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events',
  ],
});

export const calendar = google.calendar({ version: 'v3', auth });

export { credentials };
