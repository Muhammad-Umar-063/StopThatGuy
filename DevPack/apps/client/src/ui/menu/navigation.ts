/** Supplemental button navigation. Native Tab, form editing and IME retain ownership. */
export function attachMenuNavigation(root: HTMLElement, back: () => void): () => void {
  const onKey = (event: KeyboardEvent) => {
    if (event.defaultPrevented || event.isComposing || event.keyCode === 229 || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === "Escape") {
      event.preventDefault();
      if (!event.repeat) back();
      return;
    }
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement || (event.target instanceof HTMLElement && event.target.isContentEditable)) return;
    if (!["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft"].includes(event.key)) return;
    const buttons = [...root.querySelectorAll<HTMLButtonElement>("button")].filter((b) => !b.closest("[hidden]"));
    const index = buttons.indexOf(event.target as HTMLButtonElement);
    if (index < 0 || buttons.length === 0) return;
    event.preventDefault();
    if (event.repeat) return;
    const direction = ["ArrowDown", "ArrowRight"].includes(event.key) ? 1 : -1;
    for (let step = 1; step <= buttons.length; step++) {
      const candidate = buttons[(index + direction * step + buttons.length) % buttons.length];
      if (candidate && !candidate.disabled && candidate.getAttribute("aria-disabled") !== "true") { candidate.focus(); break; }
    }
  };
  root.addEventListener("keydown", onKey);
  return () => root.removeEventListener("keydown", onKey);
}
