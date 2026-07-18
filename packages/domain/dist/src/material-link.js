const allowedDomains = new Set([
    "www.advayta.org",
    "advayta.org",
    "institute-vasishtha.com",
    "sanatanadharma.world",
]);
export class MaterialLink {
    id;
    practiceId;
    title;
    url;
    type;
    sourceDomain;
    constructor(id, practiceId, title, url, type, sourceDomain) {
        this.id = id;
        this.practiceId = practiceId;
        this.title = title;
        this.url = url;
        this.type = type;
        this.sourceDomain = sourceDomain;
        if (!url.trim())
            throw new Error("Material URL is required");
        if (!sourceDomain.trim())
            throw new Error("Material source domain is required");
        if (!allowedDomains.has(sourceDomain))
            throw new Error("Material source domain is not allowed");
    }
}
export function getAllowedMaterialDomains() {
    return [...allowedDomains];
}
