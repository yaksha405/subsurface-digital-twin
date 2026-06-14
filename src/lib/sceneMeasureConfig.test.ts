import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getLocalizedMeasureCopy } from './sceneMeasureConfig';

describe('sceneMeasureConfig localization', () => {
  it('returns fully localized English copy for area and profile workflows', () => {
    const pipeline = getLocalizedMeasureCopy('pipeline', 'en-US', 20);
    const underground = getLocalizedMeasureCopy('underground', 'en-US', 5000);

    assert.equal(pipeline.profileTitle, 'Segment cross-section');
    assert.equal(pipeline.densityLabel, 'segment density');
    assert.equal(pipeline.secondaryLabel, 'avg wall-loss');
    assert.equal(underground.areaTitle, 'Underground-flow zone analysis');
    assert.equal(underground.pointLabel, 'channel checkpoints');
    assert.equal(underground.slopeAngleLabel, 'channel dip');
  });

  it('keeps original Chinese copy in zh locale', () => {
    const coal = getLocalizedMeasureCopy('coal', 'zh-CN', 1.5);

    assert.equal(coal.profileTitle, '剖面截面分析');
    assert.equal(coal.densityLabel, '裂缝密度');
  });
});
