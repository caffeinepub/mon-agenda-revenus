import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import {
  Calendar,
  CalendarDays,
  CalendarRange,
  FileBarChart,
  Grid3x3,
  LayoutDashboard,
  Loader2,
  LogOut,
  Plus,
  Save,
  ShieldCheck,
  User,
  Users,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useLocalAuth } from "../context/LocalAuthContext";
import { useActor } from "../hooks/useActor";
import { useInternetIdentity } from "../hooks/useInternetIdentity";
import { syncToBackend } from "../utils/backendSync";
import AppointmentDialog from "./AppointmentDialog";

interface HeaderProps {
  userName?: string;
}

export default function Header({ userName: _userName }: HeaderProps) {
  const { clear } = useInternetIdentity();
  const { session, logout } = useLocalAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;
  const [isNewAppointmentOpen, setIsNewAppointmentOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { actor } = useActor();
  // null = checking, true = online, false = stopped/offline
  const [canisterOnline, setCanisterOnline] = useState<boolean | null>(null);
  const checkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isAdmin = session?.role === "admin";
  const isReader = session?.role === "reader";

  useEffect(() => {
    if (!actor || !session) return;
    const checkCanisterStatus = async () => {
      try {
        await actor.getSharedData();
        setCanisterOnline(true);
      } catch {
        setCanisterOnline(false);
      }
    };
    checkCanisterStatus();
    checkIntervalRef.current = setInterval(checkCanisterStatus, 30000);
    return () => {
      if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
    };
  }, [actor, session]);

  const handleLogout = async () => {
    logout();
    try {
      await clear();
    } catch {
      /* ignore */
    }
    queryClient.clear();
  };

  const handleManualSave = async () => {
    if (!actor) {
      toast.error("Connexion au serveur non disponible. Rechargez la page.");
      return;
    }
    setIsSaving(true);
    try {
      await syncToBackend(actor);
      setCanisterOnline(true);
      toast.success("Données sauvegardées sur le serveur avec succès ✓");
    } catch (err1) {
      // Retry once after 3 seconds
      try {
        await new Promise((resolve) => setTimeout(resolve, 3000));
        await syncToBackend(actor);
        setCanisterOnline(true);
        toast.success("Données sauvegardées sur le serveur avec succès ✓");
      } catch (err2) {
        setCanisterOnline(false);
        const msg = err2 instanceof Error ? err2.message : String(err2);
        const isStopped = msg.includes("is stopped") || msg.includes("IC0508");
        if (isStopped) {
          toast.error(
            "Le serveur est en veille (brouillon expiré). Vos données restent en local. Demandez un redéploiement pour réactiver la synchronisation.",
            { duration: 10000 },
          );
        } else {
          const shortMsg = msg.length > 200 ? `${msg.slice(0, 200)}…` : msg;
          toast.error(
            `Erreur lors de la sauvegarde. Les données sont conservées en local. Détail : ${shortMsg}`,
            { duration: 8000 },
          );
        }
        console.error("Manuel save error:", err1, err2);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const roleLabel =
    session?.role === "admin"
      ? "Administrateur"
      : session?.role === "advanced"
        ? "Utilisateur Avancé"
        : "Lecteur";

  // Status indicator for canister
  const StatusDot = () => {
    if (canisterOnline === null)
      return (
        <span
          title="Vérification de la connexion au serveur..."
          style={{
            display: "inline-block",
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "#999",
            marginLeft: 4,
          }}
        />
      );
    if (canisterOnline)
      return (
        <span
          title="Serveur actif — synchronisation disponible"
          style={{
            display: "inline-block",
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "#22c55e",
            marginLeft: 4,
          }}
        />
      );
    return (
      <span
        title="Serveur en veille (brouillon expiré) — données locales uniquement. Cliquer sur Sauvegarder ou demander un redéploiement."
        style={{
          display: "inline-block",
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: "#ef4444",
          marginLeft: 4,
        }}
      />
    );
  };

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent">
              <Calendar className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">
                Mon Agenda Revenus
              </h1>
            </div>
          </div>

          {session && (
            <div className="flex items-center gap-2">
              <nav className="hidden md:flex items-center gap-1">
                <Button
                  variant={currentPath === "/" ? "default" : "ghost"}
                  size="sm"
                  className="gap-1 px-2"
                  onClick={() => navigate({ to: "/" })}
                  data-ocid="nav.dashboard.link"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  <span className="text-xs">Tableau de bord</span>
                </Button>
                <Button
                  variant={
                    currentPath === "/calendrier-mensuel" ? "default" : "ghost"
                  }
                  size="sm"
                  className="gap-1 px-2"
                  onClick={() => navigate({ to: "/calendrier-mensuel" })}
                  data-ocid="nav.monthly.link"
                >
                  <Grid3x3 className="h-4 w-4" />
                  <span className="text-xs">Cal. Mensuel</span>
                </Button>
                <Button
                  variant={
                    currentPath === "/calendrier-semaine" ? "default" : "ghost"
                  }
                  size="sm"
                  className="gap-1 px-2"
                  onClick={() => navigate({ to: "/calendrier-semaine" })}
                  data-ocid="nav.weekly.link"
                >
                  <CalendarDays className="h-4 w-4" />
                  <span className="text-xs">Cal. Semaine</span>
                </Button>
                <Button
                  variant={
                    currentPath === "/calendrier-journalier"
                      ? "default"
                      : "ghost"
                  }
                  size="sm"
                  className="gap-1 px-2"
                  onClick={() => navigate({ to: "/calendrier-journalier" })}
                  data-ocid="nav.daily.link"
                >
                  <CalendarRange className="h-4 w-4" />
                  <span className="text-xs">Cal. Journalier</span>
                </Button>
                <Button
                  variant={currentPath === "/rapport-pdf" ? "default" : "ghost"}
                  size="sm"
                  className="gap-1 px-2"
                  onClick={() => navigate({ to: "/rapport-pdf" })}
                  data-ocid="nav.rapport.link"
                >
                  <FileBarChart className="h-4 w-4" />
                  <span className="text-xs">Rapport PDF</span>
                </Button>
                <Button
                  variant={
                    currentPath === "/client-database" ? "default" : "ghost"
                  }
                  size="sm"
                  className="gap-1 px-2"
                  onClick={() => navigate({ to: "/client-database" })}
                  data-ocid="nav.clients.link"
                >
                  <Users className="h-4 w-4" />
                  <span className="text-xs">Base Client</span>
                </Button>
                {isAdmin && (
                  <Button
                    variant={currentPath === "/users" ? "default" : "ghost"}
                    size="sm"
                    className="gap-1 px-2"
                    onClick={() => navigate({ to: "/users" })}
                    data-ocid="nav.users.link"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    <span className="text-xs">Utilisateurs</span>
                  </Button>
                )}
              </nav>

              {/* Canister status + Manual save button */}
              <div
                className="flex items-center gap-1"
                title={
                  canisterOnline === true
                    ? "Serveur actif — synchronisation disponible"
                    : canisterOnline === false
                      ? "Serveur en veille — données locales uniquement. Cliquer sur Sauvegarder pour tenter la reconnexion."
                      : "Vérification de la connexion..."
                }
              >
                {canisterOnline === false ? (
                  <WifiOff className="h-3 w-3 text-red-500" />
                ) : canisterOnline === true ? (
                  <Wifi className="h-3 w-3 text-green-500" />
                ) : null}
                <StatusDot />
              </div>

              <Button
                variant="outline"
                size="sm"
                className={
                  canisterOnline === false
                    ? "gap-1 px-2 border-red-400 text-red-600 hover:bg-red-50 dark:text-red-400 dark:border-red-500"
                    : "gap-1 px-2 border-green-600 text-green-700 hover:bg-green-50 dark:text-green-400 dark:border-green-500 dark:hover:bg-green-950"
                }
                onClick={handleManualSave}
                disabled={isSaving}
                title={
                  canisterOnline === false
                    ? "Serveur en veille (brouillon expiré). Tentez quand même une sauvegarde."
                    : "Sauvegarder manuellement toutes les données vers le serveur"
                }
                data-ocid="header.manual_save.button"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                <span className="hidden sm:inline text-xs">
                  {isSaving ? "Sauvegarde..." : "Sauvegarder"}
                </span>
              </Button>

              {!isReader && (
                <Button
                  variant="default"
                  size="sm"
                  className="gap-2"
                  onClick={() => setIsNewAppointmentOpen(true)}
                  data-ocid="header.new_appointment.button"
                >
                  <Plus className="h-4 w-4" />
                  <span className="hidden sm:inline text-xs">Nouveau RDV</span>
                </Button>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-2"
                    data-ocid="header.account.button"
                  >
                    <User className="h-4 w-4" />
                    <span className="hidden sm:inline">{session.username}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>
                    <div
                      style={{
                        fontFamily: "Verdana, sans-serif",
                        fontSize: 11,
                      }}
                    >
                      {session.username}
                    </div>
                    <div
                      style={{
                        fontSize: 9,
                        color: "#888",
                        fontFamily: "Verdana, sans-serif",
                        fontWeight: "normal",
                      }}
                    >
                      {roleLabel}
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <div className="md:hidden">
                    <DropdownMenuItem onClick={() => navigate({ to: "/" })}>
                      <LayoutDashboard className="mr-2 h-4 w-4" />
                      Tableau de bord
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => navigate({ to: "/calendrier-mensuel" })}
                      data-ocid="nav.monthly.mobile.link"
                    >
                      <Grid3x3 className="mr-2 h-4 w-4" />
                      Calendrier Mensuel
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => navigate({ to: "/calendrier-semaine" })}
                      data-ocid="nav.weekly.mobile.link"
                    >
                      <CalendarDays className="mr-2 h-4 w-4" />
                      Calendrier Semaine
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => navigate({ to: "/calendrier-journalier" })}
                      data-ocid="nav.daily.mobile.link"
                    >
                      <CalendarRange className="mr-2 h-4 w-4" />
                      Calendrier Journalier
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => navigate({ to: "/rapport-pdf" })}
                    >
                      <FileBarChart className="mr-2 h-4 w-4" />
                      Rapport PDF
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => navigate({ to: "/client-database" })}
                    >
                      <Users className="mr-2 h-4 w-4" />
                      Base Client
                    </DropdownMenuItem>
                    {isAdmin && (
                      <DropdownMenuItem
                        onClick={() => navigate({ to: "/users" })}
                      >
                        <ShieldCheck className="mr-2 h-4 w-4" />
                        Utilisateurs
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                  </div>
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="text-destructive"
                    data-ocid="header.logout.button"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    Déconnexion
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      </header>

      <AppointmentDialog
        open={isNewAppointmentOpen}
        onClose={() => setIsNewAppointmentOpen(false)}
      />
    </>
  );
}
