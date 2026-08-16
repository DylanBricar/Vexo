import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { mergeStreamMessages } from "@/lib/message-stream";
import { validateSelectedFile } from "@/lib/message-validation";
import type { Message } from "@/types";

const JSON_HEADERS = { "Content-Type": "application/json" };
const ERROR_DURATION_MS = 4_000;
const TYPING_IDLE_MS = 1_500;
const SCREENSHOT_NOTICE_COOLDOWN_MS = 10_000;

export function useChat() {
  const [userId, setUserId] = useState<number | null>(null);
  const [userLabel, setUserLabel] = useState("");
  const [password, setPassword] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<string | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [otherOnline, setOtherOnline] = useState(false);
  const [otherTyping, setOtherTyping] = useState(false);
  const [otherLabel, setOtherLabel] = useState("");
  const [newMsgIds, setNewMsgIds] = useState<Set<number>>(() => new Set());
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editingMsg, setEditingMsg] = useState<Message | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const errorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animationTimersRef = useRef<Set<ReturnType<typeof setTimeout>>>(
    new Set(),
  );
  const previousMessageIdsRef = useRef<Set<number>>(new Set());
  const mediaCacheRef = useRef<Map<number, string>>(new Map());
  const mediaFetchingRef = useRef<Set<number>>(new Set());
  const beaconSentRef = useRef(false);
  const lastScreenshotAlertRef = useRef(0);
  const isLoadingMoreRef = useRef(false);
  const tabVisibleRef = useRef(true);
  const typingActiveRef = useRef(false);
  const optimisticIdRef = useRef(-1);
  const canBypass = userId === 1;

  const showError = useCallback((message: string) => {
    setError(message);
    if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
    errorTimeoutRef.current = setTimeout(() => setError(""), ERROR_DURATION_MS);
  }, []);

  useEffect(() => {
    const savedTheme = localStorage.getItem("chat-theme");
    const nextTheme = savedTheme === "light" ? "light" : "dark";
    const frame = requestAnimationFrame(() => {
      setTheme(nextTheme);
      document.documentElement.classList.toggle("dark", nextTheme === "dark");
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(
    () => () => {
      if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
      for (const timer of animationTimersRef.current) clearTimeout(timer);
    },
    [],
  );

  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const next = current === "dark" ? "light" : "dark";
      localStorage.setItem("chat-theme", next);
      document.documentElement.classList.toggle("dark", next === "dark");
      return next;
    });
  }, []);

  const fetchMedia = useCallback((messageId: number) => {
    if (
      mediaCacheRef.current.has(messageId) ||
      mediaFetchingRef.current.has(messageId)
    )
      return;
    mediaFetchingRef.current.add(messageId);
    void fetch(`/api/messages/media?id=${messageId}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Média indisponible");
        return response.json();
      })
      .then((data: { media?: unknown }) => {
        if (typeof data.media !== "string") return;
        mediaCacheRef.current.set(messageId, data.media);
        setMessages((current) =>
          current.map((message) =>
            message.id === messageId
              ? { ...message, media: data.media as string }
              : message,
          ),
        );
      })
      .catch(() => undefined)
      .finally(() => mediaFetchingRef.current.delete(messageId));
  }, []);

  const animateMessages = useCallback((messageIds: Set<number>) => {
    if (messageIds.size === 0) return;
    setNewMsgIds((current) => new Set([...current, ...messageIds]));
    const timer = setTimeout(() => {
      setNewMsgIds((current) => {
        const next = new Set(current);
        for (const id of messageIds) next.delete(id);
        return next;
      });
      animationTimersRef.current.delete(timer);
    }, 3_000);
    animationTimersRef.current.add(timer);
  }, []);

  const processMessages = useCallback(
    (incoming: Message[], currentUserId: number) => {
      const previousIds = previousMessageIdsRef.current;
      const incomingIds = new Set(incoming.map((message) => message.id));
      const animatedIds = new Set<number>();
      const processed = incoming.map((message) => {
        if (
          !previousIds.has(message.id) &&
          message.sender_id !== currentUserId &&
          previousIds.size > 0
        ) {
          animatedIds.add(message.id);
        }
        const cachedMedia = mediaCacheRef.current.get(message.id);
        if (cachedMedia) return { ...message, media: cachedMedia };
        if (message.has_media && !message.media) fetchMedia(message.id);
        return message;
      });

      setMessages((current) => mergeStreamMessages(current, processed));
      previousMessageIdsRef.current = incomingIds;
      animateMessages(animatedIds);
    },
    [animateMessages, fetchMedia],
  );

  useEffect(() => {
    if (!userId) return;
    let disposed = false;

    const connect = () => {
      if (disposed) return;
      const eventSource = new EventSource("/api/messages/stream");
      eventSourceRef.current = eventSource;
      eventSource.addEventListener("messages", (event) => {
        try {
          const data = JSON.parse(event.data) as {
            messages?: Message[];
            hasMore?: boolean;
          };
          if (Array.isArray(data.messages)) {
            processMessages(data.messages, userId);
            setHasMore(Boolean(data.hasMore));
          }
        } catch {
          showError("Le flux de messages a envoyé une réponse invalide");
        }
      });
      eventSource.addEventListener("presence", (event) => {
        try {
          const data = JSON.parse(event.data) as Record<string, unknown>;
          setOtherOnline(Boolean(data.otherOnline));
          setOtherTyping(Boolean(data.otherTyping));
          setOtherLabel(
            typeof data.otherLabel === "string" ? data.otherLabel : "",
          );
        } catch {
          showError("Le statut de présence est invalide");
        }
      });
      eventSource.onerror = () => {
        eventSource.close();
        if (!disposed) reconnectTimerRef.current = setTimeout(connect, 2_000);
      };
    };

    connect();
    return () => {
      disposed = true;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
    };
  }, [processMessages, showError, userId]);

  const postPresence = useCallback(
    (isTyping: boolean) => {
      if (!userId) return;
      void fetch("/api/presence", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ isTyping, isTabVisible: tabVisibleRef.current }),
      }).catch(() => undefined);
    },
    [userId],
  );

  useEffect(() => {
    if (!userId) return;
    tabVisibleRef.current = document.visibilityState === "visible";
    const heartbeat = () => postPresence(typingActiveRef.current);
    const onVisibilityChange = () => {
      tabVisibleRef.current = document.visibilityState === "visible";
      heartbeat();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    heartbeat();
    heartbeatRef.current = setInterval(heartbeat, 3_000);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    };
  }, [postPresence, userId]);

  const handleInputChange = useCallback(
    (value: string) => {
      setNewMessage(value);
      if (!typingActiveRef.current) {
        typingActiveRef.current = true;
        postPresence(true);
      }
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        typingActiveRef.current = false;
        postPresence(false);
      }, TYPING_IDLE_MS);
    },
    [postPresence],
  );

  useEffect(() => {
    if (isLoadingMoreRef.current) return;
    const scroll = () =>
      messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
    scroll();
    const frame = requestAnimationFrame(scroll);
    return () => cancelAnimationFrame(frame);
  }, [messages]);

  useEffect(() => {
    if (!userId) return;
    const disconnect = () => {
      if (beaconSentRef.current) return;
      beaconSentRef.current = true;
      eventSourceRef.current?.close();
      const sent = navigator.sendBeacon(
        "/api/disconnect",
        new Blob(["{}"], { type: "application/json" }),
      );
      if (!sent) {
        void fetch("/api/disconnect", {
          method: "POST",
          headers: JSON_HEADERS,
          body: "{}",
          keepalive: true,
        }).catch(() => undefined);
      }
    };
    window.addEventListener("pagehide", disconnect);
    return () => {
      window.removeEventListener("pagehide", disconnect);
      beaconSentRef.current = false;
    };
  }, [userId]);

  const loadMore = useCallback(async () => {
    if (!userId || loadingMore || messages.length === 0) return;
    const oldestServerMessage = messages.find((message) => message.id > 0);
    if (!oldestServerMessage) return;

    setLoadingMore(true);
    isLoadingMoreRef.current = true;
    const viewport = messagesEndRef.current?.closest<HTMLElement>(
      "[data-slot='scroll-area-viewport']",
    );
    const previousScrollHeight = viewport?.scrollHeight ?? 0;
    try {
      const response = await fetch(
        `/api/messages?before=${oldestServerMessage.id}`,
      );
      if (!response.ok) throw new Error("Chargement refusé");
      const data = (await response.json()) as {
        messages?: Message[];
        hasMore?: boolean;
      };
      const older = Array.isArray(data.messages) ? data.messages : [];
      for (const message of older) {
        previousMessageIdsRef.current.add(message.id);
        if (message.has_media) fetchMedia(message.id);
      }
      setMessages((current) => {
        const currentIds = new Set(current.map((message) => message.id));
        return [
          ...older.filter((message) => !currentIds.has(message.id)),
          ...current,
        ];
      });
      setHasMore(Boolean(data.hasMore));
      requestAnimationFrame(() => {
        if (viewport)
          viewport.scrollTop = viewport.scrollHeight - previousScrollHeight;
        isLoadingMoreRef.current = false;
      });
    } catch {
      showError("Erreur lors du chargement");
      isLoadingMoreRef.current = false;
    } finally {
      setLoadingMore(false);
    }
  }, [fetchMedia, loadingMore, messages, showError, userId]);

  const handleLogin = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ password }),
      });
      const data = (await response.json()) as {
        error?: string;
        userId?: number;
        label?: string;
      };
      if (!response.ok || !data.userId || typeof data.label !== "string") {
        setError(data.error || "Mot de passe incorrect");
        return;
      }
      beaconSentRef.current = false;
      setUserId(data.userId);
      setUserLabel(data.label);
      setPassword("");
    } catch {
      setError("Erreur de connexion");
    } finally {
      setLoading(false);
    }
  }, [loading, password]);

  const saveEdit = useCallback(
    async (message: Message) => {
      const content = newMessage.trim();
      if (!content || savingEdit) return;
      const previousContent = message.content;
      setSavingEdit(true);
      setMessages((current) =>
        current.map((item) =>
          item.id === message.id ? { ...item, content, edited: true } : item,
        ),
      );
      setEditingMsg(null);
      setNewMessage("");
      try {
        const response = await fetch("/api/messages", {
          method: "PATCH",
          headers: JSON_HEADERS,
          body: JSON.stringify({ messageId: message.id, content }),
        });
        if (!response.ok) throw new Error("Modification refusée");
      } catch {
        setMessages((current) =>
          current.map((item) =>
            item.id === message.id
              ? { ...item, content: previousContent }
              : item,
          ),
        );
        setEditingMsg(message);
        setNewMessage(content);
        showError("Erreur lors de la modification");
      } finally {
        setSavingEdit(false);
      }
    },
    [newMessage, savingEdit, showError],
  );

  const sendMessage = useCallback(async () => {
    if (!userId) return;
    if (editingMsg) {
      await saveEdit(editingMsg);
      return;
    }

    const content = newMessage.trim();
    if (!content && !mediaPreview) return;
    const media = mediaPreview;
    const currentMediaType = mediaType;
    const currentReply = replyTo;
    const optimisticId = optimisticIdRef.current--;
    const optimisticMessage: Message = {
      id: optimisticId,
      sender_id: userId,
      content: content || null,
      media,
      has_media: Boolean(media),
      media_type: currentMediaType,
      is_read: false,
      created_at: new Date().toISOString(),
      reply_to: currentReply?.id ?? null,
      edited: false,
      pending: true,
      localOnly: true,
    };

    setMessages((current) => [...current, optimisticMessage]);
    setNewMessage("");
    setMediaPreview(null);
    setMediaType(null);
    setReplyTo(null);
    typingActiveRef.current = false;
    postPresence(false);

    try {
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          content: content || null,
          media,
          mediaType: currentMediaType,
          replyTo: currentReply?.id ?? null,
        }),
      });
      const data = (await response.json()) as {
        error?: string;
        message?: Message;
      };
      if (!response.ok || !data.message)
        throw new Error(data.error || "Envoi refusé");

      const confirmedMessage = data.message;
      if (media) mediaCacheRef.current.set(confirmedMessage.id, media);
      previousMessageIdsRef.current.add(confirmedMessage.id);
      setMessages((current) => {
        const withoutOptimistic = current.filter(
          (message) => message.id !== optimisticId,
        );
        if (
          withoutOptimistic.some(
            (message) => message.id === confirmedMessage.id,
          )
        )
          return withoutOptimistic;
        return [
          ...withoutOptimistic,
          { ...confirmedMessage, media, pending: false, localOnly: true },
        ];
      });
    } catch (sendError) {
      setMessages((current) =>
        current.filter((message) => message.id !== optimisticId),
      );
      setNewMessage((current) => current || content);
      if (media) {
        setMediaPreview((current) => current || media);
        setMediaType((current) => current || currentMediaType);
      }
      showError(
        sendError instanceof Error
          ? sendError.message
          : "Erreur lors de l'envoi",
      );
    }
  }, [
    editingMsg,
    mediaPreview,
    mediaType,
    newMessage,
    postPresence,
    replyTo,
    saveEdit,
    showError,
    userId,
  ]);

  const handleDelete = useCallback(
    async (messageId: number) => {
      const removed = messages.find((message) => message.id === messageId);
      setMessages((current) =>
        current.filter((message) => message.id !== messageId),
      );
      try {
        const response = await fetch("/api/messages", {
          method: "DELETE",
          headers: JSON_HEADERS,
          body: JSON.stringify({ messageId }),
        });
        if (!response.ok) throw new Error("Suppression refusée");
        mediaCacheRef.current.delete(messageId);
      } catch {
        if (removed)
          setMessages((current) =>
            [...current, removed].sort((a, b) => a.id - b.id),
          );
        showError("Erreur lors de la suppression");
      }
    },
    [messages, showError],
  );

  const startEdit = useCallback(
    (message: Message) => {
      if (message.sender_id !== userId || !message.content || message.pending)
        return;
      setEditingMsg(message);
      setNewMessage(message.content);
      setReplyTo(null);
      setMediaPreview(null);
      setMediaType(null);
      inputRef.current?.focus();
    },
    [userId],
  );

  const startReply = useCallback((message: Message) => {
    if (message.pending) return;
    setReplyTo(message);
    setEditingMsg(null);
    inputRef.current?.focus();
  }, []);

  const cancelAction = useCallback(() => {
    setReplyTo(null);
    setEditingMsg(null);
    setNewMessage("");
  }, []);

  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      const validation = validateSelectedFile(file);
      if (!validation.ok) {
        showError(validation.error);
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result !== "string") return;
        setMediaPreview(reader.result);
        setMediaType(file.type.startsWith("image/") ? "image" : "video");
      };
      reader.onerror = () => showError("Impossible de lire ce fichier");
      reader.readAsDataURL(file);
    },
    [showError],
  );

  const resetSession = useCallback(() => {
    mediaCacheRef.current.clear();
    mediaFetchingRef.current.clear();
    previousMessageIdsRef.current.clear();
    setUserId(null);
    setUserLabel("");
    setMessages([]);
    setPassword("");
    setReplyTo(null);
    setEditingMsg(null);
    setMediaPreview(null);
    setMediaType(null);
  }, []);

  const handleDisconnect = useCallback(async () => {
    eventSourceRef.current?.close();
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    try {
      await fetch("/api/disconnect", {
        method: "POST",
        headers: JSON_HEADERS,
        body: "{}",
      });
    } catch {
      showError("La déconnexion distante a échoué");
    } finally {
      resetSession();
    }
  }, [resetSession, showError]);

  const handleClearAll = useCallback(async () => {
    if (!userId) return;
    try {
      const response = await fetch("/api/messages/clear", {
        method: "POST",
        headers: JSON_HEADERS,
        body: "{}",
      });
      if (!response.ok) throw new Error("Nettoyage refusé");
      mediaCacheRef.current.clear();
      previousMessageIdsRef.current.clear();
      setMessages([]);
      setHasMore(false);
    } catch {
      showError("Erreur lors de la suppression");
    }
  }, [showError, userId]);

  const handleWipeDB = useCallback(async () => {
    if (userId !== 1) return;
    try {
      const response = await fetch("/api/wipe", {
        method: "POST",
        headers: JSON_HEADERS,
        body: "{}",
      });
      if (!response.ok) throw new Error("Nettoyage refusé");
      mediaCacheRef.current.clear();
      previousMessageIdsRef.current.clear();
      setMessages([]);
      setHasMore(false);
    } catch {
      showError("Erreur lors du nettoyage");
    }
  }, [showError, userId]);

  const handleScreenshotDetected = useCallback(async () => {
    if (!userId || canBypass) return;
    const now = Date.now();
    if (now - lastScreenshotAlertRef.current < SCREENSHOT_NOTICE_COOLDOWN_MS)
      return;
    lastScreenshotAlertRef.current = now;
    try {
      await fetch("/api/messages", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({
          content: "capture détectée",
          mediaType: "system",
        }),
      });
    } catch {
      showError("Impossible de signaler la capture");
    }
  }, [canBypass, showError, userId]);

  useEffect(() => {
    if (!userId || canBypass) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const isMacCapture =
        event.metaKey && event.shiftKey && ["3", "4", "5"].includes(key);
      const isWindowsCapture =
        event.key === "PrintScreen" ||
        (event.metaKey && event.shiftKey && key === "s");
      if (isMacCapture || isWindowsCapture) void handleScreenshotDetected();
    };
    const onContextMenu = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.tagName === "IMG" || target.tagName === "VIDEO") {
        event.preventDefault();
        void handleScreenshotDetected();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("contextmenu", onContextMenu);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("contextmenu", onContextMenu);
    };
  }, [canBypass, handleScreenshotDetected, userId]);

  const messageById = useMemo(
    () => new Map(messages.map((message) => [message.id, message])),
    [messages],
  );

  const bindMessagesEnd = useCallback((element: HTMLDivElement | null) => {
    messagesEndRef.current = element;
  }, []);
  const bindFileInput = useCallback((element: HTMLInputElement | null) => {
    fileInputRef.current = element;
  }, []);
  const bindCameraInput = useCallback((element: HTMLInputElement | null) => {
    cameraInputRef.current = element;
  }, []);
  const bindComposer = useCallback((element: HTMLTextAreaElement | null) => {
    inputRef.current = element;
  }, []);
  const openFilePicker = useCallback(() => fileInputRef.current?.click(), []);
  const openCamera = useCallback(() => cameraInputRef.current?.click(), []);

  return {
    state: {
      userId,
      userLabel,
      password,
      messages,
      messageById,
      newMessage,
      loading,
      error,
      mediaPreview,
      mediaType,
      lightboxSrc,
      otherOnline,
      otherTyping,
      otherLabel,
      newMsgIds,
      replyTo,
      editingMsg,
      hasMore,
      loadingMore,
      savingEdit,
      theme,
      canBypass,
    },
    actions: {
      setPassword,
      setLightboxSrc,
      setMediaPreview,
      setMediaType,
      toggleTheme,
      handleInputChange,
      loadMore,
      handleLogin,
      sendMessage,
      handleDelete,
      startEdit,
      startReply,
      cancelAction,
      handleFileSelect,
      handleDisconnect,
      handleClearAll,
      handleWipeDB,
      handleScreenshotDetected,
      openFilePicker,
      openCamera,
    },
    bindings: {
      bindMessagesEnd,
      bindFileInput,
      bindCameraInput,
      bindComposer,
    },
  };
}

export type ChatController = ReturnType<typeof useChat>;
