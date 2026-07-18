import { MaterialLink, Practice } from "../../../../../packages/domain/src";
import type { MaterialRepository, PracticeRepository } from "../../../../../packages/database/src";
import type { MaterialInput, PracticeInput, PracticeUpdateInput } from "./dto";
export declare class PracticeLibraryService {
    private readonly practiceRepository;
    private readonly materialRepository;
    constructor(practiceRepository: PracticeRepository, materialRepository: MaterialRepository);
    list(userId: string): Promise<Practice[]>;
    create(input: PracticeInput): Promise<Practice>;
    update(input: PracticeUpdateInput): Promise<Practice>;
    archive(practiceId: string): Promise<Practice>;
    restore(practiceId: string): Promise<Practice>;
    addMaterial(input: MaterialInput): Promise<MaterialLink>;
    listMaterials(practiceId: string): Promise<MaterialLink[]>;
}
//# sourceMappingURL=service.d.ts.map