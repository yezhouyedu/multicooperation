export const mockCompany = {
  name: '星衡智能制造',
  round: 'Pre-A',
  sector: '工业智能化 / 机器人产线软件',
  tags: ['成长型', '中等复杂度', '制造业数字化'],
  summary:
    '公司为中型制造企业提供产线调度软件、视觉检测系统和设备数据中台，过去两年收入增长较快，但项目交付依赖核心团队，客户集中度偏高。',
  rawMaterials: [
    {
      title: '材料 1 / 公司介绍',
      points: [
        '核心产品覆盖排产调度、质检视觉算法、设备数据采集。',
        '客户主要集中在汽车零部件和消费电子制造链。',
        '创始团队来自工业自动化与软件背景。',
      ],
    },
    {
      title: '材料 2 / 财务与经营',
      points: [
        '近两年营收增长明显，但毛利率波动较大。',
        '前五大客户贡献占比偏高，存在客户集中风险。',
        '项目型收入占比较高，标准化产品收入仍在爬坡。',
      ],
    },
    {
      title: '材料 3 / 风险补充',
      points: [
        '交付周期长，对项目经理与算法负责人依赖较强。',
        '在海外市场还未形成稳定渠道。',
        '竞争对手正在加速产品化和低价抢单。',
      ],
    },
    {
      title: '材料 4 / 法务与海外合规',
      points: [
        '海外收入主要通过代理商结算，部分地区报备文件仍在补办。',
        '现阶段没有重大诉讼，但知识产权边缘纠纷尚未完全结束。',
        '若后续出海加速，合规成本和法务准备会明显上升。',
      ],
    },
    {
      title: '材料 5 / 客户与复购',
      points: [
        '核心客户复购意愿较强，但新客户拓展效率不稳定。',
        '行业景气度提升时订单放量明显，下行周期抗压性仍需验证。',
        '标准化产品收入占比提升前，项目制波动仍然较大。',
      ],
    },
  ],
};

export const mockAForm = {
  opportunityInfo: [],
  riskInfo: [],
  otherNotes: [],
  memo: '',
};

export const mockBWorkspace = {
  opportunityItems: [],
  riskItems: [],
  investmentMemo: '',
  finalDecision: '',
};

export const mockSideFeedItems = [
  { id: 'sf-1', title: '头部工厂继续追加自动化预算', summary: '行业龙头继续增加智能质检与设备联网投入。', tag: '行业', source: '产业资讯', batchIndex: 1, releasedAt: '刚刚' },
  { id: 'sf-2', title: '竞品低价切入中小客户市场', summary: '低价标准化版本可能加剧价格竞争。', tag: '竞品', source: '市场消息', batchIndex: 1, releasedAt: '刚刚' },
  { id: 'sf-3', title: '地方补贴鼓励智能制造改造', summary: '新补贴政策可能带动一批工厂启动改造。', tag: '政策', source: '政策跟踪', batchIndex: 1, releasedAt: '刚刚' },
  { id: 'sf-4', title: '海外渠道拓展仍未形成规模', summary: '多数工业软件公司的海外推进仍较慢。', tag: '行业', source: '研究简报', batchIndex: 2, releasedAt: '待处理' },
  { id: 'sf-5', title: '某区域环保标准或收紧', summary: '若政策落地，相关企业的改造与法务成本可能上升。', tag: '政策', source: '监管快讯', batchIndex: 2, releasedAt: '待处理' },
  { id: 'sf-6', title: '上游硬件交付周期拉长', summary: '供应链延迟可能影响项目交付和利润确认。', tag: '供应链', source: '行业观察', batchIndex: 3, releasedAt: '待处理' },
  { id: 'sf-7', title: '客户预算审议周期延长', summary: '大客户决策变慢，签约节奏可能后移。', tag: '客户', source: '一线反馈', batchIndex: 3, releasedAt: '待处理' },
];
