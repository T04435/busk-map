"use client";

import { useState, type ReactNode } from "react";
import { HiveSpecimen } from "@/components/honeycomb/repertoire/hive-specimen";
import { RepertoireEmpty } from "@/components/honeycomb/repertoire/repertoire-empty";
import { FansMap } from "@/components/honeycomb/repertoire/fans-map";
import { ActSummary, ArtistProfile, AudienceTags } from "@/components/honeycomb/artist-profile";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RepertoireResearch } from "@/components/honeycomb/repertoire/repertoire-research";
import {
  CanSingSection,
  FansLoveSection,
  FansSection,
  LearnedSection,
  RepertoireResultsLayout,
  Section,
  SoundsLikeSection,
  ToLearnSection,
} from "@/components/honeycomb/repertoire/repertoire-sections";
import {
  SAMPLE_FANS_CELLS,
  SAMPLE_FANS_CITIES,
  SAMPLE_RESULTS,
  SAMPLE_RESULTS_RUNNING,
  SAMPLE_STEPS_DONE,
  SAMPLE_STEPS_RUNNING,
  SAMPLE_TOTALS_DONE,
  SAMPLE_TOTALS_RUNNING,
} from "@/components/honeycomb/repertoire/sample-data";
import type { RepertoireResults } from "@/components/honeycomb/repertoire/types";

export type PreviewState = "empty" | "running" | "done" | "hive";

function results({ r, loading, fansMap }: { r: RepertoireResults; loading: boolean; fansMap: ReactNode }) {
  return {
    fansMap,
    profile: <ArtistProfile profile={r.profile} summary={false} audience={false} loading={loading && !r.profile} onRefresh={() => {}} onEditLink={() => {}} />,
    actName: r.profile ? (
      <div className="flex max-w-md flex-col gap-1.5">
        <Label htmlFor="act-name">Act name</Label>
        <Input id="act-name" defaultValue={r.profile.name} maxLength={80} />
      </div>
    ) : null,
    audience: <AudienceTags profile={r.profile} />,
    fans: <FansSection fans={r.fans} loading={loading && !r.fans} />,
    soundsLike: <SoundsLikeSection artists={r.soundsLike} onRemove={() => {}} onAddSearch={() => {}} loading={loading && !r.soundsLike} />,
    fansLove: <FansLoveSection artists={r.fansLove} onAdd={() => {}} loading={loading && !r.fansLove} />,
    canSingFilter: r.canSing ? (
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="can-sing-filter">Filter your songs</Label>
        <Input id="can-sing-filter" type="search" placeholder="Title or artist" />
      </div>
    ) : null,
    canSing: <CanSingSection songs={r.canSing} onRemove={() => {}} onAddSong={() => {}} loading={loading && !r.canSing} />,
    toLearn: (
      <ToLearnSection songs={r.toLearn} onLearned={() => {}} onDismiss={() => {}} onUndo={() => {}} onFindMore={() => {}} runsLeft={2} loading={loading && !r.toLearn} />
    ),
    learned: <LearnedSection songs={r.learned} loading={loading && !r.learned} />,
    summary: (
      <Section title="Your act, in a paragraph">
        <ActSummary summary={r.summary} loading={loading && !r.summary} />
      </Section>
    ),
  };
}

/**
 * The design preview of the Repertoire research flow (BRAND, 17 Oct): the empty, running and done states drawn from the
 * honeycomb/repertoire components with sample data (plus `hive`, the agent persona specimen), for the user's review before DEV wires the real stream. Not linked.
 */
export function RepertoirePreview({ state }: { state: PreviewState }) {
  const [folded, setFolded] = useState(true);
  const map = (loading: boolean) => <FansMap cells={loading ? null : SAMPLE_FANS_CELLS} cities={SAMPLE_FANS_CITIES} />;
  if (state === "hive") return <HiveSpecimen />;
  if (state === "empty") return <RepertoireEmpty value="" onChange={() => {}} onSubmit={() => {}} />;
  if (state === "running") {
    const s = results({ r: SAMPLE_RESULTS_RUNNING, loading: true, fansMap: map(true) });
    // While it runs, the research leads; the results fill in under it as each step lands.
    return (
      <RepertoireResultsLayout
        phase="running"
        {...s}
        research={<RepertoireResearch steps={SAMPLE_STEPS_RUNNING} totals={SAMPLE_TOTALS_RUNNING} phase="running" seconds={12} />}
      />
    );
  }
  const s = results({ r: SAMPLE_RESULTS, loading: false, fansMap: map(false) });
  return (
    <RepertoireResultsLayout
      phase="done"
      {...s}
      research={
        <RepertoireResearch steps={SAMPLE_STEPS_DONE} totals={SAMPLE_TOTALS_DONE} phase="done" seconds={41} folded={folded} onToggleFold={() => setFolded((f) => !f)} />
      }
    />
  );
}
