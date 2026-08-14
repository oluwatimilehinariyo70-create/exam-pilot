import { requireResourceManager, requireResourceRead } from "@/server/resources/access";
import { registrationInput, resourceListQuery } from "@/server/resources/schemas";
import { createRegistration, listRegistrations } from "@/server/resources/services";
import { resourceError, resourceSuccess, resourceValidation } from "@/server/resources/http";

export async function GET(request: Request) { try { await requireResourceRead(); const query = resourceListQuery.parse(Object.fromEntries(new URL(request.url).searchParams)); return resourceSuccess(await listRegistrations(query)); } catch (error) { return resourceError(error); } }
export async function POST(request: Request) { try { const session = await requireResourceManager(); const parsed = registrationInput.safeParse(await request.json()); if (!parsed.success) return resourceValidation("Check the registration details.", parsed.error.flatten()); return resourceSuccess(await createRegistration(parsed.data, session.user.id), 201); } catch (error) { return resourceError(error); } }
