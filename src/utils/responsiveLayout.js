export function getAdaptiveCols({ phone = 1, tablet = 2, desktop = 3 } = {}) {
    const phoneCols = Math.max(1, Math.floor(phone));
    const tabletCols = Math.max(1, Math.floor(tablet));
    const desktopCols = Math.max(1, Math.floor(desktop));
    return `grid-cols-${phoneCols} md:grid-cols-${tabletCols} lg:grid-cols-${desktopCols}`;
}

export default getAdaptiveCols;
