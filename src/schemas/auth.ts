import { z } from "zod";

export const signInSchema = z.object({
  email: z.string().trim().email("Enter a valid work email."),
  password: z.string().min(12, "Password must be at least 12 characters."),
});

export type SignInInput = z.infer<typeof signInSchema>;
