// 宣战确认模态框组件
// 显示目标国家的同盟信息并请求确认

import React from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '../common/UIComponents';

/**
 * 宣战确认模态框
 * @param {Object} targetNation - 目标国家
 * @param {Array} militaryOrgs - 目标国家的军事组织列表，每个组织包含name和members数组
 * @param {Function} onConfirm - 确认宣战回调
 * @param {Function} onCancel - 取消回调
 */
export const DeclareWarModal = ({ targetNation, militaryOrgs = [], onConfirm, onCancel }) => {
    if (!targetNation) return null;

    const hasAllies = militaryOrgs.length > 0;
    const totalAlliesCount = militaryOrgs.reduce((sum, org) => sum + (org.members?.length || 0), 0);

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            {/* 遮罩层 */}
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel}></div>

            {/* 内容面板 */}
            <div className="relative w-full max-w-md glass-monument border-2 border-red-500/40 rounded-2xl shadow-monument overflow-hidden animate-slide-up">
                <div className="absolute inset-0 bg-gradient-to-br from-red-900/30 via-ancient-ink/70 to-red-900/20 opacity-80" />

                <div className="relative z-10">
                    {/* 头部 */}
                    <div className="p-4 border-b border-red-500/30 bg-gradient-to-r from-red-900/40 to-ancient-ink/60">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-red-900/60 border border-red-500/30 flex items-center justify-center flex-shrink-0 shadow-inner">
                                <Icon name="Swords" size={26} className="text-red-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <h2 className="text-lg font-bold text-red-200 leading-tight">
                                    宣战确认
                                </h2>
                                <p className="text-[11px] text-gray-300 leading-tight">
                                    向 {targetNation.name} 宣战
                                </p>
                            </div>
                            <button
                                onClick={onCancel}
                                className="p-2 rounded-full hover:bg-white/10 transition-colors text-gray-400"
                            >
                                <Icon name="X" size={18} />
                            </button>
                        </div>
                    </div>

                    {/* 内容 */}
                    <div className="p-4 space-y-4">
                        {/* 目标国家信息 */}
                        <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-600/50">
                            <div className="flex items-center gap-2 mb-2">
                                <Icon name="Flag" size={14} className={targetNation.color || 'text-gray-300'} />
                                <span className="text-sm font-bold text-white">{targetNation.name}</span>
                                <span className="px-1.5 py-0.5 text-[9px] rounded bg-gray-700 text-gray-300">
                                    关系: {Math.round(targetNation.relation) || 0}
                                </span>
                            </div>
                            {targetNation.desc && (
                                <p className="text-[10px] text-gray-400 leading-relaxed">{targetNation.desc}</p>
                            )}
                        </div>

                        {/* 军事组织警告 */}
                        {hasAllies && (
                            <div className="p-3 bg-orange-900/30 rounded-lg border border-orange-500/40">
                                <div className="flex items-center gap-2 mb-2">
                                    <Icon name="AlertTriangle" size={16} className="text-orange-400" />
                                    <span className="text-sm font-bold text-orange-200">军事组织警告</span>
                                </div>
                                <p className="text-[11px] text-orange-100 mb-3 leading-relaxed">
                                    {targetNation.name} 拥有 <span className="font-bold text-orange-300">{militaryOrgs.length}</span> 个军事组织盟友。
                                    向其宣战将同时与这些国家进入战争状态！
                                </p>
                                <div className="space-y-2">
                                    {militaryOrgs.map(org => (
                                        <div key={org.id} className="space-y-1">
                                            {/* 军事组织名称 */}
                                            <div className="flex items-center gap-2 px-2 py-1.5 bg-orange-900/50 rounded border border-orange-600/40">
                                                <Icon name="Flag" size={12} className="text-orange-300" />
                                                <span className="text-xs font-bold text-orange-200">{org.name}</span>
                                                <span className="ml-auto text-[10px] text-orange-300">
                                                    成员: {org.members?.length || 0}
                                                </span>
                                            </div>
                                            {/* 组织成员列表 */}
                                            <div className="ml-4 space-y-1">
                                                {org.members?.map(member => (
                                                    <div
                                                        key={member.id}
                                                        className="flex items-center justify-between p-1.5 bg-orange-900/30 rounded border border-orange-600/20"
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <Icon name="Flag" size={10} className={member.color || 'text-orange-300'} />
                                                            <span className="text-[11px] text-orange-100">{member.name}</span>
                                                        </div>
                                                        <span className="text-[9px] text-orange-300">
                                                            军事组织成员
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 无盟友情况 */}
                        {!hasAllies && (
                            <div className="p-3 bg-gray-800/40 rounded-lg border border-gray-600/30">
                                <div className="flex items-center gap-2">
                                    <Icon name="Info" size={14} className="text-blue-400" />
                                    <span className="text-xs text-gray-300">
                                        {targetNation.name} 当前没有军事组织盟友，只需对抗一个敌人。
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* 警告提示 */}
                        <div className="p-2 bg-red-900/20 rounded border border-red-600/30">
                            <p className="text-[10px] text-red-200 text-center">
                                ⚠️ 战争将持续到一方求和为止，请确保有足够的军事力量！
                            </p>
                        </div>
                    </div>

                    {/* 底部按钮 */}
                    <div className="p-4 border-t border-gray-700/50 bg-gray-900/50 flex gap-3">
                        <button
                            onClick={onCancel}
                            className="flex-1 px-4 py-2.5 bg-gray-600 hover:bg-gray-500 text-white rounded-lg text-sm font-bold transition-colors"
                        >
                            取消
                        </button>
                        <button
                            onClick={onConfirm}
                            className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-bold transition-colors flex items-center justify-center gap-2"
                        >
                            <Icon name="Swords" size={14} />
                            {hasAllies ? `宣战 (${totalAlliesCount + 1}国)` : '确认宣战'}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default DeclareWarModal;
