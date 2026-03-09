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
import { useInternetIdentity } from "./hooks/useInternetIdentity";
import { useGetCallerUserProfile } from "./hooks/useQueries";
import ClientDatabasePage from "./pages/ClientDatabasePage";
import Dashboard from "./pages/Dashboard";
import LoginPage from "./pages/LoginPage";
import RapportPDFPage from "./pages/RapportPDFPage";

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

const routeTree = rootRoute.addChildren([
  dashboardRoute,
  rapportPDFRoute,
  clientDatabaseRoute,
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

export default function App() {
  const { identity, isInitializing } = useInternetIdentity();
  const isAuthenticated = !!identity;

  if (isInitializing) {
    return (
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="text-center">
            <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto" />
            <p className="text-muted-foreground">Chargement...</p>
          </div>
        </div>
      </ThemeProvider>
    );
  }

  if (!isAuthenticated) {
    return (
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
        <LoginPage />
        <Toaster />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <AuthenticatedApp />
    </ThemeProvider>
  );
}
