import { useState } from "react";
import { useTranslation } from "../hooks/useTranslation";
import { getLanguageMeta, setAppLanguage } from "../hooks/useTranslation";
import { useStore } from "../store/useStore";

export function Login() {
  const { t, lang } = useTranslation();
  const { login, loginWithoutPassword, users } = useStore();
  const [identifiant, setIdentifiant] = useState("");
  const [motDePasse, setMotDePasse] = useState("");
  const [error, setError] = useState("");
  const langMeta = getLanguageMeta();

  const canAccessWithoutPwd = users.some(
    (u) => u.sansMotDePasse && u.role === "admin",
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const ok = login(identifiant, motDePasse);
    if (!ok) setError(t("login.erreur_identifiants"));
  }

  function handleNoPassword() {
    const ok = loginWithoutPassword();
    if (!ok) setError(t("login.erreur_acces"));
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <h1
            className="text-2xl font-bold text-foreground"
            style={{ fontFamily: "Verdana, Geneva, sans-serif" }}
          >
            RevenuePlanner
          </h1>
          <p
            className="text-sm text-muted-foreground mt-1"
            style={{ fontFamily: "Verdana" }}
          >
            {t("login.titre")}
          </p>
        </div>

        <div
          className="bg-card border border-border rounded-lg shadow-xs p-6"
          style={{ fontFamily: "Verdana, Geneva, sans-serif" }}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="login-id"
                className="block text-xs text-muted-foreground mb-1"
              >
                {t("login.identifiant")}
              </label>
              <input
                id="login-id"
                data-ocid="login-username"
                type="text"
                value={identifiant}
                onChange={(e) => setIdentifiant(e.target.value)}
                placeholder={t("login.placeholder_identifiant")}
                autoComplete="username"
                className="w-full border border-input rounded px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                style={{ fontFamily: "Verdana" }}
              />
            </div>

            <div>
              <label
                htmlFor="login-pwd"
                className="block text-xs text-muted-foreground mb-1"
              >
                {t("login.mot_de_passe")}
              </label>
              <input
                id="login-pwd"
                data-ocid="login-password"
                type="password"
                value={motDePasse}
                onChange={(e) => setMotDePasse(e.target.value)}
                placeholder={t("login.placeholder_mdp")}
                autoComplete="current-password"
                className="w-full border border-input rounded px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                style={{ fontFamily: "Verdana" }}
              />
            </div>

            {error && <p className="text-xs text-destructive">{error}</p>}

            <button
              type="submit"
              data-ocid="login-submit"
              className="w-full bg-primary text-primary-foreground py-2 rounded text-sm font-semibold hover:bg-primary/90 transition-smooth"
              style={{ fontFamily: "Verdana" }}
            >
              {t("login.btn_connexion")}
            </button>

            {canAccessWithoutPwd && (
              <button
                type="button"
                onClick={handleNoPassword}
                className="w-full text-xs text-muted-foreground hover:text-foreground underline"
              >
                {t("login.acces_sans_mdp")}
              </button>
            )}
          </form>
        </div>

        {/* Language selector */}
        <div className="mt-4 flex justify-center gap-2">
          {Object.entries(langMeta).map(([code, meta]) => (
            <button
              key={code}
              type="button"
              onClick={() => setAppLanguage(code)}
              className={`text-sm px-2 py-1 rounded border transition-smooth ${lang === code ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:text-foreground"}`}
            >
              {meta.flag || code.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
