# Chase HUD (T018)

`mountChaseHud(root, adapter)` consumes the existing `UiAdapter` and returns an
idempotent disposer. Mounting again on the same root disposes its old HUD. The root
owns positioning/height; this module owns only its appended `aside`, subscription,
media listener and debounced status announcement. It never dispatches gameplay,
attaches key handlers, moves focus, advances time or changes camera/player state.
Keep the existing T007 input controller and the T010 camera independently owned.

The HUD shows accepted phase/time, clamped stamina, player-relative robber cues,
turn versus lane change, contextual action readiness, status and essential
feedback. Text accompanies color. Unknown cues remain unavailable. An expired
timer stays at zero awaiting the server; it does not locally end a chase. There
is no bearing/stamina animation in either motion setting. OS reduced motion and
`settings.reducedEffects` are both exposed as `data-reduced-motion` for composition.
Timer, stamina and bearing updates are silent to screen readers; essential state
and message-ID changes update a polite live region after a 400 ms debounce.

## Live composition boundary for T020

T014 continues to emit `actions: null` and `robber: null`. This task adds an optional
final argument to `network/view.ts:createView`, using the existing `LegalActions`
and `AuthoritativeSnapshot` types:

```ts
const view = createView(snapshot, localId, connection, error, settings, messages,
  tuning, { snapshot, playerId: localId, legalActions, robberVisible });
```

The integration caller must obtain legal actions from the authoritative rule query
and visibility from the agreed visibility source, validate transport/version, and
bind both to the **exact accepted snapshot object** supplied to `createView`.
Pass null for unavailable sources. Construct the view and cue source atomically;
do not mutate/reuse an accepted snapshot across ticks. Composition is internal so
an independently assembled newer view cannot receive older cues. The boundary
rejects mismatched snapshots/players, disconnected/non-chase states, inactive action
owners, and early-buffer turns the frozen `ActionPromptView` cannot represent.
It does not create a wire schema or send commands. Visibility is never inferred
from replicated position. Distance uses snapshot positions; bearing uses snapshot
player yaw (`atan2(dx,dz) - yaw`, right positive), never visual camera yaw.
`canCapture` is copied from legal actions, never computed from range. It only
controls action-start readiness: false is not cancellation, completion or attempt
progress. Accepted result/events remain the source for outcomes.

The regression tests exercise the **committed** movement query through lane and
turn windows and rotated player bearings. Final parity against T017's accepted
motion-aware capture rules/version remains an explicit **T020 integration gate**.
No uncommitted capture code/tuning was read or copied. Live legal-action/visibility
transport and bootstrap assembly remain pending; this is not a playable online
chase or proof of live capture/visibility integration.

## Preview and acceptance

Isolated fixture page: `/src/ui/hud/browser/demo.html`, strict Vite port **5218**.
The layout canvas is intentionally static; its keyboard diagnostics exercise real
T007 key handling, not movement, a camera or a server. The fixture banner is always
visible. Preview controls can select phase/status cases and preserve native text
editing. Production HUD contains no interactive controls.

New unit tests run in the normal client `test` script. `test:browser` includes
both HUD development and built runners. Use the batch-4 wrapper for every Chrome
run (including `npm run check` smoke). Example from the assigned DevPack cwd:

```sh
bash /home/umar/Downloads/StopThatGuy/.worktrees/coordination/batch4/run-browser.sh node apps/client/src/ui/hud/browser/acceptance.mjs --dev
# After npm run build, omit --dev for built acceptance.
```

Reports/screenshots are ignored at `test-results/hud/`. Tests use real Tab/arrows,
text caret editing and Escape, wide/narrow landscape layouts, rapid updates,
repeated message announcements, safe text, reduced motion and repeated disposal.
