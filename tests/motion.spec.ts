import { expect, test } from "@playwright/test";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const results: Array<{ name: string; status: string; durationMs: number }> = [];

const explicitRoutes = [
  "src/pages/index.astro",
  "src/pages/404.astro",
  "src/pages/about.astro",
  "src/pages/blog/index.astro",
  "src/pages/blog/building-clarity-through-better-saas-dashboard-design.astro",
  "src/pages/blog/designing-saas-onboarding-that-users-actually-finish.astro",
  "src/pages/blog/designing-saas-products-for-long-term-scalability.astro",
  "src/pages/blog/how-smart-automation-reduces-friction-in-saas-products.astro",
  "src/pages/blog/how-storytelling-builds-trust-in-saas-brands.astro",
  "src/pages/blog/turning-complex-workflows-into-simple-user-experiences.astro",
  "src/pages/blog/using-microinteractions-to-improve-saas-usability.astro",
  "src/pages/changelog.astro",
  "src/pages/contact.astro",
  "src/pages/faqs.astro",
  "src/pages/legal-pages/privacy-policy.astro",
  "src/pages/request-demo.astro",
  "src/pages/waitlist.astro",
];

test.describe.serial("source-matched motion contracts", () => {
  test.afterEach(async ({}, testInfo) => {
    results.push({
      name: testInfo.title,
      status: testInfo.status ?? "unknown",
      durationMs: testInfo.duration,
    });
  });

  test.afterAll(() => {
    const evidenceDirectory = resolve(projectRoot, ".evidence");
    mkdirSync(evidenceDirectory, { recursive: true });
    writeFileSync(
      resolve(evidenceDirectory, "motion-report.json"),
      `${JSON.stringify({ generatedAt: new Date().toISOString(), tests: results }, null, 2)}\n`,
    );
  });

  test("all captured URLs have explicit Astro page entries", async () => {
    for (const route of explicitRoutes) {
      expect(existsSync(resolve(projectRoot, route)), route).toBe(true);
    }
    expect(existsSync(resolve(projectRoot, "src/pages/blog/[slug].astro"))).toBe(false);
  });

  test("hero runs the exported staged entrance and settles", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const lateDashboard = page.locator('[data-hero-reveal][data-delay="850"]');
    await expect(lateDashboard).toHaveCount(1);
    await page.waitForTimeout(120);
    const earlyOpacity = Number(await lateDashboard.evaluate((element) => getComputedStyle(element).opacity));
    expect(earlyOpacity).toBeLessThan(0.35);
    await page.waitForTimeout(1450);
    const settledOpacity = Number(await lateDashboard.evaluate((element) => getComputedStyle(element).opacity));
    expect(settledOpacity).toBeGreaterThan(0.75);
  });

  test("shared buttons swap both label and icon layers on hover", async ({ page }) => {
    await page.goto("/");
    const button = page.locator("[data-motion-button]").first();
    const label = button.locator(".button__label-track");
    const icon = button.locator(".button__icon-track");
    const before = await Promise.all([
      label.evaluate((element) => getComputedStyle(element).transform),
      icon.evaluate((element) => getComputedStyle(element).transform),
    ]);
    await button.hover();
    await page.waitForTimeout(400);
    const after = await Promise.all([
      label.evaluate((element) => getComputedStyle(element).transform),
      icon.evaluate((element) => getComputedStyle(element).transform),
    ]);
    expect(after[0]).not.toBe(before[0]);
    expect(after[1]).not.toBe(before[1]);
  });

  test("navigation pills, header CTA, and footer social items expose hover states", async ({ page }) => {
    await page.goto("/");
    const navLink = page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "About" });
    const navBefore = await navLink.evaluate((element) => getComputedStyle(element).backgroundColor);
    await navLink.hover();
    await page.waitForTimeout(400);
    const navAfter = await navLink.evaluate((element) => getComputedStyle(element).backgroundColor);
    expect(navAfter).not.toBe(navBefore);

    const headerCta = page.locator(".header-cta");
    const headerTrack = headerCta.locator(".header-cta__track");
    const headerBefore = await headerTrack.evaluate((element) => getComputedStyle(element).transform);
    await headerCta.hover();
    await page.waitForTimeout(400);
    const headerAfter = await headerTrack.evaluate((element) => getComputedStyle(element).transform);
    expect(headerAfter).not.toBe(headerBefore);

    const social = page.locator(".footer-bottom nav a").first();
    const socialIcon = social.locator("span").first();
    const socialBefore = await socialIcon.evaluate((element) => getComputedStyle(element).transform);
    await social.hover();
    await page.waitForTimeout(400);
    const socialAfter = await socialIcon.evaluate((element) => getComputedStyle(element).transform);
    expect(socialAfter).not.toBe(socialBefore);
  });

  test("navbar motion retains the exported 450ms and 350ms tracks", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    const navLink = page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "About" });
    const cta = page.locator(".header-cta");
    const ctaTrack = cta.locator(".header-cta__track");

    expect(await navLink.evaluate((element) => getComputedStyle(element).transitionDuration)).toBe("0.45s, 0.45s");
    expect(await ctaTrack.evaluate((element) => getComputedStyle(element).transitionDuration)).toBe("0.35s");
    await navLink.hover();
    await page.waitForTimeout(500);
    await expect(navLink).toHaveCSS("background-color", "rgb(248, 249, 250)");

    await cta.hover();
    await page.waitForTimeout(400);
    const transform = await ctaTrack.evaluate((element) => getComputedStyle(element).transform);
    const translateY = Number(transform.match(/^matrix\([^,]+, [^,]+, [^,]+, [^,]+, [^,]+, ([^)]+)\)$/)?.[1]);
    expect(translateY).toBeCloseTo(-49.203, 0);
  });

  test("tablet and phone headers reproduce the exported scroll-direction spring", async ({ page }) => {
    const compactVariants = [
      { width: 390, hiddenY: -72 },
      { width: 810, hiddenY: -80 },
    ] as const;

    for (const variant of compactVariants) {
      await page.setViewportSize({ width: variant.width, height: 844 });
      await page.goto("/about");
      const surface = page.locator(".site-header__surface");
      await page.evaluate(() => window.scrollTo(0, 600));
      await page.waitForTimeout(700);
      expect((await surface.boundingBox())?.y).toBeCloseTo(variant.hiddenY, 0);
      await expect(page.locator("[data-site-header]")).toHaveAttribute("data-scroll-hidden", "true");

      await page.evaluate(() => window.scrollTo(0, 350));
      await page.waitForTimeout(700);
      expect((await surface.boundingBox())?.y).toBeCloseTo(0, 0);
      await expect(page.locator("[data-site-header]")).toHaveAttribute("data-scroll-hidden", "false");
    }

    await page.setViewportSize({ width: 1200, height: 844 });
    await page.goto("/about");
    await page.evaluate(() => window.scrollTo(0, 600));
    await page.waitForTimeout(300);
    expect((await page.locator(".site-header__surface").boundingBox())?.y).toBeCloseTo(-600, 0);
    await expect(page.locator("[data-site-header]")).not.toHaveAttribute("data-scroll-hidden", "true");
  });

  test("below-fold reveals start hidden and animate visible when scrolled", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    const belowFoldReveals = await page.locator("main [data-reveal]").evaluateAll((elements) =>
      elements
        .map((element) => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return {
            top: rect.top,
            opacity: Number(style.opacity),
            transform: style.transform,
          };
        })
        .filter(({ top }) => top >= window.innerHeight),
    );
    expect(belowFoldReveals.length).toBeGreaterThan(0);
    expect(belowFoldReveals.every(({ opacity, transform }) => opacity < 0.35 && transform !== "none")).toBe(true);

    const target = page.locator("#features[data-reveal]");
    await target.evaluate((element) => element.scrollIntoView({ block: "center", behavior: "instant" }));
    await page.waitForFunction(() => {
      const element = document.querySelector<HTMLElement>("#features[data-reveal]");
      if (!element) return false;
      const style = getComputedStyle(element);
      const transformIsIdentity = style.transform === "none" || /^matrix\(1, 0, 0, 1, 0, 0\)$/.test(style.transform);
      return (
        element.getAnimations().some((animation) => animation.playState === "running") &&
        Number(style.opacity) > 0 &&
        Number(style.opacity) < 1 &&
        !transformIsIdentity
      );
    });
    await expect.poll(() => target.evaluate((element) => Number(getComputedStyle(element).opacity))).toBeGreaterThan(0.95);
    await expect.poll(() => target.evaluate((element) => getComputedStyle(element).transform)).toMatch(/^matrix\(1, 0, 0, 1, 0, 0\)$/);
  });

  test("wheel input uses the source Lenis interpolation and updates scroll-linked motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("data-smooth-scroll", "lenis");

    const dashboard = page.locator("[data-hero-dashboard][data-scroll-parallax]");
    const initialLinkedY = await dashboard.evaluate((element) => Number.parseFloat(getComputedStyle(element).getPropertyValue("--scroll-linked-y")));
    await page.mouse.wheel(0, 900);
    await page.waitForTimeout(90);
    const earlyScrollY = await page.evaluate(() => window.scrollY);
    expect(earlyScrollY).toBeGreaterThan(0);
    expect(earlyScrollY).toBeLessThan(900);

    await page.waitForTimeout(1150);
    const settledScrollY = await page.evaluate(() => window.scrollY);
    expect(settledScrollY).toBeGreaterThan(earlyScrollY);
    const settledLinkedY = await dashboard.evaluate((element) => Number.parseFloat(getComputedStyle(element).getPropertyValue("--scroll-linked-y")));
    expect(settledLinkedY).toBeLessThan(initialLinkedY);
    expect(settledLinkedY).toBeGreaterThanOrEqual(-50);
    expect(settledLinkedY).toBeLessThanOrEqual(50);
  });

  test("tablet card and setup geometry matches the exported 1152px source state", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.setViewportSize({ width: 1152, height: 900 });
    await page.goto("/");

    const visibleLogoCount = await page.locator(".hero__logo-track img").evaluateAll((logos) =>
      logos.filter((logo) => {
        const rect = logo.getBoundingClientRect();
        const windowRect = logo.closest(".hero__logo-window")!.getBoundingClientRect();
        return getComputedStyle(logo).display !== "none" && rect.left < windowRect.right && rect.right > windowRect.left;
      }).length,
    );
    expect(visibleLogoCount).toBeGreaterThanOrEqual(5);

    const cards = page.locator("[data-cycle-card]");
    await expect(cards).toHaveCount(2);
    for (const card of [cards.nth(0), cards.nth(1)]) {
      const box = await card.boundingBox();
      expect(box?.width).toBeCloseTo(531, 0);
      expect(box?.height).toBeCloseTo(357, 0);
    }

    const layerWidths = await cards.nth(0).locator(".task-stack__item").evaluateAll((layers) =>
      layers.map((layer) => layer.getBoundingClientRect().width).sort((a, b) => b - a),
    );
    expect(layerWidths[0]).toBeCloseTo(300, 0);
    expect(layerWidths[1]).toBeCloseTo(258, 0);
    expect(layerWidths[2]).toBeCloseTo(216, 0);

    const copyMetrics = await cards.nth(0).evaluate((card) => {
      const heading = card.querySelector("h3")!;
      const paragraph = card.querySelector("p")!;
      const body = card.querySelector(".feature-card__body")!;
      const cardRect = card.getBoundingClientRect();
      const bodyRect = body.getBoundingClientRect();
      return {
        headingSize: Number.parseFloat(getComputedStyle(heading).fontSize),
        paragraphSize: Number.parseFloat(getComputedStyle(paragraph).fontSize),
        bottomGap: cardRect.bottom - bodyRect.bottom,
      };
    });
    expect(copyMetrics.headingSize).toBe(22);
    expect(copyMetrics.paragraphSize).toBe(18);
    expect(copyMetrics.bottomGap).toBeCloseTo(1, 0);

    const clientGeometry = await cards.nth(1).evaluate((card) => {
      const iconRects = Array.from(card.querySelectorAll(".client-list-cycle__icon")).map((icon) => icon.getBoundingClientRect());
      const activePanel = card.querySelector(".client-list-cycle__panel.is-active")!.getBoundingClientRect();
      const activeIcon = card.querySelector(".client-list-cycle__icon.is-active")!.getBoundingClientRect();
      const inactiveIcon = card.querySelector(".client-list-cycle__icon:not(.is-active)")!.getBoundingClientRect();
      return {
        activeIcon: activeIcon.width,
        inactiveIcon: inactiveIcon.width,
        iconBottom: Math.max(...iconRects.map((rect) => rect.bottom)),
        panelTop: activePanel.top,
        panelWidth: activePanel.width,
      };
    });
    expect(clientGeometry.activeIcon).toBeCloseTo(40, 0);
    expect(clientGeometry.inactiveIcon).toBeCloseTo(28, 0);
    expect(clientGeometry.panelWidth).toBeCloseTo(260, 0);
    expect(clientGeometry.panelTop - clientGeometry.iconBottom).toBeGreaterThan(15);

    const setupGeometry = await page.locator(".setup").evaluate((setup) => {
      const visual = setup.querySelector(".setup__visual")!.getBoundingClientRect();
      const content = setup.querySelector(".setup__content")!.getBoundingClientRect();
      const mark = setup.querySelector(".setup__mark")!.getBoundingClientRect();
      const status = setup.querySelector(".setup__status")!;
      return {
        visualWidth: visual.width,
        visualHeight: visual.height,
        contentWidth: content.width,
        markWidth: mark.width,
        status: status.textContent?.trim(),
      };
    });
    expect(setupGeometry.visualWidth).toBeCloseTo(531, 0);
    expect(setupGeometry.contentWidth).toBeCloseTo(531, 0);
    expect(setupGeometry.visualHeight).toBeCloseTo(466, 0);
    expect(setupGeometry.markWidth).toBeCloseTo(120, 0);
    expect(setupGeometry.status).toBe("No switching tools");
  });

  test("feature and client visual layers animate on the recorded three-second cadence", async ({ page }) => {
    await page.goto("/");
    const cycles = page.locator("[data-feature-cycle]");
    await expect(cycles).toHaveCount(3);
    await expect(cycles.nth(1).locator("[data-cycle-panel]")).toHaveCount(6);
    expect(await cycles.nth(1).locator("[data-cycle-panel]").evaluateAll((panels) => new Set(panels.map((panel) => panel.getAttribute("src"))).size)).toBe(5);
    await expect(cycles.nth(2).locator("[data-client-dashboard-state]")).toHaveCount(4);
    await expect(cycles.nth(2).locator("[data-orbit-icon-tile]")).toHaveCount(8);
    expect(await cycles.nth(2).locator(".client-dashboard__orb-track").evaluate((element) => getComputedStyle(element).transitionDuration)).toBe("0.35s");
    await expect(cycles.first()).toHaveAttribute("data-cycle-index", "0");
    await expect(cycles.nth(1)).toHaveAttribute("data-cycle-index", "0");
    await expect(cycles.nth(2)).toHaveAttribute("data-cycle-index", "0");

    const { snapshots: transitionSnapshots, elapsedMs } = await page.evaluate(() => new Promise<{
      snapshots: Array<{
        layerCount: number;
        transitionRuns: number;
        runningAnimations: Array<{ duration: number | string; target: string }>;
        transitionDurations: number[];
        computedStyles: Array<{ opacity: number; transform: string }>;
      }>;
      elapsedMs: number;
    }>((resolve, reject) => {
      const startedAt = performance.now();
      const cycles = Array.from(document.querySelectorAll<HTMLElement>("[data-feature-cycle]"));
      const readSnapshot = (cycle: HTMLElement) => {
        const card = cycle.closest<HTMLElement>("[data-cycle-card]");
        const layers = [
          ...Array.from(cycle.querySelectorAll<HTMLElement>("[data-cycle-item]")),
          ...Array.from(cycle.querySelectorAll<HTMLElement>(".client-dashboard__state")),
          ...Array.from(card?.querySelectorAll<HTMLElement>("[data-cycle-icon]") ?? []),
          ...Array.from(cycle.querySelectorAll<HTMLElement>(".client-dashboard__orb-track")),
        ];
        const runningAnimations = layers.flatMap((layer) =>
          layer.getAnimations()
            .filter((animation) => animation.playState === "running")
            .map((animation) => {
              const duration = animation.effect?.getComputedTiming().duration ?? "auto";
              return { duration: typeof duration === "number" ? duration : String(duration), target: String(layer.className) };
            }),
        );
        const transitionDurations = layers.flatMap((layer) =>
          getComputedStyle(layer).transitionDuration.split(",").map((duration) => Number.parseFloat(duration) * 1000),
        );
        const computedStyles = layers.map((layer) => {
          const style = getComputedStyle(layer);
          return { opacity: Number(style.opacity), transform: style.transform };
        });
        return { layerCount: layers.length, transitionRuns: 0, runningAnimations, transitionDurations, computedStyles };
      };
      const snapshots: Array<ReturnType<typeof readSnapshot> | undefined> = [];
      let remaining = cycles.length;
      let observers: MutationObserver[] = [];
      const transitionRuns = cycles.map(() => ({ count: 0 }));
      const timeout = window.setTimeout(() => {
        observers.forEach((observer) => observer.disconnect());
        reject(new Error("Timed out waiting for all homepage cycle layers to animate"));
      }, 5000);
      observers = cycles.map((cycle, index) => {
        const card = cycle.closest<HTMLElement>("[data-cycle-card]");
        const layers = [
          ...Array.from(cycle.querySelectorAll<HTMLElement>("[data-cycle-item]")),
          ...Array.from(card?.querySelectorAll<HTMLElement>("[data-cycle-icon]") ?? []),
          ...Array.from(cycle.querySelectorAll<HTMLElement>(".client-dashboard__orb-track")),
        ];
        layers.forEach((layer) => {
          layer.addEventListener("transitionrun", () => {
            transitionRuns[index].count += 1;
          });
        });
        const observeTransition = () => {
          if (cycle.dataset.cycleIndex !== "1") return;
          const snapshot = readSnapshot(cycle);
          snapshot.transitionRuns = transitionRuns[index].count;
          if (snapshot.transitionRuns === 0 && snapshot.runningAnimations.length === 0) {
            window.requestAnimationFrame(observeTransition);
            return;
          }
          snapshots[index] = snapshot;
          remaining -= 1;
          if (remaining === 0) {
            window.clearTimeout(timeout);
            observers.forEach((observer) => observer.disconnect());
            resolve({ snapshots: snapshots as Array<ReturnType<typeof readSnapshot>>, elapsedMs: performance.now() - startedAt });
          }
        };
        const observer = new MutationObserver(observeTransition);
        observer.observe(cycle, { attributes: true, attributeFilter: ["data-cycle-index"] });
        observeTransition();
        return observer;
      });
    }));
    expect(elapsedMs).toBeGreaterThanOrEqual(2500);
    expect(elapsedMs).toBeLessThan(4500);

    for (const [index, snapshot] of transitionSnapshots.entries()) {
      expect(snapshot.layerCount).toBeGreaterThan(1);
      expect(snapshot.transitionRuns + snapshot.runningAnimations.length).toBeGreaterThan(0);
      const activeDurations = [
        ...snapshot.transitionDurations,
        ...snapshot.runningAnimations.map(({ duration }) => typeof duration === "number" ? duration : 0),
      ];
      expect(activeDurations.some((duration) => duration > 0)).toBe(true);
      if (index < 2) {
        expect(activeDurations.some((duration) => Math.abs(duration - 400) < 2)).toBe(true);
        expect(snapshot.computedStyles.some(({ opacity, transform }) => opacity > 0 && opacity < 1 && transform !== "none")).toBe(true);
      }
    }
  });

  test("setup steps use a single-open animated state", async ({ page }) => {
    await page.goto("/");
    const steps = page.locator("[data-setup-step]");
    const firstButton = steps.nth(0).locator("[data-setup-button]");
    const secondButton = steps.nth(1).locator("[data-setup-button]");
    await expect(firstButton).toHaveAttribute("aria-expanded", "true");
    await secondButton.click();
    await expect(secondButton).toHaveAttribute("aria-expanded", "true");
    await expect(firstButton).toHaveAttribute("aria-expanded", "false");
    await expect(steps.nth(1).locator("[data-setup-panel]")).toBeVisible();
    await expect(steps.nth(0).locator("[data-setup-panel]")).toBeHidden();
  });

  test("setup decoration preserves the paired forty-second rotations", async ({ page }) => {
    await page.goto("/");
    const patternDuration = await page.locator(".setup__pattern").evaluate((element) => getComputedStyle(element).animationDuration);
    const orbitDuration = await page.locator(".setup__orbit-layer").evaluate((element) => getComputedStyle(element).animationDuration);
    const patternName = await page.locator(".setup__pattern").evaluate((element) => getComputedStyle(element).animationName);
    const orbitName = await page.locator(".setup__orbit-layer").evaluate((element) => getComputedStyle(element).animationName);
    expect(patternDuration).toBe("40s");
    expect(orbitDuration).toBe("40s");
    expect(patternName).not.toBe(orbitName);
  });

  test("AI tabs switch to distinct exported visuals", async ({ page }) => {
    await page.goto("/");
    const initial = page.locator('[data-tab-panel="auto-tasks"] img').first();
    await expect(initial).toHaveAttribute("src", /GquWECjBgqNlQMEuc3LTpc4ulA/);
    await page.getByRole("tab", { name: "Follow-ups" }).click();
    const followUp = page.locator('[data-tab-panel="follow-ups"]');
    await expect(followUp).toBeVisible();
    await expect(followUp.locator("img").first()).toHaveAttribute("src", /CGhsmA06gaviXj0BzRaVxiJ6DPQ/);
  });

  test("FAQ close transition finishes before its panel is hidden", async ({ page }) => {
    await page.goto("/faqs");
    const button = page.getByRole("button", { name: "Is Worklane suitable for remote teams?" });
    const panel = page.locator(`#${await button.getAttribute("aria-controls")}`);
    await button.click();
    await expect(panel).toBeVisible();
    await button.click();
    await page.waitForTimeout(60);
    await expect(panel).toBeVisible();
    await expect(panel).toBeHidden({ timeout: 900 });
  });

  test("blog-card hover stays within the source scale range", async ({ page }) => {
    await page.goto("/blog");
    const card = page.locator(".blog-card").first();
    const image = card.locator(".blog-card__image");
    await card.hover();
    await page.waitForTimeout(400);
    const transform = await image.evaluate((element) => getComputedStyle(element).transform);
    const match = transform.match(/^matrix\(([^,]+)/);
    expect(match).not.toBeNull();
    const scale = Number(match?.[1] ?? 1);
    expect(scale).toBeGreaterThanOrEqual(1.01);
    expect(scale).toBeLessThanOrEqual(1.025);
  });

  test("form routes run staged entrances instead of forced static overrides", async ({ page }) => {
    await page.goto("/request-demo", { waitUntil: "domcontentloaded" });
    const form = page.locator(".demo-form");
    await page.waitForTimeout(100);
    const earlyOpacity = Number(await form.evaluate((element) => getComputedStyle(element).opacity));
    expect(earlyOpacity).toBeLessThan(0.8);
    await page.waitForTimeout(1000);
    const finalOpacity = Number(await form.evaluate((element) => getComputedStyle(element).opacity));
    expect(finalOpacity).toBeGreaterThan(0.95);
  });

  test("reduced motion resolves visible static states and stops cycles", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const lateDashboard = page.locator('[data-hero-reveal][data-delay="850"]');
    await expect(lateDashboard).toBeVisible();
    const cycle = page.locator("[data-feature-cycle]").first();
    await page.waitForTimeout(3200);
    await expect(cycle).toHaveAttribute("data-cycle-index", "0");
  });
});
