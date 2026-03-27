import { Router } from 'express';
import { getPool } from '../db.js';

const router = Router();
let designEventColumnSupport = null;

async function getDesignEventColumnSupport(pool) {
    if (designEventColumnSupport) return designEventColumnSupport;
    try {
        const [rows] = await pool.query(
            `SELECT column_name
             FROM information_schema.columns
             WHERE table_schema = DATABASE()
               AND table_name = 'design_events'
               AND column_name IN ('player_nation_id', 'player_nation_name')`
        );
        const columns = new Set((rows || []).map(row => row.column_name || row.COLUMN_NAME));
        designEventColumnSupport = {
            playerNationId: columns.has('player_nation_id'),
            playerNationName: columns.has('player_nation_name'),
        };
        return designEventColumnSupport;
    } catch (err) {
        console.warn('[events] detect design_events columns failed, fallback to base columns:', err.message);
        designEventColumnSupport = {
            playerNationId: false,
            playerNationName: false,
        };
        return designEventColumnSupport;
    }
}

function getRequestBody(req) {
    if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
        return req.body;
    }

    if (typeof req.body === 'string' && req.body.trim()) {
        try {
            return JSON.parse(req.body);
        } catch {
            return {};
        }
    }

    return {};
}

// ── POST /api/session/start ──

router.post('/session/start', async (req, res) => {
    try {
        const { userId, sessionId, appVersion, difficulty, scenario, userAgent } = getRequestBody(req);
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
        const { sessionId, durationMs } = getRequestBody(req);
        if (!sessionId) {
            return res.status(400).json({ error: 'sessionId required' });
        }
        const pool = getPool();
        const normalizedDurationMs = Number.isFinite(Number(durationMs)) ? Number(durationMs) : null;
        await pool.execute(
            `UPDATE sessions SET ended_at = NOW(), duration_ms = ? WHERE session_id = ?`,
            [normalizedDurationMs, sessionId]
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
        const { sessionId } = getRequestBody(req);
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
        const { design, resource, errors } = getRequestBody(req);
        const pool = getPool();
        const promises = [];

        // Design events
        if (Array.isArray(design) && design.length > 0) {
            const columnSupport = await getDesignEventColumnSupport(pool);
            const insertColumns = [
                'user_id',
                'session_id',
                'event_id',
                'event_value',
                'epoch',
                'days_elapsed',
            ];
            if (columnSupport.playerNationId) insertColumns.push('player_nation_id');
            if (columnSupport.playerNationName) insertColumns.push('player_nation_name');
            insertColumns.push('created_at');

            const values = design.map(e => {
                const row = [
                    e.userId,
                    e.sessionId,
                    e.eventId,
                    e.value ?? null,
                    e.epoch || null,
                    e.daysElapsed ?? null,
                ];
                if (columnSupport.playerNationId) row.push(e.playerNationId || null);
                if (columnSupport.playerNationName) row.push(e.playerNationName || null);
                row.push(e.timestamp ? new Date(e.timestamp) : new Date());
                return row;
            });
            const valuePlaceholder = `(${insertColumns.map(() => '?').join(', ')})`;
            const placeholders = values.map(() => valuePlaceholder).join(', ');
            const flat = values.flat();
            promises.push(
                pool.execute(
                    `INSERT INTO design_events (${insertColumns.join(', ')})
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
