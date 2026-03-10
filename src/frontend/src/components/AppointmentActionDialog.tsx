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
import { DemandeEdition, type RendezVous } from "../backend";
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
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [editMode, setEditMode] = useState<DemandeEdition | null>(null);

  const handleEditChoice = (mode: DemandeEdition) => {
    setEditMode(mode);
    setShowEditDialog(true);
    onClose();
  };

  const handleDeleteChoice = () => {
    setShowDeleteDialog(true);
    onClose();
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
                Modifier
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
                      Uniquement ce rendez-vous
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
                      Tous les rendez-vous futurs du même client
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
                Supprimer
              </h3>
              <Button
                variant="outline"
                className="w-full justify-start gap-3 h-auto py-3 border-destructive/50 hover:bg-destructive/10"
                onClick={handleDeleteChoice}
                data-ocid="appointment.action.delete.button"
              >
                <Trash2 className="h-5 w-5 text-destructive" />
                <div className="text-left">
                  <div className="font-semibold text-destructive">
                    Supprimer le rendez-vous
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Choisir entre suppression unique ou en lot (inclut le
                    rendez-vous actuel/aujourd'hui)
                  </div>
                </div>
              </Button>
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
