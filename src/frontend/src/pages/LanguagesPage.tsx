import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Download, Globe, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  type TranslationDict,
  deleteCustomLanguage,
  getActiveLanguageCode,
  getAllLanguages,
  saveCustomLanguage,
  setActiveLanguage,
  useTranslation,
} from "../hooks/useTranslation";

export default function LanguagesPage() {
  const { t } = useTranslation();
  const allLangs = getAllLanguages();
  const activeLangCode = getActiveLanguageCode();

  // Export state
  const [exportLang, setExportLang] = useState<string>(activeLangCode);

  // Import state
  const [importCode, setImportCode] = useState("");
  const [importName, setImportName] = useState("");
  const [importFlag, setImportFlag] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    const lang = allLangs.find((l) => l.code === exportLang);
    if (!lang) return;
    const json = JSON.stringify(lang.dict, null, 2);
    const blob = new Blob([json], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lang-${lang.code}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    if (!importCode.trim()) {
      toast.error(t("languages.errorCode"));
      return;
    }
    if (!importName.trim()) {
      toast.error(t("languages.errorName"));
      return;
    }
    if (!importFile) {
      toast.error(t("languages.errorFile"));
      return;
    }

    try {
      const text = await importFile.text();
      const dict: TranslationDict = JSON.parse(text);
      saveCustomLanguage(
        importCode.trim().toLowerCase(),
        importName.trim(),
        importFlag.trim() || "🌐",
        dict,
      );
      toast.success(t("languages.successImport"));
      setImportCode("");
      setImportName("");
      setImportFlag("");
      setImportFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch {
      toast.error(t("languages.errorFile"));
    }
  };

  const handleDelete = (code: string) => {
    deleteCustomLanguage(code);
    toast.success(t("languages.successDelete"));
  };

  const handleActivate = (code: string) => {
    setActiveLanguage(code);
  };

  const handleDownloadLang = (code: string) => {
    const lang = allLangs.find((l) => l.code === code);
    if (!lang) return;
    const json = JSON.stringify(lang.dict, null, 2);
    const blob = new Blob([json], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lang-${lang.code}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex items-center gap-3 mb-8">
          <Globe className="h-8 w-8 text-primary" />
          <h1 className="frame-title text-3xl">{t("languages.title")}</h1>
        </div>

        {/* ── Section A: Language table ── */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="frame-title">
              {t("languages.languages")}
            </CardTitle>
            <CardDescription className="table-data">
              {t("languages.currentLanguage")} :{" "}
              <strong>
                {allLangs.find((l) => l.code === activeLangCode)?.name ??
                  activeLangCode}
              </strong>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="table-header" style={{ width: 40 }}>
                    Flag
                  </TableHead>
                  <TableHead className="table-header" style={{ width: 60 }}>
                    Code
                  </TableHead>
                  <TableHead className="table-header">Nom</TableHead>
                  <TableHead className="table-header">Type</TableHead>
                  <TableHead className="table-header text-right">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {getAllLanguages().map((lang) => (
                  <TableRow
                    key={lang.code}
                    className={
                      lang.code === activeLangCode ? "bg-primary/5" : ""
                    }
                  >
                    <TableCell className="table-data text-xl">
                      {lang.flag}
                    </TableCell>
                    <TableCell className="table-data font-mono uppercase">
                      {lang.code}
                    </TableCell>
                    <TableCell className="table-data">
                      {lang.name}
                      {lang.code === activeLangCode && (
                        <Badge className="ml-2" variant="default">
                          {t("languages.currentLanguage")}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="table-data">
                      <Badge variant={lang.builtIn ? "secondary" : "outline"}>
                        {lang.builtIn
                          ? t("languages.builtIn")
                          : t("languages.custom")}
                      </Badge>
                    </TableCell>
                    <TableCell className="table-data">
                      <div className="flex gap-2 justify-end">
                        {lang.code !== activeLangCode && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="table-data"
                            onClick={() => handleActivate(lang.code)}
                          >
                            Activer
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          className="table-data"
                          onClick={() => handleDownloadLang(lang.code)}
                          title={t("languages.exportButton")}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        {!lang.builtIn && (
                          <Button
                            variant="destructive"
                            size="sm"
                            className="table-data"
                            onClick={() => handleDelete(lang.code)}
                            title={t("languages.deleteButton")}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* ── Section B: Export ── */}
          <Card>
            <CardHeader>
              <CardTitle className="frame-title">
                {t("languages.exportTitle")}
              </CardTitle>
              <CardDescription className="table-data">
                {t("languages.exportDesc")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="table-data">
                  {t("languages.selectLang")}
                </Label>
                <Select value={exportLang} onValueChange={setExportLang}>
                  <SelectTrigger
                    className="table-data"
                    data-ocid="languages.export.select"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {allLangs.map((lang) => (
                      <SelectItem key={lang.code} value={lang.code}>
                        {lang.flag} {lang.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleExport}
                className="w-full gap-2"
                data-ocid="languages.export.button"
              >
                <Download className="h-4 w-4" />
                {t("languages.exportButton")}
              </Button>
            </CardContent>
          </Card>

          {/* ── Section C: Import ── */}
          <Card>
            <CardHeader>
              <CardTitle className="frame-title">
                {t("languages.importTitle")}
              </CardTitle>
              <CardDescription className="table-data">
                {t("languages.importDesc")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="import-code" className="table-data">
                  {t("languages.langCode")}
                </Label>
                <Input
                  id="import-code"
                  value={importCode}
                  onChange={(e) => setImportCode(e.target.value)}
                  placeholder="DE"
                  className="table-data"
                  data-ocid="languages.import.code.input"
                  onKeyDown={(e) => e.key === "Enter" && handleImport()}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="import-name" className="table-data">
                  {t("languages.langName")}
                </Label>
                <Input
                  id="import-name"
                  value={importName}
                  onChange={(e) => setImportName(e.target.value)}
                  placeholder="Deutsch"
                  className="table-data"
                  data-ocid="languages.import.name.input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="import-flag" className="table-data">
                  Emoji drapeau (optionnel)
                </Label>
                <Input
                  id="import-flag"
                  value={importFlag}
                  onChange={(e) => setImportFlag(e.target.value)}
                  placeholder="🇩🇪"
                  className="table-data"
                  data-ocid="languages.import.flag.input"
                />
              </div>
              <div className="space-y-2">
                <Label className="table-data">Fichier JSON</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
                  id="lang-file-input"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="w-full gap-2 table-data"
                  onClick={() => fileInputRef.current?.click()}
                  data-ocid="languages.import.upload_button"
                >
                  <Upload className="h-4 w-4" />
                  {importFile ? importFile.name : "Choisir un fichier .json"}
                </Button>
              </div>
              <Button
                onClick={handleImport}
                className="w-full gap-2"
                data-ocid="languages.import.button"
              >
                <Globe className="h-4 w-4" />
                {t("languages.importButton")}
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
