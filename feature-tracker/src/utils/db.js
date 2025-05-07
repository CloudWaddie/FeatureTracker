import sqlite3 from "sqlite3";
import path from "path";
import fs from "fs";
import process from "process";

const projectRoot = process.cwd(); // Get the current working directory
const dbDir = path.join(projectRoot, "db");
const dbPath = path.join(dbDir, "feature-tracker.db");

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE);

export default function getFeed() {
    return new Promise((resolve, reject) => {
        db.all("SELECT * FROM feed", [], (err, rows) => {
            if (err) {
                console.error("Error fetching feed:", err.message);
                reject(err);
            } else {
                resolve(rows);
                console.log("Feed fetched successfully:", rows);
            }
        });
    });
}