import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Cloud,
  Download,
  Edit,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  Save,
  ShieldCheck,
  Trash,
  Trash2,
  Upload,
  UserCheck,
  UserX,
  X,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { type UserRole, useLocalAuth } from "../context/LocalAuthContext";
import {
  clearAllData,
  downloadExportCsv,
  getExportJson,
  getGoogleScriptUrl,
  getGoogleSecret,
  restoreFromJson,
  setGoogleScriptUrl,
  setGoogleSecret,
  syncFromGoogle,
  syncToGoogle,
} from "../utils/backendSync";

const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Administrateur",
  advanced: "Utilisateur Avancé",
  reader: "Utilisateur Lecteur",
};

const ROLE_COLORS: Record<UserRole, string> = {
  admin: "#1a5276",
  advanced: "#117a65",
  reader: "#784212",
};

const ROLE_BG: Record<UserRole, string> = {
  admin: "#d6eaf8",
  advanced: "#d1f2eb",
  reader: "#fdebd0",
};

const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  admin:
    "Tous les droits, gestion des utilisateurs, ajout/modification/suppression de rendez-vous",
  advanced:
    "Ajout, modification et suppression de rendez-vous. Pas accès à la gestion des utilisateurs",
  reader:
    "Lecture seule. Peut consulter les rendez-vous et la comptabilité. Aucune modification possible",
};

const GOOGLE_APPS_SCRIPT_CODE = `// ============================================================
// IMPORTANT : Remplacez MON_MOT_DE_PASSE_SECRET par votre mot de passe
// Ce mot de passe doit correspondre à celui configuré dans l'application
// ============================================================
var SECRET_KEY = 'MON_MOT_DE_PASSE_SECRET';

function doGet(e) {
  // Vérification du mot de passe
  var key = e && e.parameter ? e.parameter.key : '';
  if (SECRET_KEY !== '' && key !== SECRET_KEY) {
    return ContentService.createTextOutput(
      JSON.stringify({error: 'Accès refusé - mot de passe incorrect'})
    ).setMimeType(ContentService.MimeType.JSON);
  }
  var fileName = 'agenda-revenus-data.json';
  var files = DriveApp.getFilesByName(fileName);
  var content = '{}';
  if (files.hasNext()) {
    content = files.next().getBlob().getDataAsString();
  }
  return ContentService.createTextOutput(content)
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  // Vérification du mot de passe
  var data = e.postData.contents;
  var payload = JSON.parse(data);
  if (SECRET_KEY !== '' && payload._secret !== SECRET_KEY) {
    return ContentService.createTextOutput(
      JSON.stringify({error: 'Accès refusé - mot de passe incorrect'})
    ).setMimeType(ContentService.MimeType.JSON);
  }
  delete payload._secret;
  var fileName = 'agenda-revenus-data.json';
  var files = DriveApp.getFilesByName(fileName);
  var fileContent = JSON.stringify(payload);
  if (files.hasNext()) {
    files.next().setContent(fileContent);
  } else {
    DriveApp.createFile(fileName, fileContent, MimeType.PLAIN_TEXT);
  }
  return ContentService.createTextOutput(
    JSON.stringify({success: true, updated: new Date().toISOString()})
  ).setMimeType(ContentService.MimeType.JSON);
}`;

function GoogleSyncSection() {
  const [scriptUrl, setScriptUrlState] = useState<string>(() =>
    getGoogleScriptUrl(),
  );
  const [secret, setSecretState] = useState<string>(() => getGoogleSecret());
  const [showSecret, setShowSecret] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleSaveUrl = () => {
    setGoogleScriptUrl(scriptUrl.trim());
    toast.success("URL Google Apps Script enregistrée");
  };

  const handleSaveSecret = () => {
    setGoogleSecret(secret.trim());
    toast.success("Mot de passe enregistré");
  };

  const handleSyncToGoogle = async () => {
    setSaving(true);
    try {
      await syncToGoogle();
      toast.success("Données sauvegardées vers Google Drive ✓");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error(`Erreur : ${msg}`, { duration: 8000 });
    } finally {
      setSaving(false);
    }
  };

  const handleSyncFromGoogle = async () => {
    setLoading(true);
    try {
      const result = await syncFromGoogle();
      if (result.ok) {
        toast.success("Données chargées depuis Google Drive. Rechargement...");
        setTimeout(() => window.location.reload(), 1500);
      } else {
        toast.error(`Erreur : ${result.error ?? "Inconnu"}`, {
          duration: 8000,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCopyScript = () => {
    navigator.clipboard.writeText(GOOGLE_APPS_SCRIPT_CODE).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div
      style={{
        marginTop: 16,
        padding: "16px 20px",
        background: "#e8f0fe",
        border: "1px solid #3b82f6",
        borderRadius: 8,
      }}
    >
      <div
        style={{
          fontWeight: "bold",
          fontSize: 12,
          color: "#1e3a8a",
          marginBottom: 6,
          fontFamily: "Verdana, sans-serif",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <Cloud size={14} />
        Synchronisation Google Drive
      </div>
      <div
        style={{
          fontSize: 10,
          color: "#374151",
          marginBottom: 14,
          fontFamily: "Verdana, sans-serif",
          lineHeight: 1.6,
        }}
      >
        Connectez l'application à un fichier sur votre Google Drive pour
        synchroniser vos données entre tous vos appareils. Le bouton "Sync
        Google" apparaîtra dans la barre de navigation une fois l'URL
        configurée.
      </div>

      {/* URL input + save */}
      <div style={{ marginBottom: 10 }}>
        <label
          htmlFor="google-script-url"
          style={{
            display: "block",
            fontSize: 10,
            fontWeight: "bold",
            color: "#1e3a8a",
            marginBottom: 4,
            fontFamily: "Verdana, sans-serif",
          }}
        >
          URL Google Apps Script
        </label>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            id="google-script-url"
            type="url"
            value={scriptUrl}
            onChange={(e) => setScriptUrlState(e.target.value)}
            placeholder="https://script.google.com/macros/s/.../exec"
            data-ocid="users.google_script_url.input"
            style={{
              flex: 1,
              height: 32,
              padding: "0 8px",
              fontSize: 10,
              fontFamily: "Verdana, sans-serif",
              border: "1px solid #93c5fd",
              borderRadius: 4,
              background: "#fff",
              color: "#111",
            }}
          />
          <Button
            onClick={handleSaveUrl}
            data-ocid="users.google_save_url.button"
            style={{
              height: 32,
              fontSize: 10,
              background: "#1e3a8a",
              color: "#fff",
              fontFamily: "Verdana, sans-serif",
              display: "flex",
              alignItems: "center",
              gap: 5,
              whiteSpace: "nowrap",
            }}
          >
            <Save size={12} /> Enregistrer l'URL
          </Button>
        </div>
      </div>

      {/* Secret key input */}
      <div style={{ marginBottom: 10 }}>
        <label
          htmlFor="google-secret"
          style={{
            display: "block",
            fontSize: 10,
            fontWeight: "bold",
            color: "#1e3a8a",
            marginBottom: 4,
            fontFamily: "Verdana, sans-serif",
          }}
        >
          Mot de passe secret (doit correspondre au script)
        </label>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ position: "relative", flex: 1 }}>
            <input
              id="google-secret"
              type={showSecret ? "text" : "password"}
              value={secret}
              onChange={(e) => setSecretState(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSaveSecret();
              }}
              placeholder="Entrez votre mot de passe secret"
              data-ocid="users.google_secret.input"
              style={{
                width: "100%",
                height: 32,
                padding: "0 32px 0 8px",
                fontSize: 10,
                fontFamily: "Verdana, sans-serif",
                border: "1px solid #93c5fd",
                borderRadius: 4,
                background: "#fff",
                color: "#111",
                boxSizing: "border-box",
              }}
            />
            <button
              type="button"
              onClick={() => setShowSecret((v) => !v)}
              style={{
                position: "absolute",
                right: 6,
                top: "50%",
                transform: "translateY(-50%)",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
                color: "#4b5563",
                fontSize: 12,
              }}
              title={showSecret ? "Masquer" : "Afficher"}
            >
              {showSecret ? "🙈" : "👁"}
            </button>
          </div>
          <Button
            onClick={handleSaveSecret}
            data-ocid="users.google_save_secret.button"
            style={{
              height: 32,
              fontSize: 10,
              background: "#1e3a8a",
              color: "#fff",
              fontFamily: "Verdana, sans-serif",
              display: "flex",
              alignItems: "center",
              gap: 5,
              whiteSpace: "nowrap",
            }}
          >
            <Save size={12} /> Enregistrer le mot de passe
          </Button>
        </div>
        <div
          style={{
            fontSize: 9,
            color: "#6b7280",
            marginTop: 3,
            fontFamily: "Verdana, sans-serif",
          }}
        >
          Ce mot de passe doit être identique à la valeur de SECRET_KEY dans
          votre script Google.
        </div>
      </div>

      {/* Action buttons */}
      <div
        style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}
      >
        <Button
          onClick={handleSyncToGoogle}
          disabled={saving || !scriptUrl.trim()}
          data-ocid="users.google_upload.button"
          style={{
            height: 32,
            fontSize: 10,
            background: "#2563eb",
            color: "#fff",
            fontFamily: "Verdana, sans-serif",
            display: "flex",
            alignItems: "center",
            gap: 5,
          }}
        >
          {saving ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Upload size={12} />
          )}
          {saving ? "Sauvegarde..." : "Sauvegarder vers Google"}
        </Button>
        <Button
          onClick={handleSyncFromGoogle}
          disabled={loading || !scriptUrl.trim()}
          data-ocid="users.google_download.button"
          style={{
            height: 32,
            fontSize: 10,
            background: "#0284c7",
            color: "#fff",
            fontFamily: "Verdana, sans-serif",
            display: "flex",
            alignItems: "center",
            gap: 5,
          }}
        >
          {loading ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Download size={12} />
          )}
          {loading ? "Chargement..." : "Charger depuis Google"}
        </Button>
      </div>

      {/* Instructions toggle */}
      <button
        type="button"
        onClick={() => setShowInstructions((v) => !v)}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          fontSize: 10,
          color: "#1e40af",
          fontFamily: "Verdana, sans-serif",
          display: "flex",
          alignItems: "center",
          gap: 4,
          padding: 0,
          marginBottom: showInstructions ? 10 : 0,
        }}
      >
        {showInstructions ? "▼" : "▶"} Instructions de configuration
      </button>

      {showInstructions && (
        <div
          style={{
            background: "#eff6ff",
            border: "1px solid #bfdbfe",
            borderRadius: 6,
            padding: "12px 14px",
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontFamily: "Verdana, sans-serif",
              color: "#1e3a8a",
              fontWeight: "bold",
              marginBottom: 8,
            }}
          >
            Configuration en 4 étapes (à faire une seule fois)
          </div>
          <ol
            style={{
              margin: 0,
              paddingLeft: 18,
              fontSize: 10,
              fontFamily: "Verdana, sans-serif",
              color: "#374151",
              lineHeight: 2,
            }}
          >
            <li>
              Aller sur <strong>script.google.com</strong> → "Nouveau projet"
            </li>
            <li>
              Remplacer tout le code par le script ci-dessous, puis cliquer
              "Enregistrer"
            </li>
            <li>
              Cliquer "Déployer" → "Nouveau déploiement" → Type : "Application
              Web" → Accès : "Tout le monde" → Déployer
            </li>
            <li>Copier l'URL générée et la coller dans le champ ci-dessus</li>
          </ol>
          <div style={{ marginTop: 10 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 4,
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  fontFamily: "Verdana, sans-serif",
                  fontWeight: "bold",
                  color: "#1e3a8a",
                }}
              >
                Script Google Apps Script :
              </span>
              <Button
                onClick={handleCopyScript}
                data-ocid="users.google_copy_script.button"
                style={{
                  height: 26,
                  fontSize: 9,
                  background: copied ? "#059669" : "#6366f1",
                  color: "#fff",
                  fontFamily: "Verdana, sans-serif",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                {copied ? "✓ Copié !" : "Copier le script"}
              </Button>
            </div>
            <textarea
              readOnly
              value={GOOGLE_APPS_SCRIPT_CODE}
              rows={14}
              style={{
                width: "100%",
                fontSize: 9,
                fontFamily: "monospace",
                background: "#1e1e2e",
                color: "#cdd6f4",
                border: "1px solid #bfdbfe",
                borderRadius: 4,
                padding: "8px 10px",
                resize: "vertical",
                boxSizing: "border-box",
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function UserManagementPage() {
  const {
    users,
    session,
    addUserAsync,
    updateUserAsync,
    removeUser,
    bypass,
    setBypass,
  } = useLocalAuth();

  const isAdmin = session?.role === "admin";
  const { theme, setTheme } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [selectedFontColor, setSelectedFontColorState] = useState<string>(
    () => {
      // Backward compat: if old orange flag was set, treat as orange color
      const oldOrange = localStorage.getItem("agenda_orange_font");
      if (oldOrange === "true") {
        return "rgb(226, 107, 10)";
      }
      return localStorage.getItem("agenda_font_color") ?? "";
    },
  );

  const FONT_COLOR_OPTIONS = [
    { label: "Défaut", value: "", bg: "#888", isDefault: true },
    { label: "Orange", value: "rgb(226, 107, 10)", bg: "rgb(226, 107, 10)" },
    { label: "Jaune", value: "rgb(230, 210, 50)", bg: "rgb(230, 210, 50)" },
    {
      label: "Vert clair",
      value: "rgb(80, 200, 120)",
      bg: "rgb(80, 200, 120)",
    },
    { label: "Cyan", value: "rgb(80, 200, 220)", bg: "rgb(80, 200, 220)" },
    { label: "Rose", value: "rgb(240, 140, 180)", bg: "rgb(240, 140, 180)" },
    { label: "Blanc", value: "rgb(255, 255, 255)", bg: "rgb(255, 255, 255)" },
  ];

  const applyFontColor = (colorValue: string) => {
    setSelectedFontColorState(colorValue);
    localStorage.setItem("agenda_font_color", colorValue);
    // Remove both old and new classes
    document.documentElement.classList.remove("orange-font");
    document.documentElement.classList.remove("custom-font-color");
    document.documentElement.style.removeProperty("--custom-font-color");
    if (colorValue) {
      document.documentElement.style.setProperty(
        "--custom-font-color",
        colorValue,
      );
      document.documentElement.classList.add("custom-font-color");
    }
  };

  // Reset dialog state
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [exportedBeforeReset, setExportedBeforeReset] = useState(false);

  const handleExport = () => {
    const json = getExportJson();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mon-agenda-revenus-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Données exportées avec succès");
  };

  const handleExportBeforeReset = () => {
    handleExport();
    setExportedBeforeReset(true);
    toast.success("Sauvegarde JSON téléchargée");
  };

  const handleExportCsvBeforeReset = () => {
    downloadExportCsv();
    setExportedBeforeReset(true);
    toast.success("Sauvegarde CSV téléchargée (rendez-vous + clients)");
  };

  const handleResetConfirm = async () => {
    setResetLoading(true);
    try {
      await clearAllData();
      toast.success(
        "Toutes les données (rendez-vous et clients) ont été effacées.",
      );
      setShowResetDialog(false);
      setTimeout(() => window.location.reload(), 1200);
    } catch {
      toast.error("Erreur lors de la réinitialisation");
    } finally {
      setResetLoading(false);
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportLoading(true);
    try {
      const text = await file.text();
      const result = restoreFromJson(text);
      if (!result.ok) {
        toast.error(result.error ?? "Erreur lors de l'importation");
        return;
      }
      toast.success("Données importées avec succès. Rechargement...");
      setTimeout(() => window.location.reload(), 1500);
    } finally {
      setImportLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Add user form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<UserRole>("reader");
  const [addError, setAddError] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showEditPassword, setShowEditPassword] = useState(false);

  // Edit user
  const [editingUsername, setEditingUsername] = useState<string | null>(null);
  const [editPassword, setEditPassword] = useState("");
  const [editRole, setEditRole] = useState<UserRole>("reader");
  const [editError, setEditError] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  // Delete
  const [deleteUsername, setDeleteUsername] = useState<string | null>(null);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername.trim()) {
      setAddError("L'identifiant est obligatoire");
      return;
    }
    if (!newPassword) {
      setAddError("Le mot de passe est obligatoire");
      return;
    }
    setAddLoading(true);
    setAddError("");
    const result = await addUserAsync(newUsername.trim(), newPassword, newRole);
    setAddLoading(false);
    if (result.ok) {
      toast.success(`Utilisateur "${newUsername.trim()}" ajouté`);
      setNewUsername("");
      setNewPassword("");
      setNewRole("reader");
      setShowAddForm(false);
    } else {
      setAddError(result.error ?? "Erreur");
    }
  };

  const startEdit = (username: string) => {
    const u = users.find((u) => u.username === username);
    if (!u) return;
    setEditingUsername(username);
    setEditRole(u.role);
    setEditPassword("");
    setEditError("");
  };

  const handleEditSave = async () => {
    if (!editingUsername) return;
    setEditLoading(true);
    setEditError("");
    const result = await updateUserAsync(
      editingUsername,
      editPassword || null,
      editRole,
    );
    setEditLoading(false);
    if (result.ok) {
      toast.success("Utilisateur mis à jour");
      setEditingUsername(null);
    } else {
      setEditError(result.error ?? "Erreur");
    }
  };

  const handleDelete = () => {
    if (!deleteUsername) return;
    const result = removeUser(deleteUsername);
    if (result.ok) {
      toast.success(`Utilisateur "${deleteUsername}" supprimé`);
    } else {
      toast.error(result.error ?? "Erreur");
    }
    setDeleteUsername(null);
  };

  return (
    <div
      className="bg-background text-foreground"
      style={{
        fontFamily: "Verdana, sans-serif",
        padding: "24px 16px",
        maxWidth: 900,
        margin: "0 auto",
      }}
    >
      {/* Title */}
      <div
        style={{
          background: "#1a3a5c",
          color: "#fff",
          borderRadius: 8,
          padding: "12px 20px",
          marginBottom: 24,
          display: "flex",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 10,
        }}
      >
        <ShieldCheck size={22} />
        <span style={{ fontSize: 16, fontWeight: "bold" }}>
          Gestion des Utilisateurs
        </span>
        <span style={{ marginLeft: "auto", fontSize: 11, opacity: 0.7 }}>
          Connecté : {session?.username} (
          {session?.role ? ROLE_LABELS[session.role] : ""})
        </span>
      </div>

      {/* Role descriptions */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
          marginBottom: 24,
        }}
      >
        {(Object.keys(ROLE_LABELS) as UserRole[]).map((role) => (
          <div
            key={role}
            className="dark:bg-gray-800 dark:border-gray-600"
            style={{
              background: ROLE_BG[role],
              border: `1px solid ${ROLE_COLORS[role]}`,
              borderRadius: 6,
              padding: "10px 14px",
            }}
          >
            <div
              className="dark:text-blue-300"
              style={{
                fontWeight: "bold",
                fontSize: 11,
                color: ROLE_COLORS[role],
                marginBottom: 4,
              }}
            >
              {ROLE_LABELS[role]}
            </div>
            <div
              className="dark:text-gray-300"
              style={{ fontSize: 10, color: "#555", lineHeight: 1.5 }}
            >
              {ROLE_DESCRIPTIONS[role]}
            </div>
          </div>
        ))}
      </div>

      {/* Users table */}
      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: 8,
          overflowX: "auto",
          marginBottom: 16,
        }}
      >
        <table
          style={{ width: "100%", borderCollapse: "collapse", minWidth: 400 }}
        >
          <thead>
            <tr style={{ background: "#2c3e50", color: "#fff" }}>
              <th
                style={{
                  padding: "8px 12px",
                  textAlign: "left",
                  fontSize: 10,
                  fontFamily: "Verdana, sans-serif",
                }}
              >
                Identifiant
              </th>
              <th
                style={{
                  padding: "8px 12px",
                  textAlign: "left",
                  fontSize: 10,
                  fontFamily: "Verdana, sans-serif",
                }}
              >
                Rôle
              </th>
              <th
                style={{
                  padding: "8px 12px",
                  textAlign: "left",
                  fontSize: 10,
                  fontFamily: "Verdana, sans-serif",
                }}
              >
                Créé le
              </th>
              <th
                style={{
                  padding: "8px 12px",
                  textAlign: "center",
                  fontSize: 10,
                  fontFamily: "Verdana, sans-serif",
                }}
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((user, idx) => (
              <>
                <tr
                  key={user.username}
                  className={
                    idx % 2 === 0
                      ? "bg-background dark:bg-gray-900"
                      : "bg-muted/30 dark:bg-gray-800"
                  }
                  style={{
                    borderBottom: "1px solid #eee",
                  }}
                  data-ocid={`users.user.item.${idx + 1}`}
                >
                  <td
                    style={{
                      padding: "8px 12px",
                      fontSize: 11,
                      fontFamily: "Verdana, sans-serif",
                      fontWeight:
                        user.username === session?.username ? "bold" : "normal",
                    }}
                  >
                    {user.username}
                    {user.username === session?.username && (
                      <span
                        style={{ marginLeft: 6, fontSize: 9, color: "#666" }}
                      >
                        (vous)
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "8px 12px" }}>
                    <span
                      className="dark:bg-gray-700 dark:border-gray-500 dark:text-gray-200"
                      style={{
                        display: "inline-block",
                        background: ROLE_BG[user.role],
                        color: ROLE_COLORS[user.role],
                        border: `1px solid ${ROLE_COLORS[user.role]}`,
                        borderRadius: 4,
                        padding: "2px 8px",
                        fontSize: 9,
                        fontWeight: "bold",
                        fontFamily: "Verdana, sans-serif",
                      }}
                    >
                      {ROLE_LABELS[user.role]}
                    </span>
                  </td>
                  <td
                    style={{
                      padding: "8px 12px",
                      fontSize: 10,
                      color: "#666",
                      fontFamily: "Verdana, sans-serif",
                    }}
                  >
                    {new Date(user.createdAt).toLocaleDateString("fr-FR")}
                  </td>
                  <td style={{ padding: "8px 12px", textAlign: "center" }}>
                    <div
                      style={{
                        display: "flex",
                        gap: 6,
                        justifyContent: "center",
                      }}
                    >
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => startEdit(user.username)}
                        data-ocid={`users.edit_button.${idx + 1}`}
                        style={{
                          height: 28,
                          fontSize: 10,
                          fontFamily: "Verdana, sans-serif",
                          padding: "0 10px",
                        }}
                      >
                        <Edit size={12} className="mr-1" /> Modifier
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setDeleteUsername(user.username)}
                        disabled={user.username === session?.username}
                        data-ocid={`users.delete_button.${idx + 1}`}
                        style={{
                          height: 28,
                          fontSize: 10,
                          fontFamily: "Verdana, sans-serif",
                          padding: "0 10px",
                        }}
                      >
                        <Trash2 size={12} className="mr-1" /> Supprimer
                      </Button>
                    </div>
                  </td>
                </tr>
                {editingUsername === user.username && (
                  <tr
                    key={`edit-${user.username}`}
                    style={{ background: "#eaf4fb" }}
                  >
                    <td colSpan={4} style={{ padding: "12px 16px" }}>
                      <div
                        style={{
                          display: "flex",
                          gap: 12,
                          alignItems: "flex-end",
                          flexWrap: "wrap",
                        }}
                      >
                        <div>
                          <Label
                            style={{
                              fontSize: 10,
                              fontWeight: "bold",
                              fontFamily: "Verdana, sans-serif",
                            }}
                          >
                            Nouveau mot de passe (laisser vide pour ne pas
                            changer)
                          </Label>
                          <div
                            style={{
                              position: "relative",
                              display: "inline-flex",
                              alignItems: "center",
                            }}
                          >
                            <Input
                              type={showEditPassword ? "text" : "password"}
                              value={editPassword}
                              onChange={(e) => setEditPassword(e.target.value)}
                              placeholder="Nouveau mot de passe"
                              data-ocid="users.edit_password.input"
                              style={{
                                width: 220,
                                height: 32,
                                fontSize: 11,
                                marginTop: 4,
                                fontFamily: "Verdana, sans-serif",
                                paddingRight: 32,
                              }}
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setShowEditPassword(!showEditPassword)
                              }
                              style={{
                                position: "absolute",
                                right: 6,
                                top: "50%",
                                transform: "translateY(-50%)",
                                marginTop: 2,
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                color: "#666",
                              }}
                              tabIndex={-1}
                            >
                              {showEditPassword ? (
                                <EyeOff size={14} />
                              ) : (
                                <Eye size={14} />
                              )}
                            </button>
                          </div>
                        </div>
                        <div>
                          <Label
                            style={{
                              fontSize: 10,
                              fontWeight: "bold",
                              fontFamily: "Verdana, sans-serif",
                            }}
                          >
                            Rôle
                          </Label>
                          <select
                            value={editRole}
                            onChange={(e) =>
                              setEditRole(e.target.value as UserRole)
                            }
                            data-ocid="users.edit_role.select"
                            style={{
                              display: "block",
                              marginTop: 4,
                              height: 32,
                              fontSize: 11,
                              border: "1px solid #ccc",
                              borderRadius: 4,
                              padding: "0 8px",
                              fontFamily: "Verdana, sans-serif",
                            }}
                          >
                            <option value="admin">Administrateur</option>
                            <option value="advanced">Utilisateur Avancé</option>
                            <option value="reader">Utilisateur Lecteur</option>
                          </select>
                        </div>
                        {editError && (
                          <div
                            style={{
                              fontSize: 10,
                              color: "#c0392b",
                              fontFamily: "Verdana, sans-serif",
                            }}
                          >
                            {editError}
                          </div>
                        )}
                        <div style={{ display: "flex", gap: 6 }}>
                          <Button
                            size="sm"
                            onClick={handleEditSave}
                            disabled={editLoading}
                            data-ocid="users.edit_save.button"
                            style={{
                              height: 32,
                              fontSize: 10,
                              background: "#1a5276",
                              color: "#fff",
                              fontFamily: "Verdana, sans-serif",
                            }}
                          >
                            <Save size={12} className="mr-1" /> Enregistrer
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditingUsername(null)}
                            data-ocid="users.edit_cancel.button"
                            style={{
                              height: 32,
                              fontSize: 10,
                              fontFamily: "Verdana, sans-serif",
                            }}
                          >
                            <X size={12} className="mr-1" /> Annuler
                          </Button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
            {users.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  style={{
                    textAlign: "center",
                    padding: 20,
                    color: "#999",
                    fontSize: 11,
                    fontFamily: "Verdana, sans-serif",
                  }}
                >
                  Aucun utilisateur
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add user button / form */}
      {!showAddForm ? (
        <Button
          onClick={() => setShowAddForm(true)}
          data-ocid="users.add_user.button"
          style={{
            background: "#1a5276",
            color: "#fff",
            fontSize: 11,
            fontFamily: "Verdana, sans-serif",
            height: 36,
          }}
        >
          <Plus size={14} className="mr-1" /> Ajouter un utilisateur
        </Button>
      ) : (
        <form
          onSubmit={handleAdd}
          style={{
            background: "#f0f7ff",
            border: "1px solid #b3d1f0",
            borderRadius: 8,
            padding: "16px 20px",
          }}
        >
          <div
            style={{
              fontWeight: "bold",
              fontSize: 12,
              color: "#1a3a5c",
              marginBottom: 12,
              fontFamily: "Verdana, sans-serif",
            }}
          >
            Nouvel utilisateur
          </div>
          <div
            style={{
              display: "flex",
              gap: 12,
              flexWrap: "wrap",
              alignItems: "flex-end",
            }}
          >
            <div>
              <Label
                style={{
                  fontSize: 10,
                  fontWeight: "bold",
                  fontFamily: "Verdana, sans-serif",
                }}
              >
                Identifiant *
              </Label>
              <Input
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="Identifiant"
                data-ocid="users.add_username.input"
                style={{
                  width: 180,
                  height: 32,
                  fontSize: 11,
                  marginTop: 4,
                  fontFamily: "Verdana, sans-serif",
                }}
              />
            </div>
            <div>
              <Label
                style={{
                  fontSize: 10,
                  fontWeight: "bold",
                  fontFamily: "Verdana, sans-serif",
                }}
              >
                Mot de passe *
              </Label>
              <div
                style={{
                  position: "relative",
                  display: "inline-flex",
                  alignItems: "center",
                }}
              >
                <Input
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Mot de passe"
                  data-ocid="users.add_password.input"
                  style={{
                    width: 180,
                    height: 32,
                    fontSize: 11,
                    marginTop: 4,
                    fontFamily: "Verdana, sans-serif",
                    paddingRight: 32,
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  style={{
                    position: "absolute",
                    right: 6,
                    top: "50%",
                    transform: "translateY(-50%)",
                    marginTop: 2,
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#666",
                  }}
                  tabIndex={-1}
                >
                  {showNewPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>
            <div>
              <Label
                style={{
                  fontSize: 10,
                  fontWeight: "bold",
                  fontFamily: "Verdana, sans-serif",
                }}
              >
                Rôle
              </Label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as UserRole)}
                data-ocid="users.add_role.select"
                style={{
                  display: "block",
                  marginTop: 4,
                  height: 32,
                  fontSize: 11,
                  border: "1px solid #ccc",
                  borderRadius: 4,
                  padding: "0 8px",
                  fontFamily: "Verdana, sans-serif",
                }}
              >
                <option value="admin">Administrateur</option>
                <option value="advanced">Utilisateur Avancé</option>
                <option value="reader">Utilisateur Lecteur</option>
              </select>
            </div>
            {addError && (
              <div
                style={{
                  fontSize: 10,
                  color: "#c0392b",
                  fontFamily: "Verdana, sans-serif",
                  width: "100%",
                }}
              >
                {addError}
              </div>
            )}
            <div style={{ display: "flex", gap: 8 }}>
              <Button
                type="submit"
                disabled={addLoading}
                data-ocid="users.add_submit.button"
                style={{
                  height: 32,
                  fontSize: 10,
                  background: "#1a5276",
                  color: "#fff",
                  fontFamily: "Verdana, sans-serif",
                }}
              >
                <UserCheck size={12} className="mr-1" /> Ajouter
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowAddForm(false);
                  setAddError("");
                }}
                data-ocid="users.add_cancel.button"
                style={{
                  height: 32,
                  fontSize: 10,
                  fontFamily: "Verdana, sans-serif",
                }}
              >
                <UserX size={12} className="mr-1" /> Annuler
              </Button>
            </div>
          </div>
        </form>
      )}

      {/* ═══════════════════════════════════════════════════════ */}
      {/* Configuration d'accès */}
      {/* ═══════════════════════════════════════════════════════ */}
      <div
        className="dark:bg-gray-800 dark:border-gray-600"
        style={{
          marginTop: 24,
          padding: "16px 20px",
          background: "#fff8e1",
          border: "1px solid #f9a825",
          borderRadius: 8,
        }}
      >
        <div
          className="dark:text-yellow-400"
          style={{
            fontWeight: "bold",
            fontSize: 12,
            color: "#7b4f00",
            marginBottom: 10,
            fontFamily: "Verdana, sans-serif",
          }}
        >
          Configuration d'accès
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="bypass-admin-check"
            checked={bypass}
            onCheckedChange={(checked) => {
              const enabled = !!checked;
              setBypass(enabled);
              toast.success(
                enabled
                  ? "Ouverture automatique activée : l'application s'ouvrira sans demander de connexion"
                  : "Ouverture automatique désactivée : le login sera demandé à la prochaine ouverture",
              );
            }}
            data-ocid="users.bypass.checkbox"
            style={{ width: 16, height: 16 }}
          />
          <label
            htmlFor="bypass-admin-check"
            style={{
              fontSize: 11,
              color: "#555",
              cursor: "pointer",
              fontFamily: "Verdana, sans-serif",
              userSelect: "none",
            }}
          >
            Accéder sans mot de passe (l'application s'ouvrira automatiquement
            sans demander de connexion)
          </label>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* Thème de l'application */}
      {/* ═══════════════════════════════════════════════════════ */}
      <div
        className="dark:bg-gray-800 dark:border-gray-600"
        style={{
          marginTop: 16,
          padding: "16px 20px",
          background: "#e8eaf6",
          border: "1px solid #5c6bc0",
          borderRadius: 8,
        }}
      >
        <div
          className="dark:text-blue-300"
          style={{
            fontWeight: "bold",
            fontSize: 12,
            color: "#283593",
            marginBottom: 12,
            fontFamily: "Verdana, sans-serif",
          }}
        >
          Apparence de l'application
        </div>
        <div
          className="dark:text-gray-400"
          style={{
            fontSize: 10,
            color: "#555",
            marginBottom: 14,
            fontFamily: "Verdana, sans-serif",
            lineHeight: 1.6,
          }}
        >
          Choisissez entre le mode clair et le mode sombre pour toute
          l'application.
        </div>
        <div
          style={{
            display: "flex",
            gap: 16,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              cursor: "pointer",
              fontFamily: "Verdana, sans-serif",
              fontSize: 11,
              color: "#333",
            }}
            className="dark:text-gray-200"
          >
            <input
              type="checkbox"
              checked={theme === "light" || theme === undefined}
              onChange={() => setTheme("light")}
              data-ocid="users.theme_light.checkbox"
              style={{ width: 16, height: 16, cursor: "pointer" }}
            />
            ☀️ Mode Clair
          </label>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              cursor: "pointer",
              fontFamily: "Verdana, sans-serif",
              fontSize: 11,
              color: "#333",
            }}
            className="dark:text-gray-200"
          >
            <input
              type="checkbox"
              checked={theme === "dark"}
              onChange={() => setTheme("dark")}
              data-ocid="users.theme_dark.checkbox"
              style={{ width: 16, height: 16, cursor: "pointer" }}
            />
            🌙 Mode Sombre
          </label>
        </div>
        {/* Couleur de police */}
        <div
          style={{
            marginTop: 14,
            borderTop: "1px solid #c5cae9",
            paddingTop: 12,
          }}
        >
          <div
            style={{
              fontWeight: "bold",
              fontSize: 11,
              color: "#333",
              marginBottom: 8,
              fontFamily: "Verdana, sans-serif",
            }}
          >
            Couleur de la police d'écriture
          </div>
          <div
            style={{
              fontSize: 10,
              color: "#555",
              marginBottom: 10,
              fontFamily: "Verdana, sans-serif",
              lineHeight: 1.5,
            }}
          >
            Choisissez une couleur visible sur tous les fonds (utile en mode
            sombre). &quot;Défaut&quot; utilise la couleur d'origine.
          </div>
          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              alignItems: "flex-start",
            }}
          >
            {FONT_COLOR_OPTIONS.map((option) => (
              <div
                key={option.value}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <button
                  type="button"
                  data-ocid={`users.font_color.${option.label.toLowerCase().replace(" ", "_")}.button`}
                  onClick={() => applyFontColor(option.value)}
                  title={option.label}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    background: option.bg,
                    border:
                      selectedFontColor === option.value
                        ? "3px solid #1a3a8a"
                        : "2px solid #aaa",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                    fontWeight: "bold",
                    color: option.isDefault ? "#fff" : "transparent",
                    boxShadow:
                      selectedFontColor === option.value
                        ? "0 0 0 2px #93c5fd"
                        : "none",
                    transition: "box-shadow 0.15s, border 0.15s",
                  }}
                >
                  {option.isDefault ? "X" : ""}
                </button>
                <span
                  style={{
                    fontSize: 9,
                    fontFamily: "Verdana, sans-serif",
                    color: "#555",
                    textAlign: "center",
                    maxWidth: 40,
                    lineHeight: 1.2,
                  }}
                >
                  {option.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* Sauvegarde et restauration des données */}
      {/* ═══════════════════════════════════════════════════════ */}
      <div
        className="dark:bg-gray-800 dark:border-gray-600"
        style={{
          marginTop: 16,
          padding: "16px 20px",
          background: "#e8f5e9",
          border: "1px solid #43a047",
          borderRadius: 8,
        }}
      >
        <div
          className="dark:text-green-400"
          style={{
            fontWeight: "bold",
            fontSize: 12,
            color: "#1b5e20",
            marginBottom: 12,
            fontFamily: "Verdana, sans-serif",
          }}
        >
          Sauvegarde et restauration des données
        </div>
        <div
          style={{
            fontSize: 10,
            color: "#555",
            marginBottom: 14,
            fontFamily: "Verdana, sans-serif",
            lineHeight: 1.6,
          }}
        >
          Exportez toutes vos données dans un fichier JSON pour les sauvegarder
          ou les transférer. Importez un fichier JSON pour restaurer vos
          données. Le bouton Réinitialiser efface définitivement tous les
          rendez-vous et clients.
        </div>
        <div
          style={{
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <Button
            onClick={handleExport}
            data-ocid="users.export_data.button"
            style={{
              height: 36,
              fontSize: 11,
              background: "#2e7d32",
              color: "#fff",
              fontFamily: "Verdana, sans-serif",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Download size={14} /> Exporter JSON (avec photos)
          </Button>
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={importLoading}
            data-ocid="users.import_data.button"
            style={{
              height: 36,
              fontSize: 11,
              background: "#1565c0",
              color: "#fff",
              fontFamily: "Verdana, sans-serif",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Upload size={14} />{" "}
            {importLoading ? "Importation..." : "Importer JSON (avec photos)"}
          </Button>
          <Button
            onClick={() => {
              setExportedBeforeReset(false);
              setShowResetDialog(true);
            }}
            data-ocid="users.reset_data.button"
            style={{
              height: 36,
              fontSize: 11,
              background: "#b71c1c",
              color: "#fff",
              fontFamily: "Verdana, sans-serif",
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontWeight: "bold",
            }}
          >
            <Trash size={14} /> Réinitialiser
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImportFile}
            data-ocid="users.import_file.input"
            style={{ display: "none" }}
          />
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════ */}
      {/* Synchronisation Google Apps Script */}
      {/* ═══════════════════════════════════════════════════════ */}
      {isAdmin && <GoogleSyncSection />}

      {/* Delete user dialog */}
      <AlertDialog
        open={!!deleteUsername}
        onOpenChange={(open) => !open && setDeleteUsername(null)}
      >
        <AlertDialogContent data-ocid="users.delete.dialog">
          <AlertDialogHeader>
            <AlertDialogTitle
              style={{ fontFamily: "Verdana, sans-serif", fontSize: 14 }}
            >
              Supprimer l'utilisateur
            </AlertDialogTitle>
            <AlertDialogDescription
              style={{ fontFamily: "Verdana, sans-serif", fontSize: 12 }}
            >
              Voulez-vous vraiment supprimer l'utilisateur{" "}
              <strong>{deleteUsername}</strong> ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              data-ocid="users.delete.cancel_button"
              style={{ fontFamily: "Verdana, sans-serif", fontSize: 11 }}
            >
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              data-ocid="users.delete.confirm_button"
              style={{
                background: "#c0392b",
                fontFamily: "Verdana, sans-serif",
                fontSize: 11,
              }}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset data dialog */}
      <AlertDialog
        open={showResetDialog}
        onOpenChange={(open) => {
          if (!open) {
            setShowResetDialog(false);
            setExportedBeforeReset(false);
          }
        }}
      >
        <AlertDialogContent
          data-ocid="users.reset.dialog"
          style={{ maxWidth: 520 }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle
              style={{
                fontFamily: "Verdana, sans-serif",
                fontSize: 14,
                color: "#922b21",
              }}
            >
              ⚠️ Réinitialiser / Effacer toutes les données
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div style={{ fontFamily: "Verdana, sans-serif", fontSize: 11 }}>
                <p style={{ marginBottom: 12 }}>
                  Cette action effacera <strong>définitivement</strong> tous les
                  rendez-vous et tous les clients. Les comptes utilisateurs ne
                  seront pas supprimés.
                </p>
                <p
                  style={{
                    marginBottom: 14,
                    color: "#7d6608",
                    background: "#fef9e7",
                    border: "1px solid #f9e79f",
                    borderRadius: 4,
                    padding: "8px 10px",
                    fontSize: 10,
                  }}
                >
                  Il est fortement recommandé de télécharger une sauvegarde
                  avant de continuer.
                </p>
                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    marginBottom: 8,
                    flexWrap: "wrap",
                  }}
                >
                  <Button
                    size="sm"
                    onClick={handleExportBeforeReset}
                    data-ocid="users.reset_export_json.button"
                    style={{
                      height: 32,
                      fontSize: 10,
                      background: "#2e7d32",
                      color: "#fff",
                      fontFamily: "Verdana, sans-serif",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Download size={13} /> Exporter JSON (sauvegarde)
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleExportCsvBeforeReset}
                    data-ocid="users.reset_export_csv.button"
                    style={{
                      height: 32,
                      fontSize: 10,
                      background: "#1565c0",
                      color: "#fff",
                      fontFamily: "Verdana, sans-serif",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Download size={13} /> Exporter CSV (sauvegarde)
                  </Button>
                </div>
                {exportedBeforeReset && (
                  <p
                    style={{
                      fontSize: 10,
                      color: "#1e8449",
                      fontFamily: "Verdana, sans-serif",
                    }}
                  >
                    ✓ Sauvegarde téléchargée. Vous pouvez maintenant effacer les
                    données.
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              data-ocid="users.reset.cancel_button"
              style={{ fontFamily: "Verdana, sans-serif", fontSize: 11 }}
              onClick={() => {
                setShowResetDialog(false);
                setExportedBeforeReset(false);
              }}
            >
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResetConfirm}
              disabled={resetLoading}
              data-ocid="users.reset.confirm_button"
              style={{
                background: "#922b21",
                fontFamily: "Verdana, sans-serif",
                fontSize: 11,
              }}
            >
              {resetLoading ? "Effacement..." : "Effacer définitivement"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
