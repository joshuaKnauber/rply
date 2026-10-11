import { HTTPException } from "hono/http-exception";
import type { z } from "zod";
import type { BlockPatch } from "@rply/schema";

type Body = { title?: string; text?: string; blocks?: Record<string, unknown>[] };
type Patch = { title?: string; text?: string; blocks?: unknown[]; block_patches?: z.infer<typeof BlockPatch>[] };

export function applyPatch(stored: string, patch: Patch): Body {
  const body: Body = JSON.parse(stored);
  if (patch.title !== undefined) body.title = patch.title;
  if (patch.text !== undefined) body.text = patch.text;
  if (patch.blocks !== undefined) body.blocks = patch.blocks as Record<string, unknown>[];
  for (const blockPatch of patch.block_patches ?? []) {
    const block = body.blocks?.find((b) => b.id === blockPatch.id);
    if (!block) throw new HTTPException(400, { message: `No block with id "${blockPatch.id}"` });
    Object.assign(block, blockPatch);
  }
  return body;
}
