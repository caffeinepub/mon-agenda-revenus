import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Principal "mo:core/Principal";

module {
  // Types to match old and new actor states.
  type ClientRecord = {
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

  // Type definitions for old and new actor states.
  type Actor = {
    clientRecordMap : Map.Map<Nat, ClientRecord>;
    // Keep all other variables unchanged.
  };

  // Migration function to install new logic without changing existing data.
  public func run(old : Actor) : Actor {
    old;
  };
};
