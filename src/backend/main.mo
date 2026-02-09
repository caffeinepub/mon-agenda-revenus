import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Iter "mo:core/Iter";
import Time "mo:core/Time";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import Text "mo:core/Text";
import List "mo:core/List";
import Array "mo:core/Array";
import Int "mo:core/Int";
import MixinAuthorization "authorization/MixinAuthorization";
import AccessControl "authorization/access-control";

actor {
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
    owner : Principal;
    dateHeure : Time.Time;
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
    owner : Principal;
    id : Nat;
    clientName : Text;
    referenceClient : Text;
    phoneNumber : Text;
    address : Text;
    service : Text;
    notes : Text;
    photo : ?[Nat8];
  };

  public type ClientReference = {
    owner : Principal;
    referenceClient : Text;
  };

  public type RendezVousCreateArgs = {
    dateHeure : Time.Time;
    heureDebut : Text;
    heureFin : Text;
    nomClient : Text;
    clientRef : ClientReference;
    numeroTelephone : Text;
    adresse : Text;
    service : Text;
    notes : Text;
    montantDu : Nat;
    repetition : TypeRepetition;
  };

  public type RendezVousUpdateArgs = {
    id : Nat;
    dateHeure : Time.Time;
    heureDebut : Text;
    heureFin : Text;
    nomClient : Text;
    clientRef : ClientReference;
    numeroTelephone : Text;
    adresse : Text;
    service : Text;
    notes : Text;
    montantDu : Nat;
    repetition : TypeRepetition;
    demandeEdition : DemandeEdition;
  };

  var rendezVousMap = Map.empty<Nat, RendezVous>();
  var clientRecordMap = Map.empty<Nat, ClientRecord>();
  var dernierClientRecordId = 0;
  var dernierId = 0;
  var userProfiles = Map.empty<Principal, UserProfile>();
  var creditsClients = Map.empty<Text, Nat>();
  var accessControlState = AccessControl.initState();
  var systemInitialized = false;

  include MixinAuthorization(accessControlState);

  func requireAuthenticated(caller : Principal) {
    if (caller.isAnonymous()) {
      Runtime.trap("Non autorisé : les utilisateurs anonymes ne peuvent pas accéder à cette application");
    };
  };

  func ensureInitializedAndAuthorized(caller : Principal) {
    requireAuthenticated(caller);

    if (not systemInitialized) {
      AccessControl.initialize(
        accessControlState,
        caller,
        "",
        "",
      );
      systemInitialized := true;
    };
  };

  func requireUserPermission(caller : Principal) {
    ensureInitializedAndAuthorized(caller);
    if (not AccessControl.hasPermission(accessControlState, caller, #user)) {
      Runtime.trap("Non autorisé : les droits utilisateur sont requis");
    };
  };

  func requireAdminPermission(caller : Principal) {
    ensureInitializedAndAuthorized(caller);
    if (not AccessControl.hasPermission(accessControlState, caller, #admin)) {
      Runtime.trap("Non autorisé : les droits administrateur sont requis");
    };
  };

  func tryFromText(text : Text) : ?Principal {
    let chars = text.chars();
    if (chars.next() == null) { return null };
    for (char in chars) {
      if (char != ' ') { return ?Principal.fromText(text) };
    };
    null;
  };

  func parseClientKey(key : Text) : ?(Principal, Text) {
    let parts = key.split(#char ':');
    let partsArray = parts.toArray();
    if (partsArray.size() != 2) {
      return null;
    };
    let ownerText = partsArray[0];
    let referenceClient = partsArray[1];

    switch (tryFromText(ownerText)) {
      case (null) { null };
      case (?owner) { ?(owner, referenceClient) };
    };
  };

  func callerOwnsReferenceClient(caller : Principal, referenceClient : Text) : Bool {
    for ((_, cr) in clientRecordMap.entries()) {
      if (cr.owner == caller and cr.referenceClient == referenceClient) {
        return true;
      };
    };
    for ((_, rv) in rendezVousMap.entries()) {
      if (rv.owner == caller and rv.referenceClient == referenceClient) {
        return true;
      };
    };
    false;
  };

  func verifyClientOwnership(caller : Principal, referenceClient : Text) {
    if (not callerOwnsReferenceClient(caller, referenceClient)) {
      Runtime.trap("Non autorisé : vous ne pouvez accéder qu'aux données de vos propres clients");
    };
  };

  func verifyClientReferenceOwnership(caller : Principal, clientRef : ClientReference) {
    if (clientRef.owner != caller) {
      Runtime.trap("Non autorisé : la référence client doit appartenir à l'utilisateur actuel");
    };
    if (clientRef.referenceClient == "") {
      Runtime.trap("La référence client est obligatoire");
    };
  };

  public query ({ caller }) func getCallerUserProfile() : async ?UserProfile {
    requireUserPermission(caller);
    userProfiles.get(caller);
  };

  public query ({ caller }) func getUserProfile(user : Principal) : async ?UserProfile {
    requireUserPermission(caller);
    if (caller != user and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Non autorisé : vous ne pouvez consulter que votre propre profil");
    };
    userProfiles.get(user);
  };

  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async () {
    requireUserPermission(caller);
    userProfiles.add(caller, profile);
  };

  public shared ({ caller }) func addClientRecord(
    clientName : Text,
    referenceClient : Text,
    phoneNumber : Text,
    address : Text,
    service : Text,
    notes : Text,
    photo : ?[Nat8],
  ) : async Nat {
    requireUserPermission(caller);

    if (referenceClient == "") {
      Runtime.trap("La référence client est obligatoire");
    };

    let id = dernierClientRecordId + 1;
    let newClientRecord : ClientRecord = {
      owner = caller;
      id;
      clientName;
      referenceClient;
      phoneNumber;
      address;
      service;
      notes;
      photo;
    };

    clientRecordMap.add(id, newClientRecord);
    dernierClientRecordId += 1;
    id;
  };

  public query ({ caller }) func getClientRecord(id : Nat) : async ?ClientRecord {
    requireUserPermission(caller);
    switch (clientRecordMap.get(id)) {
      case (null) { null };
      case (?clientRecord) {
        if (clientRecord.owner != caller) {
          Runtime.trap("Non autorisé : vous ne pouvez accéder qu'à vos propres clients");
        };
        ?clientRecord;
      };
    };
  };

  public query ({ caller }) func getAllClientRecords() : async [ClientRecord] {
    requireUserPermission(caller);
    clientRecordMap.values().toArray().filter(
      func(cr : ClientRecord) : Bool { cr.owner == caller }
    );
  };

  public shared ({ caller }) func updateClientRecord(
    id : Nat,
    clientName : Text,
    referenceClient : Text,
    phoneNumber : Text,
    address : Text,
    service : Text,
    notes : Text,
    photo : ?[Nat8],
  ) : async () {
    requireUserPermission(caller);
    switch (clientRecordMap.get(id)) {
      case (null) { Runtime.trap("Client non trouvé") };
      case (?clientRecord) {
        if (clientRecord.owner != caller) {
          Runtime.trap("Non autorisé : vous ne pouvez mettre à jour que vos propres clients");
        };

        if (referenceClient != clientRecord.referenceClient) {
          Runtime.trap("La référence client ne peut pas être modifiée une fois créée");
        };

        let updatedClientRecord : ClientRecord = {
          owner = caller;
          id;
          clientName;
          referenceClient;
          phoneNumber;
          address;
          service;
          notes;
          photo;
        };

        clientRecordMap.add(id, updatedClientRecord);
      };
    };
  };

  public shared ({ caller }) func deleteClientRecord(id : Nat) : async () {
    requireUserPermission(caller);
    switch (clientRecordMap.get(id)) {
      case (null) { Runtime.trap("Client non trouvé") };
      case (?clientRecord) {
        if (clientRecord.owner != caller) {
          Runtime.trap("Non autorisé : vous ne pouvez supprimer que vos propres clients");
        };
        clientRecordMap.remove(id);
      };
    };
  };

  public query ({ caller }) func calculatePaidThisYear(referenceClient : Text) : async Nat {
    requireUserPermission(caller);
    verifyClientOwnership(caller, referenceClient);

    let currentYear = 2026;
    let startOfYear = getStartOfYear(currentYear);
    let endOfYear = getStartOfYear(currentYear + 1);

    var totalPaid = 0;

    rendezVousMap.values().forEach(
      func(rv) {
        if (rv.owner == caller and rv.referenceClient == referenceClient) {
          if (rv.dateHeure >= startOfYear and rv.dateHeure < endOfYear) {
            totalPaid += rv.montantPaye;
          };
        };
      }
    );

    totalPaid;
  };

  func getClientKey(owner : Principal, referenceClient : Text) : Text {
    owner.toText() # ":" # referenceClient;
  };

  func convertirClientReferenceToString(clientRef : ClientReference) : Text {
    clientRef.owner.toText() # ":" # clientRef.referenceClient;
  };

  func calculerDettesClient(owner : Principal, referenceClient : Text) : Nat {
    let maintenant = Time.now();
    var totalDettes = 0;

    rendezVousMap.values().forEach(
      func(rv) {
        if (rv.owner == owner and rv.referenceClient == referenceClient and rv.dateHeure <= maintenant and not rv.annule) {
          if (rv.montantDu > rv.montantPaye) {
            totalDettes += (rv.montantDu - rv.montantPaye);
          };
        };
      }
    );

    totalDettes;
  };

  func appliquerPaiementAuxDettesEtCredits(
    owner : Principal,
    referenceClient : Text,
    montantPaye : Nat,
    montantDu : Nat,
  ) : Nat {
    let clientKey = getClientKey(owner, referenceClient);
    let creditActuel = switch (creditsClients.get(clientKey)) {
      case (null) { 0 };
      case (?c) { c };
    };

    let dettesTotales = calculerDettesClient(owner, referenceClient);

    var nouveauCredit : Nat = 0;

    if (montantPaye > montantDu) {
      nouveauCredit := montantPaye - montantDu;
    } else {
      nouveauCredit := if (montantDu > montantPaye) {
        Nat.sub(creditActuel, montantDu - montantPaye);
      } else { creditActuel };
    };
    if (dettesTotales > 0) {
      if (nouveauCredit <= dettesTotales) {
        creditsClients.add(clientKey, 0);
        return 0;
      } else {
        let creditRestantApresDettes = Nat.sub(nouveauCredit, dettesTotales);
        creditsClients.add(clientKey, creditRestantApresDettes);
        return creditRestantApresDettes;
      };
    } else {
      creditsClients.add(clientKey, nouveauCredit);
      return nouveauCredit;
    };
  };

  func genererRendezVousRecurents(
    baseRendezVous : RendezVous,
    typeRepetition : TypeRepetition,
  ) {
    let nbRepetitions : Nat = switch (typeRepetition) {
      case (#aucune) { 0 };
      case (#hebdomadaire _) { 52 };
      case (#mensuelle) { 12 };
      case (#annuelle) { 3 };
    };

    var rendezVousCourant = baseRendezVous;
    var i : Nat = 0;

    let dureeMois = 30 * 24 * 60 * 60 * 1_000_000_000;

    while (i < nbRepetitions) {
      i += 1;

      let nouvelleDateHeure = switch (typeRepetition) {
        case (#hebdomadaire _) {
          rendezVousCourant.dateHeure + (7 * 24 * 60 * 60 * 1_000_000_000);
        };
        case (#mensuelle) {
          rendezVousCourant.dateHeure + dureeMois;
        };
        case (#annuelle) {
          rendezVousCourant.dateHeure + (365 * 24 * 60 * 60 * 1_000_000_000);
        };
        case (#aucune) { rendezVousCourant.dateHeure };
      };

      let nouveauRendezVous : RendezVous = {
        id = dernierId + 1;
        owner = rendezVousCourant.owner;
        dateHeure = nouvelleDateHeure;
        heureDebut = rendezVousCourant.heureDebut;
        heureFin = rendezVousCourant.heureFin;
        nomClient = rendezVousCourant.nomClient;
        referenceClient = rendezVousCourant.referenceClient;
        numeroTelephone = rendezVousCourant.numeroTelephone;
        adresse = rendezVousCourant.adresse;
        service = rendezVousCourant.service;
        notes = rendezVousCourant.notes;
        montantDu = rendezVousCourant.montantDu;
        montantPaye = 0;
        paiementAnticipe = false;
        fait = rendezVousCourant.fait;
        annule = rendezVousCourant.annule;
        repetition = baseRendezVous.repetition;
        commentaireManuel = rendezVousCourant.commentaireManuel;
      };

      rendezVousMap.add(nouveauRendezVous.id, nouveauRendezVous);
      dernierId += 1;
      rendezVousCourant := nouveauRendezVous;
    };
  };

  func genererRendezVousHebdomadairesMultiJours(
    baseRendezVous : RendezVous,
    joursSemaine : JoursSemaine,
  ) {
    let daysToAdd = List.empty<Nat>();
    if (joursSemaine.lundi) { daysToAdd.add(0) };
    if (joursSemaine.mardi) { daysToAdd.add(1) };
    if (joursSemaine.mercredi) { daysToAdd.add(2) };
    if (joursSemaine.jeudi) { daysToAdd.add(3) };
    if (joursSemaine.vendredi) { daysToAdd.add(4) };
    if (joursSemaine.samedi) { daysToAdd.add(5) };
    if (joursSemaine.dimanche) { daysToAdd.add(6) };

    let yearInNanos : Time.Time = 365 * 24 * 60 * 60 * 1_000_000_000;
    var currentWeekStart = baseRendezVous.dateHeure;

    while (currentWeekStart < baseRendezVous.dateHeure + yearInNanos) {
      for (dayOffset in daysToAdd.values()) {
        let nouvelleDateHeure = currentWeekStart + (dayOffset * 24 * 60 * 60 * 1_000_000_000);

        let nouveauRendezVous : RendezVous = {
          id = dernierId + 1;
          owner = baseRendezVous.owner;
          dateHeure = nouvelleDateHeure;
          heureDebut = baseRendezVous.heureDebut;
          heureFin = baseRendezVous.heureFin;
          nomClient = baseRendezVous.nomClient;
          referenceClient = baseRendezVous.referenceClient;
          numeroTelephone = baseRendezVous.numeroTelephone;
          adresse = baseRendezVous.adresse;
          service = baseRendezVous.service;
          notes = baseRendezVous.notes;
          montantDu = baseRendezVous.montantDu;
          montantPaye = 0;
          paiementAnticipe = false;
          fait = baseRendezVous.fait;
          annule = baseRendezVous.annule;
          repetition = baseRendezVous.repetition;
          commentaireManuel = baseRendezVous.commentaireManuel;
        };

        rendezVousMap.add(nouveauRendezVous.id, nouveauRendezVous);
        dernierId += 1;
      };

      currentWeekStart += 7 * 24 * 60 * 60 * 1_000_000_000;
    };
  };

  public shared ({ caller }) func ajouterRendezVous(args : RendezVousCreateArgs) : async Nat {
    requireUserPermission(caller);
    verifyClientReferenceOwnership(caller, args.clientRef);

    let id = dernierId + 1;
    let nouveauRV : RendezVous = {
      id;
      owner = caller;
      dateHeure = args.dateHeure;
      heureDebut = args.heureDebut;
      heureFin = args.heureFin;
      nomClient = args.nomClient;
      referenceClient = args.clientRef.referenceClient;
      numeroTelephone = args.numeroTelephone;
      adresse = args.adresse;
      service = args.service;
      notes = args.notes;
      montantDu = args.montantDu;
      montantPaye = 0;
      paiementAnticipe = false;
      fait = false;
      annule = false;
      repetition = args.repetition;
      commentaireManuel = "";
    };

    rendezVousMap.add(id, nouveauRV);
    dernierId += 1;

    switch (args.repetition) {
      case (#hebdomadaire joursSemaine) {
        genererRendezVousHebdomadairesMultiJours(nouveauRV, joursSemaine);
      };
      case (_) {
        genererRendezVousRecurents(nouveauRV, args.repetition);
      };
    };

    id;
  };

  public shared ({ caller }) func modifierRendezVous(
    args : RendezVousUpdateArgs,
  ) : async () {
    requireUserPermission(caller);
    verifyClientReferenceOwnership(caller, args.clientRef);

    switch (rendezVousMap.get(args.id)) {
      case (null) { Runtime.trap("Rendez-vous non trouvé") };
      case (?rvExistant) {
        if (rvExistant.owner != caller) {
          Runtime.trap("Non autorisé : vous ne pouvez modifier que vos propres rendez-vous");
        };

        switch (args.demandeEdition) {
          case (#unique) {
            let rvModifie : RendezVous = {
              id = args.id;
              owner = caller;
              dateHeure = args.dateHeure;
              heureDebut = args.heureDebut;
              heureFin = args.heureFin;
              nomClient = args.nomClient;
              referenceClient = args.clientRef.referenceClient;
              numeroTelephone = args.numeroTelephone;
              adresse = args.adresse;
              service = args.service;
              notes = args.notes;
              montantDu = args.montantDu;
              montantPaye = rvExistant.montantPaye;
              paiementAnticipe = rvExistant.paiementAnticipe;
              fait = rvExistant.fait;
              annule = rvExistant.annule;
              repetition = args.repetition;
              commentaireManuel = rvExistant.commentaireManuel;
            };
            rendezVousMap.add(args.id, rvModifie);
          };
          case (#futursDuClient) {
            let now = Time.now();
            let originalReferenceClient = rvExistant.referenceClient;

            rendezVousMap.entries().forEach(
              func((idCourant, rvCourant)) {
                if (
                  rvCourant.owner == caller and
                  rvCourant.referenceClient == originalReferenceClient and
                  rvCourant.dateHeure >= now
                ) {
                  let rvModifie : RendezVous = {
                    id = rvCourant.id;
                    owner = caller;
                    dateHeure = rvCourant.dateHeure;
                    heureDebut = args.heureDebut;
                    heureFin = args.heureFin;
                    nomClient = args.nomClient;
                    referenceClient = args.clientRef.referenceClient;
                    numeroTelephone = args.numeroTelephone;
                    adresse = args.adresse;
                    service = args.service;
                    notes = args.notes;
                    montantDu = args.montantDu;
                    montantPaye = rvCourant.montantPaye;
                    paiementAnticipe = rvCourant.paiementAnticipe;
                    fait = rvCourant.fait;
                    annule = rvCourant.annule;
                    repetition = args.repetition;
                    commentaireManuel = rvCourant.commentaireManuel;
                  };
                  rendezVousMap.add(rvCourant.id, rvModifie);
                };
              }
            );
          };
        };
      };
    };
  };

  public shared ({ caller }) func deleteRendezVous(id : Nat, demandeEdition : DemandeEdition) : async () {
    requireUserPermission(caller);

    switch (rendezVousMap.get(id)) {
      case (null) {
        Runtime.trap("Rendez-vous non trouvé");
      };
      case (?rv) {
        if (rv.owner != caller) {
          Runtime.trap("Non autorisé : vous ne pouvez supprimer que vos propres rendez-vous");
        };

        verifyClientOwnership(caller, rv.referenceClient);

        switch (demandeEdition) {
          case (#unique) {
            rendezVousMap.remove(id);
          };
          case (#futursDuClient) {
            let now = Time.now();
            let referenceClient = rv.referenceClient;

            let aSupprimer = rendezVousMap.toArray().filter(
              func((idCourant, rvCourant)) {
                rvCourant.owner == caller and
                rvCourant.referenceClient == referenceClient and
                rvCourant.dateHeure >= now
              }
            );
            aSupprimer.forEach(func((idCourant, _)) { rendezVousMap.remove(idCourant) });
          };
        };
      };
    };
  };

  public shared ({ caller }) func updateRendezVousStatus(
    id : Nat,
    fait : ?Bool,
    annule : ?Bool,
    commentaireManuel : ?Text,
  ) : async () {
    requireUserPermission(caller);

    switch (rendezVousMap.get(id)) {
      case (null) { Runtime.trap("Rendez-vous non trouvé") };
      case (?rv) {
        if (rv.owner != caller) {
          Runtime.trap("Non autorisé : vous ne pouvez modifier que vos propres rendez-vous");
        };

        verifyClientOwnership(caller, rv.referenceClient);

        let nouveauStatutAnnule = switch (annule) {
          case (null) { rv.annule };
          case (?val) { val };
        };

        let nouveauMontantDu = if (nouveauStatutAnnule) { 0 } else { rv.montantDu };

        let rvModifie : RendezVous = {
          id = rv.id;
          owner = caller;
          dateHeure = rv.dateHeure;
          heureDebut = rv.heureDebut;
          heureFin = rv.heureFin;
          nomClient = rv.nomClient;
          referenceClient = rv.referenceClient;
          numeroTelephone = rv.numeroTelephone;
          adresse = rv.adresse;
          service = rv.service;
          notes = rv.notes;
          montantDu = nouveauMontantDu;
          montantPaye = rv.montantPaye;
          paiementAnticipe = rv.paiementAnticipe;
          fait = switch (fait) {
            case (null) { rv.fait };
            case (?val) { val };
          };
          annule = nouveauStatutAnnule;
          repetition = rv.repetition;
          commentaireManuel = switch (commentaireManuel) {
            case (null) { rv.commentaireManuel };
            case (?val) { val };
          };
        };
        rendezVousMap.add(id, rvModifie);
      };
    };
  };

  public shared ({ caller }) func handleMontantPayeUpdateWithCredits(
    id : Nat,
    montantPaye : Nat,
  ) : async Nat {
    requireUserPermission(caller);

    switch (rendezVousMap.get(id)) {
      case (null) {
        Runtime.trap("Rendez-vous non trouvé");
      };
      case (?rv) {
        if (rv.owner != caller) {
          Runtime.trap("Non autorisé : vous ne pouvez modifier que vos propres rendez-vous");
        };

        verifyClientOwnership(caller, rv.referenceClient);

        let montantReelPaye = if (not rv.annule) { montantPaye } else { 0 };

        let rvModifie : RendezVous = {
          id = rv.id;
          owner = rv.owner;
          dateHeure = rv.dateHeure;
          heureDebut = rv.heureDebut;
          heureFin = rv.heureFin;
          nomClient = rv.nomClient;
          referenceClient = rv.referenceClient;
          numeroTelephone = rv.numeroTelephone;
          adresse = rv.adresse;
          service = rv.service;
          notes = rv.notes;
          montantDu = rv.montantDu;
          montantPaye = montantReelPaye;
          paiementAnticipe = rv.paiementAnticipe;
          fait = rv.fait;
          annule = rv.annule;
          repetition = rv.repetition;
          commentaireManuel = rv.commentaireManuel;
        };
        rendezVousMap.add(id, rvModifie);

        if (montantReelPaye > 0 and rv.montantDu > 0) {
          let montantCredit = appliquerPaiementAuxDettesEtCredits(caller, rv.referenceClient, montantReelPaye, rv.montantDu);
          return montantCredit;
        };

        let clientKey = getClientKey(caller, rv.referenceClient);
        switch (creditsClients.get(clientKey)) {
          case (null) { 0 };
          case (?credit) { credit };
        };
      };
    };
  };

  public shared ({ caller }) func updateCreditClient(
    referenceClient : Text,
    nouveauCredit : Nat,
  ) : async () {
    requireUserPermission(caller);
    verifyClientOwnership(caller, referenceClient);

    let clientKey = getClientKey(caller, referenceClient);
    creditsClients.add(clientKey, nouveauCredit);
  };

  public query ({ caller }) func obtenirRendezVous(id : Nat) : async RendezVous {
    requireUserPermission(caller);
    switch (rendezVousMap.get(id)) {
      case (null) {
        Runtime.trap("Rendez-vous non trouvé");
      };
      case (?rv) {
        if (rv.owner != caller) {
          Runtime.trap("Non autorisé : vous ne pouvez consulter que vos propres rendez-vous");
        };
        rv;
      };
    };
  };

  public query ({ caller }) func obtenirTousLesRendezVous() : async [RendezVous] {
    requireUserPermission(caller);
    rendezVousMap.values().toArray().filter(
      func(rv : RendezVous) : Bool { rv.owner == caller }
    );
  };

  public query ({ caller }) func obtenirRendezVousParStatut(paye : Bool) : async [RendezVous] {
    requireUserPermission(caller);
    rendezVousMap.values().toArray().filter(
      func(rv : RendezVous) : Bool { rv.owner == caller and (rv.montantPaye > 0) == paye }
    );
  };

  public query ({ caller }) func obtenirRendezVousParReference(referenceClient : Text) : async [RendezVous] {
    requireUserPermission(caller);
    verifyClientOwnership(caller, referenceClient);
    rendezVousMap.values().toArray().filter(
      func(rv : RendezVous) : Bool {
        rv.owner == caller and rv.referenceClient == referenceClient
      }
    );
  };

  public query ({ caller }) func obtenirCreditClient(referenceClient : Text) : async Nat {
    requireUserPermission(caller);
    verifyClientOwnership(caller, referenceClient);

    let clientKey = getClientKey(caller, referenceClient);
    switch (creditsClients.get(clientKey)) {
      case (null) { 0 };
      case (?credit) { credit };
    };
  };

  func getStartOfYear(year : Int) : Time.Time {
    let secondsPerDay : Int = 86400;
    let nanosPerSecond : Int = 1_000_000_000;

    var daysFromEpoch : Int = 0;

    var y : Int = 1970;
    while (y < year) {
      let isLeap = (y % 4 == 0 and y % 100 != 0) or (y % 400 == 0);
      daysFromEpoch += if (isLeap) { 366 } else { 365 };
      y += 1;
    };

    daysFromEpoch * secondsPerDay * nanosPerSecond;
  };

  func getStartOfMonth(year : Int, month : Int) : Time.Time {
    let secondsPerDay : Int = 86400;
    let nanosPerSecond : Int = 1_000_000_000;

    var daysFromEpoch : Int = 0;

    var y : Int = 1970;
    while (y < year) {
      let isLeap = (y % 4 == 0 and y % 100 != 0) or (y % 400 == 0);
      daysFromEpoch += if (isLeap) { 366 } else { 365 };
      y += 1;
    };

    let isLeapYear = (year % 4 == 0 and year % 100 != 0) or (year % 400 == 0);
    var m : Int = 1;
    while (m < month) {
      let daysInMonth = switch (m) {
        case (1 or 3 or 5 or 7 or 8 or 10 or 12) { 31 };
        case (4 or 6 or 9 or 11) { 30 };
        case (2) { if (isLeapYear) { 29 } else { 28 } };
        case (_) { 30 };
      };
      daysFromEpoch += daysInMonth;
      m += 1;
    };

    daysFromEpoch * secondsPerDay * nanosPerSecond;
  };

  func getEndOfMonth(year : Int, month : Int) : Time.Time {
    let isLeapYear = (year % 4 == 0 and year % 100 != 0) or (year % 400 == 0);
    let daysInMonth = switch (month) {
      case (1 or 3 or 5 or 7 or 8 or 10 or 12) { 31 };
      case (4 or 6 or 9 or 11) { 30 };
      case (2) { if (isLeapYear) { 29 } else { 28 } };
      case (_) { 30 };
    };

    let startOfMonth = getStartOfMonth(year, month);
    let secondsPerDay : Int = 86400;
    let nanosPerSecond : Int = 1_000_000_000;

    startOfMonth + (daysInMonth * secondsPerDay * nanosPerSecond);
  };

  public query ({ caller }) func obtenirStatistiquesFinancieres() : async StatistiquesFinancieres {
    requireUserPermission(caller);

    let maintenant = Time.now();
    let year = 2026;

    var totalDu = 0;
    var totalPaye = 0;
    var totalFaitEtPaye = 0;
    var totalDuesIndividuelles = 0;
    var totalFaitNonAnnule = 0;
    var totalEnAttente : Int = 0;

    rendezVousMap.values().forEach(
      func(rv) {
        if (rv.owner == caller and rv.dateHeure <= maintenant) {
          if (rv.fait) {
            if (not rv.annule and rv.montantDu > rv.montantPaye) {
              totalDu += (rv.montantDu - rv.montantPaye);
              totalEnAttente += rv.montantDu - rv.montantPaye;
            };
            totalPaye += rv.montantPaye;

            if (rv.montantPaye >= rv.montantDu) {
              totalFaitEtPaye += rv.montantDu;
            };
            if (rv.fait and not rv.annule) {
              totalFaitNonAnnule += rv.montantDu;
            };
          };
          if (rv.fait and not rv.annule) {
            totalDuesIndividuelles += rv.montantDu;
          };
        };
      }
    );

    {
      totalDu;
      totalPaye;
      totalFaitEtPaye;
      totalDuesIndividuelles;
      totalFaitNonAnnule;
      totalEnAttente;
      totalReelRecu = calculateTotalReelRecuForYear(caller, year);
    };
  };

  func calculateTotalReelRecuForYear(caller : Principal, year : Int) : Int {
    var total : Int = 0;
    var month : Nat = 1;
    while (month <= 12) {
      total += getTotalReelRecuForMonth(caller, year, month);
      month += 1;
    };
    total;
  };

  func getTotalReelRecuForMonth(caller : Principal, year : Int, month : Nat) : Int {
    let listings = computeClientListing(caller, year, month);
    let totals = computeMonthTotals(listings);
    totals.totalReelRecu;
  };

  func getTotalFaitEtPayeForMonth(caller : Principal, year : Int, month : Nat) : Nat {
    let listings = computeClientListing(caller, year, month);
    let totals = computeMonthTotals(listings);
    totals.totalFaitEtPaye;
  };

  func computeClientListing(owner : Principal, year : Int, month : Int) : [DomaineListingMensuel] {
    let monthStart = getStartOfMonth(year, month);
    let monthEnd = getEndOfMonth(year, month);
    let yearStart = getStartOfYear(year);

    let clientMap = Map.empty<Text, {
      nomClient : Text;
      nbRendezVousFaits : Nat;
      totalDuMois : Nat;
      totalDuesIndividuelles : Nat;
      totalPayeMois : Nat;
      totalFaitEtPaye : Nat;
      rendezVousFaitsTotal : Nat;
    }>();

    rendezVousMap.values().forEach(
      func(rv) {
        if (rv.owner == owner) {
          if (rv.dateHeure >= monthStart and rv.dateHeure < monthEnd) {
            let existing = switch (clientMap.get(rv.referenceClient)) {
              case (null) {
                {
                  nomClient = rv.nomClient;
                  nbRendezVousFaits = 0;
                  totalDuMois = 0;
                  totalDuesIndividuelles = 0;
                  totalPayeMois = 0;
                  totalFaitEtPaye = 0;
                  rendezVousFaitsTotal = 0;
                };
              };
              case (?data) { data };
            };
            let nbFaits = if (rv.fait) { existing.nbRendezVousFaits + 1 } else { existing.nbRendezVousFaits };
            let totalDu = if (rv.fait and not rv.annule) { existing.totalDuMois + rv.montantDu } else { existing.totalDuMois };
            let totalPaye = if (rv.fait) { existing.totalPayeMois + rv.montantPaye } else { existing.totalPayeMois };
            let totalFaitEtPaye = if (
              rv.fait and rv.montantPaye >= rv.montantDu
            ) { existing.totalFaitEtPaye + rv.montantDu } else {
              existing.totalFaitEtPaye;
            };
            let rendezVousFaitsTotal = if (rv.fait and not rv.annule) { existing.rendezVousFaitsTotal + rv.montantDu } else { existing.rendezVousFaitsTotal };
            let totalDuesIndividuelles = if (rv.fait and not rv.annule) { existing.totalDuesIndividuelles + rv.montantDu } else { existing.totalDuesIndividuelles };

            clientMap.add(rv.referenceClient, {
              nomClient = rv.nomClient;
              nbRendezVousFaits = nbFaits;
              totalDuMois = totalDu;
              totalDuesIndividuelles;
              totalPayeMois = totalPaye;
              totalFaitEtPaye;
              rendezVousFaitsTotal;
            });
          };
        };
      }
    );

    let results = List.empty<DomaineListingMensuel>();

    clientMap.entries().forEach(
      func((referenceClient, data)) {
        let clientKey = getClientKey(owner, referenceClient);
        let creditActuel = switch (creditsClients.get(clientKey)) {
          case (null) { 0 };
          case (?c) { c };
        };

        let creditCumuleAnnee = if (month == 1) {
          0;
        } else { creditActuel };

        var soldeCumuleAnnee : Int = 0;
        rendezVousMap.values().forEach(
          func(rv) {
            if (rv.owner == owner and rv.referenceClient == referenceClient and rv.dateHeure >= yearStart) {
              if (not rv.annule and rv.fait) {
                soldeCumuleAnnee += rv.montantPaye;
                soldeCumuleAnnee -= rv.montantDu;
              };
            };
          }
        );

        let soldeRestant : Int = data.totalPayeMois - data.totalDuMois;
        let totalSommesDues = data.totalDuMois;
        let totalDuesIndividuelles = data.totalDuesIndividuelles;
        let totalReelRecu : Int = data.totalPayeMois + (if (soldeRestant < 0) { soldeRestant } else { 0 });

        results.add({
          referenceClient;
          nomClient = data.nomClient;
          nbRendezVousFaits = data.nbRendezVousFaits;
          soldeCumule = soldeCumuleAnnee;
          totalDuMois = data.totalDuMois;
          totalDuesIndividuelles;
          totalPayeMois = data.totalPayeMois;
          totalFaitEtPaye = data.totalFaitEtPaye;
          soldeRestant;
          creditCumule = creditCumuleAnnee;
          creditMois = creditActuel;
          finExerciceCredit = creditActuel;
          creditFinMois = creditActuel;
          totalSommesDues;
          rendezVousFaitsTotal = data.rendezVousFaitsTotal;
          totalReelRecu;
        });
      }
    );

    results.toArray();
  };

  func computeListingTotals(listings : [DomaineListingMensuel]) : TotauxListingMensuel {
    var totalNbRendezVousFaits = 0;
    var totalSommesDues = 0;
    var totalDuMois = 0;
    var totalDuesIndividuelles = 0;
    var totalPayeMois = 0;
    var totalFaitEtPaye = 0;
    var totalRendezVousFaits = 0;
    var totalSoldeRestantPositif : Int = 0;
    var totalSoldeRestantNegatif : Int = 0;
    var totalTotalReelRecu : Int = 0;

    for (entry in listings.values()) {
      totalNbRendezVousFaits += entry.nbRendezVousFaits;
      totalSommesDues += entry.totalSommesDues;
      totalDuMois += entry.totalDuMois;
      totalDuesIndividuelles += entry.totalDuesIndividuelles;
      totalPayeMois += entry.totalPayeMois;
      totalFaitEtPaye += entry.totalFaitEtPaye;
      totalRendezVousFaits += entry.rendezVousFaitsTotal;
      totalTotalReelRecu += entry.totalReelRecu;

      if (entry.soldeRestant > 0) {
        totalSoldeRestantPositif += entry.soldeRestant;
      } else if (entry.soldeRestant < 0) {
        totalSoldeRestantNegatif += entry.soldeRestant;
      };
    };

    {
      totalNbRendezVousFaits;
      totalSommesDues;
      totalDuMois;
      totalDuesIndividuelles;
      totalPayeMois;
      totalFaitEtPaye;
      totalRendezVousFaits;
      totalSoldeRestantPositif;
      totalSoldeRestantNegatif;
      totalTotalReelRecu;
    };
  };

  func computeMonthTotals(listings : [DomaineListingMensuel]) : TotauxMois {
    var totalRdvs = 0;
    var montantDuTotal = 0;
    var totalDuMois = 0;
    var totalPayeMois = 0;
    var totalFaitEtPaye = 0;
    var totalSoldeRestantPositif : Int = 0;
    var totalSoldeRestantNegatif : Int = 0;
    var totalReelRecu : Int = 0;

    for (entry in listings.values()) {
      totalRdvs += entry.nbRendezVousFaits;
      montantDuTotal += entry.totalSommesDues;
      totalDuMois += entry.totalDuMois;
      totalPayeMois += entry.totalPayeMois;
      totalFaitEtPaye += entry.totalFaitEtPaye;
      totalReelRecu += entry.totalReelRecu;

      if (entry.soldeRestant > 0) {
        totalSoldeRestantPositif += entry.soldeRestant;
      } else if (entry.soldeRestant < 0) {
        totalSoldeRestantNegatif += entry.soldeRestant;
      };
    };

    {
      totalRdvs;
      montantDuTotal;
      totalDuMois;
      totalPayeMois;
      totalFaitEtPaye;
      totalSoldeRestantPositif;
      totalSoldeRestantNegatif;
      totalReelRecu;
    };
  };

  public query ({ caller }) func obtenirListingMensuel(year : Int, month : Int) : async ([DomaineListingMensuel], TotauxListingMensuel) {
    requireUserPermission(caller);
    let listings = computeClientListing(caller, year, month);
    let totalRow = computeListingTotals(listings);
    (listings, totalRow);
  };

  public query ({ caller }) func getDashboardStats() : async DashboardStats {
    requireUserPermission(caller);

    let currentYear = 2026;
    let monthCount = 12;

    var totalDue = 0;
    var totalRevenusMensuels2026 = List.empty<Nat>();
    var revenusPercus = 0;
    var totalRecu2026 = 0;
    var revenuMoyen2026 = 0;
    var totalReelRecu = 0;
    var revenusPercusMois = 0;

    var month = 1;
    while (month <= monthCount) {
      let results = computeClientListing(caller, currentYear, month);
      let totals = computeMonthTotals(results);

      totalDue += totals.totalDuMois;
      totalRevenusMensuels2026.add(totals.totalFaitEtPaye);

      if (month == currentYear) {
        revenusPercus := totals.totalFaitEtPaye;
      };
      month += 1;
    };

    for (revenu in totalRevenusMensuels2026.values()) {
      totalRecu2026 += revenu;
    };

    let currentMonth = getCurrentMonth();
    let completeMonths = totalRevenusMensuels2026.toArray().sliceToArray(0, currentMonth);

    let totalCompleteMonths = completeMonths.foldLeft(
      0,
      func(acc, revenue) { acc + revenue }
    );

    revenuMoyen2026 := if (completeMonths.size() > 0) {
      totalCompleteMonths / completeMonths.size();
    } else { 0 };

    totalReelRecu := calculateTotalReelRecuForYear(caller, currentYear).toNat();

    revenusPercusMois := getTotalFaitEtPayeForMonth(caller, currentYear, getCurrentMonth().toNat());

    {
      totalDue;
      totalRevenusMensuels2026 = totalRevenusMensuels2026.toArray();
      revenusPercus;
      totalRecu2026;
      revenuMoyen2026;
      totalReelRecu;
      revenusPercusMois;
    };
  };

  func getCurrentMonth() : Int {
    let now = Time.now();
    let nanosPerDay : Int = 24 * 60 * 60 * 1_000_000_000;
    let daysSinceEpoch = now / nanosPerDay;

    var dayOfYear : Nat = if (daysSinceEpoch % 365 >= 0) {
      (daysSinceEpoch % 365).toNat();
    } else {
      0;
    };

    let months = [
      31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31
    ];

    var month : Int = 1;
    while (month <= 12) {
      let currentMonth = month.toNat();
      let daysInMonth = months[currentMonth - 1];
      if (dayOfYear <= daysInMonth) {
        return month;
      } else {
        dayOfYear -= daysInMonth;
      };
      month += 1;
    };

    1;
  };

  public query ({ caller }) func getTotalReelRecu(year : Int, month : Int) : async Int {
    requireUserPermission(caller);
    let listings = computeClientListing(caller, year, month);
    let totals = computeMonthTotals(listings);
    totals.totalReelRecu;
  };

  public query ({ caller }) func obtenirRapportPDF(request : RapportPDFRequest) : async [RapportPDFData] {
    requireUserPermission(caller);

    let startTime = switch (request.rapportType) {
      case (#hebdomadaire) { getStartOfMonth(request.year, request.period) };
      case (#mensuel) { getStartOfMonth(request.year, request.period) };
      case (#annuel) { getStartOfYear(request.year) };
    };

    let endTime = switch (request.rapportType) {
      case (#hebdomadaire) { getEndOfMonth(request.year, request.period) };
      case (#mensuel) { getEndOfMonth(request.year, request.period) };
      case (#annuel) { getStartOfYear(request.year + 1) };
    };

    let clientMap = Map.empty<Text, RapportPDFData>();

    rendezVousMap.values().forEach(
      func(rv) {
        if (
          rv.owner == caller and
          rv.dateHeure >= startTime and
          rv.dateHeure < endTime
        ) {
          let fats = if (rv.fait and not rv.annule) { 1 } else { 0 };
          let dues = if (rv.fait and not rv.annule) { rv.montantDu } else { 0 };
          let paye = if (rv.fait) { rv.montantPaye } else { 0 };
          let credits = switch (creditsClients.get(getClientKey(caller, rv.referenceClient))) {
            case (null) { 0 };
            case (?c) { c };
          };

          let existing = switch (clientMap.get(rv.referenceClient)) {
            case (null) {
              {
                referenceClient = rv.referenceClient;
                nomClient = rv.nomClient;
                nbRendezVousFaits = fats;
                totalSommesDues = dues;
                totalSommesRecues = paye;
                totalCredits = credits;
              };
            };
            case (?data) {
              {
                referenceClient = rv.referenceClient;
                nomClient = rv.nomClient;
                nbRendezVousFaits = data.nbRendezVousFaits + fats;
                totalSommesDues = data.totalSommesDues + dues;
                totalSommesRecues = data.totalSommesRecues + paye;
                totalCredits = data.totalCredits + credits;
              };
            };
          };
          clientMap.add(rv.referenceClient, existing);
        };
      }
    );

    clientMap.values().toArray();
  };
};

