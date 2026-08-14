import { requireResourceManager } from "@/server/resources/access";
import { AcademicError } from "@/server/academic/errors";
import { importRequest } from "@/server/resources/schemas";
import { previewRegistrationImport } from "@/server/resources/import-service";
import { resourceError, resourceSuccess, resourceValidation } from "@/server/resources/http";

export async function POST(request: Request) { try { await requireResourceManager(); const contentLength = Number(request.headers.get("content-length") ?? 0); if (contentLength > 10_000_000) return resourceError(new AcademicError("CSV_TOO_LARGE", "CSV files must be smaller than 10 MB.", {}, 413)); const parsed = importRequest.safeParse(await request.json()); if (!parsed.success) return resourceValidation("Provide a CSV file, academic session, and semester.", parsed.error.flatten()); return resourceSuccess(await previewRegistrationImport(parsed.data.csv, parsed.data.sessionId, parsed.data.semesterId)); } catch (error) { return resourceError(error); } }
