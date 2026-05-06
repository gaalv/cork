import { useEffect, useState } from "react";

export function useScrollSpy(ids: string[], root?: Element | null): string | null {
  const [activeId, setActiveId] = useState<string | null>(ids[0] ?? null);

  useEffect(() => {
    setActiveId((current) => (current && ids.includes(current) ? current : ids[0] ?? null));
    if (ids.length === 0 || typeof IntersectionObserver === "undefined") {
      return;
    }
    const elements = ids
      .map((id) => document.querySelector(`[data-outline-id="${CSS.escape(id)}"]`))
      .filter((element): element is Element => element !== null);
    if (elements.length === 0) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => left.boundingClientRect.top - right.boundingClientRect.top)[0];
        const nextId = visible?.target.getAttribute("data-outline-id");
        if (nextId) {
          setActiveId(nextId);
        }
      },
      { root: root ?? null, rootMargin: "0px 0px -70% 0px", threshold: [0, 1] },
    );
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [ids, root]);

  return activeId;
}
