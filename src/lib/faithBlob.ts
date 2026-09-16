import { del } from "@vercel/blob";

// Only allow deleting blobs that live under this user's own faith/{userId}/
// prefix, so the delete endpoints can't be used to remove someone else's file.
export function isOwnedFaithBlobUrl(url: string, userId: string): boolean {
  try {
    const { pathname } = new URL(url);
    return pathname.startsWith(`/faith/${userId}/`);
  } catch {
    return false;
  }
}

export async function deleteFaithBlob(url: string, userId: string): Promise<void> {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token || !isOwnedFaithBlobUrl(url, userId)) return;

  try {
    await del(url, { token });
  } catch {
    // Best-effort cleanup; a stray blob just wastes storage quota, it
    // shouldn't fail whatever request triggered the deletion.
  }
}
