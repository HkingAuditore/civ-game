import React, { useState } from 'react';
import { MINISTRIES, getMinistryName } from '../../../config/ministries';
import * as Icons from 'lucide-react';

const MinisterSlot = ({ ministry, official, onAssign, onRemove, allOfficials, epoch }) => {
    const Icon = Icons[ministry.icon] || Icons.HelpCircle;
    const [isSelecting, setIsSelecting] = useState(false);
    const displayName = getMinistryName(ministry.id, epoch);

    // 筛选符合条件的官员
    const candidates = allOfficials;

    // Helper to translate attribute names (optional, map to CN if needed)
    const formatAttr = (attr) => {
        const map = {
            administrative: '行政',
            military: '军事',
            diplomacy: '外交',
            prestige: '威望',
        };
        return map[attr] || attr;
    };

    return (
        <div className="bg-gray-800 p-3 rounded-lg border border-gray-700 flex flex-col gap-2 relative">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Icon className={`w-5 h-5 ${ministry.color}`} />
                    <span className="font-bold text-gray-200">{displayName}</span>
                </div>
                {official && (
                    <button
                        onClick={() => onRemove(ministry.id)}
                        className="text-xs text-red-400 hover:text-red-300 px-2 py-1 bg-red-900/20 rounded hover:bg-red-900/40 transition-colors"
                    >
                        罢免
                    </button>
                )}
            </div>

            <p className="text-xs text-gray-400 h-8 line-clamp-2">{ministry.effectDescription}</p>

            {official ? (
                <div className="flex items-center gap-2 mt-1 bg-gray-900/50 p-2 rounded border border-gray-700/50">
                    <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-xl shadow-inner">
                        {official.avatar || '👤'}
                    </div>
                    <div>
                        <div className="text-sm font-bold text-white">{official.name}</div>
                        <div className="text-xs text-gray-400 flex gap-2">
                            {ministry.allowedAttributes.map(attr =>
                                <span key={attr} className="bg-gray-800 px-1 rounded text-gray-300">
                                    {formatAttr(attr)} {official[attr] || 0}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <button
                    onClick={() => setIsSelecting(true)}
                    className="mt-1 py-3 bg-gray-700/50 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded border border-dashed border-gray-600 hover:border-gray-500 transition-all flex items-center justify-center gap-2 group"
                >
                    <Icons.Plus className="w-4 h-4 text-gray-500 group-hover:text-gray-300" />
                    <span>任命{displayName}</span>
                </button>
            )}

            {isSelecting && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4" onClick={() => setIsSelecting(false)}>
                    <div className="bg-gray-800 w-full max-w-md rounded-xl border border-gray-700 shadow-2xl flex flex-col max-h-[80vh] animate-in fade-in zoom-in duration-200" onClick={e => e.stopPropagation()}>
                        <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-900/50">
                            <div className="flex items-center gap-2">
                                <Icon className={`w-5 h-5 ${ministry.color}`} />
                                <h3 className="font-bold text-white">任命{displayName}</h3>
                            </div>
                            <button onClick={() => setIsSelecting(false)} className="text-gray-400 hover:text-white p-1 rounded hover:bg-gray-700"><Icons.X className="w-5 h-5"/></button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-1">
                            {candidates.length === 0 ? (
                                <div className="text-center text-gray-500 py-12 flex flex-col items-center gap-2">
                                    <Icons.Users className="w-8 h-8 opacity-20" />
                                    <span>暂无可用官员，请先去人才市场招募</span>
                                </div>
                            ) : (
                                candidates.map(cand => {
                                    // Calculate 'suitability' score for sorting/highlighting?
                                    const score = ministry.allowedAttributes.reduce((acc, attr) => acc + (cand[attr] || 0), 0);

                                    return (
                                        <button
                                            key={cand.id}
                                            onClick={() => {
                                                onAssign(ministry.id, cand.id);
                                                setIsSelecting(false);
                                            }}
                                            className="w-full flex items-center gap-3 p-3 hover:bg-gray-700 rounded-lg transition-colors text-left group border border-transparent hover:border-gray-600"
                                        >
                                            <div className="w-10 h-10 rounded-full bg-gray-600 flex items-center justify-center text-xl shadow-sm group-hover:scale-105 transition-transform">
                                                {cand.avatar || '👤'}
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex justify-between items-center">
                                                    <div className="text-sm font-bold text-gray-200">{cand.name}</div>
                                                    <div className="text-xs font-bold text-emerald-400 bg-emerald-900/30 px-2 py-0.5 rounded">
                                                        评分: {score}
                                                    </div>
                                                </div>
                                                <div className="text-xs text-gray-400 mt-1 flex gap-2">
                                                    {ministry.allowedAttributes.map(attr =>
                                                        <span key={attr} className="bg-gray-900/50 px-1.5 py-0.5 rounded">
                                                            {formatAttr(attr)} <span className="text-gray-200">{cand[attr] || 0}</span>
                                                        </span>
                                                    ).join(' ')}
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export const MinistersPanel = ({ officials, ministries, onAssign, onRemove, epoch }) => {
    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {Object.values(MINISTRIES).map(ministry => {
                    const officialId = ministries[ministry.id];
                    const official = officials.find(o => o.id === officialId);
                    return (
                        <MinisterSlot
                            key={ministry.id}
                            ministry={ministry}
                            official={official}
                            onAssign={onAssign}
                            onRemove={onRemove}
                            allOfficials={officials}
                            epoch={epoch}
                        />
                    );
                })}
            </div>

            <div className="bg-blue-900/20 border border-blue-800/30 rounded p-3 text-xs text-blue-300 flex items-start gap-2">
                <Icons.Info className="w-4 h-4 mt-0.5 shrink-0" />
                <p>
                    任命大臣可以获得全局属性加成。负责经济的部门还会根据需求自动使用国库资金扩建相关建筑。
                    <br/>
                    大臣的能力值越高，加成效果越强，自动建设的判断也越精准。
                </p>
            </div>
        </div>
    );
};
