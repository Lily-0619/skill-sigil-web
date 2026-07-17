import React, { useEffect, useMemo, useState } from "react";
import "../styles/top-page.css";
import { assetUrl, pickCharacterImage } from "../lib/assets";

type TopPageProps = {
  onOpenSkillSigil: () => void;
};

const LOCAL_PREVIEW_URL = "http://localhost:5173/#top";

export default function TopPage({ onOpenSkillSigil }: TopPageProps) {
  const [mounted, setMounted] = useState(false);
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
          <p className="top-kicker">UNOFFICIAL FAN PORTAL</p>
          <h1>黒い砂漠MOBILE 情報まとめ</h1>
        </div>
        <div className="top-beta">β / 仮TOP</div>
      </header>

      <main className="top-main">
        <section className="top-copy">
          <p className="top-chapter">Portal Mock</p>
          <h2>まずは、スキル秘伝へ。</h2>
          <p>
            今回は総合情報サイト化に向けたTOPページの骨組みです。
            キャラクター図鑑やギャラリーは、後続回で中身を追加します。
          </p>
          <div className="top-url-note">
            仮のローカル確認URL: <code>{LOCAL_PREVIEW_URL}</code>
          </div>
        </section>

        <section className="top-cards" aria-label="コンテンツ入口">
          <button className="top-card primary" type="button" onClick={onOpenSkillSigil}>
            <span className="top-card-no">01</span>
            <span className="top-card-title">スキル秘伝</span>
            <span className="top-card-desc">所持秘伝・Free編成を作る現在のメイン機能。</span>
            <span className="top-card-cta">開く</span>
          </button>
          <article className="top-card muted" aria-disabled="true">
            <span className="top-card-no">02</span>
            <span className="top-card-title">キャラクター図鑑</span>
            <span className="top-card-desc">公式情報やクラス名などをまとめる予定。</span>
            <span className="top-card-cta">準備中</span>
          </article>
          <article className="top-card muted" aria-disabled="true">
            <span className="top-card-no">03</span>
            <span className="top-card-title">ギャラリー</span>
            <span className="top-card-desc">YouTube・スクリーンショットを置く予定。</span>
            <span className="top-card-cta">準備中</span>
          </article>
        </section>
      </main>
    </div>
  );
}
