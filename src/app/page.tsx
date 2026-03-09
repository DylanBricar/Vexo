"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import ImageLightbox from "@/components/ImageLightbox";
import { useChat } from "@/hooks/useChat";

function linkify(text: string) {
  const urlRegex = /(https?:\/\/[^\s<]+)/g;
  const parts = text.split(urlRegex);
  return parts.map((part, i) =>
    urlRegex.test(part) ? (
      <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="underline break-all opacity-80 hover:opacity-100">
        {part}
      </a>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

const SunIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
);

const MoonIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
);

export default function Home() {
  const chat = useChat();

  if (!chat.userId) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background p-4 chat-bg">
        <Card className="w-full max-w-sm p-6 space-y-4 relative">
          <button onClick={chat.toggleTheme} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground cursor-pointer" title={chat.theme === "dark" ? "Mode clair" : "Mode sombre"}>
            {chat.theme === "dark" ? <SunIcon /> : <MoonIcon />}
          </button>
          <div className="text-center space-y-1">
            <h1 className="text-xl font-semibold tracking-tight">Chat</h1>
            <p className="text-sm text-muted-foreground">Entrez votre mot de passe</p>
          </div>
          <form onSubmit={chat.handleLogin} className="space-y-3">
            <Input
              type="password"
              placeholder="Mot de passe"
              value={chat.password}
              onChange={(e) => chat.setPassword(e.target.value)}
              autoFocus
              disabled={!chat.initialized || chat.loading}
              className="h-12 text-base"
            />
            {chat.error && <p className="text-sm text-destructive">{chat.error}</p>}
            <Button type="submit" className="w-full h-12 text-base cursor-pointer" disabled={!chat.initialized || chat.loading}>
              {chat.loading ? "Connexion..." : "Entrer"}
            </Button>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-dvh bg-background">
      <div className="flex items-center justify-between px-4 py-3 border-b bg-card shrink-0">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">{chat.userLabel}</span>
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full shrink-0 ${chat.otherOnline ? "bg-emerald-500" : "bg-muted-foreground/30"}`} />
            <span className="text-xs text-muted-foreground">
              {chat.otherTyping
                ? `${chat.otherLabel} écrit...`
                : chat.otherOnline
                  ? `${chat.otherLabel} en ligne`
                  : chat.otherLabel
                    ? `${chat.otherLabel} hors ligne`
                    : ""}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={chat.toggleTheme} className="h-8 w-8 cursor-pointer" title={chat.theme === "dark" ? "Mode clair" : "Mode sombre"}>
            {chat.theme === "dark" ? <SunIcon /> : <MoonIcon />}
          </Button>
          <Button variant="ghost" size="icon" onClick={chat.handleClearAll} className="h-8 w-8 cursor-pointer text-muted-foreground hover:text-destructive" title="Tout supprimer">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </Button>
          {chat.canBypass && (
            <Button variant="ghost" size="icon" onClick={chat.handleWipeDB} className="h-8 w-8 cursor-pointer text-muted-foreground hover:text-destructive" title="Nettoyer la base de données">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/><line x1="15" y1="8" x2="21" y2="14"/><line x1="21" y1="8" x2="15" y2="14"/></svg>
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={chat.handleDisconnect} className="text-destructive hover:text-destructive cursor-pointer">
            Quitter
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1 chat-bg" ref={chat.scrollRef}>
        <div className="px-4 py-3 space-y-3 max-w-2xl mx-auto">
          {chat.hasMore && (
            <div className="flex justify-center">
              <Button variant="ghost" size="sm" onClick={chat.loadMore} disabled={chat.loadingMore} className="text-xs text-muted-foreground">
                {chat.loadingMore ? "Chargement..." : "Charger les messages précédents"}
              </Button>
            </div>
          )}

          {chat.messages.length === 0 && !chat.hasMore && (
            <p className="text-center text-sm text-muted-foreground py-8">Aucun message</p>
          )}

          {chat.messages.map((msg) => {
            const isMine = msg.sender_id === chat.userId;
            const isSystem = msg.media_type === "system";
            const isSelected = chat.selectedMsg === msg.id;
            const isNew = chat.newMsgIds.has(msg.id);
            const repliedMsg = msg.reply_to ? chat.getMessageById(msg.reply_to) : null;

            if (isSystem) {
              return (
                <div key={msg.id} className="flex justify-center">
                  <div className="bg-muted/50 text-muted-foreground text-xs px-4 py-2 rounded-full italic max-w-[90%] text-center">
                    {msg.content}
                  </div>
                </div>
              );
            }

            return (
              <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`relative group max-w-[80%] rounded-2xl px-4 py-2 ${
                    isNew
                      ? isMine ? "msg-gold-mine" : "msg-gold-other"
                      : isMine
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                  }`}
                  onClick={() => chat.setSelectedMsg(isSelected ? null : msg.id)}
                >
                  <div className={`absolute -top-2 ${isMine ? "-left-2" : "-right-2"} flex gap-1 ${
                    isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                  } transition-opacity z-10`}>
                    <button
                      onClick={(e) => { e.stopPropagation(); chat.startReply(msg); }}
                      className="bg-muted-foreground/80 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs leading-none cursor-pointer hover:bg-muted-foreground"
                      aria-label="Répondre"
                      title="Répondre"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/></svg>
                    </button>
                    {isMine && msg.content && (
                      <button
                        onClick={(e) => { e.stopPropagation(); chat.startEdit(msg); }}
                        className="bg-muted-foreground/80 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs leading-none cursor-pointer hover:bg-muted-foreground"
                        aria-label="Modifier"
                        title="Modifier"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); chat.handleDelete(msg.id); chat.setSelectedMsg(null); }}
                      className="bg-destructive text-white rounded-full w-6 h-6 flex items-center justify-center text-xs leading-none cursor-pointer hover:bg-destructive/80"
                      aria-label="Supprimer"
                    >
                      x
                    </button>
                  </div>

                  {repliedMsg && (
                    <div className={`text-xs mb-1.5 px-2 py-1 rounded-lg border-l-2 ${
                      isMine ? "border-primary-foreground/30 bg-primary-foreground/10" : "border-muted-foreground/30 bg-background/30"
                    }`}>
                      <span className="font-medium opacity-70">
                        {repliedMsg.sender_id === chat.userId ? "Vous" : chat.otherLabel}
                      </span>
                      <p className="opacity-60 truncate max-w-[200px]">
                        {repliedMsg.content || (repliedMsg.media || repliedMsg.has_media ? "Média" : "...")}
                      </p>
                    </div>
                  )}
                  {msg.reply_to && !repliedMsg && (
                    <div className={`text-xs mb-1.5 px-2 py-1 rounded-lg border-l-2 opacity-40 ${
                      isMine ? "border-primary-foreground/30" : "border-muted-foreground/30"
                    }`}>
                      <p className="italic">Message supprimé</p>
                    </div>
                  )}

                  {msg.media && msg.media_type === "image" && (
                    <img
                      src={msg.media}
                      alt=""
                      className="max-w-full rounded-lg mb-1 max-h-64 object-contain cursor-pointer"
                      onClick={(e) => { e.stopPropagation(); chat.setLightboxSrc(msg.media); }}
                    />
                  )}
                  {msg.media && msg.media_type === "video" && (
                    <video src={msg.media} controls className="max-w-full rounded-lg mb-1 max-h-64" playsInline />
                  )}
                  {!msg.media && msg.has_media && (
                    <div className="flex items-center gap-2 py-2 text-xs opacity-60">
                      <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      Chargement...
                    </div>
                  )}

                  {msg.content && (
                    <p className="text-sm whitespace-pre-wrap break-words">{linkify(msg.content)}</p>
                  )}

                  <div className={`flex items-center gap-1 mt-1 ${isMine ? "justify-end" : ""}`}>
                    {msg.edited && (
                      <span className={`text-[10px] italic ${
                        isMine ? "text-primary-foreground/40" : "text-muted-foreground/60"
                      }`}>modifié</span>
                    )}
                    <span className={`text-[10px] ${
                      isNew ? "opacity-60" : isMine ? "text-primary-foreground/60" : "text-muted-foreground"
                    }`}>
                      {new Date(msg.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    {isMine && !isNew && (
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={msg.is_read ? "text-blue-400" : "text-primary-foreground/40"}>
                        {msg.is_read ? (<><path d="M18 6L7 17l-5-5" /><path d="M22 6L11 17" /></>) : (<path d="M20 6L9 17l-5-5" />)}
                      </svg>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {chat.otherTyping && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-2xl px-4 py-3 flex gap-1.5 items-center">
                <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {(chat.replyTo || chat.editingMsg) && (
        <div className="px-4 py-2 border-t bg-card shrink-0">
          <div className="flex items-center gap-2 max-w-2xl mx-auto">
            <div className="flex-1 text-xs truncate">
              {chat.editingMsg ? (
                <span className="text-muted-foreground">Modification du message</span>
              ) : chat.replyTo ? (
                <>
                  <span className="text-muted-foreground">Réponse à </span>
                  <span className="font-medium">{chat.replyTo.sender_id === chat.userId ? "vous" : chat.otherLabel}</span>
                  <span className="text-muted-foreground"> : {chat.replyTo.content || "Média"}</span>
                </>
              ) : null}
            </div>
            <button onClick={chat.cancelAction} className="text-muted-foreground hover:text-foreground cursor-pointer text-sm">
              x
            </button>
          </div>
        </div>
      )}

      {chat.mediaPreview && (
        <div className="px-4 py-2 border-t bg-card shrink-0">
          <div className="relative inline-block max-w-2xl mx-auto">
            {chat.mediaType === "image" ? (
              <img src={chat.mediaPreview} alt="" className="h-20 rounded-lg object-contain" />
            ) : (
              <video src={chat.mediaPreview} className="h-20 rounded-lg" />
            )}
            <button
              onClick={() => { chat.setMediaPreview(null); chat.setMediaType(null); }}
              className="absolute -top-1 -right-1 bg-destructive text-white rounded-full w-5 h-5 flex items-center justify-center text-xs leading-none cursor-pointer"
            >
              x
            </button>
          </div>
        </div>
      )}

      <form ref={chat.formRef} onSubmit={chat.handleSend} className="px-4 py-3 border-t bg-card shrink-0" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
        <div className="flex gap-2 max-w-2xl mx-auto items-end">
          {!chat.editingMsg && (
            <>
              <input ref={chat.fileInputRef} type="file" accept="image/*,video/*" onChange={chat.handleFileSelect} className="hidden" />
              <input ref={chat.cameraInputRef} type="file" accept="image/*,video/*" capture="environment" onChange={chat.handleFileSelect} className="hidden" />
              <Button type="button" variant="outline" size="icon" className="shrink-0 h-10 w-10 cursor-pointer" onClick={() => chat.fileInputRef.current?.click()}>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/></svg>
              </Button>
              <Button type="button" variant="outline" size="icon" className="shrink-0 sm:hidden h-10 w-10 cursor-pointer" onClick={() => chat.cameraInputRef.current?.click()}>
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
              </Button>
            </>
          )}
          <textarea
            ref={chat.inputRef}
            value={chat.newMessage}
            onChange={(e) => {
              chat.handleInputChange(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                chat.handleSend(e);
              }
            }}
            placeholder={chat.editingMsg ? "Modifier le message..." : "Message..."}
            className="flex-1 resize-none rounded-md bg-muted px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none"
            rows={1}
            autoFocus
            style={{ maxHeight: 120 }}
          />
          <Button type="submit" size="icon" className="shrink-0 self-end h-10 w-10 cursor-pointer" disabled={chat.sending || (!chat.newMessage.trim() && !chat.mediaPreview && !chat.editingMsg)}>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>
          </Button>
        </div>
      </form>

      {chat.error && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-destructive text-white px-4 py-2 rounded-lg text-sm shadow-lg z-40">
          {chat.error}
        </div>
      )}

      {chat.lightboxSrc && (
        <ImageLightbox
          src={chat.lightboxSrc}
          onClose={() => chat.setLightboxSrc(null)}
          canBypass={chat.canBypass}
          onScreenshotDetected={chat.handleScreenshotDetected}
        />
      )}
    </div>
  );
}
