import { requireResourceManager } from "@/server/resources/access";
import { removeRegistration } from "@/server/resources/services";
import { resourceError, resourceSuccess } from "@/server/resources/http";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) { try { const session = await requireResourceManager(); return resourceSuccess(await removeRegistration((await params).id, session.user.id)); } catch (error) { return resourceError(error); } }
