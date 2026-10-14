import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { Plan, PlanPitch } from "@/lib/plan-schema";

export function SetlistPanel({ pitch, learnThese }: { pitch: PlanPitch; learnThese: Plan["learnThese"] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2>Setlist for {pitch.name}</h2>
        </CardTitle>
        <CardDescription>
          Your songs, ordered by how much this crowd likes each artist (Qloo) and how well-known the song is (Last.fm). Qloo has no
          song-level data, so a song inherits its artist&apos;s affinity. The set opens with the best-known of the top three and never plays
          the same artist twice in a row, so the order is not strictly by score.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 text-sm">
        {pitch.setlist.length === 0 ? (
          <p className="text-muted-foreground">Add songs you can play to get a setlist.</p>
        ) : (
          <ol className="space-y-2">
            {pitch.setlist.map((song, i) => (
              <li key={song.songId} className="grid grid-cols-[2ch_1fr_auto] gap-x-3">
                <span className="text-muted-foreground">{i + 1}</span>
                <span>
                  <span className="font-medium">{song.title}</span> <span className="text-muted-foreground">({song.artist})</span>
                  {song.own && (
                    <Badge variant="secondary" className="ml-2">
                      Your song
                    </Badge>
                  )}
                  <span className="block text-muted-foreground">{song.reason}</span>
                </span>
                <span aria-label={`Song score ${song.score} out of 100`}>{song.score}</span>
              </li>
            ))}
          </ol>
        )}

        <section aria-label="Learn these">
          <h3 className="font-medium">Learn these</h3>
          {learnThese.length === 0 ? (
            <p className="text-muted-foreground">No suggestions for this crowd yet.</p>
          ) : (
            <ul className="space-y-1">
              {learnThese.map((s) => (
                <li key={s.artist}>
                  <span className="font-medium">{s.title ?? "Any song"}</span> by {s.artist}
                  <span className="block text-muted-foreground">{s.reason}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </CardContent>
    </Card>
  );
}
