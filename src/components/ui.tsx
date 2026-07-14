// 共通UI部品: モーダル / トースト / チップ / ステッパー / 空状態
import React, { useEffect } from "react";
import type { Master, Rarity } from "../types";
import { useStore } from "../state/store";

// ---- モーダル -------------------------------------------------------------------

export function Modal({
  title,
  children,
  actions,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  actions: React.ReactNode;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <h3>{title}</h3>
        <div className="body">{children}</div>
        <div className="actions">{actions}</div>
      </div>
    </div>
  );
}

// ---- トースト -------------------------------------------------------------------

export function ToastHost() {
  const { toasts, dismissToast } = useStore();
  if (toasts.length === 0) return null;
  return (
    <div className="toast-wrap" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}>
          <span>{t.text}</span>
          <button onClick={() => dismissToast(t.id)} aria-label="閉じる">
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

// ---- チップ ---------------------------------------------------------------------

export function RarityChip({
  master,
  rarity,
}: {
  master: Master;
  rarity: Rarity;
}) {
  const def = master.rarities.find((r) => r.id === rarity);
  return (
    <span className={`chip rarity-${rarity}`}>{def?.name ?? rarity}</span>
  );
}

export function TypeChip({
  master,
  typeId,
}: {
  master: Master;
  typeId: string;
}) {
  const def = master.sigil_types.find((t) => t.id === typeId);
  return (
    <span className="chip type">
      <span className="dot" style={{ background: def?.color ?? "#888" }} />
      {def?.name ?? typeId}
    </span>
  );
}

// ---- ステッパー ------------------------------------------------------------------

export function Stepper({
  value,
  min = 1,
  onChange,
}: {
  value: number;
  min?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="stepper">
      <button
        type="button"
        aria-label="減らす"
        disabled={value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        −
      </button>
      <input
        type="text"
        inputMode="numeric"
        value={value}
        aria-label="所持数"
        onChange={(e) => {
          const n = parseInt(e.target.value, 10);
          if (Number.isFinite(n)) onChange(Math.max(min, n));
        }}
      />
      <button
        type="button"
        aria-label="増やす"
        onClick={() => onChange(value + 1)}
      >
        ＋
      </button>
    </div>
  );
}

// ---- 空状態 ---------------------------------------------------------------------

export function EmptyState({
  en,
  children,
}: {
  en: string;
  children: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="en">{en}</span>
      {children}
    </div>
  );
}
