import { createReadStream } from "fs";
import { join } from "path";
import sqlite3 from 'sqlite3'; // Import sqlite3 from node-sqlite3

// Helper function to open the database with a Promise
function openDatabase(filename) {
    return new Promise((resolve, reject) => {
        // Use sqlite3.Database directly
        const db = new sqlite3.Database(filename, (err) => {
            if (err) {
                console.error('Error opening database', err);
                reject(err);
            } else {
                resolve(db);
            }
        });
    });
}

// Helper function to run a PRAGMA or SQL command with a Promise
// Using db.exec for potentially multiple statements, though PRAGMA is usually one.
// db.run could also be used for a single statement like PRAGMA. Let's stick with exec for robustness.
function execCommand(db, sql) {
    return new Promise((resolve, reject) => {
        db.exec(sql, (err) => {
            if (err) {
                console.error('Error executing command', sql, err);
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

// Helper function to get a single row result (useful for PRAGMA queries like journal_mode)
function getRow(db, sql) {
    return new Promise((resolve, reject) => {
        db.get(sql, (err, row) => {
            if (err) {
                console.error('Error getting row', sql, err);
                reject(err);
            } else {
                resolve(row);
            }
        });
    });
}


// Helper function to close the database with a Promise
function closeDatabase(db) {
    return new Promise((resolve, reject) => {
        db.close((err) => {
            if (err) {
                console.error('Error closing database', err);
                reject(err);
            } else {
                console.log("Database connection closed.");
                resolve();
            }
        });
    });
}


export async function GET(request) {
    const dbPath = join(process.cwd(), "db", "feature-tracker.db");
    let db = null; // Variable to hold the database connection

    try {
        console.log(`Attempting to open database at: ${dbPath}`);
        // Open the database connection using the Promise helper
        db = await openDatabase(dbPath);
        console.log("Database opened successfully.");

        // Check if the database is in WAL mode (optional but good practice)
        const journalModeResult = await getRow(db, 'PRAGMA journal_mode;');
        console.log(`Current journal mode: ${journalModeResult.journal_mode}`);

       if (journalModeResult.journal_mode !== 'wal') {
            console.warn("Database is not in WAL mode. Changing to WAL...");
            try {
                await execCommand(db, 'PRAGMA journal_mode=WAL;');
                console.log("Journal mode set to WAL.");
            } catch (walError) {
                console.error("Failed to set WAL mode:", walError);
            } finally {
                try {
                    await closeDatabase(db);
                    db = null;
                    db = await openDatabase(dbPath);
                } catch (reopenError) {
                    console.error("Failed to close and reopen database:", reopenError);
                    // Handle the error appropriately, possibly by rejecting the entire operation
                    throw reopenError; // Re-throw to ensure the outer catch block handles it
                }
            }
        }


        // Manually trigger a full WAL checkpoint using the Promise helper
        // This merges the WAL file into the main DB file
        console.log("Triggering WAL checkpoint...");
        await execCommand(db, 'PRAGMA wal_checkpoint(full);');
        console.log("WAL checkpoint triggered successfully.");

        // Close the database connection before reading the file
        // Use the closeDatabase Promise helper
        await closeDatabase(db);
        db = null; // Set to null to indicate the connection is closed


        console.log(`Creating read stream for database file: ${dbPath}`);
        // Now, read the main database file (which is now updated by the checkpoint)
        const fileStream = createReadStream(dbPath);

        return new Response(fileStream, {
            headers: {
                "Content-Type": "application/octet-stream",
                "Content-Disposition": `attachment; filename="feature-tracker.db"`,
            },
        });

    } catch (error) {
        console.error("Error processing database or downloading file:", error, { dbPath });

        // Ensure the database connection is closed if it was opened
        if (db) {
            try {
                // Use the closeDatabase Promise helper in error handling
                await closeDatabase(db);
            } catch (closeError) {
                console.error("Error closing database connection after initial error:", closeError);
            }
        }

        return new Response("Failed to process or download database file", { status: 500 });
    }
}