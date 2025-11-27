/**
 * 音效管理器
 * 管理游戏中的所有音效和背景音乐
 */

class SoundManager {
  constructor() {
    this.sounds = new Map();
    this.bgm = null;
    this.enabled = true;
    this.volume = 0.5;
    this.bgmVolume = 0.3;
    
    // 从localStorage加载设置
    this.loadSettings();
  }

  /**
   * 加载设置
   */
  loadSettings() {
    try {
      const settings = localStorage.getItem('sound_settings');
      if (settings) {
        const parsed = JSON.parse(settings);
        this.enabled = parsed.enabled !== false;
        this.volume = parsed.volume ?? 0.5;
        this.bgmVolume = parsed.bgmVolume ?? 0.3;
      }
    } catch (e) {
      console.warn('Failed to load sound settings:', e);
    }
  }

  /**
   * 保存设置
   */
  saveSettings() {
    try {
      localStorage.setItem('sound_settings', JSON.stringify({
        enabled: this.enabled,
        volume: this.volume,
        bgmVolume: this.bgmVolume,
      }));
    } catch (e) {
      console.warn('Failed to save sound settings:', e);
    }
  }

  /**
   * 预加载音效
   * @param {string} id - 音效ID
   * @param {string} url - 音效URL
   */
  preload(id, url) {
    if (this.sounds.has(id)) return;
    
    const audio = new Audio(url);
    audio.preload = 'auto';
    this.sounds.set(id, audio);
  }

  /**
   * 播放音效
   * @param {string} id - 音效ID
   * @param {Object} options - 播放选项
   */
  play(id, options = {}) {
    if (!this.enabled) return;
    
    const audio = this.sounds.get(id);
    if (!audio) {
      console.warn(`Sound ${id} not found`);
      return;
    }

    try {
      // 克隆音频以支持同时播放多个相同音效
      const clone = audio.cloneNode();
      clone.volume = (options.volume ?? this.volume) * (this.enabled ? 1 : 0);
      
      const playPromise = clone.play();
      if (playPromise !== undefined) {
        playPromise.catch(e => {
          console.warn(`Failed to play sound ${id}:`, e);
        });
      }
    } catch (e) {
      console.warn(`Error playing sound ${id}:`, e);
    }
  }

  /**
   * 播放背景音乐
   * @param {string} url - 音乐URL
   */
  playBGM(url) {
    if (!this.enabled) return;
    
    // 停止当前背景音乐
    this.stopBGM();
    
    try {
      this.bgm = new Audio(url);
      this.bgm.loop = true;
      this.bgm.volume = this.bgmVolume;
      
      const playPromise = this.bgm.play();
      if (playPromise !== undefined) {
        playPromise.catch(e => {
          console.warn('Failed to play BGM:', e);
        });
      }
    } catch (e) {
      console.warn('Error playing BGM:', e);
    }
  }

  /**
   * 停止背景音乐
   */
  stopBGM() {
    if (this.bgm) {
      this.bgm.pause();
      this.bgm.currentTime = 0;
      this.bgm = null;
    }
  }

  /**
   * 设置音效开关
   * @param {boolean} enabled - 是否启用
   */
  setEnabled(enabled) {
    this.enabled = enabled;
    
    // 如果禁用，停止背景音乐
    if (!enabled && this.bgm) {
      this.bgm.pause();
    } else if (enabled && this.bgm) {
      this.bgm.play().catch(e => console.warn('Failed to resume BGM:', e));
    }
    
    this.saveSettings();
  }

  /**
   * 设置音效音量
   * @param {number} volume - 音量 (0-1)
   */
  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume));
    this.saveSettings();
  }

  /**
   * 设置背景音乐音量
   * @param {number} volume - 音量 (0-1)
   */
  setBGMVolume(volume) {
    this.bgmVolume = Math.max(0, Math.min(1, volume));
    if (this.bgm) {
      this.bgm.volume = this.bgmVolume;
    }
    this.saveSettings();
  }

  /**
   * 获取当前设置
   */
  getSettings() {
    return {
      enabled: this.enabled,
      volume: this.volume,
      bgmVolume: this.bgmVolume,
    };
  }
}

// 创建单例
const soundManager = new SoundManager();

export default soundManager;
