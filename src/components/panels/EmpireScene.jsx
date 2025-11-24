import React, { useEffect, useState } from 'react';

/**
 * EmpireScene - 帝国场景可视化组件
 * 使用SVG和CSS动画艺术化地展示游戏状态
 * 
 * @param {number} daysElapsed - 已过天数（用于日夜循环）
 * @param {string} season - 当前季节（春季/夏季/秋季/冬季）
 * @param {number} population - 当前人口
 * @param {number} stability - 稳定度 (0-100)
 * @param {number} wealth - 财富（银币数量）
 */
export default function EmpireScene({ 
  daysElapsed = 0, 
  season = '春季', 
  population = 0, 
  stability = 100, 
  wealth = 0 
}) {
  // 日夜循环状态（每5秒一个周期）
  const [dayProgress, setDayProgress] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setDayProgress(prev => (prev + 0.02) % 1); // 5秒完整周期
    }, 100);
    return () => clearInterval(interval);
  }, []);

  // 计算天空颜色（日夜循环）
  const getSkyGradient = () => {
    const progress = dayProgress;
    
    if (progress < 0.25) {
      // 黎明 (0-0.25): 深蓝 -> 浅蓝
      const t = progress / 0.25;
      return {
        from: `rgb(${25 + t * 110}, ${25 + t * 125}, ${60 + t * 140})`,
        to: `rgb(${60 + t * 75}, ${60 + t * 100}, ${100 + t * 100})`
      };
    } else if (progress < 0.5) {
      // 白天 (0.25-0.5): 浅蓝 -> 橙色
      const t = (progress - 0.25) / 0.25;
      return {
        from: `rgb(${135 + t * 120}, ${150 + t * 105}, ${200 - t * 50})`,
        to: `rgb(${135 + t * 120}, ${160 - t * 60}, ${200 - t * 100})`
      };
    } else if (progress < 0.75) {
      // 黄昏 (0.5-0.75): 橙色 -> 深蓝
      const t = (progress - 0.5) / 0.25;
      return {
        from: `rgb(${255 - t * 230}, ${255 - t * 230}, ${150 - t * 90})`,
        to: `rgb(${255 - t * 195}, ${100 - t * 40}, ${100 - t * 40})`
      };
    } else {
      // 夜晚 (0.75-1): 深蓝 -> 紫色
      const t = (progress - 0.75) / 0.25;
      return {
        from: `rgb(${25}, ${25 + t * 10}, ${60 + t * 40})`,
        to: `rgb(${60 - t * 20}, ${60 - t * 20}, ${100 + t * 50})`
      };
    }
  };

  const skyGradient = getSkyGradient();
  const isNight = dayProgress > 0.6 || dayProgress < 0.15;
  
  // 太阳/月亮位置
  const celestialY = 30 + Math.sin(dayProgress * Math.PI * 2) * -20;
  const celestialX = 20 + dayProgress * 160;

  // 季节配置
  const seasonConfig = {
    '春季': {
      groundColor: '#7cb342',
      treeColor: '#558b2f',
      particleColor: '#ffc0cb',
      showFlowers: true
    },
    '夏季': {
      groundColor: '#8bc34a',
      treeColor: '#689f38',
      particleColor: '#ffeb3b',
      showFlowers: false
    },
    '秋季': {
      groundColor: '#d4a574',
      treeColor: '#bf8040',
      particleColor: '#ff9800',
      showFlowers: false
    },
    '冬季': {
      groundColor: '#e8f4f8',
      treeColor: '#8d6e63',
      particleColor: '#ffffff',
      showFlowers: false
    }
  };

  const currentSeason = seasonConfig[season] || seasonConfig['春季'];

  // 计算房屋数量
  const houseCount = Math.min(Math.floor(population / 5), 20);
  const showCampfire = population < 10;
  const isProsperous = population > 100;

  // 稳定度影响天气
  const weatherState = stability > 80 ? 'clear' : stability > 40 ? 'cloudy' : 'stormy';

  // 财富效果
  const showSparkles = wealth > 500;

  return (
    <div className="rounded-xl overflow-hidden border border-gray-700 shadow-2xl">
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        @keyframes drift {
          0% { transform: translateX(0); }
          100% { transform: translateX(-200px); }
        }
        @keyframes twinkle {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 1; }
        }
        @keyframes sparkle {
          0% { transform: translateY(0) scale(1); opacity: 1; }
          100% { transform: translateY(-30px) scale(0); opacity: 0; }
        }
        @keyframes lightning {
          0%, 100% { opacity: 0; }
          50% { opacity: 0.8; }
        }
        .float-anim { animation: float 3s ease-in-out infinite; }
        .drift-anim { animation: drift 20s linear infinite; }
        .twinkle-anim { animation: twinkle 2s ease-in-out infinite; }
        .sparkle-anim { animation: sparkle 2s ease-out infinite; }
        .lightning-anim { animation: lightning 0.2s ease-in-out; }
      `}</style>

      <svg 
        viewBox="0 0 200 120" 
        className="w-full h-48"
        style={{ background: `linear-gradient(to bottom, ${skyGradient.from}, ${skyGradient.to})` }}
      >
        {/* 星星（夜晚） */}
        {isNight && (
          <g>
            {[...Array(15)].map((_, i) => (
              <circle
                key={`star-${i}`}
                cx={10 + (i * 13) % 180}
                cy={10 + (i * 7) % 40}
                r="0.8"
                fill="white"
                className="twinkle-anim"
                style={{ animationDelay: `${i * 0.2}s` }}
              />
            ))}
          </g>
        )}

        {/* 太阳/月亮 */}
        <circle
          cx={celestialX}
          cy={celestialY}
          r="8"
          fill={isNight ? '#f0f0f0' : '#ffd700'}
          opacity={isNight ? 0.9 : 1}
        />
        {isNight && (
          <circle
            cx={celestialX + 3}
            cy={celestialY - 2}
            r="6"
            fill={skyGradient.from}
          />
        )}

        {/* 云朵 */}
        {weatherState !== 'clear' && (
          <g className="drift-anim">
            <ellipse cx="220" cy="25" rx="15" ry="8" fill={weatherState === 'stormy' ? '#555' : '#fff'} opacity="0.7" />
            <ellipse cx="230" cy="25" rx="12" ry="7" fill={weatherState === 'stormy' ? '#555' : '#fff'} opacity="0.7" />
            <ellipse cx="240" cy="25" rx="15" ry="8" fill={weatherState === 'stormy' ? '#555' : '#fff'} opacity="0.7" />
            
            <ellipse cx="270" cy="35" rx="18" ry="9" fill={weatherState === 'stormy' ? '#555' : '#fff'} opacity="0.6" />
            <ellipse cx="285" cy="35" rx="15" ry="8" fill={weatherState === 'stormy' ? '#555' : '#fff'} opacity="0.6" />
          </g>
        )}

        {/* 闪电（低稳定度） */}
        {weatherState === 'stormy' && (
          <path
            d="M 100 20 L 95 40 L 100 40 L 95 60"
            stroke="#ffeb3b"
            strokeWidth="1.5"
            fill="none"
            className="lightning-anim"
            style={{ animationDelay: `${Math.random() * 3}s` }}
          />
        )}

        {/* 雨滴（中低稳定度） */}
        {weatherState === 'stormy' && (
          <g>
            {[...Array(20)].map((_, i) => (
              <line
                key={`rain-${i}`}
                x1={10 + i * 10}
                y1={30 + (i % 3) * 10}
                x2={10 + i * 10}
                y2={35 + (i % 3) * 10}
                stroke="#4fc3f7"
                strokeWidth="0.5"
                opacity="0.6"
              />
            ))}
          </g>
        )}

        {/* 飞鸟（高稳定度） */}
        {weatherState === 'clear' && !isNight && (
          <g className="float-anim">
            <path d="M 150 30 Q 145 28 140 30" stroke="#333" strokeWidth="1" fill="none" />
            <path d="M 150 30 Q 155 28 160 30" stroke="#333" strokeWidth="1" fill="none" />
          </g>
        )}

        {/* 地面 */}
        <rect
          x="0"
          y="80"
          width="200"
          height="40"
          fill={currentSeason.groundColor}
        />

        {/* 树木 */}
        {[30, 60, 170].map((x, i) => (
          <g key={`tree-${i}`}>
            {/* 树干 */}
            <rect
              x={x - 2}
              y={season === '冬季' ? 70 : 65}
              width="4"
              height={season === '冬季' ? 15 : 20}
              fill={currentSeason.treeColor}
            />
            {/* 树叶 */}
            {season !== '冬季' && (
              <>
                <circle cx={x} cy={65} r="8" fill={currentSeason.treeColor} opacity="0.8" />
                <circle cx={x - 5} cy={68} r="6" fill={currentSeason.treeColor} opacity="0.7" />
                <circle cx={x + 5} cy={68} r="6" fill={currentSeason.treeColor} opacity="0.7" />
              </>
            )}
          </g>
        ))}

        {/* 营火（低人口） */}
        {showCampfire && (
          <g>
            <polygon points="100,85 95,95 105,95" fill="#8d6e63" />
            <polygon points="100,80 97,85 103,85" fill="#ff6f00" className="float-anim" />
            <polygon points="100,77 98,82 102,82" fill="#ffeb3b" className="float-anim" />
          </g>
        )}

        {/* 房屋（人口） */}
        {!showCampfire && (
          <g>
            {[...Array(houseCount)].map((_, i) => {
              const row = Math.floor(i / 5);
              const col = i % 5;
              const x = 40 + col * 25;
              const y = 85 - row * 12;
              const houseColor = isProsperous ? '#795548' : '#a1887f';
              
              return (
                <g key={`house-${i}`}>
                  {/* 房屋主体 */}
                  <rect
                    x={x}
                    y={y}
                    width="12"
                    height="10"
                    fill={houseColor}
                    stroke="#5d4037"
                    strokeWidth="0.5"
                  />
                  {/* 屋顶 */}
                  <polygon
                    points={`${x},${y} ${x + 6},${y - 5} ${x + 12},${y}`}
                    fill={isProsperous ? '#d32f2f' : '#8d6e63'}
                    stroke="#5d4037"
                    strokeWidth="0.5"
                  />
                  {/* 窗户 */}
                  <rect
                    x={x + 3}
                    y={y + 3}
                    width="2.5"
                    height="2.5"
                    fill="#ffeb3b"
                    opacity={isNight ? 0.9 : 0.3}
                  />
                  <rect
                    x={x + 6.5}
                    y={y + 3}
                    width="2.5"
                    height="2.5"
                    fill="#ffeb3b"
                    opacity={isNight ? 0.9 : 0.3}
                  />
                </g>
              );
            })}
          </g>
        )}

        {/* 财富闪光效果 */}
        {showSparkles && (
          <g>
            {[...Array(8)].map((_, i) => (
              <circle
                key={`sparkle-${i}`}
                cx={50 + i * 20}
                cy={85}
                r="1.5"
                fill="#ffd700"
                className="sparkle-anim"
                style={{ animationDelay: `${i * 0.3}s` }}
              />
            ))}
          </g>
        )}

        {/* 季节粒子效果 */}
        {currentSeason.showFlowers && (
          <g>
            {[...Array(10)].map((_, i) => (
              <circle
                key={`particle-${i}`}
                cx={20 + i * 18}
                cy={75 + (i % 3) * 3}
                r="1.5"
                fill={currentSeason.particleColor}
                opacity="0.6"
                className="float-anim"
                style={{ animationDelay: `${i * 0.2}s` }}
              />
            ))}
          </g>
        )}

        {/* 冬季雪花 */}
        {season === '冬季' && (
          <g>
            {[...Array(15)].map((_, i) => (
              <circle
                key={`snow-${i}`}
                cx={10 + i * 13}
                cy={50 + (i % 4) * 8}
                r="1"
                fill="white"
                opacity="0.8"
                className="float-anim"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </g>
        )}
      </svg>

      {/* 底部信息栏 */}
      <div className="bg-gray-900/80 backdrop-blur px-3 py-2 flex justify-between items-center text-xs">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${
            weatherState === 'clear' ? 'bg-green-400' : 
            weatherState === 'cloudy' ? 'bg-yellow-400' : 
            'bg-red-400'
          }`} />
          <span className="text-gray-400">
            {season} · {isNight ? '夜晚' : '白天'}
          </span>
        </div>
        {/* <div className="text-gray-500">
          {population > 0 ? `${houseCount} 建筑` : '未定居'}
        </div> */}
      </div>
    </div>
  );
}
