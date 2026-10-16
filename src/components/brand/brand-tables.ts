/** Static lists behind /brand: the Screens table, the Submission kit, the icon names and the component groups. */

export type ScreenRow = { name: string; route: string; shows: string; drawn?: boolean };
export const SCREENS: ScreenRow[] = [
  { name: "Landing", route: "/", shows: "Main explains the product: hero, try an act, guesswork, what you get back, beyond buskers, Thanks to (Qloo as sponsor, then built with), the Brain and Honeycomb teasers, closing call." },
  { name: "Busks: plan your busk", route: "/busks", shows: "The form for your own act" },
  { name: "Busks: plan again", route: "/busks?again=<id>", shows: "Pre-filled from an earlier busk, date and hours left" },
  { name: "Busks: a form error", route: "/busks", shows: "Each error names its field" },
  { name: "Plan: researching", route: "/plan", shows: "The research feed is the page" },
  { name: "Plan: busk ready", route: "/p/<id>", shows: "The busk first; on phones and tablets the research folds below it" },
  { name: "Plan: replay", route: "/p/<id>", shows: "A stored run reopened: \"Replay of an earlier run (no new model call)\"" },
  { name: "Plan: from the data alone", route: "/plan", shows: "The agent didn't finish: Busk Map's own plan" },
  { name: "Plan: limit reached", route: "/plan", shows: "\"Plan limit reached\": no new plan started" },
  { name: "Plan: Qloo unavailable", route: "/plan", shows: "\"Qloo is unavailable\"" },
  { name: "Plan: a source down", route: "/plan", shows: "The city's sensors didn't answer; the rest works" },
  { name: "Plan: no artist matched", route: "/plan", shows: "\"Qloo couldn't match …\"" },
  { name: "Plan: no legal pitch", route: "/plan", shows: "\"No pitch to recommend\"" },
  { name: "Plan: slot passed", route: "/p/<id>", shows: "\"This slot has passed\", above the stored busk or alone" },
  { name: "Plan: link not found", route: "/p/<id>", shows: "\"Plan not found\"" },
  { name: "The brain of Busk Map", route: "/brain", shows: "Every Qloo call and what it decides, with the trace" },
  { name: "Terms", route: "/terms", shows: "A plain page: the legal line moved out of the footer. \"Busk Map never confirms a pitch is legal: check your permit conditions.\"" },
  { name: "Privacy", route: "/privacy", shows: "A plain page: what stays in this browser, what the server keeps, and for how long" },
  { name: "Not found", route: "any unknown URL", shows: "\"No pitch here\"" },
  { name: "Route error", route: "error.tsx", shows: "\"Something went wrong\", with its reference" },
  { name: "Global error", route: "global-error.tsx", shows: "No layout and no brand fonts" },
  { name: "This deck", route: "/brand", shows: "Honeycomb, the brand and design deck" },
  { name: "Week planner", route: "/week", shows: "Your planned busks by day" },
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
  week: ["WeekGrid", "WeekDayCard", "SessionCard"],
  shell: ["Logo", "Icon", "HexCell", "PercentCell", "ScoreRing", "ScoreBlock", "RankTile", "Loader", "Skeleton", "Card", "EmptyState", "ErrorState", "PlanNotFound", "AppHeader", "MobileNav", "BrandHoneycomb"],
} as const;

export const COMPONENT_COUNT = Object.values(COMPONENT_GROUPS).reduce((n, g) => n + g.length, 0);
