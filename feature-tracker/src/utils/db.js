import sqlite3 from "sqlite3";
import path from "path";
import process from "process";

const projectRoot = process.cwd(); // Get the current working directory
const dbDir = path.join(projectRoot, "db");
const dbPath = path.join(dbDir, "feature-tracker.db");

let dbInstance = null; // Module-scoped database instance
let dbInitializationPromise = null; // Promise for ongoing initialization

const initializeDbConnection = () => {
    if (dbInstance && dbInstance.open) {
        return Promise.resolve(dbInstance);
    }

    if (dbInitializationPromise) {
        return dbInitializationPromise;
    }

    dbInitializationPromise = new Promise((resolve, reject) => {
        const newDb = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
            if (err) {
                console.error("Error opening database:", err.message);
                dbInitializationPromise = null; // Reset promise so next call can try again
                reject(err);
                return;
            }

            console.log("Connected to the SQLite database.");
            newDb.run("PRAGMA journal_mode = WAL;", (walErr) => {
                if (walErr) {
                    console.error("Failed to enable WAL mode:", walErr.message);
                    // Proceed even if WAL fails, but log it. Concurrency issues might persist.
                } else {
                    console.log("WAL mode enabled.");
                }
                dbInstance = newDb;
                resolve(dbInstance);
            });
        });
    });
    return dbInitializationPromise;
};

// Call initializeDbConnection when the module loads to start the process.
// Functions will await this promise.
initializeDbConnection().catch(err => {
    console.error("Initial database connection failed:", err.message);
    // Depending on the application's needs, you might want to handle this more gracefully,
    // e.g., by setting a flag that prevents operations until connection is successful.
});

const ITEMS_PER_PAGE = 12; // Number of items to fetch per page

async function getDb() {
    if (dbInstance && dbInstance.open) {
        return dbInstance;
    }
    // If dbInstance is not ready, await the initialization promise.
    // This handles cases where a function is called before initial connection completes.
    return initializeDbConnection();
}

export async function getFeed(page = 1) {
    const currentDb = await getDb();
    if (!currentDb) throw new Error("Database connection not available.");
    return new Promise((resolve, reject) => {
        const offset = (page - 1) * ITEMS_PER_PAGE;
        currentDb.all("SELECT * FROM feed ORDER BY date DESC LIMIT ? OFFSET ?", [ITEMS_PER_PAGE, offset], (err, rows) => {
            if (err) {
                console.error("Error fetching feed:", err.message);
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}

export async function getTotalPages() {
    const currentDb = await getDb();
    if (!currentDb) throw new Error("Database connection not available.");
    return new Promise((resolve, reject) => {
        currentDb.get("SELECT COUNT(*) as count FROM feed", (err, row) => {
            if (err) {
                console.error("Error fetching total item count:", err.message);
                reject(err);
            } else {
                const totalItems = row ? row.count : 0;
                if (ITEMS_PER_PAGE <= 0) {
                    resolve(0);
                    return;
                }
                const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
                resolve(totalPages);
            }
        });
    });
}

export async function getLastUpdated(appId) {
    const currentDb = await getDb();
    if (!currentDb) throw new Error("Database connection not available.");
    return new Promise((resolve, reject) => {
        currentDb.get("SELECT lastUpdated FROM appVersions WHERE appId = ?", [appId], (err, row) => {
            if (err) {
                console.error("Error fetching last updated date:", err.message);
                reject(err);
            } else {
                resolve(row ? row.lastUpdated : null);
            }
        });
    });
}

export async function updateFeed(data) {
    const currentDb = await getDb();
    if (!currentDb) throw new Error("Database connection not available.");
    return new Promise((resolve, reject) => {
        currentDb.run("INSERT INTO feed (type, details, appId, date) VALUES (?, ?, ?, ?)", [data.type, data.details, data.appId, Date.now()], function(err) {
            if (err) {
                console.error("Error updating feed:", err.message);
                reject(err);
            } else {
                console.log("Feed updated successfully:", this.lastID);
                resolve(this.lastID);
            }
        });
    });
}

export async function updateLastUpdated(appId, lastUpdated) {
    const currentDb = await getDb();
    if (!currentDb) throw new Error("Database connection not available.");
    return new Promise((resolve, reject) => {
        currentDb.run("INSERT INTO appVersions (appId, lastUpdated) VALUES (?, ?) ON CONFLICT(appId) DO UPDATE SET lastUpdated = excluded.lastUpdated;", [appId.toString(), lastUpdated], function(err) {
            if (err) {
                console.error("Error updating last updated date:", err.message);
                reject(err);
            } else {
                console.log("Last updated date updated successfully:", this.changes);
                resolve(this.changes);
            }
        });
    });
}

export async function updateOldSitemaps(sites) {
    const currentDb = await getDb();
    if (!currentDb) {
        console.error("Database connection not available for updateOldSitemaps.");
        return; // Or handle error appropriately
    }
    for (const site of sites.sites) {
        currentDb.run("INSERT INTO oldSitemaps (siteURL, url, lastUpdated) VALUES (?, ?, ?)", [sites.url, site.loc, site.lastmod], function(err) {
            if (err) {
                console.error("Error updating old sitemaps:", err.message);
            }
        });
    }
}

export async function clearOldSitemapsByURL(url) {
    const currentDb = await getDb();
    if (!currentDb) throw new Error("Database connection not available.");
    return new Promise((resolve, reject) => {
        currentDb.serialize(() => {
            currentDb.run("DELETE FROM sqlite_sequence where name='oldSitemaps'", function(err) {
                if (err) {
                    console.error("Error resetting old sitemaps sequence:", err.message);
                    // Don't reject here, main operation is deleting from oldSitemaps
                } else {
                    console.log("Old sitemaps sequence reset successfully");
                }
            });
            currentDb.run("DELETE FROM oldSitemaps WHERE siteURL = ?", [url], function(err) {
                if (err) {
                    console.error("Error clearing old sitemaps by URL:", err.message);
                    reject(err);
                } else {
                    console.log("Old sitemaps cleared successfully!");
                    resolve(this.changes);
                }
            });
        });
    });
}

export async function getOldSitemapsByURL(url) {
    const currentDb = await getDb();
    if (!currentDb) throw new Error("Database connection not available.");
    return new Promise((resolve, reject) => {
        currentDb.all("SELECT * FROM oldSitemaps WHERE siteURL = ?", [url], (err, rows) => {
            if (err) {
                console.error("Error fetching old sitemaps by URL:", err.message);
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}

export async function updateNewSitemaps(sites) {
    const currentDb = await getDb();
    if (!currentDb) {
        console.error("Database connection not available for updateNewSitemaps.");
        return; // Or handle error appropriately
    }
    for (const site of sites.sites) {
        currentDb.run("INSERT INTO newSitemaps (siteURL, url, lastUpdated) VALUES (?, ?, ?)", [sites.url, site.loc, site.lastmod], function(err) {
            if (err) {
                console.error("Error updatingnNew sitemaps:", err.message);
            }
        });
    }
}

export async function clearNewSitemapsByURL(url) {
    const currentDb = await getDb();
    if (!currentDb) throw new Error("Database connection not available.");
    return new Promise((resolve, reject) => {
        currentDb.serialize(() => {
            currentDb.run("DELETE FROM sqlite_sequence where name='newSitemaps'", function(err) {
                if (err) {
                    console.error("Error resetting new sitemaps sequence:", err.message);
                    // Don't reject here, main operation is deleting from newSitemaps
                } else {
                    console.log("New sitemaps sequence reset successfully");
                }
            });
            currentDb.run("DELETE FROM newSitemaps WHERE siteURL = ?", [url], function(err) {
                if (err) {
                    console.error("Error clearing new sitemaps by URL:", err.message);
                    reject(err);
                } else {
                    console.log("New sitemaps cleared successfully!");
                    resolve(this.changes);
                }
            });
        });
    });
}

export async function getNewSitemapsByURL(url) {
    const currentDb = await getDb();
    if (!currentDb) throw new Error("Database connection not available.");
    return new Promise((resolve, reject) => {
        currentDb.all("SELECT * FROM newSitemaps WHERE siteURL = ?", [url], (err, rows) => {
            if (err) {
                console.error("Error fetching new sitemaps by URL:", err.message);
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}

export async function findAdditions() {
    const currentDb = await getDb();
    if (!currentDb) throw new Error("Database connection not available.");
    return new Promise((resolve, reject) => {
        currentDb.all("SELECT * FROM newSitemaps WHERE url NOT IN (SELECT url FROM oldSitemaps)", (err, rows) => {
            if (err) {
                console.error("Error finding additions:", err.message);
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}

export async function findDeletions() {
    const currentDb = await getDb();
    if (!currentDb) throw new Error("Database connection not available.");
    return new Promise((resolve, reject) => {
        currentDb.all("SELECT * FROM oldSitemaps WHERE url NOT IN (SELECT url FROM newSitemaps)", (err, rows) => {
            if (err) {
                console.error("Error finding deletions:", err.message);
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}