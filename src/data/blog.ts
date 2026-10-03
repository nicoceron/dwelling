export type BlogBlock =
  | { kind: "paragraph"; text: string }
  | { kind: "quote"; text: string }
  | { kind: "bullets"; items: string[] }
  | { kind: "lines"; items: string[] };

export interface BlogPost {
  slug: string;
  title: string;
  date: string;
  description: string;
  image: string;
  featured?: boolean;
  /** The source route renders a curated, ordered set rather than a global slice. */
  relatedSlugs: string[];
  sections: Array<{
    heading: string;
    blocks: BlogBlock[];
  }>;
}

const imageRoot = "/assets/framerusercontent.com/images/";

export const blogPosts: BlogPost[] = [
  {
    slug: "building-clarity-through-better-saas-dashboard-design",
    title: "Building clarity through better SaaS dashboard design",
    date: "Jan 6, 2026",
    description: "Dashboards should guide decisions, not overwhelm users with data.",
    image: `${imageRoot}9xRslcOIt60WRqWpmOOX9eYOJ8.jpg`,
    featured: true,
    relatedSlugs: [
      "designing-saas-onboarding-that-users-actually-finish",
      "how-smart-automation-reduces-friction-in-saas-products",
      "turning-complex-workflows-into-simple-user-experiences",
    ],
    sections: [
      {
        heading: "Introduction",
        blocks: [
          {
            kind: "paragraph",
            text: "Dashboards are often packed with metrics, charts, and numbers—but more data doesn’t mean more clarity. The best dashboards help users understand what matters right now.",
          },
        ],
      },
      {
        heading: "Why clarity beats complexity",
        blocks: [
          {
            kind: "paragraph",
            text: "Users visit dashboards for answers, not raw information. A clear hierarchy helps users spot trends, issues, and next steps quickly.",
          },
          { kind: "quote", text: "“A great dashboard tells a story at a glance.”" },
        ],
      },
      {
        heading: "Key principles of effective dashboards",
        blocks: [
          {
            kind: "bullets",
            items: [
              "Prioritize key metrics over everything else.",
              "Group related information logically.",
              "Use visual hierarchy to guide attention.",
              "Avoid decorative charts with no purpose.",
            ],
          },
        ],
      },
      {
        heading: "Designing for decision-making",
        blocks: [
          {
            kind: "paragraph",
            text: "Start with the primary question your dashboard should answer. Design around that question, and remove anything that doesn’t support it.",
          },
        ],
      },
      {
        heading: "Tips for dashboard design",
        blocks: [
          {
            kind: "lines",
            items: [
              "Use consistent scales and colors.",
              "Label clearly and avoid abbreviations.",
              "Design for both quick scans and deeper exploration.",
            ],
          },
        ],
      },
      {
        heading: "Conclusion",
        blocks: [
          {
            kind: "paragraph",
            text: "Clarity is a competitive advantage. When your dashboard helps users think clearly, your product becomes indispensable.",
          },
        ],
      },
    ],
  },
  {
    slug: "designing-saas-onboarding-that-users-actually-finish",
    title: "Designing SaaS onboarding that users actually finish",
    date: "Jan 10, 2026",
    description: "A thoughtful onboarding experience turns first-time users into confident, long-term customers.",
    image: `${imageRoot}rFgDfQbkos6Y7sZrjAtKErHvccY.jpg`,
    relatedSlugs: [
      "how-smart-automation-reduces-friction-in-saas-products",
      "building-clarity-through-better-saas-dashboard-design",
      "turning-complex-workflows-into-simple-user-experiences",
    ],
    sections: [
      {
        heading: "Introduction",
        blocks: [
          {
            kind: "paragraph",
            text: "The first few minutes with your product decide whether users stay or leave. Yet many SaaS onboarding flows overwhelm users with too much information, too many steps, and unclear value.",
          },
          {
            kind: "paragraph",
            text: "Great onboarding doesn’t explain everything at once. It guides users toward their first moment of success.",
          },
        ],
      },
      {
        heading: "Why onboarding matters",
        blocks: [
          {
            kind: "paragraph",
            text: "Users don’t sign up to learn your product—they sign up to solve a problem. Effective onboarding shortens the time between signup and value, helping users feel progress immediately.",
          },
          { kind: "quote", text: "“When users succeed early, retention follows naturally.”" },
        ],
      },
      {
        heading: "Elements of effective onboarding",
        blocks: [
          {
            kind: "bullets",
            items: [
              "Clear first action: Guide users to one meaningful task instead of multiple options.",
              "Progressive disclosure: Reveal features gradually as users need them.",
              "Contextual tips: Explain features where they’re used, not in long tutorials.",
              "Feedback and reassurance: Confirm actions with subtle success states.",
            ],
          },
        ],
      },
      {
        heading: "Designing an onboarding flow",
        blocks: [
          {
            kind: "paragraph",
            text: "Start by identifying the core action that delivers value. Build the onboarding experience around that action, not around your entire feature set. Use short copy, visual cues, and gentle prompts to guide users forward.",
          },
        ],
      },
      {
        heading: "Tips for better onboarding",
        blocks: [
          {
            kind: "lines",
            items: [
              "Keep steps short and skippable.",
              "Avoid jargon and internal product language.",
              "Celebrate small wins.",
              "Design onboarding as part of the product—not a separate experience.",
            ],
          },
        ],
      },
      {
        heading: "Conclusion",
        blocks: [
          {
            kind: "paragraph",
            text: "Onboarding is not about teaching—it’s about enabling. When users feel capable and confident early, they’re far more likely to stay and grow with your product.",
          },
        ],
      },
    ],
  },
  {
    slug: "how-smart-automation-reduces-friction-in-saas-products",
    title: "How smart automation reduces friction in SaaS products",
    date: "Jan 8, 2026",
    description: "Automation should remove effort, not add complexity. Here’s how to get it right.",
    image: `${imageRoot}4IBtYxRoCSB0N2qT85UYlQxAdQ4.jpg`,
    relatedSlugs: [
      "designing-saas-onboarding-that-users-actually-finish",
      "building-clarity-through-better-saas-dashboard-design",
      "turning-complex-workflows-into-simple-user-experiences",
    ],
    sections: [
      {
        heading: "Introduction",
        blocks: [
          {
            kind: "paragraph",
            text: "Automation is often marketed as a productivity boost, but poorly designed automation can confuse users and reduce trust. The goal isn’t to automate everything—it’s to automate the right things.",
          },
        ],
      },
      {
        heading: "The value of smart automation",
        blocks: [
          {
            kind: "paragraph",
            text: "Good automation works quietly in the background. It handles repetitive tasks while keeping users informed and in control.",
          },
          { kind: "quote", text: "“Automation succeeds when users forget it’s there—but feel its impact.”" },
        ],
      },
      {
        heading: "Common automation mistakes",
        blocks: [
          {
            kind: "bullets",
            items: [
              "Over-automation without context.",
              "Lack of transparency about what’s happening.",
              "No easy way to adjust or undo actions.",
            ],
          },
        ],
      },
      {
        heading: "Where automation works best",
        blocks: [
          {
            kind: "bullets",
            items: [
              "Task assignments and status updates.",
              "Notifications and reminders.",
              "Data syncing across tools.",
              "Routine workflows with predictable steps.",
            ],
          },
        ],
      },
      {
        heading: "Designing automation users trust",
        blocks: [
          {
            kind: "paragraph",
            text: "Always show what will happen before automation runs. Provide clear controls to pause, edit, or disable workflows. Keep language human and outcomes predictable.",
          },
        ],
      },
      {
        heading: "Conclusion",
        blocks: [
          {
            kind: "paragraph",
            text: "Smart automation builds trust by saving time without removing control. When designed thoughtfully, it becomes one of your product’s strongest value drivers.",
          },
        ],
      },
    ],
  },
  {
    slug: "turning-complex-workflows-into-simple-user-experiences",
    title: "Turning complex workflows into simple user experiences",
    date: "Jan 4, 2026",
    description: "Turning complex workflows into simple user experiences",
    image: `${imageRoot}7p7wDv2by1pQNu8TGfI5luov9oA.jpg`,
    relatedSlugs: [
      "designing-saas-onboarding-that-users-actually-finish",
      "how-smart-automation-reduces-friction-in-saas-products",
      "building-clarity-through-better-saas-dashboard-design",
    ],
    sections: [
      {
        heading: "Introduction",
        blocks: [
          {
            kind: "paragraph",
            text: "Many SaaS products support powerful workflows, but power often comes at the cost of usability. Users struggle when interfaces expose too much complexity too early.",
          },
        ],
      },
      {
        heading: "Why simplicity matters",
        blocks: [
          {
            kind: "paragraph",
            text: "Simple interfaces reduce cognitive load, improve accuracy, and increase adoption. Complexity should exist in logic, not in the UI.",
          },
          { kind: "quote", text: "“Users should feel powerful, not confused.”" },
        ],
      },
      {
        heading: "Strategies for simplifying workflows",
        blocks: [
          {
            kind: "bullets",
            items: [
              "Break workflows into clear steps.",
              "Use defaults that work for most users.",
              "Hide advanced options until needed.",
              "Provide visual feedback at each stage.",
            ],
          },
        ],
      },
      {
        heading: "Visualizing workflow progress",
        blocks: [
          {
            kind: "paragraph",
            text: "Progress indicators, status labels, and summaries help users understand where they are and what comes next.",
          },
        ],
      },
      {
        heading: "Conclusion",
        blocks: [
          {
            kind: "paragraph",
            text: "The best workflow tools make complex processes feel effortless. When users focus on outcomes instead of steps, productivity follows.",
          },
        ],
      },
    ],
  },
  {
    slug: "using-microinteractions-to-improve-saas-usability",
    title: "Using microinteractions to improve SaaS usability",
    date: "Jan 2, 2026",
    description: "Small interactions can make a big difference in how users experience your product.",
    image: `${imageRoot}AEn7jDsb1wLFB6GdDRIuPfErY.jpg`,
    relatedSlugs: [
      "designing-saas-onboarding-that-users-actually-finish",
      "how-smart-automation-reduces-friction-in-saas-products",
      "building-clarity-through-better-saas-dashboard-design",
    ],
    sections: [
      {
        heading: "Introduction",
        blocks: [
          {
            kind: "paragraph",
            text: "Microinteractions are subtle animations or responses that guide users through actions. When done well, they make products feel intuitive and responsive.",
          },
        ],
      },
      {
        heading: "Why microinteractions matter",
        blocks: [
          {
            kind: "bullets",
            items: ["They provide instant feedback.", "They reduce uncertainty.", "They make interfaces feel alive."],
          },
          { kind: "quote", text: "“Good microinteractions don’t draw attention—they build confidence.”" },
        ],
      },
      {
        heading: "Common microinteractions in SaaS",
        blocks: [
          {
            kind: "bullets",
            items: [
              "Button hover states.",
              "Loading indicators.",
              "Success and error feedback.",
              "Status transitions.",
            ],
          },
        ],
      },
      {
        heading: "Designing meaningful microinteractions",
        blocks: [
          {
            kind: "paragraph",
            text: "Every interaction should have a purpose. Avoid unnecessary motion and keep animations fast and subtle.",
          },
        ],
      },
      {
        heading: "Conclusion",
        blocks: [
          {
            kind: "paragraph",
            text: "Microinteractions are the polish that turns good products into great ones. They help users feel understood at every step.",
          },
        ],
      },
    ],
  },
  {
    slug: "designing-saas-products-for-long-term-scalability",
    title: "Designing SaaS products for long-term scalability",
    date: "Jan 1, 2026",
    description: "Scalable design ensures your product grows without breaking the user experience.",
    image: `${imageRoot}2ThYpwF27RLSQS1QVTYoFJjBXz0.jpg`,
    relatedSlugs: [
      "designing-saas-onboarding-that-users-actually-finish",
      "how-smart-automation-reduces-friction-in-saas-products",
      "building-clarity-through-better-saas-dashboard-design",
    ],
    sections: [
      {
        heading: "Introduction",
        blocks: [
          {
            kind: "paragraph",
            text: "Many SaaS products work well at launch but struggle as features and users increase. Scalability starts with design decisions made early.",
          },
        ],
      },
      {
        heading: "What a scalable design looks like",
        blocks: [
          {
            kind: "bullets",
            items: [
              "Flexible layouts.",
              "Reusable components.",
              "Clear content hierarchy.",
              "Design systems that evolve.",
            ],
          },
          { kind: "quote", text: "“Scalability is about consistency, not rigidity.”" },
        ],
      },
      {
        heading: "Planning for growth",
        blocks: [
          {
            kind: "paragraph",
            text: "Design for future features without exposing them prematurely. Use patterns that can expand naturally as the product grows.",
          },
        ],
      },
      {
        heading: "Conclusion",
        blocks: [
          {
            kind: "paragraph",
            text: "A scalable design system saves time, reduces friction, and keeps your product consistent as it evolves.",
          },
        ],
      },
    ],
  },
  {
    slug: "how-storytelling-builds-trust-in-saas-brands",
    title: "How storytelling builds trust in SaaS brands",
    date: "Jan 1, 2026",
    description: "Strong storytelling helps users connect with your product beyond features.",
    image: `${imageRoot}b8AcyU1olsKer2BmUwOSNbsTZtk.jpg`,
    relatedSlugs: [
      "designing-saas-onboarding-that-users-actually-finish",
      "how-smart-automation-reduces-friction-in-saas-products",
      "building-clarity-through-better-saas-dashboard-design",
    ],
    sections: [
      {
        heading: "Introduction",
        blocks: [
          {
            kind: "paragraph",
            text: "Trust is essential in SaaS. Users share data, rely on workflows, and depend on your product daily. Storytelling humanizes your brand and builds confidence.",
          },
        ],
      },
      {
        heading: "Why storytelling works",
        blocks: [
          {
            kind: "bullets",
            items: [
              "Stories create emotional connection.",
              "They explain value through real outcomes.",
              "They make abstract features relatable.",
            ],
          },
          { kind: "quote", text: "“When users trust your story, they trust your product.”" },
        ],
      },
      {
        heading: "Where to use storytelling",
        blocks: [
          {
            kind: "bullets",
            items: ["Hero sections.Product pages.", "Case studies.", "Onboarding experiences."],
          },
        ],
      },
      {
        heading: "Conclusion",
        blocks: [
          {
            kind: "paragraph",
            text: "Storytelling isn’t decoration—it’s strategy. When your SaaS tells a clear, honest story, users feel confident choosing and staying with your product.",
          },
        ],
      },
    ],
  },
];

export function relatedPosts(currentSlug: string, count = 3) {
  const current = getBlogPost(currentSlug);
  const bySlug = new Map(blogPosts.map((post) => [post.slug, post]));
  return current.relatedSlugs
    .map((slug) => bySlug.get(slug))
    .filter((post): post is BlogPost => Boolean(post))
    .slice(0, count);
}

export function getBlogPost(slug: string): BlogPost {
  const post = blogPosts.find((candidate) => candidate.slug === slug);
  if (!post) throw new Error(`Unknown blog post: ${slug}`);
  return post;
}
