# Database Schema Mismatch Audit Report

This report analyzes the mismatch between the React frontend code (specifically the organizer and configuration pages) and the existing Supabase database schema.

## 1. NAMING MISMATCHES (CRITICAL)

### Field: `edicao_numero` vs `edition_number`
- **Used in:** `src/lib/organizerHelpers.js` (lines 40, 68), `src/pages/OrganizerConfigPage.jsx`
- **Table:** `configuracoes`
- **Expected Type:** `integer` / `numeric`
- **Status:** **CRITICAL**
- **Issue:** The frontend code attempts to read and write using the key `edicao_numero` in the Supabase payload. However, the database table `configuracoes` defines this column as `edition_number`.
- **Impact:** The edition number is not being correctly saved to or loaded from the database, which breaks dynamic edition resolution across the application.
- **Fix:** Update `lib/organizerHelpers.js` to map `numero_edicao` to `edition_number` instead of `edicao_numero`.