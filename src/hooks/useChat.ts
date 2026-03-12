import { useState, useEffect, useRef, useCallback } from "react";
import type { Message } from "@/types";

export function useChat() {
  const [userId, setUserId] = useState<number | null>(null);
  const [userLabel, setUserLabel] = useState("");
  const [password, setPassword] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [initialized, setInitialized] = useState(false);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [selectedMsg, setSelectedMsg] = useState<number | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [otherOnline, setOtherOnline] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const [otherLabel, setOtherLabel] = useState("");
  const [newMsgIds, setNewMsgIds] = useState<Set<number>>(new Set());
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editingMsg, setEditingMsg] = useState<Message | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const sseRef = useRef<EventSource | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevMsgIdsRef = useRef<Set<number>>(new Set());
  const mediaCacheRef = useRef<Map<number, string>>(new Map());
  const mediaFetchingRef = useRef<Set<number>>(new Set());
  const beaconSentRef = useRef(false);
  const lastScreenshotAlert = useRef<number>(0);
  const tokenRef = useRef<string>("");
  const isLoadingMoreRef = useRef(false);
  const tabVisibleRef = useRef(true);
  const justSentRef = useRef(false);
  const userScrolledUpRef = useRef(false);
  const canBypass = userId === 1;

  const authHeaders = (extra?: Record<string, string>) => ({ Authorization: `Bearer ${tokenRef.current}`, "Content-Type": "application/json", ...extra });

  const showError = useCallback((msg: string) => {
    setError(msg); setTimeout(() => setError(""), 4000);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("chat-theme") as "dark" | "light" | null;
    if (saved) { setTheme(saved); document.documentElement.classList.toggle("dark", saved === "dark"); }
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next); localStorage.setItem("chat-theme", next);
    document.documentElement.classList.toggle("dark", next === "dark");
  };

  useEffect(() => { fetch("/api/init", { method: "POST" }).then(() => setInitialized(true)).catch(() => setInitialized(true)); }, []);

  const fetchMedia = useCallback((msgId: number, currentUserId: number) => {
    if (mediaCacheRef.current.has(msgId) || mediaFetchingRef.current.has(msgId)) return;
    mediaFetchingRef.current.add(msgId);
    fetch(`/api/messages/media?id=${msgId}`, { headers: { Authorization: `Bearer ${tokenRef.current}` } })
      .then((res) => res.json())
      .then((data) => {
        if (data.media) {
          mediaCacheRef.current.set(msgId, data.media);
          setMessages((prev) =>
            prev.map((m) => (m.id === msgId ? { ...m, media: data.media } : m))
          );
        }
      })
      .catch(() => {})
      .finally(() => mediaFetchingRef.current.delete(msgId));
  }, []);

  const processMessages = useCallback((incoming: Message[], currentUserId: number) => {
    const prevIds = prevMsgIdsRef.current;
    const newIds = new Set<number>();
    const processed = incoming.map((msg) => {
      if (!prevIds.has(msg.id) && msg.sender_id !== currentUserId && prevIds.size > 0) newIds.add(msg.id);
      if (mediaCacheRef.current.has(msg.id)) return { ...msg, media: mediaCacheRef.current.get(msg.id)! };
      if (msg.has_media && !msg.media) fetchMedia(msg.id, currentUserId);
      return msg;
    });
    const currentIds = new Set(incoming.map((m) => m.id));
    for (const cachedId of mediaCacheRef.current.keys()) { if (!currentIds.has(cachedId)) mediaCacheRef.current.delete(cachedId); }
    prevMsgIdsRef.current = currentIds;
    setMessages(processed);
    if (newIds.size > 0) {
      setNewMsgIds((prev) => new Set([...prev, ...newIds]));
      setTimeout(() => { setNewMsgIds((prev) => { const next = new Set(prev); for (const id of newIds) next.delete(id); return next; }); }, 3000);
    }
  }, [fetchMedia]);

  useEffect(() => {
    if (!userId) return;
    const url = `/api/messages/stream?token=${encodeURIComponent(tokenRef.current)}`;
    const connect = () => {
      const es = new EventSource(url);
      sseRef.current = es;
      es.addEventListener("messages", (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.messages) {
            processMessages(data.messages, userId);
            setHasMore(!!data.hasMore);
          }
        } catch {}
      });
      es.addEventListener("presence", (e) => {
        try {
          const data = JSON.parse(e.data);
          setOtherOnline(data.otherOnline);
          setOtherTyping(data.otherTyping);
          setOtherLabel(data.otherLabel);
        } catch {}
      });
      es.onerror = () => {
        es.close();
        setTimeout(() => { if (sseRef.current === es) connect(); }, 2000);
      };
    };
    connect();
    return () => { if (sseRef.current) { sseRef.current.close(); sseRef.current = null; } };
  }, [userId, processMessages]);

  useEffect(() => {
    if (!userId) return;
    tabVisibleRef.current = document.visibilityState === "visible";
    const heartbeat = () => {
      fetch("/api/presence", { method: "POST", headers: authHeaders(), body: JSON.stringify({ isTyping: false, isTabVisible: tabVisibleRef.current }) }).catch(() => {});
    };
    const onVisChange = () => {
      tabVisibleRef.current = document.visibilityState === "visible";
      heartbeat();
    };
    document.addEventListener("visibilitychange", onVisChange);
    heartbeat();
    heartbeatRef.current = setInterval(heartbeat, 3000);
    return () => {
      document.removeEventListener("visibilitychange", onVisChange);
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, [userId]);

  const sendTyping = useCallback((isTyping: boolean) => {
    if (!userId) return;
    fetch("/api/presence", { method: "POST", headers: authHeaders(), body: JSON.stringify({ isTyping, isTabVisible: tabVisibleRef.current }) }).catch(() => {});
  }, [userId]);

  const handleInputChange = (value: string) => {
    setNewMessage(value); sendTyping(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => sendTyping(false), 2000);
  };

  // Track user scroll: if they scroll up manually, stop auto-scrolling
  useEffect(() => {
    const el = scrollRef.current?.querySelector("[data-radix-scroll-area-viewport]");
    if (!el) return;
    const onScroll = () => {
      if (isLoadingMoreRef.current) return;
      const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      userScrolledUpRef.current = distFromBottom > 200;
    };
    el.addEventListener("scroll", onScroll);
    return () => el.removeEventListener("scroll", onScroll);
  }, [userId]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (isLoadingMoreRef.current) return;
    const el = scrollRef.current?.querySelector("[data-radix-scroll-area-viewport]");
    if (!el) return;
    if (justSentRef.current) {
      justSentRef.current = false;
      userScrolledUpRef.current = false;
    }
    if (!userScrolledUpRef.current) {
      const doScroll = () => { el.scrollTop = el.scrollHeight; };
      doScroll();
      requestAnimationFrame(doScroll);
      const t = setTimeout(doScroll, 150);
      return () => clearTimeout(t);
    }
  }, [messages]);

  useEffect(() => {
    if (!userId) return;
    const vv = window.visualViewport; if (!vv) return;
    const onResize = () => {
      const offset = window.innerHeight - vv.height;
      if (formRef.current) formRef.current.style.transform = offset > 0 ? `translateY(-${offset}px)` : "";
      const el = scrollRef.current?.querySelector("[data-radix-scroll-area-viewport]"); if (el) el.scrollTop = el.scrollHeight;
    };
    vv.addEventListener("resize", onResize); return () => vv.removeEventListener("resize", onResize);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const doDisconnect = () => {
      if (beaconSentRef.current) return;
      beaconSentRef.current = true;
      if (sseRef.current) { sseRef.current.close(); sseRef.current = null; }
      const payload = JSON.stringify({ token: tokenRef.current, userLabel });
      const blob = new Blob([payload], { type: "application/json" });
      const sent = navigator.sendBeacon("/api/disconnect", blob);
      if (!sent) {
        fetch("/api/disconnect", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: payload, keepalive: true,
        }).catch(() => {});
      }
    };
    window.addEventListener("pagehide", doDisconnect);
    window.addEventListener("beforeunload", doDisconnect);
    return () => {
      window.removeEventListener("pagehide", doDisconnect);
      window.removeEventListener("beforeunload", doDisconnect);
      beaconSentRef.current = false;
    };
  }, [userId, userLabel]);

  const loadMore = async () => {
    if (!userId || loadingMore || messages.length === 0) return;
    setLoadingMore(true);
    isLoadingMoreRef.current = true;
    const el = scrollRef.current?.querySelector("[data-radix-scroll-area-viewport]");
    const prevScrollHeight = el?.scrollHeight ?? 0;
    try {
      const oldestId = messages[0].id;
      const res = await fetch(`/api/messages?before=${oldestId}`, { headers: { Authorization: `Bearer ${tokenRef.current}` } });
      const data = await res.json();
      if (data.messages?.length > 0) {
        const older: Message[] = data.messages.map((msg: Message) => {
          if (msg.media) mediaCacheRef.current.set(msg.id, msg.media);
          return msg;
        });
        setMessages((prev) => [...older, ...prev]);
        for (const m of older) prevMsgIdsRef.current.add(m.id);
        setHasMore(!!data.hasMore);
        requestAnimationFrame(() => {
          if (el) el.scrollTop = el.scrollHeight - prevScrollHeight;
          isLoadingMoreRef.current = false;
        });
      } else {
        setHasMore(false);
        isLoadingMoreRef.current = false;
      }
    } catch {
      showError("Erreur lors du chargement");
      isLoadingMoreRef.current = false;
    }
    setLoadingMore(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError("");
    try {
      const res = await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
      const data = await res.json();
      if (res.ok) { tokenRef.current = data.token; setUserId(data.userId); setUserLabel(data.label); } else setError(data.error || "Mot de passe incorrect");
    } catch { setError("Erreur de connexion"); }
    setLoading(false);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingMsg) {
      if (!newMessage.trim()) return;
      setSending(true);
      try {
        const res = await fetch("/api/messages", {
          method: "PATCH", headers: authHeaders(),
          body: JSON.stringify({ messageId: editingMsg.id, content: newMessage.trim() }),
        });
        if (!res.ok) throw new Error();
        setEditingMsg(null);
        setNewMessage("");
      } catch { showError("Erreur lors de la modification"); }
      setSending(false);
      return;
    }
    if ((!newMessage.trim() && !mediaPreview) || sending) return;
    setSending(true);
    sendTyping(false);
    justSentRef.current = true;
    try {
      const res = await fetch("/api/messages", {
        method: "POST", headers: authHeaders(),
        body: JSON.stringify({
          content: newMessage.trim() || null,
          media: mediaPreview, mediaType, replyTo: replyTo?.id || null,
        }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (mediaPreview && data.message?.id) mediaCacheRef.current.set(data.message.id, mediaPreview);
      setNewMessage(""); setMediaPreview(null); setMediaType(null); setReplyTo(null);
    } catch { showError("Erreur lors de l'envoi"); }
    setSending(false);
  };

  const handleDelete = async (messageId: number) => {
    try {
      const res = await fetch("/api/messages", {
        method: "DELETE", headers: authHeaders(),
        body: JSON.stringify({ messageId }),
      });
      if (!res.ok) throw new Error();
      mediaCacheRef.current.delete(messageId);
    } catch { showError("Erreur lors de la suppression"); }
  };

  const startEdit = (msg: Message) => {
    if (msg.sender_id !== userId || !msg.content) return;
    setEditingMsg(msg); setNewMessage(msg.content);
    setReplyTo(null); setMediaPreview(null); setMediaType(null); setSelectedMsg(null);
    inputRef.current?.focus();
  };

  const startReply = (msg: Message) => {
    setReplyTo(msg); setEditingMsg(null); setSelectedMsg(null);
    inputRef.current?.focus();
  };

  const cancelAction = () => { setReplyTo(null); setEditingMsg(null); setNewMessage(""); };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { setMediaPreview(reader.result as string); if (file.type.startsWith("image/")) setMediaType("image"); else if (file.type.startsWith("video/")) setMediaType("video"); };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  const handleDisconnect = async () => {
    if (sseRef.current) { sseRef.current.close(); sseRef.current = null; }
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    try {
      await fetch("/api/disconnect", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tokenRef.current, userLabel }),
      });
    } catch {}
    mediaCacheRef.current.clear(); prevMsgIdsRef.current.clear(); tokenRef.current = "";
    setUserId(null); setUserLabel(""); setMessages([]); setPassword("");
    setReplyTo(null); setEditingMsg(null);
  };

  const handleClearAll = async () => {
    if (!userId) return;
    try {
      const res = await fetch("/api/messages/clear", {
        method: "POST", headers: authHeaders(),
      });
      if (!res.ok) throw new Error();
      mediaCacheRef.current.clear(); prevMsgIdsRef.current.clear();
    } catch { showError("Erreur lors de la suppression"); }
  };

  const handleWipeDB = async () => {
    if (userId !== 1) return;
    try {
      const res = await fetch("/api/wipe", { method: "POST", headers: authHeaders() });
      if (!res.ok) throw new Error();
      mediaCacheRef.current.clear(); prevMsgIdsRef.current.clear();
    } catch { showError("Erreur lors du nettoyage"); }
  };

  const handleScreenshotDetected = useCallback(async () => {
    if (!userId || canBypass) return;
    const now = Date.now();
    if (now - lastScreenshotAlert.current < 10000) return;
    lastScreenshotAlert.current = now;
    try {
      await fetch("/api/messages", {
        method: "POST", headers: authHeaders(),
        body: JSON.stringify({
          content: `${userLabel} a peut-être fait une capture d'écran`, mediaType: "system",
        }),
      });
    } catch {}
  }, [userId, userLabel, canBypass]);

  useEffect(() => {
    if (!userId || canBypass) return;
    const handleKeyUp = (e: KeyboardEvent) => { if (e.key === "PrintScreen") handleScreenshotDetected(); };
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = e.metaKey && e.shiftKey && ["3", "4", "5"].includes(e.key);
      const isWin = e.key === "PrintScreen" || (e.metaKey && e.shiftKey && e.key.toLowerCase() === "s");
      const isCtrlS = e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "s";
      if (isMac || isWin || isCtrlS) handleScreenshotDetected();
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "s") {
        e.preventDefault(); handleScreenshotDetected();
      }
      if (e.key === "F12" || (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "i")) e.preventDefault();
    };
    const handleCtx = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === "IMG" || t.tagName === "VIDEO") { e.preventDefault(); handleScreenshotDetected(); }
    };
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("contextmenu", handleCtx);
    return () => {
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("contextmenu", handleCtx);
    };
  }, [userId, canBypass, handleScreenshotDetected]);

  const getMessageById = (id: number) => messages.find((m) => m.id === id);

  return {
    userId, userLabel, password, setPassword, messages, newMessage, loading, error,
    initialized, mediaPreview, mediaType, sending, selectedMsg, setSelectedMsg,
    lightboxSrc, setLightboxSrc, otherOnline, otherTyping, otherLabel, newMsgIds,
    replyTo, editingMsg, hasMore, loadingMore, theme,
    scrollRef, fileInputRef, cameraInputRef, inputRef, formRef,
    toggleTheme, handleInputChange, loadMore, handleLogin, handleSend, handleDelete,
    startEdit, startReply, cancelAction, handleFileSelect, handleDisconnect,
    handleClearAll, handleWipeDB, handleScreenshotDetected, getMessageById,
    setMediaPreview, setMediaType, canBypass,
  };
}
