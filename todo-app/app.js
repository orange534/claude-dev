// 保存に使うキー（名前）
const STORAGE_KEY = "todos";

// 画面の部品を取得
const form = document.getElementById("todo-form");
const input = document.getElementById("todo-input");
const list = document.getElementById("todo-list");
const count = document.getElementById("todo-count");
const filterButtons = document.querySelectorAll(".filters button");

// データ（TODOの配列）と、今の絞り込み
let todos = loadTodos();
let currentFilter = "all";

// 保存されたTODOを読み込む
function loadTodos() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

// TODOを保存する
function saveTodos() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(todos));
  } catch {
    // 保存できない環境では何もしない
  }
}

// 画面を描き直す
function render() {
  list.innerHTML = "";

  // 絞り込みに合うTODOだけを選ぶ
  const visible = todos.filter((todo) => {
    if (currentFilter === "active") return !todo.done;
    if (currentFilter === "done") return todo.done;
    return true;
  });

  // TODOを1件ずつ <li> にして一覧に入れる
  for (const todo of visible) {
    const li = document.createElement("li");
    if (todo.done) li.classList.add("done");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = todo.done;
    checkbox.addEventListener("change", () => toggleTodo(todo.id));

    const text = document.createElement("span");
    text.className = "text";
    text.textContent = todo.text;

    const del = document.createElement("button");
    del.type = "button";
    del.className = "delete";
    del.textContent = "削除";
    del.addEventListener("click", () => deleteTodo(todo.id));

    li.append(checkbox, text, del);
    list.append(li);
  }

  // 未完了の件数を表示
  const remaining = todos.filter((todo) => !todo.done).length;
  count.textContent = `残り ${remaining} 件`;
}

// 追加
function addTodo(text) {
  todos.push({ id: String(Date.now()), text: text, done: false });
  saveTodos();
  render();
}

// 完了／未完了の切り替え
function toggleTodo(id) {
  const todo = todos.find((t) => t.id === id);
  todo.done = !todo.done;
  saveTodos();
  render();
}

// 削除
function deleteTodo(id) {
  todos = todos.filter((t) => t.id !== id);
  saveTodos();
  render();
}

// 「追加」ボタン（またはEnterキー）が押されたとき
form.addEventListener("submit", (event) => {
  event.preventDefault(); // ページの再読み込みを止める
  const text = input.value.trim();
  if (text === "") return;
  addTodo(text);
  input.value = "";
  input.focus();
});

// 絞り込みボタンが押されたとき
filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    currentFilter = button.dataset.filter;
    filterButtons.forEach((b) => b.classList.remove("active"));
    button.classList.add("active");
    render();
  });
});

// 最初に一度表示する
render();
