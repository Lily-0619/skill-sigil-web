// スキル秘伝の入口 — ゲーム内スキル画面に合わせたモード選択
import React, { useEffect, useMemo, useRef, useState } from "react";
import "../styles/hero.css";
import type { BuildMode } from "../types";
import { heroMediaCandidates, pickCharacterImage, assetUrl } from "../lib/assets";

type Side = "left" | "right";

function HeroMedia({ side, hovered }: { side: Side; hovered: boolean }) {
  const { videos, images } = useMemo(() => heroMediaCandidates(side), [side]);
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
    if (hovered) v.play().catch(() => undefined);
    else v.pause();
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
  onBack,
}: {
  onEnter: (mode: BuildMode) => void;
  onBack?: () => void;
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

  return (
    <div className={`hero ${mounted ? "in" : ""}`}>
      <header className="hero-topbar">
        <button className="hero-back" type="button" onClick={onBack} aria-label="TOPへ戻る">
          <span className="hero-back-arrow">←</span>
          <span>TOPへ</span>
        </button>
        <div className="hero-heading">
          <span className="hero-heading-main">スキル</span>
          <span className="hero-heading-sub">スキル秘伝</span>
        </div>
        <div className="hero-site-name">黒い砂漠モバイル 非公式Webページ</div>
      </header>

      <main className="hero-main">
        <div className="hero-intro">
          <div className="hero-intro-title">スキル秘伝</div>
          <div className="hero-intro-copy">編成モードを選択してください</div>
          <div className="hero-intro-note">
            所持数を反映して組むか、理想の編成を先に設計できます。
          </div>
        </div>

        <div className={panelsCls}>
          <button
            type="button"
            className={`hero-panel left ${hover === "left" ? "hovered" : ""} ${hover === "right" ? "dimmed" : ""}`}
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
            <span className="edge-no" aria-hidden>01</span>
            <div className="hero-content">
              <div className="hero-card-label">所持秘伝を使う</div>
              <div className="title">Myスキル秘伝</div>
              <div className="title-en">My Sigil Build</div>
              <div className="lede">
                所持している秘伝を登録し、<br />
                いま組める編成をたしかめる。
              </div>
              <span className="hero-cta">編成をはじめる</span>
            </div>
          </button>

          <button
            type="button"
            className={`hero-panel right ${hover === "right" ? "hovered" : ""} ${hover === "left" ? "dimmed" : ""}`}
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
            <span className="edge-no" aria-hidden>02</span>
            <div className="hero-content">
              <div className="hero-card-label">理想の編成を作る</div>
              <div className="title">Freeスキル秘伝</div>
              <div className="title-en">Free Sigil Build</div>
              <div className="lede">
                所持数にとらわれず、<br />
                目指す理想の編成を先に設計する。
              </div>
              <span className="hero-cta">理想の編成を組む</span>
            </div>
          </button>
        </div>
      </main>

      <footer className="hero-footer">
        本サイトはPearl Abyssの著作物・知的財産を含む非公式ファンコンテンツであり、
        Pearl Abyss公式または公認のものではありません。
      </footer>
    </div>
  );
}
