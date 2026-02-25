# Specification

## Summary
**Goal:** Add an annual report option to the PDF Report page, allowing users to generate a report aggregated across all 12 months of a selected year, while keeping the existing monthly report flow fully intact.

**Planned changes:**
- Add a report type selector (radio buttons, tabs, or dropdown) at the top of the PDF Report page to switch between "Monthly Report" and "Annual Report" modes.
- When "Monthly Report" is selected, the existing month selector and monthly report behavior remain unchanged.
- When "Annual Report" is selected, hide the month selector and show a year dropdown containing 2022, 2023, 2024, 2025, and 2026.
- Render the annual report with the same sections/tables/frames as the monthly report, but with data aggregated across all 12 months of the selected year by summing each monthly value.
- Add new aggregation logic that calls existing calculation functions per month without modifying them.

**User-visible outcome:** Users can now select "Annual Report" on the PDF Report page, pick a year (2022–2026), and view a full-year report with the same structure as the monthly report but with data summed across all 12 months.
