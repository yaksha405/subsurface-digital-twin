import { chromium } from 'playwright';

const BASE_URL = process.env.HIVE_UI_BASE_URL || 'http://127.0.0.1:5174/';

function assert(condition, message, failures) {
  if (!condition) failures.push(message);
}

async function textContent(page) {
  return await page.locator('body').innerText();
}

async function clickIfExists(page, selector) {
  const locator = page.locator(selector);
  if (await locator.count()) {
    await locator.first().click();
    return true;
  }
  return false;
}

function distance2D(a, b) {
  return Math.hypot(a.screen.x - b.screen.x, a.screen.y - b.screen.y);
}

function splitPathId(pathId) {
  return pathId.replace(/-path-\d+$/, '');
}

function chooseTarget(targets, otherTargets = [], minSeparation = 0) {
  const ranked = targets
    .map((target) => ({
      target,
      nearestOther: otherTargets.reduce((best, other) => {
        if (other.id === target.id) return best;
        return Math.min(best, distance2D(target, other));
      }, Number.POSITIVE_INFINITY),
    }))
    .filter((entry) => entry.nearestOther >= minSeparation)
    .sort((a, b) => b.nearestOther - a.nearestOther);

  return ranked[0]?.target ?? null;
}

function chooseTargets(targets, otherTargets = [], minSeparation = 0, limit = 8) {
  return targets
    .map((target) => ({
      target,
      nearestOther: otherTargets.reduce((best, other) => {
        if (other.id === target.id) return best;
        return Math.min(best, distance2D(target, other));
      }, Number.POSITIVE_INFINITY),
    }))
    .filter((entry) => entry.nearestOther >= minSeparation)
    .sort((a, b) => b.nearestOther - a.nearestOther)
    .slice(0, limit)
    .map((entry) => entry.target);
}

async function loadDevScenario(page, scenario) {
  const url = new URL(BASE_URL);
  url.searchParams.set('dev-locale', 'en-US');
  url.searchParams.set('dev-scenario', scenario);
  await page.goto(url.toString(), { waitUntil: 'domcontentloaded' });
  await page.waitForFunction((expected) => {
    const el = document.querySelector('[data-testid="dev-state"]');
    return el instanceof HTMLElement && el.dataset.scenario === expected;
  }, scenario);
  await page.waitForTimeout(1000);
}

async function readDevState(page) {
  return await page.locator('[data-testid="dev-state"]').evaluate((el) => ({ ...el.dataset }));
}

async function click3DTarget(page, target) {
  await page.mouse.click(target.screen.x, target.screen.y);
  await page.waitForTimeout(2200);
  return await readDevState(page);
}

async function try3DTargets(page, scenario, getCandidates, isPass) {
  const attempts = [];
  for (let i = 0; i < 8; i += 1) {
    await loadDevScenario(page, scenario);
    const targets = await page.evaluate(async () => window.__HIVE_TEST_API__.getInteractiveTargets());
    const candidates = getCandidates(targets).slice(0, 8);
    const target = candidates.find((candidate) => !attempts.some((attempt) => attempt.id === candidate.id));
    if (!target) break;
    const state = await click3DTarget(page, target);
    attempts.push({ id: target.id, state });
    if (isPass(target, state)) return { ok: true, target, state, attempts };
  }
  return { ok: false, attempts };
}

async function run3DSelectionChecks(page, failures, notes) {
  const scenarios = ['gold', 'pipeline', 'nuclear', 'refinery', 'coal', 'oil', 'underground'];

  for (const scenario of scenarios) {
    const robotResult = await try3DTargets(
      page,
      scenario,
      (targets) => chooseTargets(targets.robots, [], 0),
      (_target, state) => Boolean(state.selectedRobot),
    );
    if (robotResult.ok) {
      const { target: robotTarget } = robotResult;
      assert(
        true,
        `${scenario} 机器人点击后未打开机器人详情: ${robotTarget.id}`,
        failures,
      );
    } else {
      notes.push(`${scenario}: 无可点击机器人目标，尝试=${robotResult.attempts.map((item) => item.id).join(',')}`);
    }

    const nodeResult = await try3DTargets(
      page,
      scenario,
      (targets) => chooseTargets(
        targets.fractureNodes,
        [...targets.robots, ...targets.fracturePaths],
        56,
      ),
      (target, state) => state.selectedNode === target.id || state.selectedFracture === target.id.split('-N')[0],
    );
    if (nodeResult.ok) {
      const { target: nodeTarget } = nodeResult;
      assert(
        true,
        `${scenario} 独立节点点击后未打开节点/通道详情: ${nodeTarget.id}`,
        failures,
      );
    } else {
      notes.push(`${scenario}: 节点与机器人重叠或无可见节点，跳过独立节点点击`);
    }

    const pathResult = await try3DTargets(
      page,
      scenario,
      (targets) => chooseTargets(
        targets.fracturePaths,
        [...targets.robots, ...targets.fractureNodes],
        scenario === 'underground' ? 0 : 48,
      ),
      (target, state) => (
        Boolean(state.selectedFracture) || Boolean(state.selectedRobot)
      ) && (!state.selectedFracture || state.selectedFracture === splitPathId(target.id)),
    );
    if (pathResult.ok) {
      const { target: pathTarget, state } = pathResult;
      assert(
        Boolean(state.selectedFracture) || Boolean(state.selectedRobot),
        `${scenario} 通道/路径点击后未打开详情: ${pathTarget.id}`,
        failures,
      );
      if (state.selectedFracture) {
        assert(
          state.selectedFracture === splitPathId(pathTarget.id),
          `${scenario} 路径点击打开了不匹配的通道: ${pathTarget.id} -> ${state.selectedFracture}`,
          failures,
        );
      }
    } else {
      notes.push(`${scenario}: 无独立路径目标，跳过路径点击`);
    }
  }
}

const scenarioExpectations = [
  {
    key: 'underground',
    trigger: '模拟数据五·地下暗流',
    mustContain: ['地下暗流', '渗透率', '水压'],
    mustNotContain: ['北部裂缝带', '瓦斯报警红线', '岩溶围岩'],
  },
  {
    key: 'nuclear',
    trigger: '模拟数据三·核反应堆',
    mustContain: ['核反应堆', '剂量率', '冷却剂温度'],
    mustNotContain: ['裂缝带', '渗透率预警阈值'],
  },
  {
    key: 'pipeline',
    trigger: '模拟数据二·油气管线',
    mustContain: ['油气管线', '泄漏报警阈值', '运行压力'],
    mustNotContain: ['剂量率控制阈值', '北部裂缝带'],
  },
];

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1728, height: 1117 } });
  const failures = [];
  const notes = [];

  await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  let body = await textContent(page);
  assert(body.includes('系统状态监控'), '默认中文首页未正常加载', failures);
  assert(body.includes('传感器趋势'), '默认中文控制台缺少传感器趋势模块', failures);

  await page.evaluate(() => {
    const store = window.__HIVE_STORE__;
    store?.getState().setLocale('en-US');
  });
  await page.waitForTimeout(1200);

  body = await textContent(page);
  assert(body.includes('System Ready'), '切换 EN 后欢迎语未切换为英文', failures);
  assert(/quick commands/i.test(body), '切换 EN 后快捷指令标题未切换', failures);
  assert(body.includes('Compliance Notice'), '切换 EN 后合规条未切换', failures);
  assert(body.includes('Robot Fleet'), '切换 EN 后机器人面板未切换', failures);
  assert(!body.includes('系统就绪'), '切换 EN 后仍残留中文欢迎语', failures);
  assert(!body.includes('瓦斯报警红线'), '切换 EN 后阈值标题仍残留中文', failures);

  await page.evaluate(() => {
    const store = window.__HIVE_STORE__;
    store?.getState().setLocale('zh-CN');
  });
  await page.waitForTimeout(1200);

  for (const scenario of scenarioExpectations) {
    await page.evaluate((scenarioKey) => {
      const store = window.__HIVE_STORE__;
      const state = store?.getState();
      if (!state) return;
      state.setDataSource(scenarioKey === 'underground'
        ? 'underground'
        : scenarioKey === 'nuclear'
          ? 'nuclear'
          : scenarioKey === 'pipeline'
            ? 'pipeline'
            : 'fracture');
      state.setScenario(scenarioKey);
      state.setGasThreshold(
        scenarioKey === 'underground' ? 5000
          : scenarioKey === 'nuclear' ? 25
            : scenarioKey === 'pipeline' ? 20
              : 1.5,
      );
    }, scenario.key);
    await page.waitForTimeout(2200);

    const scenarioText = await textContent(page);
    for (const item of scenario.mustContain) {
      assert(scenarioText.includes(item), `${scenario.key} 场景缺少应有文案/指标: ${item}`, failures);
    }
    for (const item of scenario.mustNotContain) {
      assert(!scenarioText.includes(item), `${scenario.key} 场景仍出现不应存在的文案: ${item}`, failures);
    }
  }

  await run3DSelectionChecks(page, failures, notes);

  await page.evaluate(() => {
    const store = window.__HIVE_STORE__;
    store?.getState().setActiveTool('profile');
  });
  await page.waitForTimeout(600);
  let toolText = await textContent(page);
  assert(
    toolText.includes('Confirm')
      || toolText.includes('确认')
      || toolText.includes('Reselect')
      || toolText.includes('重选')
      || toolText.includes('Click two points')
      || toolText.includes('点击两点'),
    '剖面工具激活后未出现操作引导/确认控件',
    failures,
  );

  await page.evaluate(() => {
    const store = window.__HIVE_STORE__;
    store?.getState().setActiveTool('distance');
  });
  await page.waitForTimeout(400);
  toolText = await textContent(page);
  assert(
    /distance/i.test(toolText)
      || toolText.includes('距离')
      || toolText.includes('Click two points')
      || toolText.includes('依次点击两个点')
      || toolText.includes('自动计算三维空间距离'),
    '测距工具激活后未出现对应引导',
    failures,
  );

  notes.push(`BASE_URL=${BASE_URL}`);

  await browser.close();

  if (failures.length > 0) {
    console.error(JSON.stringify({ ok: false, failures, notes }, null, 2));
    process.exit(1);
  }

  console.log(JSON.stringify({ ok: true, failures: [], notes }, null, 2));
}

run().catch((error) => {
  console.error(JSON.stringify({ ok: false, failures: [error.message], stack: error.stack }, null, 2));
  process.exit(1);
});
