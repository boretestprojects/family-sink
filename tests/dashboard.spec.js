import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-02-04T21:00:00+01:00"));
  page.on("pageerror", (error) => console.error(error.stack));
});

test("desktop displays more than four profiles, a live brush and previous days", async ({ page, baseURL }) => {
  const errors = [];
  const remote = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => {
    if (!request.url().startsWith(baseURL)) remote.push(request.url());
  });
  await page.goto("/");
  await expect(page.locator("article.profile-card")).toHaveCount(6);
  await expect(page.getByRole("button", { name: "TODAY 2/4", exact: true })).toBeVisible();
  await expect(page.getByText("BRUSHING NOW! 95 s")).toBeVisible();
  await expect(page.getByText("65%")).toBeVisible();
  await expect(page.locator(".profile-card").nth(1).locator("img")).toHaveAttribute("src", /^data:image\/png;base64,/);
  await expect(page.getByRole("button", { name: "Settings" })).toHaveCount(0);
  const first = page.locator(".profile-card").nth(0);
  const second = page.locator(".profile-card").nth(1);
  expect((await first.boundingBox()).y).toBe((await second.boundingBox()).y);
  await first.getByRole("button", { name: "30 s" }).click();
  await expect(first.locator(".flip-inner")).toHaveClass(/flipped/);
  await page.getByRole("button", { name: "Earlier days" }).click();
  await expect(page.getByRole("button", { name: "Later days" })).toBeVisible();
  expect(errors).toEqual([]);
  expect(remote).toEqual([]);
});

test("mobile layout stays scrollable and switches among all three languages", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto("/");
  await expect(page.locator("article.profile-card")).toHaveCount(6);
  const first = page.locator(".profile-card").nth(0);
  const second = page.locator(".profile-card").nth(1);
  expect((await second.boundingBox()).y).toBeGreaterThan((await first.boundingBox()).y);
  const sizes = await page.locator("family-sink-panel").evaluate((panel) => ({
    width: panel.clientWidth, contentWidth: panel.scrollWidth,
    height: panel.clientHeight, contentHeight: panel.scrollHeight,
  }));
  expect(sizes.contentWidth).toBe(sizes.width);
  expect(sizes.contentHeight).toBeGreaterThan(sizes.height);
  await page.getByRole("button", { name: "БГ" }).click();
  await expect(page.getByRole("heading", { name: "СЕМЕЙНА МИВКА" })).toBeVisible();
  await page.getByRole("button", { name: "LT" }).click();
  await expect(page.getByRole("heading", { name: "ŠEIMOS KRIAUKLĖ" })).toBeVisible();
});

test("admin can manage profiles, preview import and download export", async ({ page }) => {
  await page.goto("/?admin");
  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Add member" }).click();
  await page.getByLabel("Name", { exact: true }).fill("Jamie");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("button", { name: "Jamie" })).toBeVisible();
  await page.getByText("History import and export", { exact: true }).click();
  await page.getByLabel("Choose a history file").setInputFiles({
    name: "legacy.txt", mimeType: "text/plain", buffer: Buffer.from("2026-02-04T08:00:00|legacy|120"),
  });
  await page.getByLabel("legacy").selectOption("rowan");
  await page.getByRole("button", { name: "Import", exact: true }).click();
  await expect(page.getByText(/Added 1/)).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download history" }).click();
  expect((await download).suggestedFilename()).toBe("family-sink-brush-log.txt");
  await page.getByRole("button", { name: "Back to the game" }).click();
  await expect(page.getByRole("heading", { name: "Jamie" })).toBeVisible();
});

test("tablet fits the Wall of Fame and the leaderboard in the panel", async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 });
  await page.goto("/");
  await page.getByRole("button", { name: /Alert/ }).click();
  await expect(page.getByText("Wall of Fame")).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "This month" })).toBeVisible();
  const layout = await page.locator(".summary-grid").evaluate((summary) => ({
    columns: getComputedStyle(summary).gridTemplateColumns.split(" ").length,
    insidePanel: summary.scrollWidth <= summary.clientWidth,
  }));
  expect(layout).toEqual({ columns: 2, insidePanel: true });
});

for (const motion of ["no-preference", "reduce"]) {
  test(`the badge and icon keep moving during sensor updates with motion preference ${motion}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: motion });
    if (motion === "reduce") await page.setViewportSize({ width: 320, height: 720 });
    await page.goto("/?ha-shell");
    const card = page.locator("ha-panel-custom family-sink-panel .profile-card").first();
    const badge = card.locator(".brushing-pill");
    const icon = badge.locator("svg");
    const ring = card.locator(".progress-ring-value");
    await expect(badge).toContainText("95 s");
    await expect(badge).toHaveCSS("font-size", "14px");
    await expect(badge).toHaveCSS("padding", "8px 16px");
    await expect(icon).toHaveAttribute("width", "20");
    await expect(badge).toHaveCSS("animation-duration", "1.4s");
    await expect(icon).toHaveCSS("animation-duration", "2s");
    await expect(ring).toHaveCSS("transition-property", "stroke-dashoffset");
    if (motion === "no-preference") await expect(ring).toHaveCSS("transition-duration", "0.35s");

    const measurements = await badge.evaluate(async (node) => {
      const card = node.closest(".profile-card");
      const icon = node.querySelector("svg");
      const keyframes = [...node.getRootNode().styleSheets]
        .flatMap((sheet) => [...sheet.cssRules])
        .filter((rule) => rule instanceof CSSKeyframesRule)
        .map((rule) => rule.name);
      const [pulse] = node.getAnimations();
      const [spin] = icon.getAnimations();
      await Promise.all([pulse.ready, spin.ready]);
      const [pulseStart, spinStart] = [pulse.startTime, spin.startTime];
      const updates = [[250, 96, 64], [550, 99, 63], [900, 100, 62], [1250, 120, 61]];
      const scales = [];
      const opacities = [];
      const seenDurations = new Set();
      let next = 0;
      let previousAngle;
      let sweep = 0;
      let discontinuity = null;
      const start = performance.now();

      while (performance.now() - start < 2240) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
        const update = updates[next];
        if (update && performance.now() - start >= update[0]) {
          window.updateDemoSensors(update[1], update[2]);
          next++;
        }
        const style = getComputedStyle(node);
        const iconMatrix = new DOMMatrixReadOnly(getComputedStyle(icon).transform);
        const angle = Math.atan2(iconMatrix.b, iconMatrix.a);
        if (previousAngle !== undefined) {
          sweep += Math.atan2(Math.sin(angle - previousAngle), Math.cos(angle - previousAngle));
        }
        previousAngle = angle;
        scales.push(new DOMMatrixReadOnly(style.transform).a);
        opacities.push(Number(style.opacity));
        seenDurations.add(node.querySelector(".brushing-seconds").textContent);
        const continuity = {
          badge: card.querySelector(".brushing-pill") === node,
          icon: node.querySelector("svg") === icon,
          pulse: node.getAnimations()[0] === pulse,
          spin: icon.getAnimations()[0] === spin,
          pulseDrift: pulse.startTime - pulseStart,
          spinDrift: spin.startTime - spinStart,
        };
        if (!continuity.badge || !continuity.icon || !continuity.pulse || !continuity.spin ||
            continuity.pulseDrift !== 0 || continuity.spinDrift !== 0) {
          discontinuity ??= continuity;
        }
      }

      return {
        keyframes, discontinuity, seenDurations: [...seenDurations], sweep,
        scaleRange: Math.max(...scales) - Math.min(...scales),
        opacityRange: Math.max(...opacities) - Math.min(...opacities),
      };
    });

    expect(measurements.keyframes).toEqual(expect.arrayContaining(["familySinkBadgePulse", "familySinkActivitySpin"]));
    expect(measurements.discontinuity).toBeNull();
    expect(measurements.seenDurations).toEqual(["95", "96", "99", "100", "120"]);
    expect(measurements.sweep).toBeGreaterThan(2 * Math.PI);
    expect(measurements.scaleRange).toBeGreaterThan(.025);
    expect(measurements.opacityRange).toBeGreaterThan(.07);
    await expect(card.getByText("61%")).toBeVisible();
    await expect(ring).toHaveAttribute("stroke-dashoffset", "0");
    const bounds = await badge.boundingBox();
    expect(bounds.y + bounds.height).toBeLessThan((await card.getByRole("heading").boundingBox()).y);
    if (motion === "reduce") {
      const goldenDuration = await card.locator(".golden-glow").evaluate((element) => parseFloat(getComputedStyle(element).animationDuration));
      expect(goldenDuration).toBeLessThan(.001);
    }
  });
}

test("local Manrope loads across all three alphabets and profile color sits under the card", async ({ page }) => {
  await page.goto("/");
  const cards = page.locator(".profile-card");
  const name = cards.first().getByRole("heading");
  await expect(name).toHaveCSS("font-family", /Family Sink Manrope/);
  await expect(name).toHaveCSS("font-size", "32px");
  const fonts = await page.evaluate(async () => {
    const faces = await document.fonts.load('800 32px "Family Sink Manrope"', "Rowan Šeima Семейна");
    return faces.filter((face) => face.status === "loaded").length;
  });
  expect(fonts).toBeGreaterThanOrEqual(3);
  const avatar = cards.nth(1).locator(".profile-avatar");
  await expect(avatar).toHaveCSS("width", "82px");
  await expect(avatar).toHaveCSS("border-color", "rgb(255, 255, 255)");
  const shadows = await cards.evaluateAll((items) => items.slice(0, 2).map((item) => getComputedStyle(item).boxShadow));
  expect(shadows[0]).not.toBe(shadows[1]);
});

test("the gradient fills an empty dashboard with or without a parent height", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?empty");
  const panel = page.locator("family-sink-panel");
  await expect(panel.locator("main")).toBeVisible();
  await page.evaluate(() => { document.body.style.height = "auto"; });
  await expect(panel).toHaveCSS("height", "844px");
  await expect(panel).toHaveCSS("background-image", /radial-gradient/);
  await page.evaluate(() => { document.body.style.height = "496px"; });
  await expect(panel).toHaveCSS("height", "496px");
});
