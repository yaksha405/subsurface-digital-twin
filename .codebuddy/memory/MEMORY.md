# MEMORY

## Project: 异构群智数字孪生主控舱 (Digital Twin Control Cabin)
- **Location**: `/Volumes/HD/robot/`
- **Stack**: Vite 5 + React 18 + TS + Tailwind 3.4.17 + Three.js + R3F v8.17.10 + Drei v9 + Zustand v5
- **Open Source Integrations**: Shadcn UI (Radix UI) | Deck.gl | Three.js R3F | **Potree 1.8** | simplex-noise
- **v2 定位**: 地下裂缝探测机器人集群数字孪生平台，非隧道场景，而是地质体中的裂缝网络
- **用户**: 煤矿/金矿/油气行业工程师 + 管线巡检 + 核反应堆管道检修，三种数据源可切换
- **数据源切换架构**: `DataSourceType = 'fracture' | 'pipeline' | 'nuclear' | 'refinery' | 'underground'` 顶层切换，机器人和管道数据按 dataSource 分别缓存。机器人系统参数从 boolean 改为 DataSourceType 字符串贯穿全部层级
- **五套数据生成器**: fractureDataGenerator(裂缝) / pipelineDataGenerator(油气管道) / nuclearDataGenerator(核反应堆) / refineryDataGenerator(炼油化工) / undergroundDataGenerator(地下暗流)
- **机器人型号**: `RobotModel = 'tracked' | 'wheeled' | 'climbing' | 'snake' | 'aerial' | 'spider' | 'floatwalker'`（浮走式=章鱼/水母式, 地下暗流专用, 水中漂浮蠕动+6触须）
- **核反应堆模式无岩层**: RockMass 在 `dataSource==='nuclear'` 时返回 null，由 ReactorContainment 替代（安全壳穹顶+RPV+4个SG+4个RCP+PRZ）
- **Data Architecture**: `.env` → `src/api/` → `src/hooks/` → `src/components/`. Mock/live 双模式
- **AI接入**: Settings面板配置 LLM Provider/BaseURL/APIKey/Model，默认 DeepSeek，无 Key 时 mock 降级
- **Key**: npm install needs `--legacy-peer-deps`; ai@6 removed (zod/v4 conflict)
- **Started**: 2026-06-12
- **GitHub**: `yaksha405/HIVE` (**public**), GitHub Pages: https://yaksha405.github.io/HIVE/ （曾用名 subsurface-digital-twin）
- **Vercel**: https://robot-azure-nu.vercel.app （vercel.json 配置为纯前端静态构建，排除 backend Python）
- **Build**: `npm run build` 只跑 `vite build`（跳过 tsc），因为有多处 R3F/deck.gl 类型兼容性问题但运行时无影响。`npm run build:check` 保留完整类型检查
- **数据管线**: 所有数据必须走 `src/api/` 层（sceneApi/fractureApi/robotApi/alertApi），组件不得直接 import `data/` 生成器
- **后端**: `backend/` FastAPI 提供全部数据接口 + Open3D 点云处理（去噪/ICP/Poisson/RANSAC/SLAM）+ PotreeConverter 八叉树转换。真实数据处理后存入 DataStore，GET 接口优先返回真实数据
- **Potree 1.8 已正式集成**: 从源码构建，部署到 `public/potree/`。PotreeViewer.tsx 独立 WebGL context + PotreeCameraSync 每帧同步。示例数据 vol_total（火山扫描）。后端 POST /api/potree/convert 转换真实数据
- **原则: 不手搓**: 有成熟开源方案就用开源方案，有冲突就删手搓的。已替换：点云渲染→Potree，噪声→simplex-noise

## User Preferences
- **极其重视交互体验**: 反复强调不要手搓，要参考成熟产品（Potree/CloudCompare/Cesium）的设计
- **数据必须物理真实**: Mock 数据必须符合论文/行业标准，让人看不出来是假的
- **全场景一致性**: 所有数据（机器人传感器/告警/趋势/详情面板）必须按 6 种场景（coal/gold/oil/pipeline/nuclear/refinery）分别适配，不能全场景硬编码煤矿的 CH₄/温度/湿度
- **工具栏防误操作**: 用户抱怨之前版本经常误操作，要求成熟的交互设计
- **不要做不需要的功能**: 比如视频融合，因为没有摄像头；但标注/测量/实验面板要专业

## 强制规则: 场景渲染标准色系 (Scene Color Standard)
- **原则**: 所有3D渲染颜色必须遵循工业标准，不能随意配色。颜色来源基于 ANSI/ASME A13.1、DZ/T 0179 国标、IS 2379。
- **单文件**: `src/lib/sceneColors.ts` — 所有颜色常量的唯一来源，各组件 import 引用
- **标准文档**: `docs/COLOR_STANDARD.md` — 强制规范，含五大场景映射表+四大色彩体系+编码规范
- **四大色系**:
  1. **身份色**（结构色）: 管道/岩石/流体/核设施按工业标准（水=绿、油=棕、有毒=橙、消防=红、压缩气=蓝、岩层=黄棕、地下水=蓝、RPV=灰紫）
  2. **数据色**（叠色）: 统一 turbo colormap 蓝→绿→黄→红，通过 `valueToColor()` + 各场景的 `getSensorMetric()` 实现
  3. **状态色**: 统一红绿灯 — danger红/warning橙/caution黄/safe绿
  4. **交互色**: 全局统一黄色 — selected `#FFE600` / hover `#FFCC00`
- **地下暗流通道可见性规则**: (1) 禁用 meshPhysicalMaterial transmission（无环境贴图会变黑）; (2) 通道必须自发光 emissive=GEO_IDENTITY.waterGlow intensity≥0.2; (3) 地下岩体外壳 opacity≤0.5; (4) 通道 renderOrder=2
- **禁止**: 组件内不再硬编码颜色值，必须从 `sceneColors.ts` 引用

## 强制规则: 管网/裂缝/河道连通性检查 (Graph Theory)
- **原则**: 所有3D孪生场景中的线状要素（管道、裂缝、河道、隧道、管廊）必须物理连通，否则机器人无法进入或到达。部分连通也合理（分支/终端），但不应出现大量漂浮段。
- **检查方法**: 用图论（并查集 Union-Find + 路径采样点匹配）。将每条管道路径离散为采样点，任意两管端点/采样点距离 < TOL(=1.2) 即认为连通，union 到同一分量。最终检查连通分量数和孤立管道数。
- **何时检查**: 每次新增或修改场景数据生成器（`*DataGenerator.ts`）后，必须运行连通性检查脚本。修改管道坐标、新增管道、调整连接关系后都要重新验证。
- **适用所有场景**: 油气管线(pipeline)、核反应堆(nuclear)、炼油化工(refinery)、地下裂缝(fracture)、任何未来场景（河流、隧道等）。
- **脚本**: `check-connectivity.mjs`（运行: `npx tsx check-connectivity.mjs`），import 各 DataGenerator 导出的 channels/pipes，用 UnionFind 分析。
- **教训**: 2026-06-13 三大场景首次检查发现 61/114 根管道断开（核反应堆29/34最严重），原因是坐标系不匹配、缺集合总管、环路间无公共连接点。修复后全部1个连通分量0断开。

## Product Standards Index (产品标准索引)
- **唯一入口**: `docs/README.md` — 所有产品标准、规范、强制规则的索引根文件
- **三级分类**: 强制规范(S1-S3) → 设计参考(R1-R2) → 规格文档(P1)
- **S1** 色彩标准 `docs/COLOR_STANDARD.md` → `src/lib/sceneColors.ts`
- **S2** 导出标准 `docs/EXPORT_STANDARD.md` → `src/lib/export*.ts`
- **S3** API契约 `API_CONTRACT.md` (根目录) → `src/api/`
- **规则**: 新增任何规范文档必须登记到 `docs/README.md` 索引

## 强制规则: 数据导出合规标准 (Export Standard)
- **原则**: 系统定位是"最强数据采集和决策看盘工具"，不替代 Trimble/AutoCAD/Bentley 重型工程画图软件。但必须无缝导出数据给测绘工程师，否则采购方会反对。
- **四大导出格式** (Export Hub 组件 `src/components/layout/ExportHub.tsx`):
  1. **PDF** — 安全评估报告 (ISO 32000-1), 9章节含截图+LLM分析+SHA-256哈希
  2. **LAS 1.4** — 点云 (ASPRS LAS 1.4-R15), Format 2含RGB, 兼容Trimble/Civil 3D/CloudCompare/ArcGIS
  3. **OBJ+MTL** — 3D网格 (Wavefront OBJ), 裂缝TubeGeometry+体素面片+机器人, 兼容3D打印
  4. **CSV** — 传感器矩阵 (RFC 4180, UTF-8 BOM), 4数据区, 兼容Excel/ERP/SCADA
- **标准文档**: `docs/EXPORT_STANDARD.md` — 含LAS文件头规范/OBJ命名规范/CSV字段定义/PR Review检查项
- **导出库**: `src/lib/exportLAS.ts`, `src/lib/exportOBJ.ts`, `src/lib/exportCSV.ts`, `src/lib/pdfExport.ts`

## Design Decisions
- 3D 场景: 半透明岩体 + 裂缝管道 + 机器人发光球体（非隧道）
- 裂缝数据参数来源: Huang et al. 2024 (Frontiers Earth Sci)
- 布局: 左(控制台) + 中上(3D) + 中下(AI对话) + 右(裂缝详情)
- 标注工具: 剖面线 + 区域框选 + 文字标注 + 测距（参考 Potree）
- **R3F 坑**: `visible={false}` 的 mesh 不参与射线检测！工具交互必须用 Canvas 级 DOM 事件 + 手动 Raycaster（见 `useCanvasInteraction.ts`），不能依赖 invisible mesh 的 onClick
- **drei Html 叠加层坑**: drei `<Html>` 组件在 canvas 上方创建 DIV 叠加层，会拦截 pointer 事件。工具的事件监听必须放在 `document` 级（capture 阶段），通过 `getBoundingClientRect()` 判断坐标是否在 canvas 范围内。不能只监听 `gl.domElement`！
