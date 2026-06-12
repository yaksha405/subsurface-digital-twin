import { useEffect, useRef, useState } from 'react';
import { Deck, OrbitView } from '@deck.gl/core';
import { HeatmapLayer } from '@deck.gl/aggregation-layers';
import type { Layer } from '@deck.gl/core';
import { useSceneStore } from '../../store/useSceneStore';
import { useSceneNodes } from '../../hooks/useSceneNodes';
import type { SceneNode } from '../../types';

/**
 * Deck.gl HeatmapLayer 集成组件
 * 使用 @deck.gl/aggregation-layers 的 HeatmapLayer 处理瓦斯/温度数据数组
 * 渲染在叠加 canvas 上，通过 mixBlendMode 产生雾化叠加效果
 *
 * 数据来源：useSceneNodes Hook（mock 模式用内置数据，live 模式从后端 API 获取）
 */

// 瓦斯色谱：深蓝 → 青 → 黄 → 红（PRD要求红蓝渐变）
const GAS_COLOR_RANGE: [number, number, number][] = [
  [13, 27, 80],
  [20, 80, 140],
  [30, 170, 200],
  [220, 200, 50],
  [255, 130, 30],
  [255, 50, 30],
];

// 温度色谱：深紫 → 红 → 橙 → 白
const TEMP_COLOR_RANGE: [number, number, number][] = [
  [20, 0, 60],
  [60, 0, 120],
  [180, 30, 80],
  [255, 100, 30],
  [255, 220, 100],
  [255, 255, 220],
];

interface HeatmapDataPoint {
  position: [number, number, number];
  weight: number;
}

function nodesToHeatmapData(nodes: SceneNode[]): { gas: HeatmapDataPoint[]; temp: HeatmapDataPoint[] } {
  const gas: HeatmapDataPoint[] = [];
  const temp: HeatmapDataPoint[] = [];
  for (const node of nodes) {
    const pos = node.geometry.center;
    gas.push({
      position: [pos.x, pos.y, pos.z],
      weight: node.sensors.ch4_concentration_pct,
    });
    temp.push({
      position: [pos.x, pos.y, pos.z],
      weight: node.sensors.temperature_celsius,
    });
  }
  return { gas, temp };
}

export function DeckGlHeatmap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const deckRef = useRef<Deck | null>(null);
  const [error, setError] = useState(false);

  const layers = useSceneStore((s) => s.layers);
  const physicalTruthMode = useSceneStore((s) => s.physicalTruthMode);
  const gasThreshold = useSceneStore((s) => s.gasThreshold);
  const { data: nodes } = useSceneNodes();

  const showGas = layers.gasHeatmap && !physicalTruthMode;
  const showTemp = layers.tempHeatmap && !physicalTruthMode;

  useEffect(() => {
    if (error || !containerRef.current || !nodes) return;
    if (!showGas && !showTemp) {
      // Clean up deck when no layers needed
      if (deckRef.current) {
        try {
          deckRef.current.setProps({ layers: [] });
        } catch (e) {
          // ignore
        }
      }
      return;
    }

    try {
      const { gas, temp } = nodesToHeatmapData(nodes);

      const deckLayers: Layer[] = [];

      if (showGas) {
        deckLayers.push(
          new HeatmapLayer<HeatmapDataPoint>({
            id: 'gas-heatmap',
            data: gas,
            getPosition: (d) => d.position,
            getWeight: (d) => d.weight,
            radiusPixels: 40,
            intensity: 1.2,
            threshold: 0.03,
            colorRange: GAS_COLOR_RANGE,
            opacity: 0.55,
          })
        );
      }

      if (showTemp) {
        deckLayers.push(
          new HeatmapLayer<HeatmapDataPoint>({
            id: 'temp-heatmap',
            data: temp,
            getPosition: (d) => d.position,
            getWeight: (d) => d.weight,
            radiusPixels: 45,
            intensity: 1.0,
            threshold: 0.03,
            colorRange: TEMP_COLOR_RANGE,
            opacity: 0.45,
          })
        );
      }

      if (!deckRef.current && containerRef.current) {
        deckRef.current = new Deck({
          parent: containerRef.current,
          width: '100%',
          height: '100%',
          views: [new OrbitView({ controller: false })],
          initialViewState: {
            target: [0, 0, 0],
            zoom: 0.5,
            rotationX: 30,
            rotationOrbit: 45,
          },
          layers: deckLayers,
          useDevicePixels: true,
        });
      } else if (deckRef.current) {
        deckRef.current.setProps({ layers: deckLayers });
      }
    } catch (e) {
      console.error('[DeckGlHeatmap] Failed to initialize Deck.gl:', e);
      setError(true);
    }
  }, [showGas, showTemp, gasThreshold, error, nodes]);

  useEffect(() => {
    return () => {
      try {
        deckRef.current?.finalize();
      } catch (e) {
        // ignore
      }
      deckRef.current = null;
    };
  }, []);

  if (error || (!showGas && !showTemp)) return null;

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none z-10"
      style={{ mixBlendMode: 'screen' }}
    />
  );
}
