import { Toaster } from "@/components/ui/sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { ThemeProvider } from "next-themes";
import { useEffect, useRef, useState } from "react";
import Footer from "./components/Footer";
import Header from "./components/Header";
import ProfileSetupModal from "./components/ProfileSetupModal";
import { LocalAuthProvider, useLocalAuth } from "./context/LocalAuthContext";
import { useActor } from "./hooks/useActor";
import { useInternetIdentity } from "./hooks/useInternetIdentity";
import { useGetCallerUserProfile } from "./hooks/useQueries";
import ClientDatabasePage from "./pages/ClientDatabasePage";
import DailyCalendarPage from "./pages/DailyCalendarPage";
import Dashboard from "./pages/Dashboard";
import LanguagesPage from "./pages/LanguagesPage";
import LocalLoginPage from "./pages/LocalLoginPage";
import MonthlyCalendarPage from "./pages/MonthlyCalendarPage";
import RapportPDFPage from "./pages/RapportPDFPage";
import UserManagementPage from "./pages/UserManagementPage";
import WeeklyCalendarPage from "./pages/WeeklyCalendarPage";
import { setCurrentActor, syncFromBackend } from "./utils/backendSync";

function Layout() {
  const { data: userProfile } = useGetCallerUserProfile();
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header userName={userProfile?.name} />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

const rootRoute = createRootRoute({ component: Layout });

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: Dashboard,
});
const weeklyCalendarRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/calendrier-semaine",
  component: WeeklyCalendarPage,
});
const dailyCalendarRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/calendrier-journalier",
  component: DailyCalendarPage,
});
const monthlyCalendarRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/calendrier-mensuel",
  component: MonthlyCalendarPage,
});
const rapportPDFRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/rapport-pdf",
  component: RapportPDFPage,
});
const clientDatabaseRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/client-database",
  component: ClientDatabasePage,
});
const userManagementRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/users",
  component: UserManagementPage,
});
const languagesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/languages",
  component: LanguagesPage,
});

const routeTree = rootRoute.addChildren([
  dashboardRoute,
  weeklyCalendarRoute,
  dailyCalendarRoute,
  monthlyCalendarRoute,
  rapportPDFRoute,
  clientDatabaseRoute,
  userManagementRoute,
  languagesRoute,
]);

const router = createRouter({ routeTree });

// Apply custom font color on startup based on localStorage setting
function FontColorInitializer() {
  useEffect(() => {
    const applyFontColor = () => {
      // Backward compat: if old orange flag was set, treat as orange color
      const oldOrange = localStorage.getItem("agenda_orange_font");
      const fontColor =
        oldOrange === "true"
          ? "rgb(226, 107, 10)"
          : (localStorage.getItem("agenda_font_color") ?? "");

      document.documentElement.classList.remove("orange-font");
      document.documentElement.classList.remove("custom-font-color");
      document.documentElement.style.removeProperty("--custom-font-color");

      if (fontColor) {
        document.documentElement.style.setProperty(
          "--custom-font-color",
          fontColor,
        );
        document.documentElement.classList.add("custom-font-color");
      }
    };
    applyFontColor();
    // React to storage changes from other tabs
    window.addEventListener("storage", applyFontColor);
    return () => window.removeEventListener("storage", applyFontColor);
  }, []);
  return null;
}

function BackendSyncProvider({ children }: { children: React.ReactNode }) {
  const { actor } = useActor();
  const queryClient = useQueryClient();
  const syncedRef = useRef(false);

  useEffect(() => {
    if (!actor) return;
    setCurrentActor(actor);
    const invalidateAll = () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      queryClient.invalidateQueries({ queryKey: ["clientRecords"] });
      queryClient.invalidateQueries({ queryKey: ["financialStats"] });
      queryClient.invalidateQueries({ queryKey: ["monthlyListing"] });
      queryClient.invalidateQueries({ queryKey: ["totalReelRecu"] });
      queryClient.invalidateQueries({ queryKey: ["rapportPDF"] });
      queryClient.invalidateQueries({ queryKey: ["clientCredit"] });
    };
    if (!syncedRef.current) {
      syncedRef.current = true;
      syncFromBackend(actor)
        .then(invalidateAll)
        .catch(() => {});
    }
    const intervalId = setInterval(() => {
      syncFromBackend(actor)
        .then(invalidateAll)
        .catch(() => {});
    }, 60000);
    return () => clearInterval(intervalId);
  }, [actor, queryClient]);

  return <>{children}</>;
}

function AuthenticatedApp() {
  const { identity } = useInternetIdentity();
  const isAuthenticated = !!identity;
  const {
    data: userProfile,
    isLoading: profileLoading,
    isFetched,
  } = useGetCallerUserProfile();
  const [showProfileSetup, setShowProfileSetup] = useState(false);

  useEffect(() => {
    if (isAuthenticated && !profileLoading && isFetched && userProfile === null)
      setShowProfileSetup(true);
    else setShowProfileSetup(false);
  }, [isAuthenticated, profileLoading, isFetched, userProfile]);

  return (
    <BackendSyncProvider>
      <RouterProvider router={router} />
      {showProfileSetup && (
        <ProfileSetupModal onComplete={() => setShowProfileSetup(false)} />
      )}
      <Toaster />
    </BackendSyncProvider>
  );
}

function AppWithLocalAuth() {
  const { session, isReady } = useLocalAuth();
  const { identity } = useInternetIdentity();
  const _isIcpAuthenticated = !!identity;

  if (!isReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
          <p
            className="text-muted-foreground"
            style={{ fontFamily: "Verdana, sans-serif", fontSize: 12 }}
          >
            Chargement...
          </p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <>
        <LocalLoginPage />
        <Toaster />
      </>
    );
  }

  return <AuthenticatedApp />;
}

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <FontColorInitializer />
      <LocalAuthProvider>
        <AppWithLocalAuth />
      </LocalAuthProvider>
    </ThemeProvider>
  );
}
