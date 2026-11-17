/**
 * Decides whether gameplay may take a key event, so text entry and menu/widget navigation keep their
 * normal browser behavior. Checks are structural (tagName, isContentEditable, role, contains) so the
 * policy works with real DOM nodes and with test doubles.
 */

/** ARIA widgets whose keyboard interaction uses arrows, letters or Escape. */
const KEY_CONSUMING_ROLES = new Set([
  "textbox",
  "searchbox",
  "combobox",
  "listbox",
  "option",
  "menu",
  "menubar",
  "menuitem",
  "menuitemcheckbox",
  "menuitemradio",
  "radiogroup",
  "radio",
  "slider",
  "spinbutton",
  "scrollbar",
  "tab",
  "tablist",
  "tree",
  "treeitem",
  "treegrid",
  "grid",
  "gridcell",
  "dialog",
  "alertdialog",
]);

interface ElementLike {
  readonly tagName?: unknown;
  readonly isContentEditable?: unknown;
  getAttribute?(name: string): string | null;
}

export interface SurfaceLike {
  contains?(other: unknown): boolean;
}

/** Form controls, editable content and key-handling ARIA widgets keep their own keyboard behavior. */
export function isKeyConsumingTarget(target: unknown): boolean {
  if (typeof target !== "object" || target === null) return false;
  const element = target as ElementLike;
  const tag = typeof element.tagName === "string" ? element.tagName.toUpperCase() : "";
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (element.isContentEditable === true) return true;
  const role = typeof element.getAttribute === "function" ? element.getAttribute("role") : null;
  return role !== null && role.trim().split(/\s+/).some((name) => KEY_CONSUMING_ROLES.has(name.toLowerCase()));
}

/** The innermost target of an event, including inside open shadow roots. */
export function eventTargetOf(event: { readonly target?: unknown; composedPath?(): unknown[] }): unknown {
  const path = typeof event.composedPath === "function" ? event.composedPath() : undefined;
  return path && path.length > 0 ? path[0] : event.target;
}

export interface OwnershipContext {
  /** Window, document, body and root element: "nothing focused" targets that gameplay may use. */
  readonly pageTargets: readonly unknown[];
  /** When set, gameplay only owns keys focused inside this element (or on the page itself). */
  readonly surface: SurfaceLike | null;
}

/** True when gameplay may take keys aimed at `target` (gameplay must also be active). */
export function gameplayOwnsTarget(target: unknown, context: OwnershipContext): boolean {
  if (isKeyConsumingTarget(target)) return false;
  const { surface, pageTargets } = context;
  if (!surface) return true;
  if (target === null || target === undefined || pageTargets.includes(target)) return true;
  if (target === surface) return true;
  return typeof surface.contains === "function" && surface.contains(target);
}
