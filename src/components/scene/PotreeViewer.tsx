/**
 * PotreeViewer — 工业级点云渲染集成
 *
 * 使用 Potree (potree.org) 八叉树 LOD 引擎渲染大规模点云。
 * Potree 在独立的 WebGL context 中运行，通过相机同步与 R3F 场景融合。
 *
 * 架构：
 *   R3F Canvas (z-10, pointer events) → Potree Canvas (z-0, 背景层)
 *   相机流向：R3F OrbitControls → useFrame → Potree scene.view
 *
 * 数据来源：
 *   - mock 模式：public/pointclouds/vol_total/ (火山扫描示例数据)
 *   - live 模式：后端 PotreeConverter 转换的真实点云八叉树
 */

import { useEffect, useRef, useState } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useSceneStore } from '../../store/useSceneStore';

/**
 * PotreeCameraSync — 在 R3F Canvas 内运行，每帧将 R3F 相机同步到 Potree 相机
 * 必须放在 <Canvas> 内部使用
 */
export function PotreeCameraSync() {
  const { camera } = useThree();

  useFrame(() => {
    if (!potreeViewer) return;

    const view = potreeViewer.scene.view;
    if (!view) return;

    // 同步相机位置
    view.position.copy(camera.position);

    // 同步朝向：计算 R3F 相机的 lookAt 目标
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const target = camera.position.clone().add(dir.multiplyScalar(50));
    view.lookAt(target);

    // 触发 Potree 重渲染
    potreeViewer.setDirty();
  });

  return null;
}

// 模块级共享：Potree viewer 实例（供 PotreeCameraSync 读取）
export let potreeViewer: any = null;

// 动态加载脚本（顺序：jQuery → Potree CSS → Potree JS）
let potreeScriptPromise: Promise<void> | null = null;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load: ${src}`));
    document.head.appendChild(s);
  });
}

function loadPotreeScript(): Promise<void> {
  if (potreeScriptPromise) return potreeScriptPromise;
  potreeScriptPromise = (async () => {
    const base = import.meta.env.BASE_URL;

    // 1. jQuery（Potree 1.8 依赖）
    if (!(window as any).jQuery) {
      await loadScript(`${base}potree/jquery.min.js`);
    }

    // 2. Potree CSS
    if (!document.querySelector('link[href*="potree.css"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = `${base}potree/potree.css`;
      document.head.appendChild(link);
    }

    // 3. Potree JS
    if (!(window as any).Potree?.Viewer) {
      await loadScript(`${base}potree/potree.js`);
      // 验证 Potree 正确导出
      if (!(window as any).Potree?.Viewer) {
        throw new Error('Potree 加载失败 — Viewer 未导出（jQuery 可能未正确加载）');
      }
    }
  })();
  return potreeScriptPromise;
}

// API 配置
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
const API_MODE = import.meta.env.VITE_API_MODE || 'mock';

// 点云数据 URL
function getPointCloudUrl(): string {
  if (API_MODE === 'live' && API_BASE_URL) {
    return `${API_BASE_URL}/potree/metadata.json`;
  }
  // mock 模式：使用内置的火山扫描示例数据
  return `${import.meta.env.BASE_URL}pointclouds/vol_total/cloud.js`;
}

export function PotreeViewer() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const visible = useSceneStore((s) => s.layers.pointCloud);

  useEffect(() => {
    if (!visible) return;

    let cancelled = false;
    let viewer: any = null;

    loadPotreeScript()
      .then(() => {
        if (cancelled || !containerRef.current) return;

        const Potree = (window as any).Potree;
        viewer = new Potree.Viewer(containerRef.current);

        // 隐藏 Potree 自带 UI（我们用自己的 React UI）
        viewer.setEDLEnabled(true);
        viewer.setEDLOpacity(0.8);
        viewer.setEDLRadius(1.4);
        viewer.setEDLStrength(0.4);
        viewer.setBackground(null); // 透明背景
        viewer.setPointBudget(1_000_000); // 100万点预算
        viewer.setFOV(50);
        viewer.setClipTask(Potree.ClipTask.SHOW_INSIDE);

        // 隐藏 Potree 的 UI 面板和工具栏
        viewer.setNavigationMode(Potree.OrbitControls); // 使用 OrbitControls
        if (viewer.toggleSidebar) viewer.toggleSidebar();
        if (viewer.setTools) viewer.setTools([]);

        // 禁用 Potree 的自带输入处理（R3F 统一控制相机）
        viewer.inputHandler.setEnabled(false);

        potreeViewer = viewer;

        // 加载点云
        const pcUrl = getPointCloudUrl();
        Potree.loadPointCloud(pcUrl, 'pointcloud', (e: any) => {
          if (cancelled) return;

          if (e.type === 'loading_failed') {
            console.error('[PotreeViewer] Point cloud loading failed');
            setErrorMsg('点云加载失败');
            setLoading(false);
            return;
          }

          const scene = viewer.scene;
          scene.addPointCloud(e.pointcloud);

          // 设置初始材质
          const material = e.pointcloud.material;
          material.size = 1.5;
          material.pointSizeType = Potree.PointSizeType.ADAPTIVE;
          material.shape = Potree.PointShape.CIRCLE;
          material.activeAttributeName = 'rgba'; // 使用原始颜色

          // 自动适应视角
          viewer.fitToScreen();

          setLoading(false);
          console.log('[PotreeViewer] Point cloud loaded:', e.pointcloud.pcoGeometry.numPoints, 'points');
        });
      })
      .catch((err) => {
        console.error('[PotreeViewer] Failed to init Potree:', err);
        setErrorMsg(err.message);
        setLoading(false);
      });

    return () => {
      cancelled = true;
      potreeViewer = null;
      if (viewer) {
        try {
          viewer.onBeforeRender = null;
          if (containerRef.current) {
            containerRef.current.innerHTML = '';
          }
        } catch (e) {
          // ignore
        }
      }
    };
  }, [visible]);

  if (!visible) return null;

  return (
    <>
      <div
        ref={containerRef}
        className="absolute inset-0 z-0 pointer-events-none"
        style={{ background: 'transparent' }}
      />
      {loading && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-5 pointer-events-none">
          <div className="text-[10px] text-[#A0A0B0] bg-[#0A0C14]/80 px-3 py-1.5 rounded border border-white/10 animate-pulse">
            Potree 点云加载中...
          </div>
        </div>
      )}
      {errorMsg && (
        <div className="absolute bottom-12 left-3 z-5 pointer-events-none">
          <div className="text-[9px] text-[#FF6644]/70 bg-[#0A0C14]/80 px-2 py-1 rounded border border-[#FF6644]/20">
            Potree: {errorMsg}
          </div>
        </div>
      )}
    </>
  );
}
