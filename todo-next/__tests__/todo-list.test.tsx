import { describe, expect, test, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TodoList from "../app/todo-list";

// 本番コードと同じ保存キー
const STORAGE_KEY = "todos";

// localStorage に保存データを入れてから TodoList を表示する
function renderWithSaved(saved: string) {
  localStorage.setItem(STORAGE_KEY, saved);
  render(<TodoList />);
}

// 入力欄に文字を入れて「追加」ボタンを押す
async function addTodo(user: ReturnType<typeof userEvent.setup>, text: string) {
  await user.type(screen.getByPlaceholderText("やることを入力"), text);
  await user.click(screen.getByRole("button", { name: "追加" }));
}

// 一覧に表示されている TODO の文字を、上から順に取り出す（0件なら空の配列）
function visibleTodoTexts() {
  return screen.queryAllByRole("listitem").map((li) => li.textContent?.replace(/削除$/, ""));
}

// 一覧のチェックボックスを、上から順に取り出す
function checkboxes() {
  return screen.queryAllByRole("checkbox") as HTMLInputElement[];
}

// 一覧のチェック状態（完了なら true）を、上から順に取り出す
function checkedStates() {
  return checkboxes().map((checkbox) => checkbox.checked);
}

// localStorage に保存されているデータを取り出す（何も保存されていなければ null）
function readStored(): unknown {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved === null ? null : JSON.parse(saved);
}

// 絞り込みボタンを押す
async function selectFilter(
  user: ReturnType<typeof userEvent.setup>,
  name: "すべて" | "未完了" | "完了",
) {
  await user.click(screen.getByRole("button", { name }));
}

// テストでよく使う保存済みデータ（未完了・完了・未完了の3件）
const SAMPLE_TODOS = [
  { id: "id-1", text: "牛乳を買う", done: false },
  { id: "id-2", text: "パンを買う", done: true },
  { id: "id-3", text: "卵を買う", done: false },
];

describe("不具合1: 保存データの読み込み", () => {
  describe("保存データが配列でないとき、空のリストとして表示する", () => {
    test.each([
      ["null", "null"],
      ["オブジェクト", "{}"],
      ["文字列", '"abc"'],
      ["数値", "123"],
      ["真偽値", "true"],
    ])("%s（%s）が保存されていても画面が表示され、0件になる", (_label, saved) => {
      renderWithSaved(saved);

      expect(screen.queryAllByRole("listitem")).toHaveLength(0);
      expect(screen.getByText("残り 0 件")).toBeDefined();
      expect(screen.getByPlaceholderText("やることを入力")).toBeDefined();
    });

    test("配列でないデータが保存されていても、新しいTODOを追加して配列として保存できる", async () => {
      const user = userEvent.setup();
      renderWithSaved("{}");

      await addTodo(user, "牛乳を買う");

      expect(visibleTodoTexts()).toEqual(["牛乳を買う"]);
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "");
      expect(Array.isArray(stored)).toBe(true);
      expect(stored).toHaveLength(1);
      expect(stored[0]).toMatchObject({ text: "牛乳を買う", done: false });
    });
  });

  describe("配列の中に不正な要素があるとき、その要素だけを読み飛ばす", () => {
    // 正しい形のTODO（これだけが表示されるはず）
    const valid = { id: "valid-1", text: "正しいTODO", done: false };

    test.each([
      ["null", null],
      ["文字列", "牛乳を買う"],
      ["数値", 42],
      ["配列", ["a", "b"]],
      ["空のオブジェクト", {}],
      ["id がない", { text: "idなし", done: false }],
      ["id が数値", { id: 1, text: "idが数値", done: false }],
      ["text がない", { id: "x", done: false }],
      ["text が数値", { id: "x", text: 123, done: false }],
      ["done がない", { id: "x", text: "doneなし" }],
      ["done が文字列", { id: "x", text: "doneが文字列", done: "true" }],
    ])("不正な要素（%s）は表示せず、正しい要素だけを表示する", (_label, invalid) => {
      renderWithSaved(JSON.stringify([invalid, valid]));

      expect(visibleTodoTexts()).toEqual(["正しいTODO"]);
      expect(screen.getByText("残り 1 件")).toBeDefined();
    });
  });
});

describe("不具合2: 同じ1ミリ秒の間に追加したTODOのID", () => {
  // Date.now() を固定して「同じ1ミリ秒の間に2件追加した」状況を再現する
  function freezeDateNow() {
    vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
  }

  test("2件のTODOには、それぞれ別のIDが付いて保存される", async () => {
    freezeDateNow();
    const user = userEvent.setup();
    render(<TodoList />);

    await addTodo(user, "牛乳を買う");
    await addTodo(user, "パンを買う");

    const stored: { id: string }[] = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    expect(stored).toHaveLength(2);
    expect(stored[0].id).not.toBe(stored[1].id);
  });

  test("1件目だけを完了にしたとき、2件目は未完了のまま", async () => {
    freezeDateNow();
    const user = userEvent.setup();
    render(<TodoList />);

    await addTodo(user, "牛乳を買う");
    await addTodo(user, "パンを買う");
    const [first, second] = screen.getAllByRole("checkbox") as HTMLInputElement[];
    await user.click(first);

    expect(first.checked).toBe(true);
    expect(second.checked).toBe(false);
    expect(screen.getByText("残り 1 件")).toBeDefined();
  });

  test("1件目だけを削除したとき、2件目は残る", async () => {
    freezeDateNow();
    const user = userEvent.setup();
    render(<TodoList />);

    await addTodo(user, "牛乳を買う");
    await addTodo(user, "パンを買う");
    await user.click(screen.getAllByRole("button", { name: "削除" })[0]);

    expect(visibleTodoTexts()).toEqual(["パンを買う"]);
    expect(screen.getByText("残り 1 件")).toBeDefined();
  });
});

// ─────────────────────────────────────────────
// ここから正常系（と、その境界値・異常系）のテスト
// ─────────────────────────────────────────────

describe("追加", () => {
  test("ボタンで追加すると一覧に表示され、入力欄が空になり、残り件数が1になる", async () => {
    const user = userEvent.setup();
    render(<TodoList />);

    await addTodo(user, "牛乳を買う");

    expect(visibleTodoTexts()).toEqual(["牛乳を買う"]);
    expect(checkedStates()).toEqual([false]);
    expect((screen.getByPlaceholderText("やることを入力") as HTMLInputElement).value).toBe("");
    expect(screen.getByText("残り 1 件")).toBeDefined();
  });

  test("Enterキーでも追加できる", async () => {
    const user = userEvent.setup();
    render(<TodoList />);

    await user.type(screen.getByPlaceholderText("やることを入力"), "牛乳を買う{Enter}");

    expect(visibleTodoTexts()).toEqual(["牛乳を買う"]);
    expect(screen.getByText("残り 1 件")).toBeDefined();
  });

  test("3件追加すると、入力した順に並び、残り件数が3になる", async () => {
    const user = userEvent.setup();
    render(<TodoList />);

    await addTodo(user, "牛乳を買う");
    await addTodo(user, "パンを買う");
    await addTodo(user, "卵を買う");

    expect(visibleTodoTexts()).toEqual(["牛乳を買う", "パンを買う", "卵を買う"]);
    expect(screen.getByText("残り 3 件")).toBeDefined();
  });

  test("前後の空白は取り除いて追加・保存される", async () => {
    const user = userEvent.setup();
    render(<TodoList />);

    await addTodo(user, "  牛乳を買う  ");

    expect(visibleTodoTexts()).toEqual(["牛乳を買う"]);
    expect(readStored()).toEqual([{ id: expect.any(String), text: "牛乳を買う", done: false }]);
  });

  test("空白だけの入力では追加されず、保存もされない", async () => {
    const user = userEvent.setup();
    render(<TodoList />);

    await addTodo(user, "   ");

    expect(visibleTodoTexts()).toEqual([]);
    expect(screen.getByText("残り 0 件")).toBeDefined();
    expect(readStored()).toBeNull();
  });

  test("空のままボタンを押しても追加されず、保存もされない", async () => {
    const user = userEvent.setup();
    render(<TodoList />);

    await user.click(screen.getByRole("button", { name: "追加" }));

    expect(visibleTodoTexts()).toEqual([]);
    expect(screen.getByText("残り 0 件")).toBeDefined();
    expect(readStored()).toBeNull();
  });
});

describe("完了の切り替え", () => {
  test("チェックすると完了になり、残り件数が1減る", async () => {
    const user = userEvent.setup();
    renderWithSaved(JSON.stringify(SAMPLE_TODOS));
    expect(screen.getByText("残り 2 件")).toBeDefined();

    await user.click(checkboxes()[0]);

    expect(checkedStates()).toEqual([true, true, false]);
    expect(screen.getByText("残り 1 件")).toBeDefined();
  });

  test("完了したTODOをもう一度チェックすると未完了に戻り、残り件数も戻る", async () => {
    const user = userEvent.setup();
    renderWithSaved(JSON.stringify(SAMPLE_TODOS));

    await user.click(checkboxes()[1]); // 「パンを買う」は完了済み

    expect(checkedStates()).toEqual([false, false, false]);
    expect(screen.getByText("残り 3 件")).toBeDefined();
  });

  test("すべて完了にすると、残り件数が0になる", async () => {
    const user = userEvent.setup();
    renderWithSaved(JSON.stringify(SAMPLE_TODOS));

    await user.click(checkboxes()[0]);
    await user.click(checkboxes()[2]);

    expect(checkedStates()).toEqual([true, true, true]);
    expect(screen.getByText("残り 0 件")).toBeDefined();
  });
});

describe("削除", () => {
  test("未完了のTODOを削除すると一覧から消え、残り件数が1減る", async () => {
    const user = userEvent.setup();
    renderWithSaved(JSON.stringify(SAMPLE_TODOS));

    await user.click(screen.getAllByRole("button", { name: "削除" })[0]); // 「牛乳を買う」

    expect(visibleTodoTexts()).toEqual(["パンを買う", "卵を買う"]);
    expect(screen.getByText("残り 1 件")).toBeDefined();
  });

  test("完了したTODOを削除しても、残り件数は変わらない", async () => {
    const user = userEvent.setup();
    renderWithSaved(JSON.stringify(SAMPLE_TODOS));

    await user.click(screen.getAllByRole("button", { name: "削除" })[1]); // 「パンを買う」（完了済み）

    expect(visibleTodoTexts()).toEqual(["牛乳を買う", "卵を買う"]);
    expect(screen.getByText("残り 2 件")).toBeDefined();
  });

  test("同じ文字のTODOが2件あるとき、削除ボタンを押したほうだけが消える", async () => {
    const user = userEvent.setup();
    render(<TodoList />);
    await addTodo(user, "牛乳を買う");
    await addTodo(user, "牛乳を買う");
    // 見分けがつくように、2件目だけを完了にしておく
    await user.click(checkboxes()[1]);

    await user.click(screen.getAllByRole("button", { name: "削除" })[0]);

    expect(visibleTodoTexts()).toEqual(["牛乳を買う"]);
    expect(checkedStates()).toEqual([true]); // 残ったのは完了にした2件目
    expect(screen.getByText("残り 0 件")).toBeDefined();
  });

  test("すべて削除すると一覧が空になり、残り件数が0になる", async () => {
    const user = userEvent.setup();
    renderWithSaved(JSON.stringify(SAMPLE_TODOS));

    for (let i = 0; i < SAMPLE_TODOS.length; i++) {
      await user.click(screen.getAllByRole("button", { name: "削除" })[0]);
    }

    expect(visibleTodoTexts()).toEqual([]);
    expect(screen.getByText("残り 0 件")).toBeDefined();
  });
});

describe("絞り込み", () => {
  test("「未完了」を選ぶと、未完了のTODOだけが表示される", async () => {
    const user = userEvent.setup();
    renderWithSaved(JSON.stringify(SAMPLE_TODOS));

    await selectFilter(user, "未完了");

    expect(visibleTodoTexts()).toEqual(["牛乳を買う", "卵を買う"]);
    expect(checkedStates()).toEqual([false, false]);
  });

  test("「完了」を選ぶと、完了したTODOだけが表示される", async () => {
    const user = userEvent.setup();
    renderWithSaved(JSON.stringify(SAMPLE_TODOS));

    await selectFilter(user, "完了");

    expect(visibleTodoTexts()).toEqual(["パンを買う"]);
    expect(checkedStates()).toEqual([true]);
  });

  test("「すべて」に戻すと、すべてのTODOが元の順番で表示される", async () => {
    const user = userEvent.setup();
    renderWithSaved(JSON.stringify(SAMPLE_TODOS));

    await selectFilter(user, "完了");
    await selectFilter(user, "すべて");

    expect(visibleTodoTexts()).toEqual(["牛乳を買う", "パンを買う", "卵を買う"]);
  });

  test("絞り込んでいても、残り件数は全体の未完了の数を表示する", async () => {
    const user = userEvent.setup();
    renderWithSaved(JSON.stringify(SAMPLE_TODOS));

    await selectFilter(user, "完了");

    expect(visibleTodoTexts()).toHaveLength(1);
    expect(screen.getByText("残り 2 件")).toBeDefined();
  });

  test("「完了」の表示中に追加すると、一覧には出ないが残り件数は増え、「すべて」で表示される", async () => {
    const user = userEvent.setup();
    renderWithSaved(JSON.stringify(SAMPLE_TODOS));
    await selectFilter(user, "完了");

    await addTodo(user, "りんごを買う");

    expect(visibleTodoTexts()).toEqual(["パンを買う"]);
    expect(screen.getByText("残り 3 件")).toBeDefined();

    await selectFilter(user, "すべて");
    expect(visibleTodoTexts()).toEqual(["牛乳を買う", "パンを買う", "卵を買う", "りんごを買う"]);
  });

  test("「未完了」の表示中にTODOを完了にすると、一覧から消える", async () => {
    const user = userEvent.setup();
    renderWithSaved(JSON.stringify(SAMPLE_TODOS));
    await selectFilter(user, "未完了");

    await user.click(checkboxes()[0]); // 「牛乳を買う」を完了にする

    expect(visibleTodoTexts()).toEqual(["卵を買う"]);
    expect(screen.getByText("残り 1 件")).toBeDefined();
  });

  test("当てはまるTODOがない絞り込みでは、一覧が空になる", async () => {
    const user = userEvent.setup();
    renderWithSaved(JSON.stringify([{ id: "id-1", text: "牛乳を買う", done: false }]));

    await selectFilter(user, "完了");

    expect(visibleTodoTexts()).toEqual([]);
    expect(screen.getByText("残り 1 件")).toBeDefined();
  });
});

describe("localStorage への保存と再読み込み", () => {
  test("追加すると、id・text・done を持つTODOの配列として保存される", async () => {
    const user = userEvent.setup();
    render(<TodoList />);

    await addTodo(user, "牛乳を買う");
    await addTodo(user, "パンを買う");

    expect(readStored()).toEqual([
      { id: expect.any(String), text: "牛乳を買う", done: false },
      { id: expect.any(String), text: "パンを買う", done: false },
    ]);
  });

  test("完了にすると、そのTODOだけが done: true で保存される", async () => {
    const user = userEvent.setup();
    renderWithSaved(JSON.stringify(SAMPLE_TODOS));

    await user.click(checkboxes()[0]);

    expect(readStored()).toEqual([
      { id: "id-1", text: "牛乳を買う", done: true },
      { id: "id-2", text: "パンを買う", done: true },
      { id: "id-3", text: "卵を買う", done: false },
    ]);
  });

  test("削除すると、保存データからもそのTODOだけが消える", async () => {
    const user = userEvent.setup();
    renderWithSaved(JSON.stringify(SAMPLE_TODOS));

    await user.click(screen.getAllByRole("button", { name: "削除" })[1]);

    expect(readStored()).toEqual([
      { id: "id-1", text: "牛乳を買う", done: false },
      { id: "id-3", text: "卵を買う", done: false },
    ]);
  });

  test("保存済みのデータを読み込むと、順番・チェック状態・残り件数が正しく表示される", () => {
    renderWithSaved(JSON.stringify(SAMPLE_TODOS));

    expect(visibleTodoTexts()).toEqual(["牛乳を買う", "パンを買う", "卵を買う"]);
    expect(checkedStates()).toEqual([false, true, false]);
    expect(screen.getByText("残り 2 件")).toBeDefined();
  });

  test("追加・完了・削除をしたあとに開き直すと、同じ状態が復元される", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<TodoList />);
    await addTodo(user, "牛乳を買う");
    await addTodo(user, "パンを買う");
    await addTodo(user, "卵を買う");
    await user.click(checkboxes()[1]); // 「パンを買う」を完了
    await user.click(screen.getAllByRole("button", { name: "削除" })[0]); // 「牛乳を買う」を削除

    // 画面を閉じて、もう一度開く（ページの再読み込みと同じ状況）
    unmount();
    render(<TodoList />);

    expect(visibleTodoTexts()).toEqual(["パンを買う", "卵を買う"]);
    expect(checkedStates()).toEqual([true, false]);
    expect(screen.getByText("残り 1 件")).toBeDefined();
  });
});

describe("localStorage が使えないときの動き", () => {
  // 書き込みで例外を起こす（容量オーバーなどで保存できない状況）
  function makeSetItemFail() {
    return vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("保存できません", "QuotaExceededError");
    });
  }

  test("保存に失敗しても、追加したTODOは画面に表示される", async () => {
    const user = userEvent.setup();
    const setItem = makeSetItemFail();
    render(<TodoList />);

    await addTodo(user, "牛乳を買う");

    expect(setItem).toHaveBeenCalled(); // 保存しようとはした
    expect(visibleTodoTexts()).toEqual(["牛乳を買う"]);
    expect(screen.getByText("残り 1 件")).toBeDefined();
    expect(readStored()).toBeNull(); // 実際には保存されていない
  });

  test("保存に失敗しても、完了の切り替えは画面に反映される", async () => {
    const user = userEvent.setup();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(SAMPLE_TODOS));
    const setItem = makeSetItemFail();
    render(<TodoList />);

    await user.click(checkboxes()[0]);

    expect(setItem).toHaveBeenCalled();
    expect(checkedStates()).toEqual([true, true, false]);
    expect(screen.getByText("残り 1 件")).toBeDefined();
    expect(readStored()).toEqual(SAMPLE_TODOS); // 保存データは変わっていない
  });

  test("保存に失敗しても、削除は画面に反映される", async () => {
    const user = userEvent.setup();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(SAMPLE_TODOS));
    const setItem = makeSetItemFail();
    render(<TodoList />);

    await user.click(screen.getAllByRole("button", { name: "削除" })[0]);

    expect(setItem).toHaveBeenCalled();
    expect(visibleTodoTexts()).toEqual(["パンを買う", "卵を買う"]);
    expect(screen.getByText("残り 1 件")).toBeDefined();
    expect(readStored()).toEqual(SAMPLE_TODOS); // 保存データは変わっていない
  });

  test("読み込みで例外が出ても、空のリストで表示され、TODOを追加できる", async () => {
    const user = userEvent.setup();
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("読み込めません", "SecurityError");
    });
    render(<TodoList />);

    expect(visibleTodoTexts()).toEqual([]);
    expect(screen.getByText("残り 0 件")).toBeDefined();

    await addTodo(user, "牛乳を買う");
    expect(visibleTodoTexts()).toEqual(["牛乳を買う"]);
  });

  test("壊れたJSONが保存されていても、空のリストで表示される", () => {
    renderWithSaved("{abc");

    expect(visibleTodoTexts()).toEqual([]);
    expect(screen.getByText("残り 0 件")).toBeDefined();
  });
});
