"use client";

import { useState, type ReactNode } from "react";
import { HiveSpecimen } from "@/components/honeycomb/repertoire/hive-specimen";
import { RepertoireEmpty } from "@/components/honeycomb/repertoire/repertoire-empty";
import { FansMap } from "@/components/honeycomb/repertoire/fans-map";
import { ArtistProfile } from "@/components/honeycomb/artist-profile";
import { RepertoireResearch } from "@/components/honeycomb/repertoire/repertoire-research";
import {
  CanSingSection,
  FansSection,
  LearnedSection,
  RepertoireResultsLayout,
  SoundsLikeSection,
  ToLearnSection,
} from "@/components/honeycomb/repertoire/repertoire-sections";
import {
  SAMPLE_FANS_AREAS,
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
    profile: <ArtistProfile profile={r.profile} summary={r.summary} loading={loading && !r.profile} onRefresh={() => {}} onEditLink={() => {}} />,
    fans: <FansSection fans={r.fans} loading={loading && !r.fans} />,
    soundsLike: <SoundsLikeSection artists={r.soundsLike} suggestions={r.fansLove ?? undefined} onAdd={() => {}} onRemove={() => {}} onAddSearch={() => {}} loading={loading && !r.soundsLike} />,
    canSing: <CanSingSection songs={r.canSing} onRemove={() => {}} onAddSong={() => {}} loading={loading && !r.canSing} />,
    toLearn: (
      <ToLearnSection songs={r.toLearn} onLearned={() => {}} onDismiss={() => {}} onUndo={() => {}} onFindMore={() => {}} runsLeft={2} loading={loading && !r.toLearn} />
    ),
    learned: <LearnedSection songs={r.learned} loading={loading && !r.learned} />,
  };
}

/**
 * The design preview of the Repertoire research flow (BRAND, 17 Oct): the empty, running and done states drawn from the
 * honeycomb/repertoire components with sample data (plus `hive`, the agent persona specimen), for the user's review before DEV wires the real stream. Not linked.
 */
export function RepertoirePreview({ state }: { state: PreviewState }) {
  const [folded, setFolded] = useState(true);
  const [cityId, setCityId] = useState("melbourne");
  const city = SAMPLE_FANS_CITIES.find((c) => c.id === cityId) ?? SAMPLE_FANS_CITIES[0];
  // Only Melbourne has sample heat; the other cities show the empty state.
  const melbourne = city.id === "melbourne";
  const map = (loading: boolean) => (
    <FansMap
      city={city}
      cities={SAMPLE_FANS_CITIES}
      onCityChange={setCityId}
      cells={loading ? null : melbourne ? SAMPLE_FANS_CELLS : []}
      topAreas={melbourne ? SAMPLE_FANS_AREAS : []}
      planHref="/busks"
    />
  );
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
