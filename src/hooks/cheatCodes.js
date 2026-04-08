// Cheat Codes System for Civilization Game
// Usage: Open browser console and type window.cheat.help() to see all available commands

import { EPOCHS, STRATA, RESOURCES, TECHS } from '../config';
import { EVENTS, BASE_EVENTS, CLASS_CONFLICT_EVENTS, EPOCH_EVENTS, ECONOMIC_EVENTS, STATIC_DIPLOMATIC_EVENTS } from '../config/events';
import { IDEOLOGIES } from '../config/ideologies';
import { discoverNationsOnEpochChange } from '../logic/diplomacy/nationDiscovery';

const EPOCH_ALIASES = {
    stone: 0,
    ancient: 0,
    bronze: 1,
    classical: 2,
    antique: 2,
    medieval: 3,
    feudal: 3,
    renaissance: 4,
    exploration: 4,
    enlightenment: 5,
    industrial: 6,
    modern: 7,
};

const resolveEpochIndex = (value) => {
    if (typeof value === 'number' && Number.isFinite(value)) {
        const idx = Math.floor(value);
        return idx >= 0 && idx < EPOCHS.length ? idx : null;
    }
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (!normalized) return null;
        if (!Number.isNaN(Number(normalized))) {
            const idx = Math.floor(Number(normalized));
            if (idx >= 0 && idx < EPOCHS.length) return idx;
        }
        if (EPOCH_ALIASES.hasOwnProperty(normalized)) {
            return EPOCH_ALIASES[normalized];
        }
        const exactMatch = EPOCHS.findIndex((epoch) => epoch.name === value);
        if (exactMatch !== -1) return exactMatch;
    }
    return null;
};

const getNumericEpoch = (epochValue = 0) => {
    if (typeof epochValue === 'number') return epochValue;
    const resolved = resolveEpochIndex(epochValue);
    return resolved ?? 0;
};

const clamp = (value, min, max) => {
    const num = Number(value);
    if (!Number.isFinite(num)) return min;
    return Math.min(max, Math.max(min, num));
};

const normalizeStratumKey = (key) => {
    if (!key) return null;
    const normalized = String(key).trim().toLowerCase();
    if (!normalized) return null;
    const allKeys = Object.keys(STRATA || {});
    const directMatch = allKeys.find(k => k.toLowerCase() === normalized);
    if (directMatch) return directMatch;
    const partial = allKeys.find(k => STRATA[k]?.name && STRATA[k].name.toLowerCase().includes(normalized));
    return partial || normalized;
};

const normalizeResourceKey = (key) => {
    if (!key) return null;
    const normalized = String(key).trim().toLowerCase();
    if (!normalized) return null;
    const allKeys = Object.keys(RESOURCES || {});
    const directMatch = allKeys.find(k => k.toLowerCase() === normalized);
    if (directMatch) return directMatch;
    const partial = allKeys.find(k => RESOURCES[k]?.name && RESOURCES[k].name.toLowerCase().includes(normalized));
    return partial || normalized;
};

const findNationByIdOrName = (identifier, nations = []) => {
    if (!identifier) return null;
    const idStr = String(identifier).trim();
    if (!idStr) return null;
    const lower = idStr.toLowerCase();

    let found = nations.find(n => n.id === idStr);
    if (found) return found;

    found = nations.find(n => (n.name || '').toLowerCase() === lower);
    if (found) return found;

    return nations.find(n => (n.name || '').toLowerCase().includes(lower)) || null;
};

/**
 * Initialize cheat codes system
 * @param {Object} gameState - The game state object
 * @param {Function} addLog - Function to add log messages
 */
export const initCheatCodes = (gameState, addLog, setters = {}) => {
    const { setMerchantState } = setters;

    // Create cheat object on window
    window.cheat = {
        /**
         * Display help information
         */
        help: () => {
            console.log('%c🎮 Cheat Codes Available:', 'color: #00ff00; font-size: 16px; font-weight: bold;');
            console.log('%cResources:', 'color: #ffff00; font-weight: bold;');
            console.log('  cheat.addSilver(amount)     - Add silver coins');
            console.log('  cheat.addFood(amount)       - Add food');
            console.log('  cheat.addWood(amount)       - Add wood');
            console.log('  cheat.addStone(amount)      - Add stone');
            console.log('  cheat.addIron(amount)       - Add iron');
            console.log('  cheat.addBrick(amount)      - Add brick');
            console.log('  cheat.addTool(amount)       - Add tools');
            console.log('  cheat.addCloth(amount)      - Add cloth');
            console.log('  cheat.addBeer(amount)       - Add beer');
            console.log('  cheat.addFurniture(amount)  - Add furniture');
            console.log('  cheat.addAll(amount)        - Add all resources');
            console.log('');
            console.log('%cPopulation:', 'color: #ffff00; font-weight: bold;');
            console.log('  cheat.addPopulation(amount) - Add population');
            console.log('  cheat.setPopulation(amount) - Set population to specific value');
            console.log('');
            console.log('%cTechnology:', 'color: #ffff00; font-weight: bold;');
            console.log('  cheat.unlockAllTech()       - Unlock all technologies');
            console.log('  cheat.unlockTech(techId)    - Unlock specific technology');
            console.log('');
            console.log('%cMilitary:', 'color: #ffff00; font-weight: bold;');
            console.log('  cheat.addArmy(unitType, amount) - Add military units');
            console.log('  cheat.superArmy()           - Create a super army');
            console.log('  cheat.invincibleArmy()      - Max army power & weaken enemies');
            console.log('');
            console.log('%cEconomy:', 'color: #ffff00; font-weight: bold;');
            console.log('  cheat.maxStability()        - Set stability to 100');
            console.log('  cheat.maxApproval()         - Set all class approval to 100');
            console.log('  cheat.richEmpire()          - Make all classes wealthy');
            console.log('');
            console.log('%cEpoch:', 'color: #ffff00; font-weight: bold;');
            console.log('  cheat.nextEpoch()                - Advance to next epoch');
            console.log('  cheat.setEpoch(idOrName)         - Set epoch by index (0-6) or alias (stone/bronze/classical/medieval/renaissance/enlightenment/industrial/modern)');
            console.log('');
            console.log('%cTime:', 'color: #ffff00; font-weight: bold;');
            console.log('  cheat.skipDays(days)        - Skip forward in time');
            console.log('  cheat.skipYear()            - Skip one year');
            console.log('');
            console.log('%cBuildings:', 'color: #ffff00; font-weight: bold;');
            console.log('  cheat.addBuilding(buildingId, amount) - Add buildings');
            console.log('  cheat.maxBuildings()        - Max out all building types');
            console.log('');
            console.log('%cMarket:', 'color: #ffff00; font-weight: bold;');
            console.log('  cheat.resetPrices()         - Reset all market prices to base');
            console.log('  cheat.crashMarket()         - Set all prices to minimum');
            console.log('  cheat.boomMarket()          - Set all prices to maximum');
            console.log('');
            console.log('%cEvents:', 'color: #ff9900; font-weight: bold;');
            console.log('  cheat.listEvents(category)      - List all events (category: base/class/epoch/economic/diplomatic/all)');
            console.log('  cheat.searchEvent(keyword)      - Search events by name or ID');
            console.log('  cheat.triggerEvent(eventId)     - Trigger a specific event by ID');
            console.log('  cheat.getEventInfo(eventId)     - Get detailed info of an event');
            console.log('  cheat.clearEvent()              - Clear/dismiss current event');
            console.log('');
            console.log('%cGod Mode:', 'color: #ff00ff; font-weight: bold;');
            console.log('  cheat.godMode()             - Enable everything!');
            console.log('');
            console.log('%cUtility:', 'color: #00ffff; font-weight: bold;');
            console.log('  cheat.getState()            - View current game state');
            console.log('  cheat.cleanMerchants()      - 🧹 Clean invalid merchant assignments & trades');
            console.log('');
            console.log('%cGame Control:', 'color: #00ffff; font-weight: bold;');
            console.log('  cheat.pause()               - Pause the game loop');
            console.log('  cheat.resume()              - Resume the game loop');
            console.log('  cheat.setSpeed(multiplier)  - Set game speed (e.g. 1/2/5)');
            console.log('  cheat.toggleAutoSave(on)    - Enable/disable auto save');
            console.log('  cheat.setAutoSave(sec)      - Set auto save interval in seconds');
            console.log('  cheat.save(type)            - Save game (\"manual\" or \"auto\")');
            console.log('  cheat.load(type)            - Load game (\"manual\" or \"auto\")');
            console.log('  cheat.hardReset()           - Reset game & clear saves');
            console.log('');
            console.log('%cSociety & Stability:', 'color: #00ffff; font-weight: bold;');
            console.log('  cheat.setStability(value)   - Set stability (0-100)');
            console.log('  cheat.setApproval(stratum, value)    - Set one class approval');
            console.log('  cheat.setAllApproval(value)          - Set all class approvals');
            console.log('  cheat.setClassWealth(stratum, value) - Set one class wealth');
            console.log('  cheat.setAllClassWealth(value)       - Set all class wealth');
            console.log('  cheat.setStratumPop(stratum, amount) - Set population of a stratum');
            console.log('');
            console.log('%cDiplomacy & Tax:', 'color: #00ffff; font-weight: bold;');
            console.log('  cheat.setRelation(nation, value)     - Set relation with a nation');
            console.log('  cheat.makePeaceAll()        - End all wars & reset warscore');
            console.log('  cheat.declareWar(nation)    - Instantly declare war');
            console.log('  cheat.makeVassal(nation, type)       - Make nation a vassal (type: protectorate/tributary/puppet/colony)');
            console.log('  cheat.releaseVassal(nation)          - Release a vassal nation');
            console.log('  cheat.listVassals()                  - List all your vassal nations');
            console.log('  cheat.setHeadTax(stratum, rate)      - Set head tax for a class');
            console.log('  cheat.setAllHeadTax(rate)            - Set head tax for all classes');
            console.log('  cheat.setResourceTax(res, rate)      - Set trade tax for a resource');
            console.log('  cheat.setAllResourceTax(rate)        - Set trade tax for all tradable res');
            console.log('');
            console.log('%cOfficials:', 'color: #ff00ff; font-weight: bold;');
            console.log('  cheat.refreshOfficials()             - 刷新候选人列表');
            console.log('  cheat.addOfficialSlot(amount)        - 增加官员编制');
            console.log('  cheat.resetOfficialCooldown()        - 重置选拔冷却');
            console.log('  cheat.fireAllOfficials()             - 解雇所有官员');
            console.log('  cheat.clearCandidates()              - 清空候选人列表');
            console.log('  cheat.superOfficials()               - 生成5个超级官员');
            console.log('');
            console.log('%cIdeology:', 'color: #a855f7; font-weight: bold;');
            console.log('  cheat.addIdeologyScore(amount)       - 增加理念分数（默认500）');
            console.log('  cheat.triggerEmergence()             - 触发理念涌现（三选一）');
            console.log('  cheat.unlockAllIdeology()            - 解锁所有理念（满级）');
            console.log('  cheat.addIdeologySlot(amount)        - 增加理念卡槽');
            console.log('  cheat.clearIdeologyCooldowns()       - 清除所有理念冷却');
            console.log('  cheat.resetIdeology()                - 重置理念系统');
            console.log('  cheat.ideologyStatus()               - 查看理念状态');
            console.log('');
            console.log('  cheat.help()                - Show this help');
            console.log('');
            console.log('%c💡 Quick Fix:', 'color: #ff6600; font-size: 14px; font-weight: bold;');
            console.log('%c  If you see trades with destroyed nations, run: cheat.cleanMerchants()', 'color: #ff9900;');
        },

        // ========== Officials Cheat Commands ==========

        /**
         * 刷新候选人列表
         */
        refreshOfficials: () => {
            // Import dynamically to avoid circular dependency
            import('../config/officials').then(({ triggerSelection }) => {
                if (!gameState.setOfficialCandidates) {
                    console.log('❌ Officials system is not available');
                    return;
                }
                const epoch = getNumericEpoch(gameState.epoch);
                const popStructure = gameState.popStructure || {};
                const classInfluence = {}; // 可以简化
                const market = gameState.market || null; // 获取市场数据
                const rates = gameState.rates || null;
                const newCandidates = triggerSelection ? triggerSelection(epoch, popStructure, classInfluence, market, rates) : [];
                // 直接使用 generateRandomOfficial
                import('../config/officials').then(({ generateRandomOfficial }) => {
                    const candidates = [];
                    for (let i = 0; i < 5; i++) {
                        candidates.push(generateRandomOfficial(epoch, popStructure, classInfluence, market, rates));
                    }
                    gameState.setOfficialCandidates(candidates);
                    addLog(`👔 作弊码：刷新了 5 名新候选人`);
                    console.log('✅ Refreshed 5 new candidates');
                });
            });
        },

        /**
         * 增加官员编制
         */
        addOfficialSlot: (amount = 3) => {
            if (!gameState.setOfficialCapacity) {
                console.log('❌ Officials system is not available');
                return;
            }
            gameState.setOfficialCapacity(prev => (prev || 0) + amount);
            addLog(`👔 作弊码：官员编制增加 ${amount}`);
            console.log(`✅ Added ${amount} official slots`);
        },

        /**
         * 重置选拔冷却
         */
        resetOfficialCooldown: () => {
            if (!gameState.setLastOfficialSelectionDay) {
                console.log('❌ Officials system is not available');
                return;
            }
            gameState.setLastOfficialSelectionDay(0);
            addLog(`👔 作弊码：选拔冷却已重置`);
            console.log('✅ Official selection cooldown reset');
        },

        /**
         * 解雇所有官员
         */
        fireAllOfficials: () => {
            if (!gameState.setOfficials) {
                console.log('❌ Officials system is not available');
                return;
            }
            const count = gameState.officials?.length || 0;
            gameState.setOfficials([]);
            addLog(`👔 作弊码：解雇了 ${count} 名官员`);
            console.log(`✅ Fired all ${count} officials`);
        },

        /**
         * 清空候选人列表
         */
        clearCandidates: () => {
            if (!gameState.setOfficialCandidates) {
                console.log('❌ Officials system is not available');
                return;
            }
            gameState.setOfficialCandidates([]);
            addLog(`👔 作弊码：清空候选人列表`);
            console.log('✅ Cleared all candidates');
        },

        /**
         * 生成超级官员
         */
        superOfficials: () => {
            if (!gameState.setOfficials) {
                console.log('❌ Officials system is not available');
                return;
            }
            // 创建强力官员
            const superOfficialTemplates = [
                {
                    name: '诸葛亮',
                    sourceStratum: 'scribe',
                    effects: {
                        researchSpeed: 0.30,
                        stability: 0.15,
                        taxEfficiency: 0.20,
                    },
                    salary: 50,
                    stratumInfluenceBonus: 0.25,
                },
                {
                    name: '范蠡',
                    sourceStratum: 'merchant',
                    effects: {
                        tradeBonus: 0.35,
                        taxIncome: 0.25,
                        buildingCostMod: -0.20,
                    },
                    salary: 45,
                    stratumInfluenceBonus: 0.20,
                },
                {
                    name: '关羽',
                    sourceStratum: 'soldier',
                    effects: {
                        militaryBonus: 0.30,
                        wartimeProduction: 0.25,
                        militaryUpkeep: -0.20,
                    },
                    salary: 40,
                    stratumInfluenceBonus: 0.20,
                },
                {
                    name: '包拯',
                    sourceStratum: 'cleric',
                    effects: {
                        corruption: -0.25,
                        stability: 0.20,
                        approval: { peasant: 15, worker: 15 },
                    },
                    salary: 35,
                    stratumInfluenceBonus: 0.15,
                },
                {
                    name: '郑和',
                    sourceStratum: 'navigator',
                    effects: {
                        diplomaticBonus: 2.0,
                        tradeBonus: 0.20,
                        diplomaticCooldown: -0.25,
                    },
                    salary: 40,
                    stratumInfluenceBonus: 0.20,
                },
            ];

            const newOfficials = superOfficialTemplates.map((template, index) => ({
                id: `super_off_${Date.now()}_${index}`,
                ...template,
                hireDate: gameState.daysElapsed || 0,
                influence: 2 + (template.salary / 50),
            }));

            gameState.setOfficials(prev => [...(prev || []), ...newOfficials]);
            // 确保编制足够
            gameState.setOfficialCapacity(prev => Math.max((prev || 0), (gameState.officials?.length || 0) + 5));
            addLog(`👔 作弊码：招募了 5 名超级官员！`);
            console.log('✅ Created 5 super officials: 诸葛亮, 范蠡, 关羽, 包拯, 郑和');
        },

        /**
         * Add silver coins
         */
        addSilver: (amount = 10000) => {
            gameState.setResources(prev => ({
                ...prev,
                silver: (prev.silver || 0) + amount
            }), { reason: 'cheat_code', meta: { code: 'addSilver', amount } });
            addLog(`💰 作弊码：获得 ${amount} 银币`);
            console.log(`✅ Added ${amount} silver`);
        },

        /**
         * Add food
         */
        addFood: (amount = 1000) => {
            gameState.setResources(prev => ({
                ...prev,
                food: (prev.food || 0) + amount
            }), { reason: 'cheat_code', meta: { code: 'addFood', amount } });
            addLog(`🌾 作弊码：获得 ${amount} 食物`);
            console.log(`✅ Added ${amount} food`);
        },

        /**
         * Add wood
         */
        addWood: (amount = 1000) => {
            gameState.setResources(prev => ({
                ...prev,
                wood: (prev.wood || 0) + amount
            }), { reason: 'cheat_code', meta: { code: 'addWood', amount } });
            addLog(`🪵 作弊码：获得 ${amount} 木材`);
            console.log(`✅ Added ${amount} wood`);
        },

        /**
         * Add stone
         */
        addStone: (amount = 1000) => {
            gameState.setResources(prev => ({
                ...prev,
                stone: (prev.stone || 0) + amount
            }), { reason: 'cheat_code', meta: { code: 'addStone', amount } });
            addLog(`🪨 作弊码：获得 ${amount} 石料`);
            console.log(`✅ Added ${amount} stone`);
        },

        /**
         * Add iron
         */
        addIron: (amount = 1000) => {
            gameState.setResources(prev => ({
                ...prev,
                iron: (prev.iron || 0) + amount
            }), { reason: 'cheat_code', meta: { code: 'addIron', amount } });
            addLog(`⚙️ 作弊码：获得 ${amount} 铁矿`);
            console.log(`✅ Added ${amount} iron`);
        },

        /**
         * Add brick
         */
        addBrick: (amount = 1000) => {
            gameState.setResources(prev => ({
                ...prev,
                brick: (prev.brick || 0) + amount
            }), { reason: 'cheat_code', meta: { code: 'addBrick', amount } });
            addLog(`🧱 作弊码：获得 ${amount} 砖块`);
            console.log(`✅ Added ${amount} brick`);
        },

        /**
         * Add tools
         */
        addTool: (amount = 1000) => {
            gameState.setResources(prev => ({
                ...prev,
                tool: (prev.tool || 0) + amount
            }), { reason: 'cheat_code', meta: { code: 'addTool', amount } });
            addLog(`🔨 作弊码：获得 ${amount} 工具`);
            console.log(`✅ Added ${amount} tools`);
        },

        /**
         * Add cloth
         */
        addCloth: (amount = 1000) => {
            gameState.setResources(prev => ({
                ...prev,
                cloth: (prev.cloth || 0) + amount
            }), { reason: 'cheat_code', meta: { code: 'addCloth', amount } });
            addLog(`🧵 作弊码：获得 ${amount} 布匹`);
            console.log(`✅ Added ${amount} cloth`);
        },

        /**
         * Add beer
         */
        addBeer: (amount = 1000) => {
            gameState.setResources(prev => ({
                ...prev,
                beer: (prev.beer || 0) + amount
            }), { reason: 'cheat_code', meta: { code: 'addBeer', amount } });
            addLog(`🍺 作弊码：获得 ${amount} 啤酒`);
            console.log(`✅ Added ${amount} beer`);
        },

        /**
         * Add furniture
         */
        addFurniture: (amount = 1000) => {
            gameState.setResources(prev => ({
                ...prev,
                furniture: (prev.furniture || 0) + amount
            }), { reason: 'cheat_code', meta: { code: 'addFurniture', amount } });
            addLog(`🪑 作弊码：获得 ${amount} 家具`);
            console.log(`✅ Added ${amount} furniture`);
        },

        /**
         * Add all resources
         */
        addAll: (amount = 1000) => {
            // Dynamically get all storable resources from RESOURCES config
            const storableResources = Object.keys(RESOURCES).filter(key => {
                const res = RESOURCES[key];
                // Exclude virtual resources (maxPop, militaryCapacity)
                return res.type !== 'virtual';
            });

            gameState.setResources(prev => {
                const newResources = { ...prev };
                storableResources.forEach(key => {
                    // Give silver 10x more
                    const multiplier = key === 'silver' ? 10 : 1;
                    newResources[key] = (prev[key] || 0) + amount * multiplier;
                });
                return newResources;
            }, { reason: 'cheat_code', meta: { code: 'addAll', amount } });
            addLog(`✨ 作弊码：获得所有资源 x${amount}（共 ${storableResources.length} 种）`);
            console.log(`✅ Added ${amount} of all resources (${storableResources.length} types)`);
        },

        /**
         * Add population
         */
        addPopulation: (amount = 1000) => {
            gameState.setPopulation(prev => prev + amount);
            // [FIX] Sync popStructure: new population joins as unemployed
            gameState.setPopStructure(prev => ({
                ...prev,
                unemployed: (prev?.unemployed || 0) + amount,
            }));
            addLog(`👥 作弊码：人口增加 ${amount}`);
            console.log(`✅ Added ${amount} population`);
        },

        /**
         * Set population to specific value
         */
        setPopulation: (amount) => {
            // [FIX] Also sync popStructure to match the new population
            const currentPopStructure = gameState.popStructure || {};
            const currentTotal = Object.values(currentPopStructure).reduce((sum, v) => sum + (v || 0), 0);
            const diff = amount - currentTotal;
            
            gameState.setPopulation(amount);
            
            if (diff > 0) {
                // Adding population: add to unemployed
                gameState.setPopStructure(prev => ({
                    ...(prev || {}),
                    unemployed: ((prev?.unemployed) || 0) + diff,
                }));
            } else if (diff < 0) {
                // Removing population: proportionally reduce from all strata
                gameState.setPopStructure(prev => {
                    const totalPop = Object.values(prev || {}).reduce((sum, v) => sum + (v || 0), 0);
                    if (totalPop <= 0) return prev;
                    const scale = Math.max(0, amount / totalPop);
                    const next = {};
                    Object.keys(prev || {}).forEach(key => {
                        next[key] = Math.max(0, Math.floor((prev[key] || 0) * scale));
                    });
                    return next;
                });
            }
            addLog(`👥 作弊码：人口设置为 ${amount}`);
            console.log(`✅ Set population to ${amount}`);
        },

        /**
         * Unlock all technologies
         */
        unlockAllTech: () => {
            // Dynamically get all tech IDs from TECHS config
            const allTechs = TECHS.map(tech => tech.id);
            gameState.setTechsUnlocked(allTechs);
            addLog(`🔬 作弊码：解锁所有科技（共 ${allTechs.length} 项）`);
            console.log(`✅ Unlocked all technologies (${allTechs.length} techs)`);
        },

        /**
         * Unlock specific technology
         */
        unlockTech: (techId) => {
            gameState.setTechsUnlocked(prev => {
                if (prev.includes(techId)) {
                    console.log(`⚠️ Technology ${techId} already unlocked`);
                    return prev;
                }
                return [...prev, techId];
            });
            addLog(`🔬 作弊码：解锁科技 ${techId}`);
            console.log(`✅ Unlocked technology: ${techId}`);
        },

        /**
         * Add military units
         */
        addArmy: (unitType = 'militia', amount = 100) => {
            gameState.setArmy(prev => ({
                ...prev,
                [unitType]: (prev[unitType] || 0) + amount
            }));
            addLog(`⚔️ 作弊码：招募 ${amount} ${unitType}`);
            console.log(`✅ Added ${amount} ${unitType}`);
        },

        /**
         * Create a super army
         */
        superArmy: () => {
            const units = ['militia', 'archer', 'cavalry', 'knight', 'musketeer', 'rifleman', 'tank', 'aircraft'];
            gameState.setArmy(prev => {
                const newArmy = { ...prev };
                units.forEach(unit => {
                    newArmy[unit] = (newArmy[unit] || 0) + 1000;
                });
                return newArmy;
            });
            addLog(`⚔️ 作弊码：创建超级军队`);
            console.log(`✅ Created super army with 1000 of each unit type`);
        },

        /**
         * Create an almost invincible army and weaken all enemy nations
         */
        invincibleArmy: () => {
            // First, create a huge super army for the player
            window.cheat.superArmy();
            gameState.setArmy(prev => {
                const next = { ...(prev || {}) };
                // Further multiply key late-game units
                ['rifleman', 'tank', 'aircraft'].forEach(unit => {
                    if (!next[unit]) {
                        next[unit] = 5000;
                    } else {
                        next[unit] += 5000;
                    }
                });
                return next;
            });

            // Then, drastically reduce all AI nations' military strength
            if (gameState.setNations && Array.isArray(gameState.nations)) {
                gameState.setNations(prev => prev.map(nation => ({
                    ...nation,
                    militaryStrength: Math.max(0.1, (nation.militaryStrength ?? 1.0) * 0.25),
                })));
            }

            addLog('⚔️ 作弊码：你的军队几乎无敌，敌国军事实力被严重削弱');
            console.log('%c✅ Invincible army activated: massive forces granted and all enemy military strength heavily reduced', 'color: #ff4444; font-weight: bold;');
        },

        /**
         * Set stability to maximum
         */
        maxStability: () => {
            gameState.setStability(100);
            addLog(`🏛️ 作弊码：稳定度设为 100`);
            console.log(`✅ Set stability to 100`);
        },

        /**
         * Set all class approval to maximum
         */
        maxApproval: () => {
            gameState.setClassApproval({
                peasant: 100,
                craftsman: 100,
                merchant: 100,
                noble: 100,
                clergy: 100,
                scholar: 100
            });
            addLog(`😊 作弊码：所有阶层满意度设为 100`);
            console.log(`✅ Set all class approval to 100`);
        },

        /**
         * Make all classes wealthy
         */
        richEmpire: () => {
            gameState.setClassWealth({
                peasant: 10000,
                craftsman: 20000,
                merchant: 50000,
                noble: 100000,
                clergy: 30000,
                scholar: 40000
            }, { reason: 'cheat_code', meta: { code: 'richEmpire' } });
            addLog(`💎 作弊码：所有阶层变得富有`);
            console.log(`✅ Made all classes wealthy`);
        },

        /**
         * Advance to next epoch
         */
        nextEpoch: () => {
            const currentIndex = getNumericEpoch(gameState.epoch);
            if (currentIndex < EPOCHS.length - 1) {
                const nextIdx = currentIndex + 1;
                gameState.setEpoch(nextIdx);
                // Trigger nation discovery on epoch change
                const currentNations = gameState.nations || [];
                const discoveryLogs = [];
                discoverNationsOnEpochChange({
                    nations: currentNations,
                    newEpoch: nextIdx,
                    logs: discoveryLogs,
                    discoverer: 'player',
                });
                gameState.setNations([...currentNations]);
                discoveryLogs.forEach(log => addLog(log));
                const nextName = EPOCHS[nextIdx]?.name || `时代 ${nextIdx}`;
                addLog(`🏛️ 作弊码：进入 ${nextName}`);
                console.log(`✅ Advanced to epoch #${nextIdx} (${nextName})`);
            } else {
                console.log(`⚠️ Already at the final epoch`);
            }
        },

        /**
         * Set specific epoch
         */
        setEpoch: (epochIdentifier) => {
            const targetIndex = resolveEpochIndex(epochIdentifier);
            if (targetIndex === null) {
                console.log(`❌ Invalid epoch "${epochIdentifier}". Use index (0-${EPOCHS.length - 1}) or aliases: ${Object.keys(EPOCH_ALIASES).join(', ')}`);
                return;
            }
            gameState.setEpoch(targetIndex);
            // Trigger nation discovery on epoch change
            const currentNations = gameState.nations || [];
            const discoveryLogs = [];
            discoverNationsOnEpochChange({
                nations: currentNations,
                newEpoch: targetIndex,
                logs: discoveryLogs,
                discoverer: 'player',
            });
            gameState.setNations([...currentNations]);
            discoveryLogs.forEach(log => addLog(log));
            const epochName = EPOCHS[targetIndex]?.name || `时代 ${targetIndex}`;
            addLog(`🏛️ 作弊码：设置时代为 ${epochName}`);
            console.log(`✅ Set epoch to #${targetIndex} (${epochName})`);
        },

        /**
         * Skip days
         */
        skipDays: (days = 30) => {
            gameState.setDaysElapsed(prev => prev + days);
            addLog(`⏰ 作弊码：时间前进 ${days} 天`);
            console.log(`✅ Skipped ${days} days`);
        },

        /**
         * Skip one year
         */
        skipYear: () => {
            gameState.setDaysElapsed(prev => prev + 360);
            addLog(`⏰ 作弊码：时间前进 1 年`);
            console.log(`✅ Skipped 1 year (360 days)`);
        },

        /**
         * Add buildings
         */
        addBuilding: (buildingId, amount = 10) => {
            gameState.setBuildings(prev => ({
                ...prev,
                [buildingId]: (prev[buildingId] || 0) + amount
            }));
            addLog(`🏗️ 作弊码：建造 ${amount} 个 ${buildingId}`);
            console.log(`✅ Added ${amount} ${buildingId}`);
        },

        /**
         * Max out all buildings
         */
        maxBuildings: () => {
            const buildingTypes = [
                'farm', 'lumbermill', 'quarry', 'mine', 'brickyard',
                'toolshop', 'weaver', 'brewery', 'furniture_workshop',
                'house', 'market', 'temple', 'school', 'barracks'
            ];
            gameState.setBuildings(prev => {
                const newBuildings = { ...prev };
                buildingTypes.forEach(building => {
                    newBuildings[building] = 50;
                });
                return newBuildings;
            });
            addLog(`🏗️ 作弊码：所有建筑数量设为 50`);
            console.log(`✅ Set all buildings to 50`);
        },

        /**
         * Reset market prices to base
         */
        resetPrices: () => {
            if (gameState.market && gameState.setMarket) {
                gameState.setMarket(prev => ({
                    ...prev,
                    prices: {
                        food: 1,
                        wood: 2,
                        stone: 3,
                        iron: 5,
                        brick: 4,
                        tool: 8,
                        cloth: 6,
                        beer: 5,
                        furniture: 10
                    }
                }));
                addLog(`💹 作弊码：市场价格重置`);
                console.log(`✅ Reset all market prices to base values`);
            }
        },

        /**
         * Crash market (minimum prices)
         */
        crashMarket: () => {
            if (gameState.market && gameState.setMarket) {
                gameState.setMarket(prev => ({
                    ...prev,
                    prices: {
                        food: 0.1,
                        wood: 0.2,
                        stone: 0.3,
                        iron: 0.5,
                        brick: 0.4,
                        tool: 0.8,
                        cloth: 0.6,
                        beer: 0.5,
                        furniture: 1
                    }
                }));
                addLog(`📉 作弊码：市场崩溃`);
                console.log(`✅ Crashed market - all prices at minimum`);
            }
        },

        /**
         * Boom market (maximum prices)
         */
        boomMarket: () => {
            if (gameState.market && gameState.setMarket) {
                gameState.setMarket(prev => ({
                    ...prev,
                    prices: {
                        food: 10,
                        wood: 20,
                        stone: 30,
                        iron: 50,
                        brick: 40,
                        tool: 80,
                        cloth: 60,
                        beer: 50,
                        furniture: 100
                    }
                }));
                addLog(`📈 作弊码：市场繁荣`);
                console.log(`✅ Market boom - all prices at maximum`);
            }
        },

        /**
         * Get current game state
         */
        getState: () => {
            console.log('%cCurrent Game State:', 'color: #00ffff; font-size: 16px; font-weight: bold;');
            console.log('Resources:', gameState.resources);
            console.log('Population:', gameState.population);
            console.log('Epoch:', gameState.epoch);
            console.log('Technologies:', gameState.techsUnlocked);
            console.log('Buildings:', gameState.buildings);
            console.log('Army:', gameState.army);
            console.log('Stability:', gameState.stability);
            console.log('Class Approval:', gameState.classApproval);
            console.log('Days Elapsed:', gameState.daysElapsed);
            return gameState;
        },

        /**
         * 🧹 Clean invalid merchant assignments
         * Removes all merchants assigned to destroyed/annexed nations
         */
        cleanMerchants: () => {
            if (!setMerchantState) {
                console.error('❌ Merchant cleaning not available - setters not provided');
                return;
            }

            const nations = gameState.nations || [];
            const validNationIds = new Set(
                nations
                    .filter(n => n && !n.isRebelNation && !n.isAnnexed && (n.population || 0) > 0)
                    .map(n => n.id)
            );

            console.log('%c🧹 Cleaning Merchant System...', 'color: #ffff00; font-size: 14px; font-weight: bold;');
            console.log(`Valid nations: ${validNationIds.size}`);

            // Clean merchant assignments
            const currentAssignments = gameState.merchantState?.merchantAssignments || {};
            const validAssignments = {};
            let removedAssignments = 0;
            let freedMerchants = 0;

            Object.entries(currentAssignments).forEach(([nationId, count]) => {
                if (validNationIds.has(nationId)) {
                    validAssignments[nationId] = count;
                } else {
                    removedAssignments++;
                    freedMerchants += count || 0;
                    const nation = nations.find(n => n.id === nationId);
                    console.log(`  ❌ Removed ${count} merchants from: ${nation?.name || nationId} (destroyed)`);
                }
            });

            // Clean pending trades
            const currentPending = gameState.merchantState?.pendingTrades || [];
            const validPending = currentPending.filter(trade => {
                if (!trade.partnerId || validNationIds.has(trade.partnerId)) {
                    return true;
                }
                return false;
            });

            // Apply changes
            setMerchantState(prev => ({
                ...prev,
                merchantAssignments: validAssignments,
                pendingTrades: validPending
            }));

            // Summary
            console.log('%c✅ Cleanup Complete!', 'color: #00ff00; font-size: 14px; font-weight: bold;');
            console.log(`  📦 Removed ${removedAssignments} invalid assignments`);
            console.log(`  👥 Freed ${freedMerchants} merchants`);
            console.log(`  🚫 Cancelled ${currentPending.length - validPending.length} pending trades`);
            console.log(`  ✓ Valid assignments: ${Object.keys(validAssignments).length}`);
            console.log(`  ✓ Valid pending: ${validPending.length}`);

            if (addLog) {
                addLog(`🧹 商人系统清理完成：释放 ${freedMerchants} 个商人，取消 ${currentPending.length - validPending.length} 笔进行中交易`);
            }

            return {
                removedAssignments,
                freedMerchants,
                cancelledRoutes: currentRoutes.length - validRoutes.length,
                cancelledPending: currentPending.length - validPending.length
            };
        },

        // ========== Game Control Commands ==========

        /**
         * Pause the main game loop
         */
        pause: () => {
            if (gameState.isPaused) {
                console.log('⚠️ Game is already paused');
                return;
            }
            gameState.setIsPaused(true);
            addLog('⏸️ 作弊码：游戏已暂停');
            console.log('✅ Game paused');
        },

        /**
         * Resume the main game loop
         */
        resume: () => {
            if (!gameState.isPaused) {
                console.log('⚠️ Game is already running');
                return;
            }
            gameState.setIsPaused(false);
            addLog('▶️ 作弊码：游戏继续运行');
            console.log('✅ Game resumed');
        },

        /**
         * Set game speed multiplier
         */
        setSpeed: (speed = 1) => {
            const value = clamp(speed, 0.1, 50);
            if (!gameState.setGameSpeed) {
                console.log('❌ Game speed control is not available in this build');
                return;
            }
            gameState.setGameSpeed(value);
            addLog(`⏱️ 作弊码：游戏速度设为 ${value}x`);
            console.log(`✅ Game speed set to ${value}x`);
        },

        /**
         * Enable / disable auto save
         */
        toggleAutoSave: (enabled = true) => {
            const flag = !!enabled;
            if (!gameState.setIsAutoSaveEnabled) {
                console.log('❌ Auto save control is not available');
                return;
            }
            gameState.setIsAutoSaveEnabled(flag);
            addLog(`💾 作弊码：自动存档已${flag ? '开启' : '关闭'}`);
            console.log(`✅ Auto save ${flag ? 'enabled' : 'disabled'}`);
        },

        /**
         * Set auto save interval in seconds
         */
        setAutoSave: (seconds = 60) => {
            const value = Math.max(5, Math.floor(Number(seconds) || 0));
            if (!gameState.setAutoSaveInterval) {
                console.log('❌ Auto save interval control is not available');
                return;
            }
            gameState.setAutoSaveInterval(value);
            addLog(`💾 作弊码：自动存档间隔改为 ${value} 秒`);
            console.log(`✅ Auto save interval set to ${value} seconds`);
        },

        /**
         * Manually trigger a save (manual or auto slot)
         */
        save: (type = 'manual') => {
            const source = type === 'auto' ? 'auto' : 'manual';
            if (!gameState.saveGame) {
                console.log('❌ Save system is not available');
                return;
            }
            gameState.saveGame({ source });
            console.log(`✅ Save triggered (${source})`);
        },

        /**
         * Load a save (manual or auto slot)
         */
        load: (type = 'manual') => {
            const source = type === 'auto' ? 'auto' : 'manual';
            if (!gameState.loadGame) {
                console.log('❌ Load system is not available');
                return;
            }
            gameState.loadGame({ source });
            console.log(`✅ Load triggered (${source})`);
        },

        /**
         * Hard reset the game and clear saves
         */
        hardReset: () => {
            if (!gameState.resetGame) {
                console.log('❌ Reset system is not available');
                return;
            }
            console.log('⚠️ This will clear all saves and reload the page.');
            gameState.resetGame();
        },

        // ========== Event Debug Commands ==========

        /**
         * List all events by category
         * @param {string} category - Event category (base/class/epoch/economic/all)
         */
        listEvents: (category = 'all') => {
            const categoryMap = {
                base: { events: BASE_EVENTS, name: 'Base Events' },
                class: { events: CLASS_CONFLICT_EVENTS, name: 'Class Conflict Events' },
                epoch: { events: EPOCH_EVENTS, name: 'Epoch Events' },
                economic: { events: ECONOMIC_EVENTS, name: 'Economic Events' },
                diplomatic: { events: STATIC_DIPLOMATIC_EVENTS, name: 'Diplomatic Events' },
                all: { events: EVENTS, name: 'All Events' },
            };

            const cat = category.toLowerCase();
            if (!categoryMap[cat]) {
                console.log(`❌ Invalid category. Use: base, class, epoch, economic, diplomatic, or all`);
                return;
            }

            const { events, name } = categoryMap[cat];
            console.log(`%c📋 ${name} (${events.length} total):`, 'color: #ff9900; font-size: 14px; font-weight: bold;');

            events.forEach((event, index) => {
                const epochInfo = event.triggerConditions?.minEpoch !== undefined
                    ? ` [Epoch ${event.triggerConditions.minEpoch}+]`
                    : '';
                console.log(`  ${index + 1}. ${event.id} - ${event.name}${epochInfo}`);
            });

            console.log(`\n%cTip: Use cheat.getEventInfo('eventId') to see details`, 'color: #888;');
            return events.map(e => ({ id: e.id, name: e.name }));
        },

        /**
         * Search events by keyword
         * @param {string} keyword - Search keyword
         */
        searchEvent: (keyword) => {
            if (!keyword) {
                console.log('❌ Please provide a search keyword');
                return;
            }

            const lowerKeyword = keyword.toLowerCase();
            const results = EVENTS.filter(event =>
                event.id.toLowerCase().includes(lowerKeyword) ||
                event.name.toLowerCase().includes(lowerKeyword) ||
                (event.description && event.description.toLowerCase().includes(lowerKeyword))
            );

            if (results.length === 0) {
                console.log(`❌ No events found matching "${keyword}"`);
                return [];
            }

            console.log(`%c🔍 Found ${results.length} events matching "${keyword}":`, 'color: #ff9900; font-size: 14px; font-weight: bold;');
            results.forEach((event, index) => {
                console.log(`  ${index + 1}. ${event.id} - ${event.name}`);
                if (event.description) {
                    console.log(`     ${event.description.substring(0, 80)}...`);
                }
            });

            return results.map(e => ({ id: e.id, name: e.name }));
        },

        /**
         * Get detailed info of an event
         * @param {string} eventId - Event ID
         */
        getEventInfo: (eventId) => {
            const event = EVENTS.find(e => e.id === eventId);
            if (!event) {
                console.log(`❌ Event "${eventId}" not found`);
                console.log(`%cTip: Use cheat.searchEvent('keyword') to find events`, 'color: #888;');
                return null;
            }

            console.log(`%c📜 Event: ${event.name}`, 'color: #ff9900; font-size: 16px; font-weight: bold;');
            console.log(`  ID: ${event.id}`);
            console.log(`  Description: ${event.description || 'N/A'}`);

            if (event.triggerConditions) {
                console.log('%c  Trigger Conditions:', 'color: #ffff00;');
                Object.entries(event.triggerConditions).forEach(([key, value]) => {
                    console.log(`    ${key}: ${JSON.stringify(value)}`);
                });
            }

            if (event.options && event.options.length > 0) {
                console.log('%c  Options:', 'color: #00ff00;');
                event.options.forEach((opt, idx) => {
                    console.log(`    ${idx + 1}. ${opt.text}`);
                    if (opt.effects) {
                        console.log(`       Effects:`, opt.effects);
                    }
                });
            }

            return event;
        },

        /**
         * Trigger a specific event by ID
         * @param {string} eventId - Event ID to trigger
         */
        triggerEvent: (eventId) => {
            const event = EVENTS.find(e => e.id === eventId);
            if (!event) {
                console.log(`❌ Event "${eventId}" not found`);
                console.log(`%cTip: Use cheat.listEvents() or cheat.searchEvent('keyword') to find events`, 'color: #888;');
                return false;
            }

            if (gameState.currentEvent) {
                console.log(`⚠️ An event is already active. Use cheat.clearEvent() first.`);
                return false;
            }

            // Trigger the event
            gameState.setCurrentEvent(event);
            gameState.setIsPaused(true);

            addLog(`🎭 作弊码：触发事件 - ${event.name}`);
            console.log(`%c✅ Triggered event: ${event.name}`, 'color: #00ff00; font-size: 14px;');
            console.log(`   ID: ${event.id}`);
            console.log(`   Description: ${event.description || 'N/A'}`);

            return true;
        },

        /**
         * Clear/dismiss current event
         */
        clearEvent: () => {
            if (!gameState.currentEvent) {
                console.log(`⚠️ No active event to clear`);
                return false;
            }

            const eventName = gameState.currentEvent.name;
            gameState.setCurrentEvent(null);

            addLog(`🎭 作弊码：清除事件 - ${eventName}`);
            console.log(`%c✅ Cleared event: ${eventName}`, 'color: #00ff00;');

            return true;
        },

        /**
         * God mode - enable everything
         */
        godMode: () => {
            window.cheat.addAll(10000);
            window.cheat.unlockAllTech();
            window.cheat.superArmy();
            window.cheat.maxStability();
            window.cheat.maxApproval();
            window.cheat.richEmpire();
            window.cheat.maxBuildings();
            window.cheat.addPopulation(10000);
            addLog(`👑 作弊码：上帝模式已启用！`);
            console.log(`%c👑 GOD MODE ACTIVATED!`, 'color: #ff00ff; font-size: 20px; font-weight: bold;');
        },

        // ========== Society & Diplomacy Helpers ==========

        /**
         * Set stability to specific value
         */
        setStability: (value = 50) => {
            const v = clamp(value, 0, 100);
            if (!gameState.setStability) {
                console.log('❌ Stability control is not available');
                return;
            }
            gameState.setStability(v);
            addLog(`🏛️ 作弊码：稳定度设为 ${v}`);
            console.log(`✅ Stability set to ${v}`);
        },

        /**
         * Set approval of single stratum
         */
        setApproval: (stratumKey, value = 100) => {
            const key = normalizeStratumKey(stratumKey);
            if (!key) {
                console.log('❌ Please provide a valid stratum key');
                return;
            }
            const v = clamp(value, 0, 100);
            gameState.setClassApproval(prev => ({
                ...prev,
                [key]: v,
            }));
            addLog(`😊 作弊码：${key} 满意度设为 ${v}`);
            console.log(`✅ Approval for "${key}" set to ${v}`);
        },

        /**
         * Set approval for all strata
         */
        setAllApproval: (value = 100) => {
            const v = clamp(value, 0, 100);
            const approvals = {};
            Object.keys(STRATA || {}).forEach(key => {
                approvals[key] = v;
            });
            gameState.setClassApproval(approvals);
            addLog(`😊 作弊码：所有阶层满意度统一为 ${v}`);
            console.log(`✅ All class approvals set to ${v}`);
        },

        /**
         * Set wealth of a single class
         */
        setClassWealth: (stratumKey, value = 10000) => {
            const key = normalizeStratumKey(stratumKey);
            if (!key) {
                console.log('❌ Please provide a valid stratum key');
                return;
            }
            const wealth = Math.max(0, Number(value) || 0);
            gameState.setClassWealth(prev => ({
                ...prev,
                [key]: wealth,
            }), { reason: 'cheat_code', meta: { code: 'setClassWealth', stratumKey: key, value: wealth } });
            addLog(`💰 作弊码：${key} 财富设为 ${wealth}`);
            console.log(`✅ Wealth for "${key}" set to ${wealth}`);
        },

        /**
         * Set wealth of all classes
         */
        setAllClassWealth: (value = 20000) => {
            const wealth = Math.max(0, Number(value) || 0);
            const map = {};
            Object.keys(STRATA || {}).forEach(key => {
                map[key] = wealth;
            });
            gameState.setClassWealth(map, { reason: 'cheat_code', meta: { code: 'setAllClassWealth', value: wealth } });
            addLog(`💰 作弊码：所有阶层财富统一为 ${wealth}`);
            console.log(`✅ All class wealth set to ${wealth}`);
        },

        /**
         * Set population of a single stratum and sync total population
         */
        setStratumPop: (stratumKey, amount = 100) => {
            const key = normalizeStratumKey(stratumKey);
            if (!key) {
                console.log('❌ Please provide a valid stratum key');
                return;
            }
            const count = Math.max(0, Math.floor(Number(amount) || 0));
            gameState.setPopStructure(prev => {
                const next = { ...(prev || {}) };
                next[key] = count;
                const total = Object.values(next).reduce((sum, v) => {
                    const n = Number(v);
                    return sum + (Number.isFinite(n) ? n : 0);
                }, 0);
                if (gameState.setPopulation) {
                    gameState.setPopulation(total);
                }
                return next;
            });
            addLog(`👥 作弊码：阶层 ${key} 人口设为 ${count}`);
            console.log(`✅ Population of "${key}" set to ${count} (total will be synced)`);
        },

        // ========== Diplomacy & Tax Commands ==========

        /**
         * Set relation with a specific nation
         */
        setRelation: (nationIdentifier, value = 100) => {
            const nation = findNationByIdOrName(nationIdentifier, gameState.nations || []);
            if (!nation) {
                console.log(`❌ Nation "${nationIdentifier}" not found`);
                return;
            }
            const v = clamp(value, -100, 100);
            gameState.setNations(prev => prev.map(n => (
                n.id === nation.id ? { ...n, relation: v } : n
            )));
            addLog(`🌍 作弊码：与 ${nation.name} 关系设为 ${v}`);
            console.log(`✅ Relation with "${nation.name}" set to ${v}`);
        },

        /**
         * Make peace with all nations and reset war state
         */
        makePeaceAll: () => {
            gameState.setNations(prev => prev.map(n => ({
                ...n,
                isAtWar: false,
                warScore: 0,
                warDuration: 0,
                enemyLosses: 0,
            })));
            if (gameState.setSelectedTarget) {
                gameState.setSelectedTarget(null);
            }
            // Clean up all fronts and battles
            if (gameState.setActiveFronts) {
                gameState.setActiveFronts(prev => (prev || []).map(f => ({ ...f, status: 'collapsed' })));
            }
            if (gameState.setActiveBattles) {
                gameState.setActiveBattles(prev => (prev || []).map(b => b.status === 'active' ? { ...b, status: 'ended', result: { reason: 'peace_treaty', finalized: true } } : b));
            }
            if (gameState.setMilitaryCorps) {
                gameState.setMilitaryCorps(prev => (prev || []).map(c => c.isAI ? c : { ...c, status: 'idle', assignedFrontId: null }));
            }
            addLog('🕊️ 作弊码：与所有国家停战');
            console.log('✅ All wars ended and war scores reset');
        },

        /**
         * Instantly declare war on a target nation
         */
        declareWar: (nationIdentifier) => {
            const nation = findNationByIdOrName(nationIdentifier, gameState.nations || []);
            if (!nation) {
                console.log(`❌ Nation "${nationIdentifier}" not found`);
                return;
            }
            gameState.setNations(prev => prev.map(n => (
                n.id === nation.id
                    ? {
                        ...n,
                        isAtWar: true,
                        warScore: n.warScore ?? 0,
                        warDuration: n.warDuration ?? 0,
                        warStartDay: gameState.daysElapsed ?? 0,
                    }
                    : n
            )));
            if (gameState.setSelectedTarget) {
                gameState.setSelectedTarget(nation.id);
            }
            addLog(`⚔️ 作弊码：向 ${nation.name} 宣战`);
            console.log(`✅ War declared on "${nation.name}"`);
        },

        /**
         * Make a nation a vassal (bypass requirements)
         * @param {string} nationIdentifier - Nation ID or name
         * @param {string} vassalType - Vassal type: protectorate/tributary/puppet/colony
         */
        makeVassal: (nationIdentifier, vassalType = 'tributary') => {
            const nation = findNationByIdOrName(nationIdentifier, gameState.nations || []);
            if (!nation) {
                console.log(`❌ Nation "${nationIdentifier}" not found`);
                console.log('%cAvailable nations:', 'color: #888;');
                (gameState.nations || []).forEach(n => console.log(`  - ${n.name} (${n.id})`));
                return;
            }

            const validTypes = ['protectorate', 'tributary', 'puppet', 'colony'];
            const typeLabels = {
                protectorate: '保护国',
                tributary: '朝贡国',
                puppet: '傀儡国',
                colony: '殖民地',
            };
            const typeConfigs = {
                protectorate: { tributeRate: 0.08 },
                tributary: { tributeRate: 0.15 },
                puppet: { tributeRate: 0.25 },
                colony: { tributeRate: 0.35 },
            };

            if (!validTypes.includes(vassalType)) {
                console.log(`❌ Invalid vassal type: "${vassalType}"`);
                console.log('%cValid types:', 'color: #888;');
                validTypes.forEach(t => console.log(`  - ${t} (${typeLabels[t]})`));
                return;
            }

            if (nation.vassalOf === 'player') {
                console.log(`⚠️ ${nation.name} is already your vassal`);
                return;
            }

            const config = typeConfigs[vassalType];
            gameState.setNations(prev => prev.map(n => {
                if (n.id !== nation.id) return n;
                return {
                    ...n,
                    vassalOf: 'player',
                    vassalType: vassalType,
                    tributeRate: config.tributeRate,
                    independencePressure: 0,
                    isAtWar: false,
                    warScore: 0,
                    warTarget: null,
                };
            }));

            addLog(`👑 作弊码：${nation.name} 成为你的${typeLabels[vassalType]}`);
            console.log(`%c✅ ${nation.name} is now your ${typeLabels[vassalType]} (${vassalType})`, 'color: #00ff00; font-weight: bold;');
        },

        /**
         * Release a vassal nation
         * @param {string} nationIdentifier - Nation ID or name
         */
        releaseVassal: (nationIdentifier) => {
            const nation = findNationByIdOrName(nationIdentifier, gameState.nations || []);
            if (!nation) {
                console.log(`❌ Nation "${nationIdentifier}" not found`);
                return;
            }

            if (nation.vassalOf !== 'player') {
                console.log(`⚠️ ${nation.name} is not your vassal`);
                return;
            }

            gameState.setNations(prev => prev.map(n => {
                if (n.id !== nation.id) return n;
                return {
                    ...n,
                    vassalOf: null,
                    vassalType: null,
                    tributeRate: 0,
                    independencePressure: 0,
                    relation: Math.min(100, (n.relation || 50) + 20),
                };
            }));

            addLog(`🕊️ 作弊码：释放附庸 ${nation.name}`);
            console.log(`%c✅ Released ${nation.name} from vassal status`, 'color: #00ff00;');
        },

        /**
         * List all vassal nations
         */
        listVassals: () => {
            const typeLabels = {
                protectorate: '保护国',
                tributary: '朝贡国',
                puppet: '傀儡国',
                colony: '殖民地',
            };
            const vassals = (gameState.nations || []).filter(n => n.vassalOf === 'player');
            if (vassals.length === 0) {
                console.log('%c📋 You have no vassals', 'color: #ffff00;');
                return;
            }
            console.log('%c📋 Your Vassals:', 'color: #00ff00; font-size: 14px; font-weight: bold;');
            vassals.forEach(v => {
                const typeName = typeLabels[v.vassalType] || '附庸';
                console.log(`  • ${v.name} (${v.id})`);
                console.log(`    Type: ${typeName} | Tribute: ${Math.round((v.tributeRate || 0) * 100)}% | Independence: ${v.independencePressure || 0}%`);
            });
        },

        /**
         * Set head tax rate for a specific stratum
         */
        setHeadTax: (stratumKey, rate = 0) => {
            const key = normalizeStratumKey(stratumKey);
            if (!key) {
                console.log('❌ Please provide a valid stratum key');
                return;
            }
            const r = Math.max(0, Number(rate) || 0);
            gameState.setTaxPolicies(prev => ({
                ...prev,
                headTaxRates: {
                    ...(prev?.headTaxRates || {}),
                    [key]: r,
                },
            }));
            addLog(`💸 作弊码：${key} 人头税率设为 ${r}`);
            console.log(`✅ Head tax for "${key}" set to ${r}`);
        },

        /**
         * Set head tax for all classes
         */
        setAllHeadTax: (rate = 0) => {
            const r = Math.max(0, Number(rate) || 0);
            const map = {};
            Object.keys(STRATA || {}).forEach(key => {
                map[key] = r;
            });
            gameState.setTaxPolicies(prev => ({
                ...prev,
                headTaxRates: map,
            }));
            addLog(`💸 作弊码：所有阶层人头税率统一为 ${r}`);
            console.log(`✅ All head tax rates set to ${r}`);
        },

        /**
         * Set trade tax rate for a specific resource
         */
        setResourceTax: (resourceKey, rate = 0.05) => {
            const key = normalizeResourceKey(resourceKey);
            if (!key || !RESOURCES[key]) {
                console.log('❌ Please provide a valid tradable resource key');
                return;
            }
            const r = Math.max(0, Number(rate) || 0);
            gameState.setTaxPolicies(prev => ({
                ...prev,
                resourceTaxRates: {
                    ...(prev?.resourceTaxRates || {}),
                    [key]: r,
                },
            }));
            addLog(`💱 作弊码：资源 ${key} 交易税率设为 ${r}`);
            console.log(`✅ Resource tax for "${key}" set to ${r}`);
        },

        /**
         * Set trade tax for all tradable resources
         */
        setAllResourceTax: (rate = 0.05) => {
            const r = Math.max(0, Number(rate) || 0);
            const map = {};
            Object.keys(RESOURCES || {}).forEach(key => {
                const def = RESOURCES[key];
                if (!def || def.type === 'virtual' || key === 'silver') return;
                map[key] = r;
            });
            gameState.setTaxPolicies(prev => ({
                ...prev,
                resourceTaxRates: map,
            }));
            addLog(`💱 作弊码：所有可交易资源税率统一为 ${r}`);
            console.log(`✅ All tradable resource taxes set to ${r}`);
        },

        // ========== Ideology Cheat Commands ==========

        /**
         * 增加理念分数
         */
        addIdeologyScore: (amount = 500) => {
            const value = Math.max(0, Number(amount) || 0);
            if (!gameState.setIdeologyScore) {
                console.log('❌ Ideology system is not available');
                return;
            }
            gameState.setIdeologyScore(prev => (prev || 0) + value);
            addLog(`💡 作弊码：获得 ${value} 理念分数`);
            console.log(`✅ Added ${value} ideology score`);
        },

        /**
         * 触发理念涌现（强制三选一）
         */
        triggerEmergence: () => {
            if (!gameState.setIdeologyScore || !gameState.setPendingIdeologyEmergence) {
                console.log('❌ Ideology system is not available');
                return;
            }
            // 通过增加足够分数触发涌现
            const owned = (gameState.ideologyCollection || []).length;
            const threshold = 50 + owned * 30;
            const currentNet = (gameState.ideologyScore || 0) - (gameState.ideologyScoreSpent || 0);
            if (currentNet < threshold) {
                gameState.setIdeologyScore(prev => (prev || 0) + (threshold - currentNet + 10));
            }
            addLog(`💡 作弊码：理念涌现即将触发（下次 tick 生效）`);
            console.log(`✅ Ideology emergence will trigger on next tick (threshold: ${threshold})`);
        },

        /**
         * 解锁所有理念（全部3级）
         */
        unlockAllIdeology: () => {
            if (!gameState.setIdeologyCollection) {
                console.log('❌ Ideology system is not available');
                return;
            }
            try {
                const allIdeologies = IDEOLOGIES.map(i => ({ id: i.id, level: 3 }));
                gameState.setIdeologyCollection(allIdeologies);
                addLog(`💡 作弊码：解锁所有理念（共 ${allIdeologies.length} 个，全部满级）`);
                console.log(`✅ Unlocked all ${allIdeologies.length} ideologies at max level`);
            } catch (e) {
                console.log('❌ Failed to load ideology config:', e.message);
            }
        },

        /**
         * 增加理念卡槽
         */
        addIdeologySlot: (amount = 1) => {
            if (!gameState.setIdeologySlotCount) {
                console.log('❌ Ideology system is not available');
                return;
            }
            const value = Math.max(1, Math.floor(Number(amount) || 1));
            gameState.setIdeologySlotCount(prev => Math.min(10, (prev || 3) + value));
            addLog(`💡 作弊码：增加 ${value} 个理念卡槽`);
            console.log(`✅ Added ${value} ideology slot(s)`);
        },

        /**
         * 清除所有理念冷却
         */
        clearIdeologyCooldowns: () => {
            if (!gameState.setIdeologyCooldowns) {
                console.log('❌ Ideology system is not available');
                return;
            }
            gameState.setIdeologyCooldowns({});
            addLog(`💡 作弊码：清除所有理念冷却`);
            console.log(`✅ All ideology cooldowns cleared`);
        },

        /**
         * 清空理念（重置理念系统）
         */
        resetIdeology: () => {
            if (!gameState.setIdeologyCollection) {
                console.log('❌ Ideology system is not available');
                return;
            }
            gameState.setIdeologyScore(0);
            gameState.setIdeologyScoreSpent(0);
            gameState.setIdeologyCollection([]);
            gameState.setEquippedIdeologies([]);
            gameState.setIdeologySlotCount(3);
            gameState.setIdeologyCooldowns({});
            gameState.setIdeologyMilestones([]);
            gameState.setPendingIdeologyEmergence(null);
            addLog(`💡 作弊码：理念系统已重置`);
            console.log(`✅ Ideology system reset`);
        },

        /**
         * 查看理念状态
         */
        ideologyStatus: () => {
            const score = gameState.ideologyScore || 0;
            const spent = gameState.ideologyScoreSpent || 0;
            const collection = gameState.ideologyCollection || [];
            const equipped = gameState.equippedIdeologies || [];
            const slots = gameState.ideologySlotCount || 3;
            const cooldowns = gameState.ideologyCooldowns || {};
            const net = score - spent;
            const threshold = 50 + collection.length * 30;

            console.log('%c💡 Ideology Status:', 'color: #a855f7; font-size: 16px; font-weight: bold;');
            console.log(`  Score: ${score} (spent: ${spent}, net: ${net})`);
            console.log(`  Next emergence at: ${threshold} (need ${Math.max(0, threshold - net)} more)`);
            console.log(`  Collection: ${collection.length} ideologies`);
            collection.forEach(i => console.log(`    - ${i.id} (Lv.${i.level})`));
            console.log(`  Equipped: ${equipped.length}/${slots} slots`);
            equipped.forEach(id => console.log(`    - ${id}`));
            const cdKeys = Object.keys(cooldowns).filter(k => cooldowns[k] > 0);
            if (cdKeys.length > 0) {
                console.log(`  Cooldowns:`);
                cdKeys.forEach(k => console.log(`    - ${k}: ${cooldowns[k]} days`));
            }
        },
    };

    // Display welcome message (commented out to reduce console spam)
    // console.log('%c🎮 Cheat Codes Enabled!', 'color: #00ff00; font-size: 18px; font-weight: bold;');
    // console.log('%cType window.cheat.help() or cheat.help() to see all available commands', 'color: #ffff00; font-size: 14px;');
    // console.log('%cOr type cheats directly in game: addall, unlockalltech, godmode, etc.', 'color: #00ffff; font-size: 12px;');

    // ========== Keyboard Cheat Code Detection ==========
    // Allows typing cheat codes directly in the game without opening the console

    // Map of keyboard cheat codes to their handlers
    const KEYBOARD_CHEATS = {
        'addall': () => window.cheat.addAll(1000),
        'addmoney': () => window.cheat.addSilver(10000),
        'addsilver': () => window.cheat.addSilver(10000),
        'addfood': () => window.cheat.addFood(1000),
        'addwood': () => window.cheat.addWood(1000),
        'addstone': () => window.cheat.addStone(1000),
        'addiron': () => window.cheat.addIron(1000),
        'unlockalltech': () => window.cheat.unlockAllTech(),
        'unlocktech': () => window.cheat.unlockAllTech(),
        'godmode': () => window.cheat.godMode(),
        'superarmy': () => window.cheat.superArmy(),
        'invincible': () => window.cheat.invincibleArmy(),
        'maxstability': () => window.cheat.maxStability(),
        'maxapproval': () => window.cheat.maxApproval(),
        'richemp': () => window.cheat.richEmpire(),
        'richempire': () => window.cheat.richEmpire(),
        'maxbuild': () => window.cheat.maxBuildings(),
        'maxbuildings': () => window.cheat.maxBuildings(),
        'addpop': () => window.cheat.addPopulation(1000),
        'addpopulation': () => window.cheat.addPopulation(1000),
        'nextepoch': () => window.cheat.nextEpoch(),
        'skipyear': () => window.cheat.skipYear(),
        'peaceall': () => window.cheat.makePeaceAll(),
        'peace': () => window.cheat.makePeaceAll(),
        'addidea': () => window.cheat.addIdeologyScore(500),
        'emergence': () => window.cheat.triggerEmergence(),
        'unlockallidea': () => window.cheat.unlockAllIdeology(),
        'addslot': () => window.cheat.addIdeologySlot(1),
        'clearcd': () => window.cheat.clearIdeologyCooldowns(),
        'resetidea': () => window.cheat.resetIdeology(),
        'vassal': () => console.log('%c👑 Use cheat.makeVassal("nation", "type") to make a nation your vassal', 'color: #ffff00;'),
        'listvassal': () => window.cheat.listVassals(),
    };

    // Buffer to store recently typed characters
    let cheatBuffer = '';
    let lastKeyTime = 0;
    const BUFFER_TIMEOUT = 2000; // Reset buffer after 2 seconds of inactivity
    const MAX_BUFFER_LENGTH = 20; // Maximum buffer length to prevent memory issues

    // Keyboard event handler
    const handleKeyDown = (event) => {
        // Ignore if typing in an input field, textarea, or contenteditable
        const target = event.target;
        if (
            target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.isContentEditable
        ) {
            return;
        }

        // Only process alphanumeric keys
        const key = event.key.toLowerCase();
        if (!/^[a-z0-9]$/.test(key)) {
            return;
        }

        const now = Date.now();

        // Reset buffer if too much time has passed
        if (now - lastKeyTime > BUFFER_TIMEOUT) {
            cheatBuffer = '';
        }
        lastKeyTime = now;

        // Add key to buffer
        cheatBuffer += key;

        // Limit buffer size
        if (cheatBuffer.length > MAX_BUFFER_LENGTH) {
            cheatBuffer = cheatBuffer.slice(-MAX_BUFFER_LENGTH);
        }

        // Check if buffer ends with any known cheat code
        for (const [code, handler] of Object.entries(KEYBOARD_CHEATS)) {
            if (cheatBuffer.endsWith(code)) {
                console.log(`%c🎮 Cheat activated: ${code}`, 'color: #00ff00; font-weight: bold;');
                handler();
                cheatBuffer = ''; // Reset buffer after successful cheat
                break;
            }
        }
    };

    // Add the event listener
    document.addEventListener('keydown', handleKeyDown);

    // Store cleanup function on window for potential manual cleanup
    window._cheatCodeCleanup = () => {
        document.removeEventListener('keydown', handleKeyDown);
    };

    //   addLog('🎮 作弊码系统已启用！在控制台输入 cheat.help() 查看帮助');
};
