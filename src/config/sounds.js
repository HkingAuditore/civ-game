/**
 * 音效配置
 * 定义游戏中所有音效的ID和对应的音频文件
 */

// 使用Web Audio API生成简单的音效
// 这样可以避免需要外部音频文件

/**
 * 生成简单的音效
 */
export const generateSound = (type) => {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  
  const sounds = {
    // UI音效
    click: () => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.1);
    },
    
    success: () => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(523, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(659, audioContext.currentTime + 0.1);
      oscillator.frequency.setValueAtTime(784, audioContext.currentTime + 0.2);
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    },
    
    error: () => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(200, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(150, audioContext.currentTime + 0.1);
      oscillator.type = 'sawtooth';
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.2);
    },
    
    coin: () => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(988, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(1319, audioContext.currentTime + 0.1);
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.15);
    },
    
    build: () => {
      const t = audioContext.currentTime;

      // --- 第一部分：建造过程 (3次敲击声) ---
      // 使用 forEach 在时间轴上安排 0s, 0.25s, 0.5s 的声音
      [0, 0.15].forEach((offset, index) => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        const filter = audioContext.createBiquadFilter(); // 加个滤波器让声音更像实物

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(audioContext.destination);

        // 1. 音色：三角波比方波柔和，适合模拟木头/石块
        osc.type = 'triangle';
        // 2. 音高：基础音高200Hz，中间那一下稍微高一点(220Hz)制造节奏感
        const pitch = index === 1 ? 220 : 200;
        osc.frequency.setValueAtTime(pitch, t + offset);
        // 撞击瞬间音调微降，模拟物理冲击
        osc.frequency.exponentialRampToValueAtTime(pitch * 0.5, t + offset + 0.1);

        // 3. 滤波：低通滤波，去掉刺耳高频，制造“闷”的敲击感
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, t + offset);
        filter.frequency.linearRampToValueAtTime(300, t + offset + 0.1);

        // 4. 包络：极快起音，快速衰减
        gain.gain.setValueAtTime(0, t + offset);
        gain.gain.linearRampToValueAtTime(0.6, t + offset + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.01, t + offset + 0.15);

        osc.start(t + offset);
        osc.stop(t + offset + 0.2);
      });
    },
    
    research: () => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(440, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(554, audioContext.currentTime + 0.05);
      oscillator.frequency.setValueAtTime(659, audioContext.currentTime + 0.1);
      oscillator.frequency.setValueAtTime(880, audioContext.currentTime + 0.15);
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.25, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.25);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.25);
    },
    
    battle: () => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(100, audioContext.currentTime);
      oscillator.frequency.linearRampToValueAtTime(50, audioContext.currentTime + 0.3);
      oscillator.type = 'sawtooth';
      
      gainNode.gain.setValueAtTime(0.4, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.4);
    },
    
    victory: () => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(523, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(659, audioContext.currentTime + 0.1);
      oscillator.frequency.setValueAtTime(784, audioContext.currentTime + 0.2);
      oscillator.frequency.setValueAtTime(1047, audioContext.currentTime + 0.3);
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    },
    
    levelup: () => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(440, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(554, audioContext.currentTime + 0.1);
      oscillator.frequency.setValueAtTime(659, audioContext.currentTime + 0.2);
      oscillator.frequency.setValueAtTime(880, audioContext.currentTime + 0.3);
      oscillator.frequency.setValueAtTime(1109, audioContext.currentTime + 0.4);
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.6);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.6);
    },
    
    notification: () => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.05);
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.25, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.15);
    },
  };
  
  return sounds[type] || sounds.click;
};

/**
 * 音效类型枚举
 */
export const SOUND_TYPES = {
  // UI交互
  CLICK: 'click',
  SUCCESS: 'success',
  ERROR: 'error',
  
  // 游戏事件
  COIN: 'coin',
  BUILD: 'build',
  RESEARCH: 'research',
  BATTLE: 'battle',
  VICTORY: 'victory',
  LEVEL_UP: 'levelup',
  NOTIFICATION: 'notification',
};

/**
 * 音效描述
 */
export const SOUND_DESCRIPTIONS = {
  [SOUND_TYPES.CLICK]: '点击音效',
  [SOUND_TYPES.SUCCESS]: '成功音效',
  [SOUND_TYPES.ERROR]: '错误音效',
  [SOUND_TYPES.COIN]: '金币音效',
  [SOUND_TYPES.BUILD]: '建造音效',
  [SOUND_TYPES.RESEARCH]: '研究音效',
  [SOUND_TYPES.BATTLE]: '战斗音效',
  [SOUND_TYPES.VICTORY]: '胜利音效',
  [SOUND_TYPES.LEVEL_UP]: '升级音效',
  [SOUND_TYPES.NOTIFICATION]: '通知音效',
};
