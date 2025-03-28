// lib/data.js

// Sample file system structure
export const initialFileSystem = [
    {
      id: '1',
      name: 'app',
      type: 'folder',
      children: [
        { id: '2', name: 'page.js', type: 'file', oldContent: `export default function Home() {\n  return <h1>Hello</h1>;\n}`, newContent: `export default function Home() {\n  // Add a comment\n  return <h1>Hello World!</h1>;\n}` },
        { id: '3', name: 'layout.js', type: 'file', oldContent: `export default function RootLayout({ children }) {\n  return (\n    <html>\n      <body>{children}</body>\n    </html>\n  );\n}`, newContent: `import './globals.css';\n\nexport default function RootLayout({ children }) {\n  return (\n    <html lang="en">\n      <body>{children}</body>\n    </html>\n  );\n}` },
        {
          id: '4',
          name: 'api',
          type: 'folder',
          children: [
            { id: '5', name: 'hello.js', type: 'file', oldContent: `// Old API route`, newContent: `// New API route\nexport function GET() {\n  return new Response('Hello from API!');\n}` },
          ],
        },
      ],
    },
    {
      id: '6',
      name: 'components',
      type: 'folder',
      children: [
          { id: '7', name: 'Button.jsx', type: 'file', oldContent: `const Button = () => <button>Click</button>;`, newContent: `const Button = ({ label }) => <button className="px-4 py-2 bg-blue-500 text-white rounded">{label}</button>;\nexport default Button;` },
      ],
    },
    { id: '8', name: 'package.json', type: 'file', oldContent: `{\n  "name": "my-app"\n}`, newContent: `{\n  "name": "my-vercel-explorer-js",\n  "version": "0.1.0"\n}` },
    { id: '9', name: 'README.md', type: 'file', oldContent: `# My App`, newContent: `# My Vercel Explorer\n\nAn example Next.js app.` },
  ];
  
  // Helper function to generate a basic text diff (for simulation)
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