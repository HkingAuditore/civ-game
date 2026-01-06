// 新手教程步骤配置
// 《哈耶克的文明：市场经济》- 强调自由市场经济理念

export const TUTORIAL_STEPS = [
    {
        id: 'welcome',
        title: '欢迎来到《哈耶克的文明：市场经济》',
        icon: 'Globe',
        iconColor: 'text-blue-400',
        lead: '欢迎，自由市场的开拓者！',
        paragraphs: [
            '你将带领一个小小的部落，从原始时代开始，通过自由市场经济的力量，逐步发展成为繁荣的文明帝国。',
            '在这个旅程中，你将见证"看不见的手"如何调节资源配置，体验价格机制如何引导经济发展，并理解自发秩序的伟大力量。',
        ],
        callouts: [
            {
                tone: 'info',
                icon: 'Lightbulb',
                title: '游戏理念',
                text: '基于奥地利经济学派的思想，体验自由市场如何创造繁荣与秩序！',
            },
        ],
    },
    {
        id: 'market_economy',
        title: '自由市场经济',
        icon: 'TrendingUp',
        iconColor: 'text-emerald-400',
        lead: '市场是资源配置的最佳机制',
        paragraphs: [
            '在《哈耶克的文明》中，价格不是固定的，而是由供需关系动态决定。这正是哈耶克所说的"价格信号"——它传递着分散的知识，引导资源流向最需要的地方。',
        ],
        cards: [
            {
                icon: 'Coins',
                iconColor: 'text-yellow-400',
                title: '银币与价格',
                text: '银币是市场经济的血液。所有资源都有市场价格，价格会随供需波动，这是市场自发调节的体现。',
            },
            {
                icon: 'BarChart',
                iconColor: 'text-blue-400',
                title: '供需法则',
                text: '当某种资源稀缺时，价格上涨；当供应充足时，价格下降。学会观察价格信号，做出明智决策。',
            },
            {
                icon: 'ArrowUpCircle',
                iconColor: 'text-emerald-400',
                title: '自发秩序',
                text: '无需中央计划，市场会自发形成秩序。你的任务是创造条件，让市场机制充分发挥作用。',
            },
        ],
        callouts: [
            {
                tone: 'tip',
                icon: 'Lightbulb',
                title: '哈耶克的智慧',
                text: '"价格体系是人类迄今为止发明的最伟大的信息传递系统。" —— 弗里德里希·哈耶克',
            },
        ],
    },
    {
        id: 'resources',
        title: '资源与生产',
        icon: 'Package',
        iconColor: 'text-yellow-400',
        paragraphs: [
            '左侧面板显示了你的所有资源。在自由市场中，资源通过价格机制实现最优配置。',
        ],
        cards: [
            {
                icon: 'Wheat',
                iconColor: 'text-yellow-400',
                title: '基础资源',
                text: '食物、木材、石料等是经济的基础。它们的价格反映了稀缺程度，引导你的生产决策。',
            },
            {
                icon: 'Factory',
                iconColor: 'text-blue-400',
                title: '产业链',
                text: '原材料可以加工成高价值产品。建立完整的产业链，创造更多财富！',
            },
            {
                icon: 'Pickaxe',
                iconColor: 'text-emerald-400',
                title: '劳动创造价值',
                text: '可通过「手动采集」获得少量银币，但真正的财富来自建立高效的生产体系。',
            },
        ],
    },
    {
        id: 'population',
        title: '人口与社会阶层',
        icon: 'Users',
        iconColor: 'text-blue-400',
        lead: '人力资本是经济发展的核心',
        paragraphs: [
            '人口不仅是劳动力，更是消费者和创新者。不同社会阶层有不同的需求和贡献，维持社会和谐是繁荣的基础。',
        ],
        cards: [
            {
                icon: 'Wheat',
                iconColor: 'text-yellow-400',
                title: '基本需求',
                text: '人口需要食物维持生存。满足基本需求是经济发展的前提。',
            },
            {
                icon: 'Home',
                iconColor: 'text-blue-400',
                title: '人口增长',
                text: '建造房屋提高人口上限。人口增长带来更多劳动力和消费需求，推动经济扩张。',
            },
            {
                icon: 'Users',
                iconColor: 'text-purple-400',
                title: '社会分工',
                text: '农民、工匠、商人、学者——分工协作创造繁荣。亚当·斯密的"分工理论"在此体现。',
            },
            {
                icon: 'Heart',
                iconColor: 'text-red-400',
                title: '阶层满意度',
                text: '满足各阶层的需求，维持高满意度。不满的阶层会降低生产效率，影响社会稳定。',
            },
        ],
    },
    {
        id: 'technology',
        title: '科技与创新',
        icon: 'Cpu',
        iconColor: 'text-purple-400',
        lead: '知识是经济增长的引擎',
        paragraphs: [
            '科技进步提高生产效率，解锁新的可能性。在自由市场中，创新是竞争优势的源泉。',
        ],
        cards: [
            {
                icon: 'BookOpen',
                iconColor: 'text-blue-400',
                title: '科研系统',
                text: '建造图书馆产生科研点数。投资教育和研发，为长期繁荣奠定基础。',
            },
            {
                icon: 'TrendingUp',
                iconColor: 'text-yellow-400',
                title: '时代升级',
                text: '从石器时代到现代文明，每次升级都是生产力的飞跃。技术进步推动经济发展。',
            },
            {
                icon: 'Zap',
                iconColor: 'text-purple-400',
                title: '创新红利',
                text: '新科技带来新产业、新资源、新机遇。抓住技术革命的机会，领先竞争对手！',
            },
        ],
    },
    {
        id: 'trade_diplomacy',
        title: '贸易与外交',
        icon: 'Globe',
        iconColor: 'text-cyan-400',
        lead: '自由贸易创造双赢',
        paragraphs: [
            '与其他文明进行贸易，实现比较优势。外交关系影响贸易条件和国际环境。',
        ],
        cards: [
            {
                icon: 'Handshake',
                iconColor: 'text-emerald-400',
                title: '国际贸易',
                text: '出口你的优势产品，进口稀缺资源。贸易让双方都受益——这是经济学的基本原理。',
            },
            {
                icon: 'Flag',
                iconColor: 'text-blue-400',
                title: '外交关系',
                text: '维持良好的外交关系，降低贸易成本。和平与合作比战争更能创造财富。',
            },
            {
                icon: 'Swords',
                iconColor: 'text-red-400',
                title: '军事防御',
                text: '保护产权和市场秩序需要军事力量。但记住：战争是经济的敌人，和平才能繁荣。',
            },
        ],
        callouts: [
            {
                tone: 'tip',
                icon: 'Lightbulb',
                title: '比较优势理论',
                text: '专注于你最擅长的生产，通过贸易获取其他商品。这是大卫·李嘉图的伟大洞见。',
            },
        ],
    },
    {
        id: 'government',
        title: '政府与政令',
        icon: 'Gavel',
        iconColor: 'text-amber-400',
        lead: '有限政府，最大自由',
        paragraphs: [
            '政府的角色是维护市场秩序，而非替代市场。明智的政令能促进繁荣，但过度干预会扼杀活力。',
        ],
        cards: [
            {
                icon: 'Scale',
                iconColor: 'text-blue-400',
                title: '法治基础',
                text: '建立公平的规则，保护产权，维护契约。这是市场经济的制度基础。',
            },
            {
                icon: 'Gavel',
                iconColor: 'text-amber-400',
                title: '政令选择',
                text: '在「政令」标签页颁布法令。但要谨慎：每项政令都有代价，过度干预会适得其反。',
            },
            {
                icon: 'AlertTriangle',
                iconColor: 'text-red-400',
                title: '计划经济的陷阱',
                text: '哈耶克警告：中央计划无法掌握分散的知识。让市场自发调节，政府只需维护秩序。',
            },
        ],
        callouts: [
            {
                tone: 'warning',
                icon: 'AlertTriangle',
                title: '哈耶克的警告',
                text: '"通往奴役之路是由善意铺成的。" 过度的政府干预会侵蚀自由和繁荣。',
            },
        ],
    },
    {
        id: 'ruling_coalition',
        title: '执政联盟',
        icon: 'Crown',
        iconColor: 'text-purple-400',
        lead: '选择你的政治盟友',
        paragraphs: [
            '执政联盟是你选择与哪些社会阶层共同执政的核心政治系统。联盟的组成直接影响政府的合法性和统治效率。',
        ],
        cards: [
            {
                icon: 'Users',
                iconColor: 'text-blue-400',
                title: '选择联盟成员',
                text: '在「阶层」标签页选择联盟成员。联盟成员会对政府有更高的期望，但也提供影响力支持。',
            },
            {
                icon: 'Shield',
                iconColor: 'text-emerald-400',
                title: '政府合法性',
                text: '联盟成员的总影响力占比决定合法性。合法性≥40%才是合法政府，影响税收效率和社会稳定。',
            },
            {
                icon: 'AlertCircle',
                iconColor: 'text-yellow-400',
                title: '联盟的代价',
                text: '联盟阶层期望更高：更低的税收容忍、更高的收入预期、对物资短缺更敏感，更容易不满。',
            },
        ],
        callouts: [
            {
                tone: 'tip',
                icon: 'Lightbulb',
                title: '策略提示',
                text: '选择影响力高的阶层可快速获得合法性，但要确保能满足他们的需求，否则会适得其反！',
            },
        ],
    },
    {
        id: 'taxation',
        title: '税收与财政',
        icon: 'Coins',
        iconColor: 'text-yellow-400',
        lead: '取之于民，用之于民',
        paragraphs: [
            '税收是国家财政的基础，但过度征税会损害经济活力。合理的税收政策是繁荣的关键。',
        ],
        cards: [
            {
                icon: 'User',
                iconColor: 'text-blue-400',
                title: '人头税',
                text: '按人口每日征收，不同阶层有不同基准税率。这是最稳定的收入来源，但过高会降低阶层满意度。',
            },
            {
                icon: 'Building',
                iconColor: 'text-emerald-400',
                title: '营业税',
                text: '对建筑产出征收，由业主支付。可对不同建筑设置不同税率，实现精准的产业政策。',
            },
            {
                icon: 'Gift',
                iconColor: 'text-purple-400',
                title: '补贴机制',
                text: '将税率设为负数可发放补贴。人头税补贴提升阶层好感，营业税补贴降低企业成本。',
            },
        ],
        callouts: [
            {
                tone: 'info',
                icon: 'Lightbulb',
                title: '税收效率',
                text: '税收实际收入 = 应收税款 × 合法性效率。政府合法性越高，税收效率越高（最高100%）。',
            },
        ],
    },
    {
        id: 'building_upgrade',
        title: '建筑升级与阶层需求',
        icon: 'ArrowUpCircle',
        iconColor: 'text-cyan-400',
        lead: '发展经济的进阶技巧',
        paragraphs: [
            '随着文明发展，你可以升级建筑提升产出，但也要应对阶层日益增长的消费需求。',
        ],
        cards: [
            {
                icon: 'TrendingUp',
                iconColor: 'text-emerald-400',
                title: '建筑升级',
                text: '建筑可升级2级：1级产出×1.3，2级产出×1.8。在「建设」标签点击已建造的建筑查看升级选项。',
            },
            {
                icon: 'Gem',
                iconColor: 'text-purple-400',
                title: '消费升级',
                text: '阶层积累财富后会解锁奢侈品需求。财富达到初始值1.5倍起逐级解锁香料、咖啡、珍馐等需求。',
            },
            {
                icon: 'BarChart',
                iconColor: 'text-yellow-400',
                title: '平衡发展',
                text: '工资增长要匹配商品供给，否则高收入+供给不足反而会降低满意度。提前建立奢侈品产业链！',
            },
        ],
        callouts: [
            {
                tone: 'warning',
                icon: 'AlertTriangle',
                title: '发展的代价',
                text: '富裕的社会需要更复杂的供应链。关注阶层需求变化，提前布局生产！',
            },
        ],
    },
    {
        id: 'autosave',
        title: '自动存档与安全',
        icon: 'Save',
        iconColor: 'text-emerald-400',
        paragraphs: [
            '游戏会定期自动保存，确保你的文明进度不会丢失。',
            '你也可以随时手动存档，便于尝试不同的经济策略。',
        ],
        cards: [
            {
                icon: 'Clock',
                iconColor: 'text-emerald-300',
                title: '自动存档',
                text: '在设置中可以查看自动存档间隔与最近一次保存时间。',
            },
            {
                icon: 'Save',
                iconColor: 'text-green-200',
                title: '手动存档',
                text: '点击顶部「保存」按钮立即保存进度，适合重大决策前备份。',
            },
            {
                icon: 'Download',
                iconColor: 'text-purple-300',
                title: '读档与备份',
                text: '通过读档菜单载入存档，必要时导出备份文件。',
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
        title: '开启自由市场之旅',
        icon: 'Sparkles',
        iconColor: 'text-yellow-400',
        lead: '现在你已经掌握了自由市场经济的基本原理，是时候建立你的繁荣帝国了！',
        paragraphs: [
            '记住哈耶克的核心思想：',
            '• 价格是信息的载体，引导资源配置',
            '• 自发秩序优于中央计划',
            '• 自由竞争促进创新和效率',
            '• 产权保护是繁荣的基础',
            '• 有限政府，最大自由',
        ],
        callouts: [
            {
                tone: 'success',
                icon: 'Check',
                title: '开局建议',
                text: '人口维护主要消耗食物与衣物（布料）。开局优先建造农田保障粮食，并尽早建设织布坊（或其他布料建筑）避免衣物短缺；木材不足时再补伐木场。随后再发展产业链，创造更多价值。',
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
                title: '市场观察',
                text: '密切关注资源价格变化，这是市场传递给你的信号。顺应市场，而非对抗市场。',
            },
        ],
        wikiPrompt: {
            text: '遇到不懂的概念？点击主界面右上方的「百科」按钮，快速查阅建筑、科技、政令等详细说明。',
            buttonLabel: '打开百科',
        },
        footerNote: '愿自由市场的智慧指引你的文明走向繁荣！',
    },
];
