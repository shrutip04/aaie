// backend/services/gmailService.js
import { google } from 'googleapis';

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/gmail/callback'
);

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.readonly',
];

export function getAuthUrl() {
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  });
}

export async function exchangeCode(code) {
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);
  return tokens;
}

export function getClientWithToken(accessToken, refreshToken) {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  client.setCredentials({ access_token: accessToken, refresh_token: refreshToken });
  return client;
}

export async function fetchUnreadEmails(authClient, maxResults = 10) {
  const gmail = google.gmail({ version: 'v1', auth: authClient });

  const listRes = await gmail.users.messages.list({
    userId: 'me',
    maxResults,
    q: 'is:unread label:inbox',
  });

  const messages = listRes.data.messages || [];

  const emails = await Promise.all(
    messages.map(async (msg) => {
      const detail = await gmail.users.messages.get({
        userId: 'me',
        id: msg.id,
        format: 'metadata',
        metadataHeaders: ['Subject', 'From', 'Date'],
      });

      const headers = detail.data.payload?.headers || [];
      const get = (name) => headers.find(h => h.name === name)?.value || '';

      return {
        id: msg.id,
        threadId: detail.data.threadId,
        subject: get('Subject'),
        from: get('From'),
        date: get('Date'),
        snippet: detail.data.snippet || '',
      };
    })
  );

  return emails;
}

export async function markAsRead(authClient, messageId) {
  const gmail = google.gmail({ version: 'v1', auth: authClient });
  await gmail.users.messages.modify({
    userId: 'me',
    id: messageId,
    requestBody: { removeLabelIds: ['UNREAD'] },
  });
  return { success: true };
}

export async function archiveEmail(authClient, messageId) {
  const gmail = google.gmail({ version: 'v1', auth: authClient });
  await gmail.users.messages.modify({
    userId: 'me',
    id: messageId,
    requestBody: { removeLabelIds: ['INBOX'] },
  });
  return { success: true };
}
