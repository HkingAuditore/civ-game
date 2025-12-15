const normalizeKey = (path) => {
    const file = path.split('/').pop() || '';
    return file.replace(/\.[^.]+$/, '');
};

const buildingModules = import.meta.glob('../assets/images/buildings/*.webp', {
    eager: true,
    import: 'default',
});

const eventModules = import.meta.glob('../assets/images/events/*.webp', {
    eager: true,
    import: 'default',
});

const backgroundModules = import.meta.glob('../assets/images/backgrounds/*.webp', {
    eager: true,
    import: 'default',
});

const buildingImageMap = Object.fromEntries(
    Object.entries(buildingModules).map(([path, url]) => [normalizeKey(path), url])
);

const eventImageMap = Object.fromEntries(
    Object.entries(eventModules).map(([path, url]) => [normalizeKey(path), url])
);

const backgroundImageMap = Object.fromEntries(
    Object.entries(backgroundModules).map(([path, url]) => [normalizeKey(path), url])
);

export const getBuildingImageUrl = (id) => buildingImageMap[id];
export const getEventImageUrl = (id) => eventImageMap[id];
export const getBackgroundImageUrl = (key) => backgroundImageMap[key];
