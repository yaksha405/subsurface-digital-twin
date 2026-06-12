import { useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * 文档级射线检测 hook — 绕过 R3F mesh 事件传播 + drei Html 叠加层拦截问题
 *
 * 监听 document 的 pointer 事件（capture 阶段），检查坐标是否在 canvas 范围内，
 * 然后用 Raycaster 求交返回 3D 坐标点。
 *
 * 关键：drei 的 <Html> 组件会在 canvas 上方创建 DIV 叠加层（如预览标签、提示文字），
 * 这些 DIV 会拦截 pointer 事件导致 canvas 收不到。所以必须在 document 层监听，
 * 通过 getBoundingClientRect 判断坐标是否在 canvas 区域内。
 *
 * 过滤掉 userData.noRaycast 标记的 mesh（工具自身创建的标记/线条等），
 * 防止射线命中工具 mesh 导致正反馈循环。
 *
 * 注意：不调用 stopPropagation()，让 OrbitControls 在 bubble 阶段也能收到事件。
 * OrbitControls 的 LEFT 在工具激活时被设为 undefined，不会冲突。
 */
export function useCanvasInteraction(
  enabled: boolean,
  handlers: {
    onPointerDown?: (point: THREE.Vector3, e: PointerEvent) => void;
    onPointerMove?: (point: THREE.Vector3, e: PointerEvent) => void;
    onPointerUp?: (point: THREE.Vector3, e: PointerEvent) => void;
  }
) {
  const { gl, camera, scene } = useThree();
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!enabled) return;
    const dom = gl.domElement;

    /** 检查坐标是否在 canvas 范围内 */
    const isInCanvas = (clientX: number, clientY: number): boolean => {
      const rect = dom.getBoundingClientRect();
      return (
        clientX >= rect.left &&
        clientX <= rect.right &&
        clientY >= rect.top &&
        clientY <= rect.bottom
      );
    };

    const getIntersection = (clientX: number, clientY: number): THREE.Vector3 => {
      const rect = dom.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((clientY - rect.top) / rect.height) * 2 + 1;
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(x, y), camera);

      // 收集所有可见 mesh，排除工具自身创建的 mesh（标记为 noRaycast）
      const meshes: THREE.Mesh[] = [];
      scene.traverse((obj) => {
        if (
          obj instanceof THREE.Mesh &&
          obj.visible &&
          obj.geometry &&
          !obj.userData.noRaycast
        ) {
          meshes.push(obj);
        }
      });

      const intersects = raycaster.intersectObjects(meshes, false);
      if (intersects.length > 0) {
        return intersects[0].point.clone();
      }

      // 回退：射线与 Y=0 水平面求交
      const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const hitPoint = new THREE.Vector3();
      const gotHit = raycaster.ray.intersectPlane(groundPlane, hitPoint);
      if (gotHit) return hitPoint;

      // 最终回退：射线方向上的远点
      return raycaster.ray.origin.clone().add(
        raycaster.ray.direction.clone().multiplyScalar(100)
      );
    };

    // 监听 document（capture 阶段），检查坐标是否在 canvas 区域内
    // 这样即使 drei Html 叠加层拦截了事件，document capture 仍能收到
    const handleDown = (e: PointerEvent) => {
      if (e.button !== 0) return; // 只响应左键，右键留给 OrbitControls 旋转
      if (!isInCanvas(e.clientX, e.clientY)) return;
      const point = getIntersection(e.clientX, e.clientY);
      handlersRef.current.onPointerDown?.(point, e);
    };

    const handleMove = (e: PointerEvent) => {
      if (!handlersRef.current.onPointerMove) return;
      if (!isInCanvas(e.clientX, e.clientY)) return;
      const point = getIntersection(e.clientX, e.clientY);
      handlersRef.current.onPointerMove?.(point, e);
    };

    const handleUp = (e: PointerEvent) => {
      if (e.button !== 0) return;
      if (!isInCanvas(e.clientX, e.clientY)) return;
      const point = getIntersection(e.clientX, e.clientY);
      handlersRef.current.onPointerUp?.(point, e);
    };

    document.addEventListener('pointerdown', handleDown, { capture: true });
    document.addEventListener('pointermove', handleMove, { capture: true });
    document.addEventListener('pointerup', handleUp, { capture: true });
    dom.style.cursor = 'crosshair';

    return () => {
      document.removeEventListener('pointerdown', handleDown, { capture: true });
      document.removeEventListener('pointermove', handleMove, { capture: true });
      document.removeEventListener('pointerup', handleUp, { capture: true });
      dom.style.cursor = '';
    };
  }, [enabled, gl, camera, scene]);
}
