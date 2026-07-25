// TOPカードの水ガラス描画レイヤー (2026-07-25)
// シェーダーの中身と手法は liquidGlassShader.ts を参照。
// このファイルはWebGL2の準備・毎フレームの計測・入力(ホバー/ポインタ)を担う。
//
// カード矩形は毎フレーム計測する。カードはホバーで translateY するため、
// 固定値だとガラス板だけ取り残されて浮いてしまう。
import { useEffect, useRef } from "react";
import { GLASS_FRAG, GLASS_VERT, MAX_GLASS_CARDS } from "./liquidGlassShader";

/** カード要素の目印 (TopPage側で付ける) */
export const GLASS_CARD_ATTR = "data-glass-card";
/** 立ち絵img要素の目印。CSSの実寸をそのまま使うため、DOMから測る */
export const GLASS_BGIMG_ATTR = "data-glass-bgimg";

const DPR_CAP = 1.75;

type Props = {
  /** .top-page 要素 */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** WebGL2で描き始められたとき (カードのCSSを切り替える合図) */
  onReady?: () => void;
};

export default function LiquidGlassCards({ containerRef, onReady }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const readyRef = useRef(onReady);
  readyRef.current = onReady;

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = containerRef.current;
    if (!canvas || !host) return;

    const gl = canvas.getContext("webgl2", {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: "low-power",
    });
    // WebGL2が無い環境ではcanvasを出さず、CSSの見た目のまま(フォールバック)
    if (!gl) return;

    const compile = (type: number, src: string): WebGLShader | null => {
      const s = gl.createShader(type);
      if (!s) return null;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.warn("[LiquidGlass] シェーダーのコンパイルに失敗:", gl.getShaderInfoLog(s));
        gl.deleteShader(s);
        return null;
      }
      return s;
    };

    const vs = compile(gl.VERTEX_SHADER, GLASS_VERT);
    const fs = compile(gl.FRAGMENT_SHADER, GLASS_FRAG);
    if (!vs || !fs) return;

    const prog = gl.createProgram();
    if (!prog) return;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.warn("[LiquidGlass] リンクに失敗:", gl.getProgramInfoLog(prog));
      gl.deleteProgram(prog);
      return;
    }
    gl.useProgram(prog);

    const u = (name: string) => gl.getUniformLocation(prog, name);
    const uSize = u("uSize");
    const uDpr = u("uDpr");
    const uTime = u("uTime");
    const uChar = u("uChar");
    const uCharRect = u("uCharRect");
    const uCharOn = u("uCharOn");
    const uCard = u("uCard");
    const uHover = u("uHover");
    const uCardCount = u("uCardCount");
    const uPointer = u("uPointer");
    const uPointerOn = u("uPointerOn");

    // 立ち絵テクスチャ。読み込むまでは1x1の透明で代用する
    const tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(
      gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
      new Uint8Array([0, 0, 0, 0])
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.uniform1i(uChar, 0);

    const bgImg = host.querySelector<HTMLImageElement>(`[${GLASS_BGIMG_ATTR}]`);
    let charLoaded = false;

    const uploadChar = () => {
      if (!bgImg || !bgImg.naturalWidth) return;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bgImg);
      charLoaded = true;
      // 立ち絵は初回フレームに間に合わないことがある。届いた時点で描き直す
      render(performance.now());
    };

    // ---- 入力 ----
    const hover = new Float32Array(MAX_GLASS_CARDS);
    const hoverTarget = new Float32Array(MAX_GLASS_CARDS);
    const rects = new Float32Array(MAX_GLASS_CARDS * 4);
    let pointer: [number, number] = [-9999, -9999];
    let pointerOn = 0;
    let pointerTarget = 0;

    let cards = Array.from(
      host.querySelectorAll<HTMLElement>(`[${GLASS_CARD_ATTR}]`)
    ).slice(0, MAX_GLASS_CARDS);

    const enterHandlers: Array<() => void> = [];
    const leaveHandlers: Array<() => void> = [];
    cards.forEach((el, i) => {
      const onEnter = () => { hoverTarget[i] = 1; };
      const onLeave = () => { hoverTarget[i] = 0; };
      enterHandlers.push(onEnter);
      leaveHandlers.push(onLeave);
      el.addEventListener("pointerenter", onEnter);
      el.addEventListener("pointerleave", onLeave);
      el.addEventListener("focus", onEnter);
      el.addEventListener("blur", onLeave);
    });

    const onMove = (e: PointerEvent) => {
      const r = host.getBoundingClientRect();
      pointer = [e.clientX - r.left, e.clientY - r.top];
      pointerTarget = 1;
    };
    const onLeaveHost = () => { pointerTarget = 0; };
    host.addEventListener("pointermove", onMove);
    host.addEventListener("pointerleave", onLeaveHost);

    // ---- ループ ----
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t0 = performance.now();
    let raf = 0;
    let cssW = 0;
    let cssH = 0;
    let started = false;

    const render = (now: number) => {
      const hostRect = host.getBoundingClientRect();
      const w = Math.max(1, Math.round(hostRect.width));
      const h = Math.max(1, Math.round(hostRect.height));
      const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);

      if (w !== cssW || h !== cssH) {
        cssW = w;
        cssH = h;
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        gl.viewport(0, 0, canvas.width, canvas.height);
      }

      // カードが増減した場合に拾い直す
      if (cards.length === 0) {
        cards = Array.from(
          host.querySelectorAll<HTMLElement>(`[${GLASS_CARD_ATTR}]`)
        ).slice(0, MAX_GLASS_CARDS);
      }

      // カード矩形をホスト相対で毎フレーム計測 (ホバーの浮きに追従させる)
      for (let i = 0; i < cards.length; i++) {
        const r = cards[i].getBoundingClientRect();
        rects[i * 4 + 0] = r.left - hostRect.left;
        rects[i * 4 + 1] = r.top - hostRect.top;
        rects[i * 4 + 2] = r.width;
        rects[i * 4 + 3] = r.height;
      }

      // ホバーとポインタを補間
      const k = 0.12;
      for (let i = 0; i < MAX_GLASS_CARDS; i++) {
        hover[i] += (hoverTarget[i] - hover[i]) * k;
      }
      pointerOn += (pointerTarget - pointerOn) * k;

      // 立ち絵の描画矩形。CSSのobject-fit:containを実寸から求める
      let charOn = 0;
      let cx = 0, cy = 0, cw = 1, chh = 1;
      if (charLoaded && bgImg && bgImg.naturalWidth > 0) {
        const b = bgImg.getBoundingClientRect();
        const boxW = b.width;
        const boxH = b.height;
        const scale = Math.min(boxW / bgImg.naturalWidth, boxH / bgImg.naturalHeight);
        cw = bgImg.naturalWidth * scale;
        chh = bgImg.naturalHeight * scale;
        cx = b.left - hostRect.left + (boxW - cw) / 2;
        cy = b.top - hostRect.top + (boxH - chh) / 2;
        charOn = 1;
      }

      gl.uniform2f(uSize, cssW, cssH);
      gl.uniform1f(uDpr, dpr);
      gl.uniform1f(uTime, reduceMotion ? 0 : (now - t0) / 1000);
      gl.uniform4f(uCharRect, cx, cy, cw, chh);
      gl.uniform1f(uCharOn, charOn);
      gl.uniform4fv(uCard, rects);
      gl.uniform1fv(uHover, hover);
      gl.uniform1i(uCardCount, cards.length);
      gl.uniform2f(uPointer, pointer[0], pointer[1]);
      gl.uniform1f(uPointerOn, pointerOn);

      gl.drawArrays(gl.TRIANGLES, 0, 3);

      // 1枚目を描き終えてからフェードイン (背景の描き替えが見えないように)
      if (!started) {
        started = true;
        canvas.classList.add("on");
        readyRef.current?.();
      }
    };

    // 1枚目はrAFを待たずに描く (初期表示のちらつき防止 / 非表示タブでも寸法を確定させる)
    render(performance.now());

    if (bgImg) {
      if (bgImg.complete) uploadChar();
      else bgImg.addEventListener("load", uploadChar, { once: true });
    }

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      render(now);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      host.removeEventListener("pointermove", onMove);
      host.removeEventListener("pointerleave", onLeaveHost);
      cards.forEach((el, i) => {
        el.removeEventListener("pointerenter", enterHandlers[i]);
        el.removeEventListener("pointerleave", leaveHandlers[i]);
        el.removeEventListener("focus", enterHandlers[i]);
        el.removeEventListener("blur", leaveHandlers[i]);
      });
      if (bgImg) bgImg.removeEventListener("load", uploadChar);
      gl.deleteTexture(tex);
      gl.deleteProgram(prog);
    };
  }, [containerRef]);

  return <canvas ref={canvasRef} className="top-glass" aria-hidden />;
}
