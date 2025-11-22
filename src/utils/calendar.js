const MONTHS_PER_YEAR = 12;
const DAYS_PER_MONTH = 30;
const MONTH_NAMES = [
  '一月',
  '二月',
  '三月',
  '四月',
  '五月',
  '六月',
  '七月',
  '八月',
  '九月',
  '十月',
  '十一月',
  '十二月',
];

const SEASONS = [
  { name: '春季', months: [1, 2, 3] },
  { name: '夏季', months: [4, 5, 6] },
  { name: '秋季', months: [7, 8, 9] },
  { name: '冬季', months: [10, 11, 12] },
];

export const getCalendarInfo = (daysElapsed = 0) => {
  const totalDays = Math.max(0, Math.floor(daysElapsed)) + 1;
  const daysPerYear = MONTHS_PER_YEAR * DAYS_PER_MONTH;
  const year = Math.floor((totalDays - 1) / daysPerYear) + 1;
  const dayOfYear = ((totalDays - 1) % daysPerYear) + 1;
  const month = Math.floor((dayOfYear - 1) / DAYS_PER_MONTH) + 1;
  const dayOfMonth = ((dayOfYear - 1) % DAYS_PER_MONTH) + 1;
  const monthName = MONTH_NAMES[month - 1] || `${month}月`;
  const season = SEASONS.find((entry) => entry.months.includes(month)) || SEASONS[0];
  const seasonDay = ((season.months.indexOf(month) * DAYS_PER_MONTH) + dayOfMonth);

  return {
    totalDays,
    year,
    month,
    monthName,
    day: dayOfMonth,
    dayOfYear,
    season: season.name,
    seasonIndex: SEASONS.indexOf(season),
    seasonDay,
    formatted: `第${year}年 ${season.name} · ${monthName}${dayOfMonth}日`,
  };
};
