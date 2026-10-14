// kpa_health_api/src/services/whatsappService.ts

import { Boom } from '@hapi/boom';
import qrcode from 'qrcode-terminal';
import pino from 'pino';
import path from 'path';
import fs from 'fs';

let makeWASocket: any;
let DisconnectReason: any;
let useMultiFileAuthState: any;

const SESSION_DIR = path.resolve(process.cwd(), '.whatsapp-session');
const logger = pino({ level: 'warn' });

let sock: any = null;
let isConnected = false;
let connectionStatus: 'connecting' | 'open' | 'close' | 'logged_out' = 'close';
let lastQrDataUrl: string | null = null;
let lastQrGeneratedAt: number | null = null;

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
  if (sock && isConnected) {
    console.log('✅ WhatsApp already connected');
    return;
  }

  // 🔑 Dynamic import — works from CommonJS, resolves ESM at runtime
  if (!makeWASocket) {
    const baileys = await import('@whiskeysockets/baileys');
    makeWASocket = baileys.default;
    DisconnectReason = baileys.DisconnectReason;
    useMultiFileAuthState = baileys.useMultiFileAuthState;
    console.log('✅ Baileys ESM module loaded dynamically');
  }

  if (!fs.existsSync(SESSION_DIR)) {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);

  sock = makeWASocket({
    auth: state,
    logger,
    printQRInTerminal: false,
  });

  sock!.ev.on('creds.update', saveCreds);

  sock!.ev.on('connection.update', (update: any) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log('\n📱 Scan this QR code with your WhatsApp sender account:\n');
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'open') {
      isConnected = true;
      console.log('✅ WhatsApp sender connected');
    }

    if (connection === 'close') {
      isConnected = false;
      const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason?.loggedOut;
      console.warn(`⚠️ WhatsApp connection closed (code ${statusCode}). Reconnect: ${shouldReconnect}`);
      if (shouldReconnect) {
        setTimeout(() => initWhatsApp(), 5000);
      } else {
        console.error('❌ WhatsApp logged out. Delete .whatsapp-session and re-scan.');
      }
    }
  });

  // Wait until connection is open (with timeout)
  await new Promise<void>((resolve, reject) => {
    const started = Date.now();
    const check = setInterval(() => {
      if (isConnected) { clearInterval(check); resolve(); }
      if (Date.now() - started > 60_000) {
        clearInterval(check);
        reject(new Error('WhatsApp connection timed out — did you scan the QR?'));
      }
    }, 500);
  });
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
  try {
    if (sock) {
      try { await sock.logout(); } catch { /* ignore */ }
      sock = null;
    }
    if (fs.existsSync(SESSION_DIR)) {
      fs.rmSync(SESSION_DIR, { recursive: true, force: true });
    }
    isConnected = false;
    connectionStatus = 'close';
    lastQrDataUrl = null;
    lastQrGeneratedAt = null;
  } catch (err: any) {
    console.error('Reset failed:', err.message);
  }
};
