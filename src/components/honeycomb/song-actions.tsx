import { IconAction } from "@/components/honeycomb/icon-action";
import { LearnItMenu } from "@/components/songs/learn-it-menu";

/**
 * THE song action set. Each action shows only when its callback is given, always in this order: Learn it, Learned, Not for
 * me, Undo, Move to can sing, Add (or Added), Remove. Built from IconAction, so every one is an icon with its name as the
 * accessible name and tooltip. Put it in a SongRow's `actions` slot.
 */
export function SongActions({
  title,
  artist,
  size = "md",
  learnIt,
  onLearned,
  onDismiss,
  onUndo,
  onMoveToCanSing,
  onAdd,
  added,
  onRemove,
  disabled,
}: {
  /** Names the song in every label ("Learned: Riptide"). */
  title: string;
  /** Needed for Learn it, whose links search by title and artist. */
  artist?: string;
  /** md = 44px targets, sm = 36px in dense lists. */
  size?: "md" | "sm";
  /** Shows the Learn it menu (needs `artist`). */
  learnIt?: boolean;
  onLearned?: () => void;
  /** "Not for me". */
  onDismiss?: () => void;
  onUndo?: () => void;
  onMoveToCanSing?: () => void;
  onAdd?: () => void;
  /** The Add action in its done state: a disabled check named "Added". */
  added?: boolean;
  onRemove?: () => void;
  /** A run is busy: every action stays visible but can't be pressed (Learn it only opens links, so it stays live). */
  disabled?: boolean;
}) {
  const count = [learnIt && artist, onLearned, onDismiss, onUndo, onMoveToCanSing, added || onAdd, onRemove].filter(Boolean).length;
  return (
    <div data-slot="song-actions" data-many={count > 2 ? "" : undefined} className="flex flex-none flex-wrap items-center gap-1">
      {learnIt && artist ? <LearnItMenu title={title} artist={artist} iconOnly size={size} /> : null}
      {onLearned ? <IconAction icon="check" variant="outline" size={size} label={`Learned: ${title}`} onClick={onLearned} disabled={disabled} /> : null}
      {onDismiss ? <IconAction icon="x" size={size} label={`Not for me: ${title}`} onClick={onDismiss} disabled={disabled} /> : null}
      {onUndo ? <IconAction icon="arrow-left" size={size} label={`Undo: ${title}`} onClick={onUndo} disabled={disabled} /> : null}
      {onMoveToCanSing ? <IconAction icon="arrow-right" size={size} label={`Move to can sing: ${title}`} onClick={onMoveToCanSing} disabled={disabled} /> : null}
      {added ? (
        <IconAction icon="check" size={size} label={`Added: ${title}`} disabled pressed />
      ) : onAdd ? (
        <IconAction icon="plus" variant="outline" size={size} label={`Add ${title}`} onClick={onAdd} disabled={disabled} />
      ) : null}
      {onRemove ? <IconAction icon="x" size={size} label={`Remove ${title}`} onClick={onRemove} disabled={disabled} /> : null}
    </div>
  );
}
