import { Badge } from "@/components/ui/badge";
import { appVersion, envTag, type AppVersion } from "@/lib/version";

/**
 * The running version (learnings/2026-10-23-app-version-in-footer.md): the shared Badge in its default (primary) variant, mono, one
 * colour for everything. `v1.0.2 @ 3f1addd`, then ` · preview · <branch>` or ` · local` (+ ` · dirty`) off production.
 * The tag links to its release and the hash to its commit; links inherit the colour and underline on hover.
 */
export function VersionBadge({ version = appVersion, className }: { version?: AppVersion; className?: string }) {
  const env = envTag(version);
  const rest = env === "production" ? [] : env === "preview" ? ["preview", version.branch] : ["local", ...(version.dirty ? ["dirty"] : [])];
  return (
    <Badge variant="default" data-slot="version-badge" data-env={env} className={`gap-0 whitespace-pre-wrap normal-case tracking-normal ${className ?? ""}`.trim()}>
      <a className="hover:underline" href={version.releaseUrl}>
        v{version.version}
      </a>
      <span> @ </span>
      <a className="hover:underline" href={version.commitUrl}>
        {version.shortSha}
      </a>
      {rest.filter(Boolean).map((part) => (
        <span key={part}> · {part}</span>
      ))}
    </Badge>
  );
}
