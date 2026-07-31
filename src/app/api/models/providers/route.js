import { NextResponse } from "next/server";
import {
  createModelProvider,
  deleteModelProvider,
  getModelProviders,
  updateModelProvider,
} from "@/lib/localDb";
import { normalizeLobeIconKey } from "@/shared/utils/lobeIcons";

export const dynamic = "force-dynamic";

function normalizeInput(body) {
  return {
    name: typeof body?.name === "string" ? body.name.trim() : "",
    iconKey: normalizeLobeIconKey(body?.iconKey || body?.icon || ""),
  };
}

function validateInput(input) {
  if (!input.name) return "Provider name is required";
  if (input.name.length > 80) return "Provider name must be 80 characters or fewer";
  if (!input.iconKey) return "Lobe icon URL or slug is required";
  if (input.iconKey.length > 80) return "Icon slug must be 80 characters or fewer";
  return "";
}

export async function GET() {
  try {
    return NextResponse.json({ providers: await getModelProviders() });
  } catch (error) {
    console.error("[API] Failed to load model providers:", error);
    return NextResponse.json({ error: "Failed to load model providers" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const input = normalizeInput(await request.json());
    const validationError = validateInput(input);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const provider = await createModelProvider(input);
    if (!provider) {
      return NextResponse.json({ error: "Provider name already exists" }, { status: 409 });
    }
    return NextResponse.json(provider, { status: 201 });
  } catch (error) {
    console.error("[API] Failed to create model provider:", error);
    return NextResponse.json({ error: "Failed to create model provider" }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const body = await request.json();
    const id = typeof body?.id === "string" ? body.id.trim() : "";
    const input = normalizeInput(body);
    if (!id) return NextResponse.json({ error: "Provider ID is required" }, { status: 400 });
    const validationError = validateInput(input);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const provider = await updateModelProvider(id, input);
    if (!provider) return NextResponse.json({ error: "Provider not found" }, { status: 404 });
    if (provider.duplicate) {
      return NextResponse.json({ error: "Provider name already exists" }, { status: 409 });
    }
    return NextResponse.json(provider);
  } catch (error) {
    console.error("[API] Failed to update model provider:", error);
    return NextResponse.json({ error: "Failed to update model provider" }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const id = new URL(request.url).searchParams.get("id")?.trim();
    if (!id) return NextResponse.json({ error: "Provider ID is required" }, { status: 400 });

    const result = await deleteModelProvider(id);
    if (result.notFound) return NextResponse.json({ error: "Provider not found" }, { status: 404 });
    if (!result.deleted) {
      return NextResponse.json(
        { error: `Provider is used by ${result.usageCount} model route${result.usageCount === 1 ? "" : "s"}` },
        { status: 409 },
      );
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API] Failed to delete model provider:", error);
    return NextResponse.json({ error: "Failed to delete model provider" }, { status: 500 });
  }
}
