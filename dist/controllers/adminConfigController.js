"use strict";
// adminConfigController.ts
// Admin-only management of dynamic configuration tables
Object.defineProperty(exports, "__esModule", { value: true });
exports.toggleConfigItem = exports.createConfigItem = exports.listConfigItems = void 0;
const pool_1 = require("../db/pool");
const auditService_1 = require("../services/auditService");
const getClientIp = (req) => {
    const ip = req.ip || req.socket?.remoteAddress || null;
    if (ip === '::1')
        return '127.0.0.1';
    if (ip === '::ffff:127.0.0.1')
        return '127.0.0.1';
    return ip;
};
const getUserAgent = (req) => req.headers['user-agent'] || null;
// Whitelist of manageable config types.
// To add a new type later, just append here — the controller picks it up automatically.
const CONFIG_TYPES = {
    'referrals': { table: 'Referrals', orderBy: '"SortOrder" ASC, "Id" ASC', supportsSortOrder: true, supportsLegacyColumn: true },
    'bp-remarks': { table: 'BPRemarks', orderBy: '"Id" ASC', supportsSortOrder: false, supportsLegacyColumn: false },
    'rbs-remarks': { table: 'RBSRemarks', orderBy: '"Id" ASC', supportsSortOrder: false, supportsLegacyColumn: false },
};
// ==================== LIST ====================
const listConfigItems = async (req, res) => {
    try {
        const pool = await pool_1.poolPromise;
        const { type } = req.params;
        const config = CONFIG_TYPES[type];
        if (!config) {
            return res.status(400).json({ success: false, message: 'Invalid config type' });
        }
        // Admin view: return ALL rows (active + deleted) with usage counts
        const result = await pool.query(`SELECT "Id", "Title", "Deleted", "Status", "PostedOn", "UpdatedOn"
       FROM "${config.table}"
       ORDER BY ${config.orderBy}`);
        // For referrals, also grab how many historical Tallies reference each one
        let usageMap = {};
        if (type === 'referrals') {
            const usage = await pool.query(`SELECT "ReferralId", COUNT(*)::int AS count
         FROM "TallyReferrals"
         GROUP BY "ReferralId"`);
            usage.rows.forEach((r) => { usageMap[r.ReferralId] = r.count; });
        }
        const items = result.rows.map((r) => ({
            ...r,
            usageCount: usageMap[r.Id] ?? null,
        }));
        res.json({ success: true, items });
    }
    catch (error) {
        console.error('Error listing config items:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};
exports.listConfigItems = listConfigItems;
// ==================== CREATE ====================
const createConfigItem = async (req, res) => {
    try {
        const pool = await pool_1.poolPromise;
        const { type } = req.params;
        const { Title, LegacyColumn, SortOrder } = req.body;
        const userId = req.user?.userId || 1;
        const config = CONFIG_TYPES[type];
        if (!config) {
            return res.status(400).json({ success: false, message: 'Invalid config type' });
        }
        const trimmed = typeof Title === 'string' ? Title.trim() : '';
        if (trimmed.length < 2 || trimmed.length > 50) {
            return res.status(400).json({
                success: false,
                message: 'Title must be between 2 and 50 characters',
            });
        }
        // Prevent duplicates (case-insensitive) — including soft-deleted ones
        const dup = await pool.query(`SELECT "Id", "Deleted" FROM "${config.table}"
       WHERE LOWER("Title") = LOWER($1) LIMIT 1`, [trimmed]);
        if (dup.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: dup.rows[0].Deleted
                    ? `A referral named "${trimmed}" already exists (currently deactivated). Reactivate it instead.`
                    : `A referral named "${trimmed}" already exists.`,
            });
        }
        const now = new Date();
        // Build column list dynamically based on what the table supports
        const cols = ['"UserId"', '"Title"', '"PostedOn"', '"UpdatedOn"', '"Pinned"', '"Status"', '"Deleted"'];
        const vals = [userId, trimmed, now, now, false, true, false];
        const placeholders = ['$1', '$2', '$3', '$4', '$5', '$6', '$7'];
        let idx = 8;
        if (config.supportsLegacyColumn) {
            cols.push('"LegacyColumn"');
            vals.push(LegacyColumn || null);
            placeholders.push(`$${idx++}`);
        }
        if (config.supportsSortOrder) {
            cols.push('"SortOrder"');
            vals.push(Number.isFinite(SortOrder) ? SortOrder : 100);
            placeholders.push(`$${idx++}`);
        }
        const result = await pool.query(`INSERT INTO "${config.table}" (${cols.join(', ')})
       VALUES (${placeholders.join(', ')})
       RETURNING "Id", "Title", "Deleted", "Status", "PostedOn", "UpdatedOn"`, vals);
        await (0, auditService_1.auditLog)(userId, 'CONFIG_ITEM_CREATED', config.table, result.rows[0].Id.toString(), null, { type, Title: trimmed, LegacyColumn, SortOrder }, getClientIp(req), getUserAgent(req));
        res.status(201).json({ success: true, item: result.rows[0] });
    }
    catch (error) {
        console.error('Error creating config item:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};
exports.createConfigItem = createConfigItem;
// ==================== TOGGLE (soft delete / reactivate) ====================
const toggleConfigItem = async (req, res) => {
    try {
        const pool = await pool_1.poolPromise;
        const { type, id } = req.params;
        const { Deleted } = req.body; // boolean — required
        const userId = req.user?.userId || 1;
        const config = CONFIG_TYPES[type];
        if (!config) {
            return res.status(400).json({ success: false, message: 'Invalid config type' });
        }
        if (typeof Deleted !== 'boolean') {
            return res.status(400).json({
                success: false,
                message: 'Body must include { Deleted: true|false }',
            });
        }
        const now = new Date();
        const result = await pool.query(`UPDATE "${config.table}"
       SET "Deleted" = $1, "UpdatedOn" = $2
       WHERE "Id" = $3
       RETURNING "Id", "Title", "Deleted", "Status"`, [Deleted, now, id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Item not found' });
        }
        await (0, auditService_1.auditLog)(userId, Deleted ? 'CONFIG_ITEM_DEACTIVATED' : 'CONFIG_ITEM_REACTIVATED', config.table, id, null, { type, Title: result.rows[0].Title }, getClientIp(req), getUserAgent(req));
        res.json({ success: true, item: result.rows[0] });
    }
    catch (error) {
        console.error('Error toggling config item:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};
exports.toggleConfigItem = toggleConfigItem;
