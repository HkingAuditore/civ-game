const ensureLeadingSlash = (value) => (value.startsWith('/') ? value : `/${value}`);
const ensureTrailingSlash = (value) => (value.endsWith('/') ? value : `${value}/`);

const getDocumentDirectory = () => {
    if (typeof window === 'undefined' || !window.location?.pathname) {
        return '/';
    }
    const path = window.location.pathname;
    if (path.endsWith('/')) {
        return path;
    }
    const lastSegment = path.substring(path.lastIndexOf('/') + 1);
    if (lastSegment.includes('.')) {
        const dir = path.substring(0, path.lastIndexOf('/') + 1);
        return dir || '/';
    }
    return `${path}/`;
};

const buildAbsoluteUrl = (basePath, cleanPath) => {
    if (typeof window === 'undefined' || !window.location?.origin) {
        const normalizedBase = ensureLeadingSlash(ensureTrailingSlash(basePath));
        return `${normalizedBase}${cleanPath}`;
    }
    const normalizedBase = ensureLeadingSlash(ensureTrailingSlash(basePath));
    const baseUrl = new URL(normalizedBase, window.location.origin);
    return new URL(cleanPath, baseUrl).href;
};

/**
 * 生成在不同部署路径下都正确的公共资源 URL。
 * 适配 base="./"、自定义子目录、以及根域名等场景。
 */
export const getPublicAssetUrl = (relativePath = '') => {
    const cleanPath = relativePath.replace(/^\/+/, '');
    const base = import.meta.env.BASE_URL || './';

    if (base.startsWith('http://') || base.startsWith('https://')) {
        const normalized = ensureTrailingSlash(base);
        return new URL(cleanPath, normalized).href;
    }

    if (typeof window !== 'undefined') {
        const docDir = getDocumentDirectory();
        let basePath = base;
        if (base === './' || base === '.' || base === '') {
            basePath = docDir;
        } else if (base.startsWith('./')) {
            basePath = docDir + base.slice(2);
        } else if (!base.startsWith('/')) {
            basePath = docDir + base;
        }
        return buildAbsoluteUrl(basePath, cleanPath);
    }

    const normalizedBase = ensureTrailingSlash(base);
    return `${normalizedBase}${cleanPath}`;
};
