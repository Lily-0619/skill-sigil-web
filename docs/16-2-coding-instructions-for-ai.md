# 16-2 AI向けコーディング指示

この文書は、次回以降にClaudeや別AIが作業するための実装指示です。

## 最初に読むもの

1. `docs/README.md`
2. この文書
3. `docs/16-1-roadmap-for-humans.md`
4. `docs/16-3-technical-notes-for-owner.md`
5. 実装対象のReact/TypeScriptファイル

タイトルに「(完了)」が付いたdocsは、ユーザーから明示指示がない限り参照優先度を下げてください。

## BuildEdit.tsx 整理の目的

`src/components/BuildEdit.tsx` はすでに1,100行を超えています。
機能追加のたびに、選択状態、装着条件、表示、モーダル、一覧、トレイが同じファイル内で絡みやすくなっています。
これは見た目を変えるためではなく、今後のクラス追加・秘伝仕様変更・スマホ対応で事故を減らすための整理です。

## 分割候補

次回の整理では、少なくとも以下の単位へ分ける方針です。

```text
src/components/build-edit/
  BuildEdit.tsx                 # 画面全体の組み立てだけを担当
  PassiveSummary.tsx            # パッシブ説明
  SkillList.tsx                 # スキル一覧
  EquipSlotPanel.tsx            # 装着枠
  OwnedSigilTray.tsx            # 所持秘伝トレイ
  FreeSigilCatalog.tsx          # Free秘伝カタログ
  SigilEffectList.tsx           # 秘伝効果一覧
  EquipConfirmModal.tsx         # 装着確認モーダル
  buildEditTypes.ts             # props型、表示用型
  buildEditHelpers.ts           # UI用の軽い整形関数
```

## 分割時の原則

- まず見た目を変えずに分割する。
- ロジック変更と見た目変更を同じコミットで混ぜない。
- `BuildEdit.tsx` は「状態管理」と「部品の配置」に寄せ、詳細な表示は子コンポーネントへ移す。
- 装着可否の中核ロジックは `src/logic/equip.ts` に寄せる。UIコンポーネントへ複製しない。
- 型は必要に応じて `src/types.ts` か `buildEditTypes.ts` に置く。ただし全画面で使う型は `src/types.ts` を優先する。
- importに `try/catch` を使わない。
- Windows/Mac両対応のため、パス区切りを手書きするスクリプトを増やさない。

## サンプル構造

例として、装着確認モーダルは次のようなpropsにすると、親の状態と表示を分けやすいです。

```tsx
export type EquipConfirmModalProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function EquipConfirmModal(props: EquipConfirmModalProps) {
  if (!props.open) return null;

  return (
    <div role="dialog" aria-modal="true">
      <h2>{props.title}</h2>
      <p>{props.message}</p>
      <button type="button" onClick={props.onCancel}>{props.cancelLabel}</button>
      <button type="button" onClick={props.onConfirm}>{props.confirmLabel}</button>
    </div>
  );
}
```

この例はあくまで形の説明です。既存のARIA、Escキー、背景クリック対応がある場合は消さずに移植してください。

## 実装順序

1. 現在のテストを実行して基準を確認する。
2. `src/components/build-edit/` を作る。
3. 依存が少ない表示部品から切り出す。
4. 1部品切り出すたびにTypeScriptチェックまたはビルドを通す。
5. 最後に `BuildEdit.tsx` の責務が画面組み立て中心になっているか確認する。

## 禁止・注意

- 分割と同時に仕様を変えない。
- 同じ計算を複数コンポーネントへコピーしない。
- 「あとで消す」状態の未使用propsを大量に残さない。
- テストが落ちたまま進めない。
- 既存データ保存形式を変える場合は、必ず移行方針をdocsへ書く。
