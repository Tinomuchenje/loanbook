"use client";

import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";

export const ACCEPTED_DOCS = "application/pdf,image/jpeg,image/png,image/webp";
const MAX_BYTES = 10 * 1024 * 1024;

export function checkDocument(file: File | null): string | null {
  if (!file) return "Attach the supporting document, such as a recent payslip.";
  if (!ACCEPTED_DOCS.split(",").includes(file.type)) return "Upload a PDF or a photo (JPG, PNG or WebP).";
  if (file.size > MAX_BYTES) return "That file is over 10 MB. Upload a smaller copy.";
  return null;
}

/** Uploads a file to Convex storage and returns its storage id. */
export function useUploadDocument() {
  const generateUploadUrl = useMutation(api.loans.generateUploadUrl);
  return async (file: File): Promise<Id<"_storage">> => {
    const url = await generateUploadUrl({});
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": file.type }, body: file });
    if (!res.ok) throw new Error("upload failed");
    const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
    return storageId;
  };
}
