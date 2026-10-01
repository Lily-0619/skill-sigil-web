type EditorSavePayload = {
  classCode: string;
  skillId: string;
  skill: {
    name: string; group: "special" | "normal"; displayNo: string; stack: string; ct: string; hit: string; pve: boolean; pvp: boolean;
    ia: boolean; sa: boolean; fg: boolean; enhancement: boolean; slots: string[]; description: string; privateNote: string;
    iconPath?: string;
  };
  passives: Array<{ weapon: string; weaponKo: string; weaponEn: string; uniqueBody: string; commonPassive: string }>;
  commonPassives: Array<{ name: string; body: string }>;
};

interface Window {
  skillEditor?: {
    loadMetadata(): Promise<{
      skill_icon_paths?: Record<string, string>;
      common_passives?: Array<{ name: string; body: string }>;
      excel_skill_stacks?: Record<string, string>;
      excel_skill_names?: Record<string, { ko: string; en: string }>;
      classes?: Record<string, {
        common_passives?: Array<{ name: string; body: string }>;
        passive_assignments?: Array<{ weapon?: string; weapon_ko?: string; weapon_en?: string; common_passive?: string; unique_body?: string }>;
        skill_flags?: Record<string, { ia?: boolean; sa?: boolean; fg?: boolean; enhancement?: boolean }>;
        skill_notes?: Record<string, string>;
        update_history?: string;
      }>;
    }>;
    getFilePath(file: File): string;
    previewImage(data: unknown): Promise<{ ok: boolean; message?: string }>;
    exportImage(data: unknown): Promise<{ ok: boolean; cancelled?: boolean; message?: string; filePath?: string }>;
    exportAllImages(data: unknown): Promise<{ ok: boolean; cancelled?: boolean; message?: string; filePath?: string; svgPath?: string }>;
    save(payload: EditorSavePayload): Promise<{ ok: boolean; message?: string; iconPath?: string }>;
    saveClass(payload: Pick<EditorSavePayload, "classCode" | "passives" | "commonPassives">): Promise<{ ok: boolean; message?: string }>;
    saveCommonPassives(items: Array<{ name: string; body: string }>): Promise<{ ok: boolean; message?: string; commonPassives: Array<{ name: string; body: string }> }>;
    saveUpdateHistories(histories: Record<string, string>): Promise<{ ok: boolean; message?: string }>;
    publish(): Promise<{ ok: boolean; cancelled?: boolean; message?: string }>;
  };
}
