import { notFound } from "next/navigation";

import { ResourceDetail } from "@/components/resources/resource-detail";
import { getCurrentSession } from "@/lib/authorization";

const resources = ["courses", "students", "venues", "invigilators"] as const;

export default async function ResourceDetailPage({ params }: { params: Promise<{ resource: string; id: string }> }) { const { resource, id } = await params; if (!resources.includes(resource as (typeof resources)[number])) notFound(); const session = await getCurrentSession(); if (!session?.user) notFound(); return <ResourceDetail resource={resource as (typeof resources)[number]} id={id} role={session.user.role ?? "VIEWER"} />; }
