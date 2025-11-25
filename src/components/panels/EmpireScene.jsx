import React, { useEffect, useState, useMemo } from 'react';

/**
 * EmpireScene - 帝国场景可视化组件
 * 修复：抬高地面 (HORIZON_Y = 85)，让地面物体展示更完整
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
  
  // 修改 1: 将地平线向上移 (原为 100)
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
    
    // 太阳和月亮的高度轨迹也可以稍微调整，或者保持现状（它们在天上，影响不大）
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
      from = `rgb(${25 + (1-t) * 10}, ${25 + (1-t) * 20}, ${60 + (1-t) * 60})`;
      to = `rgb(${10}, ${10}, ${30})`;
      starOpacity = t * 2;
      cloudColor = "#546e7a"; 
    }
    return { from, to, sunX, sunY, moonX, moonY, starOpacity, cloudColor };
  }, [dayProgress]);

  // 2. 增强版季节配置 (包含草、灌木、树干、树叶、山脉)
  const seasonConfig = useMemo(() => {
    const configs = {
      '春季': { 
        ground: ['#8bc34a', '#c5e1a5'], 
        grass: '#8bc34a', // 嫩绿
        bush: '#7cb342', 
        treeTrunk: '#795548',
        treeLeaf: '#66bb6a', // 鲜绿
        flower: '#f48fb1',   // 粉花
        particles: '#f8bbd0',
        mountain1: ['#6b8e7f', '#4a6b5c'], // 春季山脉 - 青绿
        mountain2: ['#7fa89b', '#5d7f72']
      },
      '夏季': { 
        ground: ['#558b2f', '#8bc34a'], 
        grass: '#558b2f', // 深绿
        bush: '#33691e', 
        treeTrunk: '#5d4037',
        treeLeaf: '#2e7d32', // 浓绿
        flower: null,
        particles: '#fff176',
        mountain1: ['#546e7a', '#37474f'], // 夏季山脉 - 深蓝灰
        mountain2: ['#607d8b', '#455a64']
      },
      '秋季': { 
        ground: ['#d7ccc8', '#efebe9'], 
        grass: '#d7ccc8', // 枯黄
        bush: '#ffb74d', 
        treeTrunk: '#4e342e',
        treeLeaf: ['#ff7043', '#ffca28', '#d84315'], // 枫叶红/黄混合
        flower: null,
        particles: '#d84315',
        mountain1: ['#8d6e63', '#5d4037'], // 秋季山脉 - 棕褐
        mountain2: ['#a1887f', '#6d4c41']
      },
      '冬季': { 
        ground: ['#eceff1', '#ffffff'], 
        grass: '#cfd8dc', // 灰白
        bush: '#b0bec5', 
        treeTrunk: '#3e2723',
        treeLeaf: '#ffffff', // 积雪
        flower: null,
        particles: '#ffffff',
        mountain1: ['#b0bec5', '#78909c'], // 冬季山脉 - 雪白灰
        mountain2: ['#cfd8dc', '#90a4ae']
      },
    };
    return configs[season] || configs['春季'];
  }, [season]);

  // 3. 时代建筑风格
  const epochStyle = useMemo(() => {
    if (epoch === 0) return { type: 'tent', color: '#a1887f', detail: 'none' };
    if (epoch <= 2) return { type: 'clay', color: '#d7ccc8', roof: '#a1887f' };
    if (epoch <= 4) return { type: 'timber', color: '#795548', roof: '#3e2723' };
    if (epoch <= 6) return { type: 'brick', color: '#b71c1c', roof: '#263238', detail: 'chimney' };
    return { type: 'modern', color: '#cfd8dc', roof: '#607d8b', detail: 'glass' };
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

  // 6. 植被生成逻辑
  const vegetation = useMemo(() => {
    const items = [];
    const count = 60; 

    const seededRandom = (index) => {
        const x = Math.sin(index + 123.45) * 10000;
        return x - Math.floor(x);
    };

    for (let i = 0; i < count; i++) {
      const r1 = seededRandom(i * 1.1); // 位置随机
      const r2 = seededRandom(i * 2.2); // 类型随机
      const r3 = seededRandom(i * 3.3); // 变体随机
      
      let type = 'grass';
      if (r2 > 0.5) type = 'bush';
      if (r2 > 0.8) type = 'tree';

      const yNorm = r1; // 0-1
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

  // 7. 天气状态
  const rainChance = (100 - stability) / 100 * 0.8; 
  const isRaining = weatherRandom < rainChance;
  const isCloudy = stability < 80 || weatherRandom < 0.7;
  const isStormy = stability < 30 && isRaining;
  const prosperity = Math.min(100, (wealth / 20) + (stability / 2) + (population / 2));
  const isProsperity = prosperity > 70;

  return (
    <div className="relative w-full h-48 rounded-xl overflow-hidden border border-gray-700 shadow-2xl bg-gray-900 group select-none">
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
        
        /* 平滑颜色过渡 */
        path, circle, ellipse, rect, line { transition: fill 2s ease-in-out, stroke 2s ease-in-out, opacity 2s ease-in-out; }
      `}</style>

      {/* 主画布 */}
      <svg 
        viewBox="0 0 200 120" 
        preserveAspectRatio="xMidYMax slice" 
        className="w-full h-full block" 
        style={{
          background: `linear-gradient(to bottom, ${skyState.from}, ${skyState.to})`,
          transition: 'background 2s ease-in-out'
        }}
      >
        
        {/* === 天空层 === */}
        <g id="sky">
          <g style={{ opacity: skyState.starOpacity, transition: 'opacity 3s ease-in-out' }}>
            {[...Array(15)].map((_, i) => (
              <circle key={`s${i}`} cx={Math.random()*200} cy={Math.random()*60} r={Math.random()*0.6+0.2} fill="#fff" className="star-twinkle" style={{animationDelay:`${i*0.2}s`}} />
            ))}
          </g>

          {skyState.sunY < 130 && (
            <g transform={`translate(${skyState.sunX}, ${skyState.sunY})`}>
              <circle r="12" fill="url(#sunGlow)" opacity="0.6" />
              <circle r="5" fill="#fdd835" />
            </g>
          )}

          {skyState.moonY < 130 && (
            <g transform={`translate(${skyState.moonX}, ${skyState.moonY})`}>
              <circle r="4" fill="#f5f5f5" />
              <circle r="4" fill="#000" fillOpacity="0.2" cx="1.5" cy="-1.5" />
            </g>
          )}
        </g>

        {/* === 远景层 (SVG 路径同步上移 15px) === */}
        <defs>
          <linearGradient id="mountainGrad1" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={seasonConfig.mountain1[0]} />
            <stop offset="100%" stopColor={seasonConfig.mountain1[1]} />
          </linearGradient>
          <linearGradient id="mountainGrad2" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={seasonConfig.mountain2[0]} />
            <stop offset="100%" stopColor={seasonConfig.mountain2[1]} />
          </linearGradient>
          <linearGradient id="groundGrad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={seasonConfig.ground[0]} />
            <stop offset="100%" stopColor={seasonConfig.ground[1]} />
          </linearGradient>
          <radialGradient id="sunGlow">
             <stop offset="0%" stopColor="#fff176" stopOpacity="0.8"/>
             <stop offset="100%" stopColor="transparent" stopOpacity="0"/>
          </radialGradient>
        </defs>
        
        <g id="background">
          {/* 原山脉 y 值减去 15 */}
          <path d="M0,70 L30,40 L60,55 L100,30 L140,50 L180,35 L200,55 L200,130 L0,130 Z" 
                fill="url(#mountainGrad1)" opacity="0.85" />
          <path d="M-10,80 L40,60 L80,75 L120,55 L160,70 L200,60 L220,75 L220,130 L-10,130 Z" 
                fill="url(#mountainGrad2)" opacity="0.95" />
        </g>

        {/* === 地面层 (从 Y=85 开始, 原 100) === */}
        <path d="M-10,85 Q100,83 210,85 L210,140 L-10,140 Z" fill="url(#groundGrad)" style={{transition: 'fill 2s ease-in-out'}} />

        {/* === 新版植被层 === */}
        {vegetation.map((v) => (
          <g key={`veg-${v.id}`} transform={`translate(${v.x}, ${v.y})`}>
            {/* 统一缩放和翻转 */}
            <g transform={`scale(${v.scale * v.flip}, ${v.scale})`}>
              
              {/* 1. 草丛 */}
              {v.type === 'grass' && (
                <g className="grass-sway" style={{animationDuration: `${1.5 + v.variant}s`}}>
                  <path 
                    d="M0,0 Q-1,-4 0,-5 M2,0 Q1,-3 2,-4 M-2,0 Q-3,-3 -2,-4" 
                    stroke={seasonConfig.grass} 
                    strokeWidth="0.5" 
                    fill="none" 
                    opacity="0.8"
                  />
                </g>
              )}

              {/* 2. 灌木 */}
              {v.type === 'bush' && (
                <g className="tree-sway" style={{animationDuration: `${3 + v.variant}s`}}>
                   {/* 底部暗影 */}
                   <ellipse cx="0" cy="0" rx="4" ry="1.5" fill="#000" opacity="0.2" />
                   {/* 灌木主体 */}
                   <circle cx="-2" cy="-2" r="2.5" fill={seasonConfig.bush} />
                   <circle cx="2" cy="-2" r="2.5" fill={seasonConfig.bush} />
                   <circle cx="0" cy="-3.5" r="3" fill={seasonConfig.bush} />
                   {/* 细节高光 */}
                   <circle cx="-1" cy="-3" r="1" fill="#fff" opacity="0.1" />
                </g>
              )}

              {/* 3. 树木 */}
              {v.type === 'tree' && (
                <g className="tree-sway" style={{animationDuration: `${4 + v.variant}s`}}>
                  {/* 阴影 */}
                  <ellipse cx="0" cy="0.5" rx="5" ry="1.5" fill="#000" opacity="0.2" />
                  
                  {/* 树干 */}
                  <path d="M-1,0 L-0.8,-8 L0.8,-8 L1,0 Z" fill={seasonConfig.treeTrunk} />
                  
                  {/* 树冠/树枝逻辑 */}
                  {season === '冬季' ? (
                     // 冬季枯枝
                     <g transform="translate(0, -8)" stroke={seasonConfig.treeTrunk} strokeWidth="0.5">
                        <line x1="0" y1="0" x2="-3" y2="-4" />
                        <line x1="0" y1="0" x2="3" y2="-4" />
                        <line x1="0" y1="-2" x2="-2" y2="-5" />
                        <line x1="0" y1="-2" x2="2" y2="-5" />
                        {/* 积雪 */}
                        <path d="M-3,-4 Q0,-5 3,-4" stroke="#fff" strokeWidth="0.8" opacity="0.8" fill="none" />
                     </g>
                  ) : (
                     // 其他季节茂盛树冠
                     <g transform="translate(0, -9)">
                        {/* 确定树叶颜色 (秋季多色或单色) */}
                        {(() => {
                           const leafColor = Array.isArray(seasonConfig.treeLeaf) 
                              ? seasonConfig.treeLeaf[v.colorIdx] 
                              : seasonConfig.treeLeaf;
                           return (
                             <>
                               <circle cx="-2.5" cy="1" r="3.5" fill={leafColor} />
                               <circle cx="2.5" cy="1" r="3.5" fill={leafColor} />
                               <circle cx="0" cy="-2" r="4" fill={leafColor} />
                               <circle cx="-1.5" cy="-2.5" r="1.5" fill="#fff" opacity="0.1" />
                               
                               {/* 春季花朵点缀 */}
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

        {/* === 建筑层 === */}
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
                  <rect x="1.5" y="-5.5" width="1.5" height="1.5" fill={dayProgress>0.7 || dayProgress<0.2 ? "#ffb74d" : "#90a4ae"} opacity="0.7" />
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
                    <rect x="1.5" y="-8.5" width="2.5" height="2.5" fill={dayProgress>0.7 || dayProgress<0.2 ? "#ffeb3b" : "#cfd8dc"} opacity={dayProgress>0.7 || dayProgress<0.2 ? 0.9 : 0.6} rx="0.2" />
                    <line x1="2.75" y1="-8.5" x2="2.75" y2="-6" stroke="#37474f" strokeWidth="0.2" />
                    <line x1="1.5" y1="-7.25" x2="4" y2="-7.25" stroke="#37474f" strokeWidth="0.2" />
                    
                    <rect x="6" y="-8.5" width="2.5" height="2.5" fill={dayProgress>0.7 || dayProgress<0.2 ? "#ffeb3b" : "#cfd8dc"} opacity={dayProgress>0.7 || dayProgress<0.2 ? 0.9 : 0.6} rx="0.2" />
                    <line x1="7.25" y1="-8.5" x2="7.25" y2="-6" stroke="#37474f" strokeWidth="0.2" />
                    <line x1="6" y1="-7.25" x2="8.5" y2="-7.25" stroke="#37474f" strokeWidth="0.2" />
                  </g>
                  <rect x="3.5" y="-4.5" width="3" height="4.5" fill="#4e342e" rx="0.3" />
                  <circle cx="6" cy="-2.5" r="0.3" fill="#ffd54f" />
                  
                  {epochStyle.detail === 'chimney' && (
                    <g transform="translate(7.5, -14)">
                      <rect x="-0.5" y="0" width="1.5" height="4" fill="#3e2723" />
                      <rect x="-0.5" y="0" width="0.3" height="4" fill="#000" opacity="0.2" />
                      <circle cy="-1" r="1.2" fill="#e0e0e0" opacity="0.7" className="smoke-particle" style={{animationDelay: `${h.id*0.5}s`}} />
                      <circle cy="-1" r="0.8" fill="#f5f5f5" opacity="0.5" className="smoke-particle" style={{animationDelay: `${h.id*0.5 + 0.3}s`}} />
                    </g>
                  )}

                  {epochStyle.detail === 'glass' && wealth > 1000 && (
                    <rect x="1" y="-9" width="8" height="1" fill="#4fc3f7" opacity="0.3" />
                  )}
                </g>
             )}
          </g>
        ))}

        {/* === 行人层 === */}
        {pedestrians.map((p) => (
          <g key={`ped-${p.id}`} transform={`translate(${p.startX}, ${p.y}) scale(${p.scale})`}>
            <g style={{ 
               animation: `walk ${p.duration}s linear infinite`, 
               animationDelay: `${p.delay}s` 
            }}>
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

        {/* === 天气特效层 === */}
        <g id="weather">
           {isCloudy && (
             <g opacity="0.8" style={{transition: 'opacity 2s ease-in-out'}}>
               <g className="cloud-anim" style={{animationDuration: `${60/windSpeed}s`}}>
                 <ellipse cx="20" cy="25" rx="12" ry="6" fill={skyState.cloudColor} opacity="0.7" />
                 <ellipse cx="30" cy="23" rx="15" ry="7" fill={skyState.cloudColor} opacity="0.8" />
                 <ellipse cx="42" cy="25" rx="13" ry="6" fill={skyState.cloudColor} opacity="0.7" />
                 <ellipse cx="30" cy="28" rx="18" ry="5" fill={skyState.cloudColor} opacity="0.6" />
               </g>
               <g className="cloud-anim" style={{animationDuration: `${45/windSpeed}s`, animationDelay: '-10s'}}>
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
               <line 
                 key={`rain-${i}`}
                 x1={x} y1={0} 
                 x2={x + offset} y2={20}
                 stroke="#4fc3f7"
                 strokeWidth="0.4"
                 strokeOpacity="0.6"
                 className="rain-drop"
                 style={{
                   animationDuration: `${0.4 + Math.random()*0.3}s`,
                   animationDelay: `${Math.random()}s`
                 }}
               />
             );
           })}

           {season === '冬季' && weatherRandom < 0.6 && [...Array(30)].map((_, i) => (
              <circle 
                key={`snow-${i}`}
                cx={(Math.random()*240) - 20}
                cy={Math.random()*120}
                r={Math.random() * 1.2 + 0.5}
                fill="#ffffff"
                opacity="0.8"
                className="rain-drop"
                style={{
                  animationDuration: `${1 + Math.random()}s`,
                  animationDelay: `${Math.random()}s`
                }}
              />
           ))}

           {wealth > 800 && !isStormy && [...Array(8)].map((_, i) => (
              <g key={`wealth-${i}`}>
                <circle 
                  cx={40 + Math.random() * 120}
                  cy={95}
                  r="1"
                  fill="#ffd700"
                  className="smoke-particle"
                  style={{animationDelay: `${i*0.3}s`}}
                />
                <circle 
                  cx={40 + Math.random() * 120}
                  cy={95}
                  r="0.5"
                  fill="#ffeb3b"
                  className="smoke-particle"
                  style={{animationDelay: `${i*0.3 + 0.15}s`}}
                />
              </g>
           ))}

           {isProsperity && dayProgress > 0.2 && dayProgress < 0.8 && (
             <g opacity="0.4">
               {[...Array(3)].map((_, i) => (
                 <line 
                   key={`ray-${i}`}
                   x1={skyState.sunX}
                   y1={skyState.sunY}
                   x2={30 + i * 70}
                   y2={100}
                   stroke="#fff176"
                   strokeWidth="0.5"
                   opacity="0.3"
                   className="shimmer-effect"
                   style={{animationDelay: `${i*0.5}s`}}
                 />
               ))}
             </g>
           )}

           {stability < 70 && (
             <rect 
               x="0" y="0" width="200" height="120" 
               fill="#000" 
               opacity={Math.max(0, (70 - stability) / 200)}
               style={{transition: 'opacity 3s ease-in-out'}}
             />
           )}
        </g>
      </svg>

      {/* 顶部信息栏 */}
      <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-gray-900/80 to-transparent px-3 py-2 flex items-center justify-between text-xs pointer-events-none z-10">
         <div className="flex items-center gap-1.5">
            <span style={{ color: seasonConfig.treeLeaf && !Array.isArray(seasonConfig.treeLeaf) ? seasonConfig.treeLeaf : seasonConfig.grass }} className="text-sm">●</span>
            <span className="text-white text-[11px] font-medium">{season}</span>
         </div>
         <div className="flex items-center gap-2 text-[10px] text-gray-300">
            <span>T{epoch}</span>
            <span className="text-gray-500">|</span>
            <span>👥{population}</span>
         </div>
         <div className="flex items-center gap-1.5">
            {stability < 40 && <span className="text-red-400 animate-pulse">⚠️</span>}
            {stability >= 40 && stability < 70 && <span className="text-yellow-400">⚡</span>}
            {isRaining && <span className="text-blue-300">🌧️</span>}
            {isProsperity && <span className="text-yellow-400">✦</span>}
            {wealth > 1500 && <span className="text-amber-400">💰</span>}
            <span className="text-gray-300">{dayProgress > 0.25 && dayProgress < 0.75 ? '☀' : '☾'}</span>
         </div>
      </div>
    </div>
  );
}