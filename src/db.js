
import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const file = path.join(__dirname, "../data/db.json");

const adapter = new JSONFile(file);

const defaultData = {
  users: [],
  items: [],
  outfits: [],
};

export const db = new Low(adapter, defaultData);

export async function initDb() {
  await db.read();
  if (!db.data) {
    db.data = structuredClone(defaultData);
    await db.write();
  }
}
