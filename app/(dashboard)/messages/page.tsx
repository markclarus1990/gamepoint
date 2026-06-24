"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import {
  Send,
  MessageCircle,
  ChevronLeft,
  Plus,
  Search,
  Loader2,
} from "lucide-react";
import type { Message, DirectConversationSummary } from "@/types";

type UserInfo = {
  id: string;
  name: string;
  avatar_url: string | null;
};

export default function MessagesPage() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [conversations, setConversations] = useState<DirectConversationSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showList, setShowList] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [allUsers, setAllUsers] = useState<UserInfo[]>([]);
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
  }, []);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const res = await fetch(`/api/conversations/direct?userId=${user.id}`);
      const list: DirectConversationSummary[] = await res.json();
      setConversations(list);
      setLoading(false);

      if (list.length > 0 && !selectedId) {
        setSelectedId(list[0].id);
        setShowList(false);
      }
    };
    load();
  }, [user, selectedId]);

  const loadMessages = useCallback(async (convId: string, userId: string) => {
    const res = await fetch(
      `/api/conversations/${convId}/messages?userId=${userId}&role=direct`
    );
    const msgs = await res.json();
    setMessages(msgs);
  }, []);

  useEffect(() => {
    if (!selectedId || !user) return;
    loadMessages(selectedId, user.id);
  }, [selectedId, user, loadMessages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (!selectedId) return;

    const channel = supabase
      .channel(`direct:messages:${selectedId}`)
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
    if (!user) return;

    const channel = supabase
      .channel("direct:new")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "conversation_participants",
          filter: `user_id=eq.${user.id}`,
        },
        async () => {
          const res = await fetch(`/api/conversations/direct?userId=${user.id}`);
          const list: DirectConversationSummary[] = await res.json();
          setConversations(list);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const sendMessage = async () => {
    if (!input.trim() || !selectedId || !user || sending) return;
    setSending(true);
    try {
      await fetch(`/api/conversations/${selectedId}/messages`, {
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

  const openNewMessage = async () => {
    const res = await fetch("/api/users");
    const users: UserInfo[] = await res.json();
    setAllUsers(users.filter((u) => u.id !== user?.id));
    setUserSearch("");
    setShowNewModal(true);
  };

  const startConversation = async (participantId: string) => {
    if (!user) return;
    const res = await fetch("/api/conversations/direct", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, participantId }),
    });
    const data = await res.json();
    setShowNewModal(false);

    const convRes = await fetch(`/api/conversations/direct?userId=${user.id}`);
    const list: DirectConversationSummary[] = await convRes.json();
    setConversations(list);

    setSelectedId(data.conversationId);
    setShowList(false);
  };

  const selectedConv = conversations.find((c) => c.id === selectedId);
  const filteredUsers = allUsers.filter((u) =>
    u.name.toLowerCase().includes(userSearch.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-3.5rem)] bg-black">
        <Loader2 className="w-6 h-6 text-pink-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] bg-black overflow-hidden">
      {/* SIDEBAR */}
      <aside
        className={`${
          showList ? "flex" : "hidden"
        } md:flex w-full md:w-80 flex-shrink-0 border-r border-zinc-800 flex-col bg-zinc-950`}
      >
        <div className="p-3 border-b border-zinc-800">
          <button
            onClick={openNewMessage}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-pink-600 to-purple-600 text-white text-sm font-semibold hover:from-pink-500 hover:to-purple-500 transition-all"
          >
            <Plus className="w-4 h-4" />
            New Message
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 && (
            <div className="text-center text-zinc-600 mt-10 px-4">
              <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No conversations yet</p>
              <p className="text-xs text-zinc-700 mt-1">
                Click &quot;New Message&quot; to start chatting
              </p>
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
                selectedId === conv.id
                  ? "bg-zinc-900 border-l-2 border-l-pink-500"
                  : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center flex-shrink-0 text-sm font-bold text-white">
                    {conv.other_user.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white truncate">
                      {conv.other_user.name}
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

      {/* CHAT AREA */}
      <main
        className={`${
          !showList ? "flex" : "hidden"
        } md:flex flex-1 flex-col bg-black`}
      >
        {selectedId && selectedConv ? (
          <>
            <div className="md:hidden p-3 border-b border-zinc-800 bg-zinc-950/50">
              <button
                onClick={() => setShowList(true)}
                className="flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-[9px] font-bold text-white">
                    {selectedConv.other_user.name.charAt(0).toUpperCase()}
                  </div>
                  {selectedConv.other_user.name}
                </div>
              </button>
            </div>

            <div className="hidden md:flex items-center gap-3 px-4 py-3 border-b border-zinc-800 bg-zinc-950/50">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center text-xs font-bold text-white">
                {selectedConv.other_user.name.charAt(0).toUpperCase()}
              </div>
              <span className="text-sm font-semibold text-white">
                {selectedConv.other_user.name}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
              {messages.map((msg) => {
                const isMine = msg.sender_id === user?.id;
                return (
                  <div
                    key={msg.id}
                    className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                  >
                    <div className="flex gap-2 max-w-[85%] sm:max-w-[70%]">
                      {!isMine && (
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center flex-shrink-0 text-[9px] font-bold text-white mt-1">
                          {selectedConv.other_user.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div
                          className={`rounded-2xl px-4 py-2.5 ${
                            isMine
                              ? "bg-gradient-to-r from-pink-600 to-purple-600 text-white rounded-br-md"
                              : "bg-zinc-800 text-zinc-100 rounded-bl-md"
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap">
                            {msg.content}
                          </p>
                        </div>
                        <div
                          className={`text-[10px] mt-0.5 ${
                            isMine ? "text-right text-zinc-600" : "text-left text-zinc-600"
                          }`}
                        >
                          {new Date(msg.created_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          {msg.read_at && isMine && (
                            <span className="ml-1 text-pink-400">Read</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            <div className="sticky bottom-0 bg-zinc-950/90 backdrop-blur-md border-t border-zinc-800 px-4 py-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message..."
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
              <p className="text-sm">Select a conversation</p>
              <p className="text-xs text-zinc-700 mt-1">
                or start a new one
              </p>
            </div>
          </div>
        )}
      </main>

      {/* NEW MESSAGE MODAL */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-zinc-900 rounded-2xl border border-zinc-800 w-full max-w-md max-h-[80vh] flex flex-col shadow-2xl">
            <div className="p-4 border-b border-zinc-800">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold text-white">
                  New Message
                </h2>
                <button
                  onClick={() => setShowNewModal(false)}
                  className="text-zinc-500 hover:text-white transition-colors text-lg leading-none"
                >
                  &times;
                </button>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  type="text"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search players..."
                  className="w-full bg-zinc-800 text-white placeholder-zinc-500 rounded-lg pl-9 pr-3 py-2 text-sm outline-none focus:ring-2 focus:ring-pink-500/50 border border-zinc-700"
                  autoFocus
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {filteredUsers.length === 0 && (
                <div className="text-center text-zinc-600 py-8 text-sm">
                  No players found
                </div>
              )}
              {filteredUsers.map((u) => (
                <button
                  key={u.id}
                  onClick={() => startConversation(u.id)}
                  className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-zinc-800 transition-colors"
                >
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center flex-shrink-0 text-xs font-bold text-white">
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm font-medium text-white truncate">
                    {u.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
