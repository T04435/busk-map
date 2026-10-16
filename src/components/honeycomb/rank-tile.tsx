import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import { Hex } from "@/components/honeycomb/hex-cell";

const rankVariants = cva("relative inline-grid flex-none place-items-center font-display font-extrabold leading-none", {
  variants: {
    size: {
      sm: "h-[34px] w-[30px] text-[22px]",
      md: "h-[46px] w-10 text-[30px]",
      lg: "h-16 w-14 text-[44px]",
    },
    quiet: {
      // Orange cell with a 2px rule by day (none at night), numeral in primary-foreground.
      false: "text-primary-foreground [--hex-fill:var(--primary)] [--hex-stroke:var(--fill-rule)]",
      // Ranks past the top three: a rule outline with foreground numerals.
      true: "text-foreground [--hex-fill:transparent] [--hex-stroke:var(--rule)]",
    },
  },
  defaultVariants: { size: "md", quiet: false },
});

/** A numbered rank in an orange honeycomb cell: the poster's way of saying "play here first". Spoken as "Rank 1". */
export function RankTile({ n, size, quiet, className }: { n: number | string; className?: string } & VariantProps<typeof rankVariants>) {
  return (
    <span role="img" aria-label={`Rank ${n}`} data-slot="rank-tile" className={cn(rankVariants({ size, quiet: quiet ?? false }), className)}>
      <Hex />
      <span aria-hidden="true" className="relative top-px">
        {n}
      </span>
    </span>
  );
}
