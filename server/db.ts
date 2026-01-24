import { eq, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, documents, documentPermissions, documentVersions, userPresence, documentHistory } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// Document queries
export async function createDocument(title: string, ownerId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(documents).values({
    title,
    ownerId,
    content: "",
  });
  
  return result;
}

export async function getDocument(documentId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.select().from(documents).where(eq(documents.id, documentId)).limit(1);
  return result.length > 0 ? result[0] : null;
}

export async function updateDocumentContent(documentId: number, content: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.update(documents).set({ content }).where(eq(documents.id, documentId));
}

export async function getUserDocuments(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.select().from(documents).where(eq(documents.ownerId, userId));
}

// Permission queries
export async function grantPermission(documentId: number, userId: number, role: "view" | "edit" | "admin", grantedBy: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.insert(documentPermissions).values({
    documentId,
    userId,
    role,
    grantedBy,
  });
}

export async function getUserPermission(documentId: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.select().from(documentPermissions).where(
    and(eq(documentPermissions.documentId, documentId), eq(documentPermissions.userId, userId))
  ).limit(1);
  
  return result.length > 0 ? result[0] : null;
}

// Version queries
export async function createVersion(documentId: number, content: string, createdBy: number, description?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Get the latest version number
  const latestVersion = await db.select().from(documentVersions)
    .where(eq(documentVersions.documentId, documentId))
    .orderBy((t) => t.versionNumber)
    .limit(1);
  
  const versionNumber = (latestVersion[0]?.versionNumber ?? 0) + 1;
  
  return await db.insert(documentVersions).values({
    documentId,
    versionNumber,
    content,
    createdBy,
    description,
  });
}

export async function getDocumentVersions(documentId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.select().from(documentVersions).where(eq(documentVersions.documentId, documentId));
}

// Presence queries
export async function updatePresence(userId: number, documentId: number, cursorPosition: number, isTyping: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const existing = await db.select().from(userPresence).where(
    and(eq(userPresence.userId, userId), eq(userPresence.documentId, documentId))
  ).limit(1);
  
  if (existing.length > 0) {
    return await db.update(userPresence).set({
      cursorPosition,
      isTyping: isTyping ? 1 : 0,
    }).where(
      and(eq(userPresence.userId, userId), eq(userPresence.documentId, documentId))
    );
  } else {
    return await db.insert(userPresence).values({
      userId,
      documentId,
      cursorPosition,
      isTyping: isTyping ? 1 : 0,
    });
  }
}

export async function getDocumentPresence(documentId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.select().from(userPresence).where(eq(userPresence.documentId, documentId));
}

export async function removePresence(userId: number, documentId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.delete(userPresence).where(
    and(eq(userPresence.userId, userId), eq(userPresence.documentId, documentId))
  );
}

// History queries
export async function addHistory(documentId: number, userId: number, operation: string, contentDelta?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.insert(documentHistory).values({
    documentId,
    userId,
    operation,
    contentDelta,
  });
}

export async function getDocumentHistory(documentId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  return await db.select().from(documentHistory).where(eq(documentHistory.documentId, documentId));
}
