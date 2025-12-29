
import React, { useMemo } from 'react';
import { OfficialCard } from './OfficialCard';
import { Icon } from '../../common/UIComponents';
import { calculateTotalDailySalary } from '../../../logic/officials/manager';

export const OfficialsPanel = ({
    officials = [],
    candidates = [],
    capacity = 0,
    lastSelectionDay = 0,
    currentTick = 0,
    resources,
    onTriggerSelection,
    onHire,
    onFire,
    selectionCooldown = 180
}) => {

    // Derived state
    const currentCount = officials.length;
    const isAtCapacity = currentCount >= capacity;
    const daysSinceSelection = currentTick - lastSelectionDay;
    const selectionReady = lastSelectionDay === 0 || daysSinceSelection >= selectionCooldown;
    const daysRemaining = Math.max(0, selectionCooldown - daysSinceSelection);

    const totalDailySalary = useMemo(() => calculateTotalDailySalary(officials), [officials]);
    const canAffordSalaries = (resources?.silver || 0) >= totalDailySalary;

    return (
        <div className="space-y-6 p-2">

            {/* 1. Overview Section */}
            <div className="bg-gray-900/60 rounded-xl p-4 border border-gray-700/50 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 p-3 opacity-10 pointer-events-none">
                    <Icon name="Landmark" size={80} className="text-purple-400" />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 relative z-10">
                    <div>
                        <h3 className="text-lg font-bold text-gray-100 flex items-center gap-2">
                            <Icon name="Users" className="text-purple-400" />
                            Official Management
                        </h3>
                        <p className="text-xs text-gray-400 mt-1 max-w-md">
                            Appoint officials to manage various aspects of your nation. High-ranking officials provide significant bonuses but require daily salaries.
                        </p>
                    </div>

                    <div className="flex items-center gap-4 bg-gray-800/50 p-2 rounded-lg border border-gray-700/30">
                        <div className="text-center px-2">
                            <div className="text-[10px] text-gray-500 uppercase tracking-wider">Capacity</div>
                            <div className={`text-xl font-mono font-bold ${isAtCapacity ? 'text-yellow-400' : 'text-gray-200'}`}>
                                {currentCount} <span className="text-gray-500 text-sm">/ {capacity}</span>
                            </div>
                        </div>
                        <div className="w-px h-8 bg-gray-700/50"></div>
                        <div className="text-center px-2">
                            <div className="text-[10px] text-gray-500 uppercase tracking-wider">Daily Cost</div>
                            <div className={`text-xl font-mono font-bold flex items-center gap-1 ${canAffordSalaries ? 'text-gray-200' : 'text-red-400'}`}>
                                {totalDailySalary} <Icon name="Coins" size={14} className="text-yellow-500" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. Selection Area */}
            <div className="flex items-center justify-between bg-gray-800/30 p-3 rounded-lg border border-gray-700/30">
                <div className="flex items-center gap-3">
                    <div className="bg-purple-900/20 p-2 rounded-lg text-purple-400">
                        <Icon name="Scroll" size={24} />
                    </div>
                    <div>
                        <h4 className="font-bold text-gray-200 text-sm">Candidate Selection</h4>
                        <p className="text-xs text-gray-500">
                            {selectionReady
                                ? "New candidates can be summoned."
                                : `Next selection available in ${daysRemaining} days.`
                            }
                        </p>
                    </div>
                </div>
                <button
                    onClick={onTriggerSelection}
                    disabled={!selectionReady}
                    className={`
                        px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-all shadow-lg
                        ${selectionReady
                            ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-900/20 hover:scale-105 active:scale-95'
                            : 'bg-gray-700 text-gray-400 cursor-not-allowed opacity-70'}
                    `}
                >
                    <Icon name="RefreshCw" size={14} className={selectionReady ? '' : 'animate-none'} />
                    {selectionReady ? 'Summon Candidates' : 'On Cooldown'}
                </button>
            </div>

            {/* 3. Candidates Grid */}
            {candidates.length > 0 && (
                <div>
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 display-inline-block"></span>
                        Available Candidates
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                        {candidates.map(candidate => (
                            <OfficialCard
                                key={candidate.id}
                                official={candidate}
                                isCandidate={true}
                                onAction={onHire}
                                canAfford={(resources?.silver || 0) >= candidate.salary}
                                actionDisabled={isAtCapacity}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* 4. Active Officials Grid */}
            <div>
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400 display-inline-block"></span>
                    Employed Officials
                </h4>
                {officials.length === 0 ? (
                    <div className="text-center py-10 bg-gray-800/20 rounded-lg border border-dashed border-gray-700 text-gray-500">
                        <Icon name="UserX" size={32} className="mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No officials currently employed.</p>
                        <p className="text-xs opacity-70">Hire candidates to gain bonuses.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                        {officials.map(official => (
                            <OfficialCard
                                key={official.id}
                                official={official}
                                isCandidate={false}
                                onAction={onFire}
                            />
                        ))}
                    </div>
                )}
            </div>

            {!canAffordSalaries && officials.length > 0 && (
                <div className="mt-4 p-3 bg-red-900/20 border border-red-800/50 rounded-lg flex items-start gap-3">
                    <Icon name="AlertTriangle" className="text-red-400 mt-0.5" />
                    <div>
                        <div className="text-sm font-bold text-red-300">Treasury Insufficient</div>
                        <div className="text-xs text-red-400/80">
                            You cannot afford full salaries. Official effects are reduced by 50% until salaries are paid.
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};
