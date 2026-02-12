# Specification

## Summary
**Goal:** Fix inconsistencies in monthly due/credit calculations, enforce unique client references, and add a “Paid this year” totals row in the Client Database.

**Planned changes:**
- Align the Dashboard card “Due (completed appointments; current month)” calculation to exactly match the Monthly Listing total “Negative Credit” for the same selected month.
- Correct the Monthly Listing “Previous month credit” carryover so each month’s value equals the immediately preceding month’s ending credit/balance (including March onward, and January using prior December when available).
- Enforce server-side uniqueness of the client reference during both client creation and appointment creation; block saves and show a clear “reference already used” validation error when duplicated (while keeping the existing rule that client references can’t be changed after creation).
- Add a totals row under the Client Database table headers that sums “Paid this year” across all currently displayed clients, updating as displayed rows/data changes.

**User-visible outcome:** Dashboard due amounts match Monthly Listing negative credit totals for the same month, monthly credit carryovers remain correct across the year, duplicate client references are prevented with clear errors, and the Client Database shows an up-to-date “Paid this year” grand total row.
