import { expect, test } from "@playwright/test";

const routes = [
  ["/", "Take control of"],
  ["/404", "Page not found"],
  ["/about", "Work stays simple"],
  ["/blog", "Our blogs"],
  ["/blog/building-clarity-through-better-saas-dashboard-design", "Building clarity through better SaaS dashboard design"],
  ["/blog/designing-saas-onboarding-that-users-actually-finish", "Designing SaaS onboarding that users actually finish"],
  ["/blog/designing-saas-products-for-long-term-scalability", "Designing SaaS products for long-term scalability"],
  ["/blog/how-smart-automation-reduces-friction-in-saas-products", "How smart automation reduces friction in SaaS products"],
  ["/blog/how-storytelling-builds-trust-in-saas-brands", "How storytelling builds trust in SaaS brands"],
  ["/blog/turning-complex-workflows-into-simple-user-experiences", "Turning complex workflows into simple user experiences"],
  ["/blog/using-microinteractions-to-improve-saas-usability", "Using microinteractions to improve SaaS usability"],
  ["/changelog", "Changelog"],
  ["/contact", "Let’s discuss how we can help"],
  ["/faqs", "Answers to common questions"],
  ["/legal-pages/privacy-policy", "Privacy Policy"],
  ["/request-demo", "Request a demo"],
  ["/waitlist", "Join the AI workflow automation waitlist"],
] as const;

for (const [route, expectedText] of routes) {
  test(`${route} renders without runtime failures`, async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(error.message));

    const response = await page.goto(route, { waitUntil: "networkidle" });
    expect(response?.status()).toBe(route === "/404" ? 404 : 200);
    await expect(page.getByText(expectedText, { exact: false }).first()).toBeVisible();
    await expect(page.locator("[data-site-header]")).toBeVisible();
    await expect(page.locator("img[src^='http']")).toHaveCount(0);
    expect(errors).toEqual(
      route === "/404"
        ? ["Failed to load resource: the server responded with a status of 404 (Not Found)"]
        : [],
    );
  });
}

test("unknown routes retain a real 404 response", async ({ page }) => {
  const response = await page.goto("/this-route-does-not-exist");
  expect(response?.status()).toBe(404);
});

test("mobile navigation opens, closes, and remains keyboard accessible", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const toggle = page.locator("[data-menu-toggle]");
  await expect(toggle).toBeVisible();
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByRole("navigation", { name: "Mobile navigation" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
});

test("desktop navigation matches the exported 1440px geometry", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  const [header, logo, nav, home, cta] = await Promise.all([
    page.locator("[data-site-header]").boundingBox(),
    page.locator(".brand img").boundingBox(),
    page.getByRole("navigation", { name: "Primary navigation" }).boundingBox(),
    page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "Home" }).boundingBox(),
    page.locator(".header-cta").boundingBox(),
  ]);

  expect(header).toEqual(expect.objectContaining({ x: 0, y: 0, width: 1440 }));
  expect(header?.height).toBeCloseTo(99.203, 1);
  expect(logo?.x).toBeCloseTo(130, 1);
  expect(logo?.y).toBeCloseTo(34.602, 1);
  expect(logo?.width).toBeCloseTo(168, 1);
  expect(nav?.x).toBeCloseTo(410, 1);
  expect(nav?.width).toBeCloseTo(620, 1);
  expect(home?.x).toBeCloseTo(495.56, 0);
  expect(home?.height).toBeCloseTo(27.203, 1);
  expect(cta?.x).toBeCloseTo(1149.656, 0);
  expect(cta?.width).toBeCloseTo(160.344, 1);
  expect(cta?.height).toBeCloseTo(39.203, 1);
});

test("tablet navigation preserves its distinct CTA and menu-button variant", async ({ page }) => {
  await page.setViewportSize({ width: 810, height: 900 });
  await page.goto("/");

  const [header, logo, cta, toggle] = await Promise.all([
    page.locator("[data-site-header]").boundingBox(),
    page.locator(".brand img").boundingBox(),
    page.locator(".header-cta").boundingBox(),
    page.locator("[data-menu-toggle]").boundingBox(),
  ]);

  expect(header?.height).toBeCloseTo(79.203, 1);
  expect(logo).toEqual(expect.objectContaining({ x: 30, width: 168, height: 30 }));
  expect(logo?.y).toBeCloseTo(24.602, 1);
  expect(cta?.x).toBeCloseTo(560.656, 0);
  expect(cta?.width).toBeCloseTo(160.344, 1);
  expect(toggle?.x).toBeCloseTo(741, 1);
  expect(toggle?.y).toBeCloseTo(20.102, 1);
  expect(toggle?.width).toBeCloseTo(39, 1);
  await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeHidden();
});

test("phone navigation matches the 52px header and 222px open panel", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/about");

  const [header, logo, toggle] = await Promise.all([
    page.locator("[data-site-header]").boundingBox(),
    page.locator(".brand img").boundingBox(),
    page.locator("[data-menu-toggle]").boundingBox(),
  ]);
  expect(header?.height).toBeCloseTo(52, 1);
  expect(logo).toEqual(expect.objectContaining({ x: 20, y: 13, height: 26 }));
  expect(logo?.width).toBeCloseTo(145.594, 1);
  expect(toggle).toEqual(expect.objectContaining({ x: 338, y: 10, width: 32, height: 32 }));
  await expect(page.locator(".header-cta")).toBeHidden();

  await page.locator("[data-menu-toggle]").click();
  await page.waitForTimeout(500);
  const panel = page.getByRole("navigation", { name: "Mobile navigation" });
  const active = panel.getByRole("link", { name: "About" });
  const [panelBox, activeBox] = await Promise.all([panel.boundingBox(), active.boundingBox()]);
  expect(panelBox).toEqual(expect.objectContaining({ x: 0, y: 52, width: 390 }));
  expect(panelBox?.height).toBeCloseTo(222.016, 1);
  expect(activeBox).toEqual(expect.objectContaining({ x: 16, width: 358 }));
  expect(activeBox?.height).toBeCloseTo(31.203, 1);
  await expect(active).toHaveAttribute("aria-current", "page");
  await expect(page.locator("[data-menu-scrim]")).toHaveCSS("backdrop-filter", "blur(5px)");
});

test("tablet open menu uses the exported 12px inset and 16px row gaps", async ({ page }) => {
  await page.setViewportSize({ width: 810, height: 900 });
  await page.goto("/");
  await page.locator("[data-menu-toggle]").click();
  await page.waitForTimeout(500);

  const panel = page.getByRole("navigation", { name: "Mobile navigation" });
  const first = panel.getByRole("link", { name: "Home" });
  const second = panel.getByRole("link", { name: "About" });
  const [panelBox, firstBox, secondBox] = await Promise.all([
    panel.boundingBox(),
    first.boundingBox(),
    second.boundingBox(),
  ]);
  expect(panelBox).toEqual(expect.objectContaining({ x: 0, y: 79, width: 810 }));
  expect(panelBox?.height).toBeCloseTo(244.016, 1);
  expect(firstBox).toEqual(expect.objectContaining({ x: 12, y: 91, width: 786 }));
  expect(firstBox?.height).toBeCloseTo(31.203, 1);
  expect((secondBox?.y ?? 0) - (firstBox?.y ?? 0)).toBeCloseTo(47.203, 1);
});

test("navigation switches variants only at the exported 810px and 1200px boundaries", async ({ page }) => {
  const variants = [
    { width: 809, headerHeight: 52, menuSize: 32, desktop: false, cta: false },
    { width: 810, headerHeight: 79.203, menuSize: 39, desktop: false, cta: true },
    { width: 1199, headerHeight: 79.203, menuSize: 39, desktop: false, cta: true },
    { width: 1200, headerHeight: 99.203, menuSize: 0, desktop: true, cta: true },
  ] as const;

  await page.goto("/");
  for (const variant of variants) {
    await page.setViewportSize({ width: variant.width, height: 900 });
    const header = await page.locator("[data-site-header]").boundingBox();
    expect(header?.height).toBeCloseTo(variant.headerHeight, 1);
    if (variant.desktop) {
      await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeVisible();
      await expect(page.locator("[data-menu-toggle]")).toBeHidden();
    } else {
      await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeHidden();
      const menu = await page.locator("[data-menu-toggle]").boundingBox();
      expect(menu?.width).toBeCloseTo(variant.menuSize, 1);
      expect(menu?.height).toBeCloseTo(variant.menuSize, 1);
    }
    if (variant.cta) await expect(page.locator(".header-cta")).toBeVisible();
    else await expect(page.locator(".header-cta")).toBeHidden();
  }
});

test("open navigation locks scrolling and scrim close restores the trigger", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/contact");
  const toggle = page.locator("[data-menu-toggle]");
  await toggle.click();
  await expect(page.locator("body")).toHaveClass(/menu-open/);
  await expect(page.locator("[data-mobile-nav]")).not.toHaveAttribute("inert", "");
  await page.locator("[data-menu-scrim]").click({ position: { x: 5, y: 500 } });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("body")).not.toHaveClass(/menu-open/);
  await expect(page.locator("[data-mobile-nav]")).toHaveAttribute("inert", "");
  await expect(toggle).toBeFocused();
});

test("FAQ accordion exposes and collapses answers", async ({ page }) => {
  await page.goto("/faqs");
  const button = page.getByRole("button", { name: "Is Worklane suitable for remote teams?" });
  await button.click();
  await expect(button).toHaveAttribute("aria-expanded", "true");
  const panel = page.locator(`#${await button.getAttribute("aria-controls")}`);
  await expect(panel).toBeVisible();
  await button.click();
  await expect(panel).toBeHidden();
});

test("homepage automation and pricing controls change visible state", async ({ page }) => {
  await page.goto("/");
  const followUps = page.getByRole("tab", { name: "Follow-ups" });
  await followUps.click();
  await expect(followUps).toHaveAttribute("aria-selected", "true");
  await expect(page.locator('[data-tab-panel="follow-ups"]')).toBeVisible();

  const yearly = page.getByRole("tab", { name: /Yearly/ });
  await yearly.click();
  await expect(yearly).toHaveAttribute("aria-selected", "true");
});

test("forms validate locally without transmitting data", async ({ page }) => {
  const posts: string[] = [];
  page.on("request", (request) => {
    if (request.method() === "POST") posts.push(request.url());
  });
  await page.goto("/waitlist");
  const form = page.locator("form[data-local-form]").first();
  await form.getByLabel(/Email/i).fill("qa@example.com");
  await form.getByRole("button", { name: /Join/i }).click();
  await expect(form.locator(".form-status")).toContainText("Thanks");
  expect(posts).toEqual([]);
});
