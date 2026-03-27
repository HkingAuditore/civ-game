const mysql = require("mysql2/promise");

(async () => {
  const conn = await mysql.createConnection({
    host: "gz-cdb-bwmozb7l.sql.tencentcdb.com",
    port: 63818,
    user: "civ_analytics",
    password: "59951308",
    database: "civ_analytics"
  });

  // 1. Check Economy events
  const [r1] = await conn.execute(
    "SELECT SUBSTRING_INDEX(event_id, ':', 2) AS econ_type, COUNT(*) AS cnt FROM design_events WHERE event_id LIKE 'Economy:%' GROUP BY econ_type ORDER BY cnt DESC"
  );
  console.log("=== Economy events by type ===");
  console.log(JSON.stringify(r1, null, 2));

  // 2. Sample Economy:GDP values
  const [r2] = await conn.execute(
    "SELECT user_id, event_value, epoch, days_elapsed, created_at FROM design_events WHERE event_id = 'Economy:GDP' ORDER BY created_at DESC LIMIT 10"
  );
  console.log("\n=== GDP samples ===");
  console.log(JSON.stringify(r2, null, 2));

  // 3. Check resource_events for price-related data
  const [r3] = await conn.execute(
    "SELECT flow_type, currency, item_type, item_id, COUNT(*) AS cnt FROM resource_events GROUP BY flow_type, currency, item_type, item_id ORDER BY cnt DESC LIMIT 20"
  );
  console.log("\n=== Resource events breakdown ===");
  console.log(JSON.stringify(r3, null, 2));

  // 4. All distinct event_id prefixes
  const [r4] = await conn.execute(
    "SELECT SUBSTRING_INDEX(event_id, ':', 1) AS category, COUNT(*) AS cnt FROM design_events GROUP BY category ORDER BY cnt DESC"
  );
  console.log("\n=== All event categories ===");
  console.log(JSON.stringify(r4, null, 2));

  await conn.end();
})();
