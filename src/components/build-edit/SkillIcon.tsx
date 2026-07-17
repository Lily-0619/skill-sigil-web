/**
 * スキルアイコン表示 (v0.2 #10: 2枚スキルの重ね表示)。
 * 画像が2枚ある場合(前面/背面)は同じ枠内で両方85%サイズに縮小し、少し重ねて表示する。
 * 枠自体のサイズは1枚スキルと同じ(.icon-frameのCSSはそのまま)。
 */
export function SkillIcon({ urls, noImageLabel }: { urls: string[]; noImageLabel: string }) {
  if (urls.length === 0) return <span className="noimg">{noImageLabel}</span>;
  if (urls.length === 1) return <img src={urls[0]} alt="" loading="lazy" />;
  return (
    <>
      <img className="icon-layer icon-layer-back" src={urls[1]} alt="" loading="lazy" />
      <img className="icon-layer icon-layer-front" src={urls[0]} alt="" loading="lazy" />
    </>
  );
}
