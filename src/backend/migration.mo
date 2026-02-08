import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Principal "mo:core/Principal";

module {
  public type JoursSemaine = {
    lundi : Bool;
    mardi : Bool;
    mercredi : Bool;
    jeudi : Bool;
    vendredi : Bool;
    samedi : Bool;
    dimanche : Bool;
  };

  public type TypeRepetition = {
    #aucune;
    #hebdomadaire : JoursSemaine;
    #mensuelle;
    #annuelle;
  };

  public type DemandeEdition = {
    #unique;
    #futursDuClient;
  };

  public type RendezVousBase = {
    id : Nat;
    owner : Principal.Principal;
    dateHeure : Int;
    heureDebut : Text;
    heureFin : Text;
    nomClient : Text;
    referenceClient : Text;
    numeroTelephone : Text;
    adresse : Text;
    service : Text;
    notes : Text;
    montantDu : Nat;
    montantPaye : Nat;
    paiementAnticipe : Bool;
    repetition : TypeRepetition;
  };

  public type RendezVous = RendezVousBase and {
    fait : Bool;
    annule : Bool;
    commentaireManuel : Text;
  };

  public type StatistiquesFinancieres = {
    totalDu : Nat;
    totalPaye : Nat;
    totalFaitEtPaye : Nat;
    totalDuesIndividuelles : Nat;
    totalFaitNonAnnule : Nat;
    totalEnAttente : Int;
    totalReelRecu : Int;
  };

  public type DomaineListingMensuel = {
    referenceClient : Text;
    nomClient : Text;
    nbRendezVousFaits : Nat;
    soldeCumule : Int;
    totalDuMois : Nat;
    totalDuesIndividuelles : Nat;
    totalPayeMois : Nat;
    totalFaitEtPaye : Nat;
    soldeRestant : Int;
    creditCumule : Int;
    creditMois : Int;
    finExerciceCredit : Int;
    creditFinMois : Int;
    totalSommesDues : Nat;
    rendezVousFaitsTotal : Nat;
    totalReelRecu : Int;
  };

  public type TotauxListingMensuel = {
    totalNbRendezVousFaits : Nat;
    totalSommesDues : Nat;
    totalDuMois : Nat;
    totalDuesIndividuelles : Nat;
    totalPayeMois : Nat;
    totalFaitEtPaye : Nat;
    totalRendezVousFaits : Nat;
    totalSoldeRestantPositif : Int;
    totalSoldeRestantNegatif : Int;
    totalTotalReelRecu : Int;
  };

  public type TotauxMois = {
    totalRdvs : Nat;
    montantDuTotal : Nat;
    totalDuMois : Nat;
    totalPayeMois : Nat;
    totalFaitEtPaye : Nat;
    totalSoldeRestantPositif : Int;
    totalSoldeRestantNegatif : Int;
    totalReelRecu : Int;
  };

  public type DashboardStats = {
    totalDue : Nat;
    totalRevenusMensuels2026 : [Nat];
    revenusPercus : Nat;
    totalRecu2026 : Nat;
    revenuMoyen2026 : Nat;
    totalReelRecu : Nat;
    revenusPercusMois : Nat;
  };

  public type UserProfile = {
    name : Text;
  };

  public type RapportType = { #hebdomadaire; #mensuel; #annuel };
  public type RapportPDFRequest = {
    rapportType : RapportType;
    year : Int;
    period : Nat;
  };

  public type RapportPDFData = {
    referenceClient : Text;
    nomClient : Text;
    nbRendezVousFaits : Nat;
    totalSommesRecues : Nat;
    totalSommesDues : Nat;
    totalCredits : Nat;
  };

  public type ClientRecord = {
    owner : Principal.Principal;
    id : Nat;
    clientName : Text;
    referenceClient : Text;
    phoneNumber : Text;
    address : Text;
    service : Text;
    notes : Text;
    photo : ?[Nat8];
  };

  public type NewActor = {
    rendezVousMap : Map.Map<Nat, RendezVous>;
    clientRecordMap : Map.Map<Nat, ClientRecord>;
    dernierClientRecordId : Nat;
    dernierId : Nat;
    userProfiles : Map.Map<Principal.Principal, UserProfile>;
    creditsClients : Map.Map<Text, Nat>;
    systemInitialized : Bool;
  };

  public type OldActor = {
    rendezVousMap : Map.Map<Nat, RendezVous>;
    dernierId : Nat;
    userProfiles : Map.Map<Principal.Principal, UserProfile>;
    creditsClients : Map.Map<Text, Nat>;
    systemInitialized : Bool;
  };

  public func run(old : OldActor) : NewActor {
    let emptyClientRecordMap = Map.empty<Nat, ClientRecord>();

    {
      rendezVousMap = old.rendezVousMap;
      clientRecordMap = emptyClientRecordMap;
      dernierClientRecordId = 0;
      dernierId = old.dernierId;
      userProfiles = old.userProfiles;
      creditsClients = old.creditsClients;
      systemInitialized = old.systemInitialized;
    };
  };
};
