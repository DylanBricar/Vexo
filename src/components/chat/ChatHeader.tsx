import {
  DatabaseIcon,
  LogoutIcon,
  MoonIcon,
  SunIcon,
  TrashIcon,
} from "@/components/chat/ChatIcons";
import { Button } from "@/components/ui/button";
import type { ChatController } from "@/hooks/useChat";

type Props = {
  actions: ChatController["actions"];
  state: ChatController["state"];
};

export function ChatHeader({ actions, state }: Props) {
  const presence = state.otherTyping
    ? `${state.otherLabel} écrit...`
    : state.otherOnline
      ? `${state.otherLabel} en ligne`
      : state.otherLabel
        ? `${state.otherLabel} hors ligne`
        : "Connexion en cours...";
  const themeLabel =
    state.theme === "dark" ? "Activer le mode clair" : "Activer le mode sombre";
  return (
    <header className="flex shrink-0 items-center justify-between gap-2 border-b bg-card px-3 py-2 sm:px-4">
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-sm font-medium">{state.userLabel}</h1>
        <div
          className="flex min-w-0 items-center gap-1.5"
          role="status"
          aria-live="polite"
        >
          <span
            className={`size-2 shrink-0 rounded-full ${state.otherOnline ? "bg-emerald-500" : "bg-muted-foreground/40"}`}
          />
          <span className="truncate text-xs text-muted-foreground">
            {presence}
          </span>
        </div>
      </div>
      <nav
        aria-label="Actions de la conversation"
        className="flex shrink-0 items-center gap-1"
      >
        <HeaderButton label={themeLabel} onClick={actions.toggleTheme}>
          {state.theme === "dark" ? <SunIcon /> : <MoonIcon />}
        </HeaderButton>
        <HeaderButton
          label="Effacer la conversation"
          onClick={() => void actions.handleClearAll()}
          destructive
        >
          <TrashIcon />
        </HeaderButton>
        {state.canBypass && (
          <HeaderButton
            label="Nettoyer la base de données"
            onClick={() => void actions.handleWipeDB()}
            destructive
          >
            <DatabaseIcon />
          </HeaderButton>
        )}
        <Button
          variant="ghost"
          onClick={() => void actions.handleDisconnect()}
          className="h-10 min-w-10 cursor-pointer px-2 text-destructive hover:text-destructive sm:px-3"
          aria-label="Quitter la conversation"
        >
          <LogoutIcon />
          <span className="hidden sm:inline">Quitter</span>
        </Button>
      </nav>
    </header>
  );
}

function HeaderButton({
  children,
  destructive = false,
  label,
  onClick,
}: {
  children: React.ReactNode;
  destructive?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      className={`size-10 cursor-pointer ${destructive ? "text-muted-foreground hover:text-destructive" : ""}`}
      aria-label={label}
      title={label}
    >
      {children}
    </Button>
  );
}
