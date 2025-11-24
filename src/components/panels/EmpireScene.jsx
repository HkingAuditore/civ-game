import React, { useEffect, useState, useMemo } from 'react';

/**
 * EmpireScene - 帝国场景可视化组件 (终极艺术版)
 * 包含：日夜循环、季节变换、时代建筑、随机天气、动态植被、繁忙人群
 */
export default function EmpireScene({ 
  daysElapsed = 0, 
  season = '春季', 
  population = 0, 
  stability = 100, 
  wealth = 0,
  epoch = 0
}) {
  // 日夜循环状态
  const [dayProgress, setDayProgress] = useState(0);
  // 随机天气因子 (0-1)，用于决定云量和降雨概率
  const [weatherRandom, setWeatherRandom] = useState(0.5);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setDayProgress(prev => (prev + 0.005) % 1);
    }, 50);
    
    // 每10秒稍微改变一下天气因子
    const weatherInterval = setInterval(() => {
      setWeatherRandom(Math.random());
    }, 10000);

    return () => {
      clearInterval(interval);
      clearInterval(weatherInterval);
    };
  }, []);

  // 天空颜色逻辑
  const skyState = useMemo(() => {
    const progress = dayProgress;
    let from, to, sunPos, moonPos, starOpacity;
    const sunX = 20 + progress * 160;
    const sunY = 100 - Math.sin(progress * Math.PI) * 90;
    const moonProgress = (progress + 0.5) % 1;
    const moonX = 20 + moonProgress * 160;
    const moonY = 100 - Math.sin(moonProgress * Math.PI) * 90;

    if (progress < 0.25) { // 黎明
      const t = progress / 0.25;
      from = `rgb(${30 + t * 100}, ${30 + t * 120}, ${60 + t * 140})`;
      to = `rgb(${60 + t * 140}, ${80 + t * 140}, ${120 + t * 135})`;
      starOpacity = 1 - t;
    } else if (progress < 0.75) { // 白天
      const t = (progress - 0.25) / 0.5;
      const brightness = Math.sin(t * Math.PI);
      from = `rgb(${130 - brightness * 40}, ${150 + brightness * 50}, ${200 + brightness * 55})`;
      to = `rgb(${180 + brightness * 20}, ${220 + brightness * 35}, ${255})`;
      starOpacity = 0;
    } else { // 黄昏/夜晚
      const t = (progress - 0.75) / 0.25;
      from = `rgb(${25 + (1-t) * 10}, ${20 + (1-t) * 10}, ${50 + (1-t) * 30})`;
      to = `rgb(${10 + (1-t) * 50}, ${10 + (1-t) * 70}, ${40 + (1-t) * 80})`;
      starOpacity = t;
    }
    return { from, to, sunX, sunY, moonX, moonY, starOpacity };
  }, [dayProgress]);

  // 季节配置
  const seasonConfig = useMemo(() => {
    const configs = {
      '春季': { ground: ['#8bc34a', '#aed581'], tree: '#689f38', particles: '#f8bbd0' },
      '夏季': { ground: ['#66bb6a', '#9ccc65'], tree: '#2e7d32', particles: '#fff176' },
      '秋季': { ground: ['#d4a574', '#e6ee9c'], tree: '#ff9800', particles: '#d84315' },
      '冬季': { ground: ['#e0f7fa', '#ffffff'], tree: '#795548', particles: '#ffffff' },
    };
    return configs[season] || configs['春季'];
  }, [season]);

  // 时代建筑风格
  const epochStyle = useMemo(() => {
    if (epoch === 0) return { type: 'tent', color: '#8d6e63', roof: '#a1887f' };
    if (epoch <= 2) return { type: 'clay', color: '#d7ccc8', roof: '#8d6e63' };
    if (epoch <= 4) return { type: 'timber', color: '#5d4037', roof: '#3e2723' };
    if (epoch <= 6) return { type: 'brick', color: '#b71c1c', roof: '#263238', detail: 'chimney' };
    return { type: 'modern', color: '#eceff1', roof: '#607d8b', detail: 'glass' };
  }, [epoch]);

  // 房屋布局
  const houses = useMemo(() => {
    const count = Math.min(Math.floor(population / 5), 12);
    return Array.from({ length: count }).map((_, i) => ({
      x: 20 + (i * 35) % 160 + (Math.floor(i / 5) * 15),
      y: 85 - Math.floor(i / 5) * 12 + (i % 2) * 2,
      scale: 0.8 + (i % 3) * 0.1,
    })).sort((a, b) => a.y - b.y);
  }, [population]);

  // 动态行人生成
  const pedestrians = useMemo(() => {
    // 人口越多，行人越多，最多10个
    const count = Math.min(Math.floor(population / 2), 10); 
    return Array.from({ length: count }).map((_, i) => ({
      id: i,
      // 随机初始位置 (0-200)
      startX: Math.random() * 180 + 10, 
      // 随机速度 (10s - 20s)
      duration: 10 + Math.random() * 10, 
      // 随机延迟
      delay: -Math.random() * 20, 
      // 随机方向 (1 或 -1)
      direction: Math.random() > 0.5 ? 1 : -1, 
      // 随机大小
      scale: 0.6 + Math.random() * 0.3
    }));
  }, [population]); // 仅当人口数量显著变化时重新计算

  // 综合天气判断
  // 稳定度越低，暴风雨概率越大；weatherRandom 增加随机性
  const stormThreshold = 40; // 稳定度低于40可能暴风雨
  const rainProbability = (100 - stability) / 100 * 0.8; // 最大80%概率下雨
  const isRaining = weatherRandom < rainProbability;
  const isStormy = stability < 30 && isRaining;
  const isCloudy = stability < 80 || weatherRandom < 0.6; // 只要不是极其稳定，或者随机因子较低，就有云

  // 植被位置 (草丛)
  const vegetation = useMemo(() => {
    if (season === '冬季') return []; // 冬季少草
    return Array.from({ length: 8 }).map((_, i) => ({
      x: Math.random() * 190 + 5,
      y: 85 + Math.random() * 10,
      scale: 0.5 + Math.random() * 0.5,
      type: i % 2 === 0 ? 'bush' : 'grass'
    }));
  }, [season]);

  return (
    <div className="relative w-full h-48 rounded-xl overflow-hidden border border-gray-700 shadow-2xl bg-gray-900 group">
      <style>{`
        @keyframes cloud-drift { from { transform: translateX(-100%); } to { transform: translateX(200%); } }
        @keyframes twinkle { 0%, 100% { opacity: 0.3; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1.2); } }
        @keyframes sway { 0%, 100% { transform: rotate(-3deg); } 50% { transform: rotate(3deg); } }
        @keyframes smoke { 0% { opacity: 0.6; transform: translateY(0) scale(1); } 100% { opacity: 0; transform: translateY(-20px) scale(2); } }
        @keyframes glow { 0%, 100% { filter: brightness(1); } 50% { filter: brightness(1.3); } }
        @keyframes rain { 0% { transform: translateY(-10px); opacity: 0; } 50% { opacity: 1; } 100% { transform: translateY(20px); opacity: 0; } }
        @keyframes walk { 
            0% { transform: translateX(0) scaleX(1); } 
            45% { transform: translateX(30px) scaleX(1); } 
            50% { transform: translateX(30px) scaleX(-1); } /* 转身 */
            95% { transform: translateX(0) scaleX(-1); } 
            100% { transform: translateX(0) scaleX(1); } /* 转身 */
        }
        @keyframes walk-long { 
            0% { transform: translateX(-20px) scaleX(1); } 
            49% { transform: translateX(60px) scaleX(1); } 
            50% { transform: translateX(60px) scaleX(-1); }
            99% { transform: translateX(-20px) scaleX(-1); } 
            100% { transform: translateX(-20px) scaleX(1); }
        }
        .cloud-slow { animation: cloud-drift 60s linear infinite; }
        .cloud-med { animation: cloud-drift 40s linear infinite; }
        .cloud-fast { animation: cloud-drift 25s linear infinite; }
        .star-twinkle { animation: twinkle 3s ease-in-out infinite; }
        .tree-sway { transform-origin: bottom center; animation: sway 5s ease-in-out infinite; }
        .grass-sway { transform-origin: bottom center; animation: sway 3s ease-in-out infinite; }
        .smoke-particle { animation: smoke 2s ease-out infinite; }
        .window-glow { animation: glow 4s ease-in-out infinite; }
        .rain-drop { animation: rain 0.6s linear infinite; }
      `}</style>

      <svg viewBox="0 0 200 120" className="w-full h-full transition-colors duration-1000" style={{
        background: `linear-gradient(to bottom, ${skyState.from}, ${skyState.to})`
      }}>
        
        {/* 1. 天空层 */}
        <g id="sky-layer">
          <g style={{ opacity: skyState.starOpacity }}>
            {[...Array(15)].map((_, i) => (
              <circle key={`star-${i}`} cx={Math.random()*200} cy={Math.random()*60} r={Math.random()*0.8+0.2} fill="white" className="star-twinkle" style={{animationDelay:`${Math.random()*3}s`}} />
            ))}
          </g>
          <g transform={`translate(${skyState.sunX}, ${skyState.sunY})`}>
             <circle r="12" fill="url(#sunGradient)" opacity="0.6" />
             <circle r="6" fill="#ffd700" />
          </g>
          <g transform={`translate(${skyState.moonX}, ${skyState.moonY})`}>
             <circle r="5" fill="#f5f5f5" />
             <circle r="5" fill="#000" fillOpacity="0.3" cx="2" cy="-2" />
          </g>
          <defs>
            <radialGradient id="sunGradient">
              <stop offset="0%" stopColor="#ffeb3b" stopOpacity="0.8"/>
              <stop offset="100%" stopColor="transparent" stopOpacity="0"/>
            </radialGradient>
            <linearGradient id="groundGradient" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={seasonConfig.ground[0]} />
              <stop offset="100%" stopColor={seasonConfig.ground[1]} />
            </linearGradient>
          </defs>
        </g>

        {/* 2. 背景层 (山脉与云) */}
        <g id="background-layer">
          <path d="M0,90 L40,40 L80,90 L120,50 L160,90 L200,60 L200,120 L0,120 Z" fill="#37474f" opacity="0.3" />
          <path d="M-20,100 L50,60 L100,100 L150,70 L220,100 L220,120 L-20,120 Z" fill="#455a64" opacity="0.5" />
          
          {isCloudy && (
            <g opacity={isRaining ? 0.8 : 0.6} fill={isRaining ? "#546e7a" : "#fff"}>
              <path d="M10,25 Q25,10 40,25 T70,25 T100,25" className="cloud-slow" opacity="0.8" />
              <path d="M50,35 Q65,20 80,35 T110,35" className="cloud-med" opacity="0.6" style={{animationDelay:'-10s'}} />
              <path d="M120,20 Q135,10 150,20 T180,20" className="cloud-fast" opacity="0.7" style={{animationDelay:'-5s'}} />
            </g>
          )}
        </g>

        {/* 3. 环境层 (地面与植被) */}
        <g id="environment-layer">
          <path d="M0,85 Q100,80 200,85 L200,120 L0,120 Z" fill="url(#groundGradient)" />
          
          {/* 树木 */}
          {[15, 45, 160, 185].map((x, i) => (
            <g key={`tree-${i}`} transform={`translate(${x}, 85)`} className="tree-sway" style={{animationDelay:`${i}s`}}>
              <rect x="-1" y="-10" width="2" height="12" fill={season === '冬季' ? '#5d4037' : '#795548'} />
              {season !== '冬季' && (
                <g transform="translate(0, -10)">
                  <circle r="8" fill={seasonConfig.tree} />
                  <circle cx="-4" cy="-3" r="6" fill={seasonConfig.tree} opacity="0.8" />
                  <circle cx="4" cy="-3" r="6" fill={seasonConfig.tree} opacity="0.8" />
                </g>
              )}
              <ellipse cx="0" cy="2" rx="6" ry="2" fill="#000" opacity="0.2" />
            </g>
          ))}

          {/* 新增：地表植被 (草丛) */}
          {vegetation.map((v, i) => (
             <g key={`veg-${i}`} transform={`translate(${v.x}, ${v.y}) scale(${v.scale})`} className="grass-sway" style={{animationDelay:`${i*0.5}s`}}>
                {v.type === 'bush' ? (
                   <path d="M-3,0 Q0,-6 3,0" fill={seasonConfig.tree} opacity="0.8" />
                ) : (
                   <path d="M-2,0 L-1,-4 L0,0 L1,-5 L2,0" stroke={seasonConfig.tree} strokeWidth="1" fill="none" />
                )}
             </g>
          ))}
        </g>

        {/* 4. 文明层 (建筑与人群) */}
        <g id="civilization-layer">
          {/* 建筑 */}
          {houses.map((house, i) => (
            <g key={`house-${i}`} transform={`translate(${house.x}, ${house.y}) scale(${house.scale})`}>
              <ellipse cx="5" cy="0" rx="8" ry="3" fill="#000" opacity="0.3" />
              {epochStyle.type === 'tent' && <path d="M0,0 L5,-10 L10,0 Z" fill={epochStyle.color} />}
              {(epochStyle.type === 'clay' || epochStyle.type === 'timber') && (
                <g>
                  <rect x="0" y="-8" width="10" height="8" fill={epochStyle.color} />
                  <path d="M-1,-8 L5,-14 L11,-8 Z" fill={epochStyle.roof} />
                  <rect x="3.5" y="-4" width="3" height="4" fill="#3e2723" />
                </g>
              )}
              {(epochStyle.type === 'brick' || epochStyle.type === 'modern') && (
                <g>
                  <rect x="0" y="-12" width="10" height="12" fill={epochStyle.color} />
                  <path d="M-1,-12 L5,-15 L11,-12 Z" fill={epochStyle.roof} />
                  <rect x="2" y="-10" width="2" height="2" fill={dayProgress>0.6?"#ffeb3b":"#cfd8dc"} className={dayProgress>0.6?"window-glow":""} />
                  <rect x="6" y="-10" width="2" height="2" fill={dayProgress>0.6?"#ffeb3b":"#cfd8dc"} className={dayProgress>0.6?"window-glow":""} />
                  <rect x="2" y="-6" width="2" height="2" fill={dayProgress>0.6?"#ffeb3b":"#cfd8dc"} className={dayProgress>0.6?"window-glow":""} />
                  <rect x="6" y="-6" width="2" height="2" fill={dayProgress>0.6?"#ffeb3b":"#cfd8dc"} className={dayProgress>0.6?"window-glow":""} />
                  {epochStyle.detail === 'chimney' && (
                    <g transform="translate(8, -14)">
                      <rect width="2" height="4" fill="#555" />
                      <circle r="1" fill="#ddd" className="smoke-particle" style={{animationDelay:'0s'}} />
                      <circle r="1.5" cy="-3" fill="#ddd" className="smoke-particle" style={{animationDelay:'1s'}} />
                    </g>
                  )}
                </g>
              )}
            </g>
          ))}
          
          {population > 0 && population < 10 && (
             <g transform="translate(100, 90)">
                <polygon points="-2,0 2,0 0,-5" fill="#ff5722" className="tree-sway" />
                <polygon points="-1,0 1,0 0,-3" fill="#ffeb3b" className="tree-sway" style={{animationDelay:'-0.5s'}} />
             </g>
          )}

          {/* 新增：动态人群 (Busy Pedestrians) */}
          {/* 在地面上方移动，简单的剪影风格 */}
          {pedestrians.map((p) => (
             <g key={`ped-${p.id}`} transform={`translate(${p.startX}, 88) scale(${p.scale})`}>
               <g style={{ 
                 animation: p.direction > 0 ? 'walk-long 15s ease-in-out infinite' : 'walk 10s ease-in-out infinite',
                 animationDelay: `${p.delay}s`,
                 animationDuration: `${p.duration}s`
               }}>
                 {/* 简单的火柴人/剪影 */}
                 <circle cx="0" cy="-4" r="1.5" fill="#3e2723" /> {/* 头 */}
                 <rect x="-0.5" y="-3" width="1" height="3" fill="#3e2723" /> {/* 身 */}
                 <path d="M-0.5,0 L-1.5,2 M0.5,0 L1.5,2" stroke="#3e2723" strokeWidth="0.5" /> {/* 腿 */}
               </g>
             </g>
          ))}

        </g>

        {/* 5. 特效层 */}
        <g id="effects-layer">
          {/* 雨/雪 */}
          {isRaining && [...Array(30)].map((_, i) => (
             <line key={`rain-${i}`} x1={Math.random()*200} y1={-10} x2={Math.random()*200} y2={10} 
                   stroke={season==='冬季'?"#fff":"#b3e5fc"} strokeWidth="0.5" className="rain-drop"
                   style={{animationDuration:`${0.5+Math.random()*0.5}s`, animationDelay:`${Math.random()}s`}} />
          ))}
          
          {/* 季节粒子 */}
          {season !== '夏季' && !isRaining && [...Array(10)].map((_, i) => (
            <circle key={`p-${i}`} cx={Math.random()*200} cy={Math.random()*120} r={season==='冬季'?1:1.5}
                    fill={seasonConfig.particles} opacity="0.6" className="tree-sway"
                    style={{animationDuration:`${3+Math.random()*4}s`, animationDelay:`${Math.random()*5}s`}} />
          ))}

          {/* 财富闪光 */}
          {wealth > 1000 && !isRaining && [...Array(5)].map((_, i) => (
             <text key={`coin-${i}`} x={50+Math.random()*100} y={90} fontSize="6" fill="#ffd700" className="star-twinkle" style={{animationDelay:`${i}s`}}>✦</text>
          ))}
        </g>

      </svg>

      {/* 底部信息 */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-gray-900/90 to-transparent px-4 py-2 flex justify-between items-end text-xs pointer-events-none">
         <div className="flex flex-col">
            <span className="text-gray-400 font-light text-[10px] uppercase tracking-widest">当前季节</span>
            <span className="text-white font-bold flex items-center gap-1">
              <span style={{ color: seasonConfig.tree }}>●</span> {season}
            </span>
         </div>
         <div className="flex flex-col items-end">
            <span className="text-gray-400 font-light text-[10px] uppercase tracking-widest">状态</span>
            <div className="flex items-center gap-2">
               {stability < 40 && <span className="text-red-400 animate-pulse">⚠️ 动荡</span>}
               {isRaining && <span className="text-blue-300">🌧️ 降雨</span>}
               {wealth > 1000 && <span className="text-yellow-400">✦ 繁荣</span>}
               <span className="text-gray-300">{dayProgress > 0.25 && dayProgress < 0.75 ? '☀ 白昼' : '☾ 夜晚'}</span>
            </div>
         </div>
      </div>
    </div>
  );
}