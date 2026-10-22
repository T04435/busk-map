/**
 * The Honeycomb brand data behind /brand: the words list, the tokens (day and night values, mapped to shadcn) and the
 * scale tables. From the design deck's Brand board (design system v62); the live values are in src/app/globals.css.
 */

export type Word = { t: string; b: string };
export type TokenRow = { name: string; kind: string; light: string; dark: string; lightSw: string; darkSw: string; use: string };
export type ScaleRow = { name: string; value: string; use: string };
export type KitRow = { name: string; size: string; where: string };

export const WORDS: Word[] = [
  {
    "t": "Pitch",
    "b": "One place to play: a spot on the street with a score. Never \"spot\" or \"location\" in the UI."
  },
  {
    "t": "Busk",
    "b": "The whole outing: your three pitches, their setlists and the reasons, at one link. \"Plan a busk\", \"Your busk\"."
  },
  {
    "t": "Act",
    "b": "Who is playing: a name, the artists they sound like and the songs they can play."
  },
  {
    "t": "Slot",
    "b": "The day and hours you will play: \"Sun 19 Oct · 12–3 pm\"."
  },
  {
    "t": "Setlist",
    "b": "The songs for one pitch, in order. \"Learn these\" are songs the crowd likes that you don’t play yet."
  },
  {
    "t": "Hidden gem / Usual pitch",
    "b": "A strong taste fit off the usual busking circuit, or a well-known hotspot. Never a warning."
  },
  {
    "t": "The usual crowd",
    "b": "Everyone near a busking hotspot, with no taste signal: what your fans are compared with."
  },
  {
    "t": "The research",
    "b": "What the Hive checked to build the busk. Plain results, never tool names."
  },
  {
    "t": "The engine",
    "b": "Busk Map’s scoring: plain code, no AI. The Hive can only pick among pitches it scored."
  },
  {
    "t": "Honeycomb",
    "b": "The brand and design system. The product is always Busk Map."
  }
];

export const TOKENS: TokenRow[] = [
  {
    "name": "background",
    "kind": "shadcn",
    "light": "#f2eee6",
    "dark": "#0f1416",
    "lightSw": "#f2eee6",
    "darkSw": "#0f1416",
    "use": "Page ground (shadcn --background). Light: warm poster paper; dark: bluestone at night. Every text token is checked on it."
  },
  {
    "name": "foreground",
    "kind": "shadcn",
    "light": "#141c21",
    "dark": "#f2ede4",
    "lightSw": "#141c21",
    "darkSw": "#f2ede4",
    "use": "Text, icons and the 2px poster rules (shadcn --foreground). On background, card, popover, secondary, muted and accent: 13:1 or more in both themes."
  },
  {
    "name": "card",
    "kind": "shadcn",
    "light": "#fbf9f5",
    "dark": "#182025",
    "lightSw": "#fbf9f5",
    "darkSw": "#182025",
    "use": "Panels: PitchCard, the plan list, sheets (shadcn --card). Always framed by a 2px `rule`."
  },
  {
    "name": "card-foreground",
    "kind": "shadcn",
    "light": "#141c21 (foreground)",
    "dark": "#f2ede4 (foreground)",
    "lightSw": "#141c21",
    "darkSw": "#f2ede4",
    "use": "Text on card. Alias of foreground."
  },
  {
    "name": "popover",
    "kind": "shadcn",
    "light": "#ffffff",
    "dark": "#1d262c",
    "lightSw": "#ffffff",
    "darkSw": "#1d262c",
    "use": "Tooltips' inverse, menus, dialogs, toasts (shadcn --popover)."
  },
  {
    "name": "popover-foreground",
    "kind": "shadcn",
    "light": "#141c21 (foreground)",
    "dark": "#f2ede4 (foreground)",
    "lightSw": "#141c21",
    "darkSw": "#f2ede4",
    "use": "Text on popover. Alias of foreground."
  },
  {
    "name": "primary",
    "kind": "shadcn",
    "light": "#ff5a1f",
    "dark": "#ff6a2b",
    "lightSw": "#ff5a1f",
    "darkSw": "#ff6a2b",
    "use": "Signal orange (shadcn --primary): the one main action, rank tiles, the score block, the active nav item. A FILL, never text: 2.7:1 on paper, so by day every orange box also carries a 2px `rule` border."
  },
  {
    "name": "primary-foreground",
    "kind": "shadcn",
    "light": "#141c21",
    "dark": "#0f1416",
    "lightSw": "#141c21",
    "darkSw": "#0f1416",
    "use": "Labels and icons on a primary fill (shadcn --primary-foreground): bluestone on orange, 5.5:1 by day and 6.5:1 at night."
  },
  {
    "name": "secondary",
    "kind": "shadcn",
    "light": "#e6e0d4",
    "dark": "#232d33",
    "lightSw": "#e6e0d4",
    "darkSw": "#232d33",
    "use": "Quiet fills: secondary buttons at rest, the segmented track, chips' hover (shadcn --secondary)."
  },
  {
    "name": "secondary-foreground",
    "kind": "shadcn",
    "light": "#141c21 (foreground)",
    "dark": "#f2ede4 (foreground)",
    "lightSw": "#141c21",
    "darkSw": "#f2ede4",
    "use": "Text on secondary. Alias of foreground."
  },
  {
    "name": "muted",
    "kind": "shadcn",
    "light": "#e9e4da",
    "dark": "#1f282d",
    "lightSw": "#e9e4da",
    "darkSw": "#1f282d",
    "use": "Skeletons, bar tracks, the disabled field, table stripes (shadcn --muted)."
  },
  {
    "name": "muted-foreground",
    "kind": "shadcn",
    "light": "#56606a",
    "dark": "#a7b0b5",
    "lightSw": "#56606a",
    "darkSw": "#a7b0b5",
    "use": "Mono uppercase metadata, captions, helper text, source lines. 4.5:1 or more on background, card, popover, secondary and muted in both themes."
  },
  {
    "name": "accent",
    "kind": "shadcn",
    "light": "#ffe2d1",
    "dark": "#3a2519",
    "lightSw": "#ffe2d1",
    "darkSw": "#3a2519",
    "use": "Selected and hover fills: the selected time slot, list-row hover, `mark` highlights (shadcn --accent). A pale signal tint by day, a burnt one at night."
  },
  {
    "name": "accent-foreground",
    "kind": "shadcn",
    "light": "#141c21",
    "dark": "#ffc7a6",
    "lightSw": "#141c21",
    "darkSw": "#ffc7a6",
    "use": "Text on accent (shadcn --accent-foreground)."
  },
  {
    "name": "destructive",
    "kind": "shadcn",
    "light": "#b0152f",
    "dark": "#ff8a8a",
    "lightSw": "#b0152f",
    "darkSw": "#ff8a8a",
    "use": "Delete actions, error text and icons (shadcn --destructive). Crimson, a step away from signal orange; always with a word or icon."
  },
  {
    "name": "destructive-foreground",
    "kind": "shadcn",
    "light": "#ffffff",
    "dark": "#0f1416",
    "lightSw": "#ffffff",
    "darkSw": "#0f1416",
    "use": "Label on a destructive fill (shadcn --destructive-foreground)."
  },
  {
    "name": "border",
    "kind": "shadcn",
    "light": "#cfc7b8",
    "dark": "#2e3a41",
    "lightSw": "#cfc7b8",
    "darkSw": "#2e3a41",
    "use": "Hairlines inside panels: row dividers, table rules (shadcn --border). Decorative only. Panel frames use `rule`."
  },
  {
    "name": "input",
    "kind": "shadcn",
    "light": "#7a7266",
    "dark": "#76828a",
    "lightSw": "#7a7266",
    "darkSw": "#76828a",
    "use": "Borders of fields, selects, checkboxes and switches at rest (shadcn --input). 3:1 or more on background and card."
  },
  {
    "name": "ring",
    "kind": "shadcn",
    "light": "#141c21",
    "dark": "#ff6a2b",
    "lightSw": "#141c21",
    "darkSw": "#ff6a2b",
    "use": "Keyboard focus (shadcn --ring): one ring. Buttons get a 2px outline in `ring` with a 2px offset; fields turn their border to `ring` plus one ring. Never a second ring, and never a ground gap plus a ring. Bluestone by day, signal orange at night; 3:1 or more on every surface."
  },
  {
    "name": "chart-1",
    "kind": "shadcn",
    "light": "#dd6322 (taste-4)",
    "dark": "#ff7a2e (taste-4)",
    "lightSw": "#dd6322",
    "darkSw": "#ff7a2e",
    "use": "Score factor 1, taste match (shadcn --chart-1). Alias of taste-4 so the chart and the hex map agree."
  },
  {
    "name": "chart-2",
    "kind": "shadcn",
    "light": "#7a4d00",
    "dark": "#f0b73d",
    "lightSw": "#7a4d00",
    "darkSw": "#f0b73d",
    "use": "Score factor 2, the activity estimate (shadcn --chart-2). Same hue as footfall."
  },
  {
    "name": "chart-3",
    "kind": "shadcn",
    "light": "#2f5fbf",
    "dark": "#8fb0ff",
    "lightSw": "#2f5fbf",
    "darkSw": "#8fb0ff",
    "use": "Score factor 3, busy places open (shadcn --chart-3)."
  },
  {
    "name": "chart-4",
    "kind": "shadcn",
    "light": "#a8164f",
    "dark": "#ff7fb2",
    "lightSw": "#a8164f",
    "darkSw": "#ff7fb2",
    "use": "Score factor 4, crowd leaving an event (shadcn --chart-4)."
  },
  {
    "name": "chart-5",
    "kind": "shadcn",
    "light": "#4f6577",
    "dark": "#9db4c6",
    "lightSw": "#4f6577",
    "darkSw": "#9db4c6",
    "use": "Score factor 5, weather (shadcn --chart-5). Same hue as weather."
  },
  {
    "name": "bluestone",
    "kind": "Honeycomb",
    "light": "#141c21",
    "dark": "#141c21",
    "lightSw": "#141c21",
    "darkSw": "#141c21",
    "use": "Brand constant: the ink. Header bar, pin pucks, the app icon, the dialog scrim (at 60%). Same in both themes."
  },
  {
    "name": "honey",
    "kind": "Honeycomb",
    "light": "#ffcf3a",
    "dark": "#ffcf3a",
    "lightSw": "#ffcf3a",
    "darkSw": "#ffcf3a",
    "use": "Brand constant: hidden-gem diamonds and the gem badge fill (with bluestone text, 11.7:1). Never text on paper."
  },
  {
    "name": "honey-deep",
    "kind": "Honeycomb",
    "light": "#d99a00",
    "dark": "#d99a00",
    "lightSw": "#d99a00",
    "darkSw": "#d99a00",
    "use": "Brand constant: the honey dot of the mark wherever it sits on paper without its tile."
  },
  {
    "name": "qloo",
    "kind": "Honeycomb",
    "light": "#5b5ba3",
    "dark": "#8C8CC8",
    "lightSw": "#5b5ba3",
    "darkSw": "#8C8CC8",
    "use": "Qloo, our partner: the Qloo wordmark's bar, the Brain page's calls and wires, and Qloo facts. Text-safe in both themes (5.2:1 on the day ground, 5.9:1 on the night ground). Never a Busk Map action colour."
  },
  {
    "name": "qloo-brand",
    "kind": "Honeycomb",
    "light": "#8C8CC8",
    "dark": "#8C8CC8",
    "lightSw": "#8C8CC8",
    "darkSw": "#8C8CC8",
    "use": "Qloo's own logo purple, exactly. Only inside the Qloo wordmark and on night grounds; on paper it is 2.7:1, so never as text there."
  },
  {
    "name": "signal-text",
    "kind": "Honeycomb",
    "light": "#b13a00",
    "dark": "#ff7f45",
    "lightSw": "#b13a00",
    "darkSw": "#ff7f45",
    "use": "Signal orange as text: the hero's last line, orange links, 'WHAT TO PLAY.'. 5.2:1 or more on background and card in both themes."
  },
  {
    "name": "zone-pink",
    "kind": "Honeycomb",
    "light": "#e0337a",
    "dark": "#ff5c9d",
    "lightSw": "#e0337a",
    "darkSw": "#ff5c9d",
    "use": "No-busking and unamplified zones: the map hatch and its outline, the restricted pin. A fill and hatch colour only."
  },
  {
    "name": "rule",
    "kind": "Honeycomb",
    "light": "#141c21 (foreground)",
    "dark": "#f2ede4 (foreground)",
    "lightSw": "#141c21",
    "darkSw": "#f2ede4",
    "use": "The 2px poster rule that frames cards, dialogs, rank tiles and the score block. Alias of foreground."
  },
  {
    "name": "taste-1",
    "kind": "Honeycomb",
    "light": "#fbe3d2",
    "dark": "#33221a",
    "lightSw": "#fbe3d2",
    "darkSw": "#33221a",
    "use": "Taste affinity step 1 of 5 (weakest). Hex map cells and legend. Text on it: bluestone (light) or paper (dark)."
  },
  {
    "name": "taste-2",
    "kind": "Honeycomb",
    "light": "#f9b98e",
    "dark": "#6a3215",
    "lightSw": "#f9b98e",
    "darkSw": "#6a3215",
    "use": "Taste affinity step 2 of 5. Hex cells and legend. Text on it: bluestone (light) or paper (dark)."
  },
  {
    "name": "taste-3",
    "kind": "Honeycomb",
    "light": "#f28644",
    "dark": "#db5e1e",
    "lightSw": "#f28644",
    "darkSw": "#db5e1e",
    "use": "Taste affinity step 3 of 5. Hex cells and legend. Text on it: bluestone (light) or paper (dark)."
  },
  {
    "name": "taste-4",
    "kind": "Honeycomb",
    "light": "#dd6322",
    "dark": "#ff7a2e",
    "lightSw": "#dd6322",
    "darkSw": "#ff7a2e",
    "use": "Taste affinity step 4 of 5. Hex cells, the taste bar in ScoreBreakdown. Text on it: bluestone in both themes."
  },
  {
    "name": "taste-5",
    "kind": "Honeycomb",
    "light": "#7f2d0c",
    "dark": "#ffc595",
    "lightSw": "#7f2d0c",
    "darkSw": "#ffc595",
    "use": "Taste affinity step 5 of 5 (strongest). Affinity reads as contrast with the ground: darkest burnt orange by day, palest at night. Text on it: paper (light) or bluestone (dark)."
  },
  {
    "name": "footfall",
    "kind": "Honeycomb",
    "light": "#7a4d00",
    "dark": "#f0b73d",
    "lightSw": "#7a4d00",
    "darkSw": "#f0b73d",
    "use": "Activity-by-hour sparkline, the slot's activity word and its icon. As text, on background and card."
  },
  {
    "name": "pitch-legal",
    "kind": "Honeycomb",
    "light": "#1f5fae",
    "dark": "#86b4ff",
    "lightSw": "#1f5fae",
    "darkSw": "#86b4ff",
    "use": "Legal pitch: the 'Permit pitch' badge text and outline. Blue, never green against the pink zones."
  },
  {
    "name": "pitch-restricted",
    "kind": "Honeycomb",
    "light": "#a8164f",
    "dark": "#ff7fb2",
    "lightSw": "#a8164f",
    "darkSw": "#ff7fb2",
    "use": "No-busking and unamplified as text: the 'Restricted' badge and cautions. Pairs with the `zone-pink` hatch and a slash icon."
  },
  {
    "name": "hidden-gem",
    "kind": "Honeycomb",
    "light": "#7a5a00",
    "dark": "#ffcf3a",
    "lightSw": "#7a5a00",
    "darkSw": "#ffcf3a",
    "use": "Hidden gem as text or outline on paper and card (a dark gold by day). The badge itself is a `honey` fill with bluestone text; the pin is a yellow diamond."
  },
  {
    "name": "usual-spot",
    "kind": "Honeycomb",
    "light": "#56606a",
    "dark": "#a7b0b5",
    "lightSw": "#56606a",
    "darkSw": "#a7b0b5",
    "use": "Usual spot: the well-known hotspot tag and small dot pins. Deliberately quiet."
  },
  {
    "name": "event",
    "kind": "Honeycomb",
    "light": "#256489",
    "dark": "#7cc0e6",
    "lightSw": "#256489",
    "darkSw": "#7cc0e6",
    "use": "A nearby event: the steel-blue diamond on the map, the ticket icon, badge text, the week-grid event flag."
  },
  {
    "name": "weather",
    "kind": "Honeycomb",
    "light": "#4f6577",
    "dark": "#9db4c6",
    "lightSw": "#4f6577",
    "darkSw": "#9db4c6",
    "use": "Weather strip text and icons, the rain flag in the week grid."
  },
  {
    "name": "estimate",
    "kind": "Honeycomb",
    "light": "#6d5a00",
    "dark": "#e6cf6b",
    "lightSw": "#6d5a00",
    "darkSw": "#e6cf6b",
    "use": "The EstimateLabel and the dotted underline under estimated numbers. Pairs with the word 'est.'."
  }
];

export const SPACE: ScaleRow[] = [
  {
    "name": "space-1",
    "value": "4px",
    "use": "Icon to label; badge padding block."
  },
  {
    "name": "space-2",
    "value": "8px",
    "use": "Inside chips and badges; gap between chips."
  },
  {
    "name": "space-3",
    "value": "12px",
    "use": "Between rows in a list; control padding inline."
  },
  {
    "name": "space-4",
    "value": "16px",
    "use": "Mobile page gutter; card padding on mobile."
  },
  {
    "name": "space-5",
    "value": "20px",
    "use": "Between a card heading and its body."
  },
  {
    "name": "space-6",
    "value": "24px",
    "use": "Card padding on desktop; between sections in a card."
  },
  {
    "name": "space-8",
    "value": "32px",
    "use": "Between cards and panels."
  },
  {
    "name": "space-12",
    "value": "48px",
    "use": "Between page sections on desktop."
  },
  {
    "name": "space-16",
    "value": "64px",
    "use": "Landing section rhythm."
  }
];

export const SIZES: ScaleRow[] = [
  {
    "name": "size-tap",
    "value": "48px",
    "use": "Minimum touch target on mobile: buttons, nav items, pins' hit area."
  },
  {
    "name": "size-control",
    "value": "44px",
    "use": "Height of buttons, inputs and selects (default size)."
  },
  {
    "name": "size-control-sm",
    "value": "36px",
    "use": "Compact buttons inside cards on desktop; never the only action on mobile."
  },
  {
    "name": "size-pin",
    "value": "40px",
    "use": "Top-three pitch pin diameter."
  },
  {
    "name": "size-nav",
    "value": "64px",
    "use": "Mobile bottom nav bar height (plus the safe-area inset)."
  }
];

export const RADII: ScaleRow[] = [
  {
    "name": "radius-sm",
    "value": "0px",
    "use": "Badges, chips, cells, tooltips: square."
  },
  {
    "name": "radius",
    "value": "0px",
    "use": "The shadcn --radius base: buttons, inputs, selects, tabs. Square."
  },
  {
    "name": "radius-lg",
    "value": "0px",
    "use": "Cards, dialogs, sheets: square, framed by a 2px `rule`."
  },
  {
    "name": "radius-xl",
    "value": "0px",
    "use": "The hero panel and the app icon tile: square."
  },
  {
    "name": "radius-full",
    "value": "9999px",
    "use": "Only the pitch ring, pin pucks, the score ring and status dots."
  }
];

export const STROKES: ScaleRow[] = [
  {
    "name": "stroke-hair",
    "value": "1px",
    "use": "Row dividers inside a panel, in `border`."
  },
  {
    "name": "stroke-rule",
    "value": "2px",
    "use": "Panel frames, rank tiles, the score block, orange fills by day, in `rule`."
  },
  {
    "name": "stroke-heavy",
    "value": "4px",
    "use": "The signal-orange underline under the header, the active tab, the score block's top edge, setlist score bars."
  }
];

export const SHADOWS: ScaleRow[] = [
  {
    "name": "shadow-sm",
    "value": "2px 2px 0 #141c21",
    "use": "Pins and the map legend over the map."
  },
  {
    "name": "shadow-md",
    "value": "4px 4px 0 #141c21",
    "use": "The floating PitchCard over the map, toasts, tooltips."
  },
  {
    "name": "shadow-lg",
    "value": "6px 6px 0 #141c21",
    "use": "Dialogs and sheets."
  },
  {
    "name": "focus-ring",
    "value": "2px solid ring",
    "use": "Keyboard focus: one ring, from each shadcn component's own focus-visible style. Buttons get a 2px outline in `ring` with a 2px offset; fields turn their border to `ring` plus one ring. Never a second ring, and never a ground gap plus a ring."
  }
];

export const DURATIONS: ScaleRow[] = [
  {
    "name": "duration-fast",
    "value": "120ms",
    "use": "Hover, press, chip toggle."
  },
  {
    "name": "duration-base",
    "value": "200ms",
    "use": "Tabs, tooltips, the pin selecting."
  },
  {
    "name": "duration-slow",
    "value": "320ms",
    "use": "Sheets and dialogs entering; the score ring filling."
  }
];

export const EASINGS: ScaleRow[] = [
  {
    "name": "ease-out",
    "value": "cubic-bezier(0.2, 0.8, 0.2, 1)",
    "use": "Things arriving: sheets, toasts, pins."
  },
  {
    "name": "ease-in",
    "value": "cubic-bezier(0.4, 0, 1, 1)",
    "use": "Things leaving."
  }
];

