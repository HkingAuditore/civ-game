import { createPortal } from 'react-dom';
import { Icon } from '../common/UIComponents';
import { RESOURCES } from '../../config';
import { calculateForeignPrice, calculateTradeStatus } from '../../utils/foreignTrade';

const TradeRoutesModal = ({ tradeRoutes, nations, resources, market, taxPolicies, daysElapsed, onClose, onCancelRoute }) => {
    // Helper to get nation name by ID
    const getNationName = (id) => {
        const nation = nations.find(n => n.id === id);
        return nation ? nation.name : 'Unknown Nation';
    };

    // Helper to format currency
    const formatMoney = (amount) => {
        return amount ? amount.toFixed(1) : '0.0';
    };

    // Calculate estimated profit/cost per tick
    const calculateRouteEconomics = (route) => {
        const nation = nations.find(n => n.id === route.nationId);
        if (!nation) return null;

        const { resource, type } = route;
        const localPrice = market?.prices?.[resource] ?? (RESOURCES[resource]?.basePrice || 1);
        const foreignPrice = calculateForeignPrice(resource, nation, daysElapsed);
        const tradeStatus = calculateTradeStatus(resource, nation, daysElapsed);

        let label = '';
        let valueClass = '';
        let subText = '';

        const TRADE_SPEED = 0.05;
        const taxRate = taxPolicies?.resourceTaxRates?.[resource] || 0;
        const tariffMultiplier = Math.max(0, taxPolicies?.resourceTariffMultipliers?.[resource] ?? 1);
        const effectiveTaxRate = taxRate * tariffMultiplier;

        if (type === 'export') {
            // Export: We sell. Need foreign shortage.
            const myInventory = resources[resource] || 0;
            const mySurplus = Math.max(0, myInventory - 500); // simplify my target
            const foreignShortage = tradeStatus.shortageAmount || 0;
            const possibleVolume = Math.min(mySurplus, foreignShortage) * TRADE_SPEED;

            if (possibleVolume < 0.1) {
                return { label: '暂停 (无需求/无货)', valueClass: 'text-gray-500', subText: '等待市场变化' };
            }

            // Profit = Tax collected
            const domesticCost = localPrice * possibleVolume;
            const taxRevenue = domesticCost * effectiveTaxRate;
            // Merchant profit (invisible to player usually but good to know if sustainable)
            const foreignRevenue = foreignPrice * possibleVolume;
            const merchantMargin = foreignRevenue - domesticCost - taxRevenue;

            if (merchantMargin <= 0) {
                return { label: '亏损暂停', valueClass: 'text-red-400', subText: '商人无法获利' };
            }

            return {
                label: `+${taxRevenue.toFixed(1)} 银/天`,
                valueClass: 'text-green-400',
                subText: `出口 ${possibleVolume.toFixed(1)} ${RESOURCES[resource]?.name || resource}`
            };

        } else {
            // Import: We buy. Need foreign surplus.
            // Mock player shortage check (assuming player wants to buy if import route exists)
            // But actually import logic checks player shortage.
            // Let's assume active if route exists.
            const foreignSurplus = tradeStatus.surplusAmount || 0;
            const possibleVolume = Math.min(foreignSurplus, 500) * TRADE_SPEED; // assume max need? 
            // Without precise player shortage, use a reasonable estimate or just price diff

            if (possibleVolume < 0.1) {
                return { label: '暂停 (无货)', valueClass: 'text-gray-500', subText: '等待对方补货' };
            }

            // Import Tax? Usually Tariffs.
            // Assuming similar tax structure for simplicity or just display volume
            // Let's display Volume and Price Diff
            const priceDiff = localPrice - foreignPrice;
            const isProfitable = priceDiff > 0; // Buying cheap abroad

            return {
                label: `进口 ${possibleVolume.toFixed(1)}/天`,
                valueClass: 'text-blue-400',
                subText: `价差: ${(foreignPrice - localPrice).toFixed(1)}`
            };
        }
    };

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose}></div>

            {/* Modal Content */}
            <div className="relative w-full max-w-2xl glass-panel border-2 border-amber-500/30 rounded-2xl shadow-2xl overflow-hidden animate-slide-up bg-gray-900/90">
                {/* Header */}
                <div className="p-4 border-b border-amber-500/20 bg-gradient-to-r from-amber-900/40 to-gray-900/60 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center border border-amber-500/30">
                            <Icon name="Coins" size={20} className="text-amber-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-amber-100">贸易路线概览</h2>
                            {/* <p className="text-xs text-amber-400/80">Active Trade Routes</p> */}
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
                    >
                        <Icon name="X" size={20} />
                    </button>
                </div>

                {/* Table Header */}
                <div className="grid grid-cols-12 gap-2 px-6 py-3 bg-white/5 text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-white/5">
                    <div className="col-span-3">交易伙伴</div>
                    <div className="col-span-2">类型</div>
                    <div className="col-span-2">商品</div>
                    <div className="col-span-3 text-right">预估收益/支出</div>
                    <div className="col-span-2 text-center">操作</div>
                </div>

                {/* Scrollable List */}
                <div className="max-h-[60vh] overflow-y-auto p-4 space-y-2 custom-scrollbar">
                    {tradeRoutes.routes.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            <Icon name="Coins" size={48} className="mx-auto mb-3 opacity-20" />
                            <p>暂无活跃的贸易路线</p>
                            <p className="text-xs mt-1">请前往外交面板与各国建立贸易关系</p>
                        </div>
                    ) : (
                        tradeRoutes.routes.map((route, index) => {
                            const isExport = route.type === 'export';
                            const resource = RESOURCES[route.resource];
                            const nationName = getNationName(route.nationId);
                            const economics = calculateRouteEconomics(route) || { label: '计算中...', valueClass: 'text-gray-400', subText: '' };

                            return (
                                <div
                                    key={`${route.nationId}-${route.resource}-${route.type}-${index}`}
                                    className="grid grid-cols-12 gap-2 items-center p-3 rounded-lg bg-gray-800/40 hover:bg-gray-800/60 border border-white/5 hover:border-white/10 transition-colors text-sm"
                                >
                                    {/* Nation */}
                                    <div className="col-span-3 font-medium text-gray-200 truncate" title={nationName}>
                                        {nationName}
                                    </div>

                                    {/* Type */}
                                    <div className="col-span-2">
                                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold ${isExport
                                            ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                                            : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                                            }`}>
                                            {isExport ? <Icon name="ArrowUpRight" size={12} /> : <Icon name="ArrowDownLeft" size={12} />}
                                            {isExport ? '出口' : '进口'}
                                        </span>
                                    </div>

                                    {/* Resource */}
                                    <div className="col-span-2 flex items-center gap-2">
                                        {/* You might want a resource icon here if available */}
                                        <span className="text-gray-300">{resource ? resource.name : route.resource}</span>
                                    </div>

                                    {/* Financials */}
                                    <div className="col-span-3 text-right flex flex-col justify-center">
                                        <span className={`font-mono text-xs font-bold ${economics.valueClass}`}>
                                            {economics.label}
                                        </span>
                                        {economics.subText && (
                                            <span className="text-[10px] text-gray-500">
                                                {economics.subText}
                                            </span>
                                        )}
                                    </div>

                                    {/* Action */}
                                    <div className="col-span-2 flex justify-center">
                                        <button
                                            onClick={() => onCancelRoute(route.nationId, route.resource, route.type)}
                                            className="p-1.5 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-colors"
                                            title="取消路线"
                                        >
                                            <Icon name="X" size={14} />
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-white/5 bg-gray-900/50 flex justify-between items-center text-xs text-gray-500">
                    <div>
                        总路线数: <span className="text-gray-300">{tradeRoutes.routes.length}</span>
                    </div>
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded transition-colors"
                    >
                        关闭
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default TradeRoutesModal;
