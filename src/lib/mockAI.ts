import type { SceneAction, Fracture, ScenarioType } from '../types';

interface AIResponse {
  message: string;
  action?: SceneAction;
  actions?: SceneAction[];
}

/** 计算裂缝中心点 */
function fractureCenter(f: Fracture): [number, number, number] {
  if (f.path.length === 0) return [0, 0, 0];
  const sum = f.path.reduce(
    (acc, p) => [acc[0] + p[0], acc[1] + p[1], acc[2] + p[2]],
    [0, 0, 0]
  );
  const n = f.path.length;
  return [sum[0] / n, sum[1] / n, sum[2] / n];
}

/** 找到 CH4 最高的裂缝 */
function findHighGasFractures(fractures: Fracture[], gasThreshold: number) {
  return fractures
    .map((f) => ({
      fracture: f,
      ch4: f.sensorReading.ch4_pct,
      temp: f.sensorReading.temperature_c,
      water: f.sensorReading.water_pressure_mpa,
      stress: f.sensorReading.stress_mpa,
      perm: f.sensorReading.permeability_md,
      micro: f.sensorReading.microseismic_count,
    }))
    .filter((x) => x.ch4 > 0)
    .sort((a, b) => b.ch4 - a.ch4);
}

export function generateMockAIResponse(
  input: string,
  sceneContext?: { fractures: Fracture[]; scenario: ScenarioType; gasThreshold: number }
): AIResponse {
  const lowerInput = input.toLowerCase();
  const fractures = sceneContext?.fractures ?? [];
  const scenario = sceneContext?.scenario ?? 'coal';
  const gasThreshold = sceneContext?.gasThreshold ?? 1.5;

  // ========== 找出最危险的点 ==========
  if (
    lowerInput.includes('最危险') ||
    lowerInput.includes('危险点') ||
    lowerInput.includes('最危险的地方') ||
    lowerInput.includes('哪里危险') ||
    lowerInput.includes('异常')
  ) {
    return findDangerousPoints(input, sceneContext);
  }

  // ========== 测距/剖面/框选 ==========
  if (lowerInput.includes('测距') || lowerInput.includes('测量距离')) {
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

  // ========== 全景/重置 ==========
  if (lowerInput.includes('全景') || lowerInput.includes('重置') || lowerInput.includes('全图') || lowerInput.includes('home')) {
    return {
      message: `## 已重置到全景视角\n\n当前场景展示全部裂缝网络。`,
      actions: [
        { type: 'fitAll' },
        { type: 'clearMarkers' },
      ],
    };
  }

  // ========== 清除标记 ==========
  if (lowerInput.includes('清除标记') || lowerInput.includes('清掉')) {
    return {
      message: `已清除3D场景中所有AI标记。`,
      actions: [{ type: 'clearMarkers' }],
    };
  }

  // ========== 切换场景 ==========
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

  // ========== 裂缝分布概览 ==========
  if (lowerInput.includes('裂缝') && (lowerInput.includes('分布') || lowerInput.includes('概览') || lowerInput.includes('多少条'))) {
    if (fractures.length === 0) {
      return {
        message: `当前场景尚未加载裂缝数据，请稍候。`,
        actions: [{ type: 'fitAll' }],
      };
    }

    const mainFractures = fractures.filter((f) => f.type === 'main');
    const branchFractures = fractures.filter((f) => f.type === 'branch');
    const avgLen = fractures.reduce((s, f) => s + f.length, 0) / fractures.length;
    const avgAperture = fractures.reduce((s, f) => s + f.aperture_um, 0) / fractures.length;
    const avgConn = fractures.reduce((s, f) => s + f.connectivity, 0) / fractures.length;
    const avgFractal = fractures.reduce((s, f) => s + f.fractal_dim, 0) / fractures.length;

    return {
      message: `## 裂缝网络分布概览\n\n当前探测区域共识别 **${fractures.length} 条裂缝**：\n\n| 类型 | 数量 | 平均长度 | 平均开度 |\n|------|------|---------|--------|\n| 主裂缝 | ${mainFractures.length} 条 | ${Math.round(mainFractures.reduce((s, f) => s + f.length, 0) / Math.max(mainFractures.length, 1))}m | ${Math.round(mainFractures.reduce((s, f) => s + f.aperture_um, 0) / Math.max(mainFractures.length, 1))}µm |\n| 分支裂缝 | ${branchFractures.length} 条 | ${Math.round(branchFractures.reduce((s, f) => s + f.length, 0) / Math.max(branchFractures.length, 1))}m | ${Math.round(branchFractures.reduce((s, f) => s + f.aperture_um, 0) / Math.max(branchFractures.length, 1))}µm |\n\n裂缝网络分形维数 **${avgFractal.toFixed(2)}**，平均连通性 **${avgConn.toFixed(2)}**。\n\n已展开全景视角，所有裂缝网络已高亮。`,
      actions: [
        { type: 'fitAll' },
        { type: 'clearMarkers' },
      ],
    };
  }

  // ========== 瓦斯浓度分析 ==========
  if (lowerInput.includes('瓦斯') || lowerInput.includes('ch4') || lowerInput.includes('气体') || lowerInput.includes('甲烷') || lowerInput.includes('浓度')) {
    const sorted = findHighGasFractures(fractures, gasThreshold);
    const dangerous = sorted.filter((x) => x.ch4 >= gasThreshold).slice(0, 5);
    const allAbove = sorted.filter((x) => x.ch4 >= gasThreshold);

    const tableRows = sorted.slice(0, 6)
      .map((x) => {
        const status = x.ch4 >= 1.5 ? '🔴 危险' : x.ch4 >= gasThreshold ? '⚠️ 超标' : '🟢 正常';
        return `| ${x.fracture.id} (${x.fracture.name}) | ${x.ch4.toFixed(2)}% | ${status} |`;
      })
      .join('\n');

    const actions: SceneAction[] = [
      { type: 'toggleLayer', layer: 'gasHeatmap' },
    ];

    // 标记危险裂缝
    if (dangerous.length > 0) {
      actions.push({
        type: 'markPoints',
        points: dangerous.map((x) => ({
          position: fractureCenter(x.fracture),
          label: `${x.fracture.id} CH4=${x.ch4.toFixed(2)}% ${x.ch4 >= 1.5 ? '🔴' : '⚠️'}`,
          level: (x.ch4 >= 1.5 ? 'danger' : 'warning') as 'danger' | 'warning',
        })),
      });
      // 飞到最危险的
      actions.push({
        type: 'flyTo',
        position: fractureCenter(dangerous[0].fracture),
        region: `最高瓦斯: ${dangerous[0].fracture.id}`,
      });
    }

    return {
      message: `## 瓦斯浓度分析\n\n已开启瓦斯热力图，数据来自裂缝节点传感器。\n\n| 裂缝 | CH₄浓度 | 状态 |\n|------|---------|------|\n${tableRows}\n\n**安全阈值**: ${gasThreshold.toFixed(1)}% (报警) / 1.5% (断电)\n\n${allAbove.length > 0 ? `⚠️ 共 **${allAbove.length}** 处裂缝瓦斯超标，已标记并飞行到最高浓度区域。` : '✅ 当前所有裂缝瓦斯浓度在安全范围内。'}`,
      actions,
    };
  }

  // ========== 应力场分析 ==========
  if (lowerInput.includes('应力') || lowerInput.includes('压力') || lowerInput.includes('stress') || lowerInput.includes('稳定性') || lowerInput.includes('岩爆')) {
    const stressSorted = fractures
      .filter((f) => f.sensorReading.stress_mpa > 0)
      .map((f) => ({ f, stress: f.sensorReading.stress_mpa, sigma1: f.sensorReading.stress_sigma1, sigma3: f.sensorReading.stress_sigma3, micro: f.sensorReading.microseismic_count }))
      .sort((a, b) => b.stress - a.stress);
    const top = stressSorted.slice(0, 5);

    const tableRows = top
      .map((x) => {
        const ratio = x.sigma3 > 0 ? (x.sigma1 / x.sigma3).toFixed(2) : '—';
        const risk = x.stress > 12 ? '🔴 高' : x.stress > 8 ? '⚠️ 中' : '🟢 低';
        return `| ${x.f.id} | ${x.stress.toFixed(1)} | ${x.sigma1.toFixed(1)} | ${x.sigma3.toFixed(1)} | ${ratio} | ${x.micro}/h | ${risk} |`;
      })
      .join('\n');

    const actions: SceneAction[] = [];

    // 标记应力集中区
    if (top.length > 0) {
      const stressPoints = top
        .filter((x) => x.stress > 8)
        .map((x) => ({
          position: fractureCenter(x.f),
          label: `${x.f.id} σ₁=${x.stress.toFixed(1)}MPa ${x.micro > 15 ? '微震活跃' : ''}`,
          level: (x.stress > 12 ? 'danger' : 'warning') as 'danger' | 'warning',
        }));
      if (stressPoints.length > 0) {
        actions.push({ type: 'markPoints', points: stressPoints });
      }
      actions.push({
        type: 'flyTo',
        position: fractureCenter(top[0].f),
        region: `应力集中: ${top[0].f.id}`,
      });
    }

    return {
      message: `## 地应力场分析\n\n基于三轴应力测量数据，已标记应力集中区域：\n\n| 裂缝 | 最大主应力 σ₁ (MPa) | σ₁ 值 | σ₃ 值 | σ₁/σ₃ | 微震/h | 岩爆风险 |\n|------|-------|-------|-------|-------|--------|--------|\n${tableRows}\n\n### 岩爆判据\n- σ₁/σ₃ > 2.0 → 需关注岩爆风险\n- 微震事件 > 15次/h → 需撤离\n\n${top[0] && top[0].micro > 15 ? `⚠️ **${top[0].f.id}** 微震事件 ${top[0].micro}/h 超过警戒线！` : '当前微震活动处于关注级别。'}`,
      actions,
    };
  }

  // ========== 渗透率评估 ==========
  if (lowerInput.includes('渗透') || lowerInput.includes('permeability') || lowerInput.includes('抽采')) {
    const permSorted = fractures
      .filter((f) => f.sensorReading.permeability_md > 0)
      .map((f) => ({
        f,
        perm: f.sensorReading.permeability_md,
        aperture: f.aperture_um,
        conn: f.connectivity,
      }))
      .sort((a, b) => b.perm - a.perm);
    const top = permSorted.slice(0, 6);

    const tableRows = top
      .map((x) => {
        const quality = x.perm > 2.0 ? '🟢 高（适合抽采）' : x.perm > 0.5 ? '🟡 中' : '🔴 低';
        return `| ${x.f.id} (${x.f.name}) | ${x.perm.toFixed(2)} | ${x.aperture.toFixed(0)}µm | ${x.conn.toFixed(2)} | ${quality} |`;
      })
      .join('\n');

    const actions: SceneAction[] = [];

    // 标记高渗透率裂缝（适合抽采）
    const highPerm = top.filter((x) => x.perm > 1.0);
    if (highPerm.length > 0) {
      actions.push({
        type: 'markPoints',
        points: highPerm.map((x) => ({
          position: fractureCenter(x.f),
          label: `${x.f.id} 渗透率=${x.perm.toFixed(2)}mD 抽采通道`,
          level: 'info' as const,
        })),
      });
    }
    if (top.length > 0) {
      actions.push({
        type: 'flyTo',
        position: fractureCenter(top[0].f),
        region: `最高渗透率: ${top[0].f.id}`,
      });
    }

    return {
      message: `## 渗透率评估\n\n基于应力-渗透率耦合分析（SD模型），已标记高渗透率裂缝：\n\n| 裂缝 | 渗透率 (mD) | 开度 | 连通性 | 评价 |\n|------|-----------|------|--------|------|\n${tableRows}\n\n> 渗透率 > 1.0 mD 的裂缝可作为瓦斯抽采通道。\n\n${highPerm.length > 0 ? `✅ 已标记 **${highPerm.length}** 条高渗透率裂缝，建议在这些位置布置抽采钻孔。已飞行到渗透率最高区域。` : '当前裂缝渗透率普遍偏低。'}`,
      actions,
    };
  }

  // ========== 温度分析 ==========
  if (lowerInput.includes('温度') || lowerInput.includes('热') || lowerInput.includes('temperature')) {
    const tempSorted = fractures
      .filter((f) => f.sensorReading.temperature_c > 0)
      .map((f) => ({ f, temp: f.sensorReading.temperature_c }))
      .sort((a, b) => b.temp - a.temp);
    const top = tempSorted.slice(0, 5);

    const actions: SceneAction[] = [
      { type: 'toggleLayer', layer: 'tempHeatmap' },
    ];
    if (top.length > 0) {
      actions.push({
        type: 'flyTo',
        position: fractureCenter(top[0].f),
        region: `最高温度: ${top[0].f.id}`,
      });
    }

    const tableRows = top.map((x) => `| ${x.f.id} | ${x.temp.toFixed(1)}°C | ${x.temp > 38 ? '⚠️ 异常' : '🟢 正常'} |`).join('\n');

    return {
      message: `## 温度场分析\n\n已开启温度热力图：\n\n| 裂缝 | 温度 | 状态 |\n|------|------|------|\n${tableRows}\n\n> 地温梯度约 3.0°C/100m，属于正常地温带。温度异常区需检查是否有深层热源或机电设备散热。`,
      actions,
    };
  }

  // ========== 突水预警 ==========
  if (lowerInput.includes('突水') || lowerInput.includes('涌水') || lowerInput.includes('water')) {
    const waterSorted = fractures
      .filter((f) => f.sensorReading.water_pressure_mpa > 0)
      .map((f) => ({ f, water: f.sensorReading.water_pressure_mpa }))
      .sort((a, b) => b.water - a.water);
    const top = waterSorted.slice(0, 5);

    const actions: SceneAction[] = [];
    const danger = top.filter((x) => x.water > 5);
    if (danger.length > 0) {
      actions.push({
        type: 'markPoints',
        points: danger.map((x) => ({
          position: fractureCenter(x.f),
          label: `${x.f.id} 水压=${x.water.toFixed(1)}MPa 🔴`,
          level: 'danger' as const,
        })),
      });
    }
    if (top.length > 0) {
      actions.push({
        type: 'flyTo',
        position: fractureCenter(top[0].f),
        region: `最高水压: ${top[0].f.id}`,
      });
    }

    const tableRows = top.map((x) => `| ${x.f.id} | ${x.water.toFixed(1)} | ${x.water > 5 ? '🔴 危险' : x.water > 3 ? '⚠️ 关注' : '🟢 正常'} |`).join('\n');

    return {
      message: `## 突水预警分析\n\n当前水压监测数据：\n\n| 裂缝 | 水压 (MPa) | 风险等级 |\n|------|----------|--------|\n${tableRows}\n\n${danger.length > 0 ? `🔴 **${danger.length}** 处裂缝水压接近临界值，存在突水风险！` : '✅ 当前水压数据正常。'}`,
      actions,
    };
  }

  // ========== 特定裂缝风险评估 (F-xxx) ==========
  const fractureMatch = fractures.find(
    (f) => lowerInput.includes(f.id.toLowerCase()) || lowerInput.includes(f.name.toLowerCase())
  );
  if (fractureMatch && (lowerInput.includes('风险') || lowerInput.includes('评估') || lowerInput.includes('分析'))) {
    return analyzeFracture(fractureMatch, gasThreshold);
  }

  // ========== 实验指令 ==========
  if (lowerInput.includes('实验') || lowerInput.includes('测试') || lowerInput.includes('模拟') || lowerInput.includes('压裂')) {
    return {
      message: `## 可用虚拟实验\n\n请在3D场景中选中裂缝后，在右侧面板执行实验：\n\n| 实验 | 描述 |\n|------|------|\n| 瓦斯扩散模拟 | 预测CH₄扩散路径 |\n| 稳定性评估 | 评估围岩稳定性 |\n| 突水预警 | 计算突水风险等级 |\n| 岩爆预测 | 基于微震和应力 |\n| 渗透率评估 | 计算等效渗透率 |\n| 裂缝连通性 | 分析网络连通性 |\n\n> 提示：点击3D场景中的裂缝线可选中并查看详情面板。`,
      actions: [],
    };
  }

  // ========== 机器人状态 ==========
  if (lowerInput.includes('机器人') || lowerInput.includes('状态') || lowerInput.includes('群智') || lowerInput.includes('设备')) {
    return {
      message: `## 机器人集群状态\n\n当前部署的仿生探测机器人沿裂缝网络分布，实时回传传感器数据。\n\n左侧"机器人集群"面板可查看完整列表，点击告警可飞行到对应机器人位置。`,
      actions: [],
    };
  }

  // ========== 兜底 ==========
  return {
    message: `我已收到您的指令："${input}"\n\n当前场景共 **${fractures.length}** 条裂缝，可通过以下指令分析：\n- 裂缝分布概览\n- 瓦斯浓度分析\n- 应力场分析\n- 渗透率评估\n- 温度场分析\n- 突水预警\n- 找出最危险的点\n- F-xxx 风险评估（如 F-003风险评估）\n\n请问还需要分析什么？`,
  };
}

/** 分析单条裂缝的综合风险 */
function analyzeFracture(f: Fracture, gasThreshold: number): AIResponse {
  const s = f.sensorReading;
  const risks: string[] = [];
  const markers: { position: [number, number, number]; label: string; level: 'danger' | 'warning' | 'info' }[] = [];

  if (s.ch4_pct >= gasThreshold) {
    risks.push(`- **CH₄浓度**: ${s.ch4_pct.toFixed(2)}% ${s.ch4_pct >= 1.5 ? '🔴 超标' : '⚠️ 超标'}`);
    markers.push({
      position: fractureCenter(f),
      label: `${f.id} CH₄=${s.ch4_pct.toFixed(1)}%`,
      level: s.ch4_pct >= 1.5 ? 'danger' : 'warning',
    });
  }
  if (s.temperature_c > 38) {
    risks.push(`- **温度**: ${s.temperature_c.toFixed(1)}°C ⚠️ 异常偏高`);
    markers.push({ position: fractureCenter(f), label: `${f.id} 温度=${s.temperature_c.toFixed(0)}°C`, level: 'warning' });
  }
  if (s.water_pressure_mpa > 5) {
    risks.push(`- **水压**: ${s.water_pressure_mpa.toFixed(1)} MPa 🔴 接近临界值`);
    markers.push({ position: fractureCenter(f), label: `${f.id} 水压=${s.water_pressure_mpa.toFixed(1)}MPa`, level: 'danger' });
  }
  if (s.microseismic_count > 15) {
    risks.push(`- **微震**: ${s.microseismic_count} 次/h ⚠️ 超过警戒线`);
    markers.push({ position: fractureCenter(f), label: `${f.id} 微震=${s.microseismic_count}/h`, level: 'warning' });
  }
  if (s.stress_mpa > 12) {
    risks.push(`- **应力**: σ₁=${s.stress_mpa.toFixed(1)} MPa ⚠️ 应力集中`);
    markers.push({ position: fractureCenter(f), label: `${f.id} σ₁=${s.stress_mpa.toFixed(0)}MPa`, level: 'warning' });
  }

  const overallRisk = risks.length >= 3 ? '🔴 **高风险**' : risks.length >= 1 ? '⚠️ **中风险**' : '🟢 **低风险**';

  const actions: SceneAction[] = [
    { type: 'selectFracture', fractureId: f.id },
  ];
  if (markers.length > 0) {
    actions.push({ type: 'markPoints', points: markers });
  }

  return {
    message: `## ${f.id} (${f.name}) 风险评估\n\n已自动选中该裂缝并展开详情。\n\n### 基础参数\n- 类型: ${f.type === 'main' ? '主裂缝' : '分支裂缝'}\n- 长度: ${f.length.toFixed(1)}m\n- 开度: ${f.aperture_um.toFixed(0)}µm\n- 倾角: ${f.dip_angle.toFixed(1)}°\n- 连通性: ${f.connectivity.toFixed(2)}\n- 渗透率: ${s.permeability_md.toFixed(2)} mD\n\n### 风险因素\n${risks.length > 0 ? risks.join('\n') : '- 未检测到明显异常'}\n\n### 综合评估\n该裂缝为${overallRisk}区域。`,
    actions,
  };
}

/**
 * 分析裂缝数据找出最危险的点
 */
function findDangerousPoints(
  input: string,
  sceneContext?: { fractures: Fracture[]; scenario: ScenarioType; gasThreshold: number }
): AIResponse {
  if (!sceneContext || sceneContext.fractures.length === 0) {
    return {
      message: `当前场景尚未加载裂缝数据。`,
    };
  }

  const { fractures, scenario, gasThreshold } = sceneContext;

  const allNodes = fractures.flatMap((f) =>
    f.nodes.map((n) => {
      const ch4 = n.sensors.ch4_pct;
      const temp = n.sensors.temperature_c;
      const stress = n.sensors.stress_mpa;
      const micro = n.sensors.microseismic_count;
      const water = n.sensors.water_pressure_mpa;

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
        ch4, temp, stress, micro, water,
        score,
      };
    })
  );

  const sorted = allNodes.sort((a, b) => b.score - a.score);
  const top3 = sorted.filter((x) => x.score > 0).slice(0, 3);

  if (top3.length === 0) {
    return {
      message: `当前场景未检测到异常数据。`,
    };
  }

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

export const quickCommands = [
  { label: '裂缝分布概览', command: '裂缝网络分布情况' },
  { label: '瓦斯浓度分析', command: '分析当前瓦斯浓度' },
  { label: '应力场分析', command: '分析地应力场分布' },
  { label: '找出最危险的点', command: '找出最危险的点并标记' },
  { label: '渗透率评估', command: '渗透率评估分析' },
  { label: '突水预警', command: '突水风险预警' },
  { label: '温度场分析', command: '分析温度场分布' },
];
