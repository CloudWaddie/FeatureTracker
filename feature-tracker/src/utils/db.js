import sqlite3 from "sqlite3";
import path from "path";
import process from "process";

const projectRoot = process.cwd(); // Get the current working directory
const dbDir = path.join(projectRoot, "db");
const dbPath = path.join(dbDir, "feature-tracker.db");

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE);

export function getFeed() {
    return new Promise((resolve, reject) => {
        db.all("SELECT * FROM feed", [], (err, rows) => {
            if (err) {
                console.error("Error fetching feed:", err.message);
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
}

export function getLastUpdated(appId) {
    return new Promise((resolve, reject) => {
        db.get("SELECT lastUpdated FROM appVersions WHERE appId = ?", [appId], (err, row) => {
            if (err) {
                console.error("Error fetching last updated date:", err.message);
                reject(err);
            } else {
                resolve(row ? row.lastUpdated : null);
            }
        });
    });
}
// Add a new card to the feed through some JSON data
export function updateFeed(data){
    return new Promise((resolve, reject) => {
        db.run("INSERT INTO feed (type, details, appId, date) VALUES (?, ?, ?, ?)", [data.type, data.details, data.appId, Date.now()], function(err) {
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

export function updateLastUpdated(appId, lastUpdated) {
    return new Promise((resolve, reject) => {
        db.run("UPDATE appVersions SET lastUpdated = ? WHERE appId = ?", [lastUpdated, appId], function(err) {
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