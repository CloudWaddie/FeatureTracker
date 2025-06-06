import sqlite3 from "sqlite3";
import path from "path";
import fs from "fs";
import process from "process";
import { NextResponse } from "next/server";
import logger from "@/lib/logger";

export async function GET(request) {
    const projectRoot = process.cwd(); // Get the current working directory
    const dbDir = path.join(projectRoot, "db");
    const dbPath = path.join(dbDir, "feature-tracker.db");
    logger.info("Database path:", dbPath);
    if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
    logger.info(`Created directory: ${dbDir}`);
    }

    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE);

    logger.info("Database connection established.");

    // Function to create the table if it doesn't exist
    function createTableIfNotExists() {
        db.serialize(() => {
            db.run(`
            CREATE TABLE IF NOT EXISTS feed (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                type TEXT NOT NULL,
                details TEXT NOT NULL,
                appId TEXT NOT NULL,
                date INTEGER NOT NULL,
                isHidden INTEGER DEFAULT 0,
                summary TEXT NOT NULL DEFAULT 'Error. Summary not generated.',
            )
            `, (err) => {
            if (err) {
                logger.error("Error creating table:", err.message);
            } else {
                logger.info("feed table created or already exists.");
            }
            });
            db.run(`
                CREATE TABLE IF NOT EXISTS appVersions (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    appId TEXT NOT NULL UNIQUE,
                    lastUpdated TEXT NOT NULL
                )
            `, (err) => {
                if (err) {
                    logger.error("Error creating appVersions table:", err.message);
                } else {
                    logger.info("appVersions table created or already exists.");
                }
            });
            db.run("CREATE INDEX IF NOT EXISTS idx_feed_date ON feed (date);", (err) => {
                if (err) {
                    logger.error("Error creating index on feed table:", err.message);
                } else {
                    logger.info("Index on feed table created or already exists.");
                }
            }
            );
            db.run("CREATE TABLE IF NOT EXISTS oldSitemaps (id INTEGER PRIMARY KEY AUTOINCREMENT, siteURL TEXT NOT NULL, url TEXT NOT NULL, lastUpdated INTEGER);", (err) => {
                if (err) {
                    logger.error("Error creating oldSitemaps table:", err.message);
                } else {
                    logger.info("oldSitemaps table created or already exists.");
                }
            }
            );
            db.run("CREATE TABLE IF NOT EXISTS newSitemaps (id INTEGER PRIMARY KEY AUTOINCREMENT, siteURL TEXT NOT NULL, url TEXT NOT NULL, lastUpdated INTEGER);", (err) => {
                if (err) {
                    logger.error("Error creating newSitemaps table:", err.message);
                } else {
                    logger.info("newSitemaps table created or already exists.");
                }
            }
            );
            db.run("CREATE TABLE IF NOT EXISTS models (id TEXT PRIMARY KEY, modelApiId TEXT NOT NULL, publicId TEXT, provider TEXT NOT NULL, providerId TEXT, name TEXT NOT NULL, multiModal BOOLEAN, supportsStructuredOutput BOOLEAN, baseSampleWeight INTEGER, isPrivate BOOLEAN, newModel BOOLEAN);", (err) => {
                if (err) {
                    logger.error("Error creating models table:", err.message);
                } else {
                    logger.info("models table created or already exists.");
                }
            }
            );
            db.run("CREATE TABLE IF NOT EXISTS misc (id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT NOT NULL UNIQUE, value TEXT NOT NULL);", (err) => {
                if (err) {
                    logger.error("Error creating misc table:", err.message);
                } else {
                    logger.info("misc table created or already exists.");
                }
            }
            );
            db.run("CREATE TABLE IF NOT EXISTS oldFeeds (id INTEGER PRIMARY KEY AUTOINCREMENT, siteURL TEXT NOT NULL, url TEXT NOT NULL, lastUpdated INTEGER);", (err) => {
                if (err) {
                    logger.error("Error creating oldFeeds table:", err.message);
                } else {
                    logger.info("oldFeeds table created or already exists.");
                }
            }
            );
            db.run("CREATE TABLE IF NOT EXISTS newFeeds (id INTEGER PRIMARY KEY AUTOINCREMENT, siteURL TEXT NOT NULL, url TEXT NOT NULL, lastUpdated INTEGER);", (err) => {
                if (err) {
                    logger.error("Error creating newFeeds table:", err.message);
                } else {
                    logger.info("newFeeds table created or already exists.");
                }
            }
            );
        });
    }

    // Check if the table exists and create it if not
    createTableIfNotExists();
    return new NextResponse("Database setup complete.", { status: 200 });
}
