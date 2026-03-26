import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import cors from 'cors';
import { testConnection } from './db.js';
import eventsRouter from './routes/events.js';

const app = express();
const PORT = Number(process.env.PORT) || 3100;

// ── Middleware ──

app.use(helmet());
app.use(compression());

const allowedOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

app.use(cors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : '*',
    methods: ['POST', 'GET'],
    allowedHeaders: ['Content-Type', 'X-API-Key'],
}));

app.use(express.json({ limit: '512kb' }));

// ── API Key 验证 ──

const API_KEY = process.env.API_KEY;

app.use('/api', (req, res, next) => {
    if (req.path === '/health') return next();
    if (!API_KEY) return next();
    const clientKey = req.headers['x-api-key'];
    if (clientKey !== API_KEY) {
        return res.status(401).json({ error: 'Invalid API key' });
    }
    next();
});

// ── Routes ──

app.use('/api', eventsRouter);

app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
});

// ── Start ──

async function start() {
    try {
        await testConnection();
        console.log('[DB] MySQL connected');
    } catch (err) {
        console.error('[DB] MySQL connection failed:', err.message);
        console.error('[DB] Server will start but DB writes will fail until MySQL is available.');
    }

    app.listen(PORT, () => {
        console.log(`[Server] Analytics API listening on http://localhost:${PORT}`);
    });
}

start();
