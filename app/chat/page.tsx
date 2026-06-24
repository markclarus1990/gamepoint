"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, Send, MessageCircle, Loader2 } from "lucide-react";
import type { Message } from "@/types";

export default function ChatPage() {
  const [user, setUser] = useState<{ id: string; name: string } | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (!stored) {
      window.location.href = "/login";
      return;
    }
    const parsed = JSON.parse(stored);
    setUser(parsed);

    const init = async () => {
      const res = await fetch(`/api/conversations?userId=${parsed.id}`);
      const data = await res.json();
      const convId = data.conversation.id;
      setConversationId(convId);

      const msgRes = await fetch(
        `/api/conversations/${convId}/messages?role=player`
      );
      const msgs = await msgRes.json();
      setMessages(msgs);
      setLoading(false);
    };

    init();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (!conversationId) return;

    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  const sendMessage = async () => {
    if (!input.trim() || !user || !conversationId || sending) return;
    setSending(true);
    try {
      await fetch(`/api/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sender_id: user.id,
          sender_role: "player",
          content: input.trim(),
        }),
      });
      setInput("");
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-pink-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <header className="sticky top-0 z-10 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-800 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => (window.location.href = "/home")}
          className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-zinc-400" />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-pink-600 to-purple-600 flex items-center justify-center">
            <MessageCircle className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-white">Support</h1>
            <p className="text-xs text-zinc-500">
              We typically reply within a few hours
            </p>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 max-w-2xl mx-auto w-full">
        {messages.length === 0 && (
          <div className="text-center text-zinc-600 mt-20">
            <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p className="text-sm">Send a message to start the conversation</p>
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.sender_role === "player" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-4 py-2.5 ${
                msg.sender_role === "player"
                  ? "bg-gradient-to-r from-pink-600 to-purple-600 text-white rounded-br-md"
                  : "bg-zinc-800 text-zinc-100 rounded-bl-md"
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
              <div
                className={`text-[10px] mt-1 ${
                  msg.sender_role === "player"
                    ? "text-pink-200/70"
                    : "text-zinc-500"
                }`}
              >
                {new Date(msg.created_at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <div className="sticky bottom-0 bg-zinc-950/90 backdrop-blur-md border-t border-zinc-800 px-4 py-3">
        <div className="max-w-2xl mx-auto flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            className="flex-1 bg-zinc-800 text-white placeholder-zinc-500 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-pink-500/50 border border-zinc-700"
            disabled={sending}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || sending}
            className="p-2.5 bg-gradient-to-r from-pink-600 to-purple-600 text-white rounded-xl hover:from-pink-500 hover:to-purple-500 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
