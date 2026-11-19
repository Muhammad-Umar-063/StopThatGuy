# Chase HUD design context

This owned module continues T012's lobby palette and system typography. It is a
read-only overlay, not a new product shell. `hud.css` is the token authority here;
`../menu/DESIGN.md` records the existing visual lineage.

## Hierarchy and tokens

Blue street-sign frames (#185b83), ink (#173a52), daylight paper (#f5f8fa), muted
text (#496479), line (#c3d3df), error (#a02232), and tram yellow (#f2c44b) for the
explicit fixture notice. Body: Trebuchet MS / Arial; timer and keyboard keys use
monospace. Flat 4px corners, no shadows or decorative motion. Timer and robber
bearing have strongest hierarchy; stamina and contextual controls are secondary.

## Layout and interaction

Top status/direction/stamina strip and bottom road/action strip leave the center
available for the world renderer. Narrow landscape condenses spacing and stacks
the two bottom strips. Portrait wraps naturally. Text is never replaced by color
alone. Direction is relative to authoritative player facing, matching road keys.

HUD ownership is display only: no focus, keyboard events, buttons or local game
rules. The separate fixture toolbar intentionally uses native select/input/button
controls, preserving Tab, native text-arrow editing, and visible focus. There is
no component framework or package to introduce. The existing T007 input controller
owns gameplay keys and Escape. The fixture's static canvas does not represent
actual graphics or camera integration.

## Accessibility and state

Stamina uses a labelled progress element; the timer is silent; essential feedback
uses one restrained polite region. Unknown values and inactive/disconnected states
remain explicit. External strings use textContent. OS/user reduced motion is
honored and there is no interpolation in this overlay. Remounting preserves the
host root and removes the old subscription/listeners/announcement timer.

## Verification

Automated browser evidence covers 1280×720, 844×390 and 640×360 in development and
built modes. Inspect the generated screenshots for hierarchy, readable narrow
text, overlap and clipping. Static premium audit is supplementary; keyboard,
authority and lifecycle tests are the acceptance evidence.

Static audit exception: its actionless-button rule cannot follow the separate
`demo.ts` event listener for `#reduced`. That native button changes the adapter
setting and aria-pressed, verified by trusted keyboard activation in acceptance.
The audit currently reports this one false positive; no runtime button is inert.
