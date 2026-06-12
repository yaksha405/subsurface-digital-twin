import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useFlatGeometry } from '../../hooks/useFlatGeometry';
import { useSceneStore } from '../../store/useSceneStore';

export function PointCloudLayer() {
  const pointsRef = useRef<THREE.Points>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const { data, loading } = useFlatGeometry();

  const confidenceFilter = useSceneStore((s) => s.confidenceFilter);
  const gasThreshold = useSceneStore((s) => s.gasThreshold);
  const physicalTruthMode = useSceneStore((s) => s.physicalTruthMode);

  const geometry = useMemo(() => {
    if (!data) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(data.positions, 3));
    geo.setAttribute('aConfidence', new THREE.BufferAttribute(data.confidences, 1));
    geo.setAttribute('aGas', new THREE.BufferAttribute(data.gasValues, 1));
    geo.setAttribute('aTemp', new THREE.BufferAttribute(data.tempValues, 1));
    geo.setAttribute('aIntensity', new THREE.BufferAttribute(data.intensities, 1));
    return geo;
  }, [data]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uConfidenceThreshold: { value: 0.0 },
      uGasThreshold: { value: 1.5 },
      uPhysicalTruth: { value: 0 },
    }),
    []
  );

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
      materialRef.current.uniforms.uConfidenceThreshold.value = confidenceFilter / 100;
      materialRef.current.uniforms.uGasThreshold.value = gasThreshold;
      materialRef.current.uniforms.uPhysicalTruth.value = physicalTruthMode ? 1 : 0;
    }
  });

  const vertexShader = `
    attribute float aConfidence;
    attribute float aGas;
    attribute float aTemp;
    attribute float aIntensity;
    uniform float uTime;
    uniform float uConfidenceThreshold;
    uniform float uGasThreshold;
    uniform float uPhysicalTruth;
    varying float vConfidence;
    varying float vGas;
    varying float vTemp;
    varying float vIntensity;
    varying float vOverThreshold;

    void main() {
      vConfidence = aConfidence;
      vGas = aGas;
      vTemp = aTemp;
      vIntensity = aIntensity;
      vOverThreshold = step(uGasThreshold, aGas);

      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * mvPosition;

      float baseSize = 3.0 + aIntensity * 3.0;

      // Breathing effect for over-threshold points
      if (vOverThreshold > 0.5 && uPhysicalTruth < 0.5) {
        float pulse = sin(uTime * 4.0 + position.x * 0.5) * 0.5 + 0.5;
        baseSize *= 1.0 + pulse * 0.8;
      }

      gl_PointSize = baseSize * (200.0 / -mvPosition.z);
    }
  `;

  const fragmentShader = `
    uniform float uTime;
    uniform float uConfidenceThreshold;
    uniform float uGasThreshold;
    uniform float uPhysicalTruth;
    varying float vConfidence;
    varying float vGas;
    varying float vTemp;
    varying float vIntensity;
    varying float vOverThreshold;

    void main() {
      // Confidence filter: discard low confidence points
      if (vConfidence < uConfidenceThreshold) discard;

      // Circular point
      vec2 center = gl_PointCoord - vec2(0.5);
      float dist = length(center);
      if (dist > 0.5) discard;
      float alpha = smoothstep(0.5, 0.2, dist);

      // Physical truth mode: monochrome radar return
      if (uPhysicalTruth > 0.5) {
        vec3 radarColor = mix(vec3(0.3, 0.35, 0.4), vec3(0.6, 0.65, 0.7), vIntensity);
        gl_FragColor = vec4(radarColor, alpha * 0.7);
        return;
      }

      vec3 color;

      // Over-threshold gas: red breathing
      if (vOverThreshold > 0.5) {
        float pulse = sin(uTime * 4.0) * 0.5 + 0.5;
        color = mix(vec3(0.6, 0.1, 0.05), vec3(1.0, 0.2, 0.1), pulse);
        alpha *= 0.5 + pulse * 0.5;
      } else {
        // Normal: map gas to yellow-blue gradient
        float gasNorm = clamp(vGas / uGasThreshold, 0.0, 1.0);
        vec3 lowGas = vec3(0.12, 0.23, 0.37);   // dark blue
        vec3 midGas = vec3(0.15, 0.35, 0.25);   // teal
        vec3 highGas = vec3(1.0, 0.9, 0.0);     // yellow

        if (gasNorm < 0.5) {
          color = mix(lowGas, midGas, gasNorm * 2.0);
        } else {
          color = mix(midGas, highGas, (gasNorm - 0.5) * 2.0);
        }

        // Confidence affects brightness
        color *= 0.5 + vConfidence * 0.5;
        alpha *= 0.6 + vIntensity * 0.4;
      }

      gl_FragColor = vec4(color, alpha);
    }
  `;

  // 数据未就绪时不渲染
  if (loading || !geometry || !data) return null;

  return (
    <points ref={pointsRef} geometry={geometry}>
      <shaderMaterial
        ref={materialRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
