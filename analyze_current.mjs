import { BUILDINGS } from './src/config/buildings.js';
import { BUILDING_UPGRADES, getBuildingEffectiveConfig } from './src/config/buildingUpgrades.js';

// Analyze base buildings: owner jobs ratio
console.log("=== BASE BUILDINGS (Lv0) - Owner/Employee Ratios ===\n");
console.log("ID | Epoch | Owner | OwnerJobs | EmpJobs | Total | OwnerPct | Emp:Owner | Category");

const rows = [];
BUILDINGS.forEach(b => {
    if (!b.jobs || !b.owner) return;
    const ownerRole = b.owner;
    const totalJobs = Object.values(b.jobs).reduce((s,v) => s+v, 0);
    const ownerJobs = b.jobs[ownerRole] || 0;
    const employeeJobs = totalJobs - ownerJobs;
    rows.push({
        id: b.id, epoch: b.epoch, owner: ownerRole, cat: b.cat,
        ownerJobs, employeeJobs, totalJobs,
        ownerPct: ((ownerJobs/totalJobs)*100).toFixed(1),
        empToOwner: ownerJobs > 0 ? (employeeJobs / ownerJobs).toFixed(1) : 'INF'
    });
});

rows.sort((a,b) => a.epoch - b.epoch || a.id.localeCompare(b.id));
rows.forEach(r => {
    const flag = r.ownerJobs === 0 ? ' ❌ ZERO OWNER' : '';
    console.log(`${r.id} | E${r.epoch} | ${r.owner} | ${r.ownerJobs} | ${r.employeeJobs} | ${r.totalJobs} | ${r.ownerPct}% | ${r.empToOwner}:1 | ${r.cat}${flag}`);
});

// Identify zero-owner buildings (non-housing, non-military)
console.log("\n\n=== ZERO OWNER JOBS BUILDINGS (non-housing, non-military) ===\n");
rows.filter(r => r.ownerJobs === 0 && !['hut','house','manor_house','townhouse','civic_apartment','granary','apartment_block','high_rise_apartment'].includes(r.id) && r.cat !== 'military')
    .forEach(r => {
        console.log(`${r.id} | E${r.epoch} | owner:${r.owner} | jobs:${JSON.stringify(BUILDINGS.find(b=>b.id===r.id).jobs)} | cat:${r.cat}`);
    });

// Analyze upgrade levels too for zero-owner
console.log("\n\n=== UPGRADE LEVELS WITH ZERO OWNER JOBS ===\n");
BUILDINGS.forEach(b => {
    if (!b.owner) return;
    const maxLevel = BUILDING_UPGRADES[b.id] ? BUILDING_UPGRADES[b.id].length : 0;
    for (let level = 1; level <= maxLevel; level++) {
        const config = getBuildingEffectiveConfig(b, level);
        const ownerRole = b.owner;
        const jobs = config.jobs || {};
        const ownerJobs = jobs[ownerRole] || 0;
        if (ownerJobs === 0) {
            console.log(`${b.id} Lv${level} | owner:${ownerRole} | jobs:${JSON.stringify(jobs)}`);
        }
    }
});

// Summary by epoch: average owner percentage
console.log("\n\n=== AVERAGE OWNER PERCENTAGE BY EPOCH ===\n");
const byEpoch = {};
rows.forEach(r => {
    if (!byEpoch[r.epoch]) byEpoch[r.epoch] = { count: 0, totalOwnerPct: 0, buildings: [] };
    byEpoch[r.epoch].count++;
    byEpoch[r.epoch].totalOwnerPct += parseFloat(r.ownerPct);
    byEpoch[r.epoch].buildings.push(r.id);
});
Object.entries(byEpoch).sort((a,b) => a[0]-b[0]).forEach(([epoch, data]) => {
    console.log(`Epoch ${epoch}: avg owner pct = ${(data.totalOwnerPct / data.count).toFixed(1)}% (${data.count} buildings)`);
});
