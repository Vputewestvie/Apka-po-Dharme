import type { ID, MaterialType } from "./types";
export declare class MaterialLink {
    readonly id: ID;
    readonly practiceId: ID;
    title: string;
    url: string;
    readonly type: MaterialType;
    sourceDomain: string;
    constructor(id: ID, practiceId: ID, title: string, url: string, type: MaterialType, sourceDomain: string);
}
export declare function getAllowedMaterialDomains(): string[];
//# sourceMappingURL=material-link.d.ts.map