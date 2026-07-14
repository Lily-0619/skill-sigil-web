// S-06 ヘルプ・情報 (docs/03 §8)
import React from "react";
import { master, useStore } from "../state/store";
import { useReveal, staggerDelay } from "../hooks/useReveal";

export default function Help() {
  const { data } = useStore();
  const rv = useReveal<HTMLDivElement>();
  const steps = useReveal<HTMLDivElement>();

  return (
    <div ref={rv.ref} className={`stack ${rv.cls} rv-up`}>
      <div className="screen-head">
        <span className="overline">About</span>
        <h2>ヘルプ・情報</h2>
      </div>

      <div ref={steps.ref} className="help-steps">
        {[
          {
            n: "1",
            t: "クラスを選ぶ",
            d: "クラス選択画面からプレイ中のクラスをえらびます。",
          },
          {
            n: "2",
            t: "所持秘伝を登録",
            d: "タイプ→効果→等級のじゅんに選ぶだけ。数値はマスタから自動で確定します。",
          },
          {
            n: "3",
            t: "枠へ装着",
            d: "スキルを選び、秘伝をクリック→光った枠をクリック。残数は自動で計算されます。",
          },
        ].map((s, i) => (
          <div
            key={s.n}
            className={`help-step panel ${steps.cls} rv-up`}
            style={staggerDelay(i)}
          >
            <div className="n">{s.n}</div>
            <div className="t">{s.t}</div>
            <div className="d">{s.d}</div>
          </div>
        ))}
      </div>

      <div className="card panel">
        <h3>
          データの保存場所 <span className="en">Storage</span>
        </h3>
        <p>
          所持秘伝・編成は<strong>このPCのブラウザ内(IndexedDB)</strong>にだけ自動保存されます。サーバーへは送信しません。
        </p>
        <p className="fine">
          ブラウザの閲覧データを削除すると保存内容が消えることがあります。「バックアップ」画面からのExcel書き出しを定期的におすすめします。別のPCへは、Excelを書き出して読み込むことで移行できます。
        </p>
      </div>

      <div className="card panel">
        <h3>
          装着のルール <span className="en">Rules</span>
        </h3>
        <p>
          各スキルは固定4枠を持ち、枠ごとに装着できる秘伝タイプが決まっています。上段4つは特別スキル(ラバム)、下段13番のスキルは秘伝装着対象外です。
        </p>
        <p className="fine">
          同じ所持秘伝1個を同じ編成内の複数スキルへ重複装着することはできません。残数 = 所持数 −
          同じ編成内で使用中の数。等級は 深淵(赤) / 太古(濃いピンク) / 混沌(深い青) の3段階です。
        </p>
      </div>

      <div className="card panel">
        <h3>
          バージョン <span className="en">Version</span>
        </h3>
        <p className="fine">
          マスタ版: {master.master_version} ／ データ形式: v{data.meta.schema_version} ／ アプリ: 0.1.0 (MVP)
        </p>
      </div>

      <div className="card panel">
        <h3>
          困ったら <span className="en">Contact</span>
        </h3>
        <p>
          <a
            href="https://discord.com/users/800342772590313484"
            target="_blank"
            rel="noreferrer"
            className="discord-contact"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M19.5 4.7A16.6 16.6 0 0 0 15.4 3l-.5 1a15.4 15.4 0 0 0-5.8 0l-.5-1a16.6 16.6 0 0 0-4.1 1.7C1.9 8.6 1.2 12.4 1.6 16.2A16.8 16.8 0 0 0 6.6 18.7l1.2-1.6a10 10 0 0 1-1.9-.9l.5-.4c3.7 1.7 7.6 1.7 11.3 0l.5.4a10 10 0 0 1-1.9.9l1.2 1.6a16.8 16.8 0 0 0 5-2.5c.5-4.4-.8-8.2-3-11.5ZM8.7 14.1c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Zm6.6 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Z" />
            </svg>
            lilybd まで
          </a>
        </p>
      </div>

      <div className="card panel">
        <h3>
          非公式ファンサイトについて <span className="en">Disclaimer</span>
        </h3>
        <p>
          本サイトはPearl Abyssの著作物・知的財産を含む非公式ファンコンテンツであり、Pearl
          Abyss公式または公認のものではありません。
        </p>
        <p className="fine">
          <a
            href="https://www.jp.blackdesertm.com/"
            target="_blank"
            rel="noreferrer"
            style={{ color: "var(--pink-deep)" }}
          >
            黒い砂漠MOBILE 公式サイト
          </a>
          {" ／ "}
          <a
            href="https://www.world.blackdesertm.com/Policy?policyNo=10"
            target="_blank"
            rel="noreferrer"
            style={{ color: "var(--pink-deep)" }}
          >
            Pearl Abyss ファンコンテンツガイド
          </a>
        </p>
      </div>
    </div>
  );
}
