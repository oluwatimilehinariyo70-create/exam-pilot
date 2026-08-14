import { requireResourceManager, requireResourceRead } from "@/server/resources/access";
import { resourceListQuery, venueInput } from "@/server/resources/schemas";
import { createVenue, listVenues } from "@/server/resources/services";
import { resourceError, resourceSuccess, resourceValidation } from "@/server/resources/http";

export async function GET(request: Request) { try { await requireResourceRead(); const query = resourceListQuery.parse(Object.fromEntries(new URL(request.url).searchParams)); return resourceSuccess(await listVenues(query)); } catch (error) { return resourceError(error); } }
export async function POST(request: Request) { try { const session = await requireResourceManager(); const parsed = venueInput.safeParse(await request.json()); if (!parsed.success) return resourceValidation("Check the venue details.", parsed.error.flatten()); return resourceSuccess(await createVenue(parsed.data, session.user.id), 201); } catch (error) { return resourceError(error); } }
