import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar, Eye, EyeOff, Lock, User } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocalAuth } from "../context/LocalAuthContext";

export default function LocalLoginPage() {
  const { login, isReady } = useLocalAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const usernameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isReady) usernameRef.current?.focus();
  }, [isReady]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError("Veuillez saisir votre identifiant et votre mot de passe");
      return;
    }
    setLoading(true);
    setError("");
    const result = await login(username.trim(), password);
    setLoading(false);
    if (!result.ok) {
      setError(result.error ?? "Erreur de connexion");
      setPassword("");
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: "#f0f4f8", fontFamily: "Verdana, sans-serif" }}
    >
      <div
        className="w-full max-w-md rounded-xl shadow-lg bg-white"
        style={{ border: "1px solid #d0d7de", padding: "40px 48px" }}
      >
        {/* Logo / Title */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center rounded-xl mb-4"
            style={{
              width: 64,
              height: 64,
              background: "linear-gradient(135deg, #1a5276 0%, #2980b9 100%)",
            }}
          >
            <Calendar className="text-white" size={32} />
          </div>
          <h1
            style={{
              fontSize: 20,
              fontWeight: "bold",
              color: "#1a3a5c",
              margin: 0,
              fontFamily: "Verdana, sans-serif",
            }}
          >
            Mon Agenda Revenus
          </h1>
          <p
            style={{
              fontSize: 12,
              color: "#666",
              marginTop: 6,
              fontFamily: "Verdana, sans-serif",
            }}
          >
            Connexion à l'application
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <Label
              htmlFor="login-username"
              style={{
                fontSize: 11,
                fontWeight: "bold",
                color: "#333",
                fontFamily: "Verdana, sans-serif",
              }}
            >
              Identifiant
            </Label>
            <div className="relative mt-1">
              <User
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <Input
                id="login-username"
                ref={usernameRef}
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Votre identifiant"
                data-ocid="login.username.input"
                autoComplete="username"
                style={{
                  paddingLeft: 36,
                  fontSize: 12,
                  fontFamily: "Verdana, sans-serif",
                  height: 40,
                }}
              />
            </div>
          </div>

          <div className="mb-4">
            <Label
              htmlFor="login-password"
              style={{
                fontSize: 11,
                fontWeight: "bold",
                color: "#333",
                fontFamily: "Verdana, sans-serif",
              }}
            >
              Mot de passe
            </Label>
            <div className="relative mt-1">
              <Lock
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <Input
                id="login-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Votre mot de passe"
                data-ocid="login.password.input"
                autoComplete="current-password"
                style={{
                  paddingLeft: 36,
                  paddingRight: 40,
                  fontSize: 12,
                  fontFamily: "Verdana, sans-serif",
                  height: 40,
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                tabIndex={-1}
                data-ocid="login.show_password.toggle"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <div
              className="mb-4 rounded px-3 py-2 text-sm"
              style={{
                background: "#fdf2f2",
                border: "1px solid #f5c6cb",
                color: "#c0392b",
                fontSize: 11,
                fontFamily: "Verdana, sans-serif",
              }}
              data-ocid="login.error_state"
            >
              {error}
            </div>
          )}

          <Button
            type="submit"
            disabled={loading}
            data-ocid="login.submit_button"
            style={{
              width: "100%",
              height: 42,
              fontSize: 13,
              fontWeight: "bold",
              fontFamily: "Verdana, sans-serif",
              background: "#1a5276",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              marginTop: 4,
              cursor: loading ? "wait" : "pointer",
            }}
          >
            {loading ? "Connexion en cours..." : "Se connecter"}
          </Button>
        </form>
      </div>
    </div>
  );
}
