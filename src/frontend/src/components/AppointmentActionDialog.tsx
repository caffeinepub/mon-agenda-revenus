import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Edit, Trash2, User, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { DemandeEdition, type RendezVous } from "../backend";
import { useDeleteAppointment } from "../hooks/useQueries";
import { useTranslation } from "../hooks/useTranslation";
import AppointmentDeleteDialog from "./AppointmentDeleteDialog";
import AppointmentDialog from "./AppointmentDialog";

interface AppointmentActionDialogProps {
  open: boolean;
  onClose: () => void;
  onFullyDone?: () => void;
  appointment: RendezVous | null;
}

export default function AppointmentActionDialog({
  open,
  onClose,
  onFullyDone,
  appointment,
}: AppointmentActionDialogProps) {
  const { t } = useTranslation();
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editMode, setEditMode] = useState<DemandeEdition | null>(null);
  const [deletingFuture, setDeletingFuture] = useState(false);
  const deleteAppointment = useDeleteAppointment();

  const handleEditChoice = (mode: DemandeEdition) => {
    setEditMode(mode);
    setShowEditDialog(true);
    onClose();
  };

  const handleDeleteChoice = () => {
    setShowDeleteDialog(true);
    onClose();
  };

  const handleDeleteAllFuture = async () => {
    if (!appointment) return;
    setDeletingFuture(true);
    try {
      await deleteAppointment.mutateAsync({
        id: appointment.id,
        mode: DemandeEdition.futursDuClient,
      });
      toast.success(t("appointment.successDeletedAll"));
      onClose();
      onFullyDone?.();
    } catch {
      toast.error(t("appointment.errorDelete"));
    } finally {
      setDeletingFuture(false);
    }
  };

  const handleCloseEditDialog = () => {
    setShowEditDialog(false);
    setEditMode(null);
    onFullyDone?.();
  };

  const handleCloseDeleteDialog = () => {
    setShowDeleteDialog(false);
    onFullyDone?.();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Modifier ou Supprimer</DialogTitle>
            <DialogDescription>
              Choisissez l'action à effectuer sur ce rendez-vous.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-muted-foreground">
                {t("common.edit")}
              </h3>
              <div className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start gap-3 h-auto py-3"
                  onClick={() => handleEditChoice(DemandeEdition.unique)}
                  data-ocid="appointment.action.edit_single.button"
                >
                  <User className="h-5 w-5 text-blue-600" />
                  <div className="text-left">
                    <div className="font-semibold">
                      {t("appointment.editThisOnly")}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Seul ce rendez-vous sera modifié
                    </div>
                  </div>
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-3 h-auto py-3"
                  onClick={() =>
                    handleEditChoice(DemandeEdition.futursDuClient)
                  }
                  data-ocid="appointment.action.edit_future.button"
                >
                  <Users className="h-5 w-5 text-blue-600" />
                  <div className="text-left">
                    <div className="font-semibold">
                      {t("appointment.editAllFuture")}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Inclut le rendez-vous actuel (aujourd'hui) et tous les
                      rendez-vous futurs de ce client
                    </div>
                  </div>
                </Button>
              </div>
            </div>

            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold text-muted-foreground mb-2">
                {t("common.delete")}
              </h3>
              <div className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start gap-3 h-auto py-3 border-destructive/50 hover:bg-destructive/10"
                  onClick={handleDeleteChoice}
                  data-ocid="appointment.action.delete.button"
                >
                  <Trash2 className="h-5 w-5 text-destructive" />
                  <div className="text-left">
                    <div className="font-semibold text-destructive">
                      {t("appointment.deleteThis")}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Supprime uniquement ce rendez-vous
                    </div>
                  </div>
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-3 h-auto py-3 border-destructive/50 hover:bg-destructive/10"
                  onClick={handleDeleteAllFuture}
                  disabled={deletingFuture}
                  data-ocid="appointment.action.delete_future.button"
                >
                  <Trash2 className="h-5 w-5 text-destructive" />
                  <div className="text-left">
                    <div className="font-semibold text-destructive">
                      {deletingFuture
                        ? "Suppression en cours..."
                        : t("appointment.deleteAllFuture")}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Supprime ce rendez-vous et tous les futurs du même client
                      (même jour de la semaine)
                    </div>
                  </div>
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {showEditDialog && appointment && (
        <AppointmentDialog
          open={showEditDialog}
          onClose={handleCloseEditDialog}
          appointment={appointment}
          editMode={editMode || DemandeEdition.unique}
        />
      )}

      {showDeleteDialog && appointment && (
        <AppointmentDeleteDialog
          open={showDeleteDialog}
          onClose={handleCloseDeleteDialog}
          appointment={appointment}
        />
      )}
    </>
  );
}
