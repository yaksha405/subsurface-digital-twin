import type { SceneAction, Fracture, ScenarioType } from '../types';

interface AIResponse {
  message: string;
  action?: SceneAction;
  actions?: SceneAction[];
}

const commandMap: { keywords: string[]; response: AIResponse }[] = [
  {
    keywords: ['裂缝', '分布', '多少条'],
    response: {
      message: `## 裂缝网络分布概览\n\n当前探测区域共识别 **18 条裂缝**：\n\n| 类型 | 数量 | 平均长度 | 平均开度 |\n|------|------|---------|--------|\n| 主裂缝 | 6 条 | 35m | 52µm |\n| 分支裂缝 | 12 条 | 15m | 38µm |\n\n裂缝网络分形维数 **2.15-2.34**，属于中等复杂度裂缝系统。主要裂缝走向 NE-SW，倾角 3-35°。\n\n> 裂缝网络连通性良好，最大连通分支包含 8 条裂缝。`,
      action: undefined,
    },
  },
  {
    keywords: ['瓦斯', 'ch4', 'CH4', '气体', '甲烷'],
    response: {
      message: `## 瓦斯浓度分析\n\n根据《煤矿安全规程》，当前监测数据：\n\n| 区域 | CH₄浓度 | 状态 |\n|------|---------|------|\n| F-001 裂缝带 | 2.8% | ⚠️ 超标 |\n| F-003 深部裂缝 | 3.5% | 🔴 危险 |\n| F-005 浅部裂缝 | 0.8% | 🟢 正常 |\n| F-008 交叉点 | 1.6% | ⚠️ 超标 |\n\n**安全阈值**: 1.0% (报警) / 1.5% (断电) / 5.0-16.0% (爆炸极限)\n\n建议加强 F-003 区域通风，并持续监测 CH₄ 浓度变化趋势。`,
      action: { type: 'flyTo', position: [0, 0, 10], region: 'gas-zone' },
    },
  },
  {
    keywords: ['应力', '压力', 'stress', '稳定性', '岩爆'],
    response: {
      message: `## 地应力场分析\n\n基于三轴应力测量数据：\n\n- **最大主应力 σ₁**: 9-17 MPa\n- **中间主应力 σ₂**: 6-14 MPa\n- **最小主应力 σ₃**: 8-16 MPa\n\n### 应力集中区\nF-002 裂缝与 F-005 裂缝交汇处存在应力集中，应力比 σ₁/σ₃ ≈ 2.1，需关注岩爆风险。\n\n### 岩爆判据\n- σ₁/UCS > 0.4 → 高风险\n- 微震事件 > 15次/h → 需撤离\n\n当前微震事件 8 次/h，处于关注级别。`,
      action: { type: 'flyTo', position: [-10, 0, 5], region: 'stress-zone' },
    },
  },
  {
    keywords: ['渗透', 'permeability', '渗透率', '水'],
    response: {
      message: `## 渗透率评估\n\n基于应力-渗透率耦合分析（SD模型）：\n\n| 裂缝 | 渗透率 (mD) | 应力敏感性 |\n|------|-----------|----------|\n| F-001 | 2.8 | 高 |\n| F-003 | 0.45 | 中 |\n| F-005 | 3.2 | 高 |\n| F-008 | 1.1 | 中 |\n\n> 渗透率随有效应力增加呈负指数下降（SD模型: k = k₀·e^(-Cf·σ)）\n\n渗透率 > 1.0 mD 的裂缝可作为瓦斯抽采通道，建议在 F-001 和 F-005 布置抽采钻孔。`,
      action: undefined,
    },
  },
  {
    keywords: ['温度', '热', 'temperature'],
    response: {
      message: `## 温度场分析\n\n当前探测区域温度分布：\n\n- **浅部 (< -10m)**: 22-28°C — 正常\n- **中部 (-10m ~ -30m)**: 28-36°C — 微异常\n- **深部 (> -30m)**: 36-45°C — 需关注\n\nF-003 深部裂缝温度达 42°C，可能存在深层热源或机电设备散热影响。建议检查该区域设备运行状态。\n\n> 地温梯度约 3.0°C/100m，属于正常地温带。`,
      action: { type: 'flyTo', position: [5, -5, -20], region: 'temp-zone' },
    },
  },
  {
    keywords: ['水', '突水', 'water', '涌水'],
    response: {
      message: `## 突水预警分析\n\n当前水压监测数据：\n\n| 裂缝 | 水压 (MPa) | 风险等级 |\n|------|----------|--------|\n| F-001 | 2.3 | 🟢 正常 |\n| F-003 | 5.8 | ⚠️ 关注 |\n| F-006 | 7.2 | 🔴 危险 |\n\nF-006 裂缝水压接近隔水层临界值，存在突水风险。建议：\n1. 加密 F-006 区域水压监测频率\n2. 准备排水系统应急预案\n3. 限制该区域作业人员数量`,
      action: { type: 'flyTo', position: [15, -8, 10], region: 'water-zone' },
    },
  },
  {
    keywords: ['实验', '测试', 'experiment', '模拟', '压裂'],
    response: {
      message: `## 可用虚拟实验\n\n根据当前场景，可执行以下虚拟实验：\n\n| 实验 | 描述 | 适用场景 |\n|------|------|--------|\n| 瓦斯扩散模拟 | 预测CH₄扩散路径和影响范围 | 煤矿 |\n| 稳定性评估 | 评估裂缝围岩稳定性 | 通用 |\n| 突水预警 | 计算突水风险等级 | 煤矿/金矿 |\n| 岩爆预测 | 基于微震和应力数据 | 金矿 |\n| 渗透率评估 | 计算等效渗透率 | 油气 |\n| 裂缝连通性 | 分析裂缝网络连通性 | 油气 |\n\n请在3D场景中选中裂缝后，在右侧面板执行实验。`,
      action: undefined,
    },
  },
  {
    keywords: ['机器人', '状态', '群智', '设备'],
    response: {
      message: `## 机器人集群状态\n\n当前部署 **200台** 仿生探测机器人：\n\n| 状态 | 数量 | 占比 |\n|------|------|------|\n| 🟢 在线 | 178 | 89% |\n| 🟡 低电量 | 12 | 6% |\n| 🔴 故障 | 5 | 2.5% |\n| ⚫ 离线 | 5 | 2.5% |\n\n数据回传正常，最新数据延迟 < 3秒。Mesh自组网连通率 97.5%。`,
      action: undefined,
    },
  },
  {
    keywords: ['3号', '区域3', 'F-003', '危险区'],
    response: {
      message: `## F-003 裂缝风险评估\n\nF-003 深部主裂缝存在多重风险叠加：\n\n- **CH₄浓度**: 3.5%（🔴 超标，接近爆炸下限）\n- **温度**: 42.1°C（异常偏高）\n- **水压**: 5.8 MPa（接近临界值）\n- **微震**: 18 次/h（⚠️ 超过警戒线）\n- **渗透率**: 0.45 mD（偏低，瓦斯不易排出）\n\n### 综合评估\n该裂缝为**高风险区域**，建议：\n1. 立即撤离该区域 50m 范围内人员\n2. 启动应急通风系统\n3. 加强瓦斯抽采\n4. 持续微震监测`,
      action: { type: 'flyTo', position: [5, -5, -15], region: 'F-003-risk' },
    },
  },
];

export function generateMockAIResponse(
  input: string,
  sceneContext?: { fractures: Fracture[]; scenario: ScenarioType; gasThreshold: number }
): AIResponse {
  const lowerInput = input.toLowerCase();

  // ========== 新指令：找出最危险的点 ==========
  if (
    lowerInput.includes('最危险') ||
    lowerInput.includes('危险点') ||
    lowerInput.includes('最危险的地方') ||
    lowerInput.includes('哪里危险') ||
    lowerInput.includes('异常')
  ) {
    return findDangerousPoints(input, sceneContext);
  }

  // ========== 新指令：测距/剖面/框选 ==========
  if (lowerInput.includes('测距') || lowerInput.includes('测量') || lowerInput.includes('距离')) {
    return {
      message: `## 已激活测距工具\n\n请在3D场景中点击两个点进行距离测量。\n\n测量结果将包含：\n- 三维直线距离\n- 水平距离\n- 垂直高差（带方向）\n- 坡角\n- 方位角（含罗盘方位）`,
      actions: [{ type: 'activateTool', tool: 'distance' }],
    };
  }
  if (lowerInput.includes('剖面') || lowerInput.includes('截面')) {
    return {
      message: `## 已激活剖面线工具\n\n请在3D场景中点击两点绘制剖面线。\n\n将生成专业地质剖面图，包含：\n- 裂缝节点投影\n- 10段密度热力带\n- RQD 估算\n- 风险分级`,
      actions: [{ type: 'activateTool', tool: 'profile' }],
    };
  }
  if (lowerInput.includes('框选') || lowerInput.includes('区域分析') || lowerInput.includes('体积') || lowerInput.includes('区域地质')) {
    return {
      message: `## 已激活区域框选工具\n\n请在3D场景中拖拽选择一个立方体区域。\n\n将生成完整区域地质分析报告，包含：\n- 裂缝密度 & 渗透率\n- RQD 岩质分级\n- 风险等级评估`,
      actions: [{ type: 'activateTool', tool: 'area' }],
    };
  }

  // ========== 新指令：全景/重置 ==========
  if (lowerInput.includes('全景') || lowerInput.includes('重置') || lowerInput.includes('全图') || lowerInput.includes('home')) {
    return {
      message: `## 已重置到全景视角\n\n当前场景展示全部裂缝网络。`,
      actions: [{ type: 'fitAll' }, { type: 'clearMarkers' }],
    };
  }

  // ========== 新指令：清除标记 ==========
  if (lowerInput.includes('清除标记') || lowerInput.includes('清除标记') || lowerInput.includes('清掉')) {
    return {
      message: `已清除3D场景中所有AI标记。`,
      actions: [{ type: 'clearMarkers' }],
    };
  }

  // ========== 新指令：切换场景 ==========
  if (lowerInput.includes('金矿') || lowerInput.includes('切到金矿')) {
    return {
      message: `## 已切换到金矿场景\n\n当前监测金矿巷道裂缝网络，重点关注岩爆风险。`,
      actions: [{ type: 'switchScenario', scenario: 'gold' }],
    };
  }
  if (lowerInput.includes('油气') || lowerInput.includes('石油')) {
    return {
      message: `## 已切换到油气场景\n\n当前监测油气储层裂缝网络，重点关注渗透率和产能。`,
      actions: [{ type: 'switchScenario', scenario: 'oil' }],
    };
  }
  if (lowerInput.includes('煤矿') || lowerInput.includes('切到煤矿')) {
    return {
      message: `## 已切换到煤矿场景\n\n当前监测煤矿巷道裂缝网络，重点关注瓦斯安全。`,
      actions: [{ type: 'switchScenario', scenario: 'coal' }],
    };
  }

  for (const cmd of commandMap) {
    if (cmd.keywords.some((kw) => lowerInput.includes(kw.toLowerCase()))) {
      return cmd.response;
    }
  }

  return {
    message: `我已收到您的指令："${input}"\n\n当前系统监测 **18** 条裂缝、**200** 台机器人持续回传数据。\n\n您可以询问：\n- 裂缝网络分布情况\n- 瓦斯/应力/温度/渗透率分析\n- 突水预警/岩爆预测\n- 机器人集群状态\n- 可用的虚拟实验\n\n请问还需要分析什么？`,
  };
}

export const quickCommands = [
  { label: '裂缝分布概览', command: '裂缝网络分布情况' },
  { label: '瓦斯浓度分析', command: '分析当前瓦斯浓度' },
  { label: '应力场分析', command: '分析地应力场分布' },
  { label: '找出最危险的点', command: '找出最危险的点并标记' },
  { label: 'F-003风险评估', command: 'F-003裂缝风险评估' },
  { label: '渗透率评估', command: '渗透率评估分析' },
  { label: '可用实验', command: '有哪些可用的虚拟实验' },
];

/**
 * 分析裂缝数据找出最危险的点，生成标记动作
 */
function findDangerousPoints(
  input: string,
  sceneContext?: { fractures: Fracture[]; scenario: ScenarioType; gasThreshold: number }
): AIResponse {
  // 如果没有场景数据，用 mock 数据
  if (!sceneContext || sceneContext.fractures.length === 0) {
    return {
      message: `## 最危险区域已标记\n\n根据传感器数据分析，标记了 3 个高风险点位：\n\n| 编号 | 位置 | 风险因素 | 等级 |\n|------|------|---------|------|\n| 1 | F-003 深部 | CH₄ 3.5%, 温度42°C | 🔴 危险 |\n| 2 | F-001 带中 | CH₄ 2.8%, 水压高 | ⚠️ 警告 |\n| 3 | F-008 交叉点 | CH₄ 1.6%, 微震活跃 | ⚠️ 警告 |\n\n已自动飞行到最危险区域，红色脉冲标记已标注。`,
      actions: [
        {
          type: 'markPoints',
          points: [
            { position: [5, -5, -15], label: 'F-003 CH4=3.5% 🔴', level: 'danger' as const },
            { position: [0, 0, 10], label: 'F-001 CH4=2.8% ⚠️', level: 'warning' as const },
            { position: [-15, -3, 8], label: 'F-008 CH4=1.6% ⚠️', level: 'warning' as const },
          ],
        },
        { type: 'flyTo', position: [5, -5, -15], region: '最危险区域' },
      ],
    };
  }

  const { fractures, scenario, gasThreshold } = sceneContext;

  // 收集所有节点并计算危险度评分
  const allNodes = fractures.flatMap((f) =>
    f.nodes.map((n) => {
      const ch4 = n.sensors.ch4_pct;
      const temp = n.sensors.temperature_c;
      const stress = n.sensors.stress_mpa;
      const micro = n.sensors.microseismic_count;
      const water = n.sensors.water_pressure_mpa;

      // 综合危险评分
      let score = 0;
      if (scenario === 'coal') {
        score = ch4 * 25 + (ch4 > gasThreshold ? 30 : 0) + (temp > 38 ? 10 : 0) + (micro > 15 ? 20 : 0);
      } else if (scenario === 'gold') {
        score = stress * 3 + (micro > 15 ? 30 : 0) + (temp > 40 ? 10 : 0);
      } else {
        score = n.sensors.permeability_md * 5 + (water > 5 ? 20 : 0);
      }

      return {
        position: n.position,
        fractureId: f.id,
        fractureName: f.name,
        ch4,
        temp,
        stress,
        micro,
        water,
        score,
      };
    })
  );

  // 排序取 TOP 3
  const sorted = allNodes.sort((a, b) => b.score - a.score);
  const top3 = sorted.slice(0, 3);

  if (top3.length === 0) {
    return {
      message: `当前场景未检测到异常数据。`,
    };
  }

  // 生成标记点和消息
  const points = top3.map((n, i) => {
    const factors: string[] = [];
    if (n.ch4 > gasThreshold) factors.push(`CH₄=${n.ch4.toFixed(1)}%`);
    if (n.temp > 38) factors.push(`温度=${n.temp.toFixed(0)}°C`);
    if (n.micro > 15) factors.push(`微震=${n.micro}次/h`);
    if (n.water > 5) factors.push(`水压=${n.water.toFixed(1)}MPa`);

    return {
      position: n.position as [number, number, number],
      label: `${n.fractureId} ${factors.join(' ')}`,
      level: (i === 0 ? 'danger' : 'warning') as 'danger' | 'warning',
    };
  });

  // 表格摘要
  const tableRows = top3
    .map((n, i) => {
      const level = i === 0 ? '🔴 危险' : '⚠️ 警告';
      return `| ${i + 1} | ${n.fractureId} (${n.fractureName}) | [${n.position[0].toFixed(1)}, ${n.position[1].toFixed(1)}, ${n.position[2].toFixed(1)}] | CH₄=${n.ch4}%, 温度=${n.temp.toFixed(0)}°C, 微震=${n.micro}/h | ${level} |`;
    })
    .join('\n');

  return {
    message: `## 最危险区域分析\n\n根据实时传感器数据综合评分，标记了 ${top3.length} 个高风险点位：\n\n| 编号 | 裂缝 | 坐标 [X,Y,Z] | 关键指标 | 等级 |\n|------|------|------------|---------|------|\n${tableRows}\n\n已自动飞行到最危险区域（${top3[0].fractureId}），脉冲标记已标注在3D场景中。`,
    actions: [
      { type: 'markPoints', points },
      { type: 'flyTo', position: top3[0].position as [number, number, number], region: `最危险: ${top3[0].fractureId}` },
    ],
  };
}
