import { z } from "zod";
import { insertUserSchema } from "@shared/schema";

export const createUserSchema = insertUserSchema.omit({ passwordHash: true }).extend({
  password: z.string().min(8, "Password must be at least 8 characters").max(128),
});

export const updateUserSchema = createUserSchema.partial();
