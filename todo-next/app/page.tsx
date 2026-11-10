// このページ自体は Server Component（"use client" を書かない）。
// 見出しなど動かない部分はサーバー側で HTML になり、
// ブラウザでしか動かない TodoList だけを <Suspense> で囲む。
import { Suspense } from "react";
import TodoList from "./todo-list";
import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={styles.page}>
      <main className={styles.container}>
        <h1 className={styles.title}>TODOアプリ</h1>

        {/* TodoList の準備ができるまで fallback を表示する */}
        <Suspense fallback={<p className={styles.loading}>読み込み中…</p>}>
          <TodoList />
        </Suspense>
      </main>
    </div>
  );
}
