import React, { useEffect, useMemo, useState } from "react";
import "../styles/top-page.css";
import { assetUrl, pickCharacterImage } from "../lib/assets";

type TopPageProps = {
  onOpenSkillSigil: () => void;
};

// 2026-07-19: TOPのキャッチコピーを3種からランダム表示
// script = RUS Love and Passion (半角英字のみ対応) / ja = 明朝
const TOP_COPIES = [
  { text: "さあ、冒険を始めよう。", script: false },
  { text: "Welcome", script: true },
  { text: "Thank you", script: true },
] as const;

export default function TopPage({ onOpenSkillSigil }: TopPageProps) {
  const [mounted, setMounted] = useState(false);
  const copy = useMemo(() => TOP_COPIES[Math.floor(Math.random() * TOP_COPIES.length)], []);
  const charaPath = useMemo(() => pickCharacterImage(null, null), []);

  useEffect(() => {
    window.history.replaceState(null, "", "#top");
    const t = window.setTimeout(() => setMounted(true), 60);
    return () => window.clearTimeout(t);
  }, []);

  return (
    <div className={`top-page ${mounted ? "in" : ""}`}>
      <div className="top-bg" aria-hidden>
        {charaPath && <img src={assetUrl(charaPath)} alt="" />}
      </div>
      <header className="top-header">
        <div>
          <p className="top-kicker">Black Desert Mobile</p>
          <h1>黒い砂漠MOBILE 非公式Webページ</h1>
        </div>
      </header>

      <main className="top-main">
        <section className="top-copy">
          <h2 className={copy.script ? "script" : undefined}>{copy.text}</h2>
        </section>

        <section className="top-cards" aria-label="コンテンツ入口">
          <button className="top-card primary" type="button" onClick={onOpenSkillSigil}>
            <span className="top-card-title">スキル秘伝</span>
            <span className="top-card-desc">所持秘伝・Free編成を作る現在のメイン機能。</span>
            <span className="top-card-cta">開く</span>
          </button>
          <a className="top-card primary" href="キャラクター紹介_案B.html">
            <span className="top-card-title">キャラクター図鑑</span>
            <span className="top-card-desc">30クラスの立ち絵・武器・プロフィールを見る。</span>
            <span className="top-card-cta">開く</span>
          </a>
          <article className="top-card muted" aria-disabled="true">
            <span className="top-card-title">ギャラリー</span>
            <span className="top-card-desc">YouTube・スクリーンショットを置く予定。</span>
            <span className="top-card-cta">準備中</span>
          </article>
        </section>
      </main>
    </div>
  );
}
