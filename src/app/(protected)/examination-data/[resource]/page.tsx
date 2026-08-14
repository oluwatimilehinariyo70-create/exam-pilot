import { notFound } from "next/navigation";

import { ResourceManager } from "@/components/resources/resource-manager";
import { getCurrentSession } from "@/lib/authorization";

const resources = ["courses", "students", "venues", "invigilators"] as const;

export default async function ResourcePage({ params }: { params: Promise<{ resource: string }> }) { const { resource } = await params; if (!resources.includes(resource as (typeof resources)[number])) notFound(); const session = await getCurrentSession(); if (!session?.user) notFound(); return <ResourceManager resource={resource as (typeof resources)[number]} role={session.user.role ?? "VIEWER"} />; }
