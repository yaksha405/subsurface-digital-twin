import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useSceneStore } from '../../store/useSceneStore';

/**
 * 持久渲染已保存的标注（distance / profile / text / area）
 */
export function AnnotationOverlay() {
  const annotations = useSceneStore((s) => s.annotations);
  const removeAnnotation = useSceneStore((s) => s.removeAnnotation);

  if (annotations.length === 0) return null;

  return (
    <group>
      {annotations.map((anno) => {
        if ((anno.type === 'distance' || anno.type === 'profile') && anno.points.length >= 2) {
          const p0 = new THREE.Vector3(...anno.points[0]);
          const p1 = new THREE.Vector3(...anno.points[1]);
          const mid = new THREE.Vector3().addVectors(p0, p1).multiplyScalar(0.5);
          const dir = new THREE.Vector3().subVectors(p1, p0);
          const len = dir.length();
          dir.normalize();
          const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
          const isProfile = anno.type === 'profile';
          const color = isProfile ? '#FF9900' : '#44AAFF';
          const radius = isProfile ? 0.8 : 0.2;

          // 剖面线：额外渲染剖面面
          let profilePlane = null;
          if (isProfile) {
            const height = 30;
            const hw = len / 2;
            const hh = height / 2;
            const angle = Math.atan2(dir.x, dir.z);
            const planePositions = new Float32Array([
              -hw, -hh, 0,  hw, -hh, 0,  hw, hh, 0,
              -hw, -hh, 0,  hw, hh, 0,  -hw, hh, 0,
            ]);
            const edgePositions = new Float32Array([
              -hw, -hh, 0,  hw, -hh, 0,
               hw, -hh, 0,  hw,  hh, 0,
               hw,  hh, 0, -hw,  hh, 0,
              -hw,  hh, 0, -hw, -hh, 0,
            ]);
            profilePlane = (
              <group position={[mid.x, mid.y + height / 2, mid.z]} rotation={[0, -angle, 0]}>
                <mesh>
                  <bufferGeometry>
                    <bufferAttribute attach="attributes-position" count={6} array={planePositions} itemSize={3} />
                  </bufferGeometry>
                  <meshBasicMaterial color="#FF9900" transparent opacity={0.1} side={THREE.DoubleSide} depthWrite={false} />
                </mesh>
                <lineSegments>
                  <bufferGeometry>
                    <bufferAttribute attach="attributes-position" count={8} array={edgePositions} itemSize={3} />
                  </bufferGeometry>
                  <lineBasicMaterial color="#FF9900" transparent opacity={0.5} />
                </lineSegments>
              </group>
            );
          }

          return (
            <group key={anno.id}>
              {len > 0.01 && (
                <>
                  {/* 线主体 */}
                  <mesh position={mid} quaternion={quat}>
                    <cylinderGeometry args={[radius, radius, len, 8]} />
                    <meshBasicMaterial color={color} transparent opacity={0.85} />
                  </mesh>
                  {/* 剖面线光晕 */}
                  {isProfile && (
                    <mesh position={mid} quaternion={quat}>
                      <cylinderGeometry args={[radius * 1.6, radius * 1.6, len, 8]} />
                      <meshBasicMaterial color={color} transparent opacity={0.15} depthWrite={false} />
                    </mesh>
                  )}
                </>
              )}
              {/* 剖面面 */}
              {profilePlane}
              {/* 端点 */}
              <mesh position={p0}>
                <sphereGeometry args={[isProfile ? 0.8 : 0.3, 8, 8]} />
                <meshBasicMaterial color="#00FF88" />
              </mesh>
              <mesh position={p1}>
                <sphereGeometry args={[isProfile ? 0.8 : 0.3, 8, 8]} />
                <meshBasicMaterial color={color} />
              </mesh>
              <Html position={[mid.x, mid.y + (isProfile ? 18 : 1.5), mid.z]} center>
                <div className="glass-panel px-2 py-1 text-[10px] font-mono whitespace-nowrap flex items-center gap-2" style={{ pointerEvents: 'auto', color }}>
                  {anno.label}
                  <button className="text-[#FF3333] hover:scale-110 transition-transform ml-1" onClick={() => removeAnnotation(anno.id)} title="删除">✕</button>
                </div>
              </Html>
            </group>
          );
        }

        if (anno.type === 'text' && anno.points.length >= 1) {
          const p = new THREE.Vector3(...anno.points[0]);
          return (
            <group key={anno.id}>
              <mesh position={p}>
                <sphereGeometry args={[0.5, 12, 12]} />
                <meshBasicMaterial color="#FFE600" />
              </mesh>
              <mesh position={p}>
                <sphereGeometry args={[0.9, 12, 12]} />
                <meshBasicMaterial color="#FFE600" transparent opacity={0.2} depthWrite={false} />
              </mesh>
              {/* 引线 */}
              <Html position={[p.x, p.y + 2, p.z]} center>
                <div className="glass-panel px-2.5 py-1.5 text-[10px] text-[#FFE600] whitespace-nowrap flex items-center gap-2" style={{ pointerEvents: 'auto' }}>
                  {anno.label}
                  <button className="text-[#FF3333] hover:scale-110 transition-transform ml-1" onClick={() => removeAnnotation(anno.id)} title="删除">✕</button>
                </div>
              </Html>
            </group>
          );
        }

        if (anno.type === 'area' && anno.points.length >= 2) {
          const min = anno.points[0];
          const max = anno.points[1];
          const w = max[0] - min[0];
          const h = max[1] - min[1];
          const d = max[2] - min[2];
          return (
            <group key={anno.id}>
              <lineSegments position={[(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2]}>
                <edgesGeometry args={[new THREE.BoxGeometry(w, h, d)]} />
                <lineBasicMaterial color="#FFE600" transparent opacity={0.7} />
              </lineSegments>
              <Html position={[(min[0] + max[0]) / 2, max[1] + 2, (min[2] + max[2]) / 2]} center>
                <div className="glass-panel px-2 py-1 text-[10px] text-[#FFE600] font-mono whitespace-nowrap flex items-center gap-2" style={{ pointerEvents: 'auto' }}>
                  {anno.label}
                  <button className="text-[#FF3333] hover:scale-110 transition-transform ml-1" onClick={() => removeAnnotation(anno.id)} title="删除">✕</button>
                </div>
              </Html>
            </group>
          );
        }

        return null;
      })}
    </group>
  );
}
