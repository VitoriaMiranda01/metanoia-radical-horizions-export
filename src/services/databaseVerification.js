import { supabase } from '@/services/supabaseClient';
import { SCHEMA_DEFINITIONS } from '@/constants/databaseSchema';

/**
 * Utility to verify if the required tables and columns exist/are accessible.
 */
export const verifyDatabaseSchema = async () => {
  const report = {
    valid: true,
    details: [],
    errors: [],
    suggestions: []
  };

  console.log("Starting Database Schema Verification...");

  if (!SCHEMA_DEFINITIONS) {
    report.valid = false;
    report.errors.push("SCHEMA_DEFINITIONS is missing or undefined.");
    console.error("Database Verification Failed ❌", report.errors);
    return report;
  }

  const tablesToCheck = Object.keys(SCHEMA_DEFINITIONS);

  for (const table of tablesToCheck) {
    // Skip system tables or auth schema tables which cannot be queried directly by the client
    if (table.startsWith('auth.')) {
      report.details.push(`Table '${table}': Skipped verification (System/Auth table)`);
      continue;
    }

    const def = SCHEMA_DEFINITIONS[table];
    try {
      // Try to select all defined columns, limit 1
      const { error } = await supabase
        .from(table)
        .select(def.fields.join(','))
        .limit(1);

      if (error) {
        // If error code relates to missing column or table
        if (error.code === '42703') { // Undefined column
          report.valid = false;
          report.errors.push(`Table '${table}': Missing one or more columns (${def.fields.join(', ')}). Error: ${error.message}`);
          report.suggestions.push(`Run migration to add missing columns to '${table}'.`);
        } else if (error.code === '42P01') { // Undefined table
          report.valid = false;
          report.errors.push(`Table '${table}': Table does not exist.`);
          report.suggestions.push(`Run migration to create table '${table}'.`);
        } else {
          // Other errors (permissions, etc)
          report.details.push(`Table '${table}': Access check warning - ${error.message}`);
        }
      } else {
        report.details.push(`Table '${table}': OK`);
      }
    } catch (e) {
      report.valid = false;
      report.errors.push(`Unexpected error checking table '${table}': ${e.message}`);
    }
  }

  if (report.valid) {
    console.log("Database Verification Passed ✅");
  } else {
    console.error("Database Verification Failed ❌", report.errors);
    if (report.suggestions.length > 0) {
      console.info("Suggestions:", report.suggestions);
    }
  }

  return report;
};