// 将阶层buff/debuff的数值效果格式化为可读文本
const EFFECT_LABELS = {
  production: { label: '基础生产', type: 'percent' },
  industryBonus: { label: '工业产出', type: 'percent' },
  stability: { label: '稳定度', type: 'percent' },
  taxIncome: { label: '税收', type: 'percent' },
  militaryPower: { label: '军事力量', type: 'percent' },
  cultureBonus: { label: '文化产出', type: 'percent' },
  scienceBonus: { label: '科研产出', type: 'percent' },
  incomePercent: { label: '财政收入加成', type: 'percent' },  // NEW: percentage-based income modifier
};

// 外交关系描述映射
const RELATION_DESCRIPTIONS = {
  hostile: { label: '敌对', color: 'text-red-400', icon: 'Angry' },
  unfriendly: { label: '不友好', color: 'text-orange-400', icon: 'Frown' },
  neutral: { label: '中立', color: 'text-gray-400', icon: 'Meh' },
  friendly: { label: '友好', color: 'text-green-400', icon: 'Smile' },
  allied: { label: '同盟', color: 'text-blue-400', icon: 'Heart' },
};

// 附庸类型描述映射
const VASSAL_TYPE_DESCRIPTIONS = {
  protectorate: { label: '保护国', description: '宽松政策，低朝贡', color: 'text-cyan-400' },
  tributary: { label: '朝贡国', description: '常规控制，定期朝贡', color: 'text-yellow-400' },
  puppet: { label: '傀儡国', description: '严密控制，高度干预', color: 'text-orange-400' },
  colony: { label: '殖民地', description: '完全控制，最大收益', color: 'text-red-400' },
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

/**
 * 获取关系等级描述
 * @param {number} relation - 关系值 (0-100)
 * @returns {Object} 关系描述对象 {label, color, icon}
 */
export const getRelationDescription = (relation) => {
  if (relation < 20) return RELATION_DESCRIPTIONS.hostile;
  if (relation < 40) return RELATION_DESCRIPTIONS.unfriendly;
  if (relation < 60) return RELATION_DESCRIPTIONS.neutral;
  if (relation < 80) return RELATION_DESCRIPTIONS.friendly;
  return RELATION_DESCRIPTIONS.allied;
};

/**
 * 获取附庸类型描述
 * @param {string} vassalType - 附庸类型
 * @returns {Object} 附庸类型描述对象
 */
export const getVassalTypeDescription = (vassalType) => {
  return VASSAL_TYPE_DESCRIPTIONS[vassalType] || {
    label: '附庸',
    description: '附属关系',
    color: 'text-gray-400',
  };
};

/**
 * 格式化外交行动结果
 * @param {string} actionType - 行动类型
 * @param {Object} result - 行动结果
 * @returns {string} 格式化的结果描述
 */
export const formatDiplomaticActionResult = (actionType, result) => {
  const actionLabels = {
    gift: '赠礼',
    provoke: '挑衅',
    sign_treaty: '签订条约',
    break_treaty: '撕毁条约',
    declare_war: '宣战',
    peace_offer: '求和',
    establish_vassal: '建立附庸',
    release_vassal: '释放附庸',
    establish_overseas_investment: '建立海外投资',
    withdraw_overseas_investment: '撤回投资',
    nationalize_foreign_investment: '国有化外资',
  };

  const actionLabel = actionLabels[actionType] || actionType;

  if (result.success) {
    return `✅ ${actionLabel}成功${result.message ? '：' + result.message : ''}`;
  } else {
    return `❌ ${actionLabel}失败${result.reason ? '：' + result.reason : ''}`;
  }
};

/**
 * 格式化独立倾向显示
 * @param {number} desire - 独立倾向值 (0-100)
 * @returns {Object} 格式化结果 {text, color, warning}
 */
export const formatIndependenceDesire = (desire) => {
  if (desire < 20) {
    return { text: '稳定', color: 'text-green-400', warning: false };
  }
  if (desire < 40) {
    return { text: '略有不满', color: 'text-yellow-400', warning: false };
  }
  if (desire < 60) {
    return { text: '不满情绪', color: 'text-orange-400', warning: true };
  }
  if (desire < 80) {
    return { text: '危险', color: 'text-red-400', warning: true };
  }
  return { text: '即将独立', color: 'text-red-500', warning: true };
};

/**
 * 格式化贸易利润显示
 * @param {number} profit - 利润值
 * @param {string} mode - 运营模式
 * @returns {string} 格式化的利润描述
 */
export const formatTradeProfit = (profit, mode = 'local') => {
  const modeLabels = {
    local: '当地运营',
    dumping: '倾销模式',
    buyback: '回购模式',
  };

  const modeLabel = modeLabels[mode] || mode;
  const profitSign = profit >= 0 ? '+' : '';

  return `${modeLabel}：${profitSign}${profit.toFixed(1)}/天`;
};

/**
 * 格式化朝贡金额
 * @param {number} tribute - 朝贡金额
 * @param {string} frequency - 朝贡频率 ('daily' | 'monthly' | 'yearly')
 * @returns {string} 格式化的朝贡描述
 */
export const formatTributeAmount = (tribute, frequency = 'monthly') => {
  const frequencyLabels = {
    daily: '日',
    monthly: '月',
    yearly: '年',
  };

  const freqLabel = frequencyLabels[frequency] || frequency;
  return `${tribute.toFixed(0)} 银币/${freqLabel}`;
};

/**
 * 格式化条约剩余时间
 * @param {number} remainingDays - 剩余天数
 * @returns {string} 格式化的时间描述
 */
export const formatTreatyDuration = (remainingDays) => {
  if (remainingDays <= 0) return '已到期';
  if (remainingDays < 30) return `${remainingDays}天`;
  if (remainingDays < 360) return `${Math.floor(remainingDays / 30)}个月`;
  return `${(remainingDays / 360).toFixed(1)}年`;
};
