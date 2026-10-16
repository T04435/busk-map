import { ICON_NAMES, Icon } from "@/components/honeycomb/icon";

/** The icon set as tiles, drawn by the real DS Icon: 24-unit grid, 2px stroke, round caps and joins, with each icon's name. */
export function IconGrid() {
  return (
    <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-2 p-0" data-testid="icon-grid">
      {ICON_NAMES.map((name) => (
        <li key={name} className="flex flex-col items-center gap-2 border-2 border-rule bg-card px-1 py-3">
          <Icon name={name} size={24} />
          <span className="font-mono text-[11px] leading-4 break-all">{name}</span>
        </li>
      ))}
    </ul>
  );
}
