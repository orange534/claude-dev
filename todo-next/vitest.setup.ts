// すべてのテストで共通の後片付け。
// テスト同士が影響し合わないように、毎回まっさらな状態に戻す。
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup(); // 描画した画面を片付ける
  localStorage.clear(); // 保存データを消す
  vi.restoreAllMocks(); // vi.spyOn で差し替えたものを元に戻す
});
