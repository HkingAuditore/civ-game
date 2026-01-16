import { useState, useCallback, useMemo } from 'react';
import { getTreatyDuration } from '../logic/diplomacy/treatyEffects';
import { isDiplomacyUnlocked } from '../config/diplomacy';

export const useDiplomacy = ({
    nations,
    gameState,
    resources,
    onDiplomaticAction
}) => {
    const [selectedNationId, setSelectedNationId] = useState(null);
    const [negotiationDraft, setNegotiationDraft] = useState({
        type: 'non_aggression',
        durationDays: 365,
        maintenancePerDay: 0,
        signingGift: 0,
        resources: [], // Array of { key: string, amount: number }
        demandSilver: 0,
        demandResources: [], // Array of { key: string, amount: number }
        stance: 'normal'
    });

    const selectedNation = useMemo(() =>
        nations.find(n => n.id === selectedNationId),
        [nations, selectedNationId]);

    // Format helpers
    const formatStatValue = (value, unit = '') => {
        if (value === undefined || value === null) return '-';
        if (value >= 1000000000) return (value / 1000000000).toFixed(1) + 'B' + unit;
        if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M' + unit;
        if (value >= 1000) return (value / 1000).toFixed(1) + 'k' + unit;
        return Math.floor(value).toString() + unit;
    };

    const relationInfo = useCallback((relation = 0, isAllied = false) => {
        if (isAllied) return { label: '盟友', color: 'text-green-400', bg: 'bg-green-900/30' };
        if (relation >= 80) return { label: '亲密', color: 'text-emerald-400', bg: 'bg-emerald-900/30' };
        if (relation >= 60) return { label: '友好', color: 'text-blue-400', bg: 'bg-blue-900/30' };
        if (relation >= 40) return { label: '中立', color: 'text-gray-400', bg: 'bg-gray-800' };
        if (relation >= 20) return { label: '冷淡', color: 'text-yellow-400', bg: 'bg-yellow-900/30' };
        return { label: '敌对', color: 'text-red-400', bg: 'bg-red-900/30' };
    }, []);

    // Actions
    const handleSimpleAction = useCallback((nationId, action, payload = {}) => {
        if (typeof onDiplomaticAction === 'function') {
            onDiplomaticAction(nationId, action, payload);
        }
    }, [onDiplomaticAction]);

    const selectNation = useCallback((nationId) => {
        setSelectedNationId(nationId);
    }, []);

    return {
        selectedNationId,
        selectedNation,
        selectNation,
        negotiationDraft,
        setNegotiationDraft,
        handleSimpleAction,
        relationInfo,
        formatStatValue
    };
};
