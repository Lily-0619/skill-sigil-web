import type { InventoryItem } from "../../types";
import { Modal } from "../ui";

export interface PendingEquip {
  skillId: string;
  slotNo: number;
  item: InventoryItem;
  kind: "move" | "replace";
  moveFrom?: { skillId: string; slotNo: number };
  replaceName?: string;
}

export function EquipConfirmModal({
  pending,
  skillName,
  onCancel,
  onConfirm,
}: {
  pending: PendingEquip;
  skillName: (id: string) => string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal
      title={pending.kind === "move" ? "秘伝の移動" : "秘伝の置き換え"}
      onClose={onCancel}
      actions={
        <>
          <button className="btn ghost" onClick={onCancel}>
            キャンセル
          </button>
          <button className="btn primary" onClick={onConfirm}>
            {pending.kind === "move" ? "移動して装着" : "置き換える"}
          </button>
        </>
      }
    >
      {pending.kind === "move" && pending.moveFrom ? (
        <p>
          この秘伝は残数0で、現在
          <strong>「{skillName(pending.moveFrom.skillId)}」枠{pending.moveFrom.slotNo}</strong>
          に装着中です。
          <br />
          外して「{skillName(pending.skillId)}」枠{pending.slotNo}へ移動しますか？
        </p>
      ) : (
        <p>
          この枠には<strong>「{pending.replaceName}」</strong>が装着済みです。
          <br />
          選択中の秘伝に置き換えますか？(元の秘伝は残数へ戻ります)
        </p>
      )}
    </Modal>
  );
}
