import { Button } from "@/components/ui/button";
import { Calendar, Clock, DollarSign, TrendingUp } from "lucide-react";
import { useInternetIdentity } from "../hooks/useInternetIdentity";

export default function LoginPage() {
  const { login, loginStatus } = useInternetIdentity();
  const isLoggingIn = loginStatus === "logging-in";

  const handleLogin = async () => {
    try {
      await login();
    } catch (error: any) {
      console.error("Login error:", error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5">
      <div className="container flex min-h-screen flex-col items-center justify-center py-12">
        <div className="mx-auto w-full max-w-5xl">
          <div className="text-center mb-12">
            <div className="mb-6 flex justify-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent shadow-lg">
                <Calendar className="h-10 w-10 text-primary-foreground" />
              </div>
            </div>
            <h1 className="mb-3 text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
              Mon Agenda Revenus
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Gérez vos rendez-vous et suivez vos revenus en toute simplicité
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-12">
            <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <Calendar className="h-6 w-6 text-primary" />
              </div>
              <h3 className="mb-2 font-semibold text-card-foreground">
                Gestion des rendez-vous
              </h3>
              <p className="text-sm text-muted-foreground">
                Ajoutez, modifiez et organisez vos rendez-vous clients
              </p>
            </div>

            <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-accent/10">
                <DollarSign className="h-6 w-6 text-accent-foreground" />
              </div>
              <h3 className="mb-2 font-semibold text-card-foreground">
                Suivi des paiements
              </h3>
              <p className="text-sm text-muted-foreground">
                Marquez les montants comme payés ou dus
              </p>
            </div>

            <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                <TrendingUp className="h-6 w-6 text-primary" />
              </div>
              <h3 className="mb-2 font-semibold text-card-foreground">
                Statistiques financières
              </h3>
              <p className="text-sm text-muted-foreground">
                Visualisez vos revenus et montants dus
              </p>
            </div>

            <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-accent/10">
                <Clock className="h-6 w-6 text-accent-foreground" />
              </div>
              <h3 className="mb-2 font-semibold text-card-foreground">
                Historique complet
              </h3>
              <p className="text-sm text-muted-foreground">
                Accédez à tous vos rendez-vous passés et futurs
              </p>
            </div>
          </div>

          <div className="flex justify-center">
            <Button
              onClick={handleLogin}
              disabled={isLoggingIn}
              size="lg"
              className="px-8 text-base font-semibold shadow-lg"
            >
              {isLoggingIn ? "Connexion en cours..." : "Se connecter"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
