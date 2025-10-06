// src/schemas.ts
import { z } from "zod";

export const CreateClientSchema = z.object({
  name: z.string().min(1, "name is required").max(200),
  tags: z.array(z.string()).optional(),
});
export type CreateClientInput = z.infer<typeof CreateClientSchema>;

export const UpdateClientSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  tags: z.array(z.string()).optional(),
});
export type UpdateClientInput = z.infer<typeof UpdateClientSchema>;
