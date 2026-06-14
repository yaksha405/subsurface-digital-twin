import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { useSceneStore } from './useSceneStore';
import type { Fracture, Robot, SensorReading } from '../types';

const reading: SensorReading = {
  ch4_pct: 0.8,
  co_ppm: 2,
  h2s_ppm: 0,
  temperature_c: 28,
  stress_mpa: 12,
  stress_sigma1: 14,
  stress_sigma2: 9,
  stress_sigma3: 8,
  permeability_md: 0.2,
  water_pressure_mpa: 1,
  microseismic_count: 1,
  acoustic_emission_mv: 80,
  humidity_pct: 60,
  fracture_aperture_um: 40,
  displacement_mm: 0.1,
  rock_strength_mpa: 55,
  pore_pressure_mpa: 1,
  porosity_pct: 4,
  fluid_ph: 7,
  water_saturation_pct: 12,
};

function robot(id = 'R-083'): Robot {
  return {
    id,
    model: 'floatwalker',
    status: 'online',
    position: [1, -2, 3],
    battery: 86,
    meshRole: 'edge',
    meshConnected: true,
    task: '暗流通道巡检',
    depth: 245,
    signalStrength: -70,
    sensors: { ch4: 0.2, temperature: 24, humidity: 82 },
    lastUpdate: 1,
  };
}

function fracture(id = 'UC-005'): Fracture {
  return {
    id,
    name: '暗河交汇腔',
    type: 'main',
    path: [[0, 0, 0], [1, 0, 0], [2, 0, 0]],
    length: 3,
    aperture_um: 40,
    porosity: 0.02,
    fractal_dim: 2.1,
    tortuosity: 1.1,
    dip_angle: 10,
    azimuth_angle: 20,
    roughness_coeff: 0.3,
    connectivity: 2,
    sensorReading: reading,
    nodes: [
      { id: 'UC-005-N1', position: [0, 0, 0], sensors: reading, timestamp: 1, robotId: 'R-083' },
    ],
    parentFractureId: null,
  };
}

function resetSelection() {
  useSceneStore.setState({
    selectedRobot: null,
    robotDetailOpen: false,
    focusedRobotId: null,
    selectedFracture: null,
    selectedFractureNode: null,
  });
}

describe('useSceneStore selection handoff', () => {
  it('uses robot selection as the active right-panel object', () => {
    resetSelection();
    const selectedFracture = fracture();

    useSceneStore.getState().selectFracture(selectedFracture);
    useSceneStore.getState().selectFractureNode('UC-005-N1');
    useSceneStore.getState().openRobotDetail(robot());

    const state = useSceneStore.getState();
    assert.equal(state.selectedRobot?.id, 'R-083');
    assert.equal(state.robotDetailOpen, true);
    assert.equal(state.focusedRobotId, 'R-083');
    assert.equal(state.selectedFracture, null);
    assert.equal(state.selectedFractureNode, null);
  });

  it('uses fracture selection as the active right-panel object', () => {
    resetSelection();
    const selectedRobot = robot();
    const selectedFracture = fracture();

    useSceneStore.getState().openRobotDetail(selectedRobot);
    useSceneStore.getState().selectFracture(selectedFracture);

    const state = useSceneStore.getState();
    assert.equal(state.selectedFracture?.id, 'UC-005');
    assert.equal(state.selectedRobot, null);
    assert.equal(state.robotDetailOpen, false);
    assert.equal(state.focusedRobotId, null);
  });

  it('clears robot and fracture selection together when requested', () => {
    resetSelection();
    useSceneStore.getState().openRobotDetail(robot());
    useSceneStore.getState().selectFracture(fracture());
    useSceneStore.getState().selectFractureNode('UC-005-N1');

    useSceneStore.getState().clearSelection();

    const state = useSceneStore.getState();
    assert.equal(state.selectedRobot, null);
    assert.equal(state.robotDetailOpen, false);
    assert.equal(state.focusedRobotId, null);
    assert.equal(state.selectedFracture, null);
    assert.equal(state.selectedFractureNode, null);
    assert.equal(state.highlightedFractureIds, null);
  });
});
