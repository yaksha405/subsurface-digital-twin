# HIVE — 群智数字孪生主控舱

> 地下空间多机器人集群协同探测的数字孪生可视化平台
>
> **在线 Demo**: https://yaksha405.github.io/HIVE/

---

## 概述

HIVE 是一个面向煤矿、金矿、油气等地下工程场景的数字孪生系统。支持：

- **三维场景渲染** — 隧道/岩体/裂缝网络实时可视化
- **工业级点云** — Potree 八叉树 LOD 渲染引擎，支持十亿级点云
- **多源传感器热力图** — deck.gl GPU 加速渲染瓦斯/温度/应力空间分布
- **集群机器人管理** — 200+ 台机器人实时状态、Mesh 组网拓扑
- **AI 辅助决策** — LLM 流式对话 + 空间联动（点击对话自动飞向目标区域）
- **测量/标注工具** — 距离测量、剖面线、体量计算、文字标注
- **实时数据推送** — WebSocket 传感器/告警/机器人位置实时更新

支持三种地质场景，一键切换：

| 场景 | 重点监测指标 |
|------|------------|
| 煤矿 (coal) | CH₄、CO、H₂S、微震、声发射 |
| 金矿 (gold) | 位移、岩体强度、微震 |
| 油气 (oil) | 孔隙压力、渗透率、含水饱和度 |

---

## 技术栈

| 层 | 技术 | 说明 |
|----|------|------|
| **3D 渲染** | Three.js + React Three Fiber | 场景图、相机、光照 |
| **点云引擎** | Potree 1.8 | 工业级八叉树 LOD，十亿级点云 |
| **热力图** | deck.gl HeatmapLayer | GPU 加速空间插值 |
| **噪声** | simplex-noise | 多倍频 fBm 岩体表面 |
| **UI 组件** | Radix UI + Tailwind CSS | 无障碍 + 原子化样式 |
| **状态管理** | Zustand | 轻量全局状态 |
| **前端框架** | React 18 + TypeScript + Vite | |
| **后端** | FastAPI (Python) | 数据接口 + 点云处理 |
| **点云处理** | Open3D | 去噪/ICP/Poisson重建/RANSAC |
| **实时通信** | WebSocket | 传感器/告警推送 |

---

## 快速开始

### 前端

```bash
npm install
npm run dev          # 开发模式 http://localhost:5173
npm run build        # 生产构建 → dist/
npm run preview      # 预览生产构建
```

### 后端（可选）

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

后端 API 文档：`http://localhost:8000/docs`

### 数据模式切换

```bash
# .env 文件
VITE_API_MODE=mock        # mock=内置模拟数据（默认，零依赖）
VITE_API_MODE=live        # live=对接真实后端
VITE_API_BASE_URL=/api    # 后端地址
VITE_WS_URL=ws://host/ws  # WebSocket 地址
```

---

## 项目结构

```
HIVE/
├── src/
│   ├── components/
│   │   ├── scene/           # 3D 场景组件
│   │   │   ├── Scene3DCanvas.tsx    # 主画布
│   │   │   ├── PotreeViewer.tsx     # Potree 点云（独立 WebGL context）
│   │   │   ├── DeckGlHeatmap.tsx    # deck.gl 热力图
│   │   │   ├── FractureNetwork.tsx  # 裂缝网络
│   │   │   ├── RockMass.tsx         # 岩体（simplex-noise）
│   │   │   ├── RobotSwarm.tsx       # 机器人集群
│   │   │   └── Tunnel.tsx           # 隧道结构
│   │   ├── chat/            # AI 对话面板
│   │   ├── sidebar/         # 侧栏（机器人列表/告警）
│   │   └── tools/           # 测量/标注工具
│   ├── api/                 # 数据接口层（mock/live 自动切换）
│   ├── store/               # Zustand 状态管理
│   ├── hooks/               # React Hooks
│   ├── data/                # Mock 数据生成器
│   └── types/               # TypeScript 类型定义
├── backend/
│   ├── main.py              # FastAPI 服务
│   └── requirements.txt     # Python 依赖
├── public/
│   ├── potree/              # Potree 1.8 构建产物
│   └── pointclouds/         # 示例点云数据
├── API_CONTRACT.md          # 前后端接口契约（必读）
├── docs/
│   └── DATA_FORMAT.md       # 数据格式详细说明
└── .github/workflows/       # GitHub Pages 自动部署
```

---

## 数据对接

### 接口契约

完整接口定义见 [API_CONTRACT.md](./API_CONTRACT.md)。

核心接口：

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/fractures?scenario=coal` | GET | 裂缝网络（3D路径 + 传感器测点） |
| `/api/scene/nodes` | GET | 场景节点（点云位置 + 置信度） |
| `/api/scene/stats` | GET | 场景统计概览 |
| `/api/robots` | GET | 机器人集群列表（支持过滤） |
| `/api/robots/stats` | GET | 集群统计 |
| `/api/pois` | GET | 兴趣点（瓦斯异常区/塌方风险区） |
| `/api/ai/chat` | POST | AI 对话（SSE 流式） |
| `/api/potree/convert` | POST | 点云 → Potree 八叉树转换 |
| `/ws` | WebSocket | 实时推送（传感器/告警/机器人位置） |

### 坐标系统

- 3D 坐标：`[x, y, z]` 数组，单位**米**，Y 轴朝上
- 时间戳：毫秒级 Unix 时间戳
- ID 格式：`{前缀}-{三位数字}`（如 `F-001`、`R-012`）

### 点云数据

支持两种点云接入方式：

1. **Potree 八叉树**（推荐，大规模数据）
   - 使用 [PotreeConverter](https://github.com/potree/PotreeConverter) 将原始点云转为八叉树
   - `POST /api/potree/convert` 上传文件自动转换
   - 前端通过 PotreeViewer 自动加载 LOD 分片

2. **REST API**（小规模数据）
   - `GET /api/scene/nodes` 返回节点级点云
   - 适合万级以下点云快速预览

---

## 部署

### GitHub Pages（自动）

推送到 `main` 分支自动部署，访问地址：
```
https://yaksha405.github.io/HIVE/
```

### 自定义部署

```bash
npm run build
# 将 dist/ 部署到任意静态服务器
```

---

## 开源组件

本项目使用以下开源组件：

- [Potree](https://github.com/potree/potree) — WebGL 点云渲染 (BSD-2-Clause)
- [deck.gl](https://github.com/visgl/deck.gl) — 地理空间可视化 (MIT)
- [Three.js](https://github.com/mrdoob/three.js) / [React Three Fiber](https://github.com/pmndrs/react-three-fiber) — 3D 引擎 (MIT)
- [Radix UI](https://github.com/radix-ui/primitives) — 无障碍 UI 组件 (MIT)
- [simplex-noise](https://github.com/jwagner/simplex-noise.js) — 噪声生成 (MIT)
- [Zustand](https://github.com/pmndrs/zustand) — 状态管理 (MIT)

---

## License

Private — All rights reserved.
