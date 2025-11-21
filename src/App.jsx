import React, { useState, useEffect, useRef } from 'react';
import { getIcon } from './config/iconMap';
import { GAME_SPEEDS, EPOCHS, STRATA, RESOURCES, COUNTRIES, BUILDINGS, TECHS, DECREES } from './config/gameData';
import { simulateTick } from './logic/simulation';

const Icon = ({ name, size = 16, className }) => {
  const Component = getIcon(name);
  if (!Component) return null;
  return <Component size={size} className={className} />;
};

// 视觉组件
const FloatingText = ({ x, y, text, color, onComplete }) => {
  useEffect(() => {
    const timer = setTimeout(onComplete, 800);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div
      className={`fixed pointer-events-none font-bold text-lg z-50 animate-float-up ${color}`}
      style={{ left: x, top: y }}
    >
      {text}
    </div>
  );
};

// 城市地图组件
const CityMap = ({ buildings, epoch }) => {
  const activeTiles = [];
  BUILDINGS.forEach(b => {
    const count = buildings[b.id] || 0;
    for (let i = 0; i < count; i++) {
      activeTiles.push(b);
    }
  });

  const MIN_GRID = 64;
  const emptyCount = Math.max(0, MIN_GRID - activeTiles.length);
  const displayTiles = [...activeTiles, ...Array(emptyCount).fill(null)];

  return (
    <div className="bg-gray-900 p-4 rounded-xl border border-gray-700 shadow-inner overflow-hidden">
      <div className="mb-2 flex justify-between items-center">
        <h3 className="text-xs font-bold uppercase text-gray-400 flex items-center gap-2">
          <Icon name="Globe" size={14} /> 帝国全景视图
        </h3>
        <span className="text-xs text-gray-500">建筑总数: {activeTiles.length}</span>
      </div>

      <div className="grid grid-cols-8 gap-2 aspect-square sm:aspect-video sm:h-64 w-full bg-gray-800/50 rounded-lg p-2 overflow-y-auto content-start">
        {displayTiles.map((b, i) => {
          if (!b) {
            return (
              <div key={i} className={`rounded-sm h-8 sm:h-auto w-full aspect-square opacity-20 ${EPOCHS[epoch].tileColor} transition-colors duration-1000`} />
            );
          }
          const VisualIcon = getIcon(b.visual.icon);
          return (
            <div
              key={i}
              className={`rounded-md aspect-square flex items-center justify-center shadow-lg transform transition-all hover:scale-110 group relative ${b.visual.color} ${b.cat === 'industry' || b.cat === 'gather' ? 'animate-pulse-slow' : ''}`}
              title={b.name}
            >
              {VisualIcon && <VisualIcon size={18} className={`${b.visual.text} group-hover:animate-bounce`} />}
            </div>
          );
        })}
      </div>

      <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden opacity-10">
        <div className="absolute top-10 left-10 w-32 h-12 bg-white rounded-full blur-xl animate-float-slow"></div>
        <div className="absolute top-40 right-20 w-48 h-16 bg-white rounded-full blur-xl animate-float-slower"></div>
      </div>
    </div>
  );
};
// --- 主应用 ---

export default function RiseOfCivs() {
  const [resources, setResources] = useState({ food: 100, wood: 100, stone: 0, plank: 0, brick: 0, iron: 0, tools: 0, gold: 0, science: 0, culture: 0, admin: 0 });
  const [population, setPopulation] = useState(5); 
  const [popStructure, setPopStructure] = useState({}); 
  const [buildings, setBuildings] = useState({});
  const [techsUnlocked, setTechsUnlocked] = useState([]);
  const [epoch, setEpoch] = useState(0);
  const [activeTab, setActiveTab] = useState('build');
  const [gameSpeed, setGameSpeed] = useState(1);
  const [decrees, setDecrees] = useState(DECREES);
  
  const [nations, setNations] = useState(COUNTRIES.map(c => ({ ...c, relation: 50 })));

  const [classApproval, setClassApproval] = useState({});
  const [adminStrain, setAdminStrain] = useState(0);
  const [adminCap, setAdminCap] = useState(20); 

  const [logs, setLogs] = useState(["文明的黎明已至，分配你的人民工作吧。"]);
  const [clicks, setClicks] = useState([]);
  const [maxPop, setMaxPop] = useState(10);
  const [rates, setRates] = useState({});

  const stateRef = useRef({ resources, buildings, population, epoch, techsUnlocked, decrees, gameSpeed, nations });
  useEffect(() => {
    stateRef.current = { resources, buildings, population, epoch, techsUnlocked, decrees, gameSpeed, nations };
  }, [resources, buildings, population, epoch, techsUnlocked, decrees, gameSpeed, nations]);

  const addLog = (msg) => setLogs(prev => [msg, ...prev].slice(0, 8));

  // --- 游戏核心循环 ---
  useEffect(() => {
    const timer = setInterval(() => {
      const current = stateRef.current;
      const result = simulateTick(current);

      setPopStructure(result.popStructure);
      setMaxPop(result.maxPop);
      setAdminCap(result.adminCap);
      setAdminStrain(result.adminStrain);
      setResources(result.resources);
      setRates(result.rates);
      setClassApproval(result.classApproval);
      if (result.population !== current.population) {
        setPopulation(result.population);
      }
      if (result.logs.length) {
        setLogs(prev => [...result.logs, ...prev].slice(0, 8));
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [gameSpeed]);

  // --- 交互函数 ---

  const toggleDecree = (id) => {
    setDecrees(prev => prev.map(d => d.id === id ? { ...d, active: !d.active } : d));
  };

  const buyBuilding = (id) => {
    const b = BUILDINGS.find(x => x.id === id);
    const count = buildings[id] || 0;
    const cost = {};
    for (let k in b.baseCost) cost[k] = b.baseCost[k] * Math.pow(1.15, count);
    
    let canAfford = true;
    for (let k in cost) if ((resources[k] || 0) < cost[k]) canAfford = false;

    if (canAfford) {
      const newRes = { ...resources };
      for (let k in cost) newRes[k] -= cost[k];
      setResources(newRes);
      setBuildings(prev => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
      addLog(`建造了 ${b.name}`);
    }
  };

  const sellBuilding = (id) => {
    if ((buildings[id] || 0) > 0) {
      setBuildings(prev => ({ ...prev, [id]: prev[id] - 1 }));
      addLog(`拆除了 ${BUILDINGS.find(b => b.id === id).name}`);
    }
  };
  
  const manualGather = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setClicks(prev => [...prev, { id: Date.now(), x: e.clientX, y: e.clientY, text: "+1", color: "text-white" }]);
    setResources(prev => ({ ...prev, food: prev.food + 1, wood: prev.wood + 1 }));
  };

  const interactDiplomacy = (countryId, action) => {
    const country = nations.find(n => n.id === countryId);
    if (!country) return;

    if (action === 'trade') {
      if (resources.food >= 50) {
        let goldGain = 10;
        if (country.id === 'republic') goldGain = 20;
        setResources(prev => ({ ...prev, food: prev.food - 50, gold: prev.gold + goldGain }));
        addLog(`与${country.name}贸易：-50 食物, +${goldGain} 黄金`);
      }
    } else if (action === 'gift') {
      if (resources.gold >= 20) {
        let relationGain = 10;
        setResources(prev => ({ ...prev, gold: prev.gold - 20 }));
        setNations(prev => prev.map(n => n.id === countryId ? { ...n, relation: Math.min(100, n.relation + relationGain) } : n));
        addLog(`向${country.name}进贡：关系提升。`);
      }
    } else if (action === 'raid') {
      const successRate = country.id === 'empire' ? 0.3 : 0.6;
      const success = Math.random() < successRate;
      
      setNations(prev => prev.map(n => n.id === countryId ? { ...n, relation: Math.max(0, n.relation - 40) } : n));
      
      if (success) {
        const loot = Math.floor(Math.random() * 100) + 20;
        setResources(prev => ({ ...prev, wood: prev.wood + loot, food: prev.food + loot }));
        addLog(`掠夺${country.name}成功！抢得 ${loot} 资源。`);
      } else {
        setPopulation(prev => Math.max(1, Math.floor(prev * 0.9)));
        addLog(`掠夺${country.name}失败！遭遇抵抗，人口损失。`);
      }
    }
  };

  // --- UI 组件 ---

  return (
    <div className={`min-h-screen font-sans text-gray-100 ${EPOCHS[epoch].bg} transition-colors duration-1000 pb-20`}>
      <style>{`
        @keyframes float-up { 0% { opacity:1; transform:translateY(0); } 100% { opacity:0; transform:translateY(-30px); } }
        .animate-float-up { animation: float-up 0.8s ease-out forwards; }
      `}</style>

      {clicks.map(c => <FloatingText key={c.id} {...c} onComplete={() => setClicks(prev => prev.filter(x => x.id !== c.id))} />)}

      <header className="bg-gray-900/90 backdrop-blur p-4 sticky top-0 z-20 border-b border-gray-700 shadow-xl">
        <div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg shadow-lg shadow-blue-500/20"><Icon name="Globe" size={20} /></div>
            <div>
              <h1 className="font-bold text-lg leading-none text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400">文明崛起</h1>
              <span className={`text-xs font-bold uppercase ${EPOCHS[epoch].color}`}>{EPOCHS[epoch].name}</span>
            </div>
          </div>

          <div className="flex items-center gap-4 bg-gray-800/50 px-4 py-1.5 rounded-full border border-gray-700">
            <div className="flex gap-1" title="行政压力/容量">
               <Icon name="Scale" size={16} className={adminStrain > adminCap ? "text-red-400 animate-pulse" : "text-purple-400"} />
               <span className="font-mono text-sm">{adminStrain.toFixed(0)} / {adminCap}</span>
            </div>
            <div className="w-px h-4 bg-gray-600"></div>
            <div className="flex gap-1" title="总人口">
               <Icon name="Users" size={16} className="text-blue-400" />
               <span className="font-mono text-sm">{population} / {maxPop}</span>
            </div>
          </div>

          <div className="flex bg-gray-800 rounded-lg overflow-hidden border border-gray-700">
            {GAME_SPEEDS.map(s => (
              <button
                key={s}
                onClick={() => setGameSpeed(s)}
                className={`px-3 py-1 text-xs font-bold hover:bg-gray-700 transition-colors ${gameSpeed === s ? 'bg-blue-600 text-white' : 'text-gray-400'}`}
              >
                {s === 1 ? <Icon name="Play" size={12} /> : <div className="flex items-center">{s}x <Icon name="FastForward" size={12} className="ml-1"/></div>}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        <aside className="lg:col-span-3 space-y-4 order-2 lg:order-1">
             <div className="bg-gray-900/60 backdrop-blur rounded-xl p-4 border border-gray-700">
               <h3 className="text-xs font-bold text-gray-500 mb-2 uppercase">资源</h3>
               <div className="space-y-1 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                 {Object.entries(RESOURCES).map(([k, def]) => (
                   <div key={k} className="flex justify-between text-sm">
                  <span className={`flex items-center gap-2 ${def.color}`}><Icon name={def.icon} size={16} /> {def.name}</span>
                     <div className="text-right">
                       <span className="font-mono font-bold">{Math.floor(resources[k] || 0)}</span>
                       <span className="text-[10px] text-gray-500 block leading-none">{rates[k] > 0 ? '+' : ''}{rates[k]?.toFixed(1)}/s</span>
                     </div>
                 </div>
               ))}
             </div>
          </div>

          <div className="bg-gray-900/60 backdrop-blur rounded-xl p-4 border border-gray-700">
             <h3 className="text-xs font-bold text-gray-500 mb-2 uppercase">社会阶层</h3>
             <div className="space-y-2">
               {Object.entries(STRATA).map(([k, def]) => {
                 const count = popStructure[k] || 0;
                 if (count === 0) return null;
                 return (
                  <div key={k} className="bg-gray-800/50 p-2 rounded border border-gray-700/50 flex items-center justify-between group relative">
                    <div className="flex items-center gap-2">
                      <div className="text-gray-400"><Icon name={def.icon} size={14} /></div>
                      <div>
                        <div className="text-xs font-bold text-gray-200">{def.name}</div>
                      </div>
                    </div>
                     <span className="font-mono font-bold text-sm text-white">{count}</span>
                     
                     <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block bg-gray-900 border border-gray-600 p-2 rounded text-xs w-48 z-50 shadow-xl">
                       <p className="font-bold text-white mb-1">{def.name}</p>
                       <p className="text-gray-400 mb-1">{def.desc}</p>
                       <div className="grid grid-cols-2 gap-1 text-gray-500">
                         <span>税基: {def.tax}</span>
                         <span>行政: {def.admin > 0 ? `-${def.admin}` : `+${Math.abs(def.admin)}`}</span>
                       </div>
                     </div>
                   </div>
                 )
               })}
               {population === 0 && <div className="text-xs text-gray-500 text-center italic">暂无人口</div>}
             </div>
          </div>

          <button onClick={manualGather} className="w-full py-3 bg-gradient-to-r from-emerald-700 to-emerald-600 rounded-lg font-bold shadow-lg active:scale-95 transition-transform flex items-center justify-center gap-2">
            <Icon name="Pickaxe" size={16} /> 手动采集
          </button>
        </aside>

        <section className="lg:col-span-6 space-y-6 order-1 lg:order-2">
          <CityMap buildings={buildings} epoch={epoch} />

          <div className="bg-gray-900/60 backdrop-blur rounded-xl border border-gray-700 shadow-xl overflow-hidden min-h-[500px]">
             <div className="flex border-b border-gray-700 bg-gray-800/30 overflow-x-auto">
               {[
                 { id: 'build', label: '建设', icon: 'Hammer' },
                 { id: 'tech', label: '科技', icon: 'Cpu' },
                 { id: 'politics', label: '政令', icon: 'Gavel' },
                 { id: 'diplo', label: '外交', icon: 'Globe' },
               ].map(tab => (
                 <button
                   key={tab.id}
                   onClick={() => setActiveTab(tab.id)}
                   className={`flex-1 min-w-[80px] py-3 flex items-center justify-center gap-2 text-sm font-bold transition-colors ${activeTab === tab.id ? 'bg-gray-700/50 text-white border-b-2 border-blue-500' : 'text-gray-400 hover:bg-gray-800/30'}`}
                 >
                  <Icon name={tab.icon} size={16} /> {tab.label}
                 </button>
               ))}
             </div>

             <div className="p-4">
               {/* 建设页面 */}
               {activeTab === 'build' && (
                 <div className="space-y-3">
                  {BUILDINGS.filter(b => b.epoch <= epoch).map(b => {
                    const count = buildings[b.id] || 0;
                    const cost = {};
                    for(let k in b.baseCost) cost[k] = b.baseCost[k] * Math.pow(1.15, count);
                    const can = Object.keys(cost).every(k => (resources[k]||0) >= cost[k]);
                    const VisualIcon = getIcon(b.visual.icon);

                    return (
                      <div key={b.id} className="bg-gray-800 border border-gray-700 rounded-lg p-3 flex gap-3 hover:border-gray-500 transition-colors group">
                        <div className={`w-12 h-12 rounded flex items-center justify-center shrink-0 ${b.visual.color} bg-opacity-20 text-opacity-80`}>
                          {VisualIcon && <VisualIcon size={20} className={b.visual.text} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between">
                            <h4 className="font-bold text-sm">{b.name} <span className="text-gray-500 text-xs ml-1">Lv.{count}</span></h4>
                            <div className="flex gap-1">
                              {count > 0 && (
                                <button
                                  onClick={() => sellBuilding(b.id)}
                                  className="p-1 rounded bg-red-900/30 text-red-400 hover:bg-red-900/50 border border-red-800/50 transition-colors"
                                  title="拆除 (无返还)"
                                >
                                  <Icon name="Trash2" size={14} />
                                </button>
                              )}
                               <button 
                                 onClick={() => buyBuilding(b.id)}
                                 disabled={!can}
                                 className={`px-3 py-1 rounded text-xs font-bold ${can ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-500'}`}
                               >
                                 建造
                               </button>
                             </div>
                           </div>
                           
                           <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 text-[10px]">
                              {b.output && Object.entries(b.output).map(([k, v]) => (
                                k !== 'maxPop' && k !== 'admin' && (
                                  <div key={k} className="flex items-center text-green-400">
                                    <Icon name="ArrowUpCircle" size={10} className="mr-1" />
                                    产出: {v} {RESOURCES[k]?.name}
                                  </div>
                                )
                              ))}
                              {b.input && Object.entries(b.input).map(([k, v]) => (
                                <div key={k} className="flex items-center text-red-400">
                                  <Icon name="ArrowUpCircle" size={10} className="mr-1 rotate-180" />
                                  消耗: {v} {RESOURCES[k]?.name}
                                </div>
                              ))}
                          </div>

                          <div className="flex gap-2 mt-2 text-[10px] text-gray-500">
                            {b.jobs && Object.entries(b.jobs).map(([role, num]) => (
                              <span key={role} className="flex items-center gap-1 bg-gray-900 px-1.5 rounded border border-gray-700">
                                <Icon name={STRATA[role]?.icon} size={12} /> {STRATA[role]?.name}: {num}
                              </span>
                            ))}
                          </div>
                           
                           <div className="text-[10px] text-gray-500 mt-1 border-t border-gray-700 pt-1">
                             成本: {Object.entries(cost).map(([k, v]) => `${RESOURCES[k].name} ${Math.floor(v)}`).join(', ')}
                           </div>
                         </div>
                       </div>
                     )
                   })}
                 </div>
               )}

               {/* 政令页面 */}
                {activeTab === 'politics' && (
                  <div className="space-y-4">
                    <div className="bg-purple-900/20 border border-purple-500/30 p-3 rounded-lg text-xs text-purple-200 flex items-start gap-2">
                      <Icon name="Scale" size={16} className="shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold">行政管理</p>
                        <p>每个阶层都会产生行政压力。颁布政令需要消耗行政力。如果行政力不足，税收效率将大幅下降。</p>
                      </div>
                   </div>

                   <div className="grid grid-cols-1 gap-3">
                     {decrees.map(d => (
                       <div key={d.id} className={`p-3 rounded-lg border flex justify-between items-center ${d.active ? 'bg-gray-800 border-green-500' : 'bg-gray-800/50 border-gray-700'}`}>
                         <div>
                           <h4 className={`font-bold text-sm ${d.active ? 'text-green-400' : 'text-gray-300'}`}>{d.name}</h4>
                           <p className="text-xs text-gray-400">{d.desc}</p>
                           <p className="text-[10px] text-purple-400 mt-1">消耗: {d.cost.admin} 行政力</p>
                         </div>
                         <button 
                           onClick={() => toggleDecree(d.id)}
                           className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${d.active ? 'bg-green-900 text-green-200 border border-green-700' : 'bg-gray-700 text-gray-400 hover:bg-gray-600'}`}
                         >
                           {d.active ? '生效中' : '颁布'}
                         </button>
                       </div>
                     ))}
                   </div>
                 </div>
               )}

               {/* 科技页面 */}
               {activeTab === 'tech' && (
                  <div className="space-y-3">
                    {TECHS.filter(t => t.epoch <= epoch).map(t => {
                      const unlocked = techsUnlocked.includes(t.id);
                      return (
                        <div key={t.id} className={`p-3 rounded border ${unlocked ? 'bg-gray-800 border-green-900' : 'bg-gray-800/50 border-gray-700'}`}>
                          <div className="flex justify-between">
                            <h4 className="font-bold text-sm text-cyan-300">{t.name}</h4>
                            {!unlocked && (
                              <button 
                                onClick={() => {
                                  if(resources.science >= t.cost.science) {
                                    setResources(r => ({...r, science: r.science - t.cost.science}));
                                    setTechsUnlocked(prev => [...prev, t.id]);
                                    addLog(`研究了 ${t.name}`);
                                  }
                                }}
                                disabled={resources.science < t.cost.science}
                                className="text-xs bg-cyan-900 px-2 py-1 rounded disabled:opacity-50"
                              >
                                研究 ({t.cost.science})
                              </button>
                            )}
                            {unlocked && <span className="text-xs text-green-500">已掌握</span>}
                          </div>
                          <p className="text-xs text-gray-400 mt-1">{t.desc}</p>
                        </div>
                      )
                    })}
                  </div>
               )}

               {/* 外交页面 */}
               {activeTab === 'diplo' && (
                 <div className="space-y-4">
                   {nations.map(country => (
                      <div key={country.id} className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
                        <div className="p-3 border-b border-gray-700 bg-gray-800/80 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${country.id === 'empire' ? 'bg-red-600' : country.id === 'republic' ? 'bg-blue-600' : 'bg-purple-600'}`}>
                              {country.name[0]}
                            </div>
                            <div>
                              <h4 className="font-bold text-white text-sm">{country.name}</h4>
                              <div className={`text-[10px] ${country.color}`}>{country.type}</div>
                            </div>
                          </div>
                          <span className={`font-mono font-bold text-sm ${country.relation < 30 ? 'text-red-400' : country.relation > 70 ? 'text-green-400' : 'text-yellow-400'}`}>
                            {country.relation} 关系
                          </span>
                        </div>
                        
                        <div className="p-2 bg-gray-900/30 text-[10px] text-gray-400 px-3">
                          {country.desc}
                        </div>

                        <div className="p-3 grid grid-cols-3 gap-2">
                          <button onClick={() => interactDiplomacy(country.id, 'trade')} className="py-2 bg-gray-700 hover:bg-blue-600 hover:text-white rounded text-xs font-bold transition-colors flex flex-col items-center gap-1">
                            <Icon name="Handshake" size={14} /> 贸易
                          </button>
                          <button onClick={() => interactDiplomacy(country.id, 'gift')} className="py-2 bg-gray-700 hover:bg-green-600 hover:text-white rounded text-xs font-bold transition-colors flex flex-col items-center gap-1">
                            <Icon name="Crown" size={14} /> 进贡
                          </button>
                          <button onClick={() => interactDiplomacy(country.id, 'raid')} className="py-2 bg-gray-700 hover:bg-red-600 hover:text-white rounded text-xs font-bold transition-colors flex flex-col items-center gap-1">
                            <Icon name="Swords" size={14} /> 掠夺
                          </button>
                        </div>
                      </div>
                    ))}
                 </div>
               )}

             </div>
          </div>
        </section>

        <aside className="lg:col-span-3 order-3 space-y-4">
          <div className="bg-gray-900/60 backdrop-blur rounded-xl border border-gray-700 h-64 flex flex-col">
            <div className="p-2 border-b border-gray-700 text-xs font-bold text-gray-500 uppercase">帝国日志</div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar">
              {logs.map((l, i) => <div key={i} className="text-xs text-gray-300 border-l-2 border-gray-600 pl-2 py-1">{l}</div>)}
            </div>
          </div>
          
          <div className="bg-blue-900/20 border border-blue-500/20 p-4 rounded-xl text-xs text-gray-400 space-y-2">
            <h4 className="font-bold text-blue-300">统治指南</h4>
            <p>• <span className="text-white">人口就是阶层</span>：建筑提供岗位，人口会自动填补岗位成为对应阶层。</p>
            <p>• <span className="text-white">平衡产出</span>：注意查看建筑卡片上的绿色（产出）和红色（消耗）数值。</p>
            <p>• <span className="text-white">外交</span>：初期可以通过掠夺邻国快速获取资源，但要小心报复。</p>
          </div>
        </aside>

      </main>
    </div>
  );
}