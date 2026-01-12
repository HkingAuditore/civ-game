import React from 'react';
import { Modal, Button, Input, Badge, Card } from '../common/UnifiedUI';
import { Icon } from '../common/UIComponents';
import { RESOURCES } from '../../config/gameConstants';
import { NEGOTIABLE_TREATY_TYPES, NEGOTIATION_MAX_ROUNDS } from '../../config/diplomacy';
import { getTreatyLabel, getTreatyUnlockEraName, getTreatyDuration } from '../../utils/diplomacyUtils';
import { getTreatyEffectDescriptionsByType } from '../../logic/diplomacy/treatyEffects';

const NegotiationDialog = ({
    isOpen,
    onClose,
    selectedNation,
    negotiationDraft,
    setNegotiationDraft,
    negotiationRound,
    negotiationEvaluation,
    negotiationCounter,
    submitNegotiation,
    isDiplomacyUnlocked,
    epoch,
    tradableResources
}) => {
    const dealScore = Math.round(negotiationEvaluation.dealScore || 0);
    const dealScale = 2000;
    const dealProgress = Math.min(100, Math.abs(dealScore) / dealScale * 100);

    // 渲染底部按钮栏
    const renderFooter = () => {
        const treatyUnlocked = isDiplomacyUnlocked('treaties', negotiationDraft.type, epoch);
        const canSubmit = !!selectedNation && treatyUnlocked && !selectedNation?.isAtWar;

        if (negotiationCounter) {
            return (
                <div className="flex gap-3 justify-end w-full">
                    <Button variant="secondary" onClick={onClose}>
                        放弃谈判
                    </Button>
                    <Button
                        variant="primary"
                        onClick={() => submitNegotiation({ ...negotiationCounter, stance: negotiationDraft.stance }, { forceAccept: true, round: negotiationRound })}
                        disabled={!canSubmit}
                        icon={<Icon name="Check" size={14} />}
                    >
                        接受反提案
                    </Button>
                    <Button
                        variant="epic"
                        onClick={() => submitNegotiation(negotiationDraft, { round: negotiationRound })}
                        disabled={!canSubmit}
                        icon={<Icon name="ArrowUpCircle" size={14} />}
                    >
                        坚持原提案
                    </Button>
                </div>
            );
        }
        return (
            <div className="flex gap-3 justify-end w-full">
                <Button variant="secondary" onClick={onClose}>
                    取消
                </Button>
                <Button
                    variant="epic"
                    onClick={() => submitNegotiation(negotiationDraft, { round: negotiationRound })}
                    disabled={!canSubmit}
                    icon={<Icon name="Send" size={14} />}
                >
                    发起提案
                </Button>
            </div>
        );
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`与 ${selectedNation?.name || ''} 外交谈判`}
            footer={renderFooter()}
            size="lg"
        >
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-ancient-gold/20">
                {/* 谈判状态栏 */}
                <div className="flex items-center justify-between px-1">
                    <Badge variant="neutral" icon={<Icon name="Clock" size={12} />}>
                        第{negotiationRound}/{NEGOTIATION_MAX_ROUNDS} 轮
                    </Badge>
                    <div className="flex items-center gap-2 text-sm text-ancient-stone">
                        <span>预计接受率</span>
                        <span className={`font-mono font-bold text-lg ${(negotiationEvaluation.acceptChance || 0) > 0.7 ? 'text-green-400' :
                            (negotiationEvaluation.acceptChance || 0) > 0.4 ? 'text-amber-400' : 'text-red-400'
                            }`}>
                            {Math.round((negotiationEvaluation.acceptChance || 0) * 100)}%
                        </span>
                    </div>
                </div>
                <div className="bg-black/20 border border-ancient-gold/10 rounded p-2">
                    <div className="flex items-center justify-between text-xs text-ancient-stone mb-1">
                        <span>交易差额</span>
                        <span className={`${dealScore >= 0 ? 'text-green-400' : 'text-red-400'} font-mono font-bold`}>
                            {dealScore >= 0 ? `+${dealScore}` : `${dealScore}`}
                        </span>
                    </div>
                    <div className="h-2 bg-gray-800/60 rounded overflow-hidden">
                        <div
                            className={`${dealScore >= 0 ? 'bg-green-500' : 'bg-red-500'} h-full transition-all`}
                            style={{ width: `${dealProgress}%` }}
                        />
                    </div>
                    {dealScore < 0 && (
                        <div className="text-[10px] text-red-300 mt-1">
                            还差约 {Math.abs(dealScore)} 价值
                        </div>
                    )}
                </div>

                {negotiationEvaluation.relationGate && (
                    <div className="bg-orange-900/20 border border-orange-500/30 rounded p-2 flex items-center gap-2 text-xs text-orange-300">
                        <Icon name="AlertTriangle" size={14} />
                        <span>双方关系过低，对方极难接受任何提案。</span>
                    </div>
                )}

                {/* 对方反提案显示 */}
                {negotiationCounter && (
                    <Card className="bg-amber-900/10 border-amber-500/30 bg-[url('/assets/parchment_noise.png')]">
                        <div className="text-sm font-bold text-amber-400 mb-3 flex items-center gap-2 font-decorative">
                            <Icon name="MessageSquare" size={16} />
                            对方提出的反向提案
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-xs text-ancient-parchment">
                            <div className="flex justify-between border-b border-ancient-gold/10 pb-1">
                                <span className="text-ancient-stone">期限:</span>
                                <span className="font-mono font-bold text-white">{negotiationCounter.durationDays} 天</span>
                            </div>
                            <div className="flex justify-between border-b border-ancient-gold/10 pb-1">
                                <span className="text-ancient-stone">每日维护:</span>
                                <span className="font-mono font-bold text-white">{negotiationCounter.maintenancePerDay || 0}</span>
                            </div>
                            <div className="flex justify-between border-b border-ancient-gold/10 pb-1">
                                <span className="text-ancient-stone">签约赠金:</span>
                                <span className="font-mono font-bold text-amber-400">{negotiationCounter.signingGift || 0} 银币</span>
                            </div>
                            <div className="flex justify-between border-b border-ancient-gold/10 pb-1">
                                <span className="text-ancient-stone">资源:</span>
                                {negotiationCounter.resourceKey ? (
                                    <span className="font-mono font-bold text-cyan-400">
                                        {RESOURCES[negotiationCounter.resourceKey]?.name || negotiationCounter.resourceKey} ×{negotiationCounter.resourceAmount || 0}
                                    </span>
                                ) : <span className="text-ancient-stone/50">无</span>}
                            </div>
                            <div className="flex justify-between border-b border-ancient-gold/10 pb-1">
                                <span className="text-ancient-stone">索要银币:</span>
                                <span className="font-mono font-bold text-red-300">{negotiationCounter.demandSilver || 0}</span>
                            </div>
                            <div className="flex justify-between border-b border-ancient-gold/10 pb-1">
                                <span className="text-ancient-stone">索要资源:</span>
                                {negotiationCounter.demandResourceKey ? (
                                    <span className="font-mono font-bold text-red-300">
                                        {RESOURCES[negotiationCounter.demandResourceKey]?.name || negotiationCounter.demandResourceKey} ×{negotiationCounter.demandResourceAmount || 0}
                                    </span>
                                ) : <span className="text-ancient-stone/50">无</span>}
                            </div>
                        </div>
                    </Card>
                )}

                {/* --- 提案编辑区域 --- */}

                {/* 1. 条约类型 */}
                <div className="space-y-2">
                    <label className="text-xs font-bold text-ancient-gold uppercase tracking-wider flex items-center gap-2">
                        <Icon name="FileText" size={14} />
                        拟定条约类型
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {NEGOTIABLE_TREATY_TYPES.map((type) => {
                            const locked = !isDiplomacyUnlocked('treaties', type, epoch);
                            const label = getTreatyLabel(type);
                            const effects = getTreatyEffectDescriptionsByType(type);
                            const isSelected = negotiationDraft.type === type;
                            return (
                                <button
                                    key={type}
                                    type="button"
                                    disabled={locked}
                                    onClick={() => {
                                        if (locked) return;
                                        setNegotiationDraft((prev) => ({ ...prev, type, durationDays: getTreatyDuration(type, epoch) }));
                                    }}
                                    className={`
                                        rounded-lg border p-3 text-left transition-all
                                        ${locked ? 'opacity-50 cursor-not-allowed border-ancient-gold/10 bg-black/20' : 'hover:border-ancient-gold/40'}
                                        ${isSelected ? 'border-ancient-gold/60 bg-ancient-gold/10 shadow-inner' : 'border-ancient-gold/20 bg-ancient-ink/30'}
                                    `}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="text-sm font-semibold text-ancient-parchment">{label}</div>
                                        {locked ? (
                                            <div className="text-[10px] text-ancient-stone">🔒 {getTreatyUnlockEraName(type)}</div>
                                        ) : (
                                            <div className={`text-[10px] ${isSelected ? 'text-ancient-gold' : 'text-ancient-stone'}`}>
                                                {isSelected ? '已选择' : '可提议'}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                        {effects.length > 0 ? effects.map((effect) => (
                                            <span key={effect} className="text-[10px] text-ancient-parchment bg-black/30 border border-ancient-gold/10 px-2 py-0.5 rounded">
                                                {effect}
                                            </span>
                                        )) : (
                                            <span className="text-[10px] text-ancient-stone/70">暂无明确经济效果</span>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* 2. 条约细节设置 */}
                <Card className="p-4 space-y-4 bg-ancient-ink/20">
                    <div className="text-xs font-bold text-ancient-stone uppercase tracking-wider flex items-center gap-2 border-b border-ancient-gold/10 pb-2 mb-2">
                        <Icon name="Settings" size={14} />
                        条约条款设定
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] text-ancient-stone">持续时间 (天)</label>
                            <Input
                                type="number"
                                min="30"
                                value={negotiationDraft.durationDays}
                                onChange={(e) => setNegotiationDraft((prev) => ({ ...prev, durationDays: Number(e.target.value) }))}
                                className="font-mono text-right"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] text-ancient-stone">每日维护费用</label>
                            <Input
                                type="number"
                                min="0"
                                value={negotiationDraft.maintenancePerDay}
                                onChange={(e) => setNegotiationDraft((prev) => ({ ...prev, maintenancePerDay: Number(e.target.value) }))}
                                className="font-mono text-right"
                            />
                        </div>
                    </div>
                </Card>

                {/* 3. 我方筹码 */}
                <Card className="p-4 space-y-4 bg-green-900/5 border-green-800/20">
                    <div className="text-xs font-bold text-green-400/70 uppercase tracking-wider flex items-center gap-2 border-b border-green-800/20 pb-2 mb-2">
                        <Icon name="Gift" size={14} />
                        我方提供筹码
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] text-ancient-stone">一次性签约赠金</label>
                            <Input
                                type="number"
                                min="0"
                                value={negotiationDraft.signingGift}
                                onChange={(e) => setNegotiationDraft((prev) => ({ ...prev, signingGift: Number(e.target.value) }))}
                                className="font-mono text-right text-amber-400"
                                icon={<Icon name="Coins" size={14} className="text-amber-500" />}
                            />
                        </div>
                        <div className="space-y-1 col-span-2">
                            <label className="text-[10px] text-ancient-stone">附赠战略资源</label>
                            <div className="grid grid-cols-[minmax(180px,1fr)_110px] gap-2">
                                <div className="relative min-w-[180px]">
                                    <select
                                        className="w-full h-full bg-ancient-ink/60 border border-ancient-gold/30 rounded px-3 py-2 text-xs text-ancient-parchment outline-none appearance-none"
                                        value={negotiationDraft.resourceKey}
                                        onChange={(e) => setNegotiationDraft((prev) => ({ ...prev, resourceKey: e.target.value }))}
                                    >
                                        <option value="">无</option>
                                        {tradableResources.map(([key, res]) => (
                                            <option key={key} value={key} className="bg-gray-900">{res.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <Input
                                    type="number"
                                    min="0"
                                    placeholder="数量"
                                    className="w-full font-mono text-center"
                                    value={negotiationDraft.resourceAmount}
                                    onChange={(e) => setNegotiationDraft((prev) => ({ ...prev, resourceAmount: Number(e.target.value) }))}
                                />
                            </div>
                            <div className="text-[10px] text-ancient-stone/80">
                                当前选择：{negotiationDraft.resourceKey ? RESOURCES[negotiationDraft.resourceKey]?.name || negotiationDraft.resourceKey : '无'}
                            </div>
                        </div>
                    </div>
                </Card>

                {/* 4. 我方索要筹码 */}
                <Card className="p-4 space-y-4 bg-red-900/5 border-red-800/20">
                    <div className="text-xs font-bold text-red-400/70 uppercase tracking-wider flex items-center gap-2 border-b border-red-800/20 pb-2 mb-2">
                        <Icon name="Hand" size={14} />
                        我方索要筹码
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-[10px] text-ancient-stone">索要银币</label>
                            <Input
                                type="number"
                                min="0"
                                value={negotiationDraft.demandSilver}
                                onChange={(e) => setNegotiationDraft((prev) => ({ ...prev, demandSilver: Number(e.target.value) }))}
                                className="font-mono text-right text-red-300"
                                icon={<Icon name="Coins" size={14} className="text-red-400" />}
                            />
                        </div>
                        <div className="space-y-1 col-span-2">
                            <label className="text-[10px] text-ancient-stone">索要资源</label>
                            <div className="grid grid-cols-[minmax(180px,1fr)_110px] gap-2">
                                <div className="relative min-w-[180px]">
                                    <select
                                        className="w-full h-full bg-ancient-ink/60 border border-ancient-gold/30 rounded px-3 py-2 text-xs text-ancient-parchment outline-none appearance-none"
                                        value={negotiationDraft.demandResourceKey}
                                        onChange={(e) => setNegotiationDraft((prev) => ({ ...prev, demandResourceKey: e.target.value }))}
                                    >
                                        <option value="">无</option>
                                        {tradableResources.map(([key, res]) => (
                                            <option key={key} value={key} className="bg-gray-900">{res.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <Input
                                    type="number"
                                    min="0"
                                    placeholder="数量"
                                    className="w-full font-mono text-center"
                                    value={negotiationDraft.demandResourceAmount}
                                    onChange={(e) => setNegotiationDraft((prev) => ({ ...prev, demandResourceAmount: Number(e.target.value) }))}
                                />
                            </div>
                            <div className="text-[10px] text-ancient-stone/80">
                                当前选择：{negotiationDraft.demandResourceKey ? RESOURCES[negotiationDraft.demandResourceKey]?.name || negotiationDraft.demandResourceKey : '无'}
                            </div>
                        </div>
                    </div>
                </Card>

                {/* 5. 谈判姿态 */}
                <div className="space-y-2 pt-2">
                    <label className="text-xs font-bold text-ancient-gold uppercase tracking-wider flex items-center gap-2">
                        <Icon name="Users" size={14} />
                        谈判姿态选择
                    </label>
                    <div className="flex gap-2 p-1 bg-black/20 rounded-lg">
                        {[
                            { key: 'normal', label: '中立', color: 'text-gray-300', desc: '按常规评估' },
                            { key: 'friendly', label: '友好', color: 'text-green-400', desc: '更易接受' },
                            { key: 'threat', label: '强硬', color: 'text-red-400', desc: '看重实力' }
                        ].map(({ key, label, color, desc }) => (
                            <button
                                key={key}
                                className={`
                                    flex-1 py-2 rounded-md text-xs transition-all flex flex-col items-center gap-1
                                    ${negotiationDraft.stance === key
                                        ? `bg-ancient-gold/20 border border-ancient-gold/50 shadow-inner`
                                        : `hover:bg-white/5 border border-transparent opacity-60 hover:opacity-100`
                                    }
                                `}
                                onClick={() => setNegotiationDraft((prev) => ({ ...prev, stance: key }))}
                                type="button"
                            >
                                <span className={`font-bold ${color}`}>{label}</span>
                                <span className="text-[9px] text-ancient-stone">{desc}</span>
                            </button>
                        ))}
                    </div>
                    <div className="text-[10px] text-ancient-stone/80 flex flex-wrap gap-3">
                        <span>友好：交易差额 +120，成功更稳</span>
                        <span>强硬：按军力差加分，失败关系-20</span>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default NegotiationDialog;
