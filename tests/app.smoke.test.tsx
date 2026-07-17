// アプリ全体のスモークテスト (jsdom + fake-indexeddb)
// トップ→クラス選択→編成編集→所持登録→装着の一連が動くことを確認する。
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
  // HTMLMediaElement.play
  Object.defineProperty(HTMLMediaElement.prototype, "play", {
    configurable: true,
    value: () => Promise.resolve(),
  });
  Object.defineProperty(HTMLMediaElement.prototype, "pause", {
    configurable: true,
    value: () => {},
  });
});

describe("アプリ一連の流れ", () => {
  it("トップ→クラス選択→編成編集→登録→装着", async () => {
    render(<App />);

    // 仮TOP → スキル秘伝ヒーロー — v0.2 #3: 左=My / 右=Free
    expect(await screen.findByText("スキル秘伝")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /スキル秘伝/ }));
    expect(await screen.findByText("Myスキル秘伝")).toBeTruthy();
    expect(screen.getByText("Freeスキル秘伝")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Myスキル秘伝をひらく" }));

    // S-01 クラス選択
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "クラス選択" })).toBeTruthy()
    );
    const wrCard = await screen.findByRole("button", { name: /ウォーリア/ });
    fireEvent.click(wrCard);

    // S-02 編成編集 (初期編成が自動作成される)
    await waitFor(() =>
      expect(screen.getByText(/ウォーリア — 編成編集/)).toBeTruthy()
    );
    expect(screen.getByText("特別スキル")).toBeTruthy();
    // 下段13番は秘伝対象外表示
    expect(screen.getAllByText("秘伝対象外").length).toBeGreaterThan(0);
    // #4: 初回表示でスキルカードが可視 (revealが .rv のまま残らない)
    await waitFor(() => {
      expect(document.querySelectorAll(".rv:not(.in)").length).toBe(0);
    });

    // S-03 所持秘伝登録
    fireEvent.click(screen.getByRole("button", { name: /所持秘伝$/ }));
    await waitFor(() => expect(screen.getByText("所持秘伝管理")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: /^守護$/ }));
    fireEvent.click(
      await screen.findByRole("button", { name: /スキル使用時スーパーアーマー発動/ })
    );
    fireEvent.click(screen.getByRole("button", { name: /深淵/ }));
    // 既定値の自動確定 (0.1秒 / 0.2秒 の下位)。数値は手入力できない。
    await waitFor(() => expect(screen.getAllByText("0.1秒").length).toBeGreaterThan(0));
    expect(screen.queryByPlaceholderText("例: 5% / 1.5秒 / +1回")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "登録する" }));
    await waitFor(() => expect(screen.getByText("所持秘伝を登録しました")).toBeTruthy());

    // S-02へ戻って装着
    fireEvent.click(screen.getByRole("button", { name: /編成編集$/ }));
    await waitFor(() => expect(screen.getByText(/ウォーリア — 編成編集/)).toBeTruthy());

    // 特1スキルを選択 (WR_sp_1: 反転斬り / 枠2=守護)
    fireEvent.click(screen.getByRole("button", { name: /特1/ }));
    await waitFor(() => expect(screen.getByText(/固定4枠/)).toBeTruthy());

    // トレイの秘伝をクリック → 守護枠(SLOT 2)をクリック
    const tray = screen.getByText("所持秘伝トレイ").closest("aside")!;
    fireEvent.click(
      within(tray as HTMLElement).getByText(/スキル使用時スーパーアーマー発動/)
    );
    const slot2 = screen.getByLabelText("枠2 守護");
    fireEvent.click(slot2);

    // 装着済み表示 & 残数0
    await waitFor(() => {
      expect(within(slot2).getByText(/解除/)).toBeTruthy();
    });
    expect(within(tray as HTMLElement).getByText("使用 1")).toBeTruthy();

    // #5: スロット先行選択フロー (枠クリック→トレイ強調→アイテムクリックで装着)
    fireEvent.click(within(screen.getByLabelText("枠2 守護")).getByText(/解除/));
    await waitFor(() =>
      expect(within(screen.getByLabelText("枠2 守護")).queryByText(/解除/)).toBeNull()
    );
    fireEvent.click(screen.getByLabelText("枠2 守護")); // 枠を先行選択
    await waitFor(() =>
      expect(screen.getByLabelText("枠2 守護").className).toContain("selected")
    );
    const litItem = within(tray as HTMLElement)
      .getByText(/スキル使用時スーパーアーマー発動/)
      .closest("button")!;
    await waitFor(() => expect(litItem.className).toContain("lit"));
    fireEvent.click(litItem);
    await waitFor(() =>
      expect(within(screen.getByLabelText("枠2 守護")).getByText(/解除/)).toBeTruthy()
    );

    cleanup();
  }, 20000);
});
