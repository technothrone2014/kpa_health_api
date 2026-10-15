"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// kpa_health_api/src/routes/whatsapp.ts
const express_1 = __importDefault(require("express"));
const whatsappService_js_1 = require("../services/whatsappService.js");
const router = express_1.default.Router();
// GET /api/v1/whatsapp/status — JSON status
router.get('/status', (_req, res) => {
    res.json({ success: true, ...(0, whatsappService_js_1.getWhatsAppStatus)() });
});
// GET /api/v1/whatsapp/qr — HTML page with scannable QR
router.get('/qr', (_req, res) => {
    const qr = (0, whatsappService_js_1.getLatestQrDataUrl)();
    if (!qr) {
        return res.status(200).send(`<!DOCTYPE html>
      <html>
      <head><title>WhatsApp QR</title></head>
      <body style="font-family:system-ui,sans-serif;text-align:center;padding:60px;background:#f8fafc">
        <h2 style="color:#0B2F9E">No QR available</h2>
        <p style="color:#6B7280">WhatsApp is either already connected, still starting up, or logged out.</p>
        <p><a href="/api/v1/whatsapp/status" style="color:#0B2F9E">Check status →</a></p>
        <p style="color:#999;font-size:13px">Page auto-refreshes every 5 s.</p>
        <script>setTimeout(() => location.reload(), 5000);</script>
      </body>
      </html>`);
    }
    res.send(`<!DOCTYPE html>
    <html>
    <head><title>WhatsApp QR — KPA Health</title></head>
    <body style="font-family:system-ui,sans-serif;text-align:center;padding:40px;background:#f8fafc;margin:0">
      <div style="max-width:480px;margin:0 auto;background:white;border-radius:20px;padding:32px;box-shadow:0 10px 40px rgba(0,0,0,0.08)">
        <h2 style="color:#0B2F9E;margin:0 0 8px">Scan to Link WhatsApp</h2>
        <p style="color:#6B7280;margin:0 0 24px;font-size:14px">
          Open WhatsApp → <b>Settings</b> → <b>Linked Devices</b> → <b>Link a Device</b>
        </p>
        <img src="${qr}" alt="WhatsApp QR"
             style="width:320px;height:320px;border:8px solid #F8FAFC;border-radius:16px" />
        <p style="color:#999;font-size:12px;margin-top:20px">
          Page auto-refreshes every 20 s. QR expires after ~60 s on WhatsApp's side.
        </p>
      </div>
      <script>setTimeout(() => location.reload(), 20000);</script>
    </body>
    </html>`);
});
// POST /api/v1/whatsapp/reconnect — nudge a fresh connection attempt
router.post('/reconnect', async (_req, res) => {
    try {
        await (0, whatsappService_js_1.initWhatsApp)();
        res.json({ success: true, message: 'Reconnect triggered' });
    }
    catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});
// POST /api/v1/whatsapp/reset — wipe session (dev only)
router.post('/reset', async (_req, res) => {
    try {
        await (0, whatsappService_js_1.resetWhatsAppSession)();
        await (0, whatsappService_js_1.initWhatsApp)();
        res.json({ success: true, message: 'Session reset — new QR incoming' });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});
exports.default = router;
