
// 经济账本系统
// 集中管理所有财富转移和统计，防止数据不一致

// 交易类别定义
export const TRANSACTION_CATEGORIES = {
    INCOME: {
        WAGE: 'wage',
        WAGE_INCOME: 'wageIncome', // V3: worker receives wage from owner
        SALARY: 'salary', // 官员薪水
        MILITARY_PAY: 'militaryPay', // 军饷
        OWNER_REVENUE: 'ownerRevenue', // 业主经营收入
        PRODUCTION_SALE: 'productionSale', // V3: producer sells to merchant
        CONSUMER_PURCHASE: 'consumerPurchase', // V3: merchant receives from consumer
        TRADE_EXPORT_REVENUE: 'tradeExportRevenue', // V3: foreign currency inflow from exports
        MINT_OUTPUT: 'mintOutput', // V3: mint produces silver → state
        SUBSIDY: 'subsidy', // 政府补贴
        SUBSIDY_TO_MERCHANT: 'subsidyToMerchant', // V3: state subsidizes merchant liquidity
        CORRUPTION: 'corruption', // 腐败收入
        TRADE_IMPORT: 'tradeImport', // 贸易进口（视为收入的一种形式？不，这是支出，但如果转手卖就是收入。这里指贸易获利）
        // 修正：贸易获利通常计入 OWNER_REVENUE
        TRADE_IMPORT_REVENUE: 'tradeImportRevenue', // 贸易进口收入（卖出进口货物）
        LAYOFF_TRANSFER: 'layoffTransfer', // 裁员时随人口转移的财富
    },
    EXPENSE: {
        HEAD_TAX: 'headTax',
        BUSINESS_TAX: 'businessTax',
        RESOURCE_TAX: 'transactionTax', // 交易税/资源税
        TARIFF: 'tariffs',
        PRODUCTION_COST: 'productionCosts',
        PRODUCTION_PURCHASE: 'productionPurchase', // V3: merchant buys production from producer
        WAGES_PAID: 'wages', // 业主支付给工人的工资
        WAGE_PAYMENT: 'wagePayment', // V3: owner pays wage to worker
        ESSENTIAL_CONSUMPTION: 'essentialNeeds',
        LUXURY_CONSUMPTION: 'luxuryNeeds',
        CONSUMER_SPENDING: 'consumerSpending', // V3: consumer pays merchant for goods
        DECAY: 'decay', // 财富自然衰减
        MAINTENANCE: 'maintenance', // 维护费
        TRADE_EXPORT: 'tradeExport', // 贸易出口支出
        TRADE_EXPORT_PURCHASE: 'tradeExportPurchase', // 贸易出口购买成本
        TRADE_IMPORT_PAYMENT: 'tradeImportPayment', // V3: silver outflow for imports
        CAPITAL_FLIGHT: 'capitalFlight', // 资本外逃
        BUILDING_COST: 'buildingCost', // 建筑建造/升级成本
        LAYOFF_TRANSFER: 'layoffTransfer', // 裁员时随人口转移的财富
    }
};

/**
 * 经济账本类
 * 负责执行交易并自动更新相关统计数据
 */
export class EconomyLedger {
    constructor(state, helpers) {
        this.resources = state.resources; // 全局资源 (res.silver)
        this.wealth = state.wealth; // 各阶层财富 (wealth[key])
        this.officials = state.officials; // 官员列表 (独立财富)
        this.classFinancialData = state.classFinancialData; // 阶层财务统计
        this.taxBreakdown = state.taxBreakdown; // 税收统计
        this.silverChangeLog = state.silverChangeLog; // 银币变动日志
        this.buildingFinancialData = state.buildingFinancialData; // 建筑财务统计 (可选)
        this.classWealthChangeLog = state.classWealthChangeLog || {}; // 阶层财富变动日志

        // 辅助函数
        this.safeWealth = helpers.safeWealth;
        
        // 投资统计 (用于GDP计算)
        this.dailyInvestment = 0; // 当日总投资额（建筑建造+升级）
        this.dailyOwnerRevenue = 0; // 当日建筑产出收入（用于存货变动计算）

        // V3: Monetary conservation tracking
        this.v3MintOutput = 0; // Total silver created by mints this tick
        this.v3TradeExportRevenue = 0; // Total silver inflow from exports
        this.v3TradeImportPayment = 0; // Total silver outflow for imports
    }

    /**
     * 执行转账
     * @param {string} from - 来源 ('state' 或 阶层key 或 'void')
     * @param {string} to - 目标 ('state' 或 阶层key 或 'void')
     * @param {number} amount - 金额
     * @param {string} category - 交易大类 (income/expense)
     * @param {string} subCategory - 交易子类 (wage/tax/etc)
     * @param {Object} metadata - 额外元数据 (buildingId, resource, etc)
     */
    transfer(from, to, amount, category, subCategory, metadata = {}) {
        if (amount <= 0) return;

        // 1. 扣款 — _deduct 返回实际扣除金额（可能因余额不足而小于 amount）
        // [FIX] Use `category` for expense recording (sender's expense type),
        //       and `subCategory` for income recording (receiver's income type).
        //       Previously both used `subCategory`, causing cross-category transfers
        //       (e.g. merchant→owner with PRODUCTION_PURCHASE/PRODUCTION_SALE)
        //       to silently fail recording the sender's expense.
        let actualDeducted = amount;
        if (from !== 'void') {
            actualDeducted = this._deduct(from, amount, category, metadata);
            this._recordExpense(from, actualDeducted, category, metadata);
        }

        // 2. 入账
        if (to !== 'void') {
            this._add(to, amount, subCategory, metadata);
            this._recordIncome(to, amount, subCategory, metadata);
        }

        // 3. 特殊统计 (如税收)
        this._updateSystemStats(from, to, amount, subCategory, metadata);
    }

    // --- 内部方法 ---

    /**
     * Track wealth change in classWealthChangeLog
     * @param {string} entity - Class key (e.g. 'peasant', 'merchant')
     * @param {number} amount - Amount changed (positive or negative)
     * @param {string} reason - Reason for the change (e.g. 'wage', 'headTax')
     */
    _trackClassWealthChange(entity, amount, reason) {
        if (entity === 'state' || entity === 'void') return;
        if (!this.classWealthChangeLog) return;
        
        if (!this.classWealthChangeLog[entity]) {
            this.classWealthChangeLog[entity] = [];
        }
        this.classWealthChangeLog[entity].push({
            amount,
            reason,
            balance: this.wealth[entity] || 0
        });
    }

    _deduct(entity, amount, reason, metadata = {}) {
        if (entity === 'state') {
            const before = this.resources.silver || 0;
            this.resources.silver = Math.max(0, before - amount);
            return before - this.resources.silver;
        } else if (entity === 'official_pool') {
            return amount;
        } else {
            const before = this.wealth[entity] || 0;
            this.wealth[entity] = Math.max(0, before - amount);
            const actual = before - this.wealth[entity];
            this._trackClassWealthChange(entity, -actual, reason);
            return actual;
        }
    }

    _add(entity, amount, reason, metadata = {}) {
        if (!Number.isFinite(amount)) return;
        if (entity === 'state') {
            const newVal = (this.resources.silver || 0) + amount;
            this.resources.silver = newVal;
        } else {
            this.wealth[entity] = this.safeWealth((this.wealth[entity] || 0) + amount);
            this._trackClassWealthChange(entity, amount, reason);
        }
    }

    _recordExpense(entity, amount, type, meta) {
        if (entity === 'state') {
            this.silverChangeLog.push({ amount: -amount, reason: type, balance: this.resources.silver });
            return;
        }

        // 阶层统计
        if (this.classFinancialData[entity]) {
            const expense = this.classFinancialData[entity].expense;

            if (type === TRANSACTION_CATEGORIES.EXPENSE.ESSENTIAL_CONSUMPTION || type === TRANSACTION_CATEGORIES.EXPENSE.LUXURY_CONSUMPTION) {
                // 消费类：记录资源详情
                if (!expense[type]) expense[type] = {}; // 应该初始化为对象
                // 确保是对象结构
                if (typeof expense[type] !== 'object') expense[type] = {};

                const resKey = meta.resource || 'unknown';
                if (!expense[type][resKey]) expense[type][resKey] = { cost: 0, quantity: 0, price: 0 };

                expense[type][resKey].cost += amount;
                expense[type][resKey].quantity += (meta.quantity || 0);
                expense[type][resKey].price = meta.price || 0;
            } else if (type === TRANSACTION_CATEGORIES.EXPENSE.TRADE_EXPORT) {
                // [FIX] 贸易出口购买成本：记录到 tradeExportPurchase
                if (expense.tradeExportPurchase !== undefined) {
                    expense.tradeExportPurchase += amount;
                }
            } else if (type === TRANSACTION_CATEGORIES.EXPENSE.TRADE_IMPORT) {
                // [FIX] 贸易进口购买成本：记录到 productionCosts（商人购买进口货物的成本）
                if (expense.productionCosts !== undefined) {
                    expense.productionCosts += amount;
                }
            } else {
                // 其他类：直接累加数值
                if (expense[type] !== undefined) {
                    expense[type] += amount;
                }
            }
        }
    }

    _recordIncome(entity, amount, type, meta) {
        if (entity === 'state') {
            this.silverChangeLog.push({ amount, reason: type, balance: this.resources.silver });
            return;
        }

        if (this.classFinancialData[entity]) {
            const income = this.classFinancialData[entity].income;
            if (income[type] !== undefined) {
                income[type] += amount;
            }
        }
    }

    _updateSystemStats(from, to, amount, type, metadata = {}) {
        // 税收统计
        if (to === 'state') {
            if (type === TRANSACTION_CATEGORIES.EXPENSE.HEAD_TAX) this.taxBreakdown.headTax += amount;
            if (type === TRANSACTION_CATEGORIES.EXPENSE.BUSINESS_TAX) this.taxBreakdown.businessTax += amount;
            if (type === TRANSACTION_CATEGORIES.EXPENSE.RESOURCE_TAX) this.taxBreakdown.industryTax += amount;
            if (type === TRANSACTION_CATEGORIES.EXPENSE.TARIFF) this.taxBreakdown.tariff = (this.taxBreakdown.tariff || 0) + amount;
        }

        // 补贴统计
        if (from === 'state' && type === TRANSACTION_CATEGORIES.INCOME.SUBSIDY) {
            this.taxBreakdown.subsidy += amount;
        }
        
        // 投资统计 (建筑建造/升级成本)
        if (to === 'void' && type === TRANSACTION_CATEGORIES.EXPENSE.BUILDING_COST) {
            this.dailyInvestment += amount;
        }
        
        // 建筑产出收入统计 (用于存货变动计算)
        if (from === 'void' && type === TRANSACTION_CATEGORIES.INCOME.OWNER_REVENUE) {
            this.dailyOwnerRevenue += amount;
        }

        // V3: Track mint output and trade flows for monetary conservation
        if (from === 'void' && type === TRANSACTION_CATEGORIES.INCOME.MINT_OUTPUT) {
            this.v3MintOutput += amount;
        }
        if (from === 'void' && type === TRANSACTION_CATEGORIES.INCOME.TRADE_EXPORT_REVENUE) {
            this.v3TradeExportRevenue += amount;
        }
        if (to === 'void' && type === TRANSACTION_CATEGORIES.EXPENSE.TRADE_IMPORT_PAYMENT) {
            this.v3TradeImportPayment += amount;
        }

        // 建筑统计 (如果有 metadata.buildingId)
        if (metadata.buildingId && this.buildingFinancialData && this.buildingFinancialData[metadata.buildingId]) {
            const bData = this.buildingFinancialData[metadata.buildingId];
            if (type === TRANSACTION_CATEGORIES.EXPENSE.BUSINESS_TAX) bData.businessTaxPaid += amount;
            if (type === TRANSACTION_CATEGORIES.INCOME.OWNER_REVENUE) bData.ownerRevenue += amount;
            // ... 其他建筑统计
        }
    }
}
