// diffhelper.js

export function generateDiff(oldStr, newStr) {
    const oldLines = oldStr.split('\n');
    const newLines = newStr.split('\n');
    let diff = '';
    let i = 0, j = 0;
  
    while (i < oldLines.length || j < newLines.length) {
      if (i < oldLines.length && j < newLines.length && oldLines[i] === newLines[j]) {
        diff += `  ${newLines[j]}\n`; // Unchanged line
        i++;
        j++;
      } else {
        if (i < oldLines.length) {
          const nextOccurrence = newLines.slice(j).indexOf(oldLines[i]);
          if (nextOccurrence === -1 || nextOccurrence > 2) {
            diff += `- ${oldLines[i]}\n`; // Removed line
            i++;
          } else {
            if (j < newLines.length) {
              diff += `+ ${newLines[j]}\n`; // Added line
              j++;
            } else {
              i++; j++; // Safety break
            }
          }
        }
        if (j < newLines.length) {
          const prevOccurrence = oldLines.slice(i).indexOf(newLines[j]);
          if (prevOccurrence === -1 || prevOccurrence > 2) {
            diff += `+ ${newLines[j]}\n`; // Added line
            j++;
          } else {
            if (i < oldLines.length) {
              diff += `- ${oldLines[i]}\n`; // Removed line
              i++;
            } else {
              i++; j++; // Safety break
            }
          }
        }
      }
    }
    return diff.trimEnd();
  }