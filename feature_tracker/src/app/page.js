// app/page.js
import FileExplorer from '../components/FileExplorer'; // Make sure path is correct

export default function Home() {
  return (
    <main>
      {/* You can add headers/footers outside the explorer if needed */}
      <FileExplorer />
    </main>
  );
}