# MEMORY

## Project: 异构群智数字孪生主控舱 (Digital Twin Control Cabin)
- **Location**: `/Volumes/HD/robot/`
- **Stack**: Vite 5 + React 18 + TS + Tailwind 3.4.17 + Three.js + R3F v8.17.10 + Drei v9 + Zustand v5
- **Open Source Integrations**: Shadcn UI (Radix UI) | Deck.gl | Three.js R3F | **Potree 1.8** | simplex-noise
- **v2 定位**: 地下裂缝探测机器人集群数字孪生平台，非隧道场景，而是地质体中的裂缝网络
- **用户**: 煤矿/金矿/油气行业工程师，可切换场景
- **Data Architecture**: `.env` → `src/api/` → `src/hooks/` → `src/components/`. Mock/live 双模式
- **AI接入**: Settings面板配置 LLM Provider/BaseURL/APIKey/Model，默认 DeepSeek，无 Key 时 mock 降级
- **Key**: npm install needs `--legacy-peer-deps`; ai@6 removed (zod/v4 conflict)
- **Started**: 2026-06-12
- **GitHub**: `yaksha405/subsurface-digital-twin` (**private**), GitHub Pages 因 private 不可外网访问
- **Build**: `npm run build` 只跑 `vite build`（跳过 tsc），因为有多处 R3F/deck.gl 类型兼容性问题但运行时无影响。`npm run build:check` 保留完整类型检查
- **数据管线**: 所有数据必须走 `src/api/` 层（sceneApi/fractureApi/robotApi/alertApi），组件不得直接 import `data/` 生成器
- **后端**: `backend/` FastAPI 提供全部数据接口 + Open3D 点云处理（去噪/ICP/Poisson/RANSAC/SLAM）+ PotreeConverter 八叉树转换。真实数据处理后存入 DataStore，GET 接口优先返回真实数据
- **Potree 1.8 已正式集成**: 从源码构建，部署到 `public/potree/`。PotreeViewer.tsx 独立 WebGL context + PotreeCameraSync 每帧同步。示例数据 vol_total（火山扫描）。后端 POST /api/potree/convert 转换真实数据
- **原则: 不手搓**: 有成熟开源方案就用开源方案，有冲突就删手搓的。已替换：点云渲染→Potree，噪声→simplex-noise

## User Preferences
- **极其重视交互体验**: 反复强调不要手搓，要参考成熟产品（Potree/CloudCompare/Cesium）的设计
- **数据必须物理真实**: Mock 数据必须符合论文/行业标准，让人看不出来是假的
- **工具栏防误操作**: 用户抱怨之前版本经常误操作，要求成熟的交互设计
- **不要做不需要的功能**: 比如视频融合，因为没有摄像头；但标注/测量/实验面板要专业

## Design Decisions
- 3D 场景: 半透明岩体 + 裂缝管道 + 机器人发光球体（非隧道）
- 裂缝数据参数来源: Huang et al. 2024 (Frontiers Earth Sci)
- 布局: 左(控制台) + 中上(3D) + 中下(AI对话) + 右(裂缝详情)
- 标注工具: 剖面线 + 区域框选 + 文字标注 + 测距（参考 Potree）
- **R3F 坑**: `visible={false}` 的 mesh 不参与射线检测！工具交互必须用 Canvas 级 DOM 事件 + 手动 Raycaster（见 `useCanvasInteraction.ts`），不能依赖 invisible mesh 的 onClick
- **drei Html 叠加层坑**: drei `<Html>` 组件在 canvas 上方创建 DIV 叠加层，会拦截 pointer 事件。工具的事件监听必须放在 `document` 级（capture 阶段），通过 `getBoundingClientRect()` 判断坐标是否在 canvas 范围内。不能只监听 `gl.domElement`！
