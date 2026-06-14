import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { t } from './i18nCatalog';

describe('i18nCatalog', () => {
  it('returns Chinese and English labels', () => {
    assert.equal(t('app.title', 'zh-CN'), 'HIVE 群智数字孪生主控舱');
    assert.equal(t('app.title', 'en-US'), 'HIVE Swarm Intelligence Control Cabin');
    assert.equal(t('control.console', 'en-US'), 'Console');
    assert.equal(t('status.system', 'en-US'), 'System Status');
    assert.equal(t('mission.snapshot', 'en-US'), 'Mission Delivery');
    assert.equal(t('coverage.truthBoundary', 'en-US'), 'Truth Boundary');
    assert.equal(t('truth.aiInferred', 'en-US'), 'AI Inferred');
    assert.equal(t('panel.layerControl', 'en-US'), 'Layer Control');
    assert.equal(t('panel.sensorTrends', 'en-US'), 'Sensor Trends');
    assert.equal(t('panel.measureTools', 'en-US'), 'Measurement Tools');
    assert.equal(t('panel.objectDetails', 'en-US'), 'Details');
    assert.equal(t('tool.profile', 'en-US'), 'Profile');
    assert.equal(t('tool.area', 'en-US'), 'Area Select');
    assert.equal(t('tool.exit', 'en-US'), 'ESC Exit');
    assert.equal(t('chat.placeholder', 'en-US'), 'Enter a command...');
    assert.equal(t('chat.expand', 'en-US'), 'Expand AI chat');
    assert.equal(t('chat.mockHint', 'en-US'), 'Mock mode · configure an API key in Settings');
    assert.equal(t('chat.requestFailedTitle', 'en-US'), 'Request Failed');
    assert.equal(t('mobile.title', 'en-US'), 'Use Desktop View');
  });
});
