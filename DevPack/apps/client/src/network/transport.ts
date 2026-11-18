import { Client, type Room, type SeatReservation } from '@colyseus/sdk';
import { ROOM_ERROR_CODES, type ClientCommand, type CreateRoomOptions, type JoinRoomOptions } from '@stopthatguy/shared';
import { NetworkFailure, record } from './decode.js';

type Envelope = { snapshotJson: string };
export interface NetworkSession {
  readonly id: string;
  readonly roomCode: string;
  onSnapshot(listener: (raw: unknown) => void): () => void;
  onMessage(listener: (raw: unknown) => void): () => void;
  onClose(listener: () => void): () => void;
  send(command: ClientCommand): void;
  close(): Promise<void>;
}
export interface NetworkTransport {
  admit(path: 'create' | 'join', options: CreateRoomOptions | JoinRoomOptions): Promise<NetworkSession>;
}

// SDK extension point captures the opening socket so an unfinished handshake can be closed.
class AdmissionClient extends Client {
  opening: Pick<Room<unknown, unknown>, 'connection' | 'removeAllListeners'> | undefined;
  protected override createRoom<T>(name: string) {
    const room = super.createRoom<T>(name);
    room.reconnection.enabled = false; // Reconnect is T028, never silently attempt it here.
    this.opening = room;
    return room;
  }
}
async function closeRoom<T>(room: Room<unknown, T>): Promise<void> {
  room.reconnection.enabled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([room.leave(), new Promise<void>((resolve) => { timer = setTimeout(() => { room.connection?.close(); resolve(); }, 2000); })]);
  } finally { clearTimeout(timer); room.removeAllListeners(); }
}

export function createColyseusTransport(endpoint: string, fetcher: typeof fetch = fetch): NetworkTransport {
  const url = new URL(endpoint);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error('Use an HTTP(S) game-server endpoint without credentials or query parameters');
  const base = url.href.replace(/\/$/, '');
  return { async admit(path, options) {
    const controller = new AbortController();
    const requestTimer = setTimeout(() => controller.abort(), 10000);
    let body: unknown;
    try {
      // Do not abort on UI cancellation: a returned late reservation must be consumed and left.
      const response = await fetcher(`${base}/rooms/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(options), signal: controller.signal });
      body = await readAdmissionBody(response);
      if (!response.ok) {
        const code = record(body) && ROOM_ERROR_CODES.includes(body.code as never) ? body.code as typeof ROOM_ERROR_CODES[number] : 'invalidRequest';
        throw new NetworkFailure(code);
      }
    } finally { clearTimeout(requestTimer); }
    if (!record(body) || typeof body.roomCode !== 'string' || !/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{5}$/.test(body.roomCode) || !record(body.reservation)) throw new NetworkFailure('invalidRequest');
    const reservation = body.reservation;
    if (!['name', 'roomId', 'sessionId', 'processId'].every((key) => typeof reservation[key] === 'string' && (reservation[key] as string).length > 0)) throw new NetworkFailure('invalidRequest');
    const sdk = new AdmissionClient(base);
    let timer: ReturnType<typeof setTimeout> | undefined;
    let room: Room<unknown, Envelope>;
    try {
      room = await Promise.race([
        sdk.consumeSeatReservation<Envelope>(reservation as unknown as SeatReservation),
        new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new NetworkFailure('invalidRequest')), 10000); }),
      ]);
    } catch (error) {
      sdk.opening?.connection?.close();
      sdk.opening?.removeAllListeners();
      if (error instanceof NetworkFailure) throw error;
      const message = error instanceof Error ? error.message : '';
      throw new NetworkFailure(ROOM_ERROR_CODES.find((code) => message.startsWith(code)) ?? 'invalidRequest');
    } finally { clearTimeout(timer); }
    return {
      id: room.sessionId, roomCode: body.roomCode,
      onSnapshot(listener) {
        const onState = (state: Envelope) => { if (state.snapshotJson) listener(state.snapshotJson); };
        room.onStateChange(onState);
        if (room.state?.snapshotJson) onState(room.state);
        return () => room.onStateChange.remove(onState);
      },
      onMessage: (listener) => room.onMessage('message', listener),
      onClose(listener) {
        room.onLeave(listener); room.onError(listener);
        return () => { room.onLeave.remove(listener); room.onError.remove(listener); };
      },
      send: (command) => room.send('command', command),
      close: () => closeRoom(room),
    };
  } };
}

async function readAdmissionBody(response: Response): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) throw new NetworkFailure('invalidRequest');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 16384) { await reader.cancel(); throw new NetworkFailure('invalidRequest'); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return JSON.parse(new TextDecoder().decode(bytes));
  } finally { reader.releaseLock(); }
}
