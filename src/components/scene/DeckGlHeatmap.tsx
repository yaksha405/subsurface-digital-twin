import { useEffect, useRef, useState } from 'react';
import { Deck, OrbitView } from '@deck.gl/core';
import { HeatmapLayer } from '@deck.gl/aggregation-layers';
import type { Layer } from '@deck.gl/core';
import { useSceneStore } from '../../store/useSceneStore';
import type { Fracture } from '../../types';

/**
 * Deck.gl HeatmapLayer — 瓦斯/温度热力图
 *
 * 数据来源：裂缝路径上的传感器节点（不是岩体随机散点）
 * 瓦斯只在裂缝中累积，不会在完整岩层中出现
 */

// 瓦斯色谱：深蓝 → 青 → 黄 → 红
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

/** 从裂缝路径节点提取热力图数据点 — 只在裂缝上有数据 */
function fracturesToHeatmapData(fractures: Fracture[]): { gas: HeatmapDataPoint[]; temp: HeatmapDataPoint[] } {
  const gas: HeatmapDataPoint[] = [];
  const temp: HeatmapDataPoint[] = [];
  for (const f of fractures) {
    for (const node of f.nodes) {
      gas.push({
        position: node.position,
        weight: node.sensors.ch4_pct,
      });
      temp.push({
        position: node.position,
        weight: node.sensors.temperature_c,
      });
    }
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
  const fractures = useSceneStore((s) => s.fractures);

  const showGas = layers.gasHeatmap && !physicalTruthMode;
  const showTemp = layers.tempHeatmap && !physicalTruthMode;

  useEffect(() => {
    if (error || !containerRef.current || fractures.length === 0) return;
    if (!showGas && !showTemp) {
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
      const { gas, temp } = fracturesToHeatmapData(fractures);

      const deckLayers: Layer[] = [];

      if (showGas && gas.length > 0) {
        deckLayers.push(
          new HeatmapLayer<HeatmapDataPoint>({
            id: 'gas-heatmap',
            data: gas,
            getPosition: (d) => [d.position[0], d.position[1], d.position[2]],
            getWeight: (d) => d.weight,
            radiusPixels: 25,
            intensity: 1.5,
            threshold: 0.03,
            colorRange: GAS_COLOR_RANGE,
            opacity: 0.55,
          })
        );
      }

      if (showTemp && temp.length > 0) {
        deckLayers.push(
          new HeatmapLayer<HeatmapDataPoint>({
            id: 'temp-heatmap',
            data: temp,
            getPosition: (d) => [d.position[0], d.position[1], d.position[2]],
            getWeight: (d) => d.weight,
            radiusPixels: 30,
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
      console.error('[DeckGlHeatmap] Failed:', e);
      setError(true);
    }
  }, [showGas, showTemp, gasThreshold, error, fractures]);

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
