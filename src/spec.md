# Specification

## Summary
**Goal:** Add a persistent per-user client database (including one portrait photo per client), show year-to-date paid totals per client, and allow selecting saved clients when creating/editing appointments.

**Planned changes:**
- Add backend support for an owner-scoped Client database with CRUD operations, using Client Reference as the per-user unique identifier.
- Add backend + frontend support to upload/store/display one client photo per client, enforcing a 35:45 (35mm x 45mm) portrait aspect ratio via frontend crop/constraint at upload time.
- Create a new “Client Database” page with a full client add/edit form (Name, Client Reference, Phone Number, Address, Service, Notes, Photo) and a table listing all clients plus a “Paid this year” column; selecting a row loads that client into the form.
- Compute “Paid this year” for the current calendar year per client reference, using the same underlying logic/data source as Dashboard → “Listing Mensuel” → “Revenus (Faits et Payés)”, aggregated per client reference.
- Update the appointment create/edit dialog so the Client Name field can select an existing client (display Name + Client Reference) and auto-link/set the appointment’s Client Reference, while still allowing manual entry when no client is selected.

**User-visible outcome:** Users can manage a Client Database with photos, see each client’s paid total for the current year, and quickly select an existing client when creating or editing appointments with the client reference linked to avoid ambiguity.
