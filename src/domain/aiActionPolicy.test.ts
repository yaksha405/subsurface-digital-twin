import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { evaluateAIAction, createAIActionAuditEntry, createUndoAction } from './aiActionPolicy';
import type { SceneAction } from '../types';

describe('evaluateAIAction', () => {
  it('allows view-only actions without review', () => {
    const action: SceneAction = { type: 'flyTo', position: [1, 2, 3] };
    const result = evaluateAIAction(action);

    assert.equal(result.allowed, true);
    assert.equal(result.requiresHumanReview, false);
  });

  it('requires review for inferred danger markers', () => {
    const action: SceneAction = {
      type: 'markPoints',
      points: [{ position: [1, 2, 3], label: '疑似风险', level: 'danger' }],
    };
    const result = evaluateAIAction(action);

    assert.equal(result.allowed, true);
    assert.equal(result.requiresHumanReview, true);
  });

  it('blocks unsafe threshold changes', () => {
    const action: SceneAction = { type: 'setGasThreshold', threshold: 99 };
    const result = evaluateAIAction(action);

    assert.equal(result.allowed, false);
  });
});

describe('createAIActionAuditEntry', () => {
  it('stores policy result with an undoable flag', () => {
    const action: SceneAction = { type: 'clearMarkers' };
    const entry = createAIActionAuditEntry(action, '清理标记', 10);

    assert.equal(entry.actionType, 'clearMarkers');
    assert.equal(entry.undoable, true);
    assert.equal(entry.createdAt, 10);
  });
});

describe('createUndoAction', () => {
  it('creates a reverse action for reversible AI actions', () => {
    const undo = createUndoAction({ type: 'setGasThreshold', threshold: 2.2 }, { gasThreshold: 1.5 });

    assert.deepEqual(undo, { type: 'setGasThreshold', threshold: 1.5 });
  });

  it('does not invent undo actions for workflow transitions', () => {
    const undo = createUndoAction({ type: 'switchScenario', scenario: 'nuclear' }, { gasThreshold: 1.5 });

    assert.equal(undo, null);
  });
});
