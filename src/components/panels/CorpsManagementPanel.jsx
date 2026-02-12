/**
 * CorpsManagementPanel - Military Corps & Generals management UI
 * Shows corps list, general assignment, unit allocation
 */
import React, { useState, useMemo, memo } from 'react';
import { Icon } from '../common/UIComponents';
import { UNIT_TYPES, RESOURCES, UNIT_CATEGORIES } from '../../config';
import {
    createCorps,
    assignUnitsToCorps,
    removeUnitsFromCorps,
    disbandCorps,
    generateGeneral,
    assignGeneralToCorps,
    removeGeneralFromCorps,
    getCorpsTotalUnits,
    calculateCorpsCombatPower,
    getCorpsGeneral,
    getTraitDetails,
    getGeneralBonuses,
    MAX_CORPS_PER_PLAYER,
    createGeneralFromOfficial,
} from '../../logic/diplomacy/corpsSystem';
import { formatNumberShortCN } from '../../utils/numberFormat';

const CorpsManagementPanel = ({
    army = {},
    militaryCorps = [],
    generals = [],
    officials = [],
    activeFronts = [],
    epoch = 0,
    onUpdateCorps,
    onUpdateGenerals,
    onUpdateArmy,
}) => {
    const [selectedCorpsId, setSelectedCorpsId] = useState(null);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newCorpsName, setNewCorpsName] = useState('');
    const [assignMode, setAssignMode] = useState(null); // null | 'assign' | 'remove'
    const [assignAmounts, setAssignAmounts] = useState({});
    const [showOfficialPicker, setShowOfficialPicker] = useState(false);

    const selectedCorps = useMemo(() =>
        militaryCorps.find(c => c.id === selectedCorpsId),
        [militaryCorps, selectedCorpsId]
    );

    // Player-only corps and generals (filter out AI entities)
    const playerCorps = useMemo(() => militaryCorps.filter(c => !c.isAI), [militaryCorps]);
    const playerGenerals = useMemo(() => generals.filter(g => !g.id?.startsWith('ai_gen_') && !g.isAI), [generals]);

    // Unassigned army (units not in any player corps)
    const unassignedArmy = useMemo(() => {
        const result = { ...army };
        for (const corps of playerCorps) {
            for (const [unitId, count] of Object.entries(corps.units || {})) {
                if (result[unitId]) {
                    result[unitId] = Math.max(0, result[unitId] - count);
                    if (result[unitId] <= 0) delete result[unitId];
                }
            }
        }
        return result;
    }, [army, playerCorps]);

    const totalUnassigned = Object.values(unassignedArmy).reduce((s, c) => s + c, 0);

    // ========== Handlers ==========

    const handleCreateCorps = () => {
        if (playerCorps.length >= MAX_CORPS_PER_PLAYER) return;
        const name = newCorpsName.trim() || `Corps ${playerCorps.length + 1}`;
        const newCorps = createCorps(name);
        onUpdateCorps([...militaryCorps, newCorps]);
        setSelectedCorpsId(newCorps.id);
        setShowCreateModal(false);
        setNewCorpsName('');
    };

    const handleDisbandCorps = (corpsId) => {
        const corps = militaryCorps.find(c => c.id === corpsId);
        if (!corps) return;
        // Prevent disbanding corps in combat or deployed to front
        if (corps.status === 'in_combat') {
            alert('该军团正在战斗中，无法解散，请等待战斗结束。');
            return;
        }
        const assignedActiveFront = activeFronts.find(f => f?.status === 'active' && f.id === corps.assignedFrontId);
        if (assignedActiveFront) {
            alert('该军团已部署到战线，请先从战线撤回后再解散。');
            return;
        }
        const updatedArmy = disbandCorps(corps, army);
        const updatedCorps = militaryCorps.filter(c => c.id !== corpsId);
        // Unassign general
        const updatedGenerals = generals.map(g =>
            g.assignedCorpsId === corpsId ? { ...g, assignedCorpsId: null } : g
        );
        onUpdateArmy(updatedArmy);
        onUpdateCorps(updatedCorps);
        onUpdateGenerals(updatedGenerals);
        if (selectedCorpsId === corpsId) setSelectedCorpsId(null);
    };

    const handleAssignUnits = () => {
        if (!selectedCorps) return;
        const { corps: updatedCorps, army: updatedArmy } = assignUnitsToCorps(selectedCorps, army, assignAmounts);
        const updatedList = militaryCorps.map(c => c.id === updatedCorps.id ? updatedCorps : c);
        onUpdateCorps(updatedList);
        onUpdateArmy(updatedArmy);
        setAssignAmounts({});
        setAssignMode(null);
    };

    const handleRemoveUnits = () => {
        if (!selectedCorps) return;
        const { corps: updatedCorps, army: updatedArmy } = removeUnitsFromCorps(selectedCorps, army, assignAmounts);
        const updatedList = militaryCorps.map(c => c.id === updatedCorps.id ? updatedCorps : c);
        onUpdateCorps(updatedList);
        onUpdateArmy(updatedArmy);
        setAssignAmounts({});
        setAssignMode(null);
    };

    const handleRecruitGeneral = () => {
        setShowOfficialPicker(true);
    };

    const handleSelectOfficialAsGeneral = (official) => {
        const newGen = createGeneralFromOfficial(official, epoch);
        if (newGen) {
            onUpdateGenerals([...generals, newGen]);
        }
        setShowOfficialPicker(false);
    };

    const handleAssignGeneral = (generalId, corpsId) => {
        const updated = assignGeneralToCorps(generals, generalId, corpsId);
        const updatedCorps = militaryCorps.map(c => {
            if (c.id === corpsId) return { ...c, generalId };
            // Remove general from old corps
            const oldGeneral = generals.find(g => g.id === generalId);
            if (oldGeneral?.assignedCorpsId === c.id) return { ...c, generalId: null };
            return c;
        });
        onUpdateGenerals(updated);
        onUpdateCorps(updatedCorps);
    };

    const handleUnassignGeneral = (generalId) => {
        const updated = removeGeneralFromCorps(generals, generalId);
        const gen = generals.find(g => g.id === generalId);
        if (gen?.assignedCorpsId) {
            const updatedCorps = militaryCorps.map(c =>
                c.id === gen.assignedCorpsId ? { ...c, generalId: null } : c
            );
            onUpdateCorps(updatedCorps);
        }
        onUpdateGenerals(updated);
    };

    // ========== Render ==========

    return (
        <div className="space-y-3">
            {/* Header */}
            <div className="glass-ancient p-3 rounded-lg border border-ancient-gold/30">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-bold flex items-center gap-2 text-gray-300 font-decorative">
                        <Icon name="Shield" size={16} className="text-ancient-gold" />
                        鍐涘洟绠＄悊
                    </h3>
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">
                            {playerCorps.length}/{MAX_CORPS_PER_PLAYER} 鍐涘洟
                        </span>
                        <button
                            className="px-2 py-1 text-xs bg-ancient-gold/20 border border-ancient-gold/40 rounded hover:bg-ancient-gold/30 text-ancient-parchment disabled:opacity-50"
                            onClick={() => setShowCreateModal(true)}
                            disabled={playerCorps.length >= MAX_CORPS_PER_PLAYER}
                        >
                            + 鍒涘缓鍐涘洟
                        </button>
                    </div>
                </div>

                {/* Unassigned pool info */}
                <div className="text-xs text-gray-400 bg-gray-900/30 rounded px-2 py-1">
                    鏈紪鍏ュ啗鍥? <span className="text-ancient-parchment">{totalUnassigned}</span> 鍗曚綅
                </div>
            </div>

            {/* Corps List */}
            {playerCorps.length === 0 ? (
                <div className="glass-ancient p-4 rounded-lg border border-ancient-gold/20 text-center text-sm text-gray-400">
                    <Icon name="Shield" size={32} className="mx-auto mb-2 text-gray-600" />
                    <p>灏氭湭鍒涘缓浠讳綍鍐涘洟</p>
                    <p className="text-xs mt-1">鍐涘洟鐢ㄤ簬缁勭粐閮ㄩ槦骞堕儴缃插埌鎴樼嚎</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {playerCorps.map(corps => {
                        const general = getCorpsGeneral(generals, corps.id);
                        const unitCount = getCorpsTotalUnits(corps);
                        const isSelected = corps.id === selectedCorpsId;
                        const front = activeFronts.find(f =>
                            f?.status === 'active' && (
                                f.assignedCorps?.attacker?.includes(corps.id) ||
                                f.assignedCorps?.defender?.includes(corps.id)
                            )
                        );

                        return (
                            <div
                                key={corps.id}
                                className={`glass-ancient p-3 rounded-lg border cursor-pointer transition-all ${isSelected
                                    ? 'border-ancient-gold/60 bg-ancient-gold/10'
                                    : 'border-ancient-gold/20 hover:border-ancient-gold/40'}`}
                                onClick={() => setSelectedCorpsId(isSelected ? null : corps.id)}
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <Icon name="Shield" size={14} className="text-ancient-gold" />
                                        <span className="text-sm font-bold text-ancient-parchment">{corps.name}</span>
                                        <span className="text-xs text-gray-400">({unitCount} 鍗曚綅)</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {front && (
                                            <span className="text-xs px-1.5 py-0.5 bg-red-900/40 border border-red-500/30 rounded text-red-300">
                                                宸查儴缃?                                            </span>
                                        )}
                                        {corps.status === 'in_combat' && (
                                            <span className="text-xs px-1.5 py-0.5 bg-orange-900/40 border border-orange-500/30 rounded text-orange-300 animate-pulse">
                                                鎴樻枟涓?                                            </span>
                                        )}
                                        <span className="text-xs text-gray-500">
                                            澹皵: <span className={corps.morale > 70 ? 'text-green-400' : corps.morale > 40 ? 'text-yellow-400' : 'text-red-400'}>{Math.round(corps.morale)}</span>
                                        </span>
                                    </div>
                                </div>

                                {/* General info */}
                                <div className="mt-1 text-xs text-gray-400">
                                    {general ? (
                                        <span className="flex items-center gap-1">
                                            <Icon name="Star" size={10} className="text-yellow-400" />
                                            灏嗛: <span className="text-ancient-parchment">{general.name}</span>
                                            <span className="text-gray-500">(Lv.{general.level})</span>
                                            {general.traits?.map(t => {
                                                const detail = getTraitDetails([t])[0];
                                                return detail ? (
                                                    <span key={t} className="px-1 py-0.5 bg-gray-800 rounded text-gray-300" title={detail.desc}>
                                                        {detail.name}
                                                    </span>
                                                ) : null;
                                            })}
                                        </span>
                                    ) : (
                                        <span className="text-gray-500 italic">鏃犲皢棰?(-15%鎴樺姏)</span>
                                    )}
                                </div>

                                {/* Unit composition (brief) */}
                                {unitCount > 0 && (
                                    <div className="mt-1 flex flex-wrap gap-1">
                                        {Object.entries(corps.units).map(([uid, count]) => (
                                            <span key={uid} className="text-[10px] px-1.5 py-0.5 bg-gray-800/60 rounded text-gray-300">
                                                {UNIT_TYPES[uid]?.name || uid} 脳{count}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                {/* Expanded details */}
                                {isSelected && (
                                    <div className="mt-3 pt-3 border-t border-gray-700 space-y-2">
                                        {/* Actions */}
                                        <div className="flex gap-2">
                                            <button
                                                className="px-2 py-1 text-xs bg-blue-900/30 border border-blue-500/30 rounded hover:bg-blue-900/50 text-blue-300"
                                                onClick={(e) => { e.stopPropagation(); setAssignMode('assign'); setAssignAmounts({}); }}
                                            >
                                                缂栧叆鍏靛姏
                                            </button>
                                            <button
                                                className="px-2 py-1 text-xs bg-yellow-900/30 border border-yellow-500/30 rounded hover:bg-yellow-900/50 text-yellow-300"
                                                onClick={(e) => { e.stopPropagation(); setAssignMode('remove'); setAssignAmounts({}); }}
                                            >
                                                鎾ゅ嚭鍏靛姏
                                            </button>
                                            <button
                                                className="px-2 py-1 text-xs bg-red-900/30 border border-red-500/30 rounded hover:bg-red-900/50 text-red-300"
                                                onClick={(e) => { e.stopPropagation(); handleDisbandCorps(corps.id); }}
                                            >
                                                瑙ｆ暎鍐涘洟
                                            </button>
                                        </div>

                                        {/* Unit assignment interface */}
                                        {assignMode && (
                                            <div className="bg-gray-900/50 rounded p-2 space-y-2">
                                                <p className="text-xs text-gray-400">
                                                    {assignMode === 'assign' ? '閫夋嫨瑕佺紪鍏ョ殑鍏靛姏:' : '閫夋嫨瑕佹挙鍑虹殑鍏靛姏:'}
                                                </p>
                                                <div className="space-y-1 max-h-40 overflow-y-auto">
                                                    {Object.entries(assignMode === 'assign' ? unassignedArmy : (corps.units || {}))
                                                        .filter(([, count]) => count > 0)
                                                        .map(([uid, available]) => (
                                                            <div key={uid} className="flex items-center justify-between text-xs">
                                                                <span className="text-gray-300">{UNIT_TYPES[uid]?.name || uid} (鍙敤: {available})</span>
                                                                <input
                                                                    type="number"
                                                                    min={0}
                                                                    max={available}
                                                                    value={assignAmounts[uid] || 0}
                                                                    onChange={(e) => setAssignAmounts(prev => ({ ...prev, [uid]: Math.min(available, Math.max(0, parseInt(e.target.value) || 0)) }))}
                                                                    className="w-16 bg-gray-800 border border-gray-600 rounded px-1 py-0.5 text-center text-white"
                                                                    onClick={(e) => e.stopPropagation()}
                                                                />
                                                            </div>
                                                        ))}
                                                </div>
                                                <div className="flex gap-2">
                                                    <button
                                                        className="px-2 py-1 text-xs bg-green-900/30 border border-green-500/30 rounded hover:bg-green-900/50 text-green-300"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            assignMode === 'assign' ? handleAssignUnits() : handleRemoveUnits();
                                                        }}
                                                    >
                                                        纭
                                                    </button>
                                                    <button
                                                        className="px-2 py-1 text-xs bg-gray-700 border border-gray-600 rounded hover:bg-gray-600 text-gray-300"
                                                        onClick={(e) => { e.stopPropagation(); setAssignMode(null); }}
                                                    >
                                                        鍙栨秷
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {/* General assignment */}
                                        <div className="bg-gray-900/50 rounded p-2">
                                            <p className="text-xs text-gray-400 mb-1">灏嗛绠＄悊:</p>
                                            {general ? (
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs text-ancient-parchment">{general.name} (Lv.{general.level})</span>
                                                    <button
                                                        className="px-2 py-0.5 text-[10px] bg-gray-700 border border-gray-600 rounded text-gray-300"
                                                        onClick={(e) => { e.stopPropagation(); handleUnassignGeneral(general.id); }}
                                                    >
                                                        鍗镐换
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="space-y-1">
                                    {playerGenerals.filter(g => !g.assignedCorpsId).map(g => (
                                        <div key={g.id} className="flex items-center justify-between text-xs">
                                            <span className="text-gray-300">{g.name} (Lv.{g.level})</span>
                                            <button
                                                className="px-2 py-0.5 text-[10px] bg-ancient-gold/20 border border-ancient-gold/30 rounded text-ancient-parchment"
                                                onClick={(e) => { e.stopPropagation(); handleAssignGeneral(g.id, corps.id); }}
                                            >
                                                鎸囨淳
                                            </button>
                                        </div>
                                    ))}
                                    {playerGenerals.filter(g => !g.assignedCorpsId).length === 0 && (
                                        <span className="text-[10px] text-gray-500">无可用将领</span>
                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Generals section */}
            <div className="glass-ancient p-3 rounded-lg border border-ancient-gold/30">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-bold flex items-center gap-2 text-gray-300 font-decorative">
                        <Icon name="Star" size={16} className="text-yellow-400" />
                        灏嗛
                    </h3>
                    <button
                        className="px-2 py-1 text-xs bg-ancient-gold/20 border border-ancient-gold/40 rounded hover:bg-ancient-gold/30 text-ancient-parchment"
                        onClick={handleRecruitGeneral}
                    >
                        浠庡畼鍛樹腑閫夋嫈
                    </button>
                </div>
                {/* Official picker for selecting general from officials */}
                {showOfficialPicker && (
                    <div className="bg-gray-900/50 rounded p-2 mb-2 border border-ancient-gold/20">
                        <div className="flex items-center justify-between mb-1">
                            <p className="text-xs text-gray-400">閫夋嫨涓€浣嶅畼鍛樻媴浠诲皢棰?</p>
                            <button
                                className="text-[10px] text-gray-500 hover:text-gray-300"
                                onClick={() => setShowOfficialPicker(false)}
                            >
                                鍙栨秷
                            </button>
                        </div>
                        {(() => {
                            const seen = new Set();
                            const availableOfficials = (officials || []).filter(o => {
                                if (!o || !o.id) return false;
                                if (seen.has(o.id)) return false; // Deduplicate by id
                                seen.add(o.id);
                                return !generals.some(g => g.officialId === o.id);
                            });
                            if (availableOfficials.length === 0) {
                                return (
                                    <p className="text-[10px] text-yellow-400 text-center py-2">
                                        鏃犲悎閫傚畼鍛樺彲鎷呬换灏嗛銆傚缓璁湪琛屾斂闈㈡澘褰曠敤鍏锋湁鍐涗簨鎵嶈兘鐨勫畼鍛樸€?                                    </p>
                                );
                            }
                            return (
                                <div className="space-y-1 max-h-48 overflow-y-auto">
                                    {availableOfficials.map(o => {
                                        const milStat = o.stats?.military || o.military || 30;
                                        const milBonus = o.effects?.militaryBonus || 0;
                                        return (
                                            <div key={o.id} className="flex items-center justify-between bg-gray-800/50 rounded px-2 py-1">
                                                <div className="flex items-center gap-2 text-xs">
                                                    <span className="text-ancient-parchment font-bold">{o.name}</span>
                                                    <span className="text-[10px] text-gray-500">
                                                        {o.sourceStratum || '鏈煡'}鍑鸿韩
                                                    </span>
                                                    <span className="text-[10px] text-blue-300" title="军事属性">
                                                        军{milStat}
                                                    </span>
                                                    {milBonus > 0 && (
                                                        <span className="text-[10px] text-green-400">
                                                            鍐涗簨+{(milBonus * 100).toFixed(0)}%
                                                        </span>
                                                    )}
                                                </div>
                                                <button
                                                    className="px-2 py-0.5 text-[10px] bg-ancient-gold/20 border border-ancient-gold/30 rounded text-ancient-parchment hover:bg-ancient-gold/30"
                                                    onClick={() => handleSelectOfficialAsGeneral(o)}
                                                >
                                                    閫夋嫈
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })()}
                    </div>
                )}
                {playerGenerals.length === 0 ? (
                    <p className="text-xs text-gray-500 text-center py-2">尚无将领，点击“从官员中选拔”</p>
                ) : (
                    <div className="space-y-1">
                        {playerGenerals.map(gen => {
                            const traits = getTraitDetails(gen.traits);
                            const bonuses = getGeneralBonuses(gen);
                            const assignedCorps = militaryCorps.find(c => c.id === gen.assignedCorpsId);
                            return (
                                <div key={gen.id} className="flex items-center justify-between bg-gray-900/30 rounded px-2 py-1.5">
                                    <div className="flex items-center gap-2">
                                        <Icon name="Star" size={12} className="text-yellow-400" />
                                        <span className="text-xs text-ancient-parchment font-bold">{gen.name}</span>
                                        <span className="text-[10px] text-gray-400">Lv.{gen.level}</span>
                                        {traits.map(t => (
                                            <span key={t.id} className="text-[10px] px-1 py-0.5 bg-gray-800 rounded text-gray-300" title={t.desc}>
                                                {t.name}
                                            </span>
                                        ))}
                                    </div>
                                    <div className="text-[10px] text-gray-500">
                                        {assignedCorps ? `鎸囨淳: ${assignedCorps.name}` : '寰呭懡'}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Create Corps Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowCreateModal(false)}>
                    <div className="bg-gray-800 border border-ancient-gold/40 rounded-lg p-4 w-72" onClick={e => e.stopPropagation()}>
                        <h4 className="text-sm font-bold text-ancient-parchment mb-3">鍒涘缓鍐涘洟</h4>
                        <input
                            type="text"
                            value={newCorpsName}
                            onChange={e => setNewCorpsName(e.target.value)}
                            placeholder={`Corps ${playerCorps.length + 1}`}
                            className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 text-sm text-white mb-3"
                            autoFocus
                            onKeyDown={e => { if (e.key === 'Enter') handleCreateCorps(); }}
                        />
                        <div className="flex gap-2 justify-end">
                            <button
                                className="px-3 py-1 text-xs bg-gray-700 border border-gray-600 rounded text-gray-300"
                                onClick={() => setShowCreateModal(false)}
                            >
                                鍙栨秷
                            </button>
                            <button
                                className="px-3 py-1 text-xs bg-ancient-gold/20 border border-ancient-gold/40 rounded text-ancient-parchment"
                                onClick={handleCreateCorps}
                            >
                                鍒涘缓
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default memo(CorpsManagementPanel);
