import type { ID, MaterialType } from "./types";

const allowedDomains = new Set([
  "www.advayta.org",
  "advayta.org",
  "institute-vasishtha.com",
  "sanatanadharma.world",
]);

export class MaterialLink {
  constructor(
    public readonly id: ID,
    public readonly practiceId: ID,
    public title: string,
    public url: string,
    public readonly type: MaterialType,
    public sourceDomain: string,
  ) {
    if (!url.trim()) throw new Error("Material URL is required");
    if (!sourceDomain.trim()) throw new Error("Material source domain is required");
    if (!allowedDomains.has(sourceDomain)) throw new Error("Material source domain is not allowed");
  }
}

export function getAllowedMaterialDomains() {
  return [...allowedDomains];
}
