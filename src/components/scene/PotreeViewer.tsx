/**
 * PotreeViewer — Potree 大规模点云渲染器集成
 *
 * Potree 是业界标准的 Web 端十亿级点云渲染方案（LOD 八叉树）。
 * 本组件通过 CDN 加载 Potree 预构建包，嵌入到 React 应用中。
 *
 * 工作流：
 * 1. 后端 PotreeConverter 将 .ply/.las 原始点云转换为 octree LOD 格式
 * 2. 前端 PotreeViewer 加载转换后的点云，自动按距离做 LOD 分级渲染
 * 3. 十亿级点云也能流畅渲染（按需加载，非全量载入）
 *
 * 与 R3F 场景的关系：
 * - Potree 自己管理 WebGL canvas（独立于 R3F）
 * - 通过 div 叠层 + mixBlendMode 混合显示
 * - 相机同步通过 OrbitControls change 事件联动
 */

import { useEffect, useRef } from 'react';
import { useSceneStore } from '../../store/useSceneStore';

// Potree CDN 资源路径
const POTREE_CDN = 'https://cdn.jsdelivr.net/npm/potree@1.8.0';
const POTREE_PATH = `${POTREE_CDN}/build/potree`;
const POTREE_RESOURCES = [
  `${POTREE_PATH}/potree.css`,
  `${POTREE_PATH}/potree.js`,
  `${POTREE_CDN}/libs/three.js/build/three.min.js`,
  `${POTREE_CDN}/libs/plasio/js/laslaz.js`,
];

let potreeLoaded = false;

/** 动态加载 Potree 脚本和样式 */
function loadPotreeResources(): Promise<void> {
  if (potreeLoaded) return Promise.resolve();

  return new Promise((resolve, reject) => {
    // CSS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `${POTREE_PATH}/potree.css`;
    document.head.appendChild(link);

    // JS 按顺序加载
    const scripts = [
      `${POTREE_CDN}/libs/three.js/build/three.min.js`,
      `${POTREE_PATH}/potree.js`,
      `${POTREE_CDN}/libs/plasio/js/laslaz.js`,
    ];

    let idx = 0;
    const loadNext = () => {
      if (idx >= scripts.length) {
        potreeLoaded = true;
        resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = scripts[idx];
      script.onload = () => { idx++; loadNext(); };
      script.onerror = () => reject(new Error(`Failed to load: ${scripts[idx]}`));
      document.head.appendChild(script);
    };
    loadNext();
  });
}

interface PotreeViewerProps {
  /** 点云数据路径（PotreeConverter 输出的 metadata.json 所在目录） */
  pointCloudUrl?: string;
  /** 是否可见 */
  visible?: boolean;
}

export function PotreeViewer({ pointCloudUrl, visible = true }: PotreeViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const layers = useSceneStore((s) => s.layers);
  const gasThreshold = useSceneStore((s) => s.gasThreshold);

  useEffect(() => {
    if (!visible || !pointCloudUrl) return;

    let mounted = true;

    loadPotreeResources()
      .then(() => {
        if (!mounted || !containerRef.current) return;

        // @ts-ignore — Potree 全局对象
        const Potree = window.Potree;
        if (!Potree) return;

        const viewer = new Potree.Viewer(containerRef.current);
        viewer.setEDLEnabled(true);        // 眼适应光照增强
        viewer.setEDLRadius(1.0);
        viewer.setEDLStrength(0.4);
        viewer.setPointSize(2);
        viewer.setMaterial('Elevation');    // 按高程着色
        viewer.setFOV(60);
        viewer.setPointSizing('Adaptive');  // 自适应点大小
        viewer.setQuality('Squares');       // 方形点
        viewer.setSceneOptions({ cameraNear: 0.1, cameraFar: 10000 });

        viewerRef.current = viewer;

        // 加载点云
        Potree.loadPointCloud(pointCloudUrl, 'pointcloud', (e: any) => {
          if (e.pointcloud) {
            viewer.scene.addPointCloud(e.pointcloud);

            // 自动调整视角到点云范围
            viewer.fitToScreen();
          }
        });
      })
      .catch((err) => {
        console.warn('[PotreeViewer] CDN 加载失败，跳过 Potree 渲染:', err);
      });

    return () => {
      mounted = false;
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [pointCloudUrl, visible]);

  if (!visible) return null;

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none"
      style={{
        mixBlendMode: 'screen',
        opacity: layers.pointCloud ? 0.9 : 0,
        transition: 'opacity 0.3s',
        zIndex: 5,
      }}
    />
  );
}
