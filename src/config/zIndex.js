/**
 * Z-Index 层级配置
 * 统一管理所有组件的z-index，避免层级冲突
 */

export const Z_INDEX = {
  // 最高层级 - 模态框和全屏弹窗
  MODAL: 100,
  MODAL_OVERLAY: 99,
  
  // 高层级 - 抽屉和侧边栏
  DRAWER: 90,
  DRAWER_OVERLAY: 89,
  
  // 中高层级 - 下拉菜单和弹出框
  DROPDOWN: 80,
  POPOVER: 75,
  
  // 中层级 - Tooltip和提示
  TOOLTIP: 70,
  
  // 游戏控制层级
  GAME_CONTROLS: 60,
  
  // 固定头部和导航
  HEADER: 50,
  BOTTOM_NAV: 50,
  
  // 弹出内容
  POPUP: 40,
  
  // 粘性元素
  STICKY: 30,
  
  // 浮动元素
  FLOATING: 20,
  
  // 基础层级
  BASE: 0,
};

/**
 * 获取Tailwind CSS的z-index类名
 * @param {string} key - Z_INDEX中的键名
 * @returns {string} Tailwind CSS类名
 */
export const getZIndexClass = (key) => {
  const value = Z_INDEX[key];
  if (value === undefined) {
    console.warn(`Unknown z-index key: ${key}`);
    return 'z-0';
  }
  
  // Tailwind默认支持的z-index值
  const tailwindDefaults = [0, 10, 20, 30, 40, 50];
  if (tailwindDefaults.includes(value)) {
    return `z-${value}`;
  }
  
  // 使用方括号语法支持自定义值
  return `z-[${value}]`;
};

export default Z_INDEX;
