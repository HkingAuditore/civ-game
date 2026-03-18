# 实施计划：阶层角色分离（业主/雇员互斥）

> 修改范围：`src/config/buildings.js`（主建筑配置）、`src/config/buildingUpgrades.js`（建筑升级配置）
> 无需修改逻辑层或 UI 层——现有系统通过配置驱动，配置变更自动生效。

---

- [ ] 1. 将 worker 自营建筑的 owner 和 jobs 改为 artisan（buildings.js）
   - 修改 6 个建筑：reed_works、brewery、loom_house、dye_works、sawmill、brickworks
   - 每个建筑：`owner: 'worker'` → `owner: 'artisan'`，`jobs` 中 `worker: N` → `artisan: N`
   - 修改后这些建筑均为 artisan 自营（jobs 只有 artisan 一种角色）
   - _需求：1.1、1.2、1.3_

- [ ] 2. 同步修改 worker→artisan 对应的升级配置（buildingUpgrades.js）
   - 修改升级配置中的注释和 jobs：reed_works(L264-278)、brewery(L300-314)、loom_house(L75-89)、dye_works(L188-202)、sawmill(L206-220)、brickworks(L93-107)
   - 每个升级等级的 `jobs` 中 `worker: N` → `artisan: N`，注释中 `owner: worker` → `owner: artisan`
   - _需求：1.2、8.1_

- [ ] 3. 清除 peasant 作为雇员的出现（buildings.js + buildingUpgrades.js）
   - **buildings.js**：3 个建筑的 jobs 中 `peasant: N` → `worker: N`
     - culinary_kitchen: `peasant: 1` → `worker: 1`
     - mechanized_farm: `peasant: 4` → `worker: 4`
     - rubber_plantation: `peasant: 5` → `worker: 5`
   - **buildingUpgrades.js**：同步修改对应升级的 jobs
     - culinary_kitchen 升级(L289, L296): `peasant` → `worker`
     - mechanized_farm 升级(L885, L892): `peasant` → `worker`
     - rubber_plantation 升级(L1233, L1240): `peasant` → `worker`
   - _需求：4.1、4.2、4.3、8.1_

- [ ] 4. 清除 lumberjack 和 miner 作为雇员的出现（buildings.js + buildingUpgrades.js）
   - **lumberjack**：logging_company 的 jobs 中 `lumberjack: 9` → `worker: 9`
   - **miner**：6 个建筑的 jobs 中 `miner: N` → `worker: N`
     - mine(L278): `miner: 9` → `worker: 9`
     - industrial_mine(L338 或 L1259): `miner: 12/13` → `worker: 12/13`
     - oil_well(L1406): `miner: 3` → `worker: 3`
     - advanced_copper_mine(L1518): `miner: 6` → `worker: 6`
     - iron_smelter(L1576): `miner: 6` → `worker: 6`
   - **同步 buildingUpgrades.js**：对应升级条目的 miner/lumberjack 改为 worker
   - 注意：stone_workshop(L504, owner: miner) 中的 `worker: 1` 需改为 `miner: 1`（使其成为 miner 纯自营），或保持 worker 雇员（此处 miner 是 owner，worker 是雇员，不违反规则）
   - _需求：6.1、6.2、6.3、6.4、8.1_

- [ ] 5. 将 engineer-owned 的 11 个建筑改为 capitalist（buildings.js）
   - 修改 11 个建筑：coal_power_plant、oil_refinery、wiring_factory、machinery_plant、fertilizer_plant、plastics_factory、electronics_factory、pharmaceutical_plant、aluminum_smelter、solar_power_plant、composites_factory
   - 每个建筑：`owner: 'engineer'` → `owner: 'capitalist'`
   - 如果 jobs 中没有 `capitalist` 角色，则添加 `capitalist: 1`；engineer 保留为雇员
   - _需求：2.1、2.2、2.3、2.4_

- [ ] 6. 将 scribe-owned 的 3 个建筑改为 cleric/merchant（buildings.js）
   - library: `owner: 'scribe'` → `owner: 'cleric'`，jobs 中添加 `cleric: 1`（scribe 数量相应调减）
   - university: `owner: 'scribe'` → `owner: 'cleric'`，jobs 中添加 `cleric: 1`（scribe 数量相应调减）
   - navigator_school: `owner: 'scribe'` → `owner: 'merchant'`，jobs 中添加 `merchant: 1`（scribe 保留为雇员）
   - _需求：3.1、3.2、3.3、3.4_

- [ ] 7. 将 official-owned 的 2 个建筑改为 capitalist（buildings.js）
   - research_institute: `owner: 'official'` → `owner: 'capitalist'`，jobs 中添加 `capitalist: 1`
   - biotech_center: `owner: 'official'` → `owner: 'capitalist'`，jobs 中添加 `capitalist: 1`
   - _需求：5.1、5.2、5.3_

- [ ] 8. 清除 artisan 作为雇员的出现（buildings.js + buildingUpgrades.js）
   - 在所有非 artisan-owned 建筑的 jobs 中，将 `artisan: N` → `worker: N`
   - 涉及 buildings.js 中约 12 个建筑（printing_house、textile_mill、lumber_mill、distillery、opera_house、cannery、garment_factory、furniture_factory、wiring_factory、machinery_plant 等）
   - 同步修改 buildingUpgrades.js 中对应升级条目（约 20 个 jobs 条目）
   - _需求：7.2、7.5、8.1_

- [ ] 9. 清除 merchant 作为雇员的出现（buildings.js + buildingUpgrades.js）
   - 在所有非 merchant-owned 建筑的 jobs 中，将 `merchant` 替换：
     - opera_house: `merchant: 1` → `scribe: 1`（文化/艺术场景适合 scribe）
     - rail_depot: `merchant: 3` → `scribe: 3`（铁路枢纽行政管理）
     - stock_exchange: `merchant: 10` → `scribe: 10`（金融文书）
     - internet_platform: `merchant: 2` → `scribe: 2`（技术平台管理）
     - financial_center: `merchant: 4` → `scribe: 4`（金融文书）
   - 同步修改 buildingUpgrades.js 中对应升级条目
   - _需求：7.1、7.3、7.4、8.1_

- [ ] 10. 同步修改 scribe/engineer/official 相关的升级配置（buildingUpgrades.js）
   - library 升级(L148-164): 注释和 jobs 同步，添加 cleric 岗位
   - 其他 scribe/engineer/official owner 变更对应的升级条目同步修改
   - 确保升级后的 jobs 不引入违反角色分离规则的角色
   - _需求：8.1、8.2_

- [ ] 11. 全量一致性校验与构建验证
   - 用 grep 搜索验证：buildings.js 中不再存在 `owner: 'worker'`、`owner: 'engineer'`、`owner: 'scribe'`、`owner: 'official'`
   - 用 grep 搜索验证：非自营建筑的 jobs 中不再出现 peasant、lumberjack、miner（排除它们作为 owner 的建筑）
   - 用 grep 搜索验证：非 artisan-owned 建筑的 jobs 中不再出现 artisan，非 merchant-owned 建筑的 jobs 中不再出现 merchant
   - 运行 `npm run build` 验证项目无构建错误
   - _需求：9.1、9.2、9.3_
