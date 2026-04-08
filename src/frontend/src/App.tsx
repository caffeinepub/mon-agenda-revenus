import { useState } from "react";
import { Toaster } from "sonner";
import { AppointmentForm } from "./components/AppointmentForm";
import { Layout } from "./components/Layout";
import { BaseClient } from "./pages/BaseClient";
import { CalendrierJournalier } from "./pages/CalendrierJournalier";
import { CalendrierMensuel } from "./pages/CalendrierMensuel";
import { CalendrierSemaine } from "./pages/CalendrierSemaine";
import { Dashboard } from "./pages/Dashboard";
import { Langues } from "./pages/Langues";
import { Login } from "./pages/Login";
import { RapportPDF } from "./pages/RapportPDF";
import { Utilisateurs } from "./pages/Utilisateurs";
import { useStore } from "./store/useStore";

function AppContent() {
  const { isLoggedIn } = useStore();
  const [currentPage, setCurrentPage] = useState("dashboard");
  const [showNewRdv, setShowNewRdv] = useState(false);

  if (!isLoggedIn) {
    return <Login />;
  }

  function handleNavigate(page: string) {
    if (page === "nouveau-rdv") {
      setShowNewRdv(true);
      return;
    }
    setCurrentPage(page);
  }

  function renderPage() {
    switch (currentPage) {
      case "dashboard":
        return <Dashboard />;
      case "rapport":
        return <RapportPDF />;
      case "clients":
        return <BaseClient />;
      case "semaine":
        return <CalendrierSemaine />;
      case "journalier":
        return <CalendrierJournalier />;
      case "mensuel":
        return <CalendrierMensuel />;
      case "utilisateurs":
        return <Utilisateurs />;
      case "langues":
        return <Langues />;
      default:
        return <Dashboard />;
    }
  }

  return (
    <Layout currentPage={currentPage} onNavigate={handleNavigate}>
      {renderPage()}
      {showNewRdv && <AppointmentForm onClose={() => setShowNewRdv(false)} />}
    </Layout>
  );
}

export default function App() {
  return (
    <>
      <AppContent />
      <Toaster position="top-right" richColors closeButton />
    </>
  );
}
