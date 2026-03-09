import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  ClientRecord,
  ClientReference,
  DomaineListingMensuel,
  RapportPDFData,
  RapportPDFRequest,
  RendezVous,
  StatistiquesFinancieres,
  TotauxListingMensuel,
  TypeRepetition,
  UserProfile,
} from "../backend";
import type { DemandeEdition } from "../backend";
import { useActor } from "./useActor";
import { useInternetIdentity } from "./useInternetIdentity";

// User Profile Queries
export function useGetCallerUserProfile() {
  const { actor, isFetching: actorFetching } = useActor();

  const query = useQuery<UserProfile | null>({
    queryKey: ["currentUserProfile"],
    queryFn: async () => {
      if (!actor) throw new Error("Actor not available");
      return actor.getCallerUserProfile();
    },
    enabled: !!actor && !actorFetching,
    retry: false,
  });

  return {
    ...query,
    isLoading: actorFetching || query.isLoading,
    isFetched: !!actor && query.isFetched,
  };
}

export function useSaveCallerUserProfile() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (profile: UserProfile) => {
      if (!actor) throw new Error("Actor not available");
      return actor.saveCallerUserProfile(profile);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["currentUserProfile"] });
    },
  });
}

// Client Record Queries
export function useGetAllClientRecords() {
  const { actor, isFetching } = useActor();

  return useQuery<ClientRecord[]>({
    queryKey: ["clientRecords"],
    queryFn: async () => {
      if (!actor) return [];
      return actor.getAllClientRecords();
    },
    enabled: !!actor && !isFetching,
    staleTime: 0,
  });
}

export function useGetClientRecord(id: bigint) {
  const { actor, isFetching } = useActor();

  return useQuery<ClientRecord | null>({
    queryKey: ["clientRecord", id.toString()],
    queryFn: async () => {
      if (!actor) return null;
      return actor.getClientRecord(id);
    },
    enabled: !!actor && !isFetching && !!id,
    staleTime: 0,
  });
}

export function useAddClientRecord() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      clientName: string;
      referenceClient: string;
      phoneNumber: string;
      address: string;
      service: string;
      notes: string;
      photo: Uint8Array | null;
    }) => {
      if (!actor) throw new Error("Actor not available");
      try {
        return await actor.addClientRecord(
          data.clientName,
          data.referenceClient,
          data.phoneNumber,
          data.address,
          data.service,
          data.notes,
          data.photo,
        );
      } catch (error: any) {
        // Parse and re-throw with clearer message
        const errorMessage = error.message || String(error);
        if (
          errorMessage.includes("Non autorisé") ||
          errorMessage.includes("Unauthorized")
        ) {
          throw new Error(
            "Non autorisé : Veuillez vous reconnecter et réessayer",
          );
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientRecords"] });
    },
  });
}

export function useUpdateClientRecord() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      id: bigint;
      clientName: string;
      referenceClient: string;
      phoneNumber: string;
      address: string;
      service: string;
      notes: string;
      photo: Uint8Array | null;
    }) => {
      if (!actor) throw new Error("Actor not available");
      try {
        return await actor.updateClientRecord(
          data.id,
          data.clientName,
          data.referenceClient,
          data.phoneNumber,
          data.address,
          data.service,
          data.notes,
          data.photo,
        );
      } catch (error: any) {
        const errorMessage = error.message || String(error);
        if (
          errorMessage.includes("Non autorisé") ||
          errorMessage.includes("Unauthorized")
        ) {
          throw new Error(
            "Non autorisé : Vous ne pouvez modifier que vos propres clients",
          );
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientRecords"] });
    },
  });
}

export function useDeleteClientRecord() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: bigint) => {
      if (!actor) throw new Error("Actor not available");
      try {
        return await actor.deleteClientRecord(id);
      } catch (error: any) {
        const errorMessage = error.message || String(error);
        if (
          errorMessage.includes("Non autorisé") ||
          errorMessage.includes("Unauthorized")
        ) {
          throw new Error(
            "Non autorisé : Vous ne pouvez supprimer que vos propres clients",
          );
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientRecords"] });
    },
  });
}

// Appointment Queries
export function useGetAllAppointments() {
  const { actor, isFetching } = useActor();

  return useQuery<RendezVous[]>({
    queryKey: ["appointments"],
    queryFn: async () => {
      if (!actor) return [];
      const appointments = await actor.obtenirTousLesRendezVous();
      return appointments;
    },
    enabled: !!actor && !isFetching,
    staleTime: 0,
  });
}

export function useGetAppointmentsByStatus(paid: boolean) {
  const { actor, isFetching } = useActor();

  return useQuery<RendezVous[]>({
    queryKey: ["appointments", "status", paid],
    queryFn: async () => {
      if (!actor) return [];
      return actor.obtenirRendezVousParStatut(paid);
    },
    enabled: !!actor && !isFetching,
    staleTime: 0,
  });
}

export function useGetAppointmentsByReference(referenceClient: string) {
  const { actor, isFetching } = useActor();

  return useQuery<RendezVous[]>({
    queryKey: ["appointments", "reference", referenceClient],
    queryFn: async () => {
      if (!actor || !referenceClient) return [];
      return actor.obtenirRendezVousParReference(referenceClient);
    },
    enabled: !!actor && !isFetching && !!referenceClient,
    staleTime: 0,
  });
}

export function useGetFinancialStats() {
  const { actor, isFetching } = useActor();

  return useQuery<StatistiquesFinancieres>({
    queryKey: ["financialStats"],
    queryFn: async () => {
      if (!actor)
        return {
          totalDu: BigInt(0),
          totalPaye: BigInt(0),
          totalFaitEtPaye: BigInt(0),
          totalDuesIndividuelles: BigInt(0),
          totalFaitNonAnnule: BigInt(0),
          totalEnAttente: BigInt(0),
          totalReelRecu: BigInt(0),
        };
      const stats = await actor.obtenirStatistiquesFinancieres();
      return stats;
    },
    enabled: !!actor && !isFetching,
    staleTime: 0,
    refetchOnMount: "always",
  });
}

export function useGetClientCredit(referenceClient: string) {
  const { actor, isFetching } = useActor();

  return useQuery<bigint>({
    queryKey: ["clientCredit", referenceClient],
    queryFn: async () => {
      if (!actor || !referenceClient) return BigInt(0);
      return actor.obtenirCreditClient(referenceClient);
    },
    enabled: !!actor && !isFetching && !!referenceClient,
    staleTime: 0,
  });
}

// ============================================================================
// CORRECTION CRITIQUE FINALE ABSOLUE - useGetMonthlyListing
// ============================================================================
// Ce hook récupère les données du Listing Mensuel incluant la colonne
// "RDV du mois, faits et payés" représentée par le champ totalFaitEtPaye
//
// RÈGLE ABSOLUE POUR LE TABLEAU DE BORD :
// - totalFaitEtPaye = "RDV du mois, faits et payés"
//   → SOURCE EXCLUSIVE pour TOUS les calculs de revenus du Dashboard
//   → Utilisé pour : Revenus perçus, Revenus mensuels 2026, Statistiques annuelles 2026
//
// - totalPayeMois = "Toutes sommes reçues ce mois"
//   → NE DOIT PAS être utilisé pour les calculs du Dashboard
//   → Utilisé uniquement dans la page Listing Mensuel
// ============================================================================
export function useGetMonthlyListing(year: number, month: number) {
  const { actor, isFetching } = useActor();

  return useQuery<[DomaineListingMensuel[], TotauxListingMensuel]>({
    queryKey: ["monthlyListing", year, month],
    queryFn: async () => {
      if (!actor)
        return [
          [],
          {
            totalNbRendezVousFaits: BigInt(0),
            totalSommesDues: BigInt(0),
            totalDuMois: BigInt(0),
            totalDuesIndividuelles: BigInt(0),
            totalPayeMois: BigInt(0), // "Toutes sommes reçues ce mois" - NE PAS utiliser pour Dashboard
            totalFaitEtPaye: BigInt(0), // "RDV du mois, faits et payés" - SOURCE EXCLUSIVE pour Dashboard
            sommeSoldesRestants: BigInt(0),
            sommeSoldeCumule: BigInt(0),
            totalCreditCumule: BigInt(0),
            totalCreditMois: BigInt(0),
            totalFinExerciceCredit: BigInt(0),
            totalCreditFinMois: BigInt(0),
            totalRendezVousFaits: BigInt(0),
            totalSoldeRestantPositif: BigInt(0),
            totalSoldeRestantNegatif: BigInt(0),
            totalTotalReelRecu: BigInt(0),
          },
        ];
      const result = await actor.obtenirListingMensuel(
        BigInt(year),
        BigInt(month),
      );
      return result;
    },
    enabled: !!actor && !isFetching,
    staleTime: 0,
  });
}

export function useGetTotalReelRecu(year: number, month: number) {
  const { actor, isFetching } = useActor();

  return useQuery<bigint>({
    queryKey: ["totalReelRecu", year, month],
    queryFn: async () => {
      if (!actor) return BigInt(0);
      return actor.getTotalReelRecu(BigInt(year), BigInt(month));
    },
    enabled: !!actor && !isFetching,
    staleTime: 0,
  });
}

export function useGetRapportPDF(request: RapportPDFRequest) {
  const { actor, isFetching } = useActor();

  return useQuery<RapportPDFData[]>({
    queryKey: [
      "rapportPDF",
      request.rapportType,
      request.year.toString(),
      request.period.toString(),
    ],
    queryFn: async () => {
      if (!actor) return [];
      return actor.obtenirRapportPDF(request);
    },
    enabled: !!actor && !isFetching,
    staleTime: 0,
  });
}

// Appointment Mutations
export function useAddAppointment() {
  const { actor } = useActor();
  const { identity } = useInternetIdentity();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      dateHeure: bigint;
      heureDebut: string;
      heureFin: string;
      nomClient: string;
      referenceClient: string;
      numeroTelephone: string;
      adresse: string;
      service: string;
      notes: string;
      montantDu: bigint;
      repetition: TypeRepetition;
      clientRef: ClientReference;
    }) => {
      if (!actor) throw new Error("Actor not available");
      if (!identity) throw new Error("Identity not available");

      try {
        return await actor.ajouterRendezVous({
          dateHeure: data.dateHeure,
          heureDebut: data.heureDebut,
          heureFin: data.heureFin,
          nomClient: data.nomClient,
          clientRef: data.clientRef,
          numeroTelephone: data.numeroTelephone,
          adresse: data.adresse,
          service: data.service,
          notes: data.notes,
          montantDu: data.montantDu,
          repetition: data.repetition,
        });
      } catch (error: any) {
        const errorMessage = error.message || String(error);
        if (
          errorMessage.includes("référence client") ||
          errorMessage.includes("obligatoire")
        ) {
          throw new Error(
            "La référence client est obligatoire et doit correspondre à un client existant",
          );
        }
        if (
          errorMessage.includes("Non autorisé") ||
          errorMessage.includes("Unauthorized")
        ) {
          throw new Error(
            "Non autorisé : Veuillez vous reconnecter et réessayer",
          );
        }
        throw error;
      }
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["appointments"] }),
        queryClient.invalidateQueries({ queryKey: ["financialStats"] }),
        queryClient.invalidateQueries({ queryKey: ["clientCredit"] }),
        queryClient.invalidateQueries({ queryKey: ["monthlyListing"] }),
        queryClient.invalidateQueries({ queryKey: ["totalReelRecu"] }),
        queryClient.invalidateQueries({ queryKey: ["rapportPDF"] }),
        queryClient.invalidateQueries({ queryKey: ["clientRecords"] }),
      ]);
    },
  });
}

export function useUpdateAppointment() {
  const { actor } = useActor();
  const { identity } = useInternetIdentity();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      id: bigint;
      dateHeure: bigint;
      heureDebut: string;
      heureFin: string;
      nomClient: string;
      referenceClient: string;
      numeroTelephone: string;
      adresse: string;
      service: string;
      notes: string;
      montantDu: bigint;
      repetition: TypeRepetition;
      demandeEdition: DemandeEdition;
      clientRef: ClientReference;
    }) => {
      if (!actor) throw new Error("Actor not available");
      if (!identity) throw new Error("Identity not available");

      try {
        return await actor.modifierRendezVous({
          id: data.id,
          dateHeure: data.dateHeure,
          heureDebut: data.heureDebut,
          heureFin: data.heureFin,
          nomClient: data.nomClient,
          clientRef: data.clientRef,
          numeroTelephone: data.numeroTelephone,
          adresse: data.adresse,
          service: data.service,
          notes: data.notes,
          montantDu: data.montantDu,
          repetition: data.repetition,
          demandeEdition: data.demandeEdition,
        });
      } catch (error: any) {
        const errorMessage = error.message || String(error);
        if (
          errorMessage.includes("référence client") ||
          errorMessage.includes("obligatoire")
        ) {
          throw new Error(
            "La référence client est obligatoire et doit correspondre à un client existant",
          );
        }
        if (
          errorMessage.includes("Non autorisé") ||
          errorMessage.includes("Unauthorized")
        ) {
          throw new Error(
            "Non autorisé : Vous ne pouvez modifier que vos propres rendez-vous",
          );
        }
        throw error;
      }
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["appointments"] }),
        queryClient.invalidateQueries({ queryKey: ["financialStats"] }),
        queryClient.invalidateQueries({ queryKey: ["clientCredit"] }),
        queryClient.invalidateQueries({ queryKey: ["monthlyListing"] }),
        queryClient.invalidateQueries({ queryKey: ["totalReelRecu"] }),
        queryClient.invalidateQueries({ queryKey: ["rapportPDF"] }),
        queryClient.invalidateQueries({ queryKey: ["clientRecords"] }),
      ]);
    },
  });
}

export function useDeleteAppointment() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { id: bigint; mode: DemandeEdition }) => {
      if (!actor) throw new Error("Actor not available");
      return actor.deleteRendezVous(data.id, data.mode);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["appointments"] }),
        queryClient.invalidateQueries({ queryKey: ["financialStats"] }),
        queryClient.invalidateQueries({ queryKey: ["clientCredit"] }),
        queryClient.invalidateQueries({ queryKey: ["monthlyListing"] }),
        queryClient.invalidateQueries({ queryKey: ["totalReelRecu"] }),
        queryClient.invalidateQueries({ queryKey: ["rapportPDF"] }),
        queryClient.invalidateQueries({ queryKey: ["clientRecords"] }),
      ]);
    },
  });
}

export function useUpdateAppointmentStatus() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      id: bigint;
      fait?: boolean | null;
      annule?: boolean | null;
      commentaireManuel?: string | null;
    }) => {
      if (!actor) throw new Error("Actor not available");
      await actor.updateRendezVousStatus(
        data.id,
        data.fait ?? null,
        data.annule ?? null,
        data.commentaireManuel ?? null,
      );
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["appointments"] }),
        queryClient.invalidateQueries({ queryKey: ["financialStats"] }),
        queryClient.invalidateQueries({ queryKey: ["clientCredit"] }),
        queryClient.invalidateQueries({ queryKey: ["monthlyListing"] }),
        queryClient.invalidateQueries({ queryKey: ["totalReelRecu"] }),
        queryClient.invalidateQueries({ queryKey: ["rapportPDF"] }),
        queryClient.invalidateQueries({ queryKey: ["clientRecords"] }),
      ]);
    },
  });
}

export function useUpdateMontantPaye() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      id: bigint;
      montantPaye: bigint;
      referenceClient: string;
    }) => {
      if (!actor) throw new Error("Actor not available");
      const updatedCredit = await actor.handleMontantPayeUpdateWithCredits(
        data.id,
        data.montantPaye,
      );
      return { updatedCredit, referenceClient: data.referenceClient };
    },
    onSuccess: async (result) => {
      // Invalidate all queries related to appointments and finances
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["appointments"] }),
        queryClient.invalidateQueries({
          queryKey: ["appointments", "reference", result.referenceClient],
        }),
        queryClient.invalidateQueries({ queryKey: ["financialStats"] }),
        queryClient.invalidateQueries({ queryKey: ["clientCredit"] }),
        queryClient.invalidateQueries({
          queryKey: ["clientCredit", result.referenceClient],
        }),
        queryClient.invalidateQueries({ queryKey: ["monthlyListing"] }),
        queryClient.invalidateQueries({ queryKey: ["totalReelRecu"] }),
        queryClient.invalidateQueries({ queryKey: ["rapportPDF"] }),
        queryClient.invalidateQueries({ queryKey: ["clientRecords"] }),
      ]);

      // Force immediate refetch to ensure UI updates with new credit/debt calculations
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ["appointments"] }),
        queryClient.refetchQueries({ queryKey: ["financialStats"] }),
        queryClient.refetchQueries({
          queryKey: ["clientCredit", result.referenceClient],
        }),
        queryClient.refetchQueries({ queryKey: ["monthlyListing"] }),
        queryClient.refetchQueries({ queryKey: ["totalReelRecu"] }),
        queryClient.refetchQueries({ queryKey: ["rapportPDF"] }),
        queryClient.refetchQueries({ queryKey: ["clientRecords"] }),
      ]);
    },
  });
}

export function useUpdateClientCredit() {
  const { actor } = useActor();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      referenceClient: string;
      nouveauCredit: bigint;
    }) => {
      if (!actor) throw new Error("Actor not available");
      await actor.updateCreditClient(data.referenceClient, data.nouveauCredit);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["appointments"] }),
        queryClient.invalidateQueries({ queryKey: ["financialStats"] }),
        queryClient.invalidateQueries({ queryKey: ["clientCredit"] }),
        queryClient.invalidateQueries({ queryKey: ["monthlyListing"] }),
        queryClient.invalidateQueries({ queryKey: ["totalReelRecu"] }),
        queryClient.invalidateQueries({ queryKey: ["rapportPDF"] }),
        queryClient.invalidateQueries({ queryKey: ["clientRecords"] }),
      ]);
    },
  });
}
