# Lobby design context (T012)

This scope-local note follows the user's file ownership boundary. It does not
establish a project-wide visual rebrand. Runtime tokens in `lobby.css` are canonical.

## Overview

A Lisbon chasing crew's meeting point: blue street-sign lettering, a framed room
code like a small enamel address plaque, daylight surfaces, and one tram-yellow
fixture notice. The lobby is a product flow for keyboard and touch users. No art,
web fonts, decorative maps, camera motion or game-like simulation is needed here.
The existing client is a labeled smoke scene; no sibling product form exists.

## Colors

`lobby.css` defines one token set on `.stg-lobby`: ink #173a52, blue #185b83,
paper #f5f8fa, white #ffffff, accent #f2c44b, muted #496479, line #c3d3df,
error #a02232. Controls, text, focus and the room ticket consume those variables.
Ink/yellow focus outlines stay visible on both solid and white controls. Disabled
states use explicit ARIA plus subdued styling, and errors always include text.

## Typography

Body/control stack: Trebuchet MS, Arial, sans-serif at 16px / 1.5. Brand: Arial
Narrow, Trebuchet MS, sans-serif, bold condensed treatment. Room code: monospace,
large and selectable. Use system fallback fonts; no downloads or font swap.

## Layout

One natural document scroll, a centered 42rem column, responsive padding and
full-width controls on narrow screens. Fields reserve an error line. Loading
keeps buttons and labels in place. Every interactive target is at least 48px tall.

## Elevation & Depth

Flat surfaces. A blue top border and room-code frame carry hierarchy without shadows.

## Shapes

Small .25rem control corners; .4rem room-ticket corners. No modal or focus trap.

## Components

Canonical owners for this scope: `menu/navigation.ts` adds arrow/Escape behavior;
`lobby/lobby.ts` owns form, error/live-status, focus and pending-request behavior;
shared `parseNickname`/`parseRoomCode` own validation; shared `UiAdapter` owns data
and named intents. Native buttons/input/select are intentional; fixture tools use
the OS select popup. No new UI framework or duplicate wire types.

## Do's and Don'ts

Keep Tab/Shift+Tab native, arrows native in text fields, IME Enter inert, errors
associated to fields, roster updates independent of focus, and fixture labeling
persistent on every fixture screen. Do not claim online play or implement game
rules. Match start is a presentation boundary, not a running browser-only chase.
