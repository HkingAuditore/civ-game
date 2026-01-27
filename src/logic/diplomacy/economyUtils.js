/**
 * Diplomacy Economy Utils
 * 统一 GDP 读取逻辑，避免 UI 与模拟口径不一致
 */

export const getNationGDP = (nation, fallback = 1000) => {
    const gdp = nation?.gdp;
    if (Number.isFinite(gdp) && gdp > 0) return gdp;

    const wealth = nation?.wealth;
    if (Number.isFinite(wealth) && wealth > 0) return wealth;

    return fallback;
};
