import { create } from 'zustand';
import type { LayerState, CameraTarget, HighlightRegion, ChatMessage, Robot, ScenarioType, DataSourceType, AnnotationTool, Annotation, Fracture, AIMarker } from '../types';
import type { Finding, FindingStatus } from '../domain/findingTypes';
import type { AIActionAuditEntry } from '../domain/aiActionPolicy';
import type { ExportHistoryEntry } from '../domain/exportHistory';
import type { Locale } from '../domain/i18nCatalog';
import { getSceneSemantics } from '../lib/sceneSemantics';

// 模块级高亮计时器 — 统一管理，避免多组件 setTimeout 竞态
let _highlightTimer: ReturnType<typeof setTimeout> | null = null;

const DATA_SOURCE_SCENARIO: Record<Exclude<DataSourceType, 'fracture'>, ScenarioType> = {
  pipeline: 'pipeline',
  nuclear: 'nuclear',
  refinery: 'refinery',
  underground: 'underground',
};

function isFractureScenario(scenario: ScenarioType): scenario is 'coal' | 'gold' | 'oil' {
  return scenario === 'coal' || scenario === 'gold' || scenario === 'oil';
}

interface SceneStore {
  // Layer visibility
  layers: LayerState;
  locale: Locale;
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
  dataSource: DataSourceType;
  scenario: ScenarioType;
  fractures: Fracture[];
  selectedFracture: Fracture | null;
  selectedFractureNode: string | null;
  /** 高亮的裂缝 ID 列表（传感器区域点击时高亮对应裂缝面） */
  highlightedFractureIds: string[] | null;

  // === v2: 标注工具 ===
  activeTool: AnnotationTool;
  annotations: Annotation[];

  // Actions
  setLayer: (key: keyof LayerState, value: boolean) => void;
  setLocale: (locale: Locale) => void;
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
  clearSelection: () => void;
  // v2 actions
  setDataSource: (d: DataSourceType) => void;
  setScenario: (s: ScenarioType) => void;
  setFractures: (f: Fracture[]) => void;
  selectFracture: (f: Fracture | null) => void;
  selectFractureNode: (id: string | null) => void;
  setHighlightedFractureIds: (ids: string[] | null) => void;
  setActiveTool: (t: AnnotationTool) => void;
  addAnnotation: (a: Annotation) => void;
  removeAnnotation: (id: string) => void;
  clearAnnotations: () => void;
  // AI markers (LLM-placed)
  aiMarkers: AIMarker[];
  setAIMarkers: (markers: AIMarker[]) => void;
  addAIMarkers: (markers: AIMarker[]) => void;
  clearAIMarkers: () => void;

  // === Phase 1: 风险发现 / 证据链 ===
  findings: Finding[];
  addFinding: (finding: Finding) => void;
  updateFindingStatus: (id: string, status: FindingStatus) => void;
  clearFindings: () => void;

  // === Phase 3: AI action audit ===
  aiActionAudit: AIActionAuditEntry[];
  addAIActionAudit: (entry: AIActionAuditEntry) => void;
  markAIActionUndone: (id: string) => void;
  clearAIActionAudit: () => void;

  // === Phase 4: export history ===
  exportHistory: ExportHistoryEntry[];
  addExportHistory: (entry: ExportHistoryEntry) => void;
  clearExportHistory: () => void;

  // === C1: 告警确认 ===
  acknowledgedAlertIds: string[];
  acknowledgeAlert: (id: string) => void;
  acknowledgeAllAlerts: (ids: string[]) => void;

  // === 任务回放 ===
  /** 回放进度 0~1（0=刚开始，1=全部渲染完毕） */
  playbackProgress: number;
  /** 是否正在播放回放 */
  isPlaying: boolean;
  /** 回放是否处于活跃状态（开始播放后为 true，用户点击"完成"或切换场景后为 false） */
  playbackActive: boolean;
  /** 回放速度倍率 */
  playbackSpeed: number;
  setPlaybackProgress: (v: number) => void;
  setPlaying: (v: boolean) => void;
  setPlaybackSpeed: (v: number) => void;
  /** 开始回放（进度归零、播放开始） */
  startPlayback: () => void;
  /** 停止回放（恢复完整渲染） */
  stopPlayback: () => void;
}

export const useSceneStore = create<SceneStore>((set) => ({
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
  locale: 'zh-CN',
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
  dataSource: 'fracture',
  scenario: 'coal',
  fractures: [],
  selectedFracture: null,
  selectedFractureNode: null,
  highlightedFractureIds: null,
  activeTool: 'none',
  annotations: [],

  setLayer: (key, value) =>
    set((state) => ({
      layers: { ...state.layers, [key]: value },
    })),

  setLocale: (locale) => set({ locale }),

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
      highlightedFractureIds: null,
      aiMarkers: [],
      fractureColorMode: 'gas' as const,
      selectedRobot: null,
      robotDetailOpen: false,
      focusedRobotId: null,
    }));
  },

  setVolumeMeasureMode: (value) => set({ volumeMeasureMode: value }),

  toggleChatCollapsed: () =>
    set((state) => ({ chatCollapsed: !state.chatCollapsed })),

  setCaptureScreenshot: (fn) => set({ captureScreenshot: fn }),

  setCameraInfo: (info) => set({ cameraInfo: info }),

  openRobotDetail: (robot) => set({
    selectedRobot: robot,
    robotDetailOpen: true,
    focusedRobotId: robot.id,
    selectedFracture: null,
    selectedFractureNode: null,
  }),
  closeRobotDetail: () => set({ robotDetailOpen: false, selectedRobot: null, focusedRobotId: null }),
  clearSelection: () => set({
    selectedRobot: null,
    robotDetailOpen: false,
    focusedRobotId: null,
    selectedFracture: null,
    selectedFractureNode: null,
    highlightedFractureIds: null,
  }),

  // v2 actions
  setDataSource: (d) => set((state) => {
    const nextScenario =
      d === 'fracture'
        ? isFractureScenario(state.scenario) ? state.scenario : 'coal'
        : DATA_SOURCE_SCENARIO[d];
    return {
      dataSource: d,
      scenario: nextScenario,
      gasThreshold: getSceneSemantics(nextScenario).threshold.defaultValue,
      selectedFracture: null,
      selectedFractureNode: null,
      highlightedFractureIds: null,
      selectedRobot: null,
      robotDetailOpen: false,
      focusedRobotId: null,
      fractureColorMode: 'gas' as const,
      activeTool: 'none' as const,
      playbackActive: false,
      isPlaying: false,
      playbackProgress: 1,
      cameraTarget: { position: [0, 0, 0] },
    };
  }),
  setScenario: (s) => set({
    scenario: s,
    selectedFracture: null,
    selectedFractureNode: null,
    highlightedFractureIds: null,
    selectedRobot: null,
    robotDetailOpen: false,
    focusedRobotId: null,
    activeTool: 'none',
    playbackActive: false,
    isPlaying: false,
    playbackProgress: 1,
    cameraTarget: { position: [0, 0, 0] },
  }),
  setFractures: (f) => set({ fractures: f }),
  selectFracture: (f) => set({
    selectedFracture: f,
    selectedFractureNode: null,
    ...(f
      ? { selectedRobot: null, robotDetailOpen: false, focusedRobotId: null }
      : {}),
  }),
  selectFractureNode: (id) => set({ selectedFractureNode: id }),
  setHighlightedFractureIds: (ids) => set({ highlightedFractureIds: ids }),
  setActiveTool: (t) => set({ activeTool: t }),
  addAnnotation: (a) => set((state) => ({ annotations: [...state.annotations, a] })),
  removeAnnotation: (id) => set((state) => ({ annotations: state.annotations.filter((a) => a.id !== id) })),
  clearAnnotations: () => set({ annotations: [] }),

  // AI markers
  aiMarkers: [],
  setAIMarkers: (markers) => set({ aiMarkers: markers }),
  addAIMarkers: (markers) => set((state) => ({ aiMarkers: [...state.aiMarkers, ...markers] })),
  clearAIMarkers: () => set({ aiMarkers: [] }),

  // Phase 1: 风险发现 / 证据链
  findings: [],
  addFinding: (finding) => set((state) => ({
    findings: state.findings.some((f) => f.id === finding.id)
      ? state.findings
      : [finding, ...state.findings],
  })),
  updateFindingStatus: (id, status) => set((state) => ({
    findings: state.findings.map((finding) =>
      finding.id === id
        ? { ...finding, status, updatedAt: Date.now() }
        : finding
    ),
  })),
  clearFindings: () => set({ findings: [] }),

  // Phase 3: AI action audit
  aiActionAudit: [],
  addAIActionAudit: (entry) => set((state) => ({
    aiActionAudit: [entry, ...state.aiActionAudit].slice(0, 50),
  })),
  markAIActionUndone: (id) => set((state) => ({
    aiActionAudit: state.aiActionAudit.map((entry) =>
      entry.id === id ? { ...entry, undoneAt: Date.now(), undoable: false } : entry
    ),
  })),
  clearAIActionAudit: () => set({ aiActionAudit: [] }),

  // Phase 4: export history
  exportHistory: [],
  addExportHistory: (entry) => set((state) => ({
    exportHistory: [entry, ...state.exportHistory].slice(0, 20),
  })),
  clearExportHistory: () => set({ exportHistory: [] }),

  // C1: 告警确认
  acknowledgedAlertIds: [],
  acknowledgeAlert: (id) => set((state) => ({
    acknowledgedAlertIds: state.acknowledgedAlertIds.includes(id)
      ? state.acknowledgedAlertIds
      : [...state.acknowledgedAlertIds, id],
  })),
  acknowledgeAllAlerts: (ids) => set((state) => ({
    acknowledgedAlertIds: [...new Set([...state.acknowledgedAlertIds, ...ids])],
  })),

  // 任务回放
  playbackProgress: 1,
  isPlaying: false,
  playbackActive: false,
  playbackSpeed: 50,
  setPlaybackProgress: (v) => set({ playbackProgress: Math.max(0, Math.min(1, v)) }),
  setPlaying: (v) => set({ isPlaying: v }),
  setPlaybackSpeed: (v) => set({ playbackSpeed: v }),
  startPlayback: () => set({ isPlaying: true, playbackProgress: 0, playbackActive: true }),
  stopPlayback: () => set({ isPlaying: false, playbackProgress: 1, playbackActive: false }),
}));
