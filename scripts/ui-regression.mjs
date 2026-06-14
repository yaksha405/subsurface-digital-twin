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

  await page.evaluate(() => {
    const store = window.__HIVE_STORE__;
    const state = store?.getState();
    if (!state) return;
    state.setDataSource('underground');
    state.setScenario('underground');
    state.setGasThreshold(5000);
  });
  await page.waitForTimeout(2200);

  const clickedCanvas = await clickIfExists(page, 'canvas');
  if (clickedCanvas) {
    await page.mouse.click(980, 300);
    await page.waitForTimeout(1200);
    const afterSceneClick = await textContent(page);
    assert(
      afterSceneClick.includes('Details') || afterSceneClick.includes('详情') || afterSceneClick.includes('Spatial Position'),
      '点击 3D 场景后右侧详情没有明显更新',
      failures,
    );
  } else {
    notes.push('未找到 canvas，跳过 3D 点击详情验证');
  }

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
