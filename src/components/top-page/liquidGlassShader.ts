// TOPカードを「水ガラス板」として描くWebGL2シェーダー (2026-07-25)
//
// 手法 (すべて自前実装):
//   1. 背景(CSSのグラデーション2枚 + キャラ立ち絵 + 覆いのグラデーション2枚)を
//      シェーダー内で再現する。板の内外を同じ関数から描くので継ぎ目が出ない。
//   2. カード矩形に「厚みの高さ場」を作る。縁は円弧ベベルで急に立ち上がり、内側は
//      液体のゆらぎ(サイン波の合成)とポインタからの波紋で揺れる。
//   3. 高さ場を1px差分で微分して法線を求め、スネルの法則で視線を屈折させる。
//      屈折方向で背景を再サンプルするので、後ろの立ち絵やグラデーションが歪む。
//   4. 波長ごとに屈折率をずらしてR/G/Bを別座標から取り、縁に色分散(虹)を出す。
//   5. 厚みぶんの光路長でビール・ランベルト吸収をかけ、厚い所ほど色が沈む。
//   6. フレネルで反射成分を混ぜ、鏡面ハイライトと縁の集光を足す。
//
// ぼかし(backdrop-filter)ではなく、光路を解いて背景座標をずらしている点が要。

export const GLASS_VERT = `#version 300 es
// 頂点バッファ無しの全画面トライアングル
void main() {
  int id = gl_VertexID;
  vec2 v = vec2(float((id << 1) & 2), float(id & 2));
  gl_Position = vec4(v * 2.0 - 1.0, 0.0, 1.0);
}
`;

export const MAX_GLASS_CARDS = 4;

export const GLASS_FRAG = `#version 300 es
precision highp float;

#define MAX_CARDS ${MAX_GLASS_CARDS}

uniform vec2      uSize;       // TOP全体のCSSピクセルサイズ
uniform float     uDpr;
uniform float     uTime;       // 秒
uniform sampler2D uChar;       // キャラ立ち絵
uniform vec4      uCharRect;   // 立ち絵の描画矩形 x,y,w,h (CSS px)
uniform float     uCharOn;
uniform vec4      uCard[MAX_CARDS];   // カード矩形 x,y,w,h (CSS px)
uniform float     uHover[MAX_CARDS];  // ホバー量 0..1
uniform int        uCardCount;
uniform vec2      uPointer;    // ポインタ位置 (CSS px)
uniform float     uPointerOn;  // 0..1

out vec4 fragColor;

const vec3 DEEP = vec3(  7.0,   9.0,  15.0) / 255.0;  // #07090f
const vec3 NAVY = vec3( 17.0,  24.0,  39.0) / 255.0;  // #111827
const vec3 PINK = vec3(236.0, 166.0, 183.0) / 255.0;  // #eca6b7

// CSSのlinear-gradient(角度deg)における位置 t (0..1)。
// CSSは0deg=上向き / 90deg=右向き。画面座標(yは下向き)での方向は (sin, -cos)。
float lgT(vec2 p, vec2 s, float deg) {
  float a = radians(deg);
  vec2 dir = vec2(sin(a), -cos(a));
  float len = abs(s.x * sin(a)) + abs(s.y * cos(a));
  return dot(p - s * 0.5, dir) / max(len, 1.0) + 0.5;
}

// top-page.css の背景を再現する。
// veil = 覆いのグラデーションの効き (1.0=CSSのまま)。板の内側では弱めて、
// 後ろの立ち絵を水越しに透かす (ガラスが光を集める見立て)。
vec3 background(vec2 p, float veil) {
  vec2 s = uSize;

  // .top-page: linear-gradient(135deg, #07090f 0%, #111827 45%, #07090f 100%)
  float t = clamp(lgT(p, s, 135.0), 0.0, 1.0);
  vec3 col = t < 0.45 ? mix(DEEP, NAVY, t / 0.45)
                      : mix(NAVY, DEEP, (t - 0.45) / 0.55);

  // .top-page: radial-gradient(70% 90% at 78% 46%, rgba(236,166,183,.18), transparent 58%)
  vec2 rc = vec2(0.78, 0.46) * s;
  vec2 rr = vec2(0.70, 0.90) * s;
  float rd = length((p - rc) / max(rr, vec2(1.0)));
  col = mix(col, PINK, 0.18 * clamp(1.0 - rd / 0.58, 0.0, 1.0));

  // .top-bg img: opacity .8 / filter saturate(.72) brightness(.9)
  vec2 cuv = (p - uCharRect.xy) / max(uCharRect.zw, vec2(1.0));
  vec4 tex = texture(uChar, clamp(cuv, 0.0, 1.0));
  float inside = step(0.0, cuv.x) * step(cuv.x, 1.0)
               * step(0.0, cuv.y) * step(cuv.y, 1.0);
  float lum = dot(tex.rgb, vec3(0.213, 0.715, 0.072));
  vec3 ch = (lum + (tex.rgb - lum) * 0.72) * 0.9;
  col = mix(col, ch, tex.a * 0.8 * inside * uCharOn);

  // .top-bg::after 下段: linear-gradient(0deg, rgba(7,9,15,.88) 0%, transparent 48%)
  float tv = clamp(lgT(p, s, 0.0), 0.0, 1.0);
  col = mix(col, DEEP, 0.88 * clamp(1.0 - tv / 0.48, 0.0, 1.0) * veil);

  // .top-bg::after 上段: linear-gradient(90deg, .95 0%, .7 44%, .25 100%)
  float th = clamp(p.x / max(s.x, 1.0), 0.0, 1.0);
  float av = th < 0.44 ? mix(0.95, 0.70, th / 0.44)
                       : mix(0.70, 0.25, (th - 0.44) / 0.56);
  col = mix(col, DEEP, av * veil);

  return col;
}

// 映り込む環境。v=0で空(明るい)、v=1で水底(暗い)。
// 反射方向で引くので、ゆらぎに応じて明暗の帯が動く = 水面に見える鍵。
vec3 envAt(float v) {
  vec3 sky  = mix(vec3(0.11, 0.14, 0.20), PINK * 0.60, 0.35);
  vec3 deep = vec3(0.028, 0.038, 0.062);
  return mix(sky, deep, smoothstep(0.0, 1.0, v));
}

float sdRoundBox(vec2 p, vec2 b, float r) {
  vec2 q = abs(p) - b + r;
  return min(max(q.x, q.y), 0.0) + length(max(q, 0.0)) - r;
}

// 水面の輪郭。表面張力で縁がわずかに息をする
float cardSD(vec2 p, vec4 card) {
  vec2 c = card.xy + card.zw * 0.5;
  float d = sdRoundBox(p - c, card.zw * 0.5, 3.0);
  float a = atan(p.y - c.y, p.x - c.x);
  d += 0.9 * sin(a * 3.0 + uTime * 0.90)
     + 0.6 * sin(a * 5.0 - uTime * 0.62);
  return d;
}

// 厚み(px)。縁=円弧ベベル / 内側=液体のゆらぎ + ポインタ波紋
float cardH(vec2 p, vec4 card, float hov) {
  float d = cardSD(p, card);
  float e = mix(24.0, 34.0, hov);   // ベベル幅
  float T = mix(15.0, 27.0, hov);   // 中央の厚み
  float s = clamp(-d / e, 0.0, 1.0);
  float bevel = sqrt(max(0.0, 1.0 - (1.0 - s) * (1.0 - s)));
  float h = T * bevel;

  // 液体のゆらぎ。傾きが映り込みの明暗を動かすので、振幅より「勾配」が効く
  float amp = mix(1.6, 3.4, hov);
  float w = sin(p.x * 0.045 + uTime * 1.10) * sin(p.y * 0.038 - uTime * 0.80)
          + 0.60 * sin((p.x + p.y) * 0.030 + uTime * 1.60)
          + 0.35 * sin(p.x * 0.080 - p.y * 0.065 + uTime * 2.10);
  h += amp * w * smoothstep(0.0, 0.35, s);

  float pr = length(p - uPointer);
  h += uPointerOn * mix(0.8, 1.8, hov)
     * sin(pr * 0.16 - uTime * 5.0) * exp(-pr / 90.0)
     * smoothstep(0.0, 0.30, s);

  return h;
}

void main() {
  // gl_FragCoordは左下原点。CSSピクセル(左上原点)へ直す
  vec2 p = vec2(gl_FragCoord.x / uDpr, uSize.y - gl_FragCoord.y / uDpr);

  vec3 col = background(p, 1.0);

  // この画素が属するカード(最も内側)を選ぶ
  int idx = -1;
  float best = 1e9;
  for (int i = 0; i < MAX_CARDS; i++) {
    if (i >= uCardCount) break;
    float d = cardSD(p, uCard[i]);
    if (d < best) { best = d; idx = i; }
  }

  if (idx >= 0 && best < 40.0) {
    vec4 card = uCard[idx];
    float hov = uHover[idx];

    // 板の外側へ落ちる集光(コースティクス)
    col += PINK * 0.045 * exp(-max(best, 0.0) / 7.0) * step(0.0, best);

    // 高さ場を1px差分で微分 → 法線
    float h0 = cardH(p, card, hov);
    float hx = cardH(p + vec2(1.0, 0.0), card, hov);
    float hy = cardH(p + vec2(0.0, 1.0), card, hov);
    vec3 N = normalize(vec3(-(hx - h0), -(hy - h0), 1.0));

    vec3 I = vec3(0.0, 0.0, -1.0);   // 視線
    float n = 1.333;                 // 水の屈折率(ナトリウムD線)
    float disp = 0.014;              // 波長分散

    // 板の内側は覆いを弱め、後ろの立ち絵を水越しに透かす
    float veil = mix(0.72, 0.60, hov);

    // R/G/Bで屈折率を変え、別座標から背景を取る → 縁に虹
    vec3 refr = vec3(0.0);
    float path = 0.0;
    for (int k = 0; k < 3; k++) {
      float eta = 1.0 / (n + (float(k) - 1.0) * disp);
      vec3 rd = refract(I, N, eta);
      float pl = max(h0, 0.0) / max(-rd.z, 1e-3);
      vec3 smp = background(p + rd.xy * pl, veil);
      if (k == 0)      { refr.r = smp.r; path = pl; }
      else if (k == 1) { refr.g = smp.g; }
      else             { refr.b = smp.b; }
    }

    // 厚みぶんの吸収 (ビール・ランベルト)。赤を多く吸って水らしく沈ませる
    refr *= exp(-vec3(0.013, 0.006, 0.008) * path);

    // フレネル反射。反射方向で環境を引くので、ゆらぎが明暗の帯として動く
    float F0 = 0.0203;   // ((1-1.333)/(1+1.333))^2
    float fres = F0 + (1.0 - F0) * pow(1.0 - max(dot(N, -I), 0.0), 5.0);
    vec3 Rv = reflect(I, N);
    vec3 env = envAt(clamp(0.5 - Rv.y * 1.8, 0.0, 1.0));
    // 平らな中央でも水面として見えるよう、映り込みの下限を残す
    float sheen = clamp(mix(0.30, 0.38, hov) + 0.62 * fres, 0.0, 1.0);

    vec3 L = normalize(vec3(-0.45, -0.80, 0.75));
    float ldot = max(dot(Rv, L), 0.0);
    float spec  = pow(ldot, 46.0);   // 鋭いハイライト
    float glint = pow(ldot, 9.0);    // ゆらぎに沿って走る鈍い光

    vec3 glass = mix(refr, env, sheen);
    glass += spec  * mix(0.55, 1.00, hov) * vec3(1.00, 0.94, 0.96);
    glass += glint * mix(0.05, 0.10, hov) * vec3(0.90, 0.95, 1.00);
    // 縁の集光(メニスカス)
    glass += PINK * mix(0.14, 0.26, hov) * exp(-abs(best + 3.0) / 2.6);

    float aa = 1.0 - smoothstep(-1.0, 0.6, best);
    col = mix(col, glass, aa);
  }

  fragColor = vec4(col, 1.0);
}
`;
