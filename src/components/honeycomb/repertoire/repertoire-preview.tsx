"use client";

import { useState } from "react";
import { RepertoireEmpty } from "@/components/honeycomb/repertoire/repertoire-empty";
import { RepertoireProfile } from "@/components/honeycomb/repertoire/repertoire-profile";
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
  SAMPLE_RESULTS,
  SAMPLE_RESULTS_RUNNING,
  SAMPLE_STEPS_DONE,
  SAMPLE_STEPS_RUNNING,
  SAMPLE_TOTALS_DONE,
  SAMPLE_TOTALS_RUNNING,
} from "@/components/honeycomb/repertoire/sample-data";
import type { RepertoireResults } from "@/components/honeycomb/repertoire/types";

export type PreviewState = "empty" | "running" | "done";

function results({ r, loading }: { r: RepertoireResults; loading: boolean }) {
  return {
    profile: <RepertoireProfile profile={r.profile} summary={r.summary} loading={loading && !r.profile} onRefresh={() => {}} onEditLink={() => {}} />,
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
 * honeycomb/repertoire components with sample data, for the user's review before DEV wires the real stream. Not linked.
 */
export function RepertoirePreview({ state }: { state: PreviewState }) {
  const [folded, setFolded] = useState(true);
  if (state === "empty") return <RepertoireEmpty value="" onChange={() => {}} onSubmit={() => {}} />;
  if (state === "running") {
    const s = results({ r: SAMPLE_RESULTS_RUNNING, loading: true });
    // While it runs, the research leads; the results fill in under it as each step lands.
    return (
      <div className="flex flex-col gap-12">
        <RepertoireResearch steps={SAMPLE_STEPS_RUNNING} totals={SAMPLE_TOTALS_RUNNING} phase="running" seconds={12} />
        <RepertoireResultsLayout {...s} />
      </div>
    );
  }
  const s = results({ r: SAMPLE_RESULTS, loading: false });
  return (
    <RepertoireResultsLayout
      {...s}
      research={
        <RepertoireResearch steps={SAMPLE_STEPS_DONE} totals={SAMPLE_TOTALS_DONE} phase="done" seconds={41} folded={folded} onToggleFold={() => setFolded((f) => !f)} />
      }
    />
  );
}
