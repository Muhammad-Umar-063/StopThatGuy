import { RoomFailure } from "./room-options.js";

/** Server HTTP boundary budget, not a gameplay tuning or new wire contract. */
export const MAX_ROOM_REQUEST_BYTES = 4096;

/** Bound the stream before JSON parsing, including chunked bodies without Content-Length. */
export async function readRoomRequest(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new RoomFailure("invalidRequest");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_ROOM_REQUEST_BYTES) {
        // Cancelling Colyseus's Node request stream destroys the socket before the
        // error response can be written. Stop reading; the endpoint closes it after 413.
        throw new RoomFailure("invalidRequest", 413);
      }
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch (error) {
    if (error instanceof RoomFailure) throw error;
    throw new RoomFailure("invalidRequest");
  } finally {
    reader.releaseLock();
  }
}
