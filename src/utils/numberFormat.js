export const formatNumberShortCN = (
    value,
    {
        decimals = 1,
        useGroupingBelow = 10000,
        keepTrailingZero = false,
        sign = false,
    } = {}
) => {
    if (value === null || value === undefined) return '0';

    const num = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(num)) return '0';

    const abs = Math.abs(num);
    const prefix = sign ? (num > 0 ? '+' : num < 0 ? '-' : '') : (num < 0 ? '-' : '');

    const units = [
        { v: 1e12, s: '兆' },
        { v: 1e8, s: '亿' },
        { v: 1e4, s: '万' },
        { v: 1e3, s: '千' },
    ];

    // Below 千: show integer with optional grouping.
    if (abs < 1e3) {
        const base = Math.floor(abs);
        return `${prefix}${useGroupingBelow ? base.toLocaleString() : String(base)}`;
    }

    // For 1,000~9,999: use 千; for >=10,000 use 万/亿/兆.
    const unit = units.find((u) => abs >= u.v) || units[units.length - 1];
    const scaled = abs / unit.v;

    const fixed = scaled.toFixed(decimals);
    const trimmed = keepTrailingZero ? fixed : fixed.replace(/\.0+$|(?<=\.[0-9]*?)0+$/g, '').replace(/\.$/, '');

    return `${prefix}${trimmed}${unit.s}`;
};
