import { google } from 'googleapis';
import * as fs from 'fs';
import * as path from 'path';

const credentialsPath = path.join(process.cwd(), 'credentials', 'credentials.json');

if (!fs.existsSync(credentialsPath)) {
  throw new Error(
    'credentials.json nao encontrado em credentials/credentials.json\n' +
    'Baixe o arquivo de credenciais do Google Cloud Console e coloque na pasta credentials/'
  );
}

const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf-8'));

export const auth = new google.auth.GoogleAuth({
  credentials,
  scopes: [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events',
  ],
});

export const calendar = google.calendar({ version: 'v3', auth });

export { credentials };
