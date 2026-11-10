// この部品はブラウザで動く（クリックや入力に反応する）ので Client Component にする
"use client";

import { use, useState, type FormEvent } from "react";
import { browser } from "react-dom";
import styles from "./page.module.css";

// TODO 1件分のデータの形
type Todo = {
  id: string;
  text: string;
  done: boolean;
};

// 絞り込みの種類
type Filter = "all" | "active" | "done";

// 絞り込みボタンの一覧（表示する文字と種類の組み合わせ）
const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "すべて" },
  { value: "active", label: "未完了" },
  { value: "done", label: "完了" },
];

// 保存に使うキー（名前）
const STORAGE_KEY = "todos";

// 正しい形のTODOかどうかを調べる
// （id と text が文字列で、done が true / false のときだけ正しい）
function isTodo(value: unknown): value is Todo {
  if (typeof value !== "object" || value === null) return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.id === "string" &&
    typeof item.text === "string" &&
    typeof item.done === "boolean"
  );
}

// 保存されたTODOを読み込む
function loadTodos(): Todo[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return [];

    const data: unknown = JSON.parse(saved);
    // 配列でなければ、空のリストとして扱う
    if (!Array.isArray(data)) return [];
    // 配列の中の不正な要素だけを読み飛ばし、正しいTODOは残す
    return data.filter(isTodo);
  } catch {
    // 壊れたJSONや、localStorage が使えない環境では空のリストにする
    return [];
  }
}

// TODOを保存する
function saveTodos(todos: Todo[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
  } catch {
    // 保存できない環境では何もしない
  }
}

export default function TodoList() {
  // localStorage はブラウザにしかないので、この部品はブラウザだけで表示する。
  // サーバー側（ビルド時）ではここで止まり、page.tsx の <Suspense> の
  // fallback（「読み込み中…」）が代わりに表示される。
  use(browser("TODOはブラウザの localStorage に保存されています。"));

  // ここから下はブラウザでだけ動くので、localStorage を直接読んでよい。
  // useState に関数を渡すと、最初の1回だけ実行されて初期値になる。
  const [todos, setTodos] = useState<Todo[]>(loadTodos);
  const [filter, setFilter] = useState<Filter>("all");
  const [input, setInput] = useState("");

  // TODOの配列を新しくして、画面と保存の両方に反映する。
  // （前のアプリの render() のような描き直しは、React が自動でやってくれる）
  function updateTodos(next: Todo[]) {
    setTodos(next);
    saveTodos(next);
  }

  // 「追加」ボタン（またはEnterキー）が押されたとき
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); // ページの再読み込みを止める
    const text = input.trim();
    if (text === "") return;
    // ID は crypto.randomUUID() で作る（同じ1ミリ秒に追加しても重ならない）
    updateTodos([...todos, { id: crypto.randomUUID(), text, done: false }]);
    setInput("");
  }

  // 完了／未完了の切り替え（元の配列は変えずに、新しい配列を作る）
  function toggleTodo(id: string) {
    updateTodos(
      todos.map((todo) =>
        todo.id === id ? { ...todo, done: !todo.done } : todo,
      ),
    );
  }

  // 削除
  function deleteTodo(id: string) {
    updateTodos(todos.filter((todo) => todo.id !== id));
  }

  // 絞り込みに合うTODOだけを選ぶ
  const visible = todos.filter((todo) => {
    if (filter === "active") return !todo.done;
    if (filter === "done") return todo.done;
    return true;
  });

  // 未完了の件数
  const remaining = todos.filter((todo) => !todo.done).length;

  return (
    <>
      {/* 入力フォーム */}
      <form className={styles.form} onSubmit={handleSubmit}>
        <input
          type="text"
          className={styles.input}
          placeholder="やることを入力"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          required
          autoFocus
        />
        <button type="submit" className={styles.addButton}>
          追加
        </button>
      </form>

      {/* 絞り込みボタン */}
      <div className={styles.filters}>
        {FILTERS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            className={filter === value ? styles.active : undefined}
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* TODO一覧：配列を <li> の並びに変換して表示する */}
      <ul className={styles.list}>
        {visible.map((todo) => (
          <li key={todo.id} className={todo.done ? styles.done : undefined}>
            <input
              type="checkbox"
              checked={todo.done}
              onChange={() => toggleTodo(todo.id)}
            />
            <span className={styles.text}>{todo.text}</span>
            <button
              type="button"
              className={styles.deleteButton}
              onClick={() => deleteTodo(todo.id)}
            >
              削除
            </button>
          </li>
        ))}
      </ul>

      {/* 残りの件数 */}
      <p className={styles.count}>残り {remaining} 件</p>
    </>
  );
}
