import config from '../../firebase-applet-config.json';

declare global {
  interface Window {
    google: any;
    gapi: any;
  }
}

let tokenClient: any = null;
let gapiInitialized = false;

export async function initGoogleDriveAuth(onAccessToken: (token: string) => void) {
  return new Promise((resolve, reject) => {
    if (!window.google || !window.google.accounts) {
      // Load GIS script if not present
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        setupTokenClient(onAccessToken, resolve, reject);
      };
      script.onerror = (err) => reject(err);
      document.head.appendChild(script);
    } else {
      setupTokenClient(onAccessToken, resolve, reject);
    }
  });
}

function setupTokenClient(onAccessToken: (token: string) => void, resolve: any, reject: any) {
  try {
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: (config as any).oAuthClientId || '564908824564-placeholder.apps.googleusercontent.com',
      scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.readonly',
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

export async function exportToGoogleDrive(fileName: string, content: string, mimeType = 'application/json', accessToken: string) {
  const metadata = {
    name: fileName,
    mimeType: mimeType,
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', new Blob([content], { type: mimeType }));

  const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
    body: form,
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Google Drive Upload Failed: ${response.status} - ${errText}`);
  }

  return await response.json();
}

export async function listGoogleDriveFiles(accessToken: string) {
  const response = await fetch('https://www.googleapis.com/drive/v3/files?pageSize=20&fields=files(id, name, mimeType, modifiedTime)', {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to list Google Drive files: ${response.status}`);
  }

  const data = await response.json();
  return data.files || [];
}
