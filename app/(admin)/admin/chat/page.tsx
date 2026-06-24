"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import {
  ArrowLeft,
  Send,
  MessageCircle,
  ChevronLeft,
  Loader2,
} from "lucide-react";
import type { Message } from "@/types";

type ConvSummary = {
  id: string;
  user_id: string;
  user_name: string;
  user_avatar: string | null;
  status: string;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
  created_at: string;
  updated_at: string;
};

export default function AdminChatPage() {
  const [authorized, setAuthorized] = useState(false);
  const [conversations, setConversations] = useState<ConvSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showList, setShowList] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    const isAdmin = localStorage.getItem("isAdmin");
    if (isAdmin !== "true") {
      window.location.href = "/login";
      return;
    }
    setAuthorized(true);
  }, []);

  useEffect(() => {
    if (!authorized) return;
    const load = async () => {
      const res = await fetch("/api/conversations");
      const list: ConvSummary[] = await res.json();
      setConversations(list);
      setLoading(false);

      if (list.length > 0 && !selectedId) {
        setSelectedId(list[0].id);
      }
    };
    load();
  }, [authorized, selectedId]);

  const loadMessages = useCallback(async (convId: string) => {
    const res = await fetch(
      `/api/conversations/${convId}/messages?role=admin`
    );
    const msgs = await res.json();
    setMessages(msgs);
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    loadMessages(selectedId);
  }, [selectedId, loadMessages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (!selectedId) return;

    const channel = supabase
      .channel(`admin:messages:${selectedId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${selectedId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          setConversations((prev) =>
            prev.map((c) =>
              c.id === selectedId
                ? { ...c, last_message: newMsg.content, unread_count: 0 }
                : c
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedId]);

  useEffect(() => {
    const channel = supabase
      .channel("admin:conversations")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "conversations",
        },
        async () => {
          const res = await fetch("/api/conversations");
          const list: ConvSummary[] = await res.json();
          setConversations(list);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const sendMessage = async () => {
    if (!input.trim() || !selectedId || sending) return;
    setSending(true);
    try {
      const stored = JSON.parse(localStorage.getItem("user") || "{}");
      await fetch(`/api/conversations/${selectedId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sender_id: stored.id || "admin",
          sender_role: "admin",
          content: input.trim(),
        }),
      });
      setInput("");
      setConversations((prev) =>
        prev.map((c) =>
          c.id === selectedId
            ? { ...c, last_message: input.trim(), unread_count: 0 }
            : c
        )
      );
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

  const selectedConv = conversations.find((c) => c.id === selectedId);

  if (!authorized || loading) {
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
          onClick={() => (window.location.href = "/admin")}
          className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-zinc-400" />
        </button>
        <h1 className="text-sm font-semibold text-white">Messages</h1>
        <div className="ml-auto flex items-center gap-2">
          {conversations.length > 0 && (
            <span className="text-xs text-zinc-500">
              {conversations.filter((c) => c.unread_count > 0).length} unread
            </span>
          )}
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <aside
          className={`${
            showList ? "flex" : "hidden"
          } md:flex w-full md:w-80 flex-shrink-0 border-r border-zinc-800 flex-col bg-zinc-950`}
        >
          <div className="p-3 border-b border-zinc-800">
            <input
              placeholder="Search conversations..."
              className="w-full bg-zinc-800 text-white placeholder-zinc-500 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-pink-500/50 border border-zinc-700"
            />
          </div>
          <div className="flex-1 overflow-y-auto">
            {conversations.length === 0 && (
              <div className="text-center text-zinc-600 mt-10 px-4">
                <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No conversations yet</p>
              </div>
            )}
            {conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => {
                  setSelectedId(conv.id);
                  setShowList(false);
                }}
                className={`w-full text-left px-4 py-3 border-b border-zinc-800/50 hover:bg-zinc-900 transition-colors ${
                  selectedId === conv.id ? "bg-zinc-900 border-l-2 border-l-pink-500" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center flex-shrink-0 text-xs font-bold text-white">
                      {conv.user_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-white truncate">
                        {conv.user_name}
                      </div>
                      <div className="text-xs text-zinc-500 truncate mt-0.5">
                        {conv.last_message || "No messages yet"}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0 ml-2">
                    {conv.unread_count > 0 && (
                      <span className="bg-pink-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center leading-none">
                        {conv.unread_count}
                      </span>
                    )}
                    {conv.last_message_at && (
                      <span className="text-[10px] text-zinc-600">
                        {new Date(conv.last_message_at).toLocaleDateString([], {
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <main
          className={`${
            !showList ? "flex" : "hidden"
          } md:flex flex-1 flex-col bg-black`}
        >
          {selectedId && selectedConv ? (
            <>
              <div className="md:hidden p-2 border-b border-zinc-800">
                <button
                  onClick={() => setShowList(true)}
                  className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  {selectedConv.user_name}
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${
                      msg.sender_role === "admin"
                        ? "justify-end"
                        : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-4 py-2.5 ${
                        msg.sender_role === "admin"
                          ? "bg-gradient-to-r from-pink-600 to-purple-600 text-white rounded-br-md"
                          : "bg-zinc-800 text-zinc-100 rounded-bl-md"
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">
                        {msg.content}
                      </p>
                      <div
                        className={`text-[10px] mt-1 ${
                          msg.sender_role === "admin"
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
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Reply as admin..."
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
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-zinc-600">
              <div className="text-center">
                <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">Select a conversation to view</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
