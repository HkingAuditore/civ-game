# 实施计划

- [ ] 1. 修改 `buildings.js` 中四个建筑的 owner 和基础 jobs
   - 将 `copper_mine` 的 `owner` 改为 `artisan`，`jobs` 改为 `{ miner: 4, worker: 1, artisan: 1 }`
   - 将 `stone_workshop` 的 `owner` 改为 `artisan`，`jobs` 改为 `{ miner: 4, worker: 4, artisan: 1 }`
   - 将 `shaft_mine` 的 `owner` 改为 `merchant`，`jobs` 改为 `{ miner: 6, engineer: 12, merchant: 1 }`
   - 将 `hardwood_camp` 的 `owner` 改为 `merchant`，`jobs` 改为 `{ lumberjack: 5, worker: 5, merchant: 1 }`
   - _需求：1.1、1.2、2.1、2.2、3.1、3.2、4.1、4.2_

- [ ] 2. 修改 `buildingUpgrades.js` 中四个建筑各升级等级的 jobs
   - 将 `copper_mine` 1级（深铜矿）`jobs` 改为 `{ miner: 4, worker: 1, artisan: 1 }`
   - 将 `copper_mine` 2级（大铜矿）`jobs` 改为 `{ miner: 5, worker: 1, artisan: 1 }`
   - 将 `stone_workshop` 1级（大采石工场）`jobs` 改为 `{ miner: 4, worker: 4, artisan: 1 }`
   - 将 `stone_workshop` 2级（皇家采石场）`jobs` 改为 `{ miner: 5, worker: 5, artisan: 1 }`
   - 将 `shaft_mine` 1级（通风矿井）`jobs` 改为 `{ miner: 6, engineer: 12, merchant: 1 }`
   - 将 `shaft_mine` 2级（蒸汽矿井）`jobs` 改为 `{ miner: 7, engineer: 13, merchant: 1 }`
   - 将 `hardwood_camp` 1级（特用林场）`jobs` 改为 `{ lumberjack: 5, worker: 5, merchant: 1 }`
   - 将 `hardwood_camp` 2级（皇家御林）`jobs` 改为 `{ lumberjack: 6, worker: 6, merchant: 1 }`
   - _需求：1.3、1.4、2.3、2.4、3.3、3.4、4.3、4.4、5.5_
