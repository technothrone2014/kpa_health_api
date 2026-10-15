"use strict";
// kpa_health_api/src/services/whatsappService.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetWhatsAppSession = exports.getLatestQrDataUrl = exports.getWhatsAppStatus = exports.sendWhatsAppOTP = exports.initWhatsApp = void 0;
const qrcode_1 = __importDefault(require("qrcode"));
const pino_1 = __importDefault(require("pino"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
let makeWASocket;
let DisconnectReason;
let useMultiFileAuthState;
const SESSION_DIR = path_1.default.resolve(process.cwd(), '.whatsapp-session');
const logger = (0, pino_1.default)({ level: 'warn' });
let sock = null;
let initializing = null;
let reconnectTimer = null;
let isConnected = false;
let connectionStatus = 'close';
let lastQrDataUrl = null;
let lastQrGeneratedAt = null;
let qrGeneration = 0;
let isResetting = false;
// ---------------------------------------------------------------
// Phone → WhatsApp JID normalizer (Kenyan default)
// ---------------------------------------------------------------
const toWhatsAppJid = (phone) => {
    let digits = phone.replace(/\D/g, '');
    if (digits.startsWith('0'))
        digits = '254' + digits.slice(1);
    if (!digits.startsWith('254'))
        digits = '254' + digits;
    return `${digits}@s.whatsapp.net`;
};
// ---------------------------------------------------------------
// Initialize the Baileys socket (non-blocking)
// ---------------------------------------------------------------
const initWhatsApp = async () => {
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
            if (!fs_1.default.existsSync(SESSION_DIR)) {
                fs_1.default.mkdirSync(SESSION_DIR, { recursive: true });
            }
            const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
            const socket = makeWASocket({
                auth: state,
                logger,
                printQRInTerminal: false,
            });
            sock = socket;
            socket.ev.on('creds.update', saveCreds);
            socket.ev.on('connection.update', (update) => {
                const { connection, lastDisconnect, qr } = update;
                if (qr) {
                    const generation = ++qrGeneration;
                    void qrcode_1.default.toDataURL(qr)
                        .then((dataUrl) => {
                        if (sock === socket &&
                            connectionStatus === 'connecting' &&
                            generation === qrGeneration) {
                            lastQrDataUrl = dataUrl;
                            lastQrGeneratedAt = Date.now();
                        }
                    })
                        .catch((error) => {
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
                    const statusCode = lastDisconnect?.error?.output?.statusCode;
                    const loggedOut = statusCode === DisconnectReason?.loggedOut;
                    connectionStatus = loggedOut ? 'logged_out' : 'close';
                    if (sock === socket)
                        sock = null;
                    console.warn(`⚠️ WhatsApp connection closed (code ${statusCode}).`);
                    if (!loggedOut && !isResetting && !reconnectTimer) {
                        reconnectTimer = setTimeout(() => {
                            reconnectTimer = null;
                            void (0, exports.initWhatsApp)().catch((error) => {
                                logger.error({ err: error }, 'WhatsApp reconnect failed');
                            });
                        }, 5000);
                    }
                    else if (loggedOut) {
                        console.error('❌ WhatsApp logged out. Reset the session and scan a new QR.');
                    }
                }
            });
        }
        catch (error) {
            connectionStatus = 'close';
            throw error;
        }
    })();
    try {
        await initializing;
    }
    finally {
        initializing = null;
    }
};
exports.initWhatsApp = initWhatsApp;
// ---------------------------------------------------------------
// Send an OTP via WhatsApp
// ---------------------------------------------------------------
const sendWhatsAppOTP = async (phoneNumber, otp, userName) => {
    if (!sock || !isConnected) {
        console.error('❌ WhatsApp not connected — OTP not sent');
        return false;
    }
    const jid = toWhatsAppJid(phoneNumber);
    const message = `🔐 *KPA Health Intelligence*\n\n` +
        (userName ? `Hello ${userName},\n\n` : '') +
        `Your verification code is:\n\n*${otp}*\n\n` +
        `⏰ Valid for 10 minutes only.\n` +
        `🔒 Never share this code with anyone.`;
    try {
        await sock.sendMessage(jid, { text: message });
        console.log(`✅ WhatsApp OTP sent to ${jid}`);
        return true;
    }
    catch (error) {
        console.error(`❌ WhatsApp OTP failed for ${jid}:`, error.message);
        return false;
    }
};
exports.sendWhatsAppOTP = sendWhatsAppOTP;
// ---------------------------------------------------------------
// Status introspection (for the /whatsapp/status endpoint)
// ---------------------------------------------------------------
const getWhatsAppStatus = () => ({
    connected: isConnected,
    status: connectionStatus,
    hasQr: !!lastQrDataUrl,
    qrGeneratedAt: lastQrGeneratedAt,
    sessionDir: SESSION_DIR,
});
exports.getWhatsAppStatus = getWhatsAppStatus;
const getLatestQrDataUrl = () => lastQrDataUrl;
exports.getLatestQrDataUrl = getLatestQrDataUrl;
// ---------------------------------------------------------------
// Manual reset (useful during dev when session gets stuck)
// ---------------------------------------------------------------
const resetWhatsAppSession = async () => {
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
            }
            catch (error) {
                logger.warn({ err: error }, 'WhatsApp logout during session reset failed');
            }
            sock = null;
        }
        if (fs_1.default.existsSync(SESSION_DIR)) {
            fs_1.default.rmSync(SESSION_DIR, { recursive: true, force: true });
        }
        isConnected = false;
        connectionStatus = 'close';
        lastQrDataUrl = null;
        lastQrGeneratedAt = null;
        qrGeneration++;
    }
    finally {
        isResetting = false;
    }
};
exports.resetWhatsAppSession = resetWhatsAppSession;
