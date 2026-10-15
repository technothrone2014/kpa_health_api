"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFeedbackStats = exports.saveFeedback = void 0;
const pool_1 = require("../db/pool");
const saveFeedback = async (req, res) => {
    try {
        const { messageId, feedback, query, response, userId } = req.body;
        const pool = await pool_1.poolPromise;
        await pool.query(`
      INSERT INTO "AIFeedback" ("MessageId", "Feedback", "Query", "Response", "UserId", "CreatedAt")
      VALUES ($1, $2, $3, $4, $5, NOW())
    `, [messageId, feedback, query, response, userId]);
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error saving feedback:', error);
        res.status(500).json({ error: 'Failed to save feedback' });
    }
};
exports.saveFeedback = saveFeedback;
const getFeedbackStats = async (req, res) => {
    try {
        const pool = await pool_1.poolPromise;
        const result = await pool.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN "Feedback" = 'positive' THEN 1 ELSE 0 END) as positive,
        SUM(CASE WHEN "Feedback" = 'negative' THEN 1 ELSE 0 END) as negative
      FROM "AIFeedback"
    `);
        res.json(result.rows[0]);
    }
    catch (error) {
        console.error('Error getting feedback stats:', error);
        res.status(500).json({ error: 'Failed to get feedback stats' });
    }
};
exports.getFeedbackStats = getFeedbackStats;
