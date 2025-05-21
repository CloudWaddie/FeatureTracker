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

export async function getAllTables() {
    const currentDb = await getDb();
    if (!currentDb) throw new Error("Database connection not available.");
    return new Promise((resolve, reject) => {
        currentDb.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';", (err, rows) => {
            if (err) {
                console.error("Error fetching tables:", err.message);
                reject(err);
            } else {
                resolve(rows.map(row => row.name));
            }
        });
    });
}

export async function getTableInfo(tableName) {
    const currentDb = await getDb();
    if (!currentDb) throw new Error("Database connection not available.");
    return new Promise((resolve, reject) => {
        currentDb.all(`PRAGMA table_info(${tableName});`, (err, rows) => {
            if (err) {
                console.error(`Error fetching table info for ${tableName}:`, err.message);
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}

export async function getTableData(tableName) {
    const currentDb = await getDb();
    if (!currentDb) throw new Error("Database connection not available.");
    // Basic sanitization to prevent SQL injection, though PRAGMA table_info is generally safe.
    // For SELECT *, ensure tableName is validated against a list of known tables if possible.
    if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
        return Promise.reject(new Error("Invalid table name."));
    }

    let query = `SELECT * FROM ${tableName}`;
    // Add specific ordering for the 'feed' table
    if (tableName === 'feed') {
        query += " ORDER BY date DESC";
    }
    query += ";";

    return new Promise((resolve, reject) => {
        currentDb.all(query, (err, rows) => {
            if (err) {
                console.error(`Error fetching data for table ${tableName}:`, err.message);
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}

export async function updateTableData(tableName, rowId, column, value) {
    const currentDb = await getDb();
    if (!currentDb) throw new Error("Database connection not available.");

    // Basic validation
    if (!/^[a-zA-Z0-9_]+$/.test(tableName) || !/^[a-zA-Z0-9_]+$/.test(column)) {
        return Promise.reject(new Error("Invalid table or column name."));
    }
    // Further validation might be needed for rowId and value based on expected types

    // Assuming 'id' is the primary key column name for all tables.
    // This might need to be dynamic if primary key names vary.
    const sql = `UPDATE ${tableName} SET ${column} = ? WHERE id = ?`;

    return new Promise((resolve, reject) => {
        currentDb.run(sql, [value, rowId], function(err) {
            if (err) {
                console.error(`Error updating table ${tableName}:`, err.message);
                reject(err);
            } else {
                if (this.changes === 0) {
                     console.warn(`No rows updated in ${tableName} for id ${rowId}. Check if the ID exists.`);
                } else {
                    console.log(`Table ${tableName} updated successfully for id ${rowId}. Changes: ${this.changes}`);
                }
                resolve(this.changes);
            }
        });
    });
}

export async function hideFeedItem(itemId) {
    const currentDb = await getDb();
    if (!currentDb) throw new Error("Database connection not available.");
    return new Promise((resolve, reject) => {
        currentDb.run("UPDATE feed SET isHidden = 1 WHERE id = ?", [itemId], function(err) {
            if (err) {
                console.error("Error hiding feed item:", err.message);
                reject(err);
            } else {
                console.log(`Feed item ${itemId} hidden successfully. Changes: ${this.changes}`);
                resolve(this.changes);
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
        const errorMsg = "Database connection not available for updateOldSitemaps.";
        console.error(errorMsg);
        return Promise.reject(new Error(errorMsg));
    }
    if (!sites || !sites.sites || !Array.isArray(sites.sites) || typeof sites.url !== 'string') {
        const errorMsg = "Invalid input for updateOldSitemaps: Expected an object with a 'sites' array and a 'url' string.";
        console.error(errorMsg);
        return Promise.reject(new Error(errorMsg));
    }

    if (sites.sites.length === 0) {
        console.log("No old sitemap entries to process for updateOldSitemaps.");
        return Promise.resolve();
    }

    return Promise.all(
        sites.sites.map(site => {
            return new Promise((resolve, reject) => {
                if (!site || typeof site.loc !== 'string') {
                    console.warn("Skipping invalid old sitemap entry in updateOldSitemaps:", site);
                    return resolve(); // Resolve to not break Promise.all for one bad entry
                }
                currentDb.run("INSERT INTO oldSitemaps (siteURL, url, lastUpdated) VALUES (?, ?, ?)", [sites.url, site.loc, site.lastmod], function(err) {
                    if (err) {
                        console.error("Error updating old sitemaps entry:", err.message);
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });
        })
    );
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
        const errorMsg = "Database connection not available for updateNewSitemaps.";
        console.error(errorMsg);
        return Promise.reject(new Error(errorMsg));
    }
    if (!sites || !sites.sites || !Array.isArray(sites.sites) || typeof sites.url !== 'string') {
        const errorMsg = "Invalid input: Expected an object with a 'sites' array and a 'url' string.";
        console.error(errorMsg);
        return Promise.reject(new Error(errorMsg));
    }

    if (sites.sites.length === 0) {
        console.log("No new sitemap entries to process.");
        return Promise.resolve();
    }

    return Promise.all(
        sites.sites.map(site => {
            return new Promise((resolve, reject) => {
                if (!site || typeof site.loc !== 'string') {
                    console.warn("Skipping invalid sitemap entry:", site);
                    return resolve(); // Resolve to not break Promise.all for one bad entry, or reject if strictness is needed
                }
                currentDb.run("INSERT INTO newSitemaps (siteURL, url, lastUpdated) VALUES (?, ?, ?)", [sites.url, site.loc, site.lastmod], function(err) {
                    if (err) {
                        console.error("Error updating new sitemaps entry:", err.message);
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });
        })
    );
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

export async function findAdditionsSitemaps(url) {
    const currentDb = await getDb();
    if (!currentDb) throw new Error("Database connection not available.");
    return new Promise((resolve, reject) => {
        currentDb.all("SELECT * FROM newSitemaps WHERE url NOT IN (SELECT url FROM oldSitemaps WHERE siteURL = ?) AND siteURL = ?", [url, url], (err, rows) => {
            if (err) {
                console.error("Error finding additions:", err.message);
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}

export async function findDeletionsSitemaps(url) {
    const currentDb = await getDb();
    if (!currentDb) throw new Error("Database connection not available.");
    return new Promise((resolve, reject) => {
        currentDb.all("SELECT * FROM oldSitemaps WHERE url NOT IN (SELECT url FROM newSitemaps WHERE siteURL = ?) AND siteURL = ?", [url, url], (err, rows) => {
            if (err) {
                console.error("Error finding deletions:", err.message);
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}

export async function updateModels(models) {
    if (!Array.isArray(models)) {
        const errorMsg = "Invalid input: Expected an array of model objects.";
        console.error(errorMsg);
        return Promise.reject(new Error(errorMsg));
    }

    const db = await getDb();
    if (!db) {
        const errorMsg = "Database connection not available for updateModels.";
        console.error(errorMsg);
        return Promise.reject(new Error(errorMsg));
    }

    console.log(`Attempting to insert or replace ${models.length} model records...`);

    return new Promise((resolve, reject) => {
        db.serialize(() => { // Ensures sequential execution of transaction commands
            db.run("BEGIN TRANSACTION;", (err) => {
                if (err) {
                    console.error("Failed to begin transaction:", err.message);
                    return reject(err);
                }

                db.run("DELETE FROM sqlite_sequence where name='models'", (errSeq) => {
                    if (errSeq) {
                        console.error("Error resetting models sequence:", errSeq.message);
                        return db.run("ROLLBACK;", () => reject(errSeq));
                    }

                    db.run("DELETE FROM models", (errDel) => {
                        if (errDel) {
                            console.error("Error deleting models:", errDel.message);
                            return db.run("ROLLBACK;", () => reject(errDel));
                        }

                        if (models.length === 0) {
                            // If no models to insert, commit the deletions and resolve
                            return db.run("COMMIT;", (commitErr) => {
                                if (commitErr) {
                                    console.error("Failed to commit transaction after clearing models:", commitErr.message);
                                    return db.run("ROLLBACK;", () => reject(commitErr));
                                }
                                console.log("Models table cleared successfully as no new models were provided.");
                                resolve();
                            });
                        }
                        
                        const insertPromises = models.map(model => {
                            return new Promise((resolveInsert, rejectInsert) => {
                                const sql = `
                                    INSERT INTO models (
                                        id, modelApiId, publicId, provider, providerId, name,
                                        multiModal, supportsStructuredOutput, baseSampleWeight, isPrivate, newModel
                                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
                                `;
                                const values = [
                                    model.id || null, model.modelApiId || null, model.publicId || null,
                                    model.provider || null, model.providerId || null, model.name || null,
                                    model.multiModal !== undefined ? model.multiModal : null,
                                    model.supportsStructuredOutput !== undefined ? model.supportsStructuredOutput : null,
                                    model.baseSampleWeight !== undefined ? model.baseSampleWeight : null,
                                    model.isPrivate !== undefined ? model.isPrivate : null,
                                    model.newModel !== undefined ? model.newModel : null
                                ];
                                db.run(sql, values, function(insertErr) {
                                    if (insertErr) {
                                        console.error(`Error processing model ${model.id || 'unknown'}:`, insertErr.message);
                                        rejectInsert(insertErr);
                                    } else {
                                        // console.log(`Successfully processed model: ${model.id}`); // Optional: too verbose for many models
                                        resolveInsert();
                                    }
                                });
                            });
                        });

                        Promise.all(insertPromises)
                            .then(() => {
                                db.run("COMMIT;", (commitErr) => {
                                    if (commitErr) {
                                        console.error("Failed to commit transaction:", commitErr.message);
                                        db.run("ROLLBACK;", () => reject(commitErr));
                                    } else {
                                        console.log("Finished processing all model records successfully.");
                                        resolve();
                                    }
                                });
                            })
                            .catch(insertError => {
                                console.error("Error during model inserts, rolling back:", insertError.message);
                                db.run("ROLLBACK;", () => reject(insertError));
                            });
                    });
                });
            });
        });
    });
}

export async function getModels() {
    const currentDb = await getDb();
    if (!currentDb) throw new Error("Database connection not available.");
    return new Promise((resolve, reject) => {
        currentDb.all("SELECT * FROM models", (err, rows) => {
            if (err) {
                console.error("Error fetching models:", err.message);
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}

export async function compareModels(newModelList) {
    const currentDb = await getDb();
    if (!currentDb) throw new Error("Database connection not available.");
    return new Promise((resolve, reject) => {
        currentDb.all("SELECT * FROM models", (err, rows) => {
            if (err) {
                console.error("Error fetching models:", err.message);
                reject(err);
            } else {
                const oldModelList = rows;
                const additions = newModelList.filter(newModel => !oldModelList.some(oldModel => oldModel.id === newModel.id));
                const deletions = oldModelList.filter(oldModel => !newModelList.some(newModel => newModel.id === oldModel.id));
                resolve({ additions, deletions });
            }
        });
    });
}

export async function getMiscData(type) {
    const currentDb = await getDb();
    if (!currentDb) throw new Error("Database connection not available.");
    return new Promise((resolve, reject) => {
        currentDb.all("SELECT * FROM misc WHERE type = ?", [type], (err, rows) => {
            if (err) {
                console.error("Error fetching misc data:", err.message);
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}

export async function updateMiscData(type, value) {
    const currentDb = await getDb();
    if (!currentDb) throw new Error("Database connection not available.");
    return new Promise((resolve, reject) => {
        currentDb.run("INSERT INTO misc (type, value) VALUES (?, ?) ON CONFLICT(type) DO UPDATE SET value = excluded.value;", [type, value], function(err) {
            if (err) {
                console.error("Error updating misc data:", err.message);
                reject(err);
            } else {
                console.log("Misc data updated successfully:", this.changes);
                resolve(this.changes);
            }
        });
    });
}

export async function updateOldFeeds(feeds) {
    const currentDb = await getDb();
    if (!currentDb) {
        const errorMsg = "Database connection not available for updateOldFeeds.";
        console.error(errorMsg);
        return Promise.reject(new Error(errorMsg));
    }
    if (!feeds || !feeds.items || !Array.isArray(feeds.items) || typeof feeds.link !== 'string') {
        const errorMsg = "Invalid input for updateOldFeeds: Expected an object with an 'items' array and a 'link' string.";
        console.error(errorMsg);
        return Promise.reject(new Error(errorMsg));
    }

    if (feeds.items.length === 0) {
        console.log("No old feed items to process for updateOldFeeds.");
        return Promise.resolve();
    }

    return Promise.all(
        feeds.items.map(item => {
            return new Promise((resolve, reject) => {
                if (!item || typeof item.link !== 'string' || typeof item.pubDate === 'undefined') {
                    console.warn("Skipping invalid old feed item in updateOldFeeds:", item);
                    return resolve(); // Resolve to not break Promise.all for one bad entry
                }
                const pubDateTimestamp = Math.floor((new Date(item.pubDate)).getTime() / 1000);
                if (isNaN(pubDateTimestamp)) {
                    console.warn("Skipping old feed item with invalid pubDate in updateOldFeeds:", item);
                    return resolve();
                }
                currentDb.run("INSERT INTO oldFeeds (siteURL, url, lastUpdated) VALUES (?, ?, ?)", [feeds.link, item.link, pubDateTimestamp], function(err) {
                    if (err) {
                        console.error("Error updating old feeds entry:", err.message);
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });
        })
    );
}

export async function clearOldFeedsByURL(url) {
    const currentDb = await getDb();
    if (!currentDb) throw new Error("Database connection not available.");
    return new Promise((resolve, reject) => {
        currentDb.serialize(() => {
            currentDb.run("DELETE FROM sqlite_sequence where name='oldFeeds'", function(err) {
                if (err) {
                    console.error("Error resetting old feeds sequence:", err.message);
                    // Don't reject here, main operation is deleting from oldFeeds
                } else {
                    console.log("Old feeds sequence reset successfully");
                }
            });
            currentDb.run("DELETE FROM oldFeeds WHERE siteURL = ?", [url], function(err) {
                if (err) {
                    console.error("Error clearing old feeds by URL:", err.message);
                    reject(err);
                } else {
                    console.log("Old feeds cleared successfully!");
                    resolve(this.changes);
                }
            });
        });
    });
}

export async function getOldFeedsByURL(url) {
    const currentDb = await getDb();
    if (!currentDb) throw new Error("Database connection not available.");
    return new Promise((resolve, reject) => {
        currentDb.all("SELECT * FROM oldFeeds WHERE siteURL = ?", [url], (err, rows) => {
            if (err) {
                console.error("Error fetching old feeds by URL:", err.message);
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}

export async function updateNewFeeds(feeds) {
    const currentDb = await getDb();
    if (!currentDb) {
        const errorMsg = "Database connection not available for updateNewFeeds.";
        console.error(errorMsg);
        return Promise.reject(new Error(errorMsg));
    }
    if (!feeds || !feeds.items || !Array.isArray(feeds.items) || typeof feeds.link !== 'string') {
        const errorMsg = "Invalid input for updateNewFeeds: Expected an object with an 'items' array and a 'link' string.";
        console.error(errorMsg);
        return Promise.reject(new Error(errorMsg));
    }

    if (feeds.items.length === 0) {
        console.log("No new feed items to process for updateNewFeeds.");
        return Promise.resolve();
    }

    return Promise.all(
        feeds.items.map(item => {
            return new Promise((resolve, reject) => {
                if (!item || typeof item.link !== 'string' || typeof item.pubDate === 'undefined') {
                    console.warn("Skipping invalid new feed item in updateNewFeeds:", item);
                    return resolve(); // Resolve to not break Promise.all for one bad entry
                }
                const pubDateTimestamp = Math.floor((new Date(item.pubDate)).getTime() / 1000);
                if (isNaN(pubDateTimestamp)) {
                    console.warn("Skipping new feed item with invalid pubDate in updateNewFeeds:", item);
                    return resolve();
                }
                currentDb.run("INSERT INTO newFeeds (siteURL, url, lastUpdated) VALUES (?, ?, ?)", [feeds.link, item.link, pubDateTimestamp], function(err) {
                    if (err) {
                        console.error("Error updating new feeds entry:", err.message);
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });
        })
    );
}

export async function clearNewFeedsByURL(url) {
    const currentDb = await getDb();
    if (!currentDb) throw new Error("Database connection not available.");
    return new Promise((resolve, reject) => {
        currentDb.serialize(() => {
            currentDb.run("DELETE FROM sqlite_sequence where name='newFeeds'", function(err) {
                if (err) {
                    console.error("Error resetting new feeds sequence:", err.message);
                    // Don't reject here, main operation is deleting from newFeeds
                } else {
                    console.log("New feeds sequence reset successfully");
                }
            });
            currentDb.run("DELETE FROM newFeeds WHERE siteURL = ?", [url], function(err) {
                if (err) {
                    console.error("Error clearing new feeds by URL:", err.message);
                    reject(err);
                } else {
                    console.log("New feeds cleared successfully!");
                    resolve(this.changes);
                }
            });
        });
    });
}

export async function findAdditionsFeeds(url) {
    const currentDb = await getDb();
    if (!currentDb) throw new Error("Database connection not available.");
    return new Promise((resolve, reject) => {
        currentDb.all("SELECT * FROM newFeeds WHERE url NOT IN (SELECT url FROM oldFeeds WHERE siteURL = ?) AND siteURL = ?", [url, url], (err, rows) => {
            if (err) {
                console.error("Error finding additions:", err.message);
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}

export async function findDeletionsFeeds(url) {
    const currentDb = await getDb();
    if (!currentDb) throw new Error("Database connection not available.");
    return new Promise((resolve, reject) => {
        currentDb.all("SELECT * FROM oldFeeds WHERE url NOT IN (SELECT url FROM newFeeds WHERE siteURL = ?) AND siteURL = ?", [url, url], (err, rows) => {
            if (err) {
                console.error("Error finding deletions:", err.message);
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}
