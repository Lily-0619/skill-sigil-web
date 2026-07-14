// 表示検知アニメーション (docs/03 §11 実装ガイド)
// 初めて画面内に入った時だけ1回再生。再描画では再発火しない。
// v0.2 #4: callback ref方式。初回レンダーで要素が無くても、
// 後からマウントされた時点でObserverをattachできる。
import { useEffect, useRef, useState } from "react";

export function useReveal<T extends HTMLElement = HTMLDivElement>(): {
  ref: (el: T | null) => void;
  cls: string;
} {
  const [el, setEl] = useState<T | null>(null);
  const [inView, setInView] = useState(false);
  const played = useRef(false);

  useEffect(() => {
    if (!el || played.current) return;
    if (typeof IntersectionObserver === "undefined") {
      played.current = true;
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          played.current = true;
          setInView(true);
          io.disconnect();
        }
      },
      { threshold: 0.08 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [el]);

  return { ref: setEl, cls: inView ? "rv in" : "rv" };
}

/** stagger遅延 (40〜60ms/件、9件目以降は同時 / docs/03 §11) */
export const staggerDelay = (index: number, step = 50): React.CSSProperties =>
  ({ "--d": `${Math.min(index, 8) * step}ms` } as React.CSSProperties);
