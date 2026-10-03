import { animate, inView, stagger } from "motion";
import Lenis from "lenis";
import "lenis/dist/lenis.css";
import "../styles/rolling-counter.css";

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const sourceEase = [0.44, 0, 0.56, 1] as [number, number, number, number];
const disclosureRuns = new WeakMap<HTMLElement, number>();
const disclosureAnimations = new WeakMap<HTMLElement, { stop: () => void; finished: Promise<unknown> }>();

function setupAmbientVideoMotion() {
  if (!reducedMotion) return;
  document.querySelectorAll<HTMLVideoElement>("video[autoplay][loop]").forEach((video) => {
    video.removeAttribute("autoplay");
    video.pause();
    video.addEventListener("play", () => video.pause());
  });
}

function setupSmoothScroll() {
  if (reducedMotion) return;
  const lenis = new Lenis({
    autoRaf: true,
    anchors: true,
    duration: 1,
    smoothWheel: true,
    syncTouch: false,
  });
  document.documentElement.dataset.smoothScroll = "lenis";

  const menuObserver = new MutationObserver(() => {
    if (document.body.classList.contains("menu-open")) lenis.stop();
    else lenis.start();
  });
  menuObserver.observe(document.body, { attributes: true, attributeFilter: ["class"] });
}

function setupScrollLinkedMotion() {
  const targets = Array.from(document.querySelectorAll<HTMLElement>("[data-scroll-parallax]"));
  if (!targets.length || reducedMotion) return;
  let frame = 0;

  const update = () => {
    frame = 0;
    const viewportHeight = window.innerHeight;
    targets.forEach((target) => {
      const section = target.closest<HTMLElement>("[data-scroll-parallax-section]");
      const rect = (section ?? target).getBoundingClientRect();
      const from = Number(target.dataset.scrollFrom ?? 0);
      const to = Number(target.dataset.scrollTo ?? 0);
      const threshold = Number(target.dataset.scrollThreshold ?? 0);
      const start = viewportHeight - rect.height * threshold;
      const end = -rect.height * (1 - threshold);
      const progress = section
        ? Math.min(1, Math.max(0, -rect.top / Math.max(1, rect.height)))
        : Math.min(1, Math.max(0, (start - rect.top) / Math.max(1, start - end)));
      const y = from + (to - from) * progress;
      target.style.setProperty("--scroll-linked-y", `${y.toFixed(3)}px`);
    });
  };

  const schedule = () => {
    if (frame) return;
    frame = window.requestAnimationFrame(update);
  };
  update();
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
}

async function setDisclosure(panel: HTMLElement, open: boolean, springLike = false) {
  const run = (disclosureRuns.get(panel) ?? 0) + 1;
  disclosureRuns.set(panel, run);
  disclosureAnimations.get(panel)?.stop();

  const wasHidden = panel.hidden;
  const startHeight = wasHidden ? 0 : panel.getBoundingClientRect().height;
  const startOpacity = wasHidden ? 0 : Number(getComputedStyle(panel).opacity);
  panel.hidden = false;

  if (reducedMotion) {
    panel.hidden = !open;
    panel.style.removeProperty("height");
    panel.style.removeProperty("opacity");
    return;
  }

  // Measure the full content height after stopping a prior transition so quick
  // repeated clicks can continue from the current frame in either direction.
  panel.style.removeProperty("height");
  const targetHeight = open ? panel.scrollHeight : 0;
  panel.style.height = `${startHeight}px`;
  const controls = animate(
    panel,
    { opacity: [startOpacity, open ? 1 : 0], height: [startHeight, targetHeight] },
    springLike
      ? { type: "spring", stiffness: 300, damping: 40, mass: 1 }
      : { duration: open ? 0.38 : 0.32, ease: sourceEase },
  );
  disclosureAnimations.set(panel, controls);
  try {
    await controls.finished;
  } catch {
    // A newer disclosure state superseded this animation.
  }
  if (disclosureRuns.get(panel) !== run) return;
  disclosureAnimations.delete(panel);
  panel.hidden = !open;
  panel.style.removeProperty("height");
  panel.style.removeProperty("opacity");
}

function openDisclosure(panel: HTMLElement, springLike = false) {
  return setDisclosure(panel, true, springLike);
}

function closeDisclosure(panel: HTMLElement, springLike = false) {
  return setDisclosure(panel, false, springLike);
}

function setupHeroEntrance() {
  const items = Array.from(document.querySelectorAll<HTMLElement>("[data-hero-reveal], [data-hero-dashboard]"));
  if (!items.length) return;
  if (reducedMotion) {
    items.forEach((item) => {
      item.style.opacity = "";
      item.style.translate = "";
    });
    return;
  }

  items.forEach((item) => {
    if (getComputedStyle(item).display === "none") return;
    const delay = Number(item.dataset.delay ?? 0) / 1000;
    const y = Number(item.dataset.heroY ?? (item.hasAttribute("data-hero-dashboard") ? 50 : 20));
    const finalOpacity = Number(getComputedStyle(item).opacity || 1);
    item.style.opacity = "0";
    item.style.translate = `0 ${y}px`;
    animate(
      item,
      { opacity: [0.001, finalOpacity], translate: [`0 ${y}px`, "0 0px"] },
      { delay, duration: 0.6, ease: [0.22, 1, 0.36, 1] },
    );
  });
}

function setupMotion() {
  document.documentElement.classList.add("motion-ready");
  const items = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
  if (reducedMotion) {
    items.forEach((item) => {
      item.dataset.revealState = "visible";
      item.style.opacity = "1";
      item.style.transform = "translateY(0px)";
      item.querySelectorAll<HTMLElement>("[data-reveal-child]").forEach((child) => {
        child.style.opacity = "1";
        child.style.transform = "translateY(0px)";
      });
    });
    return;
  }

  inView(
    items,
    (element) => {
      const root = element as HTMLElement;
      if (root.dataset.revealState === "visible") return;
      root.dataset.revealState = "visible";
      const group = root.querySelectorAll<HTMLElement>("[data-reveal-child]");
      if (group.length) {
        const children = Array.from(group);
        if (root.hasAttribute("data-reveal-each")) {
          // Tall source sections reveal each child as it reaches the viewport.
          inView(children, (element) => {
            const child = element as HTMLElement;
            if (child.dataset.revealState === "visible") return;
            child.dataset.revealState = "visible";
            const delay = Number(child.dataset.revealDelay ?? 0) / 1000;
            animate(
              child,
              { opacity: [0, 1], transform: ["translateY(20px)", "translateY(0)"] } as never,
              { delay, type: "spring", duration: 0.6, bounce: 0 },
            );
          }, { amount: "some" });
          return;
        }
        if (children.some((child) => child.dataset.revealDelay)) {
          children.forEach((child, index) => {
            const delay = Number(child.dataset.revealDelay ?? index * 80) / 1000;
            animate(
              child,
              { opacity: [0, 1], transform: ["translateY(20px)", "translateY(0)"] } as never,
              { delay, type: "spring", duration: 0.6, bounce: 0 },
            );
          });
        } else {
          animate(
            children,
            { opacity: [0, 1], transform: ["translateY(20px)", "translateY(0)"] } as never,
            { delay: stagger(0.1), type: "spring", duration: 0.6, bounce: 0 },
          );
        }
      } else {
        animate(
          root,
          { opacity: 1, transform: "translateY(0px)" } as never,
          { type: "spring", duration: 0.6, bounce: 0 },
        );
      }
    },
    { amount: "some" },
  );
}

function setupRollingCounters() {
  if (reducedMotion) return;
  document.querySelectorAll<HTMLElement>("[data-rolling-counter]").forEach((counter) => {
    const numberNode = Array.from(counter.childNodes).find((node) => node.nodeType === Node.TEXT_NODE && /\d/.test(node.textContent ?? ""));
    const match = numberNode?.textContent?.trim().match(/^(\d+)([^\d]*)$/);
    if (!numberNode || !match) return;
    const [, digits, inlineSuffix] = match;

    const label = counter.textContent?.trim() ?? digits;
    const visual = document.createElement("span");
    visual.className = "rolling-counter__digits";
    visual.setAttribute("aria-hidden", "true");
    counter.style.opacity = "0";

    for (const digit of digits) {
      const windowElement = document.createElement("span");
      windowElement.className = "rolling-counter__window";
      const stack = document.createElement("span");
      stack.className = "rolling-counter__stack";
      const target = Number(digit);
      for (const fraction of [0, 0.25, 0.5, 0.75, 1]) {
        const row = document.createElement("span");
        row.textContent = String(Math.floor(target * fraction));
        stack.append(row);
      }
      windowElement.append(stack);
      visual.append(windowElement);
    }

    const accessibleLabel = document.createElement("span");
    accessibleLabel.className = "rolling-counter__label";
    accessibleLabel.textContent = label;
    counter.querySelector(".impact-suffix")?.setAttribute("aria-hidden", "true");
    numberNode.replaceWith(visual);
    if (inlineSuffix) {
      const suffix = document.createElement("span");
      suffix.className = "rolling-counter__suffix";
      suffix.textContent = inlineSuffix;
      suffix.setAttribute("aria-hidden", "true");
      visual.after(suffix);
    }
    counter.append(accessibleLabel);
    inView(counter, () => {
      if (counter.dataset.counterPlayed === "true") return;
      counter.dataset.counterPlayed = "true";
      const stacks = Array.from(visual.querySelectorAll<HTMLElement>(".rolling-counter__stack"));
      const delay = Number(counter.dataset.counterDelay ?? 0) / 1000;
      animate(counter, { opacity: [0, 1] }, { delay, duration: 0.25, ease: sourceEase });
      stacks.forEach((stack, index) => {
        // Five equal rows: moving four rows is 80% of the stack. Relative
        // motion keeps the final digit aligned if the web font loads late.
        animate(stack, { transform: ["translateY(0%)", "translateY(-80%)"] }, { type: "spring", duration: 0.8, bounce: 0, delay: delay + index * 0.06 });
      });
    }, { amount: "some" });
  });
}

function setupMenu() {
  const header = document.querySelector<HTMLElement>("[data-site-header]");
  const surface = header?.querySelector<HTMLElement>(".site-header__surface");
  const button = document.querySelector<HTMLButtonElement>("[data-menu-toggle]");
  const nav = document.querySelector<HTMLElement>("[data-mobile-nav]");
  const overlay = document.querySelector<HTMLElement>("[data-nav-overlay]");
  const scrim = document.querySelector<HTMLButtonElement>("[data-menu-scrim]");
  if (!header || !surface || !button || !nav || !overlay || !scrim) return;

  let scrollHidden = false;
  let lastScrollY = Math.max(0, window.scrollY);
  let scrollFrame = 0;

  const setScrollHidden = (hidden: boolean) => {
    const compactHeader = window.innerWidth < 1200;
    const nextHidden = compactHeader && hidden && header.dataset.menuOpen !== "true";
    if (nextHidden === scrollHidden) return;
    scrollHidden = nextHidden;
    header.dataset.scrollHidden = String(nextHidden);
    const targetY = nextHidden ? (window.innerWidth <= 809 ? -72 : -80) : 0;
    if (reducedMotion) {
      surface.style.transform = "translateY(" + targetY + "px)";
      return;
    }
    animate(
      surface,
      { y: targetY } as never,
      { type: "spring", stiffness: 400, damping: 35, mass: 1 },
    );
  };

  const setOpen = (open: boolean, restoreFocus = false) => {
    if (open) setScrollHidden(false);
    header.dataset.menuOpen = String(open);
    button.setAttribute("aria-expanded", String(open));
    button.setAttribute("aria-label", open ? "Close navigation" : "Open navigation");
    overlay.setAttribute("aria-hidden", String(!open));
    if (open) nav.removeAttribute("inert");
    else nav.setAttribute("inert", "");
    document.body.classList.toggle("menu-open", open);
    if (!open && restoreFocus) button.focus();
  };

  button.addEventListener("click", () => setOpen(button.getAttribute("aria-expanded") !== "true"));
  header.addEventListener("focusin", () => setScrollHidden(false));
  scrim.addEventListener("click", () => setOpen(false, true));
  nav.addEventListener("click", (event) => {
    if ((event.target as HTMLElement).closest("a")) setOpen(false);
  });
  document.querySelectorAll<HTMLElement>("[data-menu-close]").forEach((element) => {
    element.addEventListener("click", () => setOpen(false));
  });
  document.addEventListener("keydown", (event) => {
    const isOpen = button.getAttribute("aria-expanded") === "true";
    if (event.key === "Escape" && isOpen) {
      setOpen(false, true);
      return;
    }
    if (event.key !== "Tab" || !isOpen) return;

    const focusable = [button, ...Array.from(nav.querySelectorAll<HTMLAnchorElement>("a"))];
    const first = focusable[0];
    const last = focusable.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  window.addEventListener("resize", () => {
    if (window.innerWidth >= 1200) {
      setScrollHidden(false);
      if (button.getAttribute("aria-expanded") === "true") setOpen(false);
    }
    lastScrollY = Math.max(0, window.scrollY);
  });
  window.addEventListener("scroll", () => {
    if (scrollFrame) return;
    scrollFrame = window.requestAnimationFrame(() => {
      scrollFrame = 0;
      const currentScrollY = Math.max(0, window.scrollY);
      const delta = currentScrollY - lastScrollY;
      if (currentScrollY === 0 || delta < -1) setScrollHidden(false);
      else if (delta > 1) setScrollHidden(true);
      lastScrollY = currentScrollY;
    });
  }, { passive: true });
}

function setupAccordions() {
  document.querySelectorAll<HTMLElement>("[data-accordion]").forEach((accordion) => {
    const items = accordion.querySelectorAll<HTMLElement>("[data-accordion-item]");
    items.forEach((item) => {
      const button = item.querySelector<HTMLButtonElement>("[data-accordion-button]");
      const panel = item.querySelector<HTMLElement>("[data-accordion-panel]");
      if (!button || !panel) return;
      button.addEventListener("click", () => {
        const shouldOpen = button.getAttribute("aria-expanded") !== "true";
        if (shouldOpen && accordion.dataset.single !== "false") {
          items.forEach((other) => {
            if (other === item) return;
            const otherButton = other.querySelector<HTMLButtonElement>("[data-accordion-button]");
            const otherPanel = other.querySelector<HTMLElement>("[data-accordion-panel]");
            if (!otherButton || !otherPanel || otherButton.getAttribute("aria-expanded") !== "true") return;
            otherButton.setAttribute("aria-expanded", "false");
            void closeDisclosure(otherPanel, true);
          });
        }
        button.setAttribute("aria-expanded", String(shouldOpen));
        void (shouldOpen ? openDisclosure(panel, true) : closeDisclosure(panel, true));
      });
    });
  });
}

function setupTabs() {
  document.querySelectorAll<HTMLElement>("[data-tabs]").forEach((tabs) => {
    const buttons = tabs.querySelectorAll<HTMLButtonElement>("[data-tab]");
    const panels = tabs.querySelectorAll<HTMLElement>("[data-tab-panel]");
    const animatePanel = (panel: HTMLElement) => {
      if (reducedMotion) return;
      animate(panel, { opacity: [0, 1], transform: ["translateY(16px)", "translateY(0)"] }, { type: "spring", duration: 0.4, bounce: 0.2 });
      const stages = Array.from(panel.querySelectorAll<HTMLElement>("[data-tab-stage]"));
      stages.forEach((stage, index) => {
        const sourceDelays = [0.1, 0.2, 0.25, 0.3, 0.4];
        animate(
          stage,
          { opacity: [0, 1], transform: ["translateY(18px)", "translateY(0)"] },
          { delay: sourceDelays[index] ?? 0.4, type: "spring", duration: 0.6, bounce: 0 },
        );
      });
    };

    if (!reducedMotion && tabs.querySelector("[data-tab-stage]")) {
      inView(tabs, () => {
        const initialPanel = Array.from(panels).find((panel) => !panel.hidden);
        if (initialPanel) animatePanel(initialPanel);
      }, { amount: 0.18 });
    }

    buttons.forEach((button) => {
      button.addEventListener("click", () => {
        const target = button.dataset.tab;
        buttons.forEach((candidate) => {
          const active = candidate === button;
          candidate.setAttribute("aria-selected", String(active));
          candidate.tabIndex = active ? 0 : -1;
        });
        panels.forEach((panel) => {
          const active = panel.dataset.tabPanel === target;
          panel.hidden = !active;
          if (active) animatePanel(panel);
        });
      });
      button.addEventListener("keydown", (event) => {
        const current = Array.from(buttons).indexOf(button);
        let next = current;
        if (event.key === "ArrowRight") next = (current + 1) % buttons.length;
        if (event.key === "ArrowLeft") next = (current - 1 + buttons.length) % buttons.length;
        if (event.key === "Home") next = 0;
        if (event.key === "End") next = buttons.length - 1;
        if (next === current) return;
        event.preventDefault();
        buttons[next]?.focus();
        buttons[next]?.click();
      });
    });
  });
}

function setupFeatureCycles() {
  document.querySelectorAll<HTMLElement>("[data-feature-cycle]").forEach((cycle) => {
    const mode = cycle.dataset.featureCycle || "crossfade";
    const items = Array.from(cycle.querySelectorAll<HTMLElement>("[data-cycle-item]"));
    const panels = Array.from(cycle.querySelectorAll<HTMLElement>("[data-cycle-panel]"));
    const dashboardStates = Array.from(cycle.querySelectorAll<HTMLElement>("[data-client-dashboard-state]"));
    const orbitTrack = cycle.querySelector<HTMLElement>(".client-dashboard__orb-track");
    const orbitIcons = Array.from(cycle.querySelectorAll<HTMLElement>(".client-dashboard__orb-track > span"));
    const itemCount = mode === "client-list" ? panels.length : mode === "client-orbit" ? dashboardStates.length : items.length;
    if (itemCount < 2 || reducedMotion) return;
    let index = Number(cycle.dataset.cycleIndex ?? 0);
    let timer = 0;

    const setIdentity = (nextIndex: number) => {
      cycle.dataset.cycleIndex = String(nextIndex);
      cycle.dataset.sourceVariant = mode === "client-orbit" ? String(nextIndex + 1).padStart(2, "0") : nextIndex === 0 ? "Default" : String(nextIndex + 1).padStart(2, "0");
      const card = cycle.closest<HTMLElement>("[data-cycle-card]");
      if (card) card.dataset.cycleIndex = String(nextIndex);
    };

    const schedule = (delay = 3000) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void advance(), delay);
    };

    const advance = async () => {
      const nextIndex = mode === "client-orbit" ? index + 1 : (index + 1) % itemCount;
      if (mode === "client-orbit" && nextIndex >= itemCount) return;
      setIdentity(nextIndex);

      if (mode === "task-stack") {
        items.forEach((item, itemIndex) => {
          const slot = (itemIndex - nextIndex + items.length) % items.length;
          item.dataset.cycleSlot = String(slot);
        });
        index = nextIndex;
        schedule();
        return;
      }

      if (mode === "client-list") {
        const activeIconByState = [2, 3, 4, 5, 6, 7];
        const instantReset = index === itemCount - 1 && nextIndex === 0;
        if (instantReset) cycle.setAttribute("data-instant-reset", "");
        items.forEach((item, itemIndex) => {
          const active = itemIndex === activeIconByState[nextIndex];
          item.classList.toggle("is-active", active);
        });
        const previousPanel = panels[index];
        const nextPanel = panels[nextIndex];
        if (previousPanel && nextPanel) {
          nextPanel.classList.add("is-active");
          nextPanel.setAttribute("aria-hidden", "false");
          previousPanel.classList.remove("is-active");
          previousPanel.setAttribute("aria-hidden", "true");
        }
        if (instantReset) window.requestAnimationFrame(() => cycle.removeAttribute("data-instant-reset"));
        index = nextIndex;
        schedule(nextIndex === itemCount - 1 ? 0 : 3000);
        return;
      }

      if (mode === "client-orbit" && orbitTrack) {
        const degrees = nextIndex * 45;
        orbitTrack.style.setProperty("--orbit-rotation", `${degrees}deg`);
        orbitIcons.forEach((icon) => icon.style.setProperty("--orbit-icon-rotation", `${-degrees}deg`));
        const activeOrbitIconByState = [0, 7, 3, 5];
        orbitIcons.forEach((icon, iconIndex) => icon.classList.toggle("is-active", iconIndex === activeOrbitIconByState[nextIndex]));
        const previousState = dashboardStates[index];
        const nextState = dashboardStates[nextIndex];
        if (previousState && nextState) {
          nextState.classList.add("is-active");
          nextState.setAttribute("aria-hidden", "false");
          previousState.classList.remove("is-active");
          previousState.setAttribute("aria-hidden", "true");
        }
        index = nextIndex;
        if (nextIndex < itemCount - 1) schedule();
        return;
      }

      const previous = items[index];
      const next = items[nextIndex];
      if (!previous || !next) return;
      next.classList.add("is-active");
      next.setAttribute("aria-hidden", "false");
      await Promise.all([
        animate(previous, { opacity: [1, 0], transform: ["translateX(0)", "translateX(-16px)"] }, { duration: 0.4, ease: sourceEase }).finished,
        animate(next, { opacity: [0, 1], transform: ["translateX(16px)", "translateX(0)"] }, { duration: 0.4, ease: sourceEase }).finished,
      ]);
      previous.classList.remove("is-active");
      previous.setAttribute("aria-hidden", "true");
      previous.style.removeProperty("opacity");
      previous.style.removeProperty("transform");
      next.style.removeProperty("opacity");
      next.style.removeProperty("transform");
      index = nextIndex;
      schedule();
    };

    schedule();
  });
}

function setupProcessSteps() {
  document.querySelectorAll<HTMLElement>("[data-setup-list]").forEach((list) => {
    const steps = Array.from(list.querySelectorAll<HTMLElement>("[data-setup-step]"));
    steps.forEach((step) => {
      const button = step.querySelector<HTMLButtonElement>("[data-setup-button]");
      const panel = step.querySelector<HTMLElement>("[data-setup-panel]");
      if (!button || !panel) return;
      button.addEventListener("click", () => {
        if (button.getAttribute("aria-expanded") === "true") return;
        steps.forEach((other) => {
          if (other === step) return;
          const otherButton = other.querySelector<HTMLButtonElement>("[data-setup-button]");
          const otherPanel = other.querySelector<HTMLElement>("[data-setup-panel]");
          if (!otherButton || !otherPanel || otherButton.getAttribute("aria-expanded") !== "true") return;
          otherButton.setAttribute("aria-expanded", "false");
          void closeDisclosure(otherPanel, true);
        });
        button.setAttribute("aria-expanded", "true");
        void openDisclosure(panel, true);
      });
    });
  });
}

function setupDashboardMotion() {
  const rings = Array.from(document.querySelectorAll<HTMLElement>("[data-progress-ring]"));
  if (rings.length) {
    rings.forEach((ring) => {
      const target = Number(ring.dataset.progress ?? 0);
      if (reducedMotion) {
        ring.style.setProperty("--ring-progress", `${target}%`);
        ring.style.setProperty("--ring-offset", String(282.743 * (1 - target / 100)));
      } else {
        ring.style.setProperty("--ring-offset", "282.743");
        ring.querySelector("b")!.textContent = "0%";
      }
    });
    inView(rings, (ring) => {
      const target = Number((ring as HTMLElement).dataset.progress ?? 0);
      if (reducedMotion) return;
      animate(0, target, {
        delay: 0.5,
        duration: 1.5,
        ease: [0.22, 1, 0.36, 1],
        onUpdate: (latest) => {
          (ring as HTMLElement).style.setProperty("--ring-progress", `${latest}%`);
          (ring as HTMLElement).style.setProperty("--ring-offset", String(282.743 * (1 - latest / 100)));
          ring.querySelector("b")!.textContent = `${Math.round(latest)}%`;
        },
      });
    }, { amount: 0.5 });
  }

  const charts = Array.from(document.querySelectorAll<HTMLElement>("[data-revenue-chart]"));
  if (charts.length && !reducedMotion) {
    inView(charts, (chart) => {
      const chartElement = chart as HTMLElement;
      const line = chartElement.querySelector<SVGPathElement>(".chart__line");
      const area = chartElement.querySelector<SVGPathElement>(".chart__area");
      chartElement.dataset.chartAnimated = "true";
      if (line) window.requestAnimationFrame(() => line.style.setProperty("stroke-dashoffset", "0"));
      if (area) animate(area, { opacity: [0, 1] }, { delay: 0.25, duration: 0.9, ease: [0.22, 1, 0.36, 1] });
    }, { amount: 0.5 });
  } else if (reducedMotion) {
    charts.forEach((chart) => chart.querySelector<SVGPathElement>(".chart__line")?.style.setProperty("stroke-dashoffset", "0"));
  }

  const taskDashboards = Array.from(document.querySelectorAll<HTMLElement>(".task-dashboard"));
  if (taskDashboards.length && !reducedMotion) {
    inView(taskDashboards, (dashboard) => {
      animate(
        Array.from(dashboard.querySelectorAll("img:not(.task-dashboard__dates)")),
        { opacity: [0, 1], transform: ["translateX(24px)", "translateX(0)"] },
        { delay: stagger(0.12), duration: 0.6, ease: [0.22, 1, 0.36, 1] },
      );
    }, { amount: 0.4 });
  }

  const teamDashboards = Array.from(document.querySelectorAll<HTMLElement>(".team-dashboard"));
  if (teamDashboards.length && !reducedMotion) {
    inView(teamDashboards, (dashboard) => {
      const image = dashboard.querySelector("img");
      if (image) animate(image, { opacity: [0, 1], transform: ["translateY(18px) scale(.98)", "translateY(0) scale(1)"] }, { duration: 0.7, ease: [0.22, 1, 0.36, 1] });
    }, { amount: 0.45 });
  }
}

function setupForms() {
  document.querySelectorAll<HTMLFormElement>("[data-local-form]").forEach((form) => {
    const status = form.querySelector<HTMLElement>(".form-status");
    const setStatus = (message: string, state: "unconfigured" | "pending" | "success" | "error") => {
      form.dataset.submitState = state;
      if (status) {
        status.dataset.submitState = state;
        status.textContent = message;
      }
    };

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!form.reportValidity()) return;
      const endpoint = form.getAttribute("action")?.trim();
      if (!endpoint || form.getAttribute("method")?.toUpperCase() !== "POST") {
        setStatus("This form is not connected yet. Your details have not been sent.", "unconfigured");
        return;
      }

      const submitter = form.querySelector<HTMLButtonElement>('button[type="submit"]');
      const wasDisabled = submitter?.disabled ?? false;
      if (submitter) submitter.disabled = true;
      setStatus("Sending…", "pending");
      try {
        const response = await fetch(new URL(endpoint, window.location.href), {
          method: "POST",
          body: new FormData(form),
          headers: { Accept: "application/json" },
        });
        if (!response.ok) throw new Error(`Form endpoint returned ${response.status}`);
        setStatus("Your details were sent.", "success");
        form.dataset.submitted = "true";
      } catch {
        setStatus("Your details could not be sent. Please try again.", "error");
      } finally {
        if (submitter) submitter.disabled = wasDisabled;
      }
    });
  });
}

function setupLoadMore() {
  document.querySelectorAll<HTMLButtonElement>("[data-load-more]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.loadComplete === "true") return;
      const root = button.closest<HTMLElement>("[data-load-more-root]");
      if (!root) return;
      const hidden = root.querySelectorAll<HTMLElement>("[data-load-more-item][hidden]");
      hidden.forEach((item) => (item.hidden = false));
      button.dataset.loadComplete = "true";
      button.setAttribute("aria-disabled", "true");
      button.querySelectorAll<HTMLElement>(".load-more__track > span").forEach((label) => {
        label.textContent = "That’s everything for now!";
      });
      if (!reducedMotion) {
        animate(hidden, { opacity: [0, 1], transform: ["translateY(20px)", "translateY(0)"] }, { delay: stagger(0.08), duration: 0.45 });
      }
    });
  });
}

function setupDemoDialog() {
  const dialog = document.querySelector<HTMLDialogElement>("[data-demo-dialog]");
  const open = document.querySelector<HTMLButtonElement>("[data-demo-open]");
  const close = dialog?.querySelector<HTMLButtonElement>("[data-demo-close]");
  const player = dialog?.querySelector<HTMLIFrameElement>("[data-demo-player]");
  if (!dialog || !open || !close || !player) return;
  open.addEventListener("click", () => {
    dialog.showModal();
    if (player.dataset.src) player.src = player.dataset.src;
    close.focus();
  });
  dialog.addEventListener("close", () => player.removeAttribute("src"));
  close.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
}

setupAmbientVideoMotion();
setupSmoothScroll();
setupScrollLinkedMotion();
setupHeroEntrance();
setupMotion();
setupRollingCounters();
setupMenu();
setupAccordions();
setupTabs();
setupFeatureCycles();
setupProcessSteps();
setupDashboardMotion();
setupForms();
setupLoadMore();
setupDemoDialog();
