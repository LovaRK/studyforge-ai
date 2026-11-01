"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isUserFacingError } from "@/application/errors";
import { importSource } from "@/application/sources/import-source";
import { logger } from "@/infrastructure/logging/logger";
import { container } from "@/server/container";
import { requireOwner } from "@/server/session";

export type UploadState = { error?: string };

const uploadInput = z.object({
  file: z.instanceof(File, { message: "Choose a file to upload." }).refine((f) => f.size > 0, "Choose a file to upload."),
  title: z.string().max(200).optional(),
  attribution: z.string().max(200).optional(),
});

export async function uploadSourceAction(_previous: UploadState, formData: FormData): Promise<UploadState> {
  await requireOwner();
  const parsed = uploadInput.safeParse({
    file: formData.get("file"),
    title: formData.get("title") || undefined,
    attribution: formData.get("attribution") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the form and try again." };

  const { file, title, attribution } = parsed.data;
  const c = container();
  let sourceId: string;
  try {
    const source = await importSource(
      { sources: c.sources, extractor: c.textExtractor },
      { file: { name: file.name, mimeType: file.type, bytes: new Uint8Array(await file.arrayBuffer()) }, title, attribution },
    );
    sourceId = source.id;
    logger.info("source imported", { sourceId, words: source.wordCount });
  } catch (error) {
    if (isUserFacingError(error)) return { error: error.message };
    logger.error("source import failed", { error });
    return { error: "The file could not be read. Try a different file." };
  }

  revalidatePath("/sources");
  redirect(`/sources/${sourceId}`);
}

const sourceIdInput = z.string().uuid();

export async function startExtractionAction(sourceId: string): Promise<void> {
  await requireOwner();
  const id = sourceIdInput.parse(sourceId);
  container().extractionRunner.start(id);
  revalidatePath(`/sources/${id}`);
}
