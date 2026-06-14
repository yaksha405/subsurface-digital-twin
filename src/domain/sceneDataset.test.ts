import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSceneDataset } from './sceneDataset';

test('scene dataset keeps robot stats consistent with robot list', () => {
  const dataset = buildSceneDataset('fracture', 'coal');

  assert.equal(dataset.summary.robotFleet.total, dataset.robots.length);
  assert.equal(
    dataset.summary.robotFleet.online +
      dataset.summary.robotFleet.offline +
      dataset.summary.robotFleet.lowBattery +
      dataset.summary.robotFleet.error +
      dataset.summary.robotFleet.maintenance,
    dataset.robots.length,
  );
});

test('scene dataset keeps alert summary consistent with alerts list', () => {
  const dataset = buildSceneDataset('fracture', 'gold');

  assert.equal(dataset.summary.alerts.total, dataset.alerts.length);
  assert.equal(
    dataset.summary.alerts.danger +
      dataset.summary.alerts.warning +
      dataset.summary.alerts.info,
    dataset.alerts.length,
  );
});

test('scene dataset scene stats and robots stay aligned across scenario consumers', () => {
  const dataset = buildSceneDataset('fracture', 'oil');

  assert.equal(dataset.summary.scene.totalNodes > 0, true);
  assert.equal(dataset.summary.robotFleet.total, dataset.robots.length);
  assert.equal(dataset.summary.scene.onlineSensors, dataset.summary.scene.totalNodes);
});

test('scene dataset keeps underground scenario vocabulary and valid depth-driven summaries', () => {
  const dataset = buildSceneDataset('underground', 'underground');

  assert.equal(dataset.summary.scene.overThreshold >= 0, true);
  assert.equal(dataset.robots.every((robot) => robot.depth >= 0), true);
  assert.equal(dataset.summary.alerts.unacknowledged <= dataset.alerts.length, true);
});
