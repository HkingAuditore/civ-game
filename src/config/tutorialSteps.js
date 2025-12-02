// 新手教程步骤配置
// 提供结构化数据，便于策划改写文案

export const TUTORIAL_STEPS = [
  {
    id: 'welcome',
    title: '欢迎来到文明崛起',
    icon: 'Globe',
    iconColor: 'text-blue-400',
    lead: '欢迎，伟大的统治者！',
    paragraphs: [
      '你将带领一个小小的部落，从原始时代开始，逐步发展成为强大的文明帝国。',
      '在这个旅程中，你需要管理资源、发展科技、维护社会稳定，并与其他文明进行外交或战争。',
    ],
    callouts: [
      {
        tone: 'info',
        icon: 'Lightbulb',
        title: '游戏目标',
        text: '从部落发展到现代文明，解锁所有时代，建立繁荣的帝国！',
      },
    ],
  },
  {
    id: 'resources',
    title: '资源管理',
    icon: 'Package',
    iconColor: 'text-yellow-400',
    paragraphs: [
      '左侧面板显示了你的所有资源。资源是文明发展的基础！',
    ],
    cards: [
      {
        icon: 'Wheat',
        iconColor: 'text-yellow-400',
        title: '基础资源',
        text: '食物、木材、石料等是最基础的资源，用于建造和维持人口。',
      },
      {
        icon: 'Coins',
        iconColor: 'text-yellow-400',
        title: '银币系统',
        text: '银币是经济核心！仓库存货是用银币按当前价格买入的，留意市场波动。',
      },
      {
        icon: 'Pickaxe',
        iconColor: 'text-emerald-400',
        title: '获取资源',
        text: '可通过「手动采集」获得少量银币，但主要依靠建筑与岗位实现自动生产。',
      },
    ],
  },
  {
    id: 'population',
    title: '人口与社会',
    icon: 'Users',
    iconColor: 'text-blue-400',
    paragraphs: [
      '人口是文明的核心，他们会自动填补建筑创造的岗位，并转化为对应的社会阶层。',
    ],
    cards: [
      {
        icon: 'Wheat',
        iconColor: 'text-yellow-400',
        title: '维持人口',
        text: '人口需要食物维持。确保食物产量为正，否则人口会饿死！',
      },
      {
        icon: 'Home',
        iconColor: 'text-blue-400',
        title: '增加人口上限',
        text: '建造房屋或功能性建筑可提高人口上限。人口会自然增长，直到达到上限。',
      },
      {
        icon: 'Users',
        iconColor: 'text-purple-400',
        title: '社会阶层',
        text: '不同建筑会创造农民、工匠、商人等岗位。留意各阶层的需求和好感度。',
      },
    ],
  },
  {
    id: 'technology',
    title: '科技与时代',
    icon: 'Cpu',
    iconColor: 'text-purple-400',
    paragraphs: [
      '通过科技研究解锁新建筑和能力，推动文明进入新时代！',
    ],
    cards: [
      {
        icon: 'BookOpen',
        iconColor: 'text-blue-400',
        title: '科研系统',
        text: '建造图书馆产生科研点数。在「科技」标签页中研究新科技。',
      },
      {
        icon: 'TrendingUp',
        iconColor: 'text-yellow-400',
        title: '时代升级',
        text: '满足条件后可以升级时代（原始→古典→中世纪→工业→现代），每个时代都会带来新的解锁。',
      },
    ],
  },
  {
    id: 'autosave',
    title: '自动存档与安全',
    icon: 'Save',
    iconColor: 'text-emerald-400',
    paragraphs: [
      '文明崛起会在后台定期自动保存，确保你的进度不会轻易丢失。',
      '你也可以随时在顶部工具栏使用「保存」按钮进行手动存档，便于尝试不同策略。',
    ],
    cards: [
      {
        icon: 'Clock',
        iconColor: 'text-emerald-300',
        title: '自动存档',
        text: '在设置中可以查看自动存档间隔与最近一次自动保存时间。',
      },
      {
        icon: 'Save',
        iconColor: 'text-green-200',
        title: '手动存档',
        text: '点击顶部「保存」按钮立即写入存档，适合重大决策前备份。',
      },
      {
        icon: 'Download',
        iconColor: 'text-purple-300',
        title: '读档与备份',
        text: '通过读档菜单或设置面板可以载入自动/手动档案，必要时导出备份文件。',
      },
    ],
    callouts: [
      {
        tone: 'warning',
        icon: 'AlertTriangle',
        title: '提示',
        text: '关闭浏览器前最好手动保存一次，确保最新成果被记录。',
      },
    ],
  },
  {
    id: 'journey',
    title: '开始你的征程',
    icon: 'Sparkles',
    iconColor: 'text-yellow-400',
    lead: '现在你已经掌握了基础知识，是时候开始建立你的文明了！',
    callouts: [
      {
        tone: 'success',
        icon: 'Check',
        title: '开局建议',
        text: '先建造农田和伐木场，确保食物和木材稳定增长。',
      },
      {
        tone: 'info',
        icon: 'Gift',
        title: '年度庆典',
        text: '从第 2 年开始，每年都会有庆典活动，你可以选择一项祝福效果！',
      },
      {
        tone: 'tip',
        icon: 'MessageSquare',
        title: '统治指南',
        text: '右侧面板保留了各类提示，可随时回顾关键系统。',
      },
    ],
    wikiPrompt: {
      text: '遇到不懂的概念？点击主界面右上方的「百科」按钮，快速查阅建筑、科技、政令等详细说明。',
      buttonLabel: '打开百科',
    },
    footerNote: '祝你好运，伟大的统治者！',
  },
];
