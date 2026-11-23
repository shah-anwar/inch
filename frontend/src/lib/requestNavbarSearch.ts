/** Dispatched to expand the navbar search field and move focus into the input. */
export const NAVBAR_EXPAND_SEARCH_EVENT = "INCH:navbar-expand-search";

export function requestNavbarSearchExpandAndFocus(): void {
  window.dispatchEvent(new CustomEvent(NAVBAR_EXPAND_SEARCH_EVENT));
}
