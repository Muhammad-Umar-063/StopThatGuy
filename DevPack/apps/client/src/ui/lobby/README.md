# T012 lobby presentation

`mountLobby(element, adapter)` consumes the shared `UiAdapter` and returns a disposer.
Import `index.ts` for integration. The separate `demo.html` is always a **fixture
preview**, including its countdown. It has no network connection or running match.

Run `npm run dev --workspace @stopthatguy/client -- --host 127.0.0.1 --port 5212 --strictPort` and open
`/src/ui/lobby/demo.html`. The same route is a production build entry served by
`npm run preview --workspace @stopthatguy/client -- --host 127.0.0.1 --port 5212 --strictPort` after build.
The main smoke scene and T007 implementation are unchanged.

T014/T020 integration responsibilities:

- Provide server-owned room/ready/host/start views. UI gates intent dispatch using
  `connection`, `phase`, local player state, `localIsHost`, and `canStart`; this
  never replaces server validation. Include `dataSource: "server"` only for real
  connections. Use shared validators for admission.
- Publish `connecting` before asynchronous admission, then a lobby or a distinct
  `connection.error`/`failed` state. Publish readiness/phase acknowledgement for
  mutation completion. No UI optimistic readiness or start transition. Server
  warning/info messages are rendered as plain text, including while busy; they do
  not imply an acknowledgement. A rejected connected mutation without an explicit
  outcome stays guarded until leave or an authoritative acknowledgement. T014
  must resolve how command rejections map onto this frozen adapter contract.
- `leaveRoom` must invalidate pending admission, close/leave a late-created session,
  suppress stale completion, and publish a null room/phase with idle/disconnected
  state when complete. This is essential for Escape cancellation and retry.
- Failed mutations offer leave/re-entry; admission failures offer retry. An
  unacknowledged timeout never automatically replays a request: controls stay busy
  until acknowledgement, explicit failure or leave. The timeout is a UI waiting
  threshold (12 seconds), not server or gameplay tuning.
- Keep the game keyboard controller inactive while this UI owns focus; its surface
  should be the gameplay canvas, never the lobby root. Restore gameplay only on a
  real phase transition. Text fields retain arrow caret editing and composition.
- `countdown`/`intro`/`chase` leave the lobby at a presentation boundary; T020 supplies
  the actual game. `closed` shows closure/recovery; results is a later UI task.
- Unmount unsubscribes/listeners/timers and restores the previous connected focus
  target only if focus is still inside the lobby. Snapshot updates preserve focus.

Tests are registered in client `test` / `test:browser`; the root commands include
both. Browser acceptance uses real CDP keyboard events in dev (5412) and built
preview (5212). Screenshots/logs go to ignored `test-results/lobby`. No packages,
third-party assets or bootstrap edits are required. Screen-reader speech and real
Android hardware remain manual checks.
