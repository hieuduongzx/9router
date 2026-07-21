import { NextResponse } from "next/server";
import { deleteApiKey, getApiKeyById, updateApiKey } from "@/lib/localDb";
import { resolveApiKeyOwner } from "@/lib/auth/apiKeyOwner";

// GET /api/keys/[id] - Get single key
export async function GET(request, { params }) {
  try {
    const owner = await resolveApiKeyOwner(request);
    if (!owner) return NextResponse.json({ error: "Account login required" }, { status: 403 });
    const { id } = await params;
    const key = await getApiKeyById(id, owner.id);
    if (!key) {
      return NextResponse.json({ error: "Key not found" }, { status: 404 });
    }
    return NextResponse.json({ key });
  } catch (error) {
    console.log("Error fetching key:", error);
    return NextResponse.json({ error: "Failed to fetch key" }, { status: 500 });
  }
}

// PUT /api/keys/[id] - Update key
export async function PUT(request, { params }) {
  try {
    const owner = await resolveApiKeyOwner(request);
    if (!owner) return NextResponse.json({ error: "Account login required" }, { status: 403 });
    const { id } = await params;
    const body = await request.json();
    const { isActive } = body;

    const existing = await getApiKeyById(id, owner.id);
    if (!existing) {
      return NextResponse.json({ error: "Key not found" }, { status: 404 });
    }

    const updateData = {};
    if (isActive !== undefined) updateData.isActive = isActive;

    const updated = await updateApiKey(id, updateData, owner.id);

    return NextResponse.json({ key: updated });
  } catch (error) {
    console.log("Error updating key:", error);
    return NextResponse.json({ error: "Failed to update key" }, { status: 500 });
  }
}

// DELETE /api/keys/[id] - Delete API key
export async function DELETE(request, { params }) {
  try {
    const owner = await resolveApiKeyOwner(request);
    if (!owner) return NextResponse.json({ error: "Account login required" }, { status: 403 });
    const { id } = await params;

    const deleted = await deleteApiKey(id, owner.id);
    if (!deleted) {
      return NextResponse.json({ error: "Key not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Key deleted successfully" });
  } catch (error) {
    console.log("Error deleting key:", error);
    return NextResponse.json({ error: "Failed to delete key" }, { status: 500 });
  }
}
