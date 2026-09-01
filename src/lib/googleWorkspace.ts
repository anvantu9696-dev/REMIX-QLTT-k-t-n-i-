import config from '../../firebase-applet-config.json';

declare global {
  interface Window {
    google: any;
  }
}

let tokenClient: any = null;

export async function initGoogleWorkspaceAuth(onAccessToken: (token: string) => void, scopes?: string[]) {
  const defaultScopes = [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.compose'
  ];
  const requestedScopes = (scopes && scopes.length > 0 ? scopes : defaultScopes).join(' ');

  return new Promise((resolve, reject) => {
    if (!window.google || !window.google.accounts) {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        setupTokenClient(requestedScopes, onAccessToken, resolve, reject);
      };
      script.onerror = (err) => reject(err);
      document.head.appendChild(script);
    } else {
      setupTokenClient(requestedScopes, onAccessToken, resolve, reject);
    }
  });
}

function setupTokenClient(scopes: string, onAccessToken: (token: string) => void, resolve: any, reject: any) {
  try {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: (config as any).oAuthClientId || '564908824564-placeholder.apps.googleusercontent.com',
      scope: scopes,
      callback: (resp: any) => {
        if (resp.error) {
          reject(resp);
          return;
        }
        onAccessToken(resp.access_token);
        resolve(resp.access_token);
      },
    });
    tokenClient.requestAccessToken({ prompt: 'consent' });
  } catch (err) {
    reject(err);
  }
}

// Gmail API helpers
export async function sendGmailEmail(accessToken: string, to: string, subject: string, bodyText: string) {
  const emailLines = [
    `To: ${to}`,
    `Subject: =?utf-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
    'Content-Type: text/plain; charset="UTF-8"',
    'MIME-Version: 1.0',
    '',
    bodyText
  ];
  const email = emailLines.join('\r\n');
  const encodedEmail = btoa(unescape(encodeURIComponent(email)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ raw: encodedEmail })
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gmail Send Failed: ${res.status} - ${errText}`);
  }
  return await res.json();
}

export async function listGmailMessages(accessToken: string, maxResults = 10) {
  const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });
  if (!res.ok) {
    throw new Error(`Failed to list Gmail messages: ${res.status}`);
  }
  const data = await res.json();
  const messages = data.messages || [];

  // Fetch details for each message
  const detailedMessages = await Promise.all(
    messages.map(async (msg: any) => {
      try {
        const detailRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        if (detailRes.ok) {
          return await detailRes.json();
        }
      } catch (e) {
        // ignore
      }
      return msg;
    })
  );
  return detailedMessages;
}
