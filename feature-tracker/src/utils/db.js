import sqlite3 from "sqlite3";
import path from "path";
import process from "process";
import logger from '../lib/logger.js'; // Added logger import
import { GoogleGenAI } from "@google/genai";

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
                logger.error({ err }, "Error opening database");
                dbInitializationPromise = null; // Reset promise so next call can try again
                reject(err);
                return;
            }

            logger.info("Connected to the SQLite database.");
            newDb.run("PRAGMA journal_mode = WAL;", (walErr) => {
                if (walErr) {
                    logger.error({ err: walErr }, "Failed to enable WAL mode");
                    // Proceed even if WAL fails, but log it. Concurrency issues might persist.
                } else {
                    logger.info("WAL mode enabled.");
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
    logger.error({ err }, "Initial database connection failed");
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

export async function getFeed(page = 1, showHidden = false, searchQuery = null, filterType = null) {
    const currentDb = await getDb();
    if (!currentDb) throw new Error("Database connection not available.");
    return new Promise((resolve, reject) => {
        const offset = (page - 1) * ITEMS_PER_PAGE;
        let query = "SELECT * FROM feed";
        const params = [];
        let conditions = [];

        if (!showHidden) {
            conditions.push("(isHidden = 0)");
        } else {
            conditions.push("(isHidden = 1 OR isHidden = 0)"); // Or simply don't add isHidden to conditions if showHidden means show all
        }

        if (filterType) {
            if (Array.isArray(filterType) && filterType.length > 0) {
                const placeholders = filterType.map(() => '?').join(',');
                conditions.push(`type IN (${placeholders})`);
                params.push(...filterType);
            } else if (typeof filterType === 'string') {
                conditions.push("type = ?");
                params.push(filterType);
            }
        }

        if (searchQuery) {
            conditions.push("(details LIKE ? OR appId LIKE ? OR type LIKE ?)");
            const searchTerm = `%${searchQuery}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }

        if (conditions.length > 0) {
            query += " WHERE " + conditions.join(" AND ");
        }

        query += " ORDER BY date DESC LIMIT ? OFFSET ?";
        params.push(ITEMS_PER_PAGE, offset);

        currentDb.all(query, params, (err, rows) => {
            if (err) {
                logger.error({ err, query, params }, "Error fetching feed");
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
                logger.error({ err }, "Error fetching tables");
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
                logger.error({ err, tableName }, `Error fetching table info for ${tableName}`);
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
                logger.error({ err, tableName }, `Error fetching data for table ${tableName}`);
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
                logger.error({ err, tableName, rowId, column }, `Error updating table ${tableName}`);
                reject(err);
            } else {
                if (this.changes === 0) {
                     logger.warn({ tableName, rowId }, `No rows updated in ${tableName} for id ${rowId}. Check if the ID exists.`);
                } else {
                    logger.info({ tableName, rowId, changes: this.changes }, `Table ${tableName} updated successfully for id ${rowId}.`);
                }
                resolve(this.changes);
            }
        });
    });
}

export async function hideFeedItem(itemId, isHidden) {
    const currentDb = await getDb();
    if (!currentDb) throw new Error("Database connection not available.");
    return new Promise((resolve, reject) => {
        currentDb.run("UPDATE feed SET isHidden = ? WHERE id = ?", [isHidden ? 1 : 0, itemId], function(err) {
            if (err) {
                logger.error({ err, itemId, isHidden }, "Error updating feed item visibility");
                reject(err);
            } else {
                logger.info({ itemId, isHidden, changes: this.changes }, `Feed item ${itemId} visibility updated to ${isHidden}.`);
                resolve(this.changes);
            }
        });
    });
}

export async function getTotalPages(showHidden, searchQuery = null, filterType = null) {
    const currentDb = await getDb();
    if (!currentDb) throw new Error("Database connection not available.");
    return new Promise((resolve, reject) => {
        let query = "SELECT COUNT(*) as count FROM feed";
        const params = [];
        let conditions = [];

        if (!showHidden) {
            conditions.push("(isHidden = 0)");
        } else {
            conditions.push("(isHidden = 1 OR isHidden = 0)");
        }

        if (filterType) {
            if (Array.isArray(filterType) && filterType.length > 0) {
                const placeholders = filterType.map(() => '?').join(',');
                conditions.push(`type IN (${placeholders})`);
                params.push(...filterType);
            } else if (typeof filterType === 'string') {
                conditions.push("type = ?");
                params.push(filterType);
            }
        }

        if (searchQuery) {
            conditions.push("(details LIKE ? OR appId LIKE ? OR type LIKE ?)");
            const searchTerm = `%${searchQuery}%`;
            params.push(searchTerm, searchTerm, searchTerm);
        }

        if (conditions.length > 0) {
            query += " WHERE " + conditions.join(" AND ");
        }

        currentDb.get(query, params, (err, row) => {
            if (err) {
                logger.error({ err, query, params, showHidden }, "Error fetching total item count");
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
                logger.error({ err, appId }, "Error fetching last updated date");
                reject(err);
            } else {
                resolve(row ? row.lastUpdated : null);
            }
        });
    });
}

export async function updateFeed(data) {
    // We need to generate a summary of what changed using the Gemini API
    let summary = "";
    const genAI = new GoogleGenAI({apiKey: process.env.GEMINI_API_KEY});
    if (!genAI) {
        summary = "No summary available. Gemini API error.";
        logger.error("Gemini API client not initialized. Summary generation skipped.");
    }
    else {
        try {
            const response = await genAI.models.generateContent({
                model: "gemini-2.0-flash",
                contents: `You are being used to generate summaries in an automated app that finds upcoming or newly released updates to AI apps. Generate a concise summary of the following feed update. You should tell the user what changed, based on the provided information: ${JSON.stringify(data)}`,
            });
            summary = response.text || "No summary generated.";
        } catch (error) {
            logger.error({ error, data }, "Error generating summary with Gemini API");
            summary = "No summary available. Gemini API error. ";
        }
    }
    data.summary = summary; // Add the generated summary to the data object
    const currentDb = await getDb();
    if (!currentDb) throw new Error("Database connection not available.");
    return new Promise((resolve, reject) => {
        currentDb.run("INSERT INTO feed (type, details, appId, date, summary) VALUES (?, ?, ?, ?, ?)", [data.type, data.details, data.appId, Date.now(), data.summary], function(err) {
            if (err) {
                logger.error({ err, data }, "Error updating feed");
                reject(err);
            } else {
                logger.info({ lastID: this.lastID }, "Feed updated successfully");
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
                logger.error({ err, appId, lastUpdated }, "Error updating last updated date");
                reject(err);
            } else {
                logger.info({ changes: this.changes }, "Last updated date updated successfully");
                resolve(this.changes);
            }
        });
    });
}

export async function updateOldSitemaps(sites) {
    const currentDb = await getDb();
    if (!currentDb) {
        const errorMsg = "Database connection not available for updateOldSitemaps.";
        logger.error(errorMsg);
        return Promise.reject(new Error(errorMsg));
    }
    if (!sites || !sites.sites || !Array.isArray(sites.sites) || typeof sites.url !== 'string') {
        const errorMsg = "Invalid input for updateOldSitemaps: Expected an object with a 'sites' array and a 'url' string.";
        logger.error({ errorMsg, sites });
        return Promise.reject(new Error(errorMsg));
    }

    if (sites.sites.length === 0) {
        logger.info("No old sitemap entries to process for updateOldSitemaps.");
        return Promise.resolve();
    }

    // Use INSERT OR IGNORE to merge new entries into the persistent historical store
    // This ensures the oldSitemaps table becomes cumulative rather than being overwritten
    return Promise.all(
        sites.sites.map(site => {
            return new Promise((resolve, reject) => {
                if (!site || typeof site.loc !== 'string') {
                    logger.warn({ site }, "Skipping invalid old sitemap entry in updateOldSitemaps");
                    return resolve(); // Resolve to not break Promise.all for one bad entry
                }
                // Use INSERT OR IGNORE to avoid duplicates while maintaining cumulative storage
                currentDb.run("INSERT OR IGNORE INTO oldSitemaps (siteURL, url, lastUpdated) VALUES (?, ?, ?)", [sites.url, site.loc, site.lastmod], function(err) {
                    if (err) {
                        logger.error({ err, siteURL: sites.url, siteLoc: site.loc }, "Error updating old sitemaps entry");
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });
        })
    );
}


export async function getOldSitemapsByURL(url) {
    const currentDb = await getDb();
    if (!currentDb) throw new Error("Database connection not available.");
    return new Promise((resolve, reject) => {
        currentDb.all("SELECT * FROM oldSitemaps WHERE siteURL = ?", [url], (err, rows) => {
            if (err) {
                logger.error({ err, url }, "Error fetching old sitemaps by URL");
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
        logger.error(errorMsg);
        return Promise.reject(new Error(errorMsg));
    }
    if (!sites || !sites.sites || !Array.isArray(sites.sites) || typeof sites.url !== 'string') {
        const errorMsg = "Invalid input: Expected an object with a 'sites' array and a 'url' string.";
        logger.error({ errorMsg, sites });
        return Promise.reject(new Error(errorMsg));
    }

    if (sites.sites.length === 0) {
        logger.info("No new sitemap entries to process.");
        return Promise.resolve();
    }

    return Promise.all(
        sites.sites.map(site => {
            return new Promise((resolve, reject) => {
                if (!site || typeof site.loc !== 'string') {
                    logger.warn({ site }, "Skipping invalid sitemap entry");
                    return resolve(); // Resolve to not break Promise.all for one bad entry, or reject if strictness is needed
                }
                currentDb.run("INSERT INTO newSitemaps (siteURL, url, lastUpdated) VALUES (?, ?, ?)", [sites.url, site.loc, site.lastmod], function(err) {
                    if (err) {
                        logger.error({ err, siteURL: sites.url, siteLoc: site.loc }, "Error updating new sitemaps entry");
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
                    logger.error({ err }, "Error resetting new sitemaps sequence");
                    // Don't reject here, main operation is deleting from newSitemaps
                } else {
                    logger.info("New sitemaps sequence reset successfully");
                }
            });
            currentDb.run("DELETE FROM newSitemaps WHERE siteURL = ?", [url], function(err) {
                if (err) {
                    logger.error({ err, url }, "Error clearing new sitemaps by URL");
                    reject(err);
                } else {
                    logger.info({ changes: this.changes }, "New sitemaps cleared successfully!");
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
                logger.error({ err, url }, "Error fetching new sitemaps by URL");
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
                logger.error({ err, url }, "Error finding additions sitemaps");
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
        logger.error({ errorMsg, models });
        return Promise.reject(new Error(errorMsg));
    }

    const db = await getDb();
    if (!db) {
        const errorMsg = "Database connection not available for updateModels.";
        logger.error(errorMsg);
        return Promise.reject(new Error(errorMsg));
    }

    logger.info(`Attempting to insert or replace ${models.length} model records...`);

    return new Promise((resolve, reject) => {
        db.serialize(() => { // Ensures sequential execution of transaction commands
            db.run("BEGIN TRANSACTION;", (err) => {
                if (err) {
                    logger.error({ err }, "Failed to begin transaction");
                    return reject(err);
                }

                db.run("DELETE FROM sqlite_sequence where name='models'", (errSeq) => {
                    if (errSeq) {
                        logger.error({ err: errSeq }, "Error resetting models sequence");
                        return db.run("ROLLBACK;", () => reject(errSeq));
                    }

                    db.run("DELETE FROM models", (errDel) => {
                        if (errDel) {
                            logger.error({ err: errDel }, "Error deleting models");
                            return db.run("ROLLBACK;", () => reject(errDel));
                        }

                        if (models.length === 0) {
                            // If no models to insert, commit the deletions and resolve
                            return db.run("COMMIT;", (commitErr) => {
                                if (commitErr) {
                                    logger.error({ err: commitErr }, "Failed to commit transaction after clearing models");
                                    return db.run("ROLLBACK;", () => reject(commitErr));
                                }
                                logger.info("Models table cleared successfully as no new models were provided.");
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
                                        logger.error({ err: insertErr, modelId: model.id || 'unknown' }, `Error processing model`);
                                        rejectInsert(insertErr);
                                    } else {
                                        // logger.debug({ modelId: model.id }, `Successfully processed model`); // Optional: too verbose for many models
                                        resolveInsert();
                                    }
                                });
                            });
                        });

                        Promise.all(insertPromises)
                            .then(() => {
                                db.run("COMMIT;", (commitErr) => {
                                    if (commitErr) {
                                        logger.error({ err: commitErr }, "Failed to commit transaction");
                                        db.run("ROLLBACK;", () => reject(commitErr));
                                    } else {
                                        logger.info("Finished processing all model records successfully.");
                                        resolve();
                                    }
                                });
                            })
                            .catch(insertError => {
                                logger.error({ err: insertError }, "Error during model inserts, rolling back");
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
                logger.error({ err }, "Error fetching models");
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
                logger.error({ err }, "Error fetching models for comparison");
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
                logger.error({ err, type }, "Error fetching misc data");
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
                logger.error({ err, type, value }, "Error updating misc data");
                reject(err);
            } else {
                logger.info({ changes: this.changes }, "Misc data updated successfully");
                resolve(this.changes);
            }
        });
    });
}

export async function updateOldFeeds(feeds) {
    const currentDb = await getDb();
    if (!currentDb) {
        const errorMsg = "Database connection not available for updateOldFeeds.";
        logger.error(errorMsg);
        return Promise.reject(new Error(errorMsg));
    }
    if (!feeds || !feeds.items || !Array.isArray(feeds.items) || typeof feeds.link !== 'string') {
        const errorMsg = "Invalid input for updateOldFeeds: Expected an object with an 'items' array and a 'link' string.";
        logger.error({ errorMsg, feeds });
        return Promise.reject(new Error(errorMsg));
    }

    if (feeds.items.length === 0) {
        logger.info("No old feed items to process for updateOldFeeds.");
        return Promise.resolve();
    }

    // Use INSERT OR IGNORE to merge new entries into the persistent historical store
    // This ensures the oldFeeds table becomes cumulative rather than being overwritten
    return Promise.all(
        feeds.items.map(item => {
            return new Promise((resolve, reject) => {
                if (!item || typeof item.link !== 'string' || typeof item.pubDate === 'undefined') {
                    logger.warn({ item }, "Skipping invalid old feed item in updateOldFeeds");
                    return resolve(); // Resolve to not break Promise.all for one bad entry
                }
                const pubDateTimestamp = Math.floor((new Date(item.pubDate)).getTime() / 1000);
                if (isNaN(pubDateTimestamp)) {
                    logger.warn({ item, pubDate: item.pubDate }, "Skipping old feed item with invalid pubDate in updateOldFeeds");
                    return resolve();
                }
                // Use INSERT OR IGNORE to avoid duplicates while maintaining cumulative storage
                currentDb.run("INSERT OR IGNORE INTO oldFeeds (siteURL, url, lastUpdated) VALUES (?, ?, ?)", [feeds.link, item.link, pubDateTimestamp], function(err) {
                    if (err) {
                        logger.error({ err, siteURL: feeds.link, itemLink: item.link }, "Error updating old feeds entry");
                        reject(err);
                    } else {
                        resolve();
                    }
                });
            });
        })
    );
}


export async function getOldFeedsByURL(url) {
    const currentDb = await getDb();
    if (!currentDb) throw new Error("Database connection not available.");
    return new Promise((resolve, reject) => {
        currentDb.all("SELECT * FROM oldFeeds WHERE siteURL = ?", [url], (err, rows) => {
            if (err) {
                logger.error({ err, url }, "Error fetching old feeds by URL");
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
        logger.error(errorMsg);
        return Promise.reject(new Error(errorMsg));
    }
    if (!feeds || !feeds.items || !Array.isArray(feeds.items) || typeof feeds.link !== 'string') {
        const errorMsg = "Invalid input for updateNewFeeds: Expected an object with an 'items' array and a 'link' string.";
        logger.error({ errorMsg, feeds });
        return Promise.reject(new Error(errorMsg));
    }

    if (feeds.items.length === 0) {
        logger.info("No new feed items to process for updateNewFeeds.");
        return Promise.resolve();
    }

    return Promise.all(
        feeds.items.map(item => {
            return new Promise((resolve, reject) => {
                if (!item || typeof item.link !== 'string' || typeof item.pubDate === 'undefined') {
                    logger.warn({ item }, "Skipping invalid new feed item in updateNewFeeds");
                    return resolve(); // Resolve to not break Promise.all for one bad entry
                }
                const pubDateTimestamp = Math.floor((new Date(item.pubDate)).getTime() / 1000);
                if (isNaN(pubDateTimestamp)) {
                    logger.warn({ item, pubDate: item.pubDate }, "Skipping new feed item with invalid pubDate in updateNewFeeds");
                    return resolve();
                }
                currentDb.run("INSERT INTO newFeeds (siteURL, url, lastUpdated) VALUES (?, ?, ?)", [feeds.link, item.link, pubDateTimestamp], function(err) {
                    if (err) {
                        logger.error({ err, siteURL: feeds.link, itemLink: item.link }, "Error updating new feeds entry");
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
                    logger.error({ err }, "Error resetting new feeds sequence");
                    // Don't reject here, main operation is deleting from newFeeds
                } else {
                    logger.info("New feeds sequence reset successfully");
                }
            });
            currentDb.run("DELETE FROM newFeeds WHERE siteURL = ?", [url], function(err) {
                if (err) {
                    logger.error({ err, url }, "Error clearing new feeds by URL");
                    reject(err);
                } else {
                    logger.info({ changes: this.changes }, "New feeds cleared successfully!");
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
                logger.error({ err, url }, "Error finding additions feeds");
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}


export async function hideFeedByCategory(category, hide = true) {
    const currentDb = await getDb();
    if (!currentDb) throw new Error("Database connection not available.");
    const isHiddenValue = hide ? 1 : 0;
    return new Promise((resolve, reject) => {
        currentDb.run("UPDATE feed SET isHidden = ? WHERE type = ?", [isHiddenValue, category], function(err) {
            if (err) {
                logger.error({ err, category, hide }, `Error ${hide ? "hiding" : "showing"} feed by category`);
                reject(err);
            } else {
                logger.info({ category, hide, changes: this.changes }, `Feed items of category ${category} ${hide ? "hidden" : "shown"} successfully.`);
                resolve(this.changes);
            }
        });
    });
}

export async function getFeedItem(id) {
    const currentDb = await getDb();
    if (!currentDb) throw new Error("Database connection not available.");
    return new Promise((resolve, reject) => {
        currentDb.get("SELECT * FROM feed WHERE id = ?", [id], (err, row) => {
            if (err) {
                logger.error({ err, id }, "Error fetching feed item");
                reject(err);
            } else {
                resolve(row);
            }
        });
    });
}

export async function getAllApps() {
    const currentDb = await getDb();
    if (!currentDb) throw new Error("Database connection not available.");
    
    return new Promise((resolve, reject) => {
        currentDb.all("SELECT appId FROM appVersions", (err, rows) => {
            if (err) {
                logger.error({ err }, "Error fetching Android apps"); // Note: Original comment said "Android apps", kept for consistency but might be generic apps
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}
