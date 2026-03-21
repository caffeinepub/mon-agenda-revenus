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
  Download,
  Edit,
  Eye,
  EyeOff,
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
import { useRef, useState } from "react";
import { toast } from "sonner";
import { type UserRole, useLocalAuth } from "../context/LocalAuthContext";
import { useActor } from "../hooks/useActor";
import {
  clearAllData,
  downloadExportCsv,
  getExportJson,
  restoreFromJson,
  syncToBackend,
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

  const { actor } = useActor();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importLoading, setImportLoading] = useState(false);

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
      if (actor) {
        await syncToBackend(actor);
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
            style={{
              background: ROLE_BG[role],
              border: `1px solid ${ROLE_COLORS[role]}`,
              borderRadius: 6,
              padding: "10px 14px",
            }}
          >
            <div
              style={{
                fontWeight: "bold",
                fontSize: 11,
                color: ROLE_COLORS[role],
                marginBottom: 4,
              }}
            >
              {ROLE_LABELS[role]}
            </div>
            <div style={{ fontSize: 10, color: "#555", lineHeight: 1.5 }}>
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
                  style={{
                    background: idx % 2 === 0 ? "#fff" : "#f7f9fb",
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
        style={{
          marginTop: 24,
          padding: "16px 20px",
          background: "#fff8e1",
          border: "1px solid #f9a825",
          borderRadius: 8,
        }}
      >
        <div
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
      {/* Sauvegarde et restauration des données */}
      {/* ═══════════════════════════════════════════════════════ */}
      <div
        style={{
          marginTop: 16,
          padding: "16px 20px",
          background: "#e8f5e9",
          border: "1px solid #43a047",
          borderRadius: 8,
        }}
      >
        <div
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
            <Download size={14} /> Exporter JSON
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
            {importLoading ? "Importation..." : "Importer JSON"}
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
