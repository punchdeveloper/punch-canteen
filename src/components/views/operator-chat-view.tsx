"use client";
/**
 * Operator chat (v63 "operator-chat" view): conversation list on the side,
 * the open conversation in the middle. Opens the most recent conversation by
 * default (v63 opened the oldest — N9) and refreshes every 5 s.
 */
import useSWR from "swr";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useApp } from "@/components/providers";
import { fmt } from "@/components/page-head";
import { apiSend, fetcher } from "@/lib/client/api";
import type { OperatorChatData } from "@/server/loaders";

export function OperatorChatView({ initial }: { initial: OperatorChatData }) {
  const { refreshMe, toast } = useApp();
  const [selected, setSelected] = useState<string | null>(initial.activeUserId);
  const { data, mutate } = useSWR<{ chat: OperatorChatData }>(
    `/api/operator/chat${selected ? `?user=${selected}` : ""}`,
    fetcher,
    { fallbackData: selected === initial.activeUserId ? { chat: initial } : undefined, refreshInterval: 5000, onSuccess: () => refreshMe() },
  );
  const chat = data?.chat ?? initial;
  const activeId = chat.activeUserId;
  const active = chat.conversations.find((c) => c.userId === activeId);
  const activeName = active?.name ?? "Staff member";
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [chat.messages.length, activeId]);

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!text.trim() || !activeId) return;
    setBusy(true);
    try {
      await apiSend("/api/operator/chat", "POST", { userId: activeId, message: text.trim() });
      setText("");
      await mutate();
      toast(`Reply sent to ${activeName}`);
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="operator-chat">
      <div className="operator-chat-main">
        <div className="eyebrow">CANTEEN OPERATOR</div>
        <h1>Canteen Chat</h1>
        <p className="muted">
          {activeId ? (
            <>
              Conversation with <strong>{activeName}</strong>
            </>
          ) : (
            "Staff conversations will appear here when messages arrive."
          )}
        </p>
        <div className="operator-chat-log" ref={logRef} aria-live="polite">
          {activeId ? (
            chat.messages.length ? (
              chat.messages.map((m) => (
                <div key={m.id} className={`chat-bubble ${m.senderRole === "staff" ? "staff" : "operator"}`}>
                  <strong>{m.senderRole === "staff" ? activeName : "Canteen Operator"}</strong>
                  <br />
                  {m.message}
                  <div className="chat-meta">{fmt.chat(m.createdAt)}</div>
                </div>
              ))
            ) : (
              <div className="empty">No messages in this conversation yet.</div>
            )
          ) : (
            <div className="empty">No staff conversations yet.</div>
          )}
        </div>
        {activeId ? (
          <form className="operator-chat-form" onSubmit={send}>
            <input
              id="operator-chat-input"
              required
              maxLength={500}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={`Reply to ${activeName}...`}
              aria-label="Reply to staff"
            />
            <button className="btn" type="submit" disabled={busy}>
              {busy ? "Sending…" : "Send"}
            </button>
          </form>
        ) : null}
      </div>
      <aside className="operator-chat-side">
        <div className="panel-head">
          <h3>Staff conversations</h3>
          <button className="text-btn" type="button" onClick={() => mutate().then(() => toast("Chat refreshed"))}>
            ↻ Refresh messages
          </button>
        </div>
        {chat.conversations.length ? (
          chat.conversations.map((c) => (
            <button
              key={c.userId}
              type="button"
              className={`btn ${c.userId === activeId ? "" : "secondary"} operator-thread`}
              style={{ width: "100%", margin: "0 0 8px", textAlign: "left", display: "block" }}
              onClick={() => setSelected(c.userId)}
            >
              {c.name}
              {c.unread && c.userId !== activeId ? <span className="chat-unread-badge">{c.unread}</span> : null}
              <br />
              <small>{c.preview}</small>
            </button>
          ))
        ) : (
          <p className="muted">New staff messages will appear here.</p>
        )}
      </aside>
    </section>
  );
}
