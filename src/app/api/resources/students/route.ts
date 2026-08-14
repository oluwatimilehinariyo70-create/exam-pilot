import { requireResourceManager, requireResourceRead } from "@/server/resources/access";
import { resourceListQuery, studentInput } from "@/server/resources/schemas";
import { createStudent, listStudents } from "@/server/resources/services";
import { resourceError, resourceSuccess, resourceValidation } from "@/server/resources/http";

export async function GET(request: Request) { try { await requireResourceRead(); const query = resourceListQuery.parse(Object.fromEntries(new URL(request.url).searchParams)); return resourceSuccess(await listStudents(query)); } catch (error) { return resourceError(error); } }
export async function POST(request: Request) { try { const session = await requireResourceManager(); const parsed = studentInput.safeParse(await request.json()); if (!parsed.success) return resourceValidation("Check the student details.", parsed.error.flatten()); return resourceSuccess(await createStudent(parsed.data, session.user.id), 201); } catch (error) { return resourceError(error); } }
