import { put } from "@vercel/blob";
import {
  isPng,
  newShotId,
  type ShotKind,
  shotPath,
  withinShotLimit,
} from "@/lib/screenshot";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin !== new URL(request.url).origin) {
    return Response.json(
      { error: "Screenshot upload was refused." },
      { status: 403 },
    );
  }

  const kind = new URL(request.url).searchParams.get("kind");
  if (kind !== "map" && kind !== "portrait") {
    return Response.json(
      { error: "Screenshot upload was refused." },
      { status: 400 },
    );
  }

  const declared = Number(request.headers.get("content-length"));
  if (!withinShotLimit(declared)) {
    return Response.json(
      { error: "That screenshot is too large to share." },
      { status: 413 },
    );
  }

  const bytes = new Uint8Array(await request.arrayBuffer());
  if (!withinShotLimit(bytes.byteLength) || !isPng(bytes)) {
    return Response.json(
      { error: "That file is not a PNG screenshot." },
      { status: 400 },
    );
  }

  const id = newShotId(kind as ShotKind);
  let imageUrl: string;
  try {
    const stored = await put(
      shotPath(id),
      new Blob([bytes], { type: "image/png" }),
      {
        access: "public",
        addRandomSuffix: false,
        contentType: "image/png",
        // CDN cache only. The blob itself stays until it is deleted.
        cacheControlMaxAge: 60 * 60 * 24 * 365,
      },
    );
    imageUrl = stored.url;
  } catch (error) {
    console.error(error);
    return Response.json(
      { error: "Sharing to X isn't available right now." },
      { status: 503 },
    );
  }

  return Response.json({ imageUrl });
}
