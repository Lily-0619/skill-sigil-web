type EditorSavePayload = {
  classCode: string;
  skillId: string;
  skill: {
    name: string; ct: string; hit: string; pve: boolean; pvp: boolean;
    sa: boolean; fg: boolean; enhancement: boolean; slots: string[]; description: string;
  };
  passives: Array<{ weapon: string; uniqueBody: string; commonPassive: string }>;
  commonPassives: Array<{ name: string; body: string }>;
};

interface Window {
  skillEditor?: {
    save(payload: EditorSavePayload): Promise<{ ok: boolean; message?: string }>;
    publish(): Promise<{ ok: boolean; cancelled?: boolean; message?: string }>;
  };
}
