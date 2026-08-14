import { requireResourceManager } from "@/server/resources/access";
import { importConfirmRequest } from "@/server/resources/schemas";
import { commitRegistrationImport } from "@/server/resources/import-service";
import { resourceError, resourceSuccess, resourceValidation } from "@/server/resources/http";

export async function POST(request: Request) { try { const session = await requireResourceManager(); const parsed = importConfirmRequest.safeParse(await request.json()); if (!parsed.success) return resourceValidation("Confirm a valid import preview before committing.", parsed.error.flatten()); return resourceSuccess(await commitRegistrationImport(parsed.data, session.user.id), 201); } catch (error) { return resourceError(error); } }
