# Specification

## Summary
**Goal:** Add a "Custom Range" period selection mode to the PDF Report page, allowing users to filter reports by a freely chosen start and end date.

**Planned changes:**
- Add a third period selector option "Custom Range" alongside the existing "By Month" and "By Year" modes on `RapportPDFPage.tsx`
- When "Custom Range" is selected, display two date pickers (start date and end date)
- Update the data aggregation/filtering logic to support filtering appointments by an arbitrary start and end date range
- Reuse the existing report table format and PDF layout for the custom range output

**User-visible outcome:** Users can select a custom date range (e.g., January 1st to March 31st) on the PDF Report page and generate a correctly filtered report using the same table and PDF format as the existing monthly and yearly reports.
