import React, { useEffect, useState, useMemo } from 'react';

/**
 * EmpireScene - 帝国场景可视化组件
 * 适配修复版
 */
export default function EmpireScene({
    daysElapsed = 0,
    season = '春季',
    population = 0,
    stability = 100,
    wealth = 0,
    epoch = 0
}) {
    const [dayProgress, setDayProgress] = useState(0);
    const [weatherRandom, setWeatherRandom] = useState(0.5);
    const [windSpeed, setWindSpeed] = useState(1.0);

    // 生成唯一ID前缀，防止页面上有多个SVG时渐变色ID冲突导致不显示
    const uid = useMemo(() => Math.random().toString(36).substr(2, 9), []);

    // 地平线位置
    const HORIZON_Y = 85;

    useEffect(() => {
        const dayInterval = setInterval(() => {
            setDayProgress(prev => (prev + 0.002) % 1);
        }, 50);

        const weatherInterval = setInterval(() => {
            setWeatherRandom(Math.random());
            setWindSpeed(0.5 + Math.random() * 1.5);
        }, 15000);

        return () => {
            clearInterval(dayInterval);
            clearInterval(weatherInterval);
        };
    }, []);

    // 1. 天空状态
    const skyState = useMemo(() => {
        const p = dayProgress;
        let from, to, sunPos, moonPos, starOpacity, cloudColor;

        const sunY = 110 - Math.sin((p - 0.2) * (Math.PI / 0.6)) * 100;
        const sunX = 20 + ((p - 0.2) / 0.6) * 160;

        let moonP = p < 0.5 ? p + 1 : p;
        const moonY = 110 - Math.sin((moonP - 0.7) * (Math.PI / 0.6)) * 100;
        const moonX = 20 + ((moonP - 0.7) / 0.6) * 160;

        if (p < 0.25) {
            const t = p / 0.25;
            from = `rgb(${20 + t * 100}, ${30 + t * 120}, ${60 + t * 130})`;
            to = `rgb(${40 + t * 120}, ${60 + t * 140}, ${100 + t * 135})`;
            starOpacity = 1 - t * 2;
            cloudColor = "#ffccbc";
        } else if (p < 0.75) {
            from = "#4fc3f7";
            to = "#b3e5fc";
            starOpacity = 0;
            cloudColor = "#ffffff";
        } else {
            const t = (p - 0.75) / 0.25;
            from = `rgb(${25 + (1 - t) * 10}, ${25 + (1 - t) * 20}, ${60 + (1 - t) * 60})`;
            to = `rgb(${10}, ${10}, ${30})`;
            starOpacity = t * 2;
            cloudColor = "#546e7a";
        }
        return { from, to, sunX, sunY, moonX, moonY, starOpacity, cloudColor };
    }, [dayProgress]);

    // 2. 季节配置
    const seasonConfig = useMemo(() => {
        const configs = {
            '春': {
                ground: ['#8bc34a', '#c5e1a5'],
                grass: '#8bc34a',
                bush: '#7cb342',
                treeTrunk: '#795548',
                treeLeaf: '#66bb6a',
                flower: '#f48fb1',
                particles: '#f8bbd0',
                mountain1: ['#6b8e7f', '#4a6b5c'],
                mountain2: ['#7fa89b', '#5d7f72']
            },
            '夏': {
                ground: ['#558b2f', '#8bc34a'],
                grass: '#558b2f',
                bush: '#33691e',
                treeTrunk: '#5d4037',
                treeLeaf: '#2e7d32',
                flower: null,
                particles: '#fff176',
                mountain1: ['#546e7a', '#37474f'],
                mountain2: ['#607d8b', '#455a64']
            },
            '秋': {
                ground: ['#d7ccc8', '#efebe9'],
                grass: '#d7ccc8',
                bush: '#ffb74d',
                treeTrunk: '#4e342e',
                treeLeaf: ['#ff7043', '#ffca28', '#d84315'],
                flower: null,
                particles: '#d84315',
                mountain1: ['#8d6e63', '#5d4037'],
                mountain2: ['#a1887f', '#6d4c41']
            },
            '冬': {
                ground: ['#eceff1', '#ffffff'],
                grass: '#cfd8dc',
                bush: '#b0bec5',
                treeTrunk: '#3e2723',
                treeLeaf: '#ffffff',
                flower: null,
                particles: '#ffffff',
                mountain1: ['#b0bec5', '#78909c'],
                mountain2: ['#cfd8dc', '#90a4ae']
            },
        };
        return configs[season] || configs['春季'];
    }, [season]);

    // 3. 时代建筑风格 - 增强版
    const epochStyle = useMemo(() => {
        const styles = {
            0: { // 石器时代
                type: 'tent',
                color: '#a1887f',
                roof: '#8d6e63',
                detail: 'campfire',
                atmosphere: 'rgba(139,69,19,0.1)',
                landmark: 'cave'
            },
            1: { // 青铜时代
                type: 'clay',
                color: '#d7ccc8',
                roof: '#a1887f',
                detail: 'pot',
                atmosphere: 'rgba(205,127,50,0.08)',
                landmark: 'obelisk'
            },
            2: { // 古典时代
                type: 'clay',
                color: '#f5f5dc',
                roof: '#cd853f',
                detail: 'column',
                atmosphere: 'rgba(255,215,0,0.06)',
                landmark: 'temple'
            },
            3: { // 封建时代
                type: 'timber',
                color: '#8b7355',
                roof: '#3e2723',
                detail: 'banner',
                atmosphere: 'rgba(70,130,180,0.08)',
                landmark: 'tower'
            },
            4: { // 探索时代
                type: 'timber',
                color: '#deb887',
                roof: '#654321',
                detail: 'ship',
                atmosphere: 'rgba(0,128,128,0.06)',
                landmark: 'lighthouse'
            },
            5: { // 启蒙时代
                type: 'brick',
                color: '#f4a460',
                roof: '#2f4f4f',
                detail: 'lamp',
                atmosphere: 'rgba(138,43,226,0.05)',
                landmark: 'dome'
            },
            6: { // 工业时代
                type: 'brick',
                color: '#b71c1c',
                roof: '#263238',
                detail: 'chimney',
                atmosphere: 'rgba(105,105,105,0.12)',
                landmark: 'factory'
            },
            7: { // 信息时代
                type: 'modern',
                color: '#cfd8dc',
                roof: '#607d8b',
                detail: 'glass',
                atmosphere: 'rgba(0,255,127,0.05)',
                landmark: 'antenna'
            }
        };
        return styles[epoch] || styles[0];
    }, [epoch]);

    // 4. 房屋布局
    const houses = useMemo(() => {
        const count = Math.min(Math.floor(population / 5), 15);
        const arr = Array.from({ length: count }).map((_, i) => {
            const offset = Math.sin(i * 132.1) * 10;
            const depth = Math.floor(i / 5);
            const distFromHorizon = (2 - depth) * 4;
            const y = HORIZON_Y + distFromHorizon + 2;
            const scale = 1 - depth * 0.15;
            return {
                x: 20 + (i * 35) % 160 + offset,
                y: y,
                scale: scale,
                id: i
            };
        });
        return arr.sort((a, b) => a.y - b.y);
    }, [population]);

    // 5. 动态行人
    const pedestrians = useMemo(() => {
        const count = Math.min(Math.floor(population / 3), 8);
        return Array.from({ length: count }).map((_, i) => ({
            id: i,
            startX: 10 + Math.random() * 180,
            y: HORIZON_Y + 2 + Math.random() * 10,
            duration: 15 + Math.random() * 10,
            delay: -Math.random() * 20,
            scale: 0.5 + (Math.random() * 0.3),
            color: ['#5d4037', '#3e2723', '#4e342e'][Math.floor(Math.random() * 3)]
        })).sort((a, b) => a.y - b.y);
    }, [population]);

    // 6. 植被生成
    const vegetation = useMemo(() => {
        const items = [];
        const count = 60;
        const seededRandom = (index) => {
            const x = Math.sin(index + 123.45) * 10000;
            return x - Math.floor(x);
        };

        for (let i = 0; i < count; i++) {
            const r1 = seededRandom(i * 1.1);
            const r2 = seededRandom(i * 2.2);
            const r3 = seededRandom(i * 3.3);

            let type = 'grass';
            if (r2 > 0.5) type = 'bush';
            if (r2 > 0.8) type = 'tree';

            const yNorm = r1;
            const y = HORIZON_Y + 2 + yNorm * 35;
            const x = -20 + seededRandom(i * 99) * 240;

            let baseScale = 0.5 + yNorm * 0.8;
            if (type === 'grass') baseScale *= 0.6;

            let colorVariant = 0;
            if (Array.isArray(seasonConfig.treeLeaf)) {
                colorVariant = Math.floor(r3 * seasonConfig.treeLeaf.length);
            }

            items.push({
                id: i,
                type,
                x,
                y,
                scale: baseScale,
                flip: r3 > 0.5 ? 1 : -1,
                variant: r3,
                colorIdx: colorVariant
            });
        }
        return items.sort((a, b) => a.y - b.y);
    }, [season, seasonConfig]);

    const rainChance = (100 - stability) / 100 * 0.8;
    const isRaining = weatherRandom < rainChance;
    const isCloudy = stability < 80 || weatherRandom < 0.7;
    const isStormy = stability < 30 && isRaining;
    const prosperity = Math.min(100, (wealth / 20) + (stability / 2) + (population / 2));
    const isProsperity = prosperity > 70;

    return (
        // 史诗级外框 - 灵感来自《文明》《维多利亚》风格
        <div className="relative w-full h-48 md:h-64 group select-none">
            {/* 外层装饰框 */}
            <div className="absolute inset-0 rounded-lg" style={{
                background: 'linear-gradient(135deg, #8b7355 0%, #d4af37 15%, #c9a227 50%, #d4af37 85%, #8b7355 100%)',
                padding: '3px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -1px 0 rgba(0,0,0,0.4)'
            }}>
                {/* 内层金属边框 */}
                <div className="absolute inset-[3px] rounded-md" style={{
                    background: 'linear-gradient(180deg, #3d2415 0%, #1a1410 50%, #2c1810 100%)',
                    border: '1px solid rgba(212,175,55,0.4)',
                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.8), inset 0 -1px 0 rgba(212,175,55,0.2)'
                }} />
            </div>

            {/* 四角装饰 */}
            <div className="absolute top-0 left-0 w-6 h-6 pointer-events-none z-20">
                <svg viewBox="0 0 24 24" className="w-full h-full">
                    <path d="M0,0 L24,0 L24,4 L4,4 L4,24 L0,24 Z" fill="url(#cornerGold)" opacity="0.9" />
                    <path d="M2,2 L20,2 L20,3 L3,3 L3,20 L2,20 Z" fill="rgba(255,235,180,0.4)" />
                    <circle cx="4" cy="4" r="2" fill="#d4af37" />
                    <circle cx="4" cy="4" r="1" fill="#f4e8d0" />
                </svg>
            </div>
            <div className="absolute top-0 right-0 w-6 h-6 pointer-events-none z-20" style={{ transform: 'scaleX(-1)' }}>
                <svg viewBox="0 0 24 24" className="w-full h-full">
                    <path d="M0,0 L24,0 L24,4 L4,4 L4,24 L0,24 Z" fill="url(#cornerGold)" opacity="0.9" />
                    <path d="M2,2 L20,2 L20,3 L3,3 L3,20 L2,20 Z" fill="rgba(255,235,180,0.4)" />
                    <circle cx="4" cy="4" r="2" fill="#d4af37" />
                    <circle cx="4" cy="4" r="1" fill="#f4e8d0" />
                </svg>
            </div>
            <div className="absolute bottom-0 left-0 w-6 h-6 pointer-events-none z-20" style={{ transform: 'scaleY(-1)' }}>
                <svg viewBox="0 0 24 24" className="w-full h-full">
                    <path d="M0,0 L24,0 L24,4 L4,4 L4,24 L0,24 Z" fill="url(#cornerGold)" opacity="0.9" />
                    <path d="M2,2 L20,2 L20,3 L3,3 L3,20 L2,20 Z" fill="rgba(255,235,180,0.4)" />
                    <circle cx="4" cy="4" r="2" fill="#d4af37" />
                    <circle cx="4" cy="4" r="1" fill="#f4e8d0" />
                </svg>
            </div>
            <div className="absolute bottom-0 right-0 w-6 h-6 pointer-events-none z-20" style={{ transform: 'scale(-1)' }}>
                <svg viewBox="0 0 24 24" className="w-full h-full">
                    <path d="M0,0 L24,0 L24,4 L4,4 L4,24 L0,24 Z" fill="url(#cornerGold)" opacity="0.9" />
                    <path d="M2,2 L20,2 L20,3 L3,3 L3,20 L2,20 Z" fill="rgba(255,235,180,0.4)" />
                    <circle cx="4" cy="4" r="2" fill="#d4af37" />
                    <circle cx="4" cy="4" r="1" fill="#f4e8d0" />
                </svg>
            </div>

            {/* 顶部装饰条纹 */}
            <div className="absolute top-[3px] left-8 right-8 h-[2px] z-20" style={{
                background: 'linear-gradient(90deg, transparent 0%, rgba(212,175,55,0.6) 20%, rgba(244,232,208,0.8) 50%, rgba(212,175,55,0.6) 80%, transparent 100%)'
            }} />
            <div className="absolute bottom-[3px] left-8 right-8 h-[2px] z-20" style={{
                background: 'linear-gradient(90deg, transparent 0%, rgba(212,175,55,0.6) 20%, rgba(244,232,208,0.8) 50%, rgba(212,175,55,0.6) 80%, transparent 100%)'
            }} />

            {/* 内容区域 */}
            <div className="absolute inset-[5px] rounded overflow-hidden" style={{
                boxShadow: 'inset 0 0 20px rgba(0,0,0,0.5), inset 0 0 3px rgba(212,175,55,0.3)'
            }}>
                <style>{`
        @keyframes cloud-drift { from { transform: translateX(-50px); } to { transform: translateX(250px); } }
        @keyframes twinkle { 0%, 100% { opacity: 0.3; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1.2); } }
        @keyframes sway { 0%, 100% { transform: rotate(-3deg); } 50% { transform: rotate(3deg); } }
        @keyframes grass-sway { 0%, 100% { transform: rotate(-5deg); } 50% { transform: rotate(5deg); } }
        @keyframes smoke { 0% { opacity: 0.7; transform: translateY(0) scale(1); } 100% { opacity: 0; transform: translateY(-18px) scale(2.5); } }
        @keyframes rain { 0% { transform: translateY(-20px) translateX(${windSpeed * -5}px); opacity: 0; } 50% { opacity: 0.8; } 100% { transform: translateY(20px) translateX(${windSpeed * 5}px); opacity: 0; } }
        @keyframes walk { 0% { transform: translateX(0) scaleX(1); } 45% { transform: translateX(40px) scaleX(1); } 50% { transform: translateX(40px) scaleX(-1); } 95% { transform: translateX(0) scaleX(-1); } 100% { transform: translateX(0) scaleX(1); } }
        @keyframes bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-0.8px); } }
        @keyframes float-up { 0% { opacity: 0.8; transform: translateY(0); } 100% { opacity: 0; transform: translateY(-25px); } }
        @keyframes shimmer { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.8; } }
        @keyframes bird-fly { 0% { transform: translateX(-20px) translateY(0); } 25% { transform: translateX(50px) translateY(-5px); } 50% { transform: translateX(120px) translateY(2px); } 75% { transform: translateX(180px) translateY(-3px); } 100% { transform: translateX(220px) translateY(0); } }
        @keyframes caravan-move { 0% { transform: translateX(-30px); } 100% { transform: translateX(230px); } }
        @keyframes flag-wave { 0%, 100% { transform: scaleX(1) skewY(0deg); } 25% { transform: scaleX(0.95) skewY(2deg); } 50% { transform: scaleX(1.05) skewY(-1deg); } 75% { transform: scaleX(0.98) skewY(1deg); } }
        
        .cloud-anim { animation: cloud-drift linear infinite; }
        .tree-sway { transform-origin: bottom center; animation: sway 4s ease-in-out infinite; transform-box: fill-box; }
        .grass-sway { transform-origin: bottom center; animation: grass-sway 2s ease-in-out infinite; transform-box: fill-box; }
        .rain-drop { animation: rain 0.5s linear infinite; }
        .pedestrian-walk { animation: walk linear infinite; }
        .pedestrian-bob { animation: bob 0.5s ease-in-out infinite; }
        .smoke-particle { animation: smoke 2.5s ease-out infinite; }
        .star-twinkle { animation: twinkle 3s ease-in-out infinite; }
        .float-particle { animation: float-up 3s ease-out infinite; }
        .shimmer-effect { animation: shimmer 2s ease-in-out infinite; }
        
        /* 全局平滑过渡 - 昼夜和季节变化 */
        svg { transition: background 3s ease-in-out; }
        path, circle, ellipse, rect, line, polygon { 
            transition: fill 3s ease-in-out, stroke 3s ease-in-out, opacity 3s ease-in-out, stop-color 3s ease-in-out; 
        }
        stop { transition: stop-color 3s ease-in-out; }
        g { transition: opacity 2s ease-in-out; }
      `}</style>

                {/* 
         修改 2: viewBox 高度从 120 增加到 150，确保底部内容不被裁剪
         修改 3: preserveAspectRatio 改为 xMidYMid slice，确保居中裁剪，而不是只保留底部或顶部
      */}
                <svg
                    viewBox="0 0 200 150"
                    preserveAspectRatio="xMidYMid slice"
                    className="w-full h-full block"
                    style={{
                        background: `linear-gradient(to bottom, ${skyState.from}, ${skyState.to})`,
                        transition: 'background 3s ease-in-out'
                    }}
                >

                    {/* 修改 4: 给渐变色 ID 增加唯一后缀，防止移动端/Safari 渲染冲突导致填充消失 */}
                    <defs>
                        {/* 深度阴影滤镜 */}
                        <filter id={`dropShadow-${uid}`} x="-20%" y="-20%" width="140%" height="140%">
                            <feDropShadow dx="1" dy="2" stdDeviation="1.5" floodColor="#000" floodOpacity="0.4" />
                        </filter>

                        {/* 繁荣光晕滤镜 */}
                        <filter id={`prosperityGlow-${uid}`} x="-50%" y="-50%" width="200%" height="200%">
                            <feGaussianBlur stdDeviation="2" result="blur" />
                            <feMerge>
                                <feMergeNode in="blur" />
                                <feMergeNode in="SourceGraphic" />
                            </feMerge>
                        </filter>

                        {/* 大气透视滤镜 - 用于远景 */}
                        <filter id={`atmosphericHaze-${uid}`}>
                            <feGaussianBlur stdDeviation="0.5" />
                            <feColorMatrix type="matrix" values="1 0 0 0 0.05  0 1 0 0 0.08  0 0 1 0 0.12  0 0 0 0.85 0" />
                        </filter>

                        {/* 纹理滤镜 */}
                        <filter id={`paperTexture-${uid}`}>
                            <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="3" result="noise" />
                            <feColorMatrix in="noise" type="saturate" values="0" />
                            <feBlend in="SourceGraphic" in2="noise" mode="multiply" />
                        </filter>

                        <linearGradient id={`mountainGrad1-${uid}`} x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor={seasonConfig.mountain1[0]} />
                            <stop offset="100%" stopColor={seasonConfig.mountain1[1]} />
                        </linearGradient>
                        <linearGradient id={`mountainGrad2-${uid}`} x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor={seasonConfig.mountain2[0]} />
                            <stop offset="100%" stopColor={seasonConfig.mountain2[1]} />
                        </linearGradient>
                        <linearGradient id={`groundGrad-${uid}`} x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor={seasonConfig.ground[0]} />
                            <stop offset="100%" stopColor={seasonConfig.ground[1]} />
                        </linearGradient>

                        {/* 多层地面渐变 - 增加深度感 */}
                        <linearGradient id={`groundLayer2-${uid}`} x1="0" x2="0" y1="0" y2="1">
                            <stop offset="0%" stopColor={seasonConfig.ground[0]} stopOpacity="0.6" />
                            <stop offset="100%" stopColor={seasonConfig.ground[1]} stopOpacity="0.9" />
                        </linearGradient>

                        <radialGradient id={`sunGlow-${uid}`}>
                            <stop offset="0%" stopColor="#fff176" stopOpacity="0.8" />
                            <stop offset="50%" stopColor="#ffcc02" stopOpacity="0.3" />
                            <stop offset="100%" stopColor="transparent" stopOpacity="0" />
                        </radialGradient>

                        {/* 金色繁荣光晕 */}
                        <radialGradient id={`goldGlow-${uid}`}>
                            <stop offset="0%" stopColor="#ffd700" stopOpacity="0.6" />
                            <stop offset="100%" stopColor="#ffd700" stopOpacity="0" />
                        </radialGradient>
                    </defs>

                    <g id="sky">
                        <g style={{ opacity: skyState.starOpacity, transition: 'opacity 3s ease-in-out' }}>
                            {[...Array(15)].map((_, i) => (
                                <circle key={`s${i}`} cx={Math.random() * 200} cy={Math.random() * 60} r={Math.random() * 0.6 + 0.2} fill="#fff" className="star-twinkle" style={{ animationDelay: `${i * 0.2}s` }} />
                            ))}
                        </g>

                        {skyState.sunY < 130 && (
                            <g transform={`translate(${skyState.sunX}, ${skyState.sunY})`}
                                style={{ transition: 'transform 1s ease-out, opacity 2s ease-in-out', opacity: skyState.sunY < 110 ? 1 : 0.5 }}>
                                {/* 外层光晕 */}
                                <circle r="18" fill={`url(#sunGlow-${uid})`} opacity="0.4" className="shimmer-effect" />
                                {/* 中层光晕 */}
                                <circle r="12" fill={`url(#sunGlow-${uid})`} opacity="0.6" />
                                {/* 太阳本体 */}
                                <circle r="5" fill="#fdd835" />
                                <circle r="4" fill="#ffeb3b" />
                                {/* 太阳高光 */}
                                <circle r="2" cx="-1" cy="-1" fill="#fff9c4" opacity="0.6" />
                            </g>
                        )}

                        {skyState.moonY < 130 && (
                            <g transform={`translate(${skyState.moonX}, ${skyState.moonY})`}
                                style={{ transition: 'transform 1s ease-out, opacity 2s ease-in-out', opacity: skyState.moonY < 110 ? 1 : 0.5 }}>
                                {/* 月光光晕 */}
                                <circle r="8" fill="#f5f5f5" opacity="0.15" className="shimmer-effect" />
                                {/* 月亮本体 */}
                                <circle r="4" fill="#f5f5f5" />
                                <circle r="4" fill="#e0e0e0" cx="0.5" cy="0" />
                                {/* 月球暗面 */}
                                <circle r="4" fill="#1a1a1a" fillOpacity="0.25" cx="1.5" cy="-1" />
                                {/* 月球坑纹 */}
                                <circle r="0.5" cx="-1" cy="0.5" fill="#bdbdbd" opacity="0.5" />
                                <circle r="0.3" cx="0.5" cy="-1" fill="#bdbdbd" opacity="0.4" />
                            </g>
                        )}
                    </g>

                    <g id="background">
                        {/* 远山 - 应用大气透视滤镜 */}
                        <g filter={`url(#atmosphericHaze-${uid})`}>
                            <path d="M0,70 L30,40 L60,55 L100,30 L140,50 L180,35 L200,55 L200,150 L0,150 Z"
                                fill={`url(#mountainGrad1-${uid})`} opacity="0.7" />
                            {/* 远山树木 */}
                            <g opacity="0.5">
                                {[25, 55, 95, 135, 175].map((x, i) => (
                                    <g key={`mt1-${i}`} transform={`translate(${x}, ${45 + Math.sin(i * 2) * 10})`}>
                                        <path d="M0,0 L-2,6 L2,6 Z" fill={seasonConfig.treeLeaf && !Array.isArray(seasonConfig.treeLeaf) ? seasonConfig.treeLeaf : '#4a6b5c'} opacity="0.6" />
                                    </g>
                                ))}
                            </g>
                        </g>
                        {/* 近山 - 更清晰 */}
                        <path d="M-10,80 L40,60 L80,75 L120,55 L160,70 L200,60 L220,75 L220,150 L-10,150 Z"
                            fill={`url(#mountainGrad2-${uid})`} opacity="0.9" />
                        {/* 近山树木和小屋 */}
                        <g opacity="0.7">
                            {[15, 50, 85, 115, 155, 185].map((x, i) => (
                                <g key={`mt2-${i}`} transform={`translate(${x}, ${65 + Math.sin(i * 1.5) * 8})`}>
                                    <path d="M0,0 L-3,8 L3,8 Z" fill={seasonConfig.treeLeaf && !Array.isArray(seasonConfig.treeLeaf) ? seasonConfig.treeLeaf : '#5d7f72'} />
                                    <rect x="-0.5" y="8" width="1" height="2" fill="#5d4037" />
                                </g>
                            ))}
                            {/* 山间小屋 */}
                            {epoch >= 1 && (
                                <>
                                    <g transform="translate(70, 72)">
                                        <rect x="-3" y="-4" width="6" height="4" fill={epochStyle.color} opacity="0.8" />
                                        <path d="M-4,-4 L0,-7 L4,-4 Z" fill={epochStyle.roof || '#5d4037'} opacity="0.8" />
                                    </g>
                                    <g transform="translate(140, 68)">
                                        <rect x="-2" y="-3" width="4" height="3" fill={epochStyle.color} opacity="0.7" />
                                        <path d="M-3,-3 L0,-5 L3,-3 Z" fill={epochStyle.roof || '#5d4037'} opacity="0.7" />
                                    </g>
                                </>
                            )}
                        </g>
                    </g>

                    {/* 多层地面 - 增加深度感 */}
                    <g id="ground-layers">
                        {/* 远景地面层 */}
                        <path d="M-10,82 Q50,80 100,83 Q150,80 210,82 L210,90 L-10,90 Z"
                            fill={`url(#groundLayer2-${uid})`} opacity="0.5" />
                        {/* 主地面层 */}
                        <path d="M-10,85 Q100,83 210,85 L210,150 L-10,150 Z"
                            fill={`url(#groundGrad-${uid})`}
                            style={{ transition: 'fill 2s ease-in-out' }} />
                        {/* 前景阴影 - 增加立体感 */}
                        <path d="M-10,130 Q100,125 210,130 L210,150 L-10,150 Z"
                            fill="rgba(0,0,0,0.15)" />
                    </g>

                    {/* 道路系统 - 根据人口和时代变化 */}
                    {population > 5 && (
                        <g id="roads">
                            {/* 主干道 */}
                            <path
                                d={`M-10,${95 + (epoch < 3 ? 2 : 0)} Q60,${92 + (epoch < 3 ? 3 : 0)} 100,${94 + (epoch < 3 ? 2 : 0)} Q150,${91 + (epoch < 3 ? 3 : 0)} 210,${93 + (epoch < 3 ? 2 : 0)}`}
                                stroke={epoch >= 6 ? '#4a4a4a' : epoch >= 3 ? '#8b7355' : '#a0896c'}
                                strokeWidth={epoch >= 4 ? '4' : '3'}
                                fill="none"
                                opacity="0.7"
                                strokeLinecap="round"
                            />
                            {/* 路面高光 */}
                            {epoch >= 4 && (
                                <path
                                    d="M-10,93 Q60,90 100,92 Q150,89 210,91"
                                    stroke="rgba(255,255,255,0.15)"
                                    strokeWidth="1"
                                    fill="none"
                                />
                            )}
                            {/* 支路 - 人口多时显示 */}
                            {population > 20 && (
                                <>
                                    <path
                                        d="M30,94 Q35,100 40,110"
                                        stroke={epoch >= 6 ? '#555' : '#9a8a72'}
                                        strokeWidth="2"
                                        fill="none"
                                        opacity="0.5"
                                    />
                                    <path
                                        d="M120,92 Q125,98 135,108"
                                        stroke={epoch >= 6 ? '#555' : '#9a8a72'}
                                        strokeWidth="2"
                                        fill="none"
                                        opacity="0.5"
                                    />
                                </>
                            )}
                            {/* 石板路纹理 - 古典时代以后 */}
                            {epoch >= 2 && epoch < 6 && (
                                <g opacity="0.3">
                                    {[20, 45, 70, 95, 120, 145, 170].map((x, i) => (
                                        <line key={i} x1={x} y1="92" x2={x} y2="96" stroke="#5d4037" strokeWidth="0.5" />
                                    ))}
                                </g>
                            )}
                        </g>
                    )}

                    {/* 前景装饰 - 填充下半部分空白 */}
                    <g id="foreground-decorations">
                        {/* 栅栏/围栏 - 青铜时代以后 */}
                        {epoch >= 1 && (
                            <g opacity="0.6">
                                <line x1="5" y1="105" x2="45" y2="103" stroke="#6d4c41" strokeWidth="1" />
                                {[8, 18, 28, 38].map((x, i) => (
                                    <line key={i} x1={x} y1="100" x2={x} y2="105" stroke="#5d4037" strokeWidth="1.5" />
                                ))}
                            </g>
                        )}

                        {/* 石头/岩石 */}
                        <g opacity="0.7">
                            <ellipse cx="15" cy="125" rx="4" ry="2" fill="#78909c" />
                            <ellipse cx="180" cy="118" rx="3" ry="1.5" fill="#90a4ae" />
                            <ellipse cx="60" cy="135" rx="5" ry="2" fill="#607d8b" />
                        </g>

                        {/* 花丛/灌木 - 前景 */}
                        <g>
                            {[25, 75, 130, 175].map((x, i) => (
                                <g key={`fg-bush-${i}`} transform={`translate(${x}, ${115 + (i % 2) * 8})`}>
                                    <ellipse cx="0" cy="0" rx="5" ry="2.5" fill={seasonConfig.bush} opacity="0.8" />
                                    {seasonConfig.flower && (
                                        <>
                                            <circle cx="-2" cy="-1" r="0.8" fill={seasonConfig.flower} />
                                            <circle cx="1" cy="-0.5" r="0.6" fill={seasonConfig.flower} />
                                            <circle cx="2.5" cy="-1" r="0.7" fill={seasonConfig.flower} />
                                        </>
                                    )}
                                </g>
                            ))}
                        </g>

                        {/* 前景草丛 */}
                        <g opacity="0.6">
                            {[10, 40, 90, 150, 190].map((x, i) => (
                                <g key={`fg-grass-${i}`} transform={`translate(${x}, ${130 + (i % 3) * 5})`} className="grass-sway">
                                    <path d="M0,0 Q-2,-6 0,-8 M1,0 Q0,-5 2,-7 M-1,0 Q-3,-4 -1,-6"
                                        stroke={seasonConfig.grass} strokeWidth="0.8" fill="none" />
                                </g>
                            ))}
                        </g>

                        {/* 水井/水槽 - 古典时代以后 */}
                        {epoch >= 2 && (
                            <g transform="translate(100, 115)" opacity="0.8">
                                <ellipse cx="0" cy="0" rx="5" ry="2" fill="#607d8b" />
                                <ellipse cx="0" cy="-1" rx="4" ry="1.5" fill="#4fc3f7" opacity="0.6" />
                                <rect x="-5" y="-3" width="1" height="3" fill="#5d4037" />
                                <rect x="4" y="-3" width="1" height="3" fill="#5d4037" />
                            </g>
                        )}
                    </g>
                    <g id="era-landmark" filter={`url(#dropShadow-${uid})`}>
                        {epochStyle.landmark === 'cave' && (
                            <g transform="translate(170, 78)">
                                <ellipse cx="0" cy="0" rx="12" ry="8" fill="#5d4037" />
                                <ellipse cx="0" cy="2" rx="6" ry="4" fill="#1a1a1a" />
                                <path d="M-5,-3 L-3,-8 L3,-6 L5,-3" stroke="#8d6e63" strokeWidth="0.5" fill="none" />
                            </g>
                        )}
                        {epochStyle.landmark === 'obelisk' && (
                            <g transform="translate(175, 70)">
                                <path d="M-2,15 L-3,0 L0,-8 L3,0 L2,15 Z" fill="#cd853f" />
                                <path d="M-2,15 L-3,0 L0,-8 L0,15 Z" fill="#deb887" />
                                <rect x="-4" y="15" width="8" height="2" fill="#8b7355" />
                            </g>
                        )}
                        {epochStyle.landmark === 'temple' && (
                            <g transform="translate(170, 68)">
                                <rect x="-15" y="12" width="30" height="3" fill="#f5f5dc" />
                                <rect x="-12" y="0" width="24" height="12" fill="#fffaf0" />
                                <path d="M-14,-2 L0,-10 L14,-2 Z" fill="#cd853f" />
                                {[-8, -3, 3, 8].map((cx, i) => <rect key={i} x={cx} y="2" width="2" height="10" fill="#deb887" />)}
                            </g>
                        )}
                        {epochStyle.landmark === 'tower' && (
                            <g transform="translate(175, 55)">
                                <rect x="-6" y="0" width="12" height="30" fill="#696969" />
                                <rect x="-8" y="-4" width="16" height="5" fill="#808080" />
                                <path d="M-8,-4 L0,-12 L8,-4 Z" fill="#2f4f4f" />
                                <rect x="-2" y="20" width="4" height="10" fill="#3e2723" />
                                {[-4, 4].map((x, i) => <rect key={i} x={x} y="5" width="2" height="3" fill="#87ceeb" opacity="0.8" />)}
                            </g>
                        )}
                        {epochStyle.landmark === 'lighthouse' && (
                            <g transform="translate(180, 60)">
                                <path d="M-4,30 L-6,0 L6,0 L4,30 Z" fill="#f5f5f5" />
                                <ellipse cx="0" cy="-2" rx="8" ry="3" fill="#dcdcdc" />
                                <circle cx="0" cy="-5" r="3" fill="#ffeb3b" className="shimmer-effect" />
                                <rect x="-5" y="10" width="10" height="2" fill="#b22222" />
                                <rect x="-5" y="20" width="10" height="2" fill="#b22222" />
                            </g>
                        )}
                        {epochStyle.landmark === 'dome' && (
                            <g transform="translate(170, 65)">
                                <rect x="-12" y="5" width="24" height="15" fill="#f4a460" />
                                <ellipse cx="0" cy="5" rx="12" ry="8" fill="#daa520" />
                                <ellipse cx="0" cy="5" rx="10" ry="6" fill="#ffd700" opacity="0.3" />
                                <rect x="-4" y="12" width="8" height="8" fill="#8b4513" />
                            </g>
                        )}
                        {epochStyle.landmark === 'factory' && (
                            <g transform="translate(165, 55)">
                                <rect x="-15" y="10" width="30" height="25" fill="#8b0000" />
                                <rect x="-12" y="0" width="6" height="35" fill="#4a4a4a" />
                                <rect x="6" y="5" width="5" height="30" fill="#4a4a4a" />
                                {/* 烟囱冒烟 */}
                                <circle cx="-9" cy="-5" r="3" fill="#888" opacity="0.6" className="smoke-particle" />
                                <circle cx="8" cy="-3" r="2" fill="#999" opacity="0.5" className="smoke-particle" style={{ animationDelay: '0.5s' }} />
                                {[-8, -2, 4, 10].map((x, i) => <rect key={i} x={x} y="18" width="4" height="6" fill="#87ceeb" opacity="0.7" />)}
                            </g>
                        )}
                        {epochStyle.landmark === 'antenna' && (
                            <g transform="translate(175, 40)">
                                <rect x="-1" y="0" width="2" height="45" fill="#c0c0c0" />
                                <rect x="-8" y="5" width="16" height="2" fill="#a0a0a0" />
                                <rect x="-5" y="15" width="10" height="1" fill="#a0a0a0" />
                                <circle cx="0" cy="-2" r="2" fill="#ff4444" className="shimmer-effect" />
                                <rect x="-12" y="35" width="24" height="10" fill="#4169e1" />
                                <rect x="-10" y="37" width="8" height="6" fill="#00ffff" opacity="0.5" />
                            </g>
                        )}
                    </g>

                    {/* 时代大气层 */}
                    <rect x="0" y="0" width="200" height="150"
                        fill={epochStyle.atmosphere}
                        style={{ transition: 'fill 3s ease-in-out', pointerEvents: 'none' }} />

                    {/* 繁荣效果 - 金色光芒 */}
                    {isProsperity && (
                        <g opacity="0.4">
                            <circle cx="100" cy="90" r="60" fill={`url(#goldGlow-${uid})`} className="shimmer-effect" />
                        </g>
                    )}

                    {/* 飞鸟 - 繁荣度越高鸟越多 */}
                    {isProsperity && (
                        <g>
                            {[...Array(Math.min(5, Math.floor(prosperity / 20)))].map((_, i) => (
                                <g key={`bird-${i}`}
                                    style={{ animation: `bird-fly ${8 + i * 2}s linear infinite`, animationDelay: `${i * 3}s` }}>
                                    <path
                                        d={`M0,${20 + i * 8} l-2,-1 l2,1 l2,-1 l-2,1`}
                                        stroke="#333"
                                        strokeWidth="0.5"
                                        fill="none"
                                    />
                                </g>
                            ))}
                        </g>
                    )}

                    {/* 商队 - 财富达标时显示 */}
                    {wealth > 1000 && (
                        <g style={{ animation: 'caravan-move 30s linear infinite' }}>
                            <g transform="translate(0, 95)">
                                {/* 驴子 */}
                                <ellipse cx="0" cy="0" rx="3" ry="1.5" fill="#8b7355" />
                                <circle cx="-2" cy="-1" r="1" fill="#6b5344" />
                                <line x1="-2" y1="1.5" x2="-2" y2="3" stroke="#5d4037" strokeWidth="0.5" />
                                <line x1="2" y1="1.5" x2="2" y2="3" stroke="#5d4037" strokeWidth="0.5" />
                                {/* 货物 */}
                                <rect x="-1" y="-3" width="4" height="2" fill="#deb887" />
                                <rect x="0" y="-4" width="2" height="1" fill="#cd853f" />
                            </g>
                        </g>
                    )}

                    {/* 旗帜 - 封建时代以后 */}
                    {epoch >= 3 && (
                        <g transform="translate(30, 75)">
                            <line x1="0" y1="0" x2="0" y2="15" stroke="#5d4037" strokeWidth="0.8" />
                            <g style={{ animation: 'flag-wave 2s ease-in-out infinite', transformOrigin: '0px 2.5px' }}>
                                <path
                                    d="M0,0 L8,2.5 L0,5 Z"
                                    fill={epoch >= 6 ? '#b71c1c' : '#1a237e'}
                                />
                                {/* 旗帜高光 */}
                                <path d="M0,0.5 L5,2 L0,2 Z" fill="rgba(255,255,255,0.15)" />
                            </g>
                        </g>
                    )}

                    {vegetation.map((v) => (
                        <g key={`veg-${v.id}`} transform={`translate(${v.x}, ${v.y})`}>
                            <g transform={`scale(${v.scale * v.flip}, ${v.scale})`}>
                                {v.type === 'grass' && (
                                    <g className="grass-sway" style={{ animationDuration: `${1.5 + v.variant}s` }}>
                                        <path d="M0,0 Q-1,-4 0,-5 M2,0 Q1,-3 2,-4 M-2,0 Q-3,-3 -2,-4" stroke={seasonConfig.grass} strokeWidth="0.5" fill="none" opacity="0.8" />
                                    </g>
                                )}
                                {v.type === 'bush' && (
                                    <g className="tree-sway" style={{ animationDuration: `${3 + v.variant}s` }}>
                                        <ellipse cx="0" cy="0" rx="4" ry="1.5" fill="#000" opacity="0.2" />
                                        <circle cx="-2" cy="-2" r="2.5" fill={seasonConfig.bush} />
                                        <circle cx="2" cy="-2" r="2.5" fill={seasonConfig.bush} />
                                        <circle cx="0" cy="-3.5" r="3" fill={seasonConfig.bush} />
                                        <circle cx="-1" cy="-3" r="1" fill="#fff" opacity="0.1" />
                                    </g>
                                )}
                                {v.type === 'tree' && (
                                    <g className="tree-sway" style={{ animationDuration: `${4 + v.variant}s` }}>
                                        <ellipse cx="0" cy="0.5" rx="5" ry="1.5" fill="#000" opacity="0.2" />
                                        <path d="M-1,0 L-0.8,-8 L0.8,-8 L1,0 Z" fill={seasonConfig.treeTrunk} />
                                        {season === '冬季' ? (
                                            <g transform="translate(0, -8)" stroke={seasonConfig.treeTrunk} strokeWidth="0.5">
                                                <line x1="0" y1="0" x2="-3" y2="-4" />
                                                <line x1="0" y1="0" x2="3" y2="-4" />
                                                <line x1="0" y1="-2" x2="-2" y2="-5" />
                                                <line x1="0" y1="-2" x2="2" y2="-5" />
                                                <path d="M-3,-4 Q0,-5 3,-4" stroke="#fff" strokeWidth="0.8" opacity="0.8" fill="none" />
                                            </g>
                                        ) : (
                                            <g transform="translate(0, -9)">
                                                {(() => {
                                                    const leafColor = Array.isArray(seasonConfig.treeLeaf) ? seasonConfig.treeLeaf[v.colorIdx] : seasonConfig.treeLeaf;
                                                    return (
                                                        <>
                                                            <circle cx="-2.5" cy="1" r="3.5" fill={leafColor} />
                                                            <circle cx="2.5" cy="1" r="3.5" fill={leafColor} />
                                                            <circle cx="0" cy="-2" r="4" fill={leafColor} />
                                                            <circle cx="-1.5" cy="-2.5" r="1.5" fill="#fff" opacity="0.1" />
                                                            {seasonConfig.flower && v.variant > 0.6 && (
                                                                <g fill={seasonConfig.flower}>
                                                                    <circle cx="-2" cy="-1" r="0.8" />
                                                                    <circle cx="2" cy="0" r="0.6" />
                                                                    <circle cx="0" cy="-3" r="0.7" />
                                                                </g>
                                                            )}
                                                        </>
                                                    );
                                                })()}
                                            </g>
                                        )}
                                    </g>
                                )}
                            </g>
                        </g>
                    ))}

                    {houses.map((h) => (
                        <g key={`h-${h.id}`} transform={`translate(${h.x}, ${h.y}) scale(${h.scale})`}>
                            <ellipse cx="5" cy="0.5" rx="7" ry="1.8" fill="#000" opacity="0.25" />
                            {epochStyle.type === 'tent' && (
                                <g>
                                    <path d="M0,0 L5,-10 L10,0 Z" fill={epochStyle.color} stroke="#8d6e63" strokeWidth="0.3" />
                                    <line x1="5" y1="-10" x2="5" y2="0" stroke="#6d4c41" strokeWidth="0.4" />
                                    <path d="M2,0 L5,-6 L8,0" fill="none" stroke="#6d4c41" strokeWidth="0.3" />
                                </g>
                            )}
                            {(epochStyle.type === 'clay' || epochStyle.type === 'timber') && (
                                <g>
                                    <rect x="1" y="-7" width="8" height="7" fill={epochStyle.color} />
                                    <rect x="1" y="-7" width="1" height="7" fill="#000" opacity="0.15" />
                                    <rect x="8" y="-7" width="1" height="7" fill="#fff" opacity="0.1" />
                                    <path d="M0,-7 L5,-12 L10,-7 Z" fill={epochStyle.roof} />
                                    <path d="M0,-7 L5,-12 L5,-7 Z" fill="#000" opacity="0.2" />
                                    <rect x="3.5" y="-4" width="3" height="4" fill="#3e2723" rx="0.3" />
                                    <circle cx="6" cy="-2" r="0.3" fill="#ffd54f" />
                                    <rect x="1.5" y="-5.5" width="1.5" height="1.5" fill={dayProgress > 0.7 || dayProgress < 0.2 ? "#ffb74d" : "#90a4ae"} opacity="0.7" />
                                </g>
                            )}
                            {(epochStyle.type === 'brick' || epochStyle.type === 'modern') && (
                                <g>
                                    <rect x="0" y="-10" width="10" height="10" fill={epochStyle.color} />
                                    <rect x="0" y="-10" width="1.5" height="10" fill="#000" opacity="0.15" />
                                    <rect x="8.5" y="-10" width="1.5" height="10" fill="#fff" opacity="0.1" />
                                    <path d="M-1,-10 L5,-14 L11,-10 Z" fill={epochStyle.roof} />
                                    <path d="M-1,-10 L5,-14 L5,-10 Z" fill="#000" opacity="0.25" />
                                    <g>
                                        <rect x="1.5" y="-8.5" width="2.5" height="2.5" fill={dayProgress > 0.7 || dayProgress < 0.2 ? "#ffeb3b" : "#cfd8dc"} opacity={dayProgress > 0.7 || dayProgress < 0.2 ? 0.9 : 0.6} rx="0.2" />
                                        <line x1="2.75" y1="-8.5" x2="2.75" y2="-6" stroke="#37474f" strokeWidth="0.2" />
                                        <line x1="1.5" y1="-7.25" x2="4" y2="-7.25" stroke="#37474f" strokeWidth="0.2" />
                                        <rect x="6" y="-8.5" width="2.5" height="2.5" fill={dayProgress > 0.7 || dayProgress < 0.2 ? "#ffeb3b" : "#cfd8dc"} opacity={dayProgress > 0.7 || dayProgress < 0.2 ? 0.9 : 0.6} rx="0.2" />
                                        <line x1="7.25" y1="-8.5" x2="7.25" y2="-6" stroke="#37474f" strokeWidth="0.2" />
                                        <line x1="6" y1="-7.25" x2="8.5" y2="-7.25" stroke="#37474f" strokeWidth="0.2" />
                                    </g>
                                    <rect x="3.5" y="-4.5" width="3" height="4.5" fill="#4e342e" rx="0.3" />
                                    <circle cx="6" cy="-2.5" r="0.3" fill="#ffd54f" />
                                    {epochStyle.detail === 'chimney' && (
                                        <g transform="translate(7.5, -14)">
                                            <rect x="-0.5" y="0" width="1.5" height="4" fill="#3e2723" />
                                            <rect x="-0.5" y="0" width="0.3" height="4" fill="#000" opacity="0.2" />
                                            <circle cy="-1" r="1.2" fill="#e0e0e0" opacity="0.7" className="smoke-particle" style={{ animationDelay: `${h.id * 0.5}s` }} />
                                            <circle cy="-1" r="0.8" fill="#f5f5f5" opacity="0.5" className="smoke-particle" style={{ animationDelay: `${h.id * 0.5 + 0.3}s` }} />
                                        </g>
                                    )}
                                    {epochStyle.detail === 'glass' && wealth > 1000 && (
                                        <rect x="1" y="-9" width="8" height="1" fill="#4fc3f7" opacity="0.3" />
                                    )}
                                </g>
                            )}
                        </g>
                    ))}

                    {pedestrians.map((p) => (
                        <g key={`ped-${p.id}`} transform={`translate(${p.startX}, ${p.y}) scale(${p.scale})`}>
                            <g style={{ animation: `walk ${p.duration}s linear infinite`, animationDelay: `${p.delay}s` }}>
                                <g className="pedestrian-bob">
                                    <circle cx="0" cy="-5.5" r="1.2" fill={p.color} />
                                    <ellipse cx="0" cy="-3" rx="1.2" ry="2" fill={p.color} />
                                    <line x1="-1.2" y1="-3.5" x2="-2" y2="-1.5" stroke={p.color} strokeWidth="0.6" strokeLinecap="round" />
                                    <line x1="1.2" y1="-3.5" x2="2" y2="-1.5" stroke={p.color} strokeWidth="0.6" strokeLinecap="round" />
                                    <line x1="-0.5" y1="-1" x2="-1" y2="1" stroke={p.color} strokeWidth="0.8" strokeLinecap="round" />
                                    <line x1="0.5" y1="-1" x2="1" y2="1" stroke={p.color} strokeWidth="0.8" strokeLinecap="round" />
                                    <ellipse cx="0" cy="1.2" rx="1.5" ry="0.5" fill="#000" opacity="0.2" />
                                </g>
                            </g>
                        </g>
                    ))}

                    <g id="weather">
                        {isCloudy && (
                            <g opacity="0.8" style={{ transition: 'opacity 2s ease-in-out' }}>
                                <g className="cloud-anim" style={{ animationDuration: `${60 / windSpeed}s` }}>
                                    <ellipse cx="20" cy="25" rx="12" ry="6" fill={skyState.cloudColor} opacity="0.7" />
                                    <ellipse cx="30" cy="23" rx="15" ry="7" fill={skyState.cloudColor} opacity="0.8" />
                                    <ellipse cx="42" cy="25" rx="13" ry="6" fill={skyState.cloudColor} opacity="0.7" />
                                    <ellipse cx="30" cy="28" rx="18" ry="5" fill={skyState.cloudColor} opacity="0.6" />
                                </g>
                                <g className="cloud-anim" style={{ animationDuration: `${45 / windSpeed}s`, animationDelay: '-10s' }}>
                                    <ellipse cx="100" cy="18" rx="14" ry="7" fill={skyState.cloudColor} opacity="0.75" />
                                    <ellipse cx="112" cy="16" rx="16" ry="8" fill={skyState.cloudColor} opacity="0.85" />
                                    <ellipse cx="125" cy="18" rx="14" ry="7" fill={skyState.cloudColor} opacity="0.75" />
                                    <ellipse cx="112" cy="22" rx="20" ry="6" fill={skyState.cloudColor} opacity="0.65" />
                                </g>
                            </g>
                        )}
                        {isRaining && season !== '冬季' && [...Array(50)].map((_, i) => {
                            const x = (Math.random() * 240) - 20;
                            const offset = windSpeed * 3;
                            return (
                                <line key={`rain-${i}`} x1={x} y1={0} x2={x + offset} y2={20} stroke="#4fc3f7" strokeWidth="0.4" strokeOpacity="0.6" className="rain-drop" style={{ animationDuration: `${0.4 + Math.random() * 0.3}s`, animationDelay: `${Math.random()}s` }} />
                            );
                        })}
                        {season === '冬季' && weatherRandom < 0.6 && [...Array(30)].map((_, i) => (
                            <circle key={`snow-${i}`} cx={(Math.random() * 240) - 20} cy={Math.random() * 120} r={Math.random() * 1.2 + 0.5} fill="#ffffff" opacity="0.8" className="rain-drop" style={{ animationDuration: `${1 + Math.random()}s`, animationDelay: `${Math.random()}s` }} />
                        ))}
                        {wealth > 800 && !isStormy && [...Array(8)].map((_, i) => (
                            <g key={`wealth-${i}`}>
                                <circle cx={40 + Math.random() * 120} cy={95} r="1" fill="#ffd700" className="smoke-particle" style={{ animationDelay: `${i * 0.3}s` }} />
                                <circle cx={40 + Math.random() * 120} cy={95} r="0.5" fill="#ffeb3b" className="smoke-particle" style={{ animationDelay: `${i * 0.3 + 0.15}s` }} />
                            </g>
                        ))}
                        {isProsperity && dayProgress > 0.2 && dayProgress < 0.8 && (
                            <g opacity="0.4">
                                {[...Array(3)].map((_, i) => (
                                    <line key={`ray-${i}`} x1={skyState.sunX} y1={skyState.sunY} x2={30 + i * 70} y2={100} stroke="#fff176" strokeWidth="0.5" opacity="0.3" className="shimmer-effect" style={{ animationDelay: `${i * 0.5}s` }} />
                                ))}
                            </g>
                        )}
                        {stability < 70 && (
                            <rect x="0" y="0" width="200" height="150" fill="#000" opacity={Math.max(0, (70 - stability) / 200)} style={{ transition: 'opacity 3s ease-in-out' }} />
                        )}
                    </g>
                </svg>

                <div className="absolute top-0 left-0 right-0 px-4 py-2 flex items-center justify-between pointer-events-none z-10" style={{
                    background: 'linear-gradient(to bottom, rgba(26,20,16,0.9) 0%, rgba(26,20,16,0.6) 70%, transparent 100%)'
                }}>
                    {/* 左侧：年份 */}
                    <div className="flex items-baseline gap-1">
                        <span style={{
                            fontFamily: 'Georgia, "Times New Roman", serif',
                            fontSize: '18px',
                            fontWeight: '600',
                            color: '#d4af37',
                            textShadow: '0 1px 2px rgba(0,0,0,0.8), 0 0 10px rgba(212,175,55,0.3)'
                        }}>
                            {Math.floor(daysElapsed / 360) + 1}
                        </span>
                        <span style={{
                            fontFamily: 'Georgia, serif',
                            fontSize: '10px',
                            color: '#a89070',
                            letterSpacing: '0.05em'
                        }}>年</span>
                    </div>

                    {/* 中间：时代名称 */}
                    <div className="text-center">
                        <span style={{
                            fontFamily: 'Georgia, "Times New Roman", serif',
                            fontSize: '13px',
                            fontWeight: '500',
                            color: '#f4e8d0',
                            letterSpacing: '0.15em',
                            textShadow: '0 1px 3px rgba(0,0,0,0.9)'
                        }}>
                            {['石器时代', '青铜时代', '古典时代', '封建时代', '探索时代', '启蒙时代', '工业时代', '信息时代'][epoch] || '石器时代'}
                        </span>
                    </div>

                    {/* 右侧：季节 */}
                    <div className="flex items-center gap-1.5">
                        <span style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            backgroundColor: seasonConfig.treeLeaf && !Array.isArray(seasonConfig.treeLeaf) ? seasonConfig.treeLeaf : seasonConfig.grass,
                            boxShadow: '0 0 4px currentColor'
                        }} />
                        <span style={{
                            fontFamily: 'Georgia, serif',
                            fontSize: '11px',
                            color: '#c9b896',
                            letterSpacing: '0.1em'
                        }}>{season}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}