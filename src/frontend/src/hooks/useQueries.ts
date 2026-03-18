import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type {
  ClientRecord,
  DemandeEdition,
  DomaineListingMensuel,
  RapportPDFData,
  RapportPDFRequest,
  RendezVous,
  StatistiquesFinancieres,
  TotauxListingMensuel,
  TypeRepetition,
  UserProfile,
} from "../backend";
import type { DemandeEdition as _DemandeEditionType } from "../backend";
import { syncToBackendBackground } from "../utils/backendSync";
import {
  addAppointment,
  addClientRecord,
  computeClientCredit,
  computeFinancialStats,
  computeMonthlyTotals,
  computeRapportPDF,
  computeTotalReelRecu,
  deleteAppointment,
  deleteClientRecord,
  getMonthlyClientList,
  loadAppointments,
  loadClients,
  updateAppointment,
  updateAppointmentStatus,
  updateClientRecord,
  updateMontantPaye,
} from "../utils/localDataStore";

// ClientReference kept for compatibility
import type { ClientReference } from "../backend";

// ── User Profile (stub - no ICP auth needed for app data) ───────────────
export function useGetCallerUserProfile() {
  return useQuery<UserProfile | null>({
    queryKey: ["currentUserProfile"],
    queryFn: async () => null,
    staleTime: Number.POSITIVE_INFINITY,
  });
}

export function useSaveCallerUserProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (_profile: UserProfile) => {},
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["currentUserProfile"] });
    },
  });
}

// ── Client Record Queries ──────────────────────────────────────────────────
export function useGetAllClientRecords() {
  return useQuery<ClientRecord[]>({
    queryKey: ["clientRecords"],
    queryFn: () => loadClients(),
    staleTime: 0,
  });
}

export function useGetClientRecord(id: bigint) {
  return useQuery<ClientRecord | null>({
    queryKey: ["clientRecord", id.toString()],
    queryFn: () => {
      const clients = loadClients();
      return clients.find((c) => c.id === id) ?? null;
    },
    staleTime: 0,
  });
}

export function useAddClientRecord() {
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
      return addClientRecord(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientRecords"] });
      syncToBackendBackground();
    },
  });
}

export function useUpdateClientRecord() {
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
      updateClientRecord(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientRecords"] });
      syncToBackendBackground();
    },
  });
}

export function useDeleteClientRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: bigint) => {
      deleteClientRecord(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientRecords"] });
      syncToBackendBackground();
    },
  });
}

// ── Appointment Queries ───────────────────────────────────────────────────────
export function useGetAllAppointments() {
  return useQuery<RendezVous[]>({
    queryKey: ["appointments"],
    queryFn: () => loadAppointments(),
    staleTime: 0,
  });
}

export function useGetAppointmentsByStatus(paid: boolean) {
  return useQuery<RendezVous[]>({
    queryKey: ["appointments", "status", paid],
    queryFn: () => {
      const apts = loadAppointments();
      return apts.filter((a) => a.montantPaye > BigInt(0) === paid);
    },
    staleTime: 0,
  });
}

export function useGetAppointmentsByReference(referenceClient: string) {
  return useQuery<RendezVous[]>({
    queryKey: ["appointments", "reference", referenceClient],
    queryFn: () => {
      const apts = loadAppointments();
      return apts.filter((a) => a.referenceClient === referenceClient);
    },
    enabled: !!referenceClient,
    staleTime: 0,
  });
}

export function useGetFinancialStats() {
  return useQuery<StatistiquesFinancieres>({
    queryKey: ["financialStats"],
    queryFn: () => computeFinancialStats(loadAppointments()),
    staleTime: 0,
    refetchOnMount: "always",
  });
}

export function useGetClientCredit(referenceClient: string) {
  return useQuery<bigint>({
    queryKey: ["clientCredit", referenceClient],
    queryFn: () => {
      if (!referenceClient) return BigInt(0);
      return computeClientCredit(loadAppointments(), referenceClient);
    },
    enabled: !!referenceClient,
    staleTime: 0,
  });
}

export function useGetMonthlyListing(year: number, month: number) {
  return useQuery<[DomaineListingMensuel[], TotauxListingMensuel]>({
    queryKey: ["monthlyListing", year, month],
    queryFn: () => {
      const appointments = loadAppointments();
      const listings = getMonthlyClientList(appointments, year, month);
      const totals = computeMonthlyTotals(appointments, year, month);
      return [listings, totals] as [
        DomaineListingMensuel[],
        TotauxListingMensuel,
      ];
    },
    staleTime: 0,
  });
}

export function useGetTotalReelRecu(year: number, month: number) {
  return useQuery<bigint>({
    queryKey: ["totalReelRecu", year, month],
    queryFn: () => computeTotalReelRecu(loadAppointments(), year, month),
    staleTime: 0,
  });
}

export function useGetRapportPDF(request: RapportPDFRequest) {
  return useQuery<RapportPDFData[]>({
    queryKey: [
      "rapportPDF",
      request.rapportType,
      request.year.toString(),
      request.period.toString(),
    ],
    queryFn: () => {
      const appointments = loadAppointments();
      const year = Number(request.year);
      const period = Number(request.period);

      let startMs: number;
      let endMs: number;

      // RapportType: mensuel=0, annuel=1, plage=2 (from enum values)
      const rapportType = request.rapportType;
      const typeName =
        typeof rapportType === "string" ? rapportType : String(rapportType);

      if (typeName === "mensuel" || typeName === "0") {
        const month = period;
        startMs = new Date(year, month - 1, 1).getTime();
        endMs = new Date(year, month, 0, 23, 59, 59, 999).getTime();
      } else if (typeName === "annuel" || typeName === "1") {
        startMs = new Date(year, 0, 1).getTime();
        endMs = new Date(year, 11, 31, 23, 59, 59, 999).getTime();
      } else {
        // plage - period encodes start/end somehow, default to full year
        startMs = new Date(year, 0, 1).getTime();
        endMs = new Date(year, 11, 31, 23, 59, 59, 999).getTime();
      }

      return computeRapportPDF(appointments, startMs, endMs);
    },
    staleTime: 0,
  });
}

// ── Appointment Mutations ─────────────────────────────────────────────────────
export function useAddAppointment() {
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
      return addAppointment(data);
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
      syncToBackendBackground();
    },
  });
}

export function useUpdateAppointment() {
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
      updateAppointment(data);
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
      syncToBackendBackground();
    },
  });
}

export function useDeleteAppointment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      id: bigint;
      mode: DemandeEdition;
      referenceClient?: string;
      dateHeure?: bigint;
    }) => {
      deleteAppointment(
        data.id,
        data.mode,
        data.referenceClient,
        data.dateHeure,
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
      syncToBackendBackground();
    },
  });
}

export function useUpdateAppointmentStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      id: bigint;
      fait?: boolean | null;
      annule?: boolean | null;
      commentaireManuel?: string | null;
    }) => {
      updateAppointmentStatus(
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
      syncToBackendBackground();
    },
  });
}

export function useUpdateMontantPaye() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      id: bigint;
      montantPaye: bigint;
      referenceClient: string;
    }) => {
      updateMontantPaye(data.id, data.montantPaye);
      const credit = computeClientCredit(
        loadAppointments(),
        data.referenceClient,
      );
      return { updatedCredit: credit, referenceClient: data.referenceClient };
    },
    onSuccess: async (result) => {
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
      syncToBackendBackground();
    },
  });
}

export function useUpdateClientCredit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (_data: {
      referenceClient: string;
      nouveauCredit: bigint;
    }) => {
      // Credit is now computed automatically from appointments, no-op
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["appointments"] }),
        queryClient.invalidateQueries({ queryKey: ["financialStats"] }),
        queryClient.invalidateQueries({ queryKey: ["clientCredit"] }),
        queryClient.invalidateQueries({ queryKey: ["monthlyListing"] }),
      ]);
    },
  });
}

// Re-export types for backward compatibility
export type { ClientReference };
