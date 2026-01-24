import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Documents table - stores collaborative documents
 */
export const documents = mysqlTable("documents", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull().default("Untitled Document"),
  content: text("content").notNull(),
  ownerId: int("owner_id").notNull(),
  isPublic: int("is_public").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type Document = typeof documents.$inferSelect;
export type InsertDocument = typeof documents.$inferInsert;

/**
 * Document permissions - controls access levels
 */
export const documentPermissions = mysqlTable("document_permissions", {
  id: int("id").autoincrement().primaryKey(),
  documentId: int("document_id").notNull(),
  userId: int("user_id").notNull(),
  role: mysqlEnum("role", ["view", "edit", "admin"]).notNull(),
  grantedAt: timestamp("granted_at").defaultNow().notNull(),
  grantedBy: int("granted_by").notNull(),
});

export type DocumentPermission = typeof documentPermissions.$inferSelect;
export type InsertDocumentPermission = typeof documentPermissions.$inferInsert;

/**
 * Document versions - stores version history
 */
export const documentVersions = mysqlTable("document_versions", {
  id: int("id").autoincrement().primaryKey(),
  documentId: int("document_id").notNull(),
  versionNumber: int("version_number").notNull(),
  content: text("content").notNull(),
  createdBy: int("created_by").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  description: varchar("description", { length: 500 }),
});

export type DocumentVersion = typeof documentVersions.$inferSelect;
export type InsertDocumentVersion = typeof documentVersions.$inferInsert;

/**
 * User presence - tracks active users in documents
 */
export const userPresence = mysqlTable("user_presence", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  documentId: int("document_id").notNull(),
  cursorPosition: int("cursor_position").notNull().default(0),
  isTyping: int("is_typing").notNull().default(0),
  lastSeen: timestamp("last_seen").defaultNow().onUpdateNow().notNull(),
});

export type UserPresence = typeof userPresence.$inferSelect;
export type InsertUserPresence = typeof userPresence.$inferInsert;

/**
 * Document history - tracks all edits and changes
 */
export const documentHistory = mysqlTable("document_history", {
  id: int("id").autoincrement().primaryKey(),
  documentId: int("document_id").notNull(),
  userId: int("user_id").notNull(),
  operation: varchar("operation", { length: 50 }).notNull(),
  contentDelta: text("content_delta"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export type DocumentHistoryRecord = typeof documentHistory.$inferSelect;
export type InsertDocumentHistoryRecord = typeof documentHistory.$inferInsert;
