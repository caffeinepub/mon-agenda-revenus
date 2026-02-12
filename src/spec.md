# Specification

## Summary
**Goal:** Restore the ability to select an existing client when creating a new appointment, including correct autofill behavior and validation.

**Planned changes:**
- Add back an "existing client" selector in the New Appointment dialog when creating a new appointment (create mode), sourcing options from the current user’s client records.
- When an existing client is selected, auto-populate appointment fields (at minimum `referenceClient` and `nomClient`, plus other matching fields when available) while still allowing users to edit appointment-specific details.
- Allow clearing the selected existing client to return to manual entry for a new/unlisted client.
- Update create-appointment validation so selecting an existing client does not trigger the duplicate-reference error, while manual entry of an already-existing reference still triggers the existing duplicate check.

**User-visible outcome:** When creating a new appointment, users can select an already-created client, have the form pre-filled accordingly, and submit successfully without false duplicate-reference errors.
