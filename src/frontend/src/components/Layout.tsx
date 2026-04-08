import { Globe, LogOut, Save, Wifi, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  getLanguageMeta,
  setAppLanguage,
  useTranslation,
} from "../hooks/useTranslation";
import { saveToGoogle } from "../services/googleSync";
import {
  type SyncStatus,
  getLastError,
  getSyncStatus,
  onSyncStatus,
  saveToMotoko,
} from "../services/motokoSync";
import { useStore } from "../store/useStore";

interface LayoutProps {
  children: React.ReactNode;
  currentPage: string;
  onNavigate: (page: string) => void;
}

const NAV_PAGES = [
  { key: "dashboard", navKey: "nav.tableau_de_bord" },
  { key: "rapport", navKey: "nav.rapport_pdf" },
  { key: "clients", navKey: "nav.base_client" },
  { key: "nouveau-rdv", navKey: "nav.nouveau_rdv" },
  { key: "semaine", navKey: "nav.calendrier_semaine" },
  { key: "journalier", navKey: "nav.calendrier_journalier" },
  { key: "mensuel", navKey: "nav.calendrier_mensuel" },
  { key: "utilisateurs", navKey: "nav.utilisateurs" },
  { key: "langues", navKey: "nav.langues" },
];

export function Layout({ children, currentPage, onNavigate }: LayoutProps) {
  const { t, lang } = useTranslation();
  const { settings, currentUser, logout, exportData } = useStore();
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(getSyncStatus());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const langMeta = getLanguageMeta();

  useEffect(() => {
    const unsub = onSyncStatus((status) => setSyncStatus(status));
    return unsub;
  }, []);

  const handleSave = async () => {
    const data = exportData();
    // Try Motoko
    const ok = await saveToMotoko(data);
    if (ok) {
      toast.success(t("users.msg_sauvegarde_ok"));
      return;
    }
    // Try Google if configured
    if (settings.googleDriveUrl) {
      const gok = await saveToGoogle(
        settings.googleDriveUrl,
        settings.googleDrivePassword,
        data,
      );
      if (gok) {
        toast.success(t("users.msg_sauvegarde_ok"));
        return;
      }
    }
    const err = getLastError();
    if (err.includes("IC0508") || err.includes("is stopped")) {
      toast.error(t("users.msg_serveur_veille"));
    } else {
      toast.error(
        `${t("users.msg_sauvegarde_erreur")} ${err ? `Détail: ${err.substring(0, 200)}` : ""}`,
      );
    }
  };

  const handleLangChange = (code: string) => {
    setAppLanguage(code);
  };

  const handleLogout = () => {
    logout();
  };

  const isServerOk = syncStatus === "success" || syncStatus === "idle";
  const isServerStopped = syncStatus === "stopped" || syncStatus === "error";

  return (
    <div
      className="flex h-screen overflow-hidden font-verdana"
      style={{ fontFamily: "Verdana, Geneva, sans-serif" }}
    >
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-smooth ${sidebarOpen ? "w-52" : "w-52"} md:relative md:flex`}
        style={{ minWidth: "13rem" }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-sidebar-border">
          <span
            className="text-sidebar-primary font-bold text-sm tracking-tight"
            style={{ fontFamily: "Verdana, Geneva, sans-serif" }}
          >
            RevenuePlanner
          </span>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-2">
          {NAV_PAGES.map(({ key, navKey }) => {
            const isActive = currentPage === key;
            return (
              <button
                key={key}
                type="button"
                data-ocid={`nav-${key}`}
                onClick={() => {
                  onNavigate(key);
                  setSidebarOpen(false);
                }}
                className={`w-full text-left px-4 py-2 text-xs transition-smooth ${
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground font-semibold"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                }`}
                style={{ fontFamily: "Verdana, Geneva, sans-serif" }}
              >
                {t(navKey)}
              </button>
            );
          })}
        </nav>

        {/* Bottom user */}
        {currentUser && (
          <div className="px-4 py-2 border-t border-sidebar-border text-xs text-sidebar-foreground/70">
            <div className="truncate">{currentUser.login}</div>
            <div className="text-sidebar-foreground/50 capitalize">
              {currentUser.role}
            </div>
          </div>
        )}
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="flex items-center gap-2 px-4 py-2 bg-card border-b border-border shadow-xs z-30 flex-shrink-0">
          <button
            className="md:hidden p-1 rounded"
            type="button"
            onClick={() => setSidebarOpen((o) => !o)}
          >
            <span className="text-foreground text-lg">☰</span>
          </button>

          <span
            className="font-bold text-sm text-foreground mr-auto"
            style={{ fontFamily: "Verdana, Geneva, sans-serif" }}
          >
            RevenuePlanner
          </span>

          {/* Server status */}
          <div
            className={`flex items-center gap-1 text-xs ${isServerStopped ? "text-destructive" : isServerOk ? "text-green-600" : "text-muted-foreground"}`}
            title={
              isServerStopped ? t("nav.serveur_veille") : t("nav.serveur_actif")
            }
          >
            {isServerStopped ? <WifiOff size={14} /> : <Wifi size={14} />}
          </div>

          {/* Save button */}
          <button
            type="button"
            data-ocid="header-save-btn"
            onClick={handleSave}
            disabled={syncStatus === "syncing"}
            className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-smooth ${
              isServerStopped
                ? "bg-destructive/10 text-destructive border border-destructive/30 hover:bg-destructive/20"
                : "bg-green-600/10 text-green-700 border border-green-600/30 hover:bg-green-600/20 dark:text-green-400"
            }`}
          >
            <Save size={12} />
            <span className="hidden sm:inline">{t("nav.sauvegarder")}</span>
          </button>

          {/* Language selector */}
          <div className="relative">
            <select
              data-ocid="lang-selector"
              value={lang}
              onChange={(e) => handleLangChange(e.target.value)}
              className="appearance-none bg-transparent text-foreground text-xs border border-border rounded px-2 py-1 pr-5 cursor-pointer"
              style={{ fontFamily: "Verdana, Geneva, sans-serif" }}
            >
              {Object.entries(langMeta).map(([code, meta]) => (
                <option key={code} value={code}>
                  {meta.flag} {meta.flag ? "" : code.toUpperCase()}
                </option>
              ))}
            </select>
            <Globe
              size={12}
              className="absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground"
            />
          </div>

          {/* Logout */}
          <button
            type="button"
            data-ocid="header-logout-btn"
            onClick={handleLogout}
            className="p-1 rounded text-muted-foreground hover:text-destructive transition-smooth"
            title={t("nav.deconnexion")}
          >
            <LogOut size={14} />
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto bg-background">{children}</main>

        {/* Footer */}
        <footer className="bg-card border-t border-border px-4 py-2 text-center text-xs text-muted-foreground flex-shrink-0">
          © {new Date().getFullYear()}. Built with love using{" "}
          <a
            href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            caffeine.ai
          </a>
        </footer>
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-background/50 z-30 md:hidden"
          role="button"
          tabIndex={0}
          aria-label="Close menu"
          onClick={() => setSidebarOpen(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") setSidebarOpen(false);
          }}
        />
      )}
    </div>
  );
}
