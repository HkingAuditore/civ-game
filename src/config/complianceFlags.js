/**
 * 内容合规开关
 *
 * 用途：在不改动任何玩法数值、存档结构与核心逻辑的前提下，
 * 控制涉及政治、宗教等高敏感语义的内容是否在界面上出现。
 *
 * 每一项都可以独立开关，关闭后仅影响界面文案与展示，
 * 官员数值、理念效果、判定条件等全部保持不变。
 */
export const COMPLIANCE_FLAGS = {
    /** 隐藏官员「做事主张」的名称、在意的事、类型标签与条件文案 */
    hideOfficialStance: false,
};

export const isFlagOn = (key) => COMPLIANCE_FLAGS[key] === true;
