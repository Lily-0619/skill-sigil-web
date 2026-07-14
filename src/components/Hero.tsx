// トップページ — スプリットヒーロー (カーソルを載せた側だけ映像が動く)
// 動画は 画像/hero/left.mp4, right.mp4 (または .webm/.png/.jpg) を置くだけで自動反映。
// 未設置の間はキャラクター立ち絵のスロームーブで代替演出する。
// v0.2 #3: 左=Myスキル秘伝 / 右=Freeスキル秘伝 (COMING SOON廃止)
import React, { useEffect, useMemo, useRef, useState } from "react";
import "../styles/hero.css";
import type { BuildMode } from "../types";
import { heroMediaCandidates, pickCharacterImage, assetUrl } from "../lib/assets";

type Side = "left" | "right";

function HeroMedia({ side, hovered }: { side: Side; hovered: boolean }) {
  const { videos, images } = useMemo(() => heroMediaCandidates(side), [side]);
  // 候補: 動画 → 静止画 → キャラ立ち絵
  const [stage, setStage] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const charaPath = useMemo(
    () => pickCharacterImage(null, null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const isVideo = stage < videos.length;
  const isImage = !isVideo && stage < videos.length + images.length;

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (hovered) {
      v.play().catch(() => undefined);
    } else {
      v.pause();
    }
  }, [hovered, stage]);

  if (isVideo) {
    return (
      <div className="hero-media">
        <video
          ref={videoRef}
          className="media"
          src={videos[stage]}
          muted
          loop
          playsInline
          preload="metadata"
          onError={() => setStage((s) => s + 1)}
        />
      </div>
    );
  }
  if (isImage) {
    return (
      <div className="hero-media">
        <img
          className="media"
          src={images[stage - videos.length]}
          alt=""
          onError={() => setStage((s) => s + 1)}
        />
      </div>
    );
  }
  return (
    <div className="hero-media">
      {charaPath && (
        <img className="chara" src={assetUrl(charaPath)} alt="" aria-hidden />
      )}
    </div>
  );
}

export default function Hero({
  onEnter,
}: {
  onEnter: (mode: BuildMode) => void;
}) {
  const [hover, setHover] = useState<Side | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setMounted(true), 60);
    return () => window.clearTimeout(t);
  }, []);

  const panelsCls = [
    "hero-panels",
    hover === "left" ? "hover-left" : "",
    hover === "right" ? "hover-right" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const rv = (extra: string, delay: number): { className: string; style: React.CSSProperties } => ({
    className: `rv ${extra}${mounted ? " in" : ""}`,
    style: { "--d": `${delay}ms` } as React.CSSProperties,
  });

  return (
    <div className="hero">
      <div className="hero-brand">
        <div {...rv("rv-blur", 150)}>
          <div className="site">Black Desert Mobile</div>
        </div>
        <div {...rv("rv-blur", 300)}>
          <div className="site-ja">黒い砂漠MOBILE 情報まとめ</div>
        </div>
        <div {...rv("rv-fade-long", 600)}>
          <div className="rule" />
        </div>
      </div>
      <div className="hero-unofficial">UNOFFICIAL FANSITE</div>

      <div className={panelsCls}>
        {/* CHAPTER 01 — Myスキル秘伝 */}
        <button
          type="button"
          className={`hero-panel left ${hover === "left" ? "hovered" : ""} ${
            hover === "right" ? "dimmed" : ""
          }`}
          onMouseEnter={() => setHover("left")}
          onMouseLeave={() => setHover(null)}
          onFocus={() => setHover("left")}
          onBlur={() => setHover(null)}
          onClick={() => onEnter("my")}
          aria-label="Myスキル秘伝をひらく"
        >
          <HeroMedia side="left" hovered={hover === "left"} />
          <div className="hero-veil" />
          <span className="edge-line" aria-hidden />
          <span className="edge-no" aria-hidden>
            CHAPTER 01
          </span>
          <div className="hero-content">
            <div {...rv("rv-hero", 500)}>
              <div className="chapter">Chapter 01</div>
            </div>
            <div {...rv("rv-hero", 650)}>
              <div className="title">Myスキル秘伝</div>
            </div>
            <div {...rv("rv-hero", 800)}>
              <div className="title-en">My Sigil Build</div>
            </div>
            <div {...rv("rv-fade", 1050)}>
              <div className="lede">
                所持している秘伝を登録し、
                <br />
                いま組める編成をたしかめる。
              </div>
            </div>
            <div {...rv("rv-fade", 1200)}>
              <span className="hero-cta">編成をはじめる</span>
            </div>
          </div>
        </button>

        {/* CHAPTER 02 — Freeスキル秘伝 (v0.2 #3) */}
        <button
          type="button"
          className={`hero-panel right ${
            hover === "right" ? "hovered" : ""
          } ${hover === "left" ? "dimmed" : ""}`}
          onMouseEnter={() => setHover("right")}
          onMouseLeave={() => setHover(null)}
          onFocus={() => setHover("right")}
          onBlur={() => setHover(null)}
          onClick={() => onEnter("free")}
          aria-label="Freeスキル秘伝をひらく"
        >
          <HeroMedia side="right" hovered={hover === "right"} />
          <div className="hero-veil" />
          <span className="edge-line" aria-hidden />
          <span className="edge-no" aria-hidden>
            CHAPTER 02
          </span>
          <div className="hero-content">
            <div {...rv("rv-hero", 700)}>
              <div className="chapter">Chapter 02</div>
            </div>
            <div {...rv("rv-hero", 850)}>
              <div className="title">Freeスキル秘伝</div>
            </div>
            <div {...rv("rv-hero", 1000)}>
              <div className="title-en">Free Sigil Build</div>
            </div>
            <div {...rv("rv-fade", 1200)}>
              <div className="lede">
                所持数にとらわれず、
                <br />
                目指す理想の編成を先に設計する。
              </div>
            </div>
            <div {...rv("rv-fade", 1350)}>
              <span className="hero-cta">理想の編成を組む</span>
            </div>
          </div>
        </button>
      </div>

      <div className="hero-footer">
        <div className="txt">
          本サイトはPearl Abyssの著作物・知的財産を含む非公式ファンコンテンツであり、Pearl
          Abyss公式または公認のものではありません。
        </div>
      </div>
    </div>
  );
}
