// kpa_health_api/src/services/whatsappService.ts

import QRCode from 'qrcode';
import pino from 'pino';
import path from 'path';
import fs from 'fs';

let makeWASocket: any;
let DisconnectReason: any;
let useMultiFileAuthState: any;

const SESSION_DIR = path.resolve(process.cwd(), '.whatsapp-session');
const logger = pino({ level: 'warn' });

let sock: any = null;
let initializing: Promise<void> | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let isConnected = false;
let connectionStatus: 'connecting' | 'open' | 'close' | 'logged_out' = 'close';
let lastQrDataUrl: string | null = null;
let lastQrGeneratedAt: number | null = null;
let qrGeneration = 0;
let isResetting = false;

// ---------------------------------------------------------------
// Phone → WhatsApp JID normalizer (Kenyan default)
// ---------------------------------------------------------------
const toWhatsAppJid = (phone: string): string => {
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('0')) digits = '254' + digits.slice(1);
  if (!digits.startsWith('254')) digits = '254' + digits;
  return `${digits}@s.whatsapp.net`;
};

// ---------------------------------------------------------------
// Initialize the Baileys socket (non-blocking)
// ---------------------------------------------------------------
export const initWhatsApp = async (): Promise<void> => {
  if (isConnected || sock || initializing) {
    return;
  }

  initializing = (async () => {
    connectionStatus = 'connecting';
    lastQrDataUrl = null;
    lastQrGeneratedAt = null;

    try {
      if (!makeWASocket) {
        const baileys = await import('@whiskeysockets/baileys');
        makeWASocket = baileys.default;
        DisconnectReason = baileys.DisconnectReason;
        useMultiFileAuthState = baileys.useMultiFileAuthState;
      }

      if (!fs.existsSync(SESSION_DIR)) {
        fs.mkdirSync(SESSION_DIR, { recursive: true });
      }

      const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
      const socket = makeWASocket({
        auth: state,
        logger,
        printQRInTerminal: false,
      });

      sock = socket;
      socket.ev.on('creds.update', saveCreds);
      socket.ev.on('connection.update', (update: any) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          const generation = ++qrGeneration;
          void QRCode.toDataURL(qr)
            .then((dataUrl) => {
              if (
                sock === socket &&
                connectionStatus === 'connecting' &&
                generation === qrGeneration
              ) {
                lastQrDataUrl = dataUrl;
                lastQrGeneratedAt = Date.now();
              }
            })
            .catch((error: unknown) => {
              logger.error({ err: error }, 'Failed to generate WhatsApp QR code');
            });
        }

        if (connection === 'connecting') {
          connectionStatus = 'connecting';
        }

        if (connection === 'open') {
          qrGeneration++;
          isConnected = true;
          connectionStatus = 'open';
          lastQrDataUrl = null;
          lastQrGeneratedAt = null;
          console.log('✅ WhatsApp sender connected');
        }

        if (connection === 'close') {
          qrGeneration++;
          isConnected = false;
          lastQrDataUrl = null;
          lastQrGeneratedAt = null;
          const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
          const loggedOut = statusCode === DisconnectReason?.loggedOut;
          connectionStatus = loggedOut ? 'logged_out' : 'close';
          if (sock === socket) sock = null;
          console.warn(`⚠️ WhatsApp connection closed (code ${statusCode}).`);

          if (!loggedOut && !isResetting && !reconnectTimer) {
            reconnectTimer = setTimeout(() => {
              reconnectTimer = null;
              void initWhatsApp().catch((error: unknown) => {
                logger.error({ err: error }, 'WhatsApp reconnect failed');
              });
            }, 5000);
          } else if (loggedOut) {
            console.error('❌ WhatsApp logged out. Reset the session and scan a new QR.');
          }
        }
      });
    } catch (error) {
      connectionStatus = 'close';
      throw error;
    }
  })();

  try {
    await initializing;
  } finally {
    initializing = null;
  }
};

// ---------------------------------------------------------------
// Send an OTP via WhatsApp
// ---------------------------------------------------------------
export const sendWhatsAppOTP = async (
  phoneNumber: string,
  otp: string,
  userName?: string
): Promise<boolean> => {
  if (!sock || !isConnected) {
    console.error('❌ WhatsApp not connected — OTP not sent');
    return false;
  }

  const jid = toWhatsAppJid(phoneNumber);
  const message =
    `🔐 *KPA Health Intelligence*\n\n` +
    (userName ? `Hello ${userName},\n\n` : '') +
    `Your verification code is:\n\n*${otp}*\n\n` +
    `⏰ Valid for 10 minutes only.\n` +
    `🔒 Never share this code with anyone.`;

  try {
    await sock.sendMessage(jid, { text: message });
    console.log(`✅ WhatsApp OTP sent to ${jid}`);
    return true;
  } catch (error: any) {
    console.error(`❌ WhatsApp OTP failed for ${jid}:`, error.message);
    return false;
  }
};

// ---------------------------------------------------------------
// Status introspection (for the /whatsapp/status endpoint)
// ---------------------------------------------------------------
export const getWhatsAppStatus = () => ({
  connected: isConnected,
  status: connectionStatus,
  hasQr: !!lastQrDataUrl,
  qrGeneratedAt: lastQrGeneratedAt,
  sessionDir: SESSION_DIR,
});

export const getLatestQrDataUrl = (): string | null => lastQrDataUrl;

// ---------------------------------------------------------------
// Manual reset (useful during dev when session gets stuck)
// ---------------------------------------------------------------
export const resetWhatsAppSession = async (): Promise<void> => {
  isResetting = true;
  try {
    if (initializing) {
      await initializing;
    }
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }

    if (sock) {
      try {
        await sock.logout();
      } catch (error) {
        logger.warn({ err: error }, 'WhatsApp logout during session reset failed');
      }
      sock = null;
    }
    if (fs.existsSync(SESSION_DIR)) {
      fs.rmSync(SESSION_DIR, { recursive: true, force: true });
    }
    isConnected = false;
    connectionStatus = 'close';
    lastQrDataUrl = null;
    lastQrGeneratedAt = null;
    qrGeneration++;
  } finally {
    isResetting = false;
  }
};
