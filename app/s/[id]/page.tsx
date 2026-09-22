import { head } from "@vercel/blob";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isShotId, shotCard, shotPath, shotTitle } from "@/lib/screenshot";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

async function loadShot(id: string) {
  if (!isShotId(id)) return null;
  try {
    return await head(shotPath(id));
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const blob = await loadShot(id);
  if (!blob) return { title: "Screenshot missing" };
  const title = shotTitle(id);
  return {
    title,
    description: title,
    openGraph: {
      title,
      description: title,
      images: [{ url: blob.url, alt: title }],
    },
    twitter: {
      card: shotCard(id),
      title,
      description: title,
      images: [blob.url],
    },
  };
}

export default async function ShotPage({ params }: Props) {
  const { id } = await params;
  const blob = await loadShot(id);
  if (!blob) notFound();
  const title = shotTitle(id);
  return (
    <main className="shot-page">
      {/* Same file the card points at. Optimizing it would resample the pixels. */}
      {/* biome-ignore lint/performance/noImgElement: the share image must stay the stored PNG */}
      <img src={blob.url} alt={title} />
      <p>{title}</p>
      <a href="/">Play Mosslings</a>
    </main>
  );
}
