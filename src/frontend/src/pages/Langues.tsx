import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  addCustomLanguage,
  getAppLanguage,
  getBuiltInLangData,
  getLanguageMeta,
  removeCustomLanguage,
  setAppLanguage,
  useTranslation,
} from "../hooks/useTranslation";

export function Langues() {
  const { t, lang } = useTranslation();
  const langMeta = getLanguageMeta();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importFlag, setImportFlag] = useState("");
  const [importCode, setImportCode] = useState("");
  const [importName, setImportName] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);

  const builtInCodes = ["fr", "en", "es", "ru"];

  const allCodes = Object.keys(langMeta);

  function handleActivate(code: string) {
    setAppLanguage(code);
    toast.success(t("languages.msg_active"));
  }

  function handleExport(code: string) {
    let data: object | null = null;
    if (builtInCodes.includes(code)) {
      data = getBuiltInLangData(code);
    } else {
      const custom = JSON.parse(
        localStorage.getItem("revenueplanner_custom_langs") ?? "{}",
      ) as Record<string, object>;
      data = custom[code] ?? null;
    }
    if (!data) {
      toast.error(t("common.erreur"));
      return;
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lang-${code}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleDelete(code: string) {
    if (builtInCodes.includes(code)) {
      toast.error(t("common.erreur"));
      return;
    }
    if (!window.confirm(t("common.confirmer"))) return;
    removeCustomLanguage(code);
    if (lang === code) setAppLanguage("fr");
    toast.success(t("languages.msg_supprime"));
  }

  function handleImport() {
    if (!importFile || !importCode || !importName) {
      toast.error(t("common.erreur"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const dict = JSON.parse(reader.result as string);
        addCustomLanguage(
          importCode.toLowerCase(),
          importName,
          importFlag,
          dict,
        );
        toast.success(t("languages.msg_importe"));
        setImportCode("");
        setImportName("");
        setImportFlag("");
        setImportFile(null);
        if (fileRef.current) fileRef.current.value = "";
      } catch {
        toast.error(t("common.erreur"));
      }
    };
    reader.readAsText(importFile);
  }

  const thCls =
    "border border-border px-2 py-1 text-xs font-semibold text-left bg-primary/10";
  const tdCls = "border border-border px-2 py-1 text-xs";
  const inputCls =
    "border border-input rounded px-2 py-1 text-xs bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring";
  const labelCls = "block text-xs text-muted-foreground mb-0.5";

  return (
    <div
      className="p-4 space-y-4 max-w-2xl"
      style={{ fontFamily: "Verdana, Geneva, sans-serif" }}
    >
      <h1 className="font-bold text-base text-foreground">
        {t("languages.titre")}
      </h1>

      {/* Language table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className={thCls}>{t("languages.flag")}</th>
                <th className={thCls}>{t("languages.code")}</th>
                <th className={thCls}>{t("languages.nom")}</th>
                <th className={thCls}>{t("languages.type")}</th>
                <th className={`${thCls} text-center`}>
                  {t("languages.actions")}
                </th>
              </tr>
            </thead>
            <tbody>
              {allCodes.map((code, i) => {
                const meta = langMeta[code];
                const isBuiltIn = builtInCodes.includes(code);
                const isActive = getAppLanguage() === code;
                return (
                  <tr
                    key={code}
                    className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}
                  >
                    <td className={tdCls}>{meta?.flag ?? ""}</td>
                    <td className={tdCls}>{code.toUpperCase()}</td>
                    <td className={tdCls}>{meta?.name ?? code}</td>
                    <td className={tdCls}>
                      {isBuiltIn
                        ? t("languages.integre")
                        : t("languages.importe")}
                    </td>
                    <td className={`${tdCls} text-center`}>
                      <div className="flex justify-center gap-1 flex-wrap">
                        {isActive ? (
                          <span className="px-2 py-0.5 text-xs bg-primary/20 text-primary rounded">
                            {t("languages.langue_active")}
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleActivate(code)}
                            className="px-2 py-0.5 text-xs border border-border rounded hover:bg-muted"
                          >
                            {t("languages.activer")}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleExport(code)}
                          className="px-2 py-0.5 text-xs border border-border rounded hover:bg-muted"
                        >
                          {t("languages.exporter")}
                        </button>
                        {!isBuiltIn && (
                          <button
                            type="button"
                            onClick={() => handleDelete(code)}
                            className="px-2 py-0.5 text-xs border border-destructive/30 text-destructive rounded hover:bg-destructive/10"
                          >
                            {t("common.supprimer")}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Import section */}
      <div className="bg-card border border-border rounded-lg p-4 space-y-3">
        <h2 className="font-bold text-sm text-foreground">
          {t("languages.importer")}
        </h2>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="lang-code" className={labelCls}>
              {t("languages.code_langue")}
            </label>
            <input
              id="lang-code"
              type="text"
              value={importCode}
              onChange={(e) => setImportCode(e.target.value)}
              className={inputCls}
              placeholder="DE"
            />
          </div>
          <div>
            <label htmlFor="lang-name" className={labelCls}>
              {t("languages.nom_langue")}
            </label>
            <input
              id="lang-name"
              type="text"
              value={importName}
              onChange={(e) => setImportName(e.target.value)}
              className={inputCls}
              placeholder="Deutsch"
            />
          </div>
          <div>
            <label htmlFor="lang-flag" className={labelCls}>
              {t("languages.emoji_drapeau")}
            </label>
            <input
              id="lang-flag"
              type="text"
              value={importFlag}
              onChange={(e) => setImportFlag(e.target.value)}
              className={inputCls}
              placeholder="🇩🇪"
            />
          </div>
          <div>
            <label htmlFor="lang-file" className={labelCls}>
              {t("languages.fichier_json")}
            </label>
            <input
              id="lang-file"
              ref={fileRef}
              type="file"
              accept=".json"
              onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
              className="border border-input rounded px-2 py-1 text-xs bg-background text-foreground w-full"
            />
          </div>
        </div>
        <button
          type="button"
          onClick={handleImport}
          data-ocid="lang-import-btn"
          className="px-3 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90"
        >
          {t("languages.btn_importer")}
        </button>
      </div>
    </div>
  );
}
