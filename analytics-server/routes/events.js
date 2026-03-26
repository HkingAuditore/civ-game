import { Router } from 'express';
import { getPool } from '../db.js';

const router = Router();

// ── POST /api/session/start ──

router.post('/session/start', async (req, res) => {
    try {
        const { userId, sessionId, appVersion, difficulty, scenario, userAgent } = req.body;
        if (!userId || !sessionId) {
            return res.status(400).json({ error: 'userId and sessionId required' });
        }
        const pool = getPool();
        await pool.execute(
            `INSERT INTO sessions (user_id, session_id, app_version, difficulty, scenario, user_agent, started_at)
             VALUES (?, ?, ?, ?, ?, ?, NOW())`,
            [userId, sessionId, appVersion || null, difficulty || null, scenario || null, userAgent || null]
        );
        res.json({ ok: true });
    } catch (err) {
        console.error('[session/start]', err.message);
        res.status(500).json({ error: 'Internal error' });
    }
});

// ── POST /api/session/end ──

router.post('/session/end', async (req, res) => {
    try {
        const { sessionId, durationMs } = req.body;
        if (!sessionId) {
            return res.status(400).json({ error: 'sessionId required' });
        }
        const pool = getPool();
        await pool.execute(
            `UPDATE sessions SET ended_at = NOW(), duration_ms = ? WHERE session_id = ?`,
            [durationMs || null, sessionId]
        );
        res.json({ ok: true });
    } catch (err) {
        console.error('[session/end]', err.message);
        res.status(500).json({ error: 'Internal error' });
    }
});

// ── POST /api/session/heartbeat ──

router.post('/session/heartbeat', async (req, res) => {
    try {
        const { sessionId } = req.body;
        if (!sessionId) {
            return res.status(400).json({ error: 'sessionId required' });
        }
        const pool = getPool();
        await pool.execute(
            `UPDATE sessions SET last_seen = NOW() WHERE session_id = ?`,
            [sessionId]
        );
        res.json({ ok: true });
    } catch (err) {
        console.error('[session/heartbeat]', err.message);
        res.status(500).json({ error: 'Internal error' });
    }
});

// ── POST /api/events ──
// 批量入库：body = { design: [...], resource: [...], errors: [...] }

router.post('/events', async (req, res) => {
    try {
        const { design, resource, errors } = req.body;
        const pool = getPool();
        const promises = [];

        // Design events
        if (Array.isArray(design) && design.length > 0) {
            const values = design.map(e => [
                e.userId, e.sessionId, e.eventId,
                e.value ?? null, e.epoch || null,
                e.daysElapsed ?? null, e.timestamp ? new Date(e.timestamp) : new Date(),
            ]);
            const placeholders = values.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ');
            const flat = values.flat();
            promises.push(
                pool.execute(
                    `INSERT INTO design_events (user_id, session_id, event_id, event_value, epoch, days_elapsed, created_at)
                     VALUES ${placeholders}`,
                    flat
                )
            );
        }

        // Resource events
        if (Array.isArray(resource) && resource.length > 0) {
            const values = resource.map(e => [
                e.userId, e.sessionId, e.flowType,
                e.currency, e.amount ?? 0, e.itemType || null,
                e.itemId || null, e.timestamp ? new Date(e.timestamp) : new Date(),
            ]);
            const placeholders = values.map(() => '(?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
            const flat = values.flat();
            promises.push(
                pool.execute(
                    `INSERT INTO resource_events (user_id, session_id, flow_type, currency, amount, item_type, item_id, created_at)
                     VALUES ${placeholders}`,
                    flat
                )
            );
        }

        // Error events
        if (Array.isArray(errors) && errors.length > 0) {
            const values = errors.map(e => [
                e.userId, e.sessionId, e.severity,
                (e.message || '').slice(0, 1024),
                e.timestamp ? new Date(e.timestamp) : new Date(),
            ]);
            const placeholders = values.map(() => '(?, ?, ?, ?, ?)').join(', ');
            const flat = values.flat();
            promises.push(
                pool.execute(
                    `INSERT INTO error_events (user_id, session_id, severity, message, created_at)
                     VALUES ${placeholders}`,
                    flat
                )
            );
        }

        await Promise.all(promises);

        const total = (design?.length || 0) + (resource?.length || 0) + (errors?.length || 0);
        res.json({ ok: true, inserted: total });
    } catch (err) {
        console.error('[events]', err.message);
        res.status(500).json({ error: 'Internal error' });
    }
});

export default router;
