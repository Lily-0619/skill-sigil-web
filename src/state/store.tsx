// アプリ状態管理 + IndexedDB自動保存 (docs/02 F-011)
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import masterJson from "../data/master.json";
import type {
  Build,
  BuildMode,
  EquippedSigil,
  InventoryItem,
  Master,
  Rarity,
  UserData,
} from "../types";
import { emptyUserData } from "../types";
import { idbGet, idbSet, KEY_USER_DATA } from "../lib/db";
import { uid, nowIso } from "../lib/ids";

export const master = masterJson as unknown as Master;

// ---- Reducer ------------------------------------------------------------------

export type Action =
  | { type: "LOADED"; data: UserData }
  | { type: "REGISTER_ITEM"; item: InventoryItem }
  | { type: "UPDATE_ITEM"; inventoryId: string; patch: Partial<InventoryItem> }
  | { type: "DELETE_ITEM"; inventoryId: string }
  | {
      type: "EQUIP";
      buildId: string;
      skillId: string;
      slotNo: number;
      inventoryId: string;
      /** 同一編成内の移動元(付け替え時) */
      moveFrom?: { skillId: string; slotNo: number };
    }
  | { type: "UNEQUIP"; buildId: string; skillId: string; slotNo: number }
  /** v0.2 #3: Free編成の装着(効果を直接参照・所持数制限なし) */
  | {
      type: "FREE_EQUIP";
      buildId: string;
      skillId: string;
      slotNo: number;
      effectId: string;
      rarity: Rarity;
      valueText: string;
    }
  | { type: "FREE_UNEQUIP"; buildId: string; skillId: string; slotNo: number }
  | { type: "CREATE_BUILD"; build: Build }
  | { type: "DUP_BUILD"; sourceId: string; build: Build }
  | { type: "RENAME_BUILD"; buildId: string; name: string }
  | { type: "DELETE_BUILD"; buildId: string; replacement?: Build }
  | { type: "SELECT_CLASS"; classId: string | null }
  | { type: "SELECT_BUILD"; buildId: string | null }
  /** v0.2 #7: 編成のクラスと編成を同時選択 (SELECT_CLASSのbuildクリア副作用を回避) */
  | { type: "OPEN_BUILD"; buildId: string }
  | { type: "SET_LAST_EXPORT"; at: string }
  | { type: "SET_LAST_BACKUP"; at: string }
  | { type: "SET_LAST_CHARACTER"; path: string | null }
  | { type: "REPLACE_ALL"; data: UserData };

const touchBuild = (builds: Build[], buildId: string): Build[] =>
  builds.map((b) =>
    b.build_id === buildId ? { ...b, updated_at: nowIso() } : b
  );

export function reducer(state: UserData, action: Action): UserData {
  switch (action.type) {
    case "LOADED":
    case "REPLACE_ALL":
      // v0.2 #3 migration: 既存データに mode / freeEquips を補完
      return {
        ...action.data,
        builds: action.data.builds.map((b) => ({
          ...b,
          mode: b.mode ?? "my",
        })),
        freeEquips: action.data.freeEquips ?? [],
      };

    case "REGISTER_ITEM":
      return { ...state, inventory: [...state.inventory, action.item] };

    case "UPDATE_ITEM":
      return {
        ...state,
        inventory: state.inventory.map((i) =>
          i.inventory_id === action.inventoryId
            ? { ...i, ...action.patch, updated_at: nowIso() }
            : i
        ),
      };

    case "DELETE_ITEM":
      return {
        ...state,
        inventory: state.inventory.filter(
          (i) => i.inventory_id !== action.inventoryId
        ),
        equips: state.equips.filter(
          (e) => e.inventory_id !== action.inventoryId
        ),
      };

    case "EQUIP": {
      let equips = state.equips;
      if (action.moveFrom) {
        equips = equips.filter(
          (e) =>
            !(
              e.build_id === action.buildId &&
              e.skill_id === action.moveFrom!.skillId &&
              e.slot_no === action.moveFrom!.slotNo &&
              e.inventory_id === action.inventoryId
            )
        );
      }
      // 対象枠に既に装着済みなら置き換え
      equips = equips.filter(
        (e) =>
          !(
            e.build_id === action.buildId &&
            e.skill_id === action.skillId &&
            e.slot_no === action.slotNo
          )
      );
      const next: EquippedSigil = {
        build_id: action.buildId,
        skill_id: action.skillId,
        slot_no: action.slotNo,
        inventory_id: action.inventoryId,
      };
      return {
        ...state,
        equips: [...equips, next],
        builds: touchBuild(state.builds, action.buildId),
      };
    }

    case "UNEQUIP":
      return {
        ...state,
        equips: state.equips.filter(
          (e) =>
            !(
              e.build_id === action.buildId &&
              e.skill_id === action.skillId &&
              e.slot_no === action.slotNo
            )
        ),
        builds: touchBuild(state.builds, action.buildId),
      };

    case "FREE_EQUIP": {
      const freeEquips = state.freeEquips.filter(
        (e) =>
          !(
            e.build_id === action.buildId &&
            e.skill_id === action.skillId &&
            e.slot_no === action.slotNo
          )
      );
      freeEquips.push({
        build_id: action.buildId,
        skill_id: action.skillId,
        slot_no: action.slotNo,
        effect_id: action.effectId,
        rarity: action.rarity,
        value_text: action.valueText,
      });
      return {
        ...state,
        freeEquips,
        builds: touchBuild(state.builds, action.buildId),
      };
    }

    case "FREE_UNEQUIP":
      return {
        ...state,
        freeEquips: state.freeEquips.filter(
          (e) =>
            !(
              e.build_id === action.buildId &&
              e.skill_id === action.skillId &&
              e.slot_no === action.slotNo
            )
        ),
        builds: touchBuild(state.builds, action.buildId),
      };

    case "CREATE_BUILD":
      return {
        ...state,
        builds: [...state.builds, action.build],
        meta: { ...state.meta, selected_build_id: action.build.build_id },
      };

    case "DUP_BUILD": {
      const copies = state.equips
        .filter((e) => e.build_id === action.sourceId)
        .map((e) => ({ ...e, build_id: action.build.build_id }));
      const freeCopies = state.freeEquips
        .filter((e) => e.build_id === action.sourceId)
        .map((e) => ({ ...e, build_id: action.build.build_id }));
      return {
        ...state,
        builds: [...state.builds, action.build],
        equips: [...state.equips, ...copies],
        freeEquips: [...state.freeEquips, ...freeCopies],
        meta: { ...state.meta, selected_build_id: action.build.build_id },
      };
    }

    case "RENAME_BUILD":
      return {
        ...state,
        builds: state.builds.map((b) =>
          b.build_id === action.buildId
            ? { ...b, name: action.name, updated_at: nowIso() }
            : b
        ),
      };

    case "DELETE_BUILD": {
      const builds = state.builds.filter((b) => b.build_id !== action.buildId);
      const equips = state.equips.filter((e) => e.build_id !== action.buildId);
      const freeEquips = state.freeEquips.filter(
        (e) => e.build_id !== action.buildId
      );
      if (action.replacement) builds.push(action.replacement);
      const selected =
        state.meta.selected_build_id === action.buildId
          ? action.replacement?.build_id ?? null
          : state.meta.selected_build_id;
      return {
        ...state,
        builds,
        equips,
        freeEquips,
        meta: { ...state.meta, selected_build_id: selected },
      };
    }

    case "SELECT_CLASS":
      return {
        ...state,
        meta: {
          ...state.meta,
          selected_class_id: action.classId,
          selected_build_id: null,
        },
      };

    case "SELECT_BUILD":
      return {
        ...state,
        meta: { ...state.meta, selected_build_id: action.buildId },
      };

    case "OPEN_BUILD": {
      const b = state.builds.find((x) => x.build_id === action.buildId);
      if (!b) return state;
      return {
        ...state,
        meta: {
          ...state.meta,
          selected_class_id: b.class_id,
          selected_build_id: b.build_id,
        },
      };
    }

    case "SET_LAST_EXPORT":
      return { ...state, meta: { ...state.meta, last_export_at: action.at } };
    case "SET_LAST_BACKUP":
      return { ...state, meta: { ...state.meta, last_backup_at: action.at } };
    case "SET_LAST_CHARACTER":
      return {
        ...state,
        meta: { ...state.meta, last_character_image: action.path },
      };

    default:
      return state;
  }
}

// ---- ヘルパー(アクション生成) ---------------------------------------------------

export const newBuild = (
  classId: string,
  name: string,
  mode: BuildMode = "my"
): Build => ({
  build_id: uid("build"),
  class_id: classId,
  name,
  mode,
  created_at: nowIso(),
  updated_at: nowIso(),
});

export const newItem = (
  p: Omit<InventoryItem, "inventory_id" | "created_at" | "updated_at">
): InventoryItem => ({
  ...p,
  inventory_id: uid("inv"),
  created_at: nowIso(),
  updated_at: nowIso(),
});

// ---- Context ------------------------------------------------------------------

export type SaveStatus =
  | { state: "idle" }
  | { state: "saving" }
  | { state: "saved"; at: Date }
  | { state: "error"; message: string };

export interface Toast {
  id: number;
  kind: "success" | "error" | "info";
  text: string;
}

interface StoreCtx {
  data: UserData;
  dispatch: React.Dispatch<Action>;
  saveStatus: SaveStatus;
  loaded: boolean;
  toasts: Toast[];
  toast: (kind: Toast["kind"], text: string) => void;
  dismissToast: (id: number) => void;
}

const Ctx = createContext<StoreCtx | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [data, dispatch] = useReducer(reducer, undefined, emptyUserData);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({ state: "idle" });
  const [loaded, setLoaded] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastSeq = useRef(0);
  const skipNextSave = useRef(true);
  const saveTimer = useRef<ReturnType<typeof setTimeout>>();

  const toast = useCallback((kind: Toast["kind"], text: string) => {
    const id = ++toastSeq.current;
    setToasts((t) => [...t, { id, kind, text }]);
    window.setTimeout(
      () => setToasts((t) => t.filter((x) => x.id !== id)),
      kind === "error" ? 6000 : 3200
    );
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  // 初期ロード
  useEffect(() => {
    (async () => {
      try {
        const saved = await idbGet<UserData>(KEY_USER_DATA);
        if (saved) {
          skipNextSave.current = true;
          dispatch({
            type: "LOADED",
            data: {
              ...emptyUserData(),
              ...saved,
              meta: { ...emptyUserData().meta, ...saved.meta },
            },
          });
        }
      } catch (e) {
        toast("error", "保存データの読み込みに失敗しました。ブラウザ設定をご確認ください。");
      } finally {
        setLoaded(true);
      }
    })();
  }, [toast]);

  // 自動保存 (編集完了単位・300msデバウンス)
  useEffect(() => {
    if (!loaded) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    setSaveStatus({ state: "saving" });
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await idbSet(KEY_USER_DATA, data);
        setSaveStatus({ state: "saved", at: new Date() });
      } catch (e) {
        setSaveStatus({
          state: "error",
          message: "保存に失敗しました。Excelバックアップをおすすめします。",
        });
      }
    }, 300);
    return () => clearTimeout(saveTimer.current);
  }, [data, loaded]);

  const value = useMemo(
    () => ({ data, dispatch, saveStatus, loaded, toasts, toast, dismissToast }),
    [data, saveStatus, loaded, toasts, toast, dismissToast]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): StoreCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("StoreProvider missing");
  return ctx;
}
