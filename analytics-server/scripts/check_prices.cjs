const mysql = require("mysql2/promise");

(async () => {
  const conn = await mysql.createConnection({
    host: "gz-cdb-bwmozb7l.sql.tencentcdb.com",
    port: 63818,
    user: "civ_analytics",
    password: "59951308",
    database: "civ_analytics"
  });

  // 1. Price events overview
  const [r1] = await conn.execute(
    "SELECT COUNT(*) AS cnt, MIN(created_at) AS earliest, MAX(created_at) AS latest FROM design_events WHERE event_id LIKE ?",
    ["Price:%"]
  );
  console.log("=== Price events overview ===");
  console.log(JSON.stringify(r1, null, 2));

  // 2. By resource type
  const [r2] = await conn.execute(
    "SELECT SUBSTRING_INDEX(event_id, ':', -1) AS resource, COUNT(*) AS cnt FROM design_events WHERE event_id LIKE ? GROUP BY resource ORDER BY cnt DESC LIMIT 20",
    ["Price:%"]
  );
  console.log("\n=== By resource ===");
  console.log(JSON.stringify(r2, null, 2));

  // 3. Distinct users with price data
  const [r3] = await conn.execute(
    "SELECT COUNT(DISTINCT user_id) AS player_count FROM design_events WHERE event_id LIKE ?",
    ["Price:%"]
  );
  console.log("\n=== Players with price data ===");
  console.log(JSON.stringify(r3, null, 2));

  // 4. Sample: latest prices for top 5 players
  const [r4] = await conn.execute(`
    SELECT user_id, event_id, event_value, created_at
    FROM design_events
    WHERE event_id LIKE 'Price:%'
    ORDER BY created_at DESC
    LIMIT 15
  `);
  console.log("\n=== Latest price samples ===");
  console.log(JSON.stringify(r4, null, 2));

  // 5. Per-player avg price for top resources
  const [r5] = await conn.execute(`
    SELECT 
      user_id,
      SUBSTRING_INDEX(event_id, ':', -1) AS resource,
      COUNT(*) AS sample_count,
      ROUND(AVG(event_value), 2) AS avg_price,
      ROUND(MIN(event_value), 2) AS min_price,
      ROUND(MAX(event_value), 2) AS max_price
    FROM design_events
    WHERE event_id LIKE 'Price:%'
    GROUP BY user_id, resource
    HAVING sample_count >= 3
    ORDER BY sample_count DESC
    LIMIT 30
  `);
  console.log("\n=== Per-player price stats (samples >= 3) ===");
  console.log(JSON.stringify(r5, null, 2));

  await conn.end();
})();
