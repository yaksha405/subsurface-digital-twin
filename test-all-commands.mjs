import { chromium } from 'playwright';

const SITE = 'https://robot-azure-nu.vercel.app';
const SCREENSHOT_DIR = '/Volumes/HD/robot/test-screenshots';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

// Collect console errors
const consoleErrors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});

console.log('=== 1. 打开页面 ===');
await page.goto(SITE, { waitUntil: 'networkidle', timeout: 30000 });
await page.waitForTimeout(3000);
await page.screenshot({ path: `${SCREENSHOT_DIR}/01-initial.png` });
console.log('截图: 01-initial.png');

// Helper: wait and screenshot
async function snap(name, wait = 3000) {
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/${name}.png` });
  console.log(`截图: ${name}.png`);
}

console.log('\n=== 2. 检查是否有"+N台未显示" ===');
const bodyText = await page.textContent('body');
const hasHiddenRobots = bodyText?.includes('未显示');
console.log(`结果: ${hasHiddenRobots ? '❌ 仍有"+N台未显示"' : '✅ 无"+N台未显示"'}`);

console.log('\n=== 3. 测试快捷指令 ===');
const quickCommands = [
  '裂缝分布概览',
  '瓦斯浓度分析',
  '应力场分析',
  '找出最危险的点',
  '渗透率评估',
  '突水预警',
  '温度场分析',
];

for (let i = 0; i < quickCommands.length; i++) {
  const cmd = quickCommands[i];
  console.log(`\n--- 快捷指令 ${i + 1}: ${cmd} ---`);

  // Find the quick command button by text (they're badges, not buttons)
  const btn = page.locator(`text="${cmd}"`).first();
  const exists = await btn.count();
  if (exists === 0) {
    console.log(`❌ 找不到按钮: ${cmd}`);
    continue;
  }

  await btn.click();
  console.log(`✅ 已点击: ${cmd}`);

  // Wait for AI response + scene action
  await snap(`0${i + 3}-${cmd.replace(/\s/g, '')}`, 5000);

  // Check for AI response and scene actions
  await page.waitForTimeout(3000);

  // Check store state directly via window (if available) or check for UI elements
  const stateCheck = await page.evaluate(() => {
    const body = document.body.innerText;
    const hasAIContent = body.includes('分析') || body.includes('概览') || body.includes('评估') || body.includes('预警') || body.includes('风险');
    const hasClearMarkerBtn = body.includes('清除标记');
    const hasHighlightBtn = body.includes('取消高亮');
    return { hasAIContent, hasClearMarkerBtn, hasHighlightBtn };
  });
  console.log(`  清除AI标记按钮: ${stateCheck.hasClearMarkerBtn ? '✅ 有标记' : '(无标记)'}`);
  console.log(`  取消高亮按钮: ${stateCheck.hasHighlightBtn ? '✅ 有高亮' : '(无高亮)'}`);
  console.log(`  AI 回复内容: ${stateCheck.hasAIContent ? '✅ 有分析内容' : '❌ 无内容'}`);

  // Reset scene
  const resetBtn = page.locator('text="全景"').first();
  const resetExists = await resetBtn.count();
  if (resetExists) {
    await resetBtn.click();
    console.log(`  ✅ 已重置场景`);
    await page.waitForTimeout(2000);
  }
}

console.log('\n=== 10. 测试机器人集群 ===');
// Reset first to ensure clean state
const preReset = page.locator('text="全景"').first();
if (await preReset.count()) { await preReset.click(); await page.waitForTimeout(2000); }

// Click first robot in fleet list
const robotCard = page.locator('text=R-0').first();
const robotExists = await robotCard.count();
if (robotExists > 0) {
  await robotCard.click();
  console.log('✅ 点击了机器人 R-0xx');
  await snap('10-robot-focus', 4000);

  // Check for robot detail dialog or focused robot indicator
  const robotState = await page.evaluate(() => {
    const body = document.body.innerText;
    return {
      hasDetail: body.includes('机器人详情') || body.includes('设备信息') || body.includes('R-0'),
      hasHighlight: body.includes('取消高亮'),
      hasClearMarker: body.includes('清除标记'),
    };
  });
  console.log(`  取消高亮按钮: ${robotState.hasHighlight ? '❌ 不应出现' : '✅ 未出现'}`);
  console.log(`  机器人详情/信息: ${robotState.hasDetail ? '✅ 出现' : '(面板内显示)'}`);
} else {
  console.log('❌ 找不到机器人列表');
}

console.log('\n=== 11. 测试传感器分区域 ===');
// Find and click "分区域" button
const regionalBtn = page.locator('button:has-text("分区域")').first();
const regionalExists = await regionalBtn.count();
if (regionalExists > 0) {
  await regionalBtn.click();
  await page.waitForTimeout(1000);
  console.log('✅ 切换到分区域视图');

  // Click first region
  const regionItem = page.locator('text=北部裂缝带').first();
  const regionExists = await regionItem.count();
  if (regionExists > 0) {
    await regionItem.click();
    console.log('✅ 点击了"北部裂缝带"');
    await snap('11-sensor-region', 4000);
  }
} else {
  console.log('❌ 找不到"分区域"按钮');
}

console.log('\n=== 12. 测试全景重置 ===');
const resetBtn2 = page.locator('text="全景"').first();
const resetExists2 = await resetBtn2.count();
if (resetExists2 > 0) {
  await resetBtn2.click();
  console.log('✅ 点击全景重置');
  await snap('12-reset', 3000);
}

console.log('\n=== 测试完成 ===');
console.log(`总控制台错误: ${consoleErrors.length}`);
if (consoleErrors.length > 0) {
  console.log('前5条:', consoleErrors.slice(0, 5).join('\n'));
}

await browser.close();
console.log('浏览器已关闭');
