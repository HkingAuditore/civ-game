/**
 * 音效配置
 * 定义游戏中所有音效的ID和对应的音频文件
 */

// 使用Web Audio API生成简单的音效
// 这样可以避免需要外部音频文件

// 检查浏览器是否支持 AudioContext
const AudioContextClass = typeof window !== 'undefined' 
  ? (window.AudioContext || window.webkitAudioContext) 
  : null;

/**
 * 生成简单的音效
 */
export const generateSound = (type) => {
  // 如果浏览器不支持 AudioContext，返回一个空函数
  if (!AudioContextClass) {
    console.warn('AudioContext 不可用，音效功能已禁用');
    return () => {};
  }

  let audioContext;
  try {
    audioContext = new AudioContextClass();
  } catch (e) {
    console.warn('无法创建 AudioContext:', e.message);
    return () => {};
  }
  const sounds = {
    // UI音效
    click: () => {
      // 柔和的点击声: 短促的白噪音 + 快速衰减
      const gainNode = audioContext.createGain();
      
      const filter = audioContext.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 1000;

      // 白噪音生成
      const bufferSize = audioContext.sampleRate * 0.1; // 0.1秒
      const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      
      const noise = audioContext.createBufferSource();
      noise.buffer = buffer;
      
      noise.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      const t = audioContext.currentTime;
      gainNode.gain.setValueAtTime(0.05, t);
      gainNode.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      
      noise.start(t);
      noise.stop(t + 0.05);
    },
    
    success: () => {
      // 成功音效: 柔和的大调和弦 (C Major 7)
      const t = audioContext.currentTime;
      const notes = [523.25, 659.25, 783.99, 987.77]; // C5, E5, G5, B5
      
      notes.forEach((freq, index) => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        
        osc.frequency.value = freq;
        osc.type = 'sine'; // 正弦波最柔和
        
        osc.connect(gain);
        gain.connect(audioContext.destination);
        
        // 稍微错开起音时间，产生琵琶音效果
        const startTime = t + index * 0.05;
        
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.1, startTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.8);
        
        osc.start(startTime);
        osc.stop(startTime + 0.8);
      });
    },
    
    error: () => {
      // 错误音效: 低频闷响，避免刺耳的锯齿波
      const t = audioContext.currentTime;
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const filter = audioContext.createBiquadFilter();
      
      osc.type = 'triangle'; // 三角波比锯齿波柔和
      osc.frequency.setValueAtTime(150, t);
      osc.frequency.linearRampToValueAtTime(100, t + 0.15);
      
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(400, t);
      
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(audioContext.destination);
      
      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      
      osc.start(t);
      osc.stop(t + 0.2);
    },
    
    coin: () => {
      // 金币/资源: 清脆的铃声 (FM合成模拟)
      const t = audioContext.currentTime;
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      
      // 添加泛音
      const harmonics = [1, 2.5]; 
      harmonics.forEach(h => {
          const hOsc = audioContext.createOscillator();
          const hGain = audioContext.createGain();
          hOsc.frequency.value = 1200 * h;
          hOsc.type = 'sine';
          hOsc.connect(hGain);
          hGain.connect(audioContext.destination);
          hGain.gain.setValueAtTime(0.05 / h, t);
          hGain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
          hOsc.start(t);
          hOsc.stop(t + 0.3);
      });

      osc.frequency.setValueAtTime(1200, t);
      osc.type = 'sine';
      
      osc.connect(gain);
      gain.connect(audioContext.destination);
      
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.1, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      
      osc.start(t);
      osc.stop(t + 0.4);
    },
    
    build: () => {
      // 建造: 模仿敲击声 (带滤波的脉冲/噪音)
      const t = audioContext.currentTime;
      
      // 双重敲击
      [0, 0.2].forEach(offset => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        const filter = audioContext.createBiquadFilter();
        
        osc.type = 'square';
        osc.frequency.value = 100; // 低频
        
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, t + offset);
        filter.frequency.exponentialRampToValueAtTime(100, t + offset + 0.1);
        filter.Q.value = 5; // 增加共振模拟材质感
        
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(audioContext.destination);
        
        gain.gain.setValueAtTime(0.15, t + offset);
        gain.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.15);
        
        osc.start(t + offset);
        osc.stop(t + offset + 0.15);
      });
    },
    
    research: () => {
      // 研究: 科技感的琶音
      const t = audioContext.currentTime;
      const freqs = [440, 554, 659, 880, 1108]; // A Major
      
      freqs.forEach((f, i) => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        
        osc.type = 'sine';
        osc.frequency.value = f;
        
        osc.connect(gain);
        gain.connect(audioContext.destination);
        
        const start = t + i * 0.04;
        gain.gain.setValueAtTime(0.05, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.2);
        
        osc.start(start);
        osc.stop(start + 0.2);
      });
    },
    
    battle: () => {
      // 战斗: 低沉的冲击声 + 噪音 (模拟鼓/爆炸)
      const t = audioContext.currentTime;
      
      // 冲击部分
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      
      osc.frequency.setValueAtTime(150, t);
      osc.frequency.exponentialRampToValueAtTime(40, t + 0.15);
      osc.type = 'triangle';
      
      osc.connect(gain);
      gain.connect(audioContext.destination);
      
      gain.gain.setValueAtTime(0.3, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      
      osc.start(t);
      osc.stop(t + 0.2);
      
      // 擦片/噪音部分
      const noiseGain = audioContext.createGain();
      const nFilter = audioContext.createBiquadFilter();
      nFilter.type = 'bandpass';
      nFilter.frequency.value = 2000;
      
      const bufferSize = audioContext.sampleRate * 0.2;
      const buffer = audioContext.createBuffer(1, bufferSize, audioContext.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
      
      const noise = audioContext.createBufferSource();
      noise.buffer = buffer;
      
      noise.connect(nFilter);
      nFilter.connect(noiseGain);
      noiseGain.connect(audioContext.destination);
      
      noiseGain.gain.setValueAtTime(0.1, t);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
      
      noise.start(t);
      noise.stop(t + 0.1);
    },
    
    victory: () => {
      // 胜利: 宏大的C大调和弦
      const t = audioContext.currentTime;
      const chord = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5
      
      chord.forEach((f, i) => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        
        osc.type = i === 0 ? 'triangle' : 'sine'; // 根音用三角波增加厚度
        osc.frequency.value = f;
        
        osc.connect(gain);
        gain.connect(audioContext.destination);
        
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.15, t + 0.1); // 缓慢进入
        gain.gain.exponentialRampToValueAtTime(0.001, t + 2.0); // 长尾音
        
        osc.start(t);
        osc.stop(t + 2.0);
      });
    },
    
    levelup: () => {
      // 升级: 快速上升音阶
      const t = audioContext.currentTime;
      const freqs = [523, 659, 784, 1046];
      
      freqs.forEach((f, i) => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        
        osc.frequency.value = f;
        osc.type = 'sine';
        
        osc.connect(gain);
        gain.connect(audioContext.destination);
        
        const start = t + i * 0.08;
        gain.gain.setValueAtTime(0.1, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.3);
        
        osc.start(start);
        osc.stop(start + 0.3);
      });
    },
    
    notification: () => {
      // 通知: 柔和的水泡声
      const t = audioContext.currentTime;
      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();
      
      osc.frequency.setValueAtTime(600, t);
      osc.frequency.exponentialRampToValueAtTime(1200, t + 0.1);
      osc.type = 'sine';
      
      osc.connect(gain);
      gain.connect(audioContext.destination);
      
      gain.gain.setValueAtTime(0.1, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
      
      osc.start(t);
      osc.stop(t + 0.1);
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
  EVENT: 'event',
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
  [SOUND_TYPES.EVENT]: '事件音效',
};
