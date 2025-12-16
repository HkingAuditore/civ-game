// 将阶层buff/debuff的数值效果格式化为可读文本
const EFFECT_LABELS = {
  production: { label: '基础生产', type: 'percent' },
  industryBonus: { label: '工业产出', type: 'percent' },
  stability: { label: '稳定度', type: 'percent' },
  taxIncome: { label: '税收', type: 'percent' },
  militaryPower: { label: '军事力量', type: 'percent' },
  cultureBonus: { label: '文化产出', type: 'percent' },
  scienceBonus: { label: '科研产出', type: 'percent' },
  incomePercent: { label: '财政收入', type: 'percent' },  // NEW: percentage-based income modifier
};

const formatValue = (value, type) => {
  if (type === 'flat') {
    return `${value > 0 ? '+' : ''}${value}`;
  }
  return `${value > 0 ? '+' : ''}${(value * 100).toFixed(0)}%`;
};

/**
 * 将效果对象转换为简短的描述列表
 * @param {Object} effect - buff/debuff对象
 * @returns {string[]} 可读的效果描述数组
 */
export const formatEffectDetails = (effect = {}) => {
  const details = [];

  Object.entries(EFFECT_LABELS).forEach(([key, { label, type }]) => {
    if (typeof effect[key] === 'number' && effect[key] !== 0) {
      details.push(`${label} ${formatValue(effect[key], type)}`);
    }
  });

  // 收集未在映射表中的其他数值字段，避免遗漏
  Object.entries(effect).forEach(([key, value]) => {
    if (EFFECT_LABELS[key] || ['desc', 'class', 'source', 'name', 'description'].includes(key)) {
      return;
    }
    if (typeof value === 'number' && value !== 0) {
      details.push(`${key} ${value > 0 ? '+' : ''}${value}`);
    }
  });

  return details;
};
