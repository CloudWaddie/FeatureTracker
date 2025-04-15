// lib/data.js
import { getSupabaseClient } from './supabaseClient';
// Import createPatch for generating standard diff patches
import { createPatch } from 'diff';

// Helper function to fetch file content from Supabase (Keep this as it uses the correct client)
async function fetchFileContent(bucketName, filePath) {
  const supabase = getSupabaseClient(); // Get authenticated client

  try {
    const { data, error } = await supabase.storage.from(bucketName).download(filePath);

    if (error) {
      console.error(`Error downloading file ${filePath}:`, error);
      return null;
    }

    // Convert the Blob to text
    const text = await new Response(data).text();
    return text;
  } catch (error) {
    console.error(`An unexpected error occurred downloading ${filePath}:`, error);
    return null;
  }
}

/**
 * Compares two files from Supabase Storage using line-based comparison on placeholder content.
 * Downloads both files, creates placeholder versions (all letters replaced with 'A'),
 * generates a standard diff patch string using createPatch on the placeholders,
 * and returns structured data including the patch string and the ORIGINAL content.
 * @param {string} bucketName - The name of the Supabase bucket.
 * @param {string} filePathA - Path to the first file (e.g., older version).
 * @param {string} filePathB - Path to the second file (e.g., newer version).
 * @param {string} language - The language of the files (currently unused).
 * @param {number} contextLines - Number of context lines to include in the patch.
 * @returns {Promise<object|null>} An object { lineDiffPatch, originalA, originalB } or null on error.
 */
export async function compareSupabaseFiles(
  bucketName,
  filePathA,
  filePathB,
  language = 'javascript', // Keep language param for consistency
  contextLines = 3 // Default context lines
) {
  console.log(`Comparing ${filePathA} and ${filePathB} using placeholder line comparison (patch).`);
  const [originalA, originalB] = await Promise.all([
    fetchFileContent(bucketName, filePathA),
    fetchFileContent(bucketName, filePathB)
  ]);

  if (originalA === null || originalB === null) {
    console.error("Failed to download one or both files for comparison.");
    return null;
  }

  // Create placeholder versions by replacing all letters with 'A'
  const placeholderA = originalA.replace(/[a-zA-Z]/g, 'A');
  const placeholderB = originalB.replace(/[a-zA-Z]/g, 'A');
  console.log("Created placeholder versions for comparison.");
  // console.log("Placeholder A (first 100):", placeholderA.substring(0, 100)); // Optional debug
  // console.log("Placeholder B (first 100):", placeholderB.substring(0, 100)); // Optional debug


  console.log(`Generating line diff patch from placeholders with ${contextLines} context lines...`);
  // Use createPatch to generate a standard diff patch string FROM PLACEHOLDERS
  const lineDiffPatch = createPatch(
    filePathB, // Use filePathB as the "new file" name in the patch header
    placeholderA, // Compare placeholder A
    placeholderB, // Compare placeholder B
    filePathA, // Old file header (label)
    filePathB, // New file header (label)
    { context: contextLines } // Options object to specify context lines
  );

  console.log("--- createPatch Result (from placeholders, first 500 chars): ---");
  console.log(lineDiffPatch.substring(0, 500));
  console.log("-------------------------------------------");

  // Return the patch generated from placeholders, but the ORIGINAL content
  return {
    lineDiffPatch: lineDiffPatch,
    originalA: originalA,
    originalB: originalB
  };
}

/**
 * Fetches the content of a single file from Supabase Storage.
 * @param {string} bucketName - The name of the Supabase bucket.
 * @param {string} filePath - Path to the file.
 * @returns {Promise<string|null>} The file content as a string, or null on error.
 */
export async function fetchSupabaseFileContent(bucketName, filePath) {
  console.log(`Fetching content for: ${filePath}`);
  const content = await fetchFileContent(bucketName, filePath);
  if (content === null) {
    console.error(`Failed to fetch content for ${filePath}.`);
    return null;
  }
  return content;
}

// You can add other data-related functions here if needed!
