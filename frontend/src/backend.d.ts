import type { Principal } from "@icp-sdk/core/principal";
export interface Some<T> {
    __kind__: "Some";
    value: T;
}
export interface None {
    __kind__: "None";
}
export type Option<T> = Some<T> | None;
export interface RendezVousUpdateArgs {
    id: bigint;
    montantDu: bigint;
    service: string;
    dateHeure: Time;
    heureFin: string;
    nomClient: string;
    repetition: TypeRepetition;
    notes: string;
    adresse: string;
    clientRef: ClientReference;
    heureDebut: string;
    numeroTelephone: string;
    demandeEdition: DemandeEdition;
}
export interface RapportPDFRequest {
    rapportType: RapportType;
    period: bigint;
    year: bigint;
}
export interface ClientReference {
    owner: Principal;
    referenceClient: string;
}
export type Time = bigint;
export interface ClientRecord {
    id: bigint;
    service: string;
    clientName: string;
    owner: Principal;
    referenceClient: string;
    address: string;
    notes: string;
    photo?: Uint8Array;
    phoneNumber: string;
}
export type TypeRepetition = {
    __kind__: "annuelle";
    annuelle: null;
} | {
    __kind__: "aucune";
    aucune: null;
} | {
    __kind__: "hebdomadaire";
    hebdomadaire: JoursSemaine;
} | {
    __kind__: "mensuelle";
    mensuelle: null;
};
export interface JoursSemaine {
    mardi: boolean;
    samedi: boolean;
    dimanche: boolean;
    jeudi: boolean;
    lundi: boolean;
    vendredi: boolean;
    mercredi: boolean;
}
export interface DashboardStats {
    revenusPercus: bigint;
    totalRecu2026: bigint;
    revenuMoyen2026: bigint;
    revenusPercusMois: bigint;
    totalDue: bigint;
    totalRevenusMensuels2026: Array<bigint>;
    totalReelRecu: bigint;
}
export interface TotauxListingMensuel {
    totalTotalReelRecu: bigint;
    totalDuesIndividuelles: bigint;
    totalSoldeRestantPositif: bigint;
    totalFaitEtPaye: bigint;
    totalDuMois: bigint;
    totalRendezVousFaits: bigint;
    totalSommesDues: bigint;
    totalNbRendezVousFaits: bigint;
    totalPayeMois: bigint;
    totalSoldeRestantNegatif: bigint;
}
export interface RendezVous {
    id: bigint;
    montantDu: bigint;
    service: string;
    dateHeure: Time;
    owner: Principal;
    fait: boolean;
    heureFin: string;
    nomClient: string;
    annule: boolean;
    repetition: TypeRepetition;
    paiementAnticipe: boolean;
    montantPaye: bigint;
    referenceClient: string;
    notes: string;
    adresse: string;
    commentaireManuel: string;
    heureDebut: string;
    numeroTelephone: string;
}
export interface StatistiquesFinancieres {
    totalDuesIndividuelles: bigint;
    totalFaitEtPaye: bigint;
    totalDu: bigint;
    totalPaye: bigint;
    totalFaitNonAnnule: bigint;
    totalEnAttente: bigint;
    totalReelRecu: bigint;
}
export interface RapportPDFData {
    nbRendezVousFaits: bigint;
    nomClient: string;
    totalSommesDues: bigint;
    referenceClient: string;
    totalSommesRecues: bigint;
    totalCredits: bigint;
}
export interface DomaineListingMensuel {
    creditMois: bigint;
    totalDuesIndividuelles: bigint;
    totalFaitEtPaye: bigint;
    rendezVousFaitsTotal: bigint;
    totalDuMois: bigint;
    nbRendezVousFaits: bigint;
    nomClient: string;
    soldeCumule: bigint;
    totalSommesDues: bigint;
    finExerciceCredit: bigint;
    creditFinMois: bigint;
    referenceClient: string;
    soldeRestant: bigint;
    totalPayeMois: bigint;
    creditCumule: bigint;
    totalReelRecu: bigint;
}
export interface UserProfile {
    name: string;
}
export interface RendezVousCreateArgs {
    montantDu: bigint;
    service: string;
    dateHeure: Time;
    heureFin: string;
    nomClient: string;
    repetition: TypeRepetition;
    notes: string;
    adresse: string;
    clientRef: ClientReference;
    heureDebut: string;
    numeroTelephone: string;
}
export enum DemandeEdition {
    unique = "unique",
    futursDuClient = "futursDuClient"
}
export enum RapportType {
    annuel = "annuel",
    hebdomadaire = "hebdomadaire",
    mensuel = "mensuel"
}
export enum UserRole {
    admin = "admin",
    user = "user",
    guest = "guest"
}
export interface backendInterface {
    addClientRecord(clientName: string, referenceClient: string, phoneNumber: string, address: string, service: string, notes: string, photo: Uint8Array | null): Promise<bigint>;
    ajouterRendezVous(args: RendezVousCreateArgs): Promise<bigint>;
    assignCallerUserRole(user: Principal, role: UserRole): Promise<void>;
    calculatePaidThisYear(referenceClient: string): Promise<bigint>;
    deleteClientRecord(id: bigint): Promise<void>;
    deleteRendezVous(id: bigint, demandeEdition: DemandeEdition): Promise<void>;
    getAllClientRecords(): Promise<Array<ClientRecord>>;
    getCallerUserProfile(): Promise<UserProfile | null>;
    getCallerUserRole(): Promise<UserRole>;
    getClientRecord(id: bigint): Promise<ClientRecord | null>;
    getDashboardStats(): Promise<DashboardStats>;
    getTotalReelRecu(year: bigint, month: bigint): Promise<bigint>;
    getUserProfile(user: Principal): Promise<UserProfile | null>;
    handleMontantPayeUpdateWithCredits(id: bigint, montantPaye: bigint): Promise<bigint>;
    isCallerAdmin(): Promise<boolean>;
    modifierRendezVous(args: RendezVousUpdateArgs): Promise<void>;
    obtenirCreditClient(referenceClient: string): Promise<bigint>;
    obtenirListingMensuel(year: bigint, month: bigint): Promise<[Array<DomaineListingMensuel>, TotauxListingMensuel]>;
    obtenirRapportPDF(request: RapportPDFRequest): Promise<Array<RapportPDFData>>;
    obtenirRendezVous(id: bigint): Promise<RendezVous>;
    obtenirRendezVousParReference(referenceClient: string): Promise<Array<RendezVous>>;
    obtenirRendezVousParStatut(paye: boolean): Promise<Array<RendezVous>>;
    obtenirStatistiquesFinancieres(): Promise<StatistiquesFinancieres>;
    obtenirTousLesRendezVous(): Promise<Array<RendezVous>>;
    saveCallerUserProfile(profile: UserProfile): Promise<void>;
    updateClientRecord(id: bigint, clientName: string, referenceClient: string, phoneNumber: string, address: string, service: string, notes: string, photo: Uint8Array | null): Promise<void>;
    updateCreditClient(referenceClient: string, nouveauCredit: bigint): Promise<void>;
    updateRendezVousStatus(id: bigint, fait: boolean | null, annule: boolean | null, commentaireManuel: string | null): Promise<void>;
}
