# 🔊 游戏音效系统说明

## 概述

为《文明崛起》游戏添加了完整的音效系统，提升游戏体验。音效系统使用 Web Audio API 生成音效，无需外部音频文件。

## 功能特性

### ✨ 核心功能

1. **音效管理**
   - 音效开关控制
   - 音量调节（0-100%）
   - 设置自动保存到 localStorage

2. **音效类型**
   - 🖱️ **点击音效** - UI 交互时播放
   - ✅ **成功音效** - 操作成功时播放
   - ❌ **错误音效** - 操作失败时播放
   - 💰 **金币音效** - 获得资源时播放
   - 🏗️ **建造音效** - 建造建筑时播放
   - 🔬 **研究音效** - 研究科技时播放
   - ⚔️ **战斗音效** - 战斗失败时播放
   - 🏆 **胜利音效** - 战斗胜利时播放
   - 📈 **升级音效** - 时代升级时播放
   - 🔔 **通知音效** - 重要通知时播放

### 🎮 集成位置

音效已集成到以下游戏事件中：

1. **建造系统**
   - 建造建筑时播放建造音效

2. **科技系统**
   - 研究科技完成时播放研究音效

3. **时代升级**
   - 升级到新时代时播放升级音效

4. **军事系统**
   - 战斗胜利时播放胜利音效
   - 战斗失败时播放战斗音效

5. **UI 交互**
   - 点击游戏控制按钮时播放点击音效
   - 暂停/继续游戏时播放点击音效
   - 切换游戏速度时播放点击音效

## 使用方法

### 在组件中使用音效

```javascript
import { useSound } from '../hooks';

function MyComponent() {
  const { playSound, SOUND_TYPES, enabled, volume, toggleSound, setVolume } = useSound();
  
  const handleClick = () => {
    playSound(SOUND_TYPES.CLICK);
    // 你的逻辑...
  };
  
  return (
    <button onClick={handleClick}>
      点击我
    </button>
  );
}
```

### 在游戏操作中使用音效

音效已经集成到 `useGameActions` hook 中，在关键操作时自动播放：

```javascript
// 建造建筑时自动播放建造音效
const buyBuilding = (id) => {
  // ... 建造逻辑
  playSound(SOUND_TYPES.BUILD);
};

// 研究科技时自动播放研究音效
const researchTech = (id) => {
  // ... 研究逻辑
  playSound(SOUND_TYPES.RESEARCH);
};
```

## 设置面板

在游戏设置面板中，玩家可以：

1. **开关音效** - 启用或禁用所有游戏音效
2. **调节音量** - 调整音效音量（0-100%）
3. **测试音效** - 点击测试按钮试听不同音效

### 访问设置

1. 点击游戏控制区域的"存档"按钮
2. 选择"设置"选项
3. 在设置面板中找到"音效设置"部分

## 技术实现

### 文件结构

```
src/
├── config/
│   └── sounds.js              # 音效配置和生成器
├── hooks/
│   ├── useSound.js            # 音效 Hook
│   └── index.js               # 导出 useSound
├── utils/
│   └── soundManager.js        # 音效管理器（备用）
└── components/
    ├── panels/
    │   └── SettingsPanel.jsx  # 设置面板（包含音效控制）
    └── layout/
        └── GameControls.jsx   # 游戏控制（集成点击音效）
```

### 音效生成

使用 Web Audio API 的 `OscillatorNode` 和 `GainNode` 生成简单的音效：

```javascript
const generateSound = (type) => {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  
  return () => {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // 配置音效参数
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.1);
  };
};
```

### 优势

1. **无需外部文件** - 所有音效通过代码生成，减小项目体积
2. **即时响应** - 无需加载音频文件，音效播放更快
3. **可定制** - 可以轻松调整音效参数
4. **跨平台兼容** - Web Audio API 在所有现代浏览器中都支持

## 浏览器兼容性

音效系统使用 Web Audio API，支持以下浏览器：

- ✅ Chrome 34+
- ✅ Firefox 25+
- ✅ Safari 14.1+
- ✅ Edge 79+
- ✅ Opera 21+

## 注意事项

1. **自动播放限制** - 某些浏览器可能限制自动播放音频，需要用户先进行交互
2. **性能考虑** - 音效生成使用 Web Audio API，性能开销很小
3. **音量控制** - 建议玩家根据个人喜好调整音量
4. **禁用选项** - 玩家可以随时在设置中关闭音效

## 未来扩展

可以考虑添加以下功能：

1. **背景音乐** - 添加不同时代的背景音乐
2. **环境音效** - 添加环境氛围音效
3. **更多音效** - 为更多游戏事件添加音效
4. **音效主题** - 提供不同的音效风格选择
5. **音频文件支持** - 支持加载外部音频文件

## 开发者指南

### 添加新音效

1. 在 `src/config/sounds.js` 中添加新的音效生成器：

```javascript
export const SOUND_TYPES = {
  // ... 现有音效
  NEW_SOUND: 'new_sound',
};

const sounds = {
  // ... 现有音效
  new_sound: () => {
    // 音效生成逻辑
  },
};
```

2. 在需要的地方使用新音效：

```javascript
playSound(SOUND_TYPES.NEW_SOUND);
```

### 调整音效参数

修改 `src/config/sounds.js` 中对应音效的参数：

- `frequency` - 音调（Hz）
- `type` - 波形类型（'sine', 'square', 'sawtooth', 'triangle'）
- `gain` - 音量
- `duration` - 持续时间

## 总结

音效系统为游戏增添了听觉反馈，提升了玩家的沉浸感和游戏体验。系统设计简洁高效，易于扩展和维护。
