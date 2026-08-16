import ImageLightbox from "@/components/ImageLightbox";
import { ChatComposer } from "@/components/chat/ChatComposer";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { MessageList } from "@/components/chat/MessageList";
import type { ChatController } from "@/hooks/useChat";

export function ChatScreen({ actions, bindings, state }: ChatController) {
  return (
    <main className="flex h-dvh min-w-0 flex-col overflow-hidden bg-background">
      <ChatHeader actions={actions} state={state} />
      <MessageList actions={actions} bindings={bindings} state={state} />
      <ChatComposer actions={actions} bindings={bindings} state={state} />
      {state.error && (
        <div
          role="alert"
          className="fixed bottom-20 left-1/2 z-40 max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-lg bg-destructive px-4 py-2 text-center text-sm text-white shadow-lg"
        >
          {state.error}
        </div>
      )}
      {state.lightboxSrc && (
        <ImageLightbox
          src={state.lightboxSrc}
          onClose={() => actions.setLightboxSrc(null)}
          canBypass={state.canBypass}
          onScreenshotDetected={actions.handleScreenshotDetected}
        />
      )}
    </main>
  );
}
