# 井下点云处理与裂缝重建后端服务

基于 FastAPI + Open3D 的点云处理后端，为井下机器人巡检前端提供点云去噪、
ICP 配准、Poisson 表面重建、RANSAC 裂缝面提取和 SLAM 位姿适配能力。

## 技术栈

| 组件 | 版本 | 用途 |
|------|------|------|
| FastAPI | 0.115.0 | Web 框架 |
| Open3D | 0.18.0 | 点云处理核心（去噪/法线/Poisson/ICP/RANSAC） |
| NumPy | 1.26.4 | 数值计算 |
| SciPy | 1.13.1 | 科学计算（降级备用） |
| scikit-learn | 1.5.2 | RANSAC 降级备用 |

## 快速启动

```bash
cd /Volumes/HD/robot/backend
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

验证：`curl http://localhost:8000/api/health`

API 文档：`http://localhost:8000/docs`

## API 端点

### 1. POST /api/process/pointcloud — 点云去噪

```bash
curl -X POST http://localhost:8000/api/process/pointcloud \
  -F "file=@scan.ply" \
  -F "neighbors=20" \
  -F "ratio=2.0" \
  -F "voxel_size=0.05"
```

### 2. POST /api/process/register — ICP 配准

```bash
curl -X POST http://localhost:8000/api/process/register \
  -H "Content-Type: application/json" \
  -d '{"source": [[0,0,0],[1,0,0]], "target": [[0.1,0,0],[1.1,0,0]]}'
```

### 3. POST /api/reconstruct/fractures — 裂缝重建

```bash
curl -X POST http://localhost:8000/api/reconstruct/fractures \
  -H "Content-Type: application/json" \
  -d '{"points": [[0,0,0],[1,0,0],...], "scenario": "coal"}'
```

返回 `Fracture[]` JSON（格式匹配前端 `src/types/index.ts`）。

### 4. POST /api/process/slam-pose — SLAM 位姿

```bash
curl -X POST http://localhost:8000/api/process/slam-pose \
  -H "Content-Type: application/json" \
  -d '{"imu_data": {"angular_velocity": [0,0,0]}, "odom_data": {"position": [1,2,3], "orientation": [0,0,0,1]}}'
```

### 5. POST /api/process/transform — 局部→全局坐标变换

```bash
curl -X POST http://localhost:8000/api/process/transform \
  -H "Content-Type: application/json" \
  -d '{"local_points": [[0,0,0],[1,0,0]], "pose": {"position": [10,5,-3], "quaternion": [0,0,0,1]}}'
```

## 处理管线

```
机器人原始点云（噪声 + 局部坐标）
    │
    ├─ SLAM 位姿估计（/api/process/slam-pose）
    │     输入: IMU + 里程计 → 输出: 全局位姿(位置+朝向)
    │
    ├─ 坐标变换（/api/process/transform）
    │     局部坐标 → 全局坐标（R @ p + t）
    │
    ├─ 去噪（/api/process/pointcloud）
    │     统计离群点过滤 + 体素下采样
    │
    └─ 裂缝重建（/api/reconstruct/fractures）
          法线估计 → Poisson 重建 → RANSAC 平面分割 → Fracture JSON
```

## SLAM 集成

生产环境推荐替换为完整 SLAM 系统：

| 方案 | 适用 | ROS Topic |
|------|------|-----------|
| Cartographer | 激光 SLAM | `/tf` map→base_link |
| LIO-SAM | 激光惯性 | `/odometry/aft_mapped_to_init` |
| VINS-Fusion | 视觉惯性 | `/vins_estimator/odometry` |

通过 `rosbridge_suite` 或自定义网关将 ROS 位姿转发到本服务。

## 与前端对接

修改 `.env`：
```
VITE_API_MODE=live
VITE_API_BASE_URL=http://localhost:8000/api
```

前端自动从 mock 切换到真实后端。
