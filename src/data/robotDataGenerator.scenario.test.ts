import test from 'node:test';
import assert from 'node:assert/strict';
import { generateMockRobots } from './robotDataGenerator';

test('gold fracture robots use gold mine tasks instead of coal gas tasks', () => {
  const robots = generateMockRobots('fracture', 'gold');
  const taskText = robots.map((robot) => robot.task).join('\n');

  assert.match(taskText, /微震|岩爆|应力|矿脉|采空区|岩温/);
  assert.doesNotMatch(taskText, /瓦斯|顶板|气体泄漏/);
});

test('oil fracture robots use reservoir tasks instead of coal gas tasks', () => {
  const robots = generateMockRobots('fracture', 'oil');
  const taskText = robots.map((robot) => robot.task).join('\n');

  assert.match(taskText, /孔隙压力|储层|渗透率|含水率|地层/);
  assert.doesNotMatch(taskText, /瓦斯|顶板|气体泄漏/);
});

test('underground robots keep non-negative depth and underground-specific task vocabulary', () => {
  const robots = generateMockRobots('underground', 'underground');
  const taskText = robots.map((robot) => robot.task).join('\n');

  assert.ok(robots.every((robot) => robot.depth >= 0), 'underground depth should never be negative');
  assert.match(taskText, /暗流|水质|矿化度|瓶颈|水文|流量|地温/);
  assert.doesNotMatch(taskText, /瓦斯|顶板|采空区/);
});

test('pipeline robots use pipeline-specific tasks and spider model deployment', () => {
  const robots = generateMockRobots('pipeline', 'pipeline');
  const taskText = robots.map((robot) => robot.task).join('\n');

  assert.ok(robots.every((robot) => robot.model === 'spider'), 'pipeline robots should use the spider model fleet');
  assert.match(taskText, /壁厚|腐蚀|焊缝|泄漏|阀门|H₂S|流量计|沉降/);
  assert.doesNotMatch(taskText, /裂缝|岩爆|采空区|剂量率|暗流/);
});

test('nuclear robots use reactor-specific tasks and spider model deployment', () => {
  const robots = generateMockRobots('nuclear', 'nuclear');
  const taskText = robots.map((robot) => robot.task).join('\n');

  assert.ok(robots.every((robot) => robot.model === 'spider'), 'nuclear robots should use the radiation-hardened spider fleet');
  assert.match(taskText, /焊缝|剂量率|涡流|FAC|辐射热点|疲劳|安注管路|主泵密封/);
  assert.doesNotMatch(taskText, /裂缝|岩爆|瓦斯|暗流|蒸馏塔/);
});

test('refinery robots use refinery-specific tasks and snake model deployment', () => {
  const robots = generateMockRobots('refinery', 'refinery');
  const taskText = robots.map((robot) => robot.task).join('\n');

  assert.ok(robots.every((robot) => robot.model === 'snake'), 'refinery robots should use the snake fleet for narrow equipment passages');
  assert.match(taskText, /换热器|炉管|塔盘|结垢|焊缝裂纹|降液管|塔内件|法兰/);
  assert.doesNotMatch(taskText, /裂缝|岩爆|剂量率|暗流|采空区/);
});
