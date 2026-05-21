// Worker 环境兼容垫片
// 必须在 simulation.worker.js 的所有其他 import 之前导入。
// gameanalytics SDK 在模块初始化时直接调用 window.addEventListener("beforeunload")，
// 在 Web Worker 中没有 window，会导致 ReferenceError。
// 这里创建一个最小化的 window 代理对象来吸收这些调用。

if (typeof window === 'undefined') {
    const noop = () => {};
    const noopArray = () => [];
    const nullResult = () => null;
    const createMockElement = () => ({
        style: {},
        setAttribute: noop,
        getAttribute: () => null,
        removeAttribute: noop,
        appendChild: noop,
        removeChild: noop,
        addEventListener: noop,
        removeEventListener: noop,
        querySelector: nullResult,
        querySelectorAll: noopArray,
        relList: { supports: () => false },
    });
    const noopProxy = new Proxy(noop, {
        get: () => noopProxy,
        apply: () => noopProxy,
    });

    globalThis.window = new Proxy({}, {
        get(target, prop) {
            if (prop === 'addEventListener' || prop === 'removeEventListener') return noop;
            if (prop === 'location') return { href: '', origin: '', pathname: '/' };
            if (prop === 'navigator') return { userAgent: 'Worker' };
            if (prop === 'matchMedia') return () => ({ matches: false, addEventListener: noop });
            if (prop === 'innerWidth') return 0;
            if (prop === 'innerHeight') return 0;
            if (prop === 'document') return globalThis.document;
            return undefined;
        },
    });

    if (typeof document === 'undefined') {
        globalThis.document = {
            addEventListener: noop,
            removeEventListener: noop,
            createElement: createMockElement,
            createTextNode: () => ({}),
            querySelector: nullResult,
            querySelectorAll: noopArray,
            getElementById: nullResult,
            getElementsByTagName: noopArray,
            head: { appendChild: noop, removeChild: noop },
            body: { appendChild: noop, removeChild: noop },
            documentElement: { style: {} },
            visibilityState: 'visible',
        };
    }

    if (typeof localStorage === 'undefined') {
        const store = new Map();
        globalThis.localStorage = {
            getItem: (k) => store.get(k) ?? null,
            setItem: (k, v) => store.set(k, String(v)),
            removeItem: (k) => store.delete(k),
            clear: () => store.clear(),
            get length() { return store.size; },
        };
    }

    if (typeof navigator === 'undefined') {
        globalThis.navigator = {
            userAgent: 'Worker',
            sendBeacon: () => false,
        };
    }
}
