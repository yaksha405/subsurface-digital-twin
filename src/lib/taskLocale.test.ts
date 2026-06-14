import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { localizeTask } from './taskLocale';

describe('taskLocale', () => {
  it('translates known robot tasks to English', () => {
    assert.equal(localizeTask('渗透率原位测试', 'en-US'), 'In-situ permeability test');
    assert.equal(localizeTask('矿化度检测', 'en-US'), 'Mineralization survey');
    assert.equal(localizeTask('管道壁厚超声检测', 'en-US'), 'Pipe wall ultrasonic thickness scan');
    assert.equal(localizeTask('主管道焊缝超声检测', 'en-US'), 'Primary pipe weld ultrasonic scan');
    assert.equal(localizeTask('换热器管束内窥检测', 'en-US'), 'Heat-exchanger tube bundle borescope inspection');
  });

  it('keeps Chinese task labels in Chinese locale', () => {
    assert.equal(localizeTask('裂缝精细探测', 'zh-CN'), '裂缝精细探测');
  });
});
