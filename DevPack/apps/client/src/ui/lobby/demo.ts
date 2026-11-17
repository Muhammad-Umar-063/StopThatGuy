import { ROOM_ERROR_CODES, type RoomErrorCode } from "@stopthatguy/shared";
import { createLobbyFixtureTransport } from "./fixtureTransport";
import { mountLobby } from "./lobby";

const fixture = createLobbyFixtureTransport();
let unmount = mountLobby(document.getElementById("lobby")!, fixture.adapter);
const failure = document.getElementById("fixture-failure") as HTMLSelectElement;
failure.addEventListener("change", () => {
  const value = failure.value;
  fixture.failNext(value === "server" ? value : ROOM_ERROR_CODES.includes(value as RoomErrorCode) ? value as RoomErrorCode : null);
});
// Only this explicitly labeled demo exports test controls. Production mountLobby has no global hooks.
Object.assign(window, { lobbyFixture: { ...fixture, adapter: fixture.adapter, unmount: () => unmount(), remount: (requestTimeoutMs: number) => { unmount(); unmount = mountLobby(document.getElementById("lobby")!, fixture.adapter, { requestTimeoutMs }); }, getIntents: () => fixture.dispatched } });
document.documentElement.dataset.lobbyFixture = "ready";
window.addEventListener("pagehide", () => { unmount(); fixture.dispose(); }, { once: true });
