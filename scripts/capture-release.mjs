import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";
import { demoClock } from "../tests/release-demo.mjs";

const port = process.env.FAMILY_SINK_TEST_PORT ?? "4181";
const origin = `http://127.0.0.1:${port}`;
const output = "docs/assets/screenshots";
const frames = ".tools/release-gif-frames";
const desktop = { width: 1440, height: 960 };
const settings = { width: 980, height: 950 };
const server = spawn(process.execPath, ["tests/serve-panel.mjs"], {
  env: { ...process.env, FAMILY_SINK_TEST_PORT: port }, stdio: "inherit",
});
let browser;

async function openPanel(viewport, admin = false) {
  const page = await browser.newPage({ viewport, reducedMotion: "no-preference" });
  page.setDefaultTimeout(10_000);
  page.on("pageerror", (error) => console.error(error));
  await page.clock.setFixedTime(new Date(demoClock));
  await page.goto(`${origin}/?release-demo${admin ? "&admin" : ""}`);
  await page.getByRole("heading", { name: "Rowan", exact: true }).waitFor();
  await page.evaluate(() => document.fonts.ready);
  return page;
}

async function screenshot(name, viewport, configure, admin = false) {
  const page = await openPanel(viewport, admin);
  try {
    const area = await configure?.(page);
    await page.mouse.move(0, 0);
    await (area ?? page).screenshot({ path: `${output}/${name}.png`, animations: "disabled" });
  } finally {
    await page.close();
  }
}

async function showSettings(page) {
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("heading", { name: "Family members", exact: true }).waitFor();
}

async function showAwards(page) {
  await page.getByRole("button", { name: /alert/i }).click();
  await page.getByText("Wall of Fame", { exact: true }).waitFor();
}

async function startBrush(page, seconds) {
  await page.evaluate((duration) => window.updateReleaseBrush(duration), seconds);
  const badge = page.locator(".brushing-pill");
  await badge.getByText(/BRUSHING NOW!/).waitFor();
}

try {
  for (let attempt = 0; ; attempt++) {
    if (await fetch(origin).then((response) => response.ok, () => false)) break;
    if (attempt >= 45 || server.exitCode !== null) throw new Error("The local panel fixture did not start.");
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  await mkdir(output, { recursive: true });
  browser = await chromium.launch({ executablePath: process.env.FAMILY_SINK_CHROMIUM || undefined });

  await screenshot("desktop", desktop);
  await screenshot("mobile", { width: 390, height: 844 });
  await screenshot("tablet", { width: 1024, height: 900 });
  await screenshot("live-brushing", desktop, async (page) => {
    await startBrush(page, 96);
  });
  await screenshot("family-settings", settings, async (page) => {
    await showSettings(page);
    await page.getByRole("button", { name: "Add member", exact: true }).click();
    await page.getByLabel("Name", { exact: true }).fill("Sage");
    await page.getByLabel("Team", { exact: true }).fill("Team Kids");
    return page.locator(".settings-page");
  }, true);
  await screenshot("toothbrush-assignment", settings, async (page) => {
    await showSettings(page);
    await page.getByRole("button", { name: "Rowan", exact: true }).click();
    const mapping = page.locator("details").filter({ has: page.locator("summary", { hasText: "Manual sensor selection" }) });
    await mapping.locator("summary").click();
    await mapping.getByText("Automatic · sensor.demo_rowan_state").waitFor({ state: "attached" });
    return page.locator(".settings-page section");
  }, true);
  await screenshot("profile-appearance", settings, async (page) => {
    await showSettings(page);
    await page.getByRole("button", { name: "Casey", exact: true }).click();
    await page.getByRole("combobox", { name: /^Avatar/ }).selectOption("cat");
    return page.locator(".settings-page section");
  }, true);
  await screenshot("achievements", desktop, async (page) => {
    await showAwards(page);
    await page.locator(".profile-avatar.golden-glow").first().waitFor();
  });
  await screenshot("history", desktop, async (page) => {
    await page.getByRole("button", { name: /YESTERDAY/ }).click();
    await page.getByRole("button", { name: /YESTERDAY/, pressed: true }).waitFor();
    await page.locator(".profile-card").first().locator(".flip-card").first().click();
  });
  await screenshot("game-settings", settings, async (page) => {
    await showSettings(page);
    const game = page.locator("details").filter({ has: page.locator("summary", { hasText: "Game rules" }) });
    await game.locator("summary").click();
    await page.getByRole("button", { name: "Restore defaults", exact: true }).waitFor();
    return game;
  }, true);

  if (process.argv.includes("--frames")) {
    await mkdir(frames, { recursive: true });
    const page = await openPanel(desktop);
    try {
      await startBrush(page, 64);
      const card = page.locator(".profile-card").filter({ has: page.getByRole("heading", { name: "Avery", exact: true }) });
      const { x, y, width, height } = await card.boundingBox();
      const clip = { x: Math.floor(x - 10), y: Math.floor(y - 10), width: Math.ceil(width + 20), height: Math.ceil(height + 22) };
      for (let frame = 0; frame < 40; frame++) {
        if (frame % 4 === 0) {
          await page.evaluate((seconds) => window.updateReleaseBrush(seconds), 64 + frame * 2);
        }
        await page.screenshot({ path: `${frames}/${String(frame).padStart(2, "0")}.png`, clip });
      }
    } finally {
      await page.close();
    }
  }
  console.log(`Captured ten built-panel screenshots in ${output}.`);
} finally {
  if (browser) await browser.close();
  server.kill();
}
