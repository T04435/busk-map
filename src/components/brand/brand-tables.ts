/** Static lists behind /brand: the Screens table, the Submission kit, the icon names and the component groups. */

export type ScreenRow = { name: string; route: string; shows: string; /** Drawn in the deck at 390, 768 and 1440; false until it is. Default true. */ drawn?: boolean };
export const SCREENS: ScreenRow[] = [
  { name: "Landing", route: "/", shows: "Main explains the product: hero, try an act, guesswork, what you get back, beyond buskers, Thanks to (Qloo as sponsor, then built with), the Brain and Honeycomb teasers, closing call." },
  { name: "Busks: plan your busk", route: "/busks", shows: "The form for your own act" },
  { name: "Repertoire", route: "/repertoire", shows: "Your songs: search, pick and suggested fill", drawn: true },
  { name: "Busks: plan again", route: "/busks?again=<id>", shows: "Pre-filled from an earlier busk, date and hours left" },
  { name: "Busks: a form error", route: "/busks", shows: "Each error names its field" },
  { name: "Plan: researching", route: "/plan", shows: "The research feed is the page" },
  { name: "Plan: busk ready", route: "/p/<id>", shows: "The busk first; on phones and tablets the research folds below it" },
  { name: "Plan: replay", route: "/p/<id>", shows: "A stored run reopened: \"Replay of an earlier run (no new model call)\"" },
  { name: "Plan: from the data alone", route: "/plan", shows: "The agent didn't finish: Busk Map's own plan" },
  { name: "Plan: limit reached", route: "/plan", shows: "\"Plan limit reached\": no new plan started" },
  { name: "Plan: Qloo unavailable", route: "/plan", shows: "\"Qloo is unavailable\"" },
  { name: "Plan: a source down", route: "/plan", shows: "A source didn't answer (Ticketmaster); the rest works" },
  { name: "Plan: no artist matched", route: "/plan", shows: "\"Qloo couldn't match …\"" },
  { name: "Plan: no legal pitch", route: "/plan", shows: "\"No pitch to recommend\"" },
  { name: "Plan: slot passed", route: "/p/<id>", shows: "\"This slot has passed\", above the stored busk or alone" },
  { name: "Plan: link not found", route: "/p/<id>", shows: "\"Plan not found\"" },
  { name: "The brain of Busk Map", route: "/brain", shows: "Every Qloo call and what it decides, with the trace" },
  { name: "Terms", route: "/terms", shows: "A plain page: the legal line moved out of the footer. \"Busk Map never confirms a pitch is legal: check your permit conditions.\"", drawn: false },
  { name: "Privacy", route: "/privacy", shows: "A plain page: what stays in this browser, what the server keeps, and for how long", drawn: false },
  { name: "Not found", route: "any unknown URL", shows: "\"No pitch here\"" },
  { name: "Route error", route: "error.tsx", shows: "\"Something went wrong\", with its reference" },
  { name: "Global error", route: "global-error.tsx", shows: "No layout and no brand fonts" },
  { name: "This deck", route: "/brand", shows: "Honeycomb, the brand and design deck" },
];

export type KitRow = { name: string; size: string; file: string; src: string };
export const KIT: KitRow[] = [
  { name: "GitHub social preview", size: "1280 × 640", file: "github-social-preview-1280x640.png", src: "/brand/kit/github-social-preview-1280x640.png" },
  { name: "README hero", size: "1600 × 640", file: "readme-hero-1600x640.png", src: "/brand/kit/readme-hero-1600x640.png" },
  { name: "Screenshot, desktop (1440)", size: "1500 × 1000", file: "screenshot-desktop-1500x1000.png", src: "/brand/kit/screenshot-desktop-1500x1000.png" },
  { name: "Screenshot, phone (390)", size: "1500 × 1000", file: "screenshot-phone-1500x1000.png", src: "/brand/kit/screenshot-phone-1500x1000.png" },
  { name: "Video title card", size: "1920 × 1080", file: "video-title-1920x1080.png", src: "/brand/kit/video-title-1920x1080.png" },
  { name: "Video end card", size: "1920 × 1080", file: "video-end-1920x1080.png", src: "/brand/kit/video-end-1920x1080.png" },
  { name: "Video lower third", size: "1920 × 1080", file: "video-lower-third-1920x1080.png", src: "/brand/kit/video-lower-third-1920x1080.png" },
  { name: "Devpost thumbnail", size: "512 × 512", file: "devpost-thumbnail-512.png", src: "/brand/social/devpost-thumbnail-512.png" },
];

export const ICONS = [
  "pin", "calendar", "clock", "music", "footfall", "rain", "cloud", "wind", "ticket", "legal", "gem", "warning", "check", "x", "info",
  "chevron-down", "chevron-right", "arrow-right", "plus", "share", "copy", "coins", "map", "list", "offline", "trending", "volume", "volume-off",
  "external", "home", "week", "trash", "loader", "learn", "store", "train", "dots", "refresh", "users", "play",
] as const;

/** The design system's components, grouped by where they live in the app. The count on the page is summed from these. */
export const COMPONENT_GROUPS = {
  controls: ["Button", "Input", "Select", "Switch", "Checkbox", "Tabs", "Chip", "DatePicker"],
  feedback: ["Badge", "Alert", "Banner", "Toast", "Tooltip", "Dialog", "Sheet", "DataStatusBadge", "EstimateLabel", "SourceAttribution", "UnmatchedAlert"],
  plan: ["CityPicker", "TimeSlotPicker", "PerformerPicker", "PermitPicker", "RepertoirePicker", "ArtistPicker", "SongSearch", "PickedSongs", "LearnItMenu"],
  map: ["TasteMap", "TasteMapLegend", "PitchPin", "MapPlaceholder", "PlanMap"],
  busk: ["PitchRow", "PitchCard", "DiscoveryBadge", "BothAgreeBadge", "ScoreBreakdown", "WeightsPanel", "CrowdPanel", "MeterBar", "LeanBar", "EvidenceLine", "SetlistPanel", "WeatherStrip", "FootfallSparkline", "CopyLinkButton", "SlotPassed"],
  research: ["ResearchFunnel", "AgentStepStream", "AgentVsEngine", "StepData", "ComparePanel"],
  shell: ["Logo", "Icon", "HexCell", "ScoreCell", "ScoreRing", "ScoreBlock", "RankTile", "Loader", "Skeleton", "Card", "EmptyState", "ErrorState", "PlanNotFound", "AppHeader", "MobileNav", "BrandHoneycomb"],
} as const;

export const COMPONENT_COUNT = Object.values(COMPONENT_GROUPS).reduce((n, g) => n + g.length, 0);

export type Asset = { name: string; src: string; alt: string; w: number; h: number; dark?: boolean; note?: string };
/** The files in public/brand that /brand shows under Assets, by group. */
export const ASSET_GROUPS: { name: string; min: string; files: Asset[] }[] = [
  {
    name: "Logos",
    min: "260px",
    files: [
      { name: "busk-map-lockup-light.svg", src: "/brand/busk-map-lockup-light.svg", alt: "Busk Map logo for light grounds", w: 256, h: 48 },
      { name: "busk-map-lockup-dark.svg", src: "/brand/busk-map-lockup-dark.svg", alt: "Busk Map logo for dark grounds", w: 256, h: 48, dark: true },
    ],
  },
  {
    name: "Other brand files (not logos)",
    min: "220px",
    files: [
      { name: "busk-map-mark-light.svg", src: "/brand/busk-map-mark-light.svg", alt: "Hex mark for light grounds, a file for the icon set only", w: 64, h: 64, note: "Mark only: the icon files are cut from it. Not a logo." },
      { name: "busk-map-mark-dark.svg", src: "/brand/busk-map-mark-dark.svg", alt: "Hex mark for dark grounds, a file for the icon set only", w: 64, h: 64, dark: true, note: "Mark only: the icon files are cut from it. Not a logo." },
      { name: "busk-map-wordmark-light.svg", src: "/brand/busk-map-wordmark-light.svg", alt: "Wordmark for light grounds, a file for the lockup only", w: 241, h: 39, note: "The lockup's lettering on its own. Not a logo." },
      { name: "busk-map-wordmark-dark.svg", src: "/brand/busk-map-wordmark-dark.svg", alt: "Wordmark for dark grounds, a file for the lockup only", w: 241, h: 39, dark: true, note: "The lockup's lettering on its own. Not a logo." },
    ],
  },
  {
    name: "Favicon and app icons",
    min: "180px",
    files: [
      { name: "favicon.svg", src: "/brand/favicon/favicon.svg", alt: "Favicon", w: 48, h: 48 },
      { name: "favicon-32.png", src: "/brand/favicon/favicon-32.png", alt: "Favicon, 32 pixels", w: 32, h: 32 },
      { name: "apple-touch-icon-180.png", src: "/brand/favicon/apple-touch-icon-180.png", alt: "Apple touch icon", w: 96, h: 96 },
      { name: "app-icon-512.png", src: "/brand/favicon/app-icon-512.png", alt: "App icon, 512 pixels", w: 96, h: 96 },
    ],
  },
  {
    name: "Social and Devpost",
    min: "320px",
    files: [
      { name: "og-image-1200x630.png", src: "/brand/social/og-image-1200x630.png", alt: "Open Graph image", w: 1200, h: 630 },
      { name: "devpost-cover-1200x800.png", src: "/brand/social/devpost-cover-1200x800.png", alt: "Devpost cover", w: 1200, h: 800 },
      { name: "devpost-thumbnail-512.png", src: "/brand/social/devpost-thumbnail-512.png", alt: "Devpost thumbnail", w: 512, h: 512 },
      { name: "social-banner-1500x500.png", src: "/brand/social/social-banner-1500x500.png", alt: "Social banner", w: 1500, h: 500 },
    ],
  },
  {
    name: "GitHub and README",
    min: "320px",
    files: [
      { name: "github-social-preview-1280x640.png", src: "/brand/kit/github-social-preview-1280x640.png", alt: "GitHub social preview", w: 1280, h: 640 },
      { name: "readme-hero-1600x640.png", src: "/brand/kit/readme-hero-1600x640.png", alt: "README hero", w: 1600, h: 640 },
    ],
  },
  {
    name: "Video kit",
    min: "320px",
    files: [
      { name: "video-title-1920x1080.png", src: "/brand/kit/video-title-1920x1080.png", alt: "Video title card", w: 1920, h: 1080 },
      { name: "video-end-1920x1080.png", src: "/brand/kit/video-end-1920x1080.png", alt: "Video end card", w: 1920, h: 1080 },
      { name: "video-lower-third-1920x1080.png", src: "/brand/kit/video-lower-third-1920x1080.png", alt: "Video lower third", w: 1920, h: 1080 },
    ],
  },
  {
    name: "Screenshots",
    min: "320px",
    files: [
      { name: "screenshot-desktop-1500x1000.png", src: "/brand/kit/screenshot-desktop-1500x1000.png", alt: "Desktop screenshot", w: 1500, h: 1000 },
      { name: "screenshot-phone-1500x1000.png", src: "/brand/kit/screenshot-phone-1500x1000.png", alt: "Phone screenshot", w: 1500, h: 1000 },
    ],
  },
];

/** How many brand files /brand offers (each counted once). The landing teaser shows this number too. */
export const ASSET_COUNT = new Set(ASSET_GROUPS.flatMap((g) => g.files.map((f) => f.src))).size;
