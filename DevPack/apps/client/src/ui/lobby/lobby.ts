import { parseNickname, parseRoomCode, PROTOCOL_LIMITS, type UiAdapter, type UiIntent, type UiViewModel } from "@stopthatguy/shared";
import { attachMenuNavigation } from "../menu/navigation";
import { CODE_HELP, lobbyPermissions, NICKNAME_HELP, ROOM_ERRORS } from "./model";
import "../menu/lobby.css";

type Screen = "nickname" | "choose" | "join" | "lobby" | "started" | "closed";
type Pending = { intent: UiIntent; trigger: string; timer: ReturnType<typeof setTimeout>; expired?: boolean };

/** Presentation only. Adapter owns admission, cancellation, snapshots, errors and authority. */
export function mountLobby(root: HTMLElement, adapter: UiAdapter, options: { requestTimeoutMs?: number } = {}): () => void {
  let view = adapter.getView();
  let screen: Screen = "nickname";
  let nickname = view.lobby?.players.find((p) => p.isLocal)?.nickname ?? "";
  let roomCode = "";
  let pending: Pending | null = null;
  let retry: UiIntent | null = null;
  let admissionTrigger = "create";
  let leaveDestination: Screen = "choose";
  let disposed = false;
  let errorText = "";
  let composing = false;
  let previousFocus: HTMLElement | null = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  root.classList.add("stg-lobby");
  root.innerHTML = `<header class="lobby-masthead"><p class="lobby-place">Lisbon · Baixa / Alfama</p><p class="lobby-brand">Stop That Guy<span>!</span></p></header>
    <p class="fixture-banner" data-fixture>Fixture preview · No online connection. Players and responses are simulated.</p>
    <section class="lobby-panel" aria-labelledby="screen-title"><div data-content></div>
      <div class="lobby-feedback"><p data-status role="status" aria-live="polite"></p><p data-messages role="status" aria-live="polite"></p><p data-error role="alert"></p>
      <button type="button" data-retry hidden>Try again</button></div>
    </section><footer class="lobby-keys"><kbd>↑</kbd><kbd>↓</kbd> Choose <span>·</span> <kbd>Enter</kbd> Confirm <span>·</span> <kbd>Esc</kbd> Back <span>·</span> <kbd>Tab</kbd> Move focus</footer>`;
  const content = root.querySelector<HTMLElement>("[data-content]")!;
  const status = root.querySelector<HTMLElement>("[data-status]")!;
  const error = root.querySelector<HTMLElement>("[data-error]")!;
  const retryButton = root.querySelector<HTMLButtonElement>("[data-retry]")!;
  const fixture = root.querySelector<HTMLElement>("[data-fixture]")!;
  const button = (id: string, label: string, primary = false) => `<button id="${id}" type="button"${primary ? ' class="primary"' : ""}>${label}</button>`;
  const focus = (id: string) => content.querySelector<HTMLElement>(`#${id}`)?.focus();
  const clearPending = () => { if (pending) clearTimeout(pending.timer); pending = null; };
  const report = (message: string) => { errorText = message; paint(); };
  const fieldError = (id: string, message: string) => {
    const input = content.querySelector<HTMLInputElement>(`#${id}`)!;
    const note = content.querySelector<HTMLElement>(`#${id}-error`)!;
    note.textContent = message;
    input.setAttribute("aria-invalid", "true");
    input.focus();
  };

  function show(next: Screen, target?: string) {
    screen = next;
    errorText = "";
    retry = null;
    const titles: Record<Screen, string> = { nickname: "What should we call you?", choose: "Find your chasing crew.", join: "Got a room code?", lobby: "Get ready to give chase.", started: "The chase is starting.", closed: "This room has closed." };
    content.innerHTML = `<p class="lobby-step">${next === "lobby" ? "Room lobby" : next === "started" ? "Leaving the lobby" : "Before the chase"}</p><h1 id="screen-title" tabindex="-1">${titles[next]}</h1>`;
    document.title = `${titles[next]} · Stop That Guy!`;
    if (next === "nickname" || next === "join") {
      const isName = next === "nickname";
      const id = isName ? "nickname" : "room-code";
      const form = document.createElement("form");
      form.noValidate = true;
      form.innerHTML = `<label for="${id}">${isName ? "Nickname" : "Room code"}</label>
        <p id="${id}-help" class="field-help">${isName ? NICKNAME_HELP : CODE_HELP}</p>
        <input id="${id}" name="${id}" type="text" autocomplete="${isName ? "nickname" : "off"}" autocapitalize="${isName ? "words" : "characters"}" spellcheck="false" aria-describedby="${id}-help ${id}-error">
        <p id="${id}-error" class="field-error" aria-live="polite"></p>
        <div class="lobby-actions"><button id="continue" class="primary" type="submit">${isName ? "Continue" : "Join room"}</button>${isName ? "" : button("back", "Back")}</div>`;
      content.append(form);
      const input = form.querySelector("input")!;
      input.maxLength = isName ? PROTOCOL_LIMITS.nicknameMaxRawLength : PROTOCOL_LIMITS.roomCodeMaxRawLength;
      input.value = isName ? nickname : roomCode;
      input.addEventListener("input", () => {
        if (isName) nickname = input.value; else roomCode = input.value;
        input.removeAttribute("aria-invalid");
        form.querySelector<HTMLElement>(`#${id}-error`)!.textContent = "";
        errorText = ""; retry = null; paint();
      });
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        if (composing || pending) return;
        if (isName) {
          const result = parseNickname(nickname);
          if (!result.ok) { fieldError(id, `Enter a valid nickname. ${NICKNAME_HELP}`); return; }
          nickname = result.value; show("choose", "create");
        } else {
          const result = parseRoomCode(roomCode);
          if (!result.ok) { fieldError(id, `Check the room code. ${CODE_HELP}`); return; }
          roomCode = result.value; input.value = roomCode;
          send({ type: "joinRoom", nickname, roomCode }, "continue");
        }
      });
    } else if (next === "choose") {
      const greeting = document.createElement("p");
      greeting.className = "lobby-subtitle"; greeting.textContent = `You're in, ${nickname}. Choose a room.`;
      content.append(greeting);
      content.insertAdjacentHTML("beforeend", `<div class="lobby-actions stack">${button("create", "Create room", true)}${button("join", "Join with a code")}${button("practice", "Create practice room")}${button("back", "Change nickname")}</div><p class="field-help">A shared chase for 2–6 players. Practice is for one player.</p>`);
    } else if (next === "lobby") {
      content.insertAdjacentHTML("beforeend", `<div class="room-ticket"><span>Room code</span><strong data-code></strong><small data-mode></small></div><p data-count class="field-help"></p><ul class="roster" aria-label="Players" data-roster></ul><p data-permissions class="field-help" id="start-help"></p><div class="lobby-actions">${button("ready", "I'm ready", true)}${button("start", "Start chase")}${button("leave", "Leave room")}</div>`);
      content.querySelector("#start")!.setAttribute("aria-describedby", "start-help");
    } else {
      content.insertAdjacentHTML("beforeend", `<p data-started class="lobby-subtitle"></p>${button("leave", "Leave room")}`);
    }
    content.querySelector("#back")?.addEventListener("click", back);
    content.querySelector("#create")?.addEventListener("click", () => send({ type: "createRoom", nickname, mode: "normal" }, "create"));
    content.querySelector("#practice")?.addEventListener("click", () => send({ type: "createRoom", nickname, mode: "practice" }, "practice"));
    content.querySelector("#join")?.addEventListener("click", () => { if (!pending) show("join", "room-code"); });
    content.querySelector("#leave")?.addEventListener("click", leave);
    content.querySelector("#ready")?.addEventListener("click", () => {
      const permissions = lobbyPermissions(view);
      if (permissions.ready) send({ type: "setReady", ready: !permissions.local?.ready }, "ready");
    });
    content.querySelector("#start")?.addEventListener("click", () => {
      if (lobbyPermissions(view).start) send({ type: "startMatch" }, "start");
    });
    paint();
    focus(target ?? (next === "nickname" ? "nickname" : next === "join" ? "room-code" : next === "lobby" ? "ready" : "screen-title"));
  }

  function paint() {
    fixture.hidden = view.dataSource !== "fixture";
    const connection = view.connection.state;
    const busy = pending !== null || connection === "connecting" || connection === "reconnecting";
    status.textContent = pending?.expired ? "Still waiting for confirmation…" : pending ? ({ createRoom: "Creating room…", joinRoom: "Joining room…", setReady: "Updating readiness…", startMatch: "Requesting the start…", leaveRoom: "Leaving room…", requestRematch: "Requesting rematch…", changeSettings: "Updating settings…" }[pending.intent.type]) : connection === "reconnecting" ? "Connection interrupted. Reconnecting…" : connection === "connecting" ? "Connecting…" : "";
    root.querySelector<HTMLElement>("[data-messages]")!.textContent = view.messages.map((message) => message.text).join(" ");
    const connectionError = connection === "failed" || connection === "disconnected";
    error.textContent = errorText || (pending ? "" : view.connection.error ? ROOM_ERRORS[view.connection.error] : connectionError ? "The server connection was lost. Return to room selection and try again." : "");
    retryButton.hidden = !retry || busy;
    content.setAttribute("aria-busy", String(busy));
    for (const input of content.querySelectorAll<HTMLInputElement>("input")) input.readOnly = busy;
    for (const b of content.querySelectorAll<HTMLButtonElement>("button")) {
      b.setAttribute("aria-disabled", String(busy && b.id !== "leave" && b.id !== "back"));
    }
    if (screen === "lobby" && view.lobby) {
      const lobby = view.lobby;
      const permissions = lobbyPermissions(view);
      content.querySelector<HTMLElement>("[data-code]")!.textContent = lobby.roomCode;
      content.querySelector<HTMLElement>("[data-mode]")!.textContent = lobby.mode === "practice" ? "One-player practice room" : "Shared chase";
      content.querySelector<HTMLElement>("[data-count]")!.textContent = `${lobby.players.length} / ${lobby.maxPlayers} players`;
      const roster = content.querySelector<HTMLElement>("[data-roster]")!;
      // Roster updates never replace controls or interrupt focused buttons/inputs.
      roster.replaceChildren(...lobby.players.map((p) => {
        const row = document.createElement("li");
        const name = document.createElement("span"); name.textContent = `${p.nickname}${p.isLocal ? " (you)" : ""}${p.isHost ? " · Host" : ""}`;
        const state = document.createElement("strong"); state.textContent = p.connection !== "connected" ? "Disconnected" : p.ready ? "Ready" : "Not ready";
        row.append(name, state); return row;
      }));
      content.querySelector<HTMLElement>("[data-permissions]")!.textContent = permissions.startReason;
      const ready = content.querySelector<HTMLButtonElement>("#ready")!;
      ready.textContent = permissions.local?.ready ? "I'm not ready" : "I'm ready";
      ready.setAttribute("aria-pressed", String(permissions.local?.ready ?? false));
      ready.setAttribute("aria-disabled", String(!permissions.ready || busy));
      content.querySelector("#start")!.setAttribute("aria-disabled", String(!permissions.start || busy));
    }
    if (screen === "closed") content.querySelector<HTMLElement>("[data-started]")!.textContent = "This room is no longer available. Leave the room to return to room selection.";
    if (screen === "started") {
      if (view.phase === "results") {
        content.querySelector<HTMLElement>("#screen-title")!.textContent = "The chase has finished.";
        document.title = "The chase has finished. · Stop That Guy!";
      }
      content.querySelector<HTMLElement>("[data-started]")!.textContent = view.phase === "results" ? "Results received. The results screen is supplied by the game integration." : view.dataSource === "fixture" ? "Fixture start received. This preview ends here; no online match is running." : "Start received. Waiting for the game screen…";
    }
  }

  function send(intent: UiIntent, trigger: string) {
    if (pending || view.connection.state === "connecting" || view.connection.state === "reconnecting") return;
    errorText = ""; retry = null;
    if (intent.type === "createRoom" || intent.type === "joinRoom") admissionTrigger = intent.type === "joinRoom" ? "join" : trigger;
    pending = { intent, trigger, timer: setTimeout(() => {
      if (!pending) return;
      pending.expired = true;
      // Do not replay an unacknowledged admission/start; the adapter may have accepted it.
      report("The server is taking too long. Go back or leave the room before trying again.");
    }, options.requestTimeoutMs ?? 12_000) };
    paint();
    try { adapter.dispatch(intent); }
    catch { clearPending(); retry = intent; report("The request could not be sent. Try again."); }
  }

  function leave() {
    if (pending?.intent.type === "leaveRoom" && !pending.expired) return;
    leaveDestination = screen === "join" ? "join" : "choose";
    clearPending(); retry = null; errorText = "";
    pending = { intent: { type: "leaveRoom" }, trigger: "leave", timer: setTimeout(() => {
      if (pending) pending.expired = true;
      report("Could not confirm leaving. Try Leave room or Back again.");
    }, options.requestTimeoutMs ?? 12_000) };
    paint();
    // Transport must cancel in-flight admission and ignore its stale completion.
    try { adapter.dispatch({ type: "leaveRoom" }); }
    catch { clearPending(); report("Could not leave the room. Try Leave room or Back again."); }
  }

  function back() {
    if (pending || view.connection.state === "connecting" || view.connection.state === "reconnecting") { leave(); return; }
    if (screen === "join") show("choose", "join");
    else if (screen === "choose") show("nickname", "nickname");
    else if (screen === "lobby" || screen === "closed") leave();
    // Escape never forfeits a started match accidentally; explicit Leave remains available.
  }

  function update(next: UiViewModel) {
    if (disposed) return;
    const old = view;
    view = next;
    if (pending) {
      const { intent, trigger } = pending;
      if (intent.type === "leaveRoom" && next.lobby === null && next.phase === null && ["idle", "disconnected"].includes(next.connection.state)) {
        clearPending(); show(leaveDestination, leaveDestination === "join" ? "room-code" : admissionTrigger);
      } else if (next.connection.state === "failed" || next.connection.state === "disconnected" || next.connection.error) {
        clearPending(); errorText = ""; retry = intent.type === "createRoom" || intent.type === "joinRoom" ? intent : null;
        if (next.connection.error === "invalidNickname" && screen === "nickname") fieldError("nickname", ROOM_ERRORS.invalidNickname);
        if (next.connection.error === "invalidRoomCode" && screen === "join") fieldError("room-code", ROOM_ERRORS.invalidRoomCode);
        else focus(trigger);
      } else if ((intent.type === "createRoom" || intent.type === "joinRoom") && next.lobby || intent.type === "setReady" && next.lobby?.players.find((p) => p.isLocal)?.ready === intent.ready || intent.type === "startMatch" && next.phase !== null && ["countdown", "intro", "chase"].includes(next.phase)) {
        clearPending(); errorText = "";
      }
    }
    if (next.phase === "closed") {
      clearPending();
      if (screen !== "closed") show("closed");
    } else if (next.phase !== null && next.phase !== "lobby") {
      if (screen !== "started") show("started");
    } else if (next.lobby) {
      if (screen !== "lobby") show("lobby");
    } else if (old.lobby || old.phase !== null) show("choose", admissionTrigger);
    paint();
  }

  retryButton.addEventListener("click", () => {
    const intent = retry;
    if (!intent) return;
    if (intent.type === "startMatch" && !lobbyPermissions(view).start || intent.type === "setReady" && !lobbyPermissions(view).ready) return;
    focus(intent.type === "joinRoom" ? "continue" : intent.type === "createRoom" ? intent.mode === "practice" ? "practice" : "create" : intent.type === "setReady" ? "ready" : "start");
    send(intent, intent.type === "joinRoom" ? "continue" : intent.type === "createRoom" ? intent.mode === "practice" ? "practice" : "create" : intent.type === "setReady" ? "ready" : "start");
  });
  const guard = (e: MouseEvent) => { if ((e.target as Element).closest('button[aria-disabled="true"]')) { e.preventDefault(); e.stopImmediatePropagation(); } };
  const onCompositionStart = () => { composing = true; };
  const onCompositionEnd = () => { composing = false; };
  const onEnter = (e: KeyboardEvent) => { if (e.key === "Enter" && (e.repeat || e.isComposing || composing || e.keyCode === 229)) e.preventDefault(); };
  root.addEventListener("click", guard, true);
  root.addEventListener("keydown", onEnter);
  root.addEventListener("compositionstart", onCompositionStart);
  root.addEventListener("compositionend", onCompositionEnd);
  const detachNavigation = attachMenuNavigation(root, back);
  show(view.phase === "closed" ? "closed" : view.phase !== null && view.phase !== "lobby" ? "started" : view.lobby ? "lobby" : "nickname");
  const unsubscribe = adapter.subscribe(update);
  return () => {
    disposed = true; clearPending(); unsubscribe(); detachNavigation();
    root.removeEventListener("click", guard, true); root.removeEventListener("keydown", onEnter);
    root.removeEventListener("compositionstart", onCompositionStart); root.removeEventListener("compositionend", onCompositionEnd);
    const ownedFocus = root.contains(document.activeElement);
    root.replaceChildren(); root.classList.remove("stg-lobby");
    if (ownedFocus && previousFocus?.isConnected) previousFocus.focus();
    previousFocus = null;
  };
}
