// Cheat Codes System for Civilization Game
// Usage: Open browser console and type window.cheat.help() to see all available commands

import { EPOCHS } from '../config';

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

/**
 * Initialize cheat codes system
 * @param {Object} gameState - The game state object
 * @param {Function} addLog - Function to add log messages
 */
export const initCheatCodes = (gameState, addLog) => {
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
      console.log('%cGod Mode:', 'color: #ff00ff; font-weight: bold;');
      console.log('  cheat.godMode()             - Enable everything!');
      console.log('');
      console.log('%cUtility:', 'color: #00ffff; font-weight: bold;');
      console.log('  cheat.getState()            - View current game state');
      console.log('  cheat.help()                - Show this help');
    },

    /**
     * Add silver coins
     */
    addSilver: (amount = 10000) => {
      gameState.setResources(prev => ({
        ...prev,
        silver: (prev.silver || 0) + amount
      }));
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
      }));
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
      }));
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
      }));
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
      }));
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
      }));
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
      }));
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
      }));
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
      }));
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
      }));
      addLog(`🪑 作弊码：获得 ${amount} 家具`);
      console.log(`✅ Added ${amount} furniture`);
    },

    /**
     * Add all resources
     */
    addAll: (amount = 1000) => {
      gameState.setResources(prev => ({
        silver: (prev.silver || 0) + amount * 10,
        food: (prev.food || 0) + amount,
        wood: (prev.wood || 0) + amount,
        stone: (prev.stone || 0) + amount,
        iron: (prev.iron || 0) + amount,
        brick: (prev.brick || 0) + amount,
        tool: (prev.tool || 0) + amount,
        cloth: (prev.cloth || 0) + amount,
        beer: (prev.beer || 0) + amount,
        furniture: (prev.furniture || 0) + amount,
      }));
      addLog(`✨ 作弊码：获得所有资源 x${amount}`);
      console.log(`✅ Added ${amount} of all resources`);
    },

    /**
     * Add population
     */
    addPopulation: (amount = 1000) => {
      gameState.setPopulation(prev => prev + amount);
      addLog(`👥 作弊码：人口增加 ${amount}`);
      console.log(`✅ Added ${amount} population`);
    },

    /**
     * Set population to specific value
     */
    setPopulation: (amount) => {
      gameState.setPopulation(amount);
      addLog(`👥 作弊码：人口设置为 ${amount}`);
      console.log(`✅ Set population to ${amount}`);
    },

    /**
     * Unlock all technologies
     */
    unlockAllTech: () => {
      const allTechs = [
        'agriculture', 'pottery', 'weaving', 'mining', 'metalworking',
        'writing', 'mathematics', 'philosophy', 'engineering', 'architecture',
        'feudalism', 'guilds', 'banking', 'printing', 'gunpowder',
        'chemistry', 'physics', 'steam_power', 'electricity', 'industrialization',
        'assembly_line', 'computers', 'internet', 'ai', 'quantum'
      ];
      gameState.setTechsUnlocked(allTechs);
      addLog(`🔬 作弊码：解锁所有科技`);
      console.log(`✅ Unlocked all technologies`);
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
      });
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
    }
  };

  // Display welcome message
  console.log('%c🎮 Cheat Codes Enabled!', 'color: #00ff00; font-size: 18px; font-weight: bold;');
  console.log('%cType window.cheat.help() or cheat.help() to see all available commands', 'color: #ffff00; font-size: 14px;');
  
//   addLog('🎮 作弊码系统已启用！在控制台输入 cheat.help() 查看帮助');
};
