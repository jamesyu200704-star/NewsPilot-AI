import type { StrategyCard } from '../shared/学生报道模型.js';

type BaseStrategyCard = Omit<
  StrategyCard,
  | 'minimumInterviewRequirements'
  | 'minimumEvidenceRequirements'
  | 'recommendedInterviewees'
  | 'failureModes'
  | 'ethicalRisks'
  | 'studentDifficulty'
  | 'minimumWorkDays'
  | 'basis'
>;

const 基础报道策略库: BaseStrategyCard[] = [
  {
    id: 'profile',
    name: '人物特稿',
    signals: ['人物', '经历', '选择', '成长', '教师', '学生'],
    suitableFor: ['有可持续接触的核心人物', '人物经历能折射公共议题'],
    unsuitableFor: ['只能进行一次简短采访', '只想做人物宣传'],
    requiredEvidence: ['关键经历的时间线', '旁证人物或文件'],
    minimumSources: ['核心人物', '至少一名旁证者'],
    commonRisks: ['把自述直接当作事实', '过度煽情或标签化'],
    recommendedStructure: ['具体场景', '关键选择', '背景与冲突', '回到当下'],
    studentFeasibilityNotes: ['优先选择能多次联系、能进入具体场景的人物'],
  },
  {
    id: 'campus-phenomenon',
    name: '校园现象调查',
    signals: ['校园', '大学生', '学生', '普遍', '现象', '使用', '焦虑', '消费'],
    suitableFor: ['校园内可找到多类受影响者', '现象有明确边界'],
    unsuitableFor: ['只掌握一个匿名网帖', '把个案外推为全部学生'],
    requiredEvidence: ['不同背景学生的一手经历', '校方规则或服务资料'],
    minimumSources: ['直接经历者', '规则执行者', '不同观点者'],
    commonRisks: ['样本偏差', '把态度写成事实'],
    recommendedStructure: ['现场或个案', '现象边界', '不同解释', '可核实影响'],
    studentFeasibilityNotes: ['限定到一所学校、一个院系或一类课程'],
  },
  {
    id: 'policy-implementation',
    name: '政策落地观察',
    signals: ['政策', '通知', '规定', '制度', '管理', '规范', '办法'],
    suitableFor: ['存在可获得的政策原文', '执行者与受影响者可联系'],
    unsuitableFor: ['政策尚未正式发布', '无法确认适用范围'],
    requiredEvidence: ['政策原文与时间线', '执行案例与回应'],
    minimumSources: ['发布或执行部门', '受影响者', '第三方解释者'],
    commonRisks: ['把政策目标当成实际效果', '遗漏执行差异'],
    recommendedStructure: ['规则是什么', '如何执行', '谁受影响', '落差与回应'],
    studentFeasibilityNotes: ['优先观察本校已有公开文件的政策'],
  },
  {
    id: 'localize-hotspot',
    name: '热点本地化',
    signals: ['热点', '近期', '最近', '发布', '流行', '热议', 'AI'],
    suitableFor: ['热点在本校有可验证表现', '能找到本地人物和场景'],
    unsuitableFor: ['只复述网络观点', '本地没有任何新增事实'],
    requiredEvidence: ['热点原始事件', '本地新增事实'],
    minimumSources: ['本地当事人', '相关管理或服务方'],
    commonRisks: ['追热点却没有新闻增量', '错误转述网络信息'],
    recommendedStructure: ['热点背景', '本地现场', '差异', '实际影响'],
    studentFeasibilityNotes: ['两天内至少确认一个本地事实增量'],
  },
  {
    id: 'data-investigation',
    name: '数据调查',
    signals: ['数据', '数量', '比例', '价格', '增长', '下降', '统计'],
    suitableFor: ['有可复核数据或能完成小规模记录', '指标定义清楚'],
    unsuitableFor: ['只有搜索摘要', '样本无法说明任何范围'],
    requiredEvidence: ['原始数据与口径', '数据背后的个案解释'],
    minimumSources: ['数据原始来源', '数据解释者', '受影响者'],
    commonRisks: ['小样本外推', '忽略统计口径'],
    recommendedStructure: ['数据发现', '口径说明', '人物案例', '限制'],
    studentFeasibilityNotes: ['把数据任务缩小到能在截止期内复核的范围'],
  },
  {
    id: 'service-journalism',
    name: '服务性报道',
    signals: ['服务', '食堂', '宿舍', '选课', '办事', '出行', '安全', '就业'],
    suitableFor: ['读者有明确决策或办事需求', '规则可核查'],
    unsuitableFor: ['只有个人吐槽', '无法确认最新流程'],
    requiredEvidence: ['最新规则和流程', '实际使用体验'],
    minimumSources: ['服务使用者', '服务提供方', '公开文件'],
    commonRisks: ['信息过期', '把建议写成官方承诺'],
    recommendedStructure: ['问题场景', '核实后的流程', '常见误区', '行动提示'],
    studentFeasibilityNotes: ['适合短周期校园媒体任务'],
  },
  {
    id: 'change-story',
    name: '变化型报道',
    signals: ['改变', '变化', '从', '转向', '新增', '取消', '调整', 'AI'],
    suitableFor: ['能确认变化前后的基准', '变化影响明确群体'],
    unsuitableFor: ['没有时间线', '只有主观感受'],
    requiredEvidence: ['变化前后的文件或实例', '至少两方体验'],
    minimumSources: ['经历变化者', '推动或执行变化者'],
    commonRisks: ['把短期波动写成趋势', '因果关系过度推断'],
    recommendedStructure: ['过去状态', '变化节点', '现实影响', '仍未解决的问题'],
    studentFeasibilityNotes: ['用一个可验证变化替代宏大趋势判断'],
  },
  {
    id: 'conflict-story',
    name: '冲突型报道',
    signals: ['争议', '矛盾', '禁止', '投诉', '冲突', '公平', '边界'],
    suitableFor: ['冲突双方可获得回应', '争议涉及公共利益'],
    unsuitableFor: ['只有单方指控', '存在不可控的人身安全风险'],
    requiredEvidence: ['双方可核实说法', '规则与事件时间线'],
    minimumSources: ['冲突双方', '独立第三方', '原始文件'],
    commonRisks: ['失衡报道', '名誉与隐私伤害'],
    recommendedStructure: ['争议事实', '双方依据', '规则背景', '待核实部分'],
    studentFeasibilityNotes: ['无法获得一方回应时必须明确说明并降低结论强度'],
  },
  {
    id: 'scene-led',
    name: '场景切入型报道',
    signals: ['现场', '活动', '比赛', '课堂', '夜晚', '排队', '宿舍'],
    suitableFor: ['能进入现场观察', '场景包含可验证行动与细节'],
    unsuitableFor: ['无法到场', '只依赖二手描述'],
    requiredEvidence: ['现场观察记录', '场景参与者解释'],
    minimumSources: ['现场参与者', '组织或管理者'],
    commonRisks: ['以细节代替证据', '未经同意暴露身份'],
    recommendedStructure: ['现场动作', '人物经历', '背景解释', '场景变化'],
    studentFeasibilityNotes: ['提前确认进入现场和拍摄许可'],
  },
  {
    id: 'group-portrait',
    name: '群像报道',
    signals: ['群体', '同学', '毕业生', '志愿者', '社团', '运动员', '求职'],
    suitableFor: ['多个可接触人物共享同一问题', '人物之间有差异'],
    unsuitableFor: ['人物样本高度同质', '只做观点拼盘'],
    requiredEvidence: ['多个人物的具体经历', '共同背景资料'],
    minimumSources: ['至少三名不同背景人物', '一名解释者'],
    commonRisks: ['人物扁平化', '用群像掩盖样本限制'],
    recommendedStructure: ['共同场景', '人物差异', '交叉主题', '开放结尾'],
    studentFeasibilityNotes: ['优先选择时间和地点上容易协调的人物'],
  },
];

const 执行补充: Record<
  string,
  Pick<
    StrategyCard,
    | 'failureModes'
    | 'ethicalRisks'
    | 'studentDifficulty'
    | 'minimumWorkDays'
  >
> = {
  profile: {
    failureModes: ['只有一次问答，没有持续观察与旁证', '把人物履历改写成人物宣传'],
    ethicalRisks: ['暴露人物隐私或创伤经历', '用单一标签概括复杂人物'],
    studentDifficulty: 'high',
    minimumWorkDays: 5,
  },
  'campus-phenomenon': {
    failureModes: ['以少数熟人样本代表整个校园', '只有态度问卷，没有具体经历与文件'],
    ethicalRisks: ['泄露学生身份与敏感经历', '因样本偏差污名化某一群体'],
    studentDifficulty: 'medium',
    minimumWorkDays: 4,
  },
  'policy-implementation': {
    failureModes: ['只复述政策目标，没有观察实际执行', '没有给执行部门回应机会'],
    ethicalRisks: ['公开个体违规记录', '对尚未核实的机构责任作确定性指控'],
    studentDifficulty: 'high',
    minimumWorkDays: 5,
  },
  'localize-hotspot': {
    failureModes: ['只有热点背景，没有本校新增事实', '过度依赖网络二手信息'],
    ethicalRisks: ['传播未经核实的热点指控', '为赶时效省略回应权'],
    studentDifficulty: 'medium',
    minimumWorkDays: 2,
  },
  'data-investigation': {
    failureModes: ['混用不同统计口径', '用小样本推出全校结论'],
    ethicalRisks: ['数据可反向识别个人', '图表或比例夸大实际差异'],
    studentDifficulty: 'high',
    minimumWorkDays: 6,
  },
  'service-journalism': {
    failureModes: ['流程信息已经过期', '只有建议，没有亲自核验使用路径'],
    ethicalRisks: ['把非官方建议写成正式承诺', '遗漏会影响特定群体的重要例外'],
    studentDifficulty: 'low',
    minimumWorkDays: 2,
  },
  'change-story': {
    failureModes: ['没有变化前基准', '把暂时波动写成长期趋势'],
    ethicalRisks: ['用未经证实的因果关系归责个人或机构', '忽略变化对弱势群体的差异影响'],
    studentDifficulty: 'medium',
    minimumWorkDays: 4,
  },
  'conflict-story': {
    failureModes: ['只采访冲突一方', '追求戏剧性而忽略可核实事实'],
    ethicalRisks: ['名誉侵害与网络暴力', '泄露投诉者或被投诉者身份'],
    studentDifficulty: 'high',
    minimumWorkDays: 5,
  },
  'scene-led': {
    failureModes: ['用漂亮细节代替新闻证据', '没有得到进入现场或拍摄许可'],
    ethicalRisks: ['未经同意记录或展示可识别人物', '干扰现场正常秩序'],
    studentDifficulty: 'medium',
    minimumWorkDays: 3,
  },
  'group-portrait': {
    failureModes: ['人物只是观点拼盘，没有共同新闻问题', '样本同质却声称代表整个群体'],
    ethicalRisks: ['把人物工具化为群体标签', '不同人物的敏感信息保护标准不一致'],
    studentDifficulty: 'high',
    minimumWorkDays: 6,
  },
};

export const 报道策略库: StrategyCard[] = 基础报道策略库.map((strategy) => ({
  ...strategy,
  minimumInterviewRequirements: strategy.minimumSources,
  minimumEvidenceRequirements: strategy.requiredEvidence,
  recommendedInterviewees: strategy.minimumSources,
  ...执行补充[strategy.id],
  basis: {
    summary:
      '由 NewsPilot 团队将基础采访、交叉验证与学生执行约束整理为待评审策略卡；当前未绑定外部教材、论文或完整案例。',
    sourceStatus: '待人工审核',
    sourceReferences: [],
  },
}));
