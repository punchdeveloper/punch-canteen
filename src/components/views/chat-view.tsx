"use client";
/**
 * Canteen Chat for staff (v63 "chat" view). New replies appear on their own
 * (refreshes every 5 s) and opening the chat clears the unread badge.
 */
import useSWR from "swr";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useApp } from "@/components/providers";
import { PageHead, fmt } from "@/components/page-head";
import { apiSend, fetcher } from "@/lib/client/api";
import type { ChatMessageDto } from "@/server/loaders";

export function ChatView({ initial }: { initial: ChatMessageDto[] }) {
  const { refreshMe, toast } = useApp();
  const { data, mutate } = useSWR<{ messages: ChatMessageDto[] }>("/api/chat", fetcher, {
    fallbackData: { messages: initial },
    refreshInterval: 5000,
    onSuccess: () => refreshMe(),
  });
  const messages = data?.messages ?? [];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const logRef = useRef<HTMLDivElement>(null);

  // Keep the newest message in view.
  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [messages.length]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const message = String(new FormData(form).get("message") || "").trim();
    if (!message) return;
    setBusy(true);
    setError("");
    try {
      await apiSend("/api/chat", "POST", { message });
      form.reset();
      await mutate();
      toast("Message sent to Canteen Operator");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function refresh() {
    await mutate();
    toast("Messages refreshed");
  }

  return (
    <>
      <PageHead
        title="Canteen Chat"
        sub="Message the canteen team about an order, menu item or service."
        action={
          <button className="btn secondary" type="button" onClick={refresh}>
            ↻ Refresh messages
          </button>
        }
      />
      <div className="panel" style={{ maxWidth: 720 }}>
        <div className="food-quote">How can the canteen team help?</div>
        <div id="chat-log" ref={logRef} className="operator-chat-log" style={{ height: "auto", minHeight: 220, maxHeight: 440 }} aria-live="polite">
          {messages.length ? (
            messages.map((m) => (
              <div key={m.id} className={`chat-bubble ${m.senderRole === "staff" ? "staff" : "operator"}`}>
                <strong>{m.senderRole === "staff" ? "You" : "Canteen Operator"}</strong>
                <br />
                {m.message}
                <div className="chat-meta">{fmt.chat(m.createdAt)}</div>
              </div>
            ))
          ) : (
            <div className="empty">No messages yet. Start a conversation with the canteen team.</div>
          )}
        </div>
        <form id="chat-form" onSubmit={submit}>
          <label className="field">
            Message
            <textarea name="message" rows={3} required maxLength={500} placeholder="Type your message…" />
          </label>
          <button className="btn" type="submit" disabled={busy}>
            {busy ? "Sending…" : "Send message"}
          </button>
          <p role="alert" className="form-error">
            {error}
          </p>
        </form>
      </div>
    </>
  );
}
