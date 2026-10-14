export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-24">
      <div className="max-w-xl space-y-6">
        <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Qloo Agentic Hackathon · in progress
        </p>
        <h1 className="text-4xl font-semibold tracking-tight">Busk Map</h1>
        <p className="text-lg text-muted-foreground">
          Know where to play, and what to play there. Busk Map finds the street pitches whose
          crowd matches your music, at the hour you want to play, and builds a setlist for each one.
        </p>
        <p className="text-sm text-muted-foreground">
          Built on Qloo&apos;s taste data, with Melbourne&apos;s live pedestrian counts and legal busking pitches.
          The full app is coming before 30 October 2026.
        </p>
      </div>
    </main>
  );
}
