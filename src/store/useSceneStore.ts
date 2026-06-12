import { create } from 'zustand';
import type { LayerState, CameraTarget, HighlightRegion, ChatMessage, SceneAction, Robot, ScenarioType, AnnotationTool, Annotation, Fracture, AIMarker } from '../types';

// 模块级高亮计时器 — 统一管理，避免多组件 setTimeout 竞态
let _highlightTimer: ReturnType<typeof setTimeout> | null = null;

interface SceneStore {
  // Layer visibility
  layers: LayerState;
  // Parameters
  gasThreshold: number;
  confidenceFilter: number;
  physicalTruthMode: boolean;
  /** 裂缝着色模式：默认(gas) / 渗透率(permeability) / 应力(stress) */
  fractureColorMode: 'gas' | 'permeability' | 'stress';
  // Spatial actions
  cameraTarget: CameraTarget | null;
  highlightRegion: HighlightRegion;
  // Volume measurement
  volumeMeasureMode: boolean;
  // Chat
  messages: ChatMessage[];
  // Panel collapse
  chatCollapsed: boolean;
  // 3D screenshot callback
  captureScreenshot: (() => string | null) | null;
  // Camera live position
  cameraInfo: { x: number; y: number; z: number; dist: number };
  // Selected robot for detail dialog
  selectedRobot: Robot | null;
  robotDetailOpen: boolean;
  /** 当前聚焦的机器人 ID（3D 场景中显示放大指示器） */
  focusedRobotId: string | null;

  // === v2: 裂缝网络 ===
  scenario: ScenarioType;
  fractures: Fracture[];
  selectedFracture: Fracture | null;
  selectedFractureNode: string | null;

  // === v2: 标注工具 ===
  activeTool: AnnotationTool;
  annotations: Annotation[];

  // Actions
  setLayer: (key: keyof LayerState, value: boolean) => void;
  setGasThreshold: (value: number) => void;
  setConfidenceFilter: (value: number) => void;
  setPhysicalTruthMode: (value: boolean) => void;
  setFractureColorMode: (mode: 'gas' | 'permeability' | 'stress') => void;
  flyTo: (target: CameraTarget) => void;
  clearCameraTarget: () => void;
  setHighlightRegion: (region: HighlightRegion) => void;
  /** 设置高亮并自动定时消失（统一计时器，避免竞态） */
  highlightWithTimer: (position: [number, number, number], radius: number, duration?: number) => void;
  /** 立即清除高亮 */
  clearHighlight: () => void;
  /** 重置场景视角：清除高亮、选中、AI标记，相机回到全景 */
  resetSceneView: () => void;
  setVolumeMeasureMode: (value: boolean) => void;
  toggleChatCollapsed: () => void;
  setCaptureScreenshot: (fn: (() => string | null) | null) => void;
  setCameraInfo: (info: { x: number; y: number; z: number; dist: number }) => void;
  openRobotDetail: (robot: Robot) => void;
  closeRobotDetail: () => void;
  // v2 actions
  setScenario: (s: ScenarioType) => void;
  setFractures: (f: Fracture[]) => void;
  selectFracture: (f: Fracture | null) => void;
  selectFractureNode: (id: string | null) => void;
  setActiveTool: (t: AnnotationTool) => void;
  addAnnotation: (a: Annotation) => void;
  removeAnnotation: (id: string) => void;
  clearAnnotations: () => void;
  // AI markers (LLM-placed)
  aiMarkers: AIMarker[];
  setAIMarkers: (markers: AIMarker[]) => void;
  addAIMarkers: (markers: AIMarker[]) => void;
  clearAIMarkers: () => void;
}

export const useSceneStore = create<SceneStore>((set, get) => ({
  layers: {
    mesh: false,
    pointCloud: true,
    gasHeatmap: false,
    tempHeatmap: false,
    robots: true,
    fractures: true,
    rockMass: true,
    poi: true,
  },
  gasThreshold: 1.5,
  confidenceFilter: 0,
  physicalTruthMode: false,
  fractureColorMode: 'gas',
  cameraTarget: null,
  highlightRegion: { position: [0, 0, 0], radius: 10, active: false },
  volumeMeasureMode: false,
  messages: [
    {
      id: 'msg-0',
      role: 'assistant',
      content: '## 系统就绪\n\n地质裂缝分析AI助手已上线。\n\n请在设置中配置AI模型（推荐 DeepSeek），或使用快捷指令。',
      timestamp: Date.now(),
    },
  ],
  chatCollapsed: false,
  captureScreenshot: null,
  cameraInfo: { x: 30, y: 15, z: 60, dist: 68.7 },
  selectedRobot: null,
  robotDetailOpen: false,
  focusedRobotId: null,

  // v2 state
  scenario: 'coal',
  fractures: [],
  selectedFracture: null,
  selectedFractureNode: null,
  activeTool: 'none',
  annotations: [],

  setLayer: (key, value) =>
    set((state) => ({
      layers: { ...state.layers, [key]: value },
    })),

  setGasThreshold: (value) => set({ gasThreshold: value }),

  setConfidenceFilter: (value) => set({ confidenceFilter: value }),

  setPhysicalTruthMode: (value) => {
    set({ physicalTruthMode: value });
  },

  setFractureColorMode: (mode) => set({ fractureColorMode: mode }),

  flyTo: (target) => set({ cameraTarget: target }),

  clearCameraTarget: () => set({ cameraTarget: null }),

  setHighlightRegion: (region) => {
    if (_highlightTimer) { clearTimeout(_highlightTimer); _highlightTimer = null; }
    set({ highlightRegion: region });
  },

  highlightWithTimer: (position, radius, duration = 5000) => {
    if (_highlightTimer) clearTimeout(_highlightTimer);
    set({ highlightRegion: { position, radius, active: true } });
    _highlightTimer = setTimeout(() => {
      set((state) => ({ highlightRegion: { ...state.highlightRegion, active: false } }));
      _highlightTimer = null;
    }, duration);
  },

  clearHighlight: () => {
    if (_highlightTimer) { clearTimeout(_highlightTimer); _highlightTimer = null; }
    set((state) => ({ highlightRegion: { ...state.highlightRegion, active: false } }));
  },

  resetSceneView: () => {
    if (_highlightTimer) { clearTimeout(_highlightTimer); _highlightTimer = null; }
    set((state) => ({
      highlightRegion: { ...state.highlightRegion, active: false },
      cameraTarget: { position: [0, 0, 0] },
      selectedFracture: null,
      selectedFractureNode: null,
      aiMarkers: [],
      fractureColorMode: 'gas' as const,
      focusedRobotId: null,
    }));
  },

  setVolumeMeasureMode: (value) => set({ volumeMeasureMode: value }),

  toggleChatCollapsed: () =>
    set((state) => ({ chatCollapsed: !state.chatCollapsed })),

  setCaptureScreenshot: (fn) => set({ captureScreenshot: fn }),

  setCameraInfo: (info) => set({ cameraInfo: info }),

  openRobotDetail: (robot) => set({ selectedRobot: robot, robotDetailOpen: true, focusedRobotId: robot.id }),
  closeRobotDetail: () => set({ robotDetailOpen: false }),

  // v2 actions
  setScenario: (s) => set({ scenario: s }),
  setFractures: (f) => set({ fractures: f }),
  selectFracture: (f) => set({ selectedFracture: f, selectedFractureNode: null }),
  selectFractureNode: (id) => set({ selectedFractureNode: id }),
  setActiveTool: (t) => set({ activeTool: t }),
  addAnnotation: (a) => set((state) => ({ annotations: [...state.annotations, a] })),
  removeAnnotation: (id) => set((state) => ({ annotations: state.annotations.filter((a) => a.id !== id) })),
  clearAnnotations: () => set({ annotations: [] }),

  // AI markers
  aiMarkers: [],
  setAIMarkers: (markers) => set({ aiMarkers: markers }),
  addAIMarkers: (markers) => set((state) => ({ aiMarkers: [...state.aiMarkers, ...markers] })),
  clearAIMarkers: () => set({ aiMarkers: [] }),
}));
