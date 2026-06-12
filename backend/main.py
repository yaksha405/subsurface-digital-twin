"""
井下点云处理与裂缝重建后端服务

技术栈：FastAPI + Open3D + NumPy + SciPy

API 端点：
1. POST /api/process/pointcloud  — 点云去噪（Open3D 统计离群点过滤 + 体素下采样）
2. POST /api/process/register    — 多帧点云 ICP 配准
3. POST /api/reconstruct/fractures — 从点云提取裂缝网络（去噪→法线→Poisson→RANSAC）
4. POST /api/process/slam-pose   — SLAM 位姿适配（局部坐标转全局坐标）
5. GET  /api/health              — 健康检查

启动方法：
    cd backend
    pip install -r requirements.txt
    uvicorn main:app --host 0.0.0.0 --port 8000 --reload
"""

import traceback
import numpy as np
from typing import List, Optional
from fastapi import FastAPI, UploadFile, File, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from processors.pointcloud_processor import PointCloudProcessor
from processors.slam_adapter import SlamAdapter

app = FastAPI(
    title="井下点云处理与裂缝重建服务",
    description="基于 Open3D 的点云去噪、ICP 配准、Poisson 重建、RANSAC 裂缝提取",
    version="1.0.0",
)

# CORS — 允许前端跨域访问
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 初始化处理器
pc_processor = PointCloudProcessor()
slam_adapter = SlamAdapter()


# ==================== 数据模型 ====================

class RegisterRequest(BaseModel):
    source: List[List[float]]
    target: List[List[float]]
    max_iter: int = 50
    threshold: float = 0.05


class FractureRequest(BaseModel):
    points: List[List[float]]
    scenario: str = "coal"
    voxel_size: float = 0.05
    poisson_depth: int = 8


class SlamPoseRequest(BaseModel):
    imu_data: dict
    odom_data: dict


class TransformRequest(BaseModel):
    local_points: List[List[float]]
    pose: dict


# ==================== 端点 ====================

@app.get("/api/health")
async def health():
    """健康检查"""
    return {
        "status": "ok",
        "service": "pointcloud-backend",
        "version": "1.0.0",
        "open3d_available": pc_processor.o3d is not None,
    }


@app.post("/api/process/pointcloud")
async def process_pointcloud(
    file: UploadFile = File(...),
    neighbors: int = Query(20, description="去噪近邻数"),
    ratio: float = Query(2.0, description="标准差倍率"),
    voxel_size: float = Query(0.05, description="体素大小（米）"),
):
    """
    点云去噪 — 上传 .ply/.las/.xyz/.pcd，返回去噪后点云

    管线：统计离群点过滤 → 体素下采样
    """
    try:
        raw_bytes = await file.read()
        points = _parse_pointcloud(raw_bytes, file.filename)
        original_count = len(points)

        if original_count == 0:
            raise HTTPException(400, "点云文件为空或解析失败")

        # ① 去噪
        clean_points, denoise_stats = pc_processor.denoise(points, neighbors, ratio)

        # ② 体素下采样
        ds_points, ds_stats = pc_processor.voxel_downsample(clean_points, voxel_size)

        return {
            "status": "ok",
            "filename": file.filename,
            "denoise": denoise_stats,
            "downsample": ds_stats,
            "points": ds_points.tolist(),
            "point_count": len(ds_points),
        }
    except HTTPException:
        raise
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(500, f"处理失败: {str(e)}")


@app.post("/api/process/register")
async def register_pointclouds(req: RegisterRequest):
    """
    ICP 配准 — 将源点云对齐到目标点云

    返回 4x4 变换矩阵、重叠率(fitness)、均方根误差(RMSE)
    """
    try:
        source = np.array(req.source)
        target = np.array(req.target)
        result = pc_processor.icp_register(source, target, req.threshold, req.max_iter)
        return {"status": "ok", "result": result}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(500, f"ICP 配准失败: {str(e)}")


@app.post("/api/reconstruct/fractures")
async def reconstruct_fractures(req: FractureRequest):
    """
    裂缝重建 — 从点云提取裂缝网络

    完整管线：去噪 → 法线估计 → Poisson 重建 → RANSAC 平面分割 → Fracture JSON

    返回 Fracture[] JSON（格式匹配前端 types/index.ts）
    """
    try:
        points = np.array(req.points)
        fractures = pc_processor.extract_fracture_network(
            points, req.scenario, req.voxel_size, req.poisson_depth
        )
        return {
            "status": "ok",
            "input_points": len(points),
            "fracture_count": len(fractures),
            "fractures": fractures,
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(500, f"裂缝重建失败: {str(e)}")


@app.post("/api/process/slam-pose")
async def process_slam_pose(req: SlamPoseRequest):
    """
    SLAM 位姿适配 — 融合 IMU + 里程计，输出全局位姿

    生产环境应替换为 Cartographer/VINS-Fusion 完整 SLAM 输出
    """
    try:
        pose = slam_adapter.process_imu_odometry(req.imu_data, req.odom_data)
        return {"status": "ok", "pose": pose}
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(500, f"SLAM 位姿处理失败: {str(e)}")


@app.post("/api/process/transform")
async def transform_points(req: TransformRequest):
    """
    坐标变换 — 将机器人局部坐标系点云转到全局坐标系

    输入：局部点云 + SLAM 位姿
    输出：全局坐标系点云
    """
    try:
        local = np.array(req.local_points)
        global_pts = slam_adapter.transform_to_global(local, req.pose)
        return {
            "status": "ok",
            "point_count": len(global_pts),
            "points": global_pts.tolist(),
        }
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(500, f"坐标变换失败: {str(e)}")


# ==================== 辅助函数 ====================

def _parse_pointcloud(raw_bytes: bytes, filename: str) -> np.ndarray:
    """解析上传的点云文件（支持 .ply/.pcd/.xyz/.las/.json）"""
    if pc_processor.o3d is not None:
        import tempfile, os
        suffix = os.path.splitext(filename)[1]
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
            f.write(raw_bytes)
            tmp_path = f.name
        try:
            if suffix in (".ply", ".pcd"):
                pcd = pc_processor.o3d.io.read_point_cloud(tmp_path)
                return np.asarray(pcd.points)
        finally:
            os.unlink(tmp_path)

    # 降级：尝试解析 XYZ / JSON
    try:
        text = raw_bytes.decode("utf-8")
        import json
        data = json.loads(text)
        if isinstance(data, list):
            return np.array(data)
    except Exception:
        pass

    # XYZ 格式（每行 x y z）
    try:
        lines = raw_bytes.decode("utf-8").strip().split("\n")
        points = []
        for line in lines:
            parts = line.strip().split()
            if len(parts) >= 3:
                points.append([float(parts[0]), float(parts[1]), float(parts[2])])
        return np.array(points) if points else np.zeros((0, 3))
    except Exception:
        return np.zeros((0, 3))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
