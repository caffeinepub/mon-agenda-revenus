export interface Client {
  id: string;
  reference: string;
  nom: string;
  prenom: string;
  email1: string;
  email2: string;
  dateNaissance: string;
  nom2Contact: string;
  tel2Contact: string;
  telephone: string;
  adresse: string;
  service: string;
  note: string;
  photo: string;
  tarifHoraire: number;
  createdAt: string;
}

export interface Appointment {
  id: string;
  clientRef: string;
  clientNom: string;
  clientPrenom: string;
  date: string;
  heureDebut: string;
  heureFin: string;
  duree: number;
  tarif: number;
  statut: "fait" | "annule" | "non-traite";
  fait: boolean;
  annule: boolean;
  paymentDate: string;
  montantPaye: number;
  montantDu: number;
  note: string;
  recurrence?: {
    type: "hebdomadaire" | "mensuel";
    jourSemaine: number;
  };
}

export interface User {
  id: string;
  login: string;
  password: string;
  role: "admin" | "avance" | "lecteur";
  sansMotDePasse: boolean;
}

export interface AppSettings {
  darkMode: boolean;
  fontColor: string;
  googleDriveUrl: string;
  googleDrivePassword: string;
  dailyStartHour: string;
  dailyEndHour: string;
}

export interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  appointmentId: string | null;
}
