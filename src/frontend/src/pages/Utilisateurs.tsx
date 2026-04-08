import { useRef, useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "../hooks/useTranslation";
import {
  APPS_SCRIPT_CODE,
  loadFromGoogle,
  saveToGoogle,
} from "../services/googleSync";
import { useStore } from "../store/useStore";
import type { User } from "../types";

function generateId() {
  return `user-${Date.now()}`;
}

const FONT_COLORS = [
  { label: "Orange", value: "rgb(226,107,10)" },
  { label: "Blanc", value: "rgb(255,255,255)" },
  { label: "Jaune", value: "rgb(255,220,0)" },
  { label: "Cyan", value: "rgb(0,200,220)" },
  { label: "Vert", value: "rgb(80,200,120)" },
  { label: "Bleu clair", value: "rgb(100,180,255)" },
  { label: "Rose", value: "rgb(255,150,180)" },
];

export function Utilisateurs() {
  const { t } = useTranslation();
  const {
    users,
    settings,
    currentUser,
    addUser,
    updateUser,
    deleteUser,
    updateSettings,
    exportData,
    importData,
    resetData,
  } = useStore();

  const [showAddUser, setShowAddUser] = useState(false);
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [newLogin, setNewLogin] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [newRole, setNewRole] = useState<User["role"]>("lecteur");
  const [newSansMdp, setNewSansMdp] = useState(false);
  const [googleUrl, setGoogleUrl] = useState(settings.googleDriveUrl);
  const [googlePwd, setGooglePwd] = useState(settings.googleDrivePassword);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = currentUser?.role === "admin";

  function handleAddUser() {
    if (!newLogin) return;
    if (editUserId) {
      updateUser(editUserId, {
        login: newLogin,
        password: newPwd,
        role: newRole,
        sansMotDePasse: newSansMdp,
      });
      toast.success(t("common.succes"));
    } else {
      addUser({
        id: generateId(),
        login: newLogin,
        password: newPwd,
        role: newRole,
        sansMotDePasse: newSansMdp,
      });
      toast.success(t("common.succes"));
    }
    setShowAddUser(false);
    setEditUserId(null);
    setNewLogin("");
    setNewPwd("");
    setNewRole("lecteur");
    setNewSansMdp(false);
  }

  function handleEdit(u: User) {
    setEditUserId(u.id);
    setNewLogin(u.login);
    setNewPwd(u.password);
    setNewRole(u.role);
    setNewSansMdp(u.sansMotDePasse);
    setShowAddUser(true);
  }

  function handleExport() {
    const data = exportData();
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `revenueplanner-backup-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t("users.msg_exporte"));
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const ok = importData(reader.result as string);
      if (ok) toast.success(t("users.msg_importe"));
      else toast.error(t("common.erreur"));
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  function handleReset() {
    if (!window.confirm(t("users.confirmer_reinitialiser"))) return;
    handleExport();
    resetData();
    toast.success(t("users.msg_reinitialise"));
  }

  async function handleGoogleSave() {
    updateSettings({
      googleDriveUrl: googleUrl,
      googleDrivePassword: googlePwd,
    });
    const data = exportData();
    const ok = await saveToGoogle(googleUrl, googlePwd, data);
    if (ok) toast.success(t("users.msg_sauvegarde_ok"));
    else toast.error(t("users.msg_sauvegarde_erreur"));
  }

  async function handleGoogleLoad() {
    updateSettings({
      googleDriveUrl: googleUrl,
      googleDrivePassword: googlePwd,
    });
    const data = await loadFromGoogle(googleUrl, googlePwd);
    if (data) {
      const ok = importData(data);
      if (ok) toast.success(t("users.msg_importe"));
      else toast.error(t("common.erreur"));
    } else {
      toast.error(t("users.msg_sauvegarde_erreur"));
    }
  }

  const sectionCls = "bg-card border border-border rounded-lg p-4 space-y-3";
  const inputCls =
    "w-full border border-input rounded px-2 py-1 text-xs bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring";
  const labelCls = "block text-xs text-muted-foreground mb-0.5";
  const thCls =
    "border border-border px-2 py-1 text-xs font-semibold text-left bg-primary/10";
  const tdCls = "border border-border px-2 py-1 text-xs";

  return (
    <div
      className="p-4 space-y-4 max-w-3xl"
      style={{ fontFamily: "Verdana, Geneva, sans-serif" }}
    >
      <h1 className="font-bold text-base text-foreground">
        {t("users.titre")}
      </h1>

      {/* Access configuration */}
      {isAdmin && (
        <div className={sectionCls}>
          <h2 className="font-bold text-sm text-foreground">
            {t("users.config_acces")}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr>
                  <th className={thCls}>{t("users.col_login")}</th>
                  <th className={thCls}>{t("users.col_role")}</th>
                  <th className={`${thCls} text-center`}>
                    {t("common.actions")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((u, i) => (
                  <tr
                    key={u.id}
                    className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}
                  >
                    <td className={tdCls}>{u.login}</td>
                    <td className={tdCls}>
                      {u.role === "admin"
                        ? t("users.role_admin")
                        : u.role === "avance"
                          ? t("users.role_avance")
                          : t("users.role_lecteur")}
                    </td>
                    <td className={`${tdCls} text-center`}>
                      <div className="flex justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleEdit(u)}
                          className="px-2 py-0.5 text-xs border border-border rounded hover:bg-muted"
                        >
                          {t("common.modifier")}
                        </button>
                        {u.id !== "admin-root" && (
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(t("common.confirmer")))
                                deleteUser(u.id);
                            }}
                            className="px-2 py-0.5 text-xs border border-destructive/30 text-destructive rounded hover:bg-destructive/10"
                          >
                            {t("common.supprimer")}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditUserId(null);
              setNewLogin("");
              setNewPwd("");
              setNewRole("lecteur");
              setNewSansMdp(false);
              setShowAddUser(true);
            }}
            className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90"
          >
            {t("users.btn_ajouter")}
          </button>

          {showAddUser && (
            <div className="border border-border rounded p-3 space-y-2 bg-muted/20">
              <div>
                <label htmlFor="user-login" className={labelCls}>
                  {t("users.col_login")}
                </label>
                <input
                  id="user-login"
                  type="text"
                  value={newLogin}
                  onChange={(e) => setNewLogin(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="user-pwd" className={labelCls}>
                  {t("login.mot_de_passe")}
                </label>
                <input
                  id="user-pwd"
                  type="password"
                  value={newPwd}
                  onChange={(e) => setNewPwd(e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="user-role" className={labelCls}>
                  {t("users.col_role")}
                </label>
                <select
                  id="user-role"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as User["role"])}
                  className={inputCls}
                >
                  <option value="admin">{t("users.role_admin")}</option>
                  <option value="avance">{t("users.role_avance")}</option>
                  <option value="lecteur">{t("users.role_lecteur")}</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="checkbox"
                  checked={newSansMdp}
                  onChange={(e) => setNewSansMdp(e.target.checked)}
                />
                <span>{t("users.acces_sans_mdp")}</span>
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleAddUser}
                  className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90"
                >
                  {t("common.enregistrer")}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddUser(false)}
                  className="px-3 py-1 text-xs border border-border rounded hover:bg-muted"
                >
                  {t("common.annuler")}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Appearance */}
      <div className={sectionCls}>
        <h2 className="font-bold text-sm text-foreground">
          {t("users.apparence")}
        </h2>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="radio"
              name="theme"
              checked={!settings.darkMode}
              onChange={() => updateSettings({ darkMode: false })}
            />
            <span>{t("users.mode_clair")}</span>
          </label>
          <label className="flex items-center gap-2 text-xs cursor-pointer">
            <input
              type="radio"
              name="theme"
              checked={settings.darkMode}
              onChange={() => updateSettings({ darkMode: true })}
            />
            <span>{t("users.mode_sombre")}</span>
          </label>
        </div>

        <div>
          <p className="text-xs text-muted-foreground mb-2">
            {t("users.couleur_police")}
          </p>
          <div className="flex gap-2 flex-wrap">
            {FONT_COLORS.map((fc) => (
              <button
                key={fc.value}
                type="button"
                title={fc.label}
                onClick={() => updateSettings({ fontColor: fc.value })}
                className={`w-7 h-7 rounded-full border-2 transition-smooth ${settings.fontColor === fc.value ? "border-foreground scale-110" : "border-transparent"}`}
                style={{ background: fc.value }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Data backup */}
      <div className={sectionCls}>
        <h2 className="font-bold text-sm text-foreground">
          {t("users.sauvegarde_restauration")}
        </h2>
        <p className="text-xs text-muted-foreground">
          {t("users.description_sauvegarde")}
        </p>
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            data-ocid="export-json-btn"
            onClick={handleExport}
            className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90"
          >
            {t("users.exporter_json")}
          </button>
          <label
            htmlFor="import-json-input"
            className="px-3 py-1 text-xs border border-border rounded hover:bg-muted cursor-pointer"
          >
            {t("users.importer_json")}
          </label>
          <input
            id="import-json-input"
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImport}
            className="hidden"
            data-ocid="import-json-input"
          />
          {isAdmin && (
            <button
              type="button"
              onClick={handleReset}
              className="px-3 py-1 text-xs border border-destructive/30 text-destructive rounded hover:bg-destructive/10"
            >
              {t("users.reinitialiser")}
            </button>
          )}
        </div>
      </div>

      {/* Google Drive sync */}
      <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 space-y-3">
        <h2 className="font-bold text-sm text-foreground">
          {t("users.sync_google")}
        </h2>
        <p className="text-xs text-muted-foreground">
          {t("users.sync_google_desc")}
        </p>

        <div className="space-y-2">
          <div>
            <label htmlFor="google-url" className={labelCls}>
              {t("users.url_apps_script")}
            </label>
            <input
              id="google-url"
              type="url"
              value={googleUrl}
              onChange={(e) => setGoogleUrl(e.target.value)}
              className={inputCls}
              placeholder="https://script.google.com/macros/s/..."
            />
          </div>
          <div>
            <label htmlFor="google-pwd" className={labelCls}>
              {t("users.mot_de_passe_secret")}
            </label>
            <input
              id="google-pwd"
              type="password"
              value={googlePwd}
              onChange={(e) => setGooglePwd(e.target.value)}
              className={inputCls}
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleGoogleSave}
              className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              {t("users.btn_sauvegarder_google")}
            </button>
            <button
              type="button"
              onClick={handleGoogleLoad}
              className="px-3 py-1 text-xs border border-blue-400 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-100 dark:hover:bg-blue-900/20"
            >
              {t("users.btn_charger_google")}
            </button>
          </div>
        </div>

        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
            {t("users.script_instructions")}
          </summary>
          <ol className="mt-2 ml-4 list-decimal space-y-1 text-muted-foreground">
            <li>{t("users.etape1")}</li>
            <li>{t("users.etape2")}</li>
            <li>{t("users.etape3")}</li>
            <li>{t("users.etape4")}</li>
          </ol>
          <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-x-auto whitespace-pre-wrap">
            {APPS_SCRIPT_CODE}
          </pre>
        </details>
      </div>
    </div>
  );
}
