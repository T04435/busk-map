import type { ComponentType } from "react";
import {
  ArrowRight, Calendar, CalendarDays, Check, ChevronDown, ChevronRight, Clock, Cloud, CloudRain, Coins, Copy, Ellipsis, ExternalLink, Footprints, Gem,
  GraduationCap, House, Info, List, LoaderCircle, Map as MapIcon, MapPin, Music, Play, Plus, RefreshCw, Scale, Share2, Store, Ticket, Trash2, TrainFront,
  TrendingUp, TriangleAlert, Users, Volume2, VolumeX, WifiOff, Wind, X,
} from "lucide-react";
import { ICONS } from "@/components/brand/brand-tables";

const MAP: Record<(typeof ICONS)[number], ComponentType<{ className?: string; "aria-hidden"?: boolean }>> = {
  pin: MapPin, calendar: Calendar, clock: Clock, music: Music, footfall: Footprints, rain: CloudRain, cloud: Cloud, wind: Wind, ticket: Ticket, legal: Scale,
  gem: Gem, warning: TriangleAlert, check: Check, x: X, info: Info, "chevron-down": ChevronDown, "chevron-right": ChevronRight, "arrow-right": ArrowRight,
  plus: Plus, share: Share2, copy: Copy, coins: Coins, map: MapIcon, list: List, offline: WifiOff, trending: TrendingUp, volume: Volume2, "volume-off": VolumeX,
  external: ExternalLink, home: House, week: CalendarDays, trash: Trash2, loader: LoaderCircle, learn: GraduationCap, store: Store, train: TrainFront,
  dots: Ellipsis, refresh: RefreshCw, users: Users, play: Play,
};

/** The icon set as tiles: 24px grid, 2px stroke, with each icon's name. */
export function IconGrid() {
  return (
    <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-2 p-0">
      {ICONS.map((name) => {
        const Icon = MAP[name];
        return (
          <li key={name} className="flex flex-col items-center gap-2 border-2 border-rule bg-card px-1 py-3">
            <Icon aria-hidden className="size-6" />
            <span className="font-mono text-[11px] leading-4 break-all">{name}</span>
          </li>
        );
      })}
    </ul>
  );
}
