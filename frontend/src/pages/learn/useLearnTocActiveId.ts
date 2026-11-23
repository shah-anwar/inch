import { useEffect, useState } from "react";

const SCROLL_MARK_PX = 96;

/**
 * Tracks which section id is currently in view for table-of-contents highlighting.
 */
export function useLearnTocActiveId(sectionIds: readonly string[]): string {
  const [activeId, setActiveId] = useState<string>(() => sectionIds[0] ?? "");

  useEffect(() => {
    const update = (): void => {
      let current = sectionIds[0] ?? "";
      for (const id of sectionIds) {
        const el = document.getElementById(id);
        if (!el) continue;
        const top = el.getBoundingClientRect().top;
        if (top <= SCROLL_MARK_PX) {
          current = id;
        }
      }
      setActiveId(current);
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update, { passive: true });
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [sectionIds]);

  return activeId;
}
