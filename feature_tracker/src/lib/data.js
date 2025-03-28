// lib/data.js
import { supabase } from './supabaseClient';
import { generateDiff } from './diffhelper';

// Helper function to fetch file content from Supabase
async function fetchFileContent(bucketName, filePath) {
  try {
    const { data, error } = await supabase.storage.from(bucketName).download(filePath);

    if (error) {
      console.error('Error downloading file:', error);
      return null;
    }

    // Convert the Blob to text
    const text = await new Response(data).text();
    return text;
  } catch (error) {
    console.error('An unexpected error occurred:', error);
    return null;
  }
}

// Example function to compare two files from your Supabase bucket
export async function compareSupabaseFiles(bucketName, oldFilePath, newFilePath) {
  const oldContent = await fetchFileContent(bucketName, oldFilePath);
  const newContent = await fetchFileContent(bucketName, newFilePath);

  if (oldContent === null || newContent === null) {
    console.error('Could not fetch one or both files from Supabase.');
    return null;
  }

  const diff = generateDiff(oldContent, newContent);
  return diff;
}

// You can add other data-related functions here if needed!