// v0.2 #3/#7 スモークテスト (jsdom + fake-indexeddb)
// Freeモード: 所持登録0件のまま理想編成が組めること。
// 編成管理: クラス未選択でも開け、クラス横断で一覧できること。
// @vitest-environment jsdom
import "fake-indexeddb/auto";
import React from "react";
import { beforeAll, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import App from "../src/App";

beforeAll(() => {
  // jsdomに無いAPIの補完
  if (!("IntersectionObserver" in globalThis)) {
    class IO {
      constructor(cb: IntersectionObserverCallback) {
        this.cb = cb;
      }
      cb: IntersectionObserverCallback;
      observe(el: Element) {
        this.cb(
          [{ isIntersecting: true, target: el } as IntersectionObserverEntry],
          this as unknown as IntersectionObserver
        );
      }
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    }
    // @ts-expect-error 補完
    globalThis.IntersectionObserver = IO;
  }
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (q: string) => ({
      matches: false,
      media: q,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent() {
        return false;
      },
    }),
  });
  window.scrollTo = () => {};
  Object.defineProperty(HTMLMediaElement.prototype, "play", {
    configurable: true,
    value: () => Promise.resolve(),
  });
  Object.defineProperty(HTMLMediaElement.prototype, "pause", {
    configurable: true,
    value: () => {},
  });
});

describe("Freeモードと編成一括管理", () => {
  it("所持0件のままFree編成を組み、編成管理で横断表示できる", async () => {
    render(<App />);

    // トップ右パネルからFreeで入る
    expect(await screen.findByText("Freeスキル秘伝")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Freeスキル秘伝をひらく" }));

    // v0.2 #7: クラス未選択でも編成管理が開ける
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "クラス選択" })).toBeTruthy()
    );
    const manageNav = screen.getByRole("button", { name: /編成管理/ });
    expect((manageNav as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(manageNav);
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "編成管理" })).toBeTruthy()
    );
    expect(screen.getByText(/まだ編成がありません/)).toBeTruthy();

    // クラス選択からFree編成へ
    fireEvent.click(screen.getByRole("button", { name: /クラス選択/ }));
    const wrCard = await screen.findByRole("button", { name: /ウォーリア/ });
    fireEvent.click(wrCard);

    // S-02 Freeモード: FREEバッジ + 秘伝カタログ (所持登録は0件のまま)
    await waitFor(() =>
      expect(screen.getByText(/ウォーリア — 編成編集/)).toBeTruthy()
    );
    expect(screen.getAllByText("FREE").length).toBeGreaterThan(0);
    expect(screen.getByText("秘伝カタログ")).toBeTruthy();

    // 特1スキルを選択 → カタログから効果を選択 → 守護枠(SLOT 2)へ装着
    fireEvent.click(screen.getByRole("button", { name: /特1/ }));
    await waitFor(() => expect(screen.getByText(/固定4枠/)).toBeTruthy());

    const catalog = screen.getByText("秘伝カタログ").closest("aside")!;
    fireEvent.click(
      within(catalog as HTMLElement).getByText(/スキル使用時スーパーアーマー発動/)
    );
    // 等級ピッカーが出る (深淵のみの効果)
    expect(within(catalog as HTMLElement).getByText("等級")).toBeTruthy();

    const slot2 = screen.getByLabelText("枠2 守護");
    fireEvent.click(slot2);
    await waitFor(() => {
      expect(within(slot2).getByText(/解除/)).toBeTruthy();
    });

    // #5: スロット先行選択もFreeカタログで機能する (枠3=無欠を選択→カタログ強調)
    const slot3 = screen.getByLabelText(/^枠3 /);
    fireEvent.click(slot3);
    await waitFor(() =>
      expect(slot3.className).toContain("selected")
    );
    const litItems = (catalog as HTMLElement).querySelectorAll(".cat-item.lit");
    expect(litItems.length).toBeGreaterThan(0);
    fireEvent.click(litItems[0] as HTMLElement);
    await waitFor(() => {
      expect(within(slot3).getByText(/解除/)).toBeTruthy();
    });

    // 編成管理: Free編成がFREEバッジ+クラス略称つきで表示される
    fireEvent.click(screen.getByRole("button", { name: /編成管理/ }));
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "編成管理" })).toBeTruthy()
    );
    // 編成名はヘッダーとカードの両方に出る
    expect(screen.getAllByText("Free編成 1").length).toBeGreaterThan(0);
    const cards = document.querySelectorAll(".build-card");
    expect(cards.length).toBe(1);
    expect(within(cards[0] as HTMLElement).getByText("FREE")).toBeTruthy();
    expect(within(cards[0] as HTMLElement).getByText("WR")).toBeTruthy();
    expect(within(cards[0] as HTMLElement).getByText(/装着 2 \/ 64 枠/)).toBeTruthy();

    // ひらく → S-02 Freeモードへ戻る
    fireEvent.click(within(cards[0] as HTMLElement).getByRole("button", { name: "ひらく" }));
    await waitFor(() =>
      expect(screen.getByText(/ウォーリア — 編成編集/)).toBeTruthy()
    );
    expect(screen.getByText("秘伝カタログ")).toBeTruthy();

    cleanup();
  }, 20000);
});
