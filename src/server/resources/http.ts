import { NextResponse } from "next/server";

import { AcademicError, toAcademicError } from "@/server/academic/errors";

export function resourceSuccess<T>(data: T, status = 200) { return NextResponse.json({ data }, { status }); }
export function resourceError(error: unknown) { const normalized = toAcademicError(error); return NextResponse.json({ error: { code: normalized.code, message: normalized.message, details: normalized.details } }, { status: normalized.status }); }
export function resourceValidation(message: string, details: Record<string, unknown> = {}) { return NextResponse.json({ error: { code: "VALIDATION_ERROR", message, details } }, { status: 400 }); }
