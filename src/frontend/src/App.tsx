import { Toaster } from "@/components/ui/sonner";
import {
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { ThemeProvider } from "next-themes";
import { useEffect, useState } from "react";
import Footer from "./components/Footer";
import Header from "./components/Header";
import ProfileSetupModal from "./components/ProfileSetupModal";
import { LocalAuthProvider, useLocalAuth } from "./context/LocalAuthContext";
import { useInternetIdentity } from "./hooks/useInternetIdentity";
import { useGetCallerUserProfile } from "./hooks/useQueries";
import ClientDatabasePage from "./pages/ClientDatabasePage";
import Dashboard from "./pages/Dashboard";
import LocalLoginPage from "./pages/LocalLoginPage";
import RapportPDFPage from "./pages/RapportPDFPage";
import UserManagementPage from "./pages/UserManagementPage";

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

const rootRoute = createRootRoute({
  component: Layout,
});

const dashboardRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: Dashboard,
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

const routeTree = rootRoute.addChildren([
  dashboardRoute,
  rapportPDFRoute,
  clientDatabaseRoute,
  userManagementRoute,
]);

const router = createRouter({ routeTree });

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
    if (
      isAuthenticated &&
      !profileLoading &&
      isFetched &&
      userProfile === null
    ) {
      setShowProfileSetup(true);
    } else {
      setShowProfileSetup(false);
    }
  }, [isAuthenticated, profileLoading, isFetched, userProfile]);

  return (
    <>
      <RouterProvider router={router} />
      {showProfileSetup && (
        <ProfileSetupModal onComplete={() => setShowProfileSetup(false)} />
      )}
      <Toaster />
    </>
  );
}

// Inner component that uses LocalAuthContext
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

  // If not locally authenticated, show local login
  if (!session) {
    return (
      <>
        <LocalLoginPage />
        <Toaster />
      </>
    );
  }

  // Locally authenticated - show the app
  // ICP auth happens in background for backend calls
  return <AuthenticatedApp />;
}

export default function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <LocalAuthProvider>
        <AppWithLocalAuth />
      </LocalAuthProvider>
    </ThemeProvider>
  );
}
