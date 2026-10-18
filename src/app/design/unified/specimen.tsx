"use client";

import type { ReactNode } from "react";
import { ArtistChip, ArtistChipList } from "@/components/honeycomb/artist-chip";
import { ArtistProfile } from "@/components/honeycomb/artist-profile";
import { InfoTag } from "@/components/honeycomb/info-tag";
import type { Mention, RichText } from "@/lib/mention";
import { Mention as MentionView } from "@/components/honeycomb/mention";
import { SourceLogo } from "@/components/honeycomb/source-logo";
import { StepCell, type StepCellStatus } from "@/components/honeycomb/step-cell";
import { REPERTOIRE_STEPS } from "@/components/honeycomb/repertoire/repertoire-research";
import { HexCell } from "@/components/honeycomb/hex-cell";
import { Reason } from "@/components/honeycomb/reason";
import { ScoreCell } from "@/components/honeycomb/score-cell";
import { SongActions } from "@/components/honeycomb/song-actions";
import { SongRow } from "@/components/honeycomb/song-row";
import { SongTag, type SongTagKind } from "@/components/honeycomb/song-tag";
import { SAMPLE_RESULTS } from "@/components/honeycomb/repertoire/sample-data";

const noop = () => {};
const art = (name: string, score?: number): Mention => ({ kind: "artist", name, score });
const becauseText: RichText = ["Fans of ", art("Angus & Julia Stone"), " and ", art("The Paper Kites"), " love this."];
const wolfine: RichText = ["Fans of ", art("Wolfine"), " and ", art("Residente"), " love this, and ", art("Residente"), " is the closest match to the act's socially conscious crowd, so it's a safe opener."];
const LONG = "Mumford & Sons and the Very Long Named Touring Orchestra of the Southern Laneways";

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-6 border-t-2 border-rule pt-6">
      <h2 className="m-0 font-display text-3xl leading-none font-extrabold uppercase">{title}</h2>
      {children}
    </section>
  );
}

/** One case: a mono label naming the case and what it replaces, then the unified component(s). */
function Case({ id, replaces, children }: { id: string; replaces: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="m-0 font-mono text-xs leading-4 font-bold tracking-[0.04em] text-muted-foreground [overflow-wrap:anywhere]">
        {id} <span className="font-medium">replaces {replaces}</span>
      </p>
      <div className="border border-border bg-card px-3">{children}</div>
    </div>
  );
}

const list = "m-0 list-none divide-y divide-border p-0";

export function UnifiedSpecimen() {
  const tagKinds: SongTagKind[] = ["your-song", "new", "typed", "suggested", "learned", "by-your-artist", "added"];
  return (
    <div className="flex flex-col gap-12">
      <Group title="Songs: SongRow">
        <div className="grid gap-6 lg:grid-cols-2">
          <Case id="S1" replaces="LearnSongCard (learn feed)">
            <ul className={list}>
              <SongRow
                title="Big Jet Plane"
                artist="Angus & Julia Stone"
                year={2010}
                durationMs={239000}
                href="https://open.spotify.com/track/sample"
                tags={<SongTag kind="new" />}
                reason={<Reason text={becauseText} />}
                actions={<SongActions title="Big Jet Plane" artist="Angus & Julia Stone" learnIt onLearned={noop} onDismiss={noop} />}
              />
            </ul>
          </Case>
          <Case id="S2" replaces="research-view can-sing row">
            <ul className={list}>
              <SongRow title="Southbank in the Rain" artist="Hana Lee" year={2024} album="Laneways" durationMs={214000} own actions={<SongActions title="Southbank in the Rain" onRemove={noop} />} />
              <SongRow title="Riptide" artist="Vance Joy" year={2013} durationMs={204000} actions={<SongActions title="Riptide" onRemove={noop} />} />
            </ul>
          </Case>
          <Case id="S3" replaces="research-view learned row">
            <ul className={list}>
              <SongRow title="Bloom" artist="The Paper Kites" year={2010} durationMs={214000} tags={<SongTag kind="learned" />} actions={<SongActions title="Bloom" onUndo={noop} />} />
            </ul>
          </Case>
          <Case id="S4" replaces="PickedSongs (typed and suggested)">
            <ul className={list}>
              <SongRow size="sm" title="Scar" artist="Missy Higgins" tags={<SongTag kind="typed" />} actions={<SongActions size="sm" title="Scar" onRemove={noop} />} />
              <SongRow size="sm" title="Holocene" artist="Bon Iver" tags={<SongTag kind="suggested" />} actions={<SongActions size="sm" title="Holocene" onAdd={noop} onRemove={noop} />} />
            </ul>
          </Case>
          <Case id="S5" replaces="SongSearch result item (inside a combobox option)">
            <ul role="listbox" aria-label="Song search results" className={list}>
              <li role="option" aria-selected={false} className="py-0.5">
                <SongRow as="div" interactive={false} size="sm" title="Riptide" artist="Vance Joy" year={2013} durationMs={204000} />
              </li>
              <li role="option" aria-selected className="py-0.5">
                <SongRow as="div" interactive={false} size="sm" title="Big Jet Plane" artist="Angus & Julia Stone" tags={<SongTag kind="added" />} />
              </li>
            </ul>
          </Case>
          <Case id="S6" replaces="SetlistPanel set rows (position, fit, why)">
            <ul className={list}>
              <SongRow
                index={1}
                title="Paper Lanterns"
                artist="Hana Lee"
                durationMs={187000}
                own
                score={87}
                scoreLabel="Fit"
                info={<InfoTag icon="trending">Rising +12</InfoTag>}
                actions={<SongActions title="Paper Lanterns" onRemove={noop} />}
              />
              <SongRow index={2} title="Riptide" artist="Vance Joy" durationMs={204000} score={74} scoreLabel="Fit" info={<InfoTag icon="users">Usual crowd too</InfoTag>} />
            </ul>
          </Case>
          <Case id="S7" replaces="SetlistPanel learn-these rows">
            <ul className={list}>
              <SongRow
                title="Skinny Love"
                artist="Bon Iver"
                tags={<SongTag kind="by-your-artist" />}
                reason={<Reason text="Your crowd at this spot sings along to it." />}
                actions={<SongActions title="Skinny Love" artist="Bon Iver" learnIt onMoveToCanSing={noop} onDismiss={noop} />}
              />
            </ul>
          </Case>
          <Case id="S8" replaces="plan and landing set preview">
            <ul className={list}>
              <SongRow index={1} title="Southbank in the Rain" artist="Hana Lee" durationMs={214000} own />
              <SongRow index={2} title="Scar" artist="Missy Higgins" durationMs={214000} />
              <SongRow index={3} title="Bloom" artist="The Paper Kites" durationMs={214000} />
            </ul>
          </Case>
          <Case id="S9" replaces="build_setlist tool-card rows">
            <ul className={list}>
              <SongRow compact index={1} title="Southbank in the Rain" artist="Hana Lee" durationMs={214000} score={91} scoreLabel="Fit" />
              <SongRow compact index={2} title="Riptide" artist="Vance Joy" durationMs={204000} score={78} scoreLabel="Fit" />
            </ul>
          </Case>
          <Case id="S10" replaces="learn_these tool-card rows">
            <ul className={list}>
              <SongRow compact title="Skinny Love" artist="Bon Iver" tags={<SongTag kind="suggested" />} reason={<Reason text="Close to what you already play." />} />
            </ul>
          </Case>
          <Case id="S11" replaces="LearnItMenu header">
            <div className="py-3">
              <SongRow as="div" interactive={false} size="sm" title="Skinny Love" artist="Bon Iver" className="py-0" />
            </div>
          </Case>
          <Case id="S12" replaces="dismissed learn row (muted, with undo)">
            <ul className={list}>
              <SongRow muted title="Fast Car" artist="Tracy Chapman" year={1988} actions={<SongActions title="Fast Car" onUndo={noop} />} />
            </ul>
          </Case>
          <Case id="S13" replaces="long names, source and info tags">
            <ul className={list}>
              <SongRow
                title="A Very Long Song Title That Has To Wrap Instead Of Being Cut Off Anywhere"
                artist={LONG}
                info={
                  <>
                    <InfoTag source="spotify" />
                    <InfoTag source="lastfm" />
                    <InfoTag source="qloo" />
                    <InfoTag>Builds on Angus & Julia Stone</InfoTag>
                  </>
                }
                actions={<SongActions title="A Very Long Song Title" onRemove={noop} />}
              />
            </ul>
          </Case>
        </div>
      </Group>

      <Group title="User feedback U01-U09">
        <div className="grid gap-6 lg:grid-cols-2">
          <Case id="U01 U02" replaces="boxed chips, rule-coloured hexes">
            <div className="flex flex-col gap-3 py-3">
              <ArtistChip name="Wolfine" state="picked" onRemove={noop} href="https://open.spotify.com/artist/x" />
              <ArtistChip name="Residente" state="suggested" onAdd={noop} />
              <ArtistChip name="Rxnde Akozta" state="added" />
              <ArtistChipList inline>
                <li><ArtistChip size="xs" name="Wolfine" /></li>
                <li><ArtistChip size="xs" name="Residente" state="suggested" /></li>
              </ArtistChipList>
              <div className="flex flex-wrap items-center gap-3">
                <HexCell size={44}>A</HexCell>
                <HexCell size={44} tone="media">B</HexCell>
                <HexCell size={44} tone="primary">C</HexCell>
                <HexCell size={44} tone="muted">D</HexCell>
                <HexCell size={44} tone="dashed">E</HexCell>
                <HexCell size={44} tone="error">F</HexCell>
                <ScoreCell value={72} size="md" label="Fit" />
              </div>
            </div>
          </Case>
          <Case id="U03 U04" replaces="song cover and artist text: cover image / artist photo / icon, artist as a hex with the name in a tooltip">
            <ul className={list}>
              <SongRow title="With cover" artist="Residente" image="/brand/favicon/favicon-32.png" year={2017} />
              <SongRow title="Artist photo as fallback" artist="Wolfine" artistImage="/brand/favicon/favicon-32.png" year={2021} album="Album" />
              <SongRow title="Icon fallback" artist="Rxnde Akozta" />
              <SongRow title="Two artists, and a source" artists={[{ name: "Wolfine" }, { name: "Residente" }]} artist="Wolfine, Residente" source="spotify" href="https://open.spotify.com/track/x" />
            </ul>
          </Case>
          <Case id="U05 U06 U08" replaces="Reason with a chip row; inline mentions in a sentence">
            <div className="flex flex-col gap-3 py-3">
              <Reason text={wolfine} />
              <p className="m-0 text-sm leading-6 text-muted-foreground">
                You sound like <MentionView mention={{ kind: "artist", name: "Residente", href: "https://open.spotify.com/artist/x" }} />,{" "}
                <MentionView mention={art("Rxnde Akozta")} /> and <MentionView mention={art("Wolfine", 31)} />. Read{" "}
                <MentionView mention={{ kind: "song", title: "Bzrp Session 53" }} /> on <MentionView mention={{ kind: "source", source: "spotify" }} />, found on{" "}
                <MentionView mention={{ kind: "source", source: "qloo" }} /> and <MentionView mention={{ kind: "source", source: "lastfm" }} />.
              </p>
            </div>
          </Case>
          <Case id="U07" replaces="text source tags">
            <div className="flex flex-wrap items-center gap-4 py-3">
              <SourceLogo source="spotify" />
              <SourceLogo source="lastfm" />
              <SourceLogo source="qloo" />
              <InfoTag source="spotify" />
            </div>
          </Case>
        </div>
        <div className="flex flex-col gap-4">
          <h3 className="m-0 font-mono text-xs font-bold text-muted-foreground">U09 StepCell: each of the nine icons, in done / running / pending / failed / skipped</h3>
          {(["done", "running", "pending", "failed", "skipped"] as StepCellStatus[]).map((st) => (
            <ul key={st} className="m-0 flex list-none flex-wrap gap-3 p-0">
              {REPERTOIRE_STEPS.map((s, i) => (
                <li key={s.key} className="flex flex-col items-center gap-1 font-mono text-[10px] text-muted-foreground">
                  <StepCell status={st} icon={s.icon} n={i + 1} />
                  {st} {s.key}
                </li>
              ))}
            </ul>
          ))}
        </div>
      </Group>

      <Group title="Artists: ArtistChip">
        <div className="grid gap-6 lg:grid-cols-2">
          <Case id="A1" replaces="ArtistPicker picked row">
            <div className="py-3">
              <ArtistChip name="Angus & Julia Stone" source="qloo" tags={["indie folk"]} state="picked" onRemove={noop} />
            </div>
          </Case>
          <Case id="A2" replaces="SoundsLikeSuggestions (add)">
            <div className="py-3">
              <ArtistChip name="Boy & Bear" source="qloo" tags={["indie folk"]} state="suggested" onAdd={noop} />
            </div>
          </Case>
          <Case id="A3" replaces="ArtistPicker search results (inside a combobox option)">
            <ul role="listbox" aria-label="Artist search results" className="m-0 flex list-none flex-col gap-2 p-0 py-3">
              <li role="option" aria-selected={false}>
                <ArtistChip interactive={false} name="Missy Higgins" source="spotify" state="suggested" />
              </li>
              <li role="option" aria-selected>
                <ArtistChip interactive={false} name="Vance Joy" source="spotify" state="added" />
              </li>
            </ul>
          </Case>
          <Case id="A4" replaces="plain name Chips (typed)">
            <div className="py-3">
              <ArtistChip name="Hollow Coves" source="typed" state="picked" onRemove={noop} />
            </div>
          </Case>
          <Case id="A5" replaces="Because cells">
            <div className="py-3">
              <Reason text={becauseText} />
              <Reason
                className="mt-3"
                text={["Because your fans like ", art("Gillian Welch", 31), ", ", art("The Teskey Brothers", 22)]}
              />
            </div>
          </Case>
          <Case id="A6" replaces="CrowdPanel row">
            <div className="py-3">
              <ArtistChip name="Julia Jacklin" score={<ScoreCell value={82} size="sm" label="Affinity" />} info={<InfoTag tone="qloo">Crowd by Qloo</InfoTag>} />
            </div>
          </Case>
          <Case id="A9" replaces="local-scene row">
            <div className="py-3">
              <ArtistChip name="The Paper Kites" tags={["dream pop"]} info={<InfoTag icon="pin">Plays Southbank</InfoTag>} />
            </div>
          </Case>
          <Case id="A10" replaces="crowd_at tool-card rows">
            <div className="flex flex-col gap-2 py-3">
              <ArtistChip name="Missy Higgins" score={<ScoreCell value={74} size="sm" label="Affinity" />} info={<InfoTag>Crowd at Southbank</InfoTag>} />
              <ArtistChip name="Boy & Bear" score={<ScoreCell value={61} size="sm" label="Affinity" />} info={<InfoTag>Crowd at Federation Square</InfoTag>} />
            </div>
          </Case>
          <Case id="A11" replaces="event taste-match line">
            <div className="py-3">
              <ArtistChip name="Hollow Coves" score={<ScoreCell value={88} size="sm" caption="Taste match" />} />
            </div>
          </Case>
          <Case id="A12" replaces="example-act card sounds-like text">
            <div className="py-3">
              <p className="m-0 mb-1.5 text-sm font-bold">Sounds like</p>
              <ArtistChipList inline>
                <li><ArtistChip size="xs" name="Angus & Julia Stone" /></li>
                <li><ArtistChip size="xs" name="The Paper Kites" /></li>
                <li><ArtistChip size="xs" name="Missy Higgins" /></li>
              </ArtistChipList>
            </div>
          </Case>
          <Case id="A13" replaces="plain-text 'Sounds like a, b, c' lists">
            <div className="py-3">
              <ArtistChipList inline>
                <li><ArtistChip size="xs" name="Vance Joy" /></li>
                <li><ArtistChip size="xs" name={LONG} /></li>
              </ArtistChipList>
            </div>
          </Case>
          <Case id="A14" replaces="featured artist (lg)">
            <div className="py-3">
              <ArtistChip size="lg" name="Hana Lee" source="spotify" tags={["indie folk", "acoustic pop"]} />
            </div>
          </Case>
          <Case id="A15" replaces="a long name that wraps">
            <div className="py-3">
              <ArtistChip name={LONG} state="picked" onRemove={noop} />
            </div>
          </Case>
        </div>
        <ArtistChipList>
          <li><ArtistChip name="Angus & Julia Stone" state="picked" onRemove={noop} /></li>
          <li><ArtistChip name="Boy & Bear" state="suggested" onAdd={noop} /></li>
        </ArtistChipList>
      </Group>

      <Group title="The act: ArtistProfile">
        <div className="flex flex-col gap-8">
          <Case id="A7" replaces="ProfileHeader (inline block, md)">
            <div className="py-4">
              <ArtistProfile size="md" maxGenres={3} profile={SAMPLE_RESULTS.profile} onRefresh={noop} />
            </div>
          </Case>
          <Case id="A8" replaces="RepertoireProfile (page header, lg)">
            <div className="py-4">
              <ArtistProfile profile={SAMPLE_RESULTS.profile} summary={SAMPLE_RESULTS.summary} onRefresh={noop} onEditLink={noop} />
            </div>
          </Case>
          <Case id="A7b" replaces="profile loading, and 'load profile' with no snapshot">
            <div className="flex flex-col gap-6 py-4">
              <ArtistProfile profile={null} loading />
              <ArtistProfile profile={null} onLoad={noop} />
            </div>
          </Case>
        </div>
      </Group>

      <Group title="The extras, once each">
        <div className="grid gap-6 lg:grid-cols-2">
          <Case id="SongTag" replaces="mono tag, Badge secondary, Badge solid, 'New this run'">
            <ul className="m-0 flex list-none flex-wrap gap-2 p-0 py-3">
              {tagKinds.map((k) => (
                <li key={k}><SongTag kind={k} /></li>
              ))}
            </ul>
          </Case>
          <Case id="InfoTag" replaces="outline Badges, mono labels (neutral, qloo, signal)">
            <div className="flex flex-wrap gap-2 py-3">
              <InfoTag icon="trending" tone="signal">Rising +12</InfoTag>
              <InfoTag icon="usual">Usual crowd too</InfoTag>
              <InfoTag source="spotify" />
              <InfoTag source="lastfm" />
              <InfoTag source="qloo" />
              <InfoTag>Builds on Angus & Julia Stone</InfoTag>
              <InfoTag icon="pin">Crowd at Federation Square</InfoTag>
            </div>
          </Case>
          <Case id="ScoreCell" replaces="the old percent cell at 34 and 36 px, inline text">
            <div className="flex flex-wrap items-center gap-4 py-3">
              <ScoreCell value={87} size="sm" label="Fit" />
              <ScoreCell value={87} size="md" label="Fit" />
              <ScoreCell value={87} size="md" tone="primary" label="Fit" />
              <ScoreCell value={null} size="md" label="Affinity" />
              <ScoreCell value={72} size="sm" caption="Taste match" />
            </div>
          </Case>
          <Case id="Reason" replaces="WithCells, evidence-line, 'because' line">
            <div className="flex flex-col gap-4 py-3">
              <Reason text="Your crowd at this spot sings along to it." />
              <Reason text={["Fits this slot, because fans of ", art("Boy & Bear"), " love it."]} />
            </div>
          </Case>
          <Case id="SongActions md" replaces="text Buttons, ghost icons, 'Add'/'Added' labels (44px)">
            <div className="flex flex-col gap-2 py-3">
              <SongActions title="Riptide" artist="Vance Joy" learnIt onLearned={noop} onDismiss={noop} onUndo={noop} onMoveToCanSing={noop} onAdd={noop} onRemove={noop} />
              <SongActions title="Riptide" added />
            </div>
          </Case>
          <Case id="SongActions sm" replaces="dense rows (36px)">
            <div className="py-3">
              <SongActions size="sm" title="Riptide" artist="Vance Joy" learnIt onLearned={noop} onDismiss={noop} onUndo={noop} onMoveToCanSing={noop} onAdd={noop} onRemove={noop} />
            </div>
          </Case>
        </div>
      </Group>
    </div>
  );
}
