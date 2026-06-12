/** Potree 全局类型声明 */

declare global {
  interface Window {
    Potree?: PotreeNamespace;
  }
}

/** Potree 命名空间（部分类型，按需扩展） */
interface PotreeNamespace {
  Viewer: new (container: HTMLElement) => PotreeViewerInstance;
  loadPointCloud: (
    url: string,
    name: string,
    callback: (e: PotreeLoadEvent) => void
  ) => void;
  ClipTask: { SHOW_INSIDE: number; SHOW_OUTSIDE: number; HIGHLIGHT_INSIDE: number };
  PointSizeType: { ADAPTIVE: number; FIXED: number };
  PointShape: { CIRCLE: number; SQUARE: number };
  OrbitControls: any;
}

interface PotreeViewerInstance {
  scene: {
    pointclouds: any[];
    view: PotreeView;
    addPointCloud: (pc: any) => void;
    removeAllPointClouds: () => void;
  };
  inputHandler: { setEnabled: (enabled: boolean) => void };
  setEDLEnabled: (enabled: boolean) => void;
  setEDLOpacity: (opacity: number) => void;
  setEDLRadius: (radius: number) => void;
  setEDLStrength: (strength: number) => void;
  setBackground: (color: string | null) => void;
  setPointBudget: (budget: number) => void;
  setFOV: (fov: number) => void;
  setClipTask: (task: number) => void;
  setNavigationMode: (mode: any) => void;
  setDirty: () => void;
  fitToScreen: () => void;
  toggleSidebar?: () => void;
  setTools?: (tools: any[]) => void;
  onBeforeRender: (() => void) | null;
}

interface PotreeView {
  position: THREE.Vector3;
  yaw: number;
  pitch: number;
  radius: number;
  lookAt: (point: THREE.Vector3) => void;
}

interface PotreeLoadEvent {
  type: string;
  pointcloud: {
    pcoGeometry: { numPoints: number };
    material: {
      size: number;
      pointSizeType: number;
      shape: number;
      activeAttributeName: string;
    };
  };
}

export {};
