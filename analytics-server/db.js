import mysql from 'mysql2/promise';

let pool = null;

export function getPool() {
    if (!pool) {
        pool = mysql.createPool({
            host: process.env.DB_HOST || '127.0.0.1',
            port: Number(process.env.DB_PORT) || 3306,
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'civ_analytics',
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0,
            charset: 'utf8mb4',
        });
    }
    return pool;
}

export async function testConnection() {
    const p = getPool();
    const conn = await p.getConnection();
    await conn.ping();
    conn.release();
}
