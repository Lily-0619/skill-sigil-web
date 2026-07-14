let counter = 0;

/** 一意ID生成 (時刻 + 乱数 + 連番) */
export function uid(prefix: string): string {
  counter = (counter + 1) % 10000;
  return `${prefix}_${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2, 7)}${counter.toString(36)}`;
}

export const nowIso = () => new Date().toISOString();
