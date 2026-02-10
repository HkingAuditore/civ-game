import { useEffect, useState } from 'react';

const PHONE_MAX_WIDTH = 767;
const TABLET_MAX_WIDTH = 1023;

export function useResponsiveLayout() {
    const getSnapshot = () => {
        if (typeof window === 'undefined') {
            return {
                width: 1024,
                height: 768,
                orientation: 'landscape',
            };
        }
        const width = window.innerWidth;
        const height = window.innerHeight;
        return {
            width,
            height,
            orientation: width > height ? 'landscape' : 'portrait',
        };
    };

    const [viewport, setViewport] = useState(getSnapshot);

    useEffect(() => {
        const onResize = () => setViewport(getSnapshot());
        window.addEventListener('resize', onResize);
        window.addEventListener('orientationchange', onResize);
        return () => {
            window.removeEventListener('resize', onResize);
            window.removeEventListener('orientationchange', onResize);
        };
    }, []);

    const isPhone = viewport.width <= PHONE_MAX_WIDTH;
    const isTablet = viewport.width > PHONE_MAX_WIDTH && viewport.width <= TABLET_MAX_WIDTH;
    const isDesktop = viewport.width > TABLET_MAX_WIDTH;
    const compactDensity = isPhone || viewport.height < 700;

    return {
        width: viewport.width,
        height: viewport.height,
        orientation: viewport.orientation,
        isPhone,
        isTablet,
        isDesktop,
        compactDensity,
    };
}

export default useResponsiveLayout;
