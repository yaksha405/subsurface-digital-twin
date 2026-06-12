import { useState, useCallback, useEffect } from 'react';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useSceneStore } from '../../store/useSceneStore';
import { useCanvasInteraction } from './useCanvasInteraction';
import type { Annotation } from '../../types';

/**
 * 文字标注工具 — 点击位置，输入文字，保存
 */
export function TextAnnotationTool() {
  const activeTool = useSceneStore((s) => s.activeTool);
  const setActiveTool = useSceneStore((s) => s.setActiveTool);
  const addAnnotation = useSceneStore((s) => s.addAnnotation);

  const isActive = activeTool === 'text';

  const [anchor, setAnchor] = useState<THREE.Vector3 | null>(null);
  const [input, setInput] = useState('');

  useEffect(() => {
    if (!isActive) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAnchor(null);
        setInput('');
        setActiveTool('none');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isActive, setActiveTool]);

  useCanvasInteraction(isActive && !anchor, {
    onPointerDown: useCallback((pt: THREE.Vector3) => {
      setAnchor(pt);
      setInput('');
    }, []),
  });

  const handleConfirm = useCallback(() => {
    const text = input.trim();
    if (text && anchor) {
      const annotation: Annotation = {
        id: `anno-text-${Date.now()}`,
        type: 'text',
        points: [[anchor.x, anchor.y, anchor.z] as [number, number, number]],
        label: text,
        createdAt: Date.now(),
      };
      addAnnotation(annotation);
    }
    setAnchor(null);
    setInput('');
    setActiveTool('none');
  }, [input, anchor, addAnnotation, setActiveTool]);

  const handleCancel = useCallback(() => {
    setAnchor(null);
    setInput('');
  }, []);

  if (!isActive && !anchor) return null;

  return (
    <>
      {anchor && (
        <mesh position={anchor} userData={{ noRaycast: true }}>
          <sphereGeometry args={[0.5, 16, 16]} />
          <meshBasicMaterial color="#FFE600" />
        </mesh>
      )}

      {anchor && (
        <Html position={[anchor.x, anchor.y + 2, anchor.z]} center>
          <div className="glass-panel px-3 py-2.5 text-xs min-w-[200px]" style={{ pointerEvents: 'auto' }}>
            <div className="text-[#FFE600] font-bold mb-2 text-[11px]">文字标注</div>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleConfirm(); }}
              placeholder="输入标注内容..."
              autoFocus
              className="w-full px-2 py-1.5 text-[10px] bg-black/30 text-[#E0E0E8] border border-white/10 rounded outline-none focus:border-[#FFE600]/40"
            />
            <div className="flex gap-2 mt-2">
              <button className="flex-1 px-2 py-1.5 text-[10px] bg-[#FFE600]/20 text-[#FFE600] rounded hover:bg-[#FFE600]/30 transition-all" onClick={handleConfirm}>确认 (Enter)</button>
              <button className="px-2 py-1.5 text-[10px] bg-white/5 text-[#A0A0B0] rounded hover:text-[#E0E0E8] hover:bg-white/10 transition-all" onClick={handleCancel}>重选</button>
            </div>
          </div>
        </Html>
      )}

      {isActive && !anchor && (
        <Html position={[0, 0, 0]} center>
          <div className="glass-panel px-3 py-2 text-[10px] text-[#FFE600] animate-pulse whitespace-nowrap" style={{ pointerEvents: 'none' }}>
            F3 文字标注 · 点击任意位置设置标注（ESC取消）
          </div>
        </Html>
      )}
    </>
  );
}
