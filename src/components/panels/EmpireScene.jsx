import React, { useEffect, useState, useMemo } from 'react';

/**
 * EmpireScene - 帝国场景可视化组件 (修复与增强版)
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
  // 日夜循环状态 (0-1)
  const [dayProgress, setDayProgress] = useState(0);
  // 随机天气因子 (0-1)
  const [weatherRandom, setWeatherRandom] = useState(0.5);
  // 风速因子 (0.5-2.0)
  const [windSpeed, setWindSpeed] = useState(1.0);
  
  useEffect(() => {
    const dayInterval = setInterval(() => {
      setDayProgress(prev => (prev + 0.002) % 1); // 稍微放慢日夜循环
    }, 50);
    
    const weatherInterval = setInterval(() => {
      setWeatherRandom(Math.random());
      setWindSpeed(0.5 + Math.random() * 1.5);
    }, 15000); // 每15秒变化一次天气倾向

    return () => {
      clearInterval(dayInterval);
      clearInterval(weatherInterval);
    };
  }, []);

  // 1. 天空状态计算
  const skyState = useMemo(() => {
    const p = dayProgress;
    let from, to, sunPos, moonPos, starOpacity, cloudColor;
    
    // 太阳轨迹 (0.2-0.8 为可见范围)
    const sunY = 110 - Math.sin((p - 0.2) * (Math.PI / 0.6)) * 100;
    const sunX = 20 + ((p - 0.2) / 0.6) * 160;
    
    // 月亮轨迹 (0.7-1.3 为可见范围, 也就是 0.7-1.0 和 0.0-0.3)
    let moonP = p < 0.5 ? p + 1 : p;
    const moonY = 110 - Math.sin((moonP - 0.7) * (Math.PI / 0.6)) * 100;
    const moonX = 20 + ((moonP - 0.7) / 0.6) * 160;

    if (p < 0.25) { // 黎明
      const t = p / 0.25;
      from = `rgb(${20 + t * 100}, ${30 + t * 120}, ${60 + t * 130})`;
      to = `rgb(${40 + t * 120}, ${60 + t * 140}, ${100 + t * 135})`;
      starOpacity = 1 - t * 2;
      cloudColor = "#ffccbc"; // 晨曦云
    } else if (p < 0.75) { // 白天
      from = "#4fc3f7"; // 亮蓝
      to = "#b3e5fc";   // 浅蓝
      starOpacity = 0;
      cloudColor = "#ffffff"; // 白云
    } else { // 黄昏 -> 夜晚
      const t = (p - 0.75) / 0.25;
      from = `rgb(${25 + (1-t) * 10}, ${25 + (1-t) * 20}, ${60 + (1-t) * 60})`;
      to = `rgb(${10}, ${10}, ${30})`;
      starOpacity = t * 2;
      cloudColor = "#546e7a"; // 夜云
    }

    return { from, to, sunX, sunY, moonX, moonY, starOpacity, cloudColor };
  }, [dayProgress]);

  // 2. 季节配置
  const seasonConfig = useMemo(() => {
    const configs = {
      '春季': { ground: ['#7cb342', '#aed581'], tree: '#558b2f', bush: '#8bc34a', particles: '#f8bbd0' },
      '夏季': { ground: ['#558b2f', '#7cb342'], tree: '#2e7d32', bush: '#558b2f', particles: '#fff176' },
      '秋季': { ground: ['#a1887f', '#d7ccc8'], tree: '#ef6c00', bush: '#ff9800', particles: '#d84315' },
      '冬季': { ground: ['#eceff1', '#ffffff'], tree: '#5d4037', bush: '#bcaaa4', particles: '#ffffff' },
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

  // 4. 房屋布局 (基于Y轴排序以处理遮挡)
  const houses = useMemo(() => {
    const count = Math.min(Math.floor(population / 5), 15);
    // 生成房屋数据
    const arr = Array.from({ length: count }).map((_, i) => {
      // 增加随机性避免整齐排列
      const offset = Math.sin(i * 132.1) * 10; 
      const depth = Math.floor(i / 5); // 0, 1, 2 行
      // 基础Y坐标：地面线是 90。
      // 越远的房子(depth大)，y越小(屏幕上方)，scale越小
      const y = 90 - depth * 8 + Math.random() * 2; 
      const scale = 1 - depth * 0.15;
      return {
        x: 20 + (i * 35) % 160 + offset,
        y: y,
        scale: scale,
        id: i
      };
    });
    // 按照Y坐标从小到大排序（远的先画）
    return arr.sort((a, b) => a.y - b.y);
  }, [population]);

  // 5. 动态行人
  const pedestrians = useMemo(() => {
    const count = Math.min(Math.floor(population / 3), 8);
    return Array.from({ length: count }).map((_, i) => ({
      id: i,
      // 行走范围：10-190
      startX: 10 + Math.random() * 180,
      // y 坐标在 92-100 之间 (房屋前方)
      y: 92 + Math.random() * 8,
      // 速度
      duration: 15 + Math.random() * 10,
      delay: -Math.random() * 20,
      // 大小随 y 变化 (近大远小)
      scale: 0.5 + (Math.random() * 0.3),
      // 随机衣服颜色
      color: ['#5d4037', '#3e2723', '#4e342e'][Math.floor(Math.random() * 3)]
    })).sort((a, b) => a.y - b.y);
  }, [population]);

  // 6. 植被生成 (确保不飞天)
  const vegetation = useMemo(() => {
    const count = 12;
    return Array.from({ length: count }).map((_, i) => {
      // y 坐标必须 >= 地平线 (大约 85-90)
      // 远处的树 y 小，scale 小
      const depthFactor = Math.random(); // 0-1
      const y = 85 + depthFactor * 20; // 85-105
      const scale = 0.6 + depthFactor * 0.6; // 0.6-1.2
      
      return {
        id: i,
        x: Math.random() * 200,
        y: y,
        scale: scale,
        type: Math.random() > 0.4 ? 'tree' : 'bush',
        flip: Math.random() > 0.5 ? 1 : -1
      };
    }).sort((a, b) => a.y - b.y);
  }, [season]);

  // 7. 天气状态
  const rainChance = (100 - stability) / 100 * 0.8; 
  const isRaining = weatherRandom < rainChance;
  const isCloudy = stability < 80 || weatherRandom < 0.7;
  const isStormy = stability < 30 && isRaining;

  return (
    <div className="relative w-full h-48 rounded-xl overflow-hidden border border-gray-700 shadow-2xl bg-gray-900 group">
      <style>{`
        @keyframes cloud-drift { from { transform: translateX(-50px); } to { transform: translateX(250px); } }
        @keyframes twinkle { 0%, 100% { opacity: 0.3; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1.2); } }
        @keyframes sway { 0%, 100% { transform: rotate(-3deg); } 50% { transform: rotate(3deg); } }
        @keyframes smoke { 0% { opacity: 0.6; transform: translateY(0) scale(1); } 100% { opacity: 0; transform: translateY(-15px) scale(2); } }
        @keyframes rain { 0% { transform: translateY(-20px) translateX(${windSpeed * -5}px); opacity: 0; } 50% { opacity: 0.8; } 100% { transform: translateY(20px) translateX(${windSpeed * 5}px); opacity: 0; } }
        @keyframes walk { 
            0% { transform: translateX(0) scaleX(1); } 
            45% { transform: translateX(40px) scaleX(1); } 
            50% { transform: translateX(40px) scaleX(-1); } 
            95% { transform: translateX(0) scaleX(-1); } 
            100% { transform: translateX(0) scaleX(1); } 
        }
        @keyframes bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-1px); } }
        
        .cloud-anim { animation: cloud-drift linear infinite; }
        .tree-sway { transform-origin: bottom center; animation: sway 4s ease-in-out infinite; }
        .rain-drop { animation: rain 0.5s linear infinite; }
        .pedestrian-walk { animation: walk linear infinite; }
        .pedestrian-bob { animation: bob 0.5s ease-in-out infinite; }
        .smoke-particle { animation: smoke 2s ease-out infinite; }
        .star-twinkle { animation: twinkle 3s ease-in-out infinite; }
      `}</style>

      {/* 主画布 */}
      <svg viewBox="0 0 200 120" className="w-full h-full transition-colors duration-1000" style={{
        background: `linear-gradient(to bottom, ${skyState.from}, ${skyState.to})`
      }}>
        
        {/* === 天空层 === */}
        <g id="sky">
          {/* 星星 */}
          <g style={{ opacity: skyState.starOpacity }}>
            {[...Array(15)].map((_, i) => (
              <circle key={`s${i}`} cx={Math.random()*200} cy={Math.random()*60} r={Math.random()*0.6+0.2} fill="#fff" className="star-twinkle" style={{animationDelay:`${i*0.2}s`}} />
            ))}
          </g>

          {/* 太阳 */}
          {skyState.sunY < 130 && (
            <g transform={`translate(${skyState.sunX}, ${skyState.sunY})`}>
              <circle r="12" fill="url(#sunGlow)" opacity="0.6" />
              <circle r="5" fill="#fdd835" />
            </g>
          )}

          {/* 月亮 */}
          {skyState.moonY < 130 && (
            <g transform={`translate(${skyState.moonX}, ${skyState.moonY})`}>
              <circle r="4" fill="#f5f5f5" />
              <circle r="4" fill="#000" fillOpacity="0.2" cx="1.5" cy="-1.5" />
            </g>
          )}
        </g>

        {/* === 远景层 (山脉) === */}
        <g id="background">
          <path d="M0,90 L40,50 L90,95 L130,60 L200,90 L200,120 L0,120 Z" fill="#37474f" opacity="0.4" />
          <path d="M-20,100 L60,70 L120,100 L160,80 L220,100 L220,120 L-20,120 Z" fill="#455a64" opacity="0.6" />
        </g>

        {/* === 地面层 === */}
        <defs>
          <linearGradient id="groundGrad" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={seasonConfig.ground[0]} />
            <stop offset="100%" stopColor={seasonConfig.ground[1]} />
          </linearGradient>
          <radialGradient id="sunGlow">
             <stop offset="0%" stopColor="#fff176" stopOpacity="0.8"/>
             <stop offset="100%" stopColor="transparent" stopOpacity="0"/>
          </radialGradient>
        </defs>
        
        <path d="M0,85 Q100,80 200,85 L200,120 L0,120 Z" fill="url(#groundGrad)" />

        {/* === 植被层 (树木与灌木) === */}
        {vegetation.map((v) => (
          <g key={`veg-${v.id}`} transform={`translate(${v.x}, ${v.y}) scale(${v.scale * v.flip}, ${v.scale})`} className="tree-sway" style={{animationDuration: `${4/windSpeed}s`}}>
            {v.type === 'tree' ? (
              <>
                <rect x="-1" y="-12" width="2" height="14" fill={season === '冬季' ? '#5d4037' : '#795548'} />
                {season !== '冬季' && (
                  <g transform="translate(0, -12)">
                     <circle r="7" fill={seasonConfig.tree} />
                     <circle cx="-3" cy="-3" r="5" fill={seasonConfig.tree} opacity="0.8" />
                     <circle cx="3" cy="-3" r="5" fill={seasonConfig.tree} opacity="0.8" />
                  </g>
                )}
              </>
            ) : (
              // 灌木
              <path d="M-4,0 Q0,-8 4,0" fill={seasonConfig.bush} />
            )}
            {/* 阴影 */}
            <ellipse cx="0" cy="1" rx={v.type==='tree'?5:3} ry="1.5" fill="#000" opacity="0.15" />
          </g>
        ))}

        {/* === 建筑层 === */}
        {houses.map((h) => (
          <g key={`h-${h.id}`} transform={`translate(${h.x}, ${h.y}) scale(${h.scale})`}>
             {/* 阴影 */}
             <ellipse cx="5" cy="1" rx="8" ry="2" fill="#000" opacity="0.3" />
             
             {epochStyle.type === 'tent' && (
                <path d="M0,0 L5,-10 L10,0 Z" fill={epochStyle.color} />
             )}

             {(epochStyle.type === 'clay' || epochStyle.type === 'timber') && (
                <g>
                  <rect x="1" y="-7" width="8" height="7" fill={epochStyle.color} />
                  <path d="M0,-7 L5,-12 L10,-7 Z" fill={epochStyle.roof} />
                  <rect x="3.5" y="-4" width="3" height="4" fill="#3e2723" />
                </g>
             )}

             {(epochStyle.type === 'brick' || epochStyle.type === 'modern') && (
                <g>
                  <rect x="0" y="-10" width="10" height="10" fill={epochStyle.color} />
                  <path d="M-1,-10 L5,-14 L11,-10 Z" fill={epochStyle.roof} />
                  {/* 窗户 */}
                  <rect x="2" y="-8" width="2" height="2" fill={dayProgress>0.7 || dayProgress<0.2 ? "#ffeb3b" : "#cfd8dc"} opacity={dayProgress>0.7 || dayProgress<0.2 ? 0.9 : 0.6} />
                  <rect x="6" y="-8" width="2" height="2" fill={dayProgress>0.7 || dayProgress<0.2 ? "#ffeb3b" : "#cfd8dc"} opacity={dayProgress>0.7 || dayProgress<0.2 ? 0.9 : 0.6} />
                  
                  {/* 烟囱效果 */}
                  {epochStyle.detail === 'chimney' && (
                    <g transform="translate(7, -12)">
                      <rect width="2" height="4" fill="#3e2723" />
                      <circle r="1.5" fill="#eee" opacity="0.6" className="smoke-particle" style={{animationDelay: `${h.id*0.5}s`}} />
                    </g>
                  )}
                </g>
             )}
          </g>
        ))}

        {/* === 行人层 (在建筑前) === */}
        {pedestrians.map((p) => (
          <g key={`ped-${p.id}`} transform={`translate(${p.startX}, ${p.y}) scale(${p.scale})`}>
            <g style={{ 
               animation: `walk ${p.duration}s linear infinite`, 
               animationDelay: `${p.delay}s` 
            }}>
              <g className="pedestrian-bob">
                 {/* 简单的火柴人 */}
                 <circle cx="0" cy="-5" r="1.5" fill={p.color} />
                 <rect x="-1" y="-4" width="2" height="3" fill={p.color} />
                 <line x1="0" y1="-1" x2="-1" y2="2" stroke={p.color} strokeWidth="1" />
                 <line x1="0" y1="-1" x2="1" y2="2" stroke={p.color} strokeWidth="1" />
              </g>
            </g>
          </g>
        ))}

        {/* === 天气特效层 === */}
        <g id="weather">
           {/* 云层 */}
           {isCloudy && (
             <g opacity="0.7" fill={skyState.cloudColor}>
               <path d="M10,30 Q25,20 40,30 T70,30" className="cloud-anim" style={{animationDuration: `${60/windSpeed}s`}} />
               <path d="M80,20 Q95,10 110,20 T140,20" className="cloud-anim" style={{animationDuration: `${45/windSpeed}s`, animationDelay: '-10s'}} />
               <path d="M150,35 Q165,25 180,35 T210,35" className="cloud-anim" style={{animationDuration: `${30/windSpeed}s`, animationDelay: '-5s'}} />
             </g>
           )}

           {/* 雨/雪 */}
           {(isRaining || season === '冬季') && [...Array(30)].map((_, i) => (
              <line 
                key={`rain-${i}`}
                x1={Math.random()*200} y1={-10} 
                x2={Math.random()*200} y2={10}
                stroke={season === '冬季' ? '#fff' : '#90caf9'}
                strokeWidth={season === '冬季' ? 1 : 0.5}
                className="rain-drop"
                style={{
                  animationDuration: `${0.5 + Math.random()*0.5}s`,
                  animationDelay: `${Math.random()}s`
                }}
              />
           ))}

           {/* 财富粒子 */}
           {wealth > 800 && !isStormy && [...Array(6)].map((_, i) => (
              <circle 
                key={`coin-${i}`}
                cx={40 + Math.random() * 120}
                cy={100}
                r="0.8"
                fill="#ffd700"
                className="smoke-particle"
                style={{animationDelay: `${i*0.5}s`}}
              />
           ))}
        </g>
      </svg>

      {/* 底部信息栏 */}
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