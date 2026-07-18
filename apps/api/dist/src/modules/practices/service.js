import { getAllowedMaterialDomains, MaterialLink, Practice } from "../../../../../packages/domain/src";
import { createId } from "../../id";
export class PracticeLibraryService {
    practiceRepository;
    materialRepository;
    constructor(practiceRepository, materialRepository) {
        this.practiceRepository = practiceRepository;
        this.materialRepository = materialRepository;
    }
    list(userId) {
        return this.practiceRepository.listByUserId(userId);
    }
    async create(input) {
        const practice = new Practice(createId(), input.userId, input.title, input.description, input.category, input.defaultDurationMinutes, input.color, input.icon, input.image, "manual", input.notes ?? "");
        await this.practiceRepository.upsert(practice);
        return practice;
    }
    async update(input) {
        const existing = await this.practiceRepository.getById(input.practiceId);
        if (!existing)
            throw new Error("Practice not found");
        existing.updateDetails({
            description: input.description,
            category: input.category,
            defaultDurationMinutes: input.defaultDurationMinutes,
            color: input.color,
            icon: input.icon,
            image: input.image,
            notes: input.notes,
        });
        if (input.title)
            existing.rename(input.title);
        await this.practiceRepository.upsert(existing);
        return existing;
    }
    async archive(practiceId) {
        const existing = await this.practiceRepository.getById(practiceId);
        if (!existing)
            throw new Error("Practice not found");
        existing.archive();
        await this.practiceRepository.upsert(existing);
        return existing;
    }
    async restore(practiceId) {
        const existing = await this.practiceRepository.getById(practiceId);
        if (!existing)
            throw new Error("Practice not found");
        existing.restore();
        await this.practiceRepository.upsert(existing);
        return existing;
    }
    async addMaterial(input) {
        if (!getAllowedMaterialDomains().includes(input.sourceDomain)) {
            throw new Error("Material source domain is not allowed");
        }
        const material = new MaterialLink(createId(), input.practiceId, input.title, input.url, input.type, input.sourceDomain);
        await this.materialRepository.upsert(material);
        return material;
    }
    listMaterials(practiceId) {
        return this.materialRepository.listByPracticeId(practiceId);
    }
}
