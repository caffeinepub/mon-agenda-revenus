import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { DemandeEdition, type RendezVous } from "../backend";
import { useDeleteAppointment } from "../hooks/useQueries";
import { useTranslation } from "../hooks/useTranslation";

interface AppointmentDeleteDialogProps {
  open: boolean;
  onClose: () => void;
  appointment: RendezVous | null;
}

export default function AppointmentDeleteDialog({
  open,
  onClose,
  appointment,
}: AppointmentDeleteDialogProps) {
  const { t } = useTranslation();
  const [deleteMode, setDeleteMode] = useState<DemandeEdition | null>(null);
  const deleteAppointment = useDeleteAppointment();

  const handleDelete = async (mode: DemandeEdition) => {
    if (!appointment) return;

    setDeleteMode(mode);
    try {
      await deleteAppointment.mutateAsync({ id: appointment.id, mode });
      toast.success(
        mode === DemandeEdition.unique
          ? t("appointment.successDeleted")
          : t("appointment.successDeletedAll"),
      );
      onClose();
    } catch (error) {
      toast.error(t("appointment.errorDelete"));
      console.error(error);
    } finally {
      setDeleteMode(null);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onClose}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("appointment.confirmDelete")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("appointment.confirmDeleteDesc")}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-3 py-4">
          <button
            type="button"
            onClick={() => handleDelete(DemandeEdition.unique)}
            disabled={deleteAppointment.isPending}
            className="w-full text-left rounded-lg border border-border bg-card p-4 hover:bg-accent/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-center gap-3">
              {deleteMode === DemandeEdition.unique && (
                <Loader2 className="h-5 w-5 animate-spin" />
              )}
              <div>
                <div className="font-semibold">
                  {t("appointment.deleteThis")}
                </div>
                <div className="text-xs text-muted-foreground">
                  Seul ce rendez-vous sera supprimé
                </div>
              </div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => handleDelete(DemandeEdition.futursDuClient)}
            disabled={deleteAppointment.isPending}
            className="w-full text-left rounded-lg border border-border bg-card p-4 hover:bg-accent/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <div className="flex items-center gap-3">
              {deleteMode === DemandeEdition.futursDuClient && (
                <Loader2 className="h-5 w-5 animate-spin" />
              )}
              <div>
                <div className="font-semibold">
                  {t("appointment.deleteAllFuture")}
                </div>
                <div className="text-xs text-muted-foreground">
                  Tous les rendez-vous futurs de ce client seront supprimés
                </div>
              </div>
            </div>
          </button>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteAppointment.isPending}>
            {t("common.cancel")}
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
