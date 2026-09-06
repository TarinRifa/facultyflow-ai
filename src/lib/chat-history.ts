import "server-only";
import { db } from "./db";
import type { ChatReply } from "./ai/schema";

export async function appendChat(
  userId: string,
  role: "user" | "assistant",
  text: string,
  reply?: ChatReply,
) {
  return (
    await db.query(
      "insert into public.chat_messages(user_id,role,text,tasks,actions) values($1,$2,$3,$4,$5) returning id,role,text,tasks,actions,created_at",
      [
        userId,
        role,
        text,
        JSON.stringify(reply?.tasks || []),
        JSON.stringify(reply?.actions || []),
      ],
    )
  ).rows[0];
}
export async function chatHistory(userId: string, before?: string) {
  const rows = (
    await db.query(
      "select id,role,text,tasks,actions,created_at from public.chat_messages where user_id=$1 and ($2::bigint is null or id<$2) order by id desc limit 51",
      [userId, before || null],
    )
  ).rows;
  const hasMore = rows.length > 50;
  const page = rows.slice(0, 50).reverse();
  const pending = (
    await db.query(
      "select id from public.assistant_actions where user_id=$1 and status='pending' and expires_at>now()",
      [userId],
    )
  ).rows;
  const allowed = new Set(pending.map((a) => a.id));
  return {
    messages: page.map((m) => ({
      ...m,
      actions: m.actions.filter((a: { id: string }) => allowed.has(a.id)),
    })),
    nextCursor: hasMore ? page[0].id : null,
  };
}
export async function chatContext(userId: string) {
  return (
    await db.query(
      "select role,left(text,1000) text from public.chat_messages where user_id=$1 order by id desc limit 6",
      [userId],
    )
  ).rows.reverse();
}
