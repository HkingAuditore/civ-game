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
  { name: '春', months: [3, 4, 5] },
  { name: '夏', months: [6, 7, 8] },
  { name: '秋', months: [9, 10, 11] },
  { name: '冬', months: [12, 1, 2] },
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
