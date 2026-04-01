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
  Cloud,
  FileBarChart,
  Grid3x3,
  LayoutDashboard,
  Loader2,
  LogOut,
  Plus,
  ShieldCheck,
  User,
  Users,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocalAuth } from "../context/LocalAuthContext";
import { useInternetIdentity } from "../hooks/useInternetIdentity";
import { getGoogleScriptUrl, syncToGoogle } from "../utils/backendSync";
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
  const [isSyncing, setIsSyncing] = useState(false);

  const isAdmin = session?.role === "admin";
  const isReader = session?.role === "reader";
  const googleUrl = getGoogleScriptUrl();

  const handleLogout = async () => {
    logout();
    try {
      await clear();
    } catch {
      /* ignore */
    }
    queryClient.clear();
  };

  const handleGoogleSync = async () => {
    setIsSyncing(true);
    try {
      await syncToGoogle();
      toast.success("Données sauvegardées vers Google avec succès ✓");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Erreur de synchronisation Google : ${msg}`, {
        duration: 8000,
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const roleLabel =
    session?.role === "admin"
      ? "Administrateur"
      : session?.role === "advanced"
        ? "Utilisateur Avancé"
        : "Lecteur";

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

              {/* Google Sync button — only if URL is configured */}
              {googleUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 px-2 border-blue-500 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:border-blue-400 dark:hover:bg-blue-950"
                  onClick={handleGoogleSync}
                  disabled={isSyncing}
                  title="Sauvegarder toutes les données vers Google Drive"
                  data-ocid="header.google_sync.button"
                >
                  {isSyncing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Cloud className="h-4 w-4" />
                  )}
                  <span className="hidden sm:inline text-xs">
                    {isSyncing ? "Sync..." : "Sync Google"}
                  </span>
                </Button>
              )}

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
