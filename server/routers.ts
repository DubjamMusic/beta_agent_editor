import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  // Document operations
  documents: router({
    create: protectedProcedure
      .input(z.object({ title: z.string().min(1).max(255) }))
      .mutation(async ({ input, ctx }) => {
        await db.createDocument(input.title, ctx.user.id);
        return { success: true };
      }),

    list: protectedProcedure
      .query(async ({ ctx }) => {
        return await db.getUserDocuments(ctx.user.id);
      }),

    get: protectedProcedure
      .input(z.object({ documentId: z.number() }))
      .query(async ({ input, ctx }) => {
        const doc = await db.getDocument(input.documentId);
        if (!doc) throw new Error("Document not found");
        
        // Check permission
        if (doc.ownerId !== ctx.user.id) {
          const perm = await db.getUserPermission(input.documentId, ctx.user.id);
          if (!perm) throw new Error("Access denied");
        }
        
        return doc;
      }),

    update: protectedProcedure
      .input(z.object({ documentId: z.number(), content: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const doc = await db.getDocument(input.documentId);
        if (!doc) throw new Error("Document not found");
        
        // Check edit permission
        if (doc.ownerId !== ctx.user.id) {
          const perm = await db.getUserPermission(input.documentId, ctx.user.id);
          if (!perm || perm.role === "view") throw new Error("Edit access denied");
        }
        
        await db.updateDocumentContent(input.documentId, input.content);
        await db.addHistory(input.documentId, ctx.user.id, "edit", input.content);
        
        return { success: true };
      }),

    delete: protectedProcedure
      .input(z.object({ documentId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const doc = await db.getDocument(input.documentId);
        if (!doc) throw new Error("Document not found");
        if (doc.ownerId !== ctx.user.id) throw new Error("Only owner can delete");
        
        return { success: true };
      }),
  }),

  // Permission operations
  permissions: router({
    grant: protectedProcedure
      .input(z.object({
        documentId: z.number(),
        userId: z.number(),
        role: z.enum(["view", "edit", "admin"]),
      }))
      .mutation(async ({ input, ctx }) => {
        const doc = await db.getDocument(input.documentId);
        if (!doc) throw new Error("Document not found");
        if (doc.ownerId !== ctx.user.id) throw new Error("Only owner can grant permissions");
        
        await db.grantPermission(input.documentId, input.userId, input.role, ctx.user.id);
        return { success: true };
      }),

    get: protectedProcedure
      .input(z.object({ documentId: z.number() }))
      .query(async ({ input, ctx }) => {
        const doc = await db.getDocument(input.documentId);
        if (!doc) throw new Error("Document not found");
        if (doc.ownerId !== ctx.user.id) throw new Error("Only owner can view permissions");
        
        return [];
      }),
  }),

  // Version operations
  versions: router({
    list: protectedProcedure
      .input(z.object({ documentId: z.number() }))
      .query(async ({ input, ctx }) => {
        const doc = await db.getDocument(input.documentId);
        if (!doc) throw new Error("Document not found");
        
        // Check permission
        if (doc.ownerId !== ctx.user.id) {
          const perm = await db.getUserPermission(input.documentId, ctx.user.id);
          if (!perm) throw new Error("Access denied");
        }
        
        return await db.getDocumentVersions(input.documentId);
      }),

    create: protectedProcedure
      .input(z.object({
        documentId: z.number(),
        description: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const doc = await db.getDocument(input.documentId);
        if (!doc) throw new Error("Document not found");
        
        // Check edit permission
        if (doc.ownerId !== ctx.user.id) {
          const perm = await db.getUserPermission(input.documentId, ctx.user.id);
          if (!perm || perm.role === "view") throw new Error("Edit access denied");
        }
        
        await db.createVersion(input.documentId, doc.content, ctx.user.id, input.description);
        return { success: true };
      }),

    restore: protectedProcedure
      .input(z.object({
        documentId: z.number(),
        versionId: z.number(),
      }))
      .mutation(async ({ input, ctx }) => {
        const doc = await db.getDocument(input.documentId);
        if (!doc) throw new Error("Document not found");
        
        // Check edit permission
        if (doc.ownerId !== ctx.user.id) {
          const perm = await db.getUserPermission(input.documentId, ctx.user.id);
          if (!perm || perm.role === "view") throw new Error("Edit access denied");
        }
        
        return { success: true };
      }),
  }),

  // Presence operations
  presence: router({
    update: protectedProcedure
      .input(z.object({
        documentId: z.number(),
        cursorPosition: z.number(),
        isTyping: z.boolean(),
      }))
      .mutation(async ({ input, ctx }) => {
        await db.updatePresence(ctx.user.id, input.documentId, input.cursorPosition, input.isTyping);
        return { success: true };
      }),

    get: protectedProcedure
      .input(z.object({ documentId: z.number() }))
      .query(async ({ input, ctx }) => {
        return await db.getDocumentPresence(input.documentId);
      }),

    leave: protectedProcedure
      .input(z.object({ documentId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        await db.removePresence(ctx.user.id, input.documentId);
        return { success: true };
      }),
  }),

  // History operations
  history: router({
    get: protectedProcedure
      .input(z.object({ documentId: z.number() }))
      .query(async ({ input, ctx }) => {
        const doc = await db.getDocument(input.documentId);
        if (!doc) throw new Error("Document not found");
        
        // Check permission
        if (doc.ownerId !== ctx.user.id) {
          const perm = await db.getUserPermission(input.documentId, ctx.user.id);
          if (!perm) throw new Error("Access denied");
        }
        
        return await db.getDocumentHistory(input.documentId);
      }),
  }),
});

export type AppRouter = typeof appRouter;
