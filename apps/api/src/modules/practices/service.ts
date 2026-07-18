import { getAllowedMaterialDomains, MaterialLink, Practice } from "../../../../../packages/domain/src";
import type { MaterialRepository, PracticeRepository } from "../../../../../packages/database/src";
import { createId } from "../../id";
import type { MaterialInput, PracticeInput, PracticeUpdateInput } from "./dto";

export class PracticeLibraryService {
  constructor(
    private readonly practiceRepository: PracticeRepository,
    private readonly materialRepository: MaterialRepository,
  ) {}

  list(userId: string) {
    return this.practiceRepository.listByUserId(userId);
  }

  async create(input: PracticeInput) {
    const practice = new Practice(
      createId(),
      input.userId,
      input.title,
      input.description,
      input.category,
      input.defaultDurationMinutes,
      input.color,
      input.icon,
      input.image,
      "manual",
      input.notes ?? "",
    );
    await this.practiceRepository.upsert(practice);
    return practice;
  }

  async update(input: PracticeUpdateInput) {
    const existing = await this.practiceRepository.getById(input.practiceId);
    if (!existing) throw new Error("Practice not found");
    existing.updateDetails({
      description: input.description,
      category: input.category,
      defaultDurationMinutes: input.defaultDurationMinutes,
      color: input.color,
      icon: input.icon,
      image: input.image,
      notes: input.notes,
    });
    if (input.title) existing.rename(input.title);
    await this.practiceRepository.upsert(existing);
    return existing;
  }

  async archive(practiceId: string) {
    const existing = await this.practiceRepository.getById(practiceId);
    if (!existing) throw new Error("Practice not found");
    existing.archive();
    await this.practiceRepository.upsert(existing);
    return existing;
  }

  async restore(practiceId: string) {
    const existing = await this.practiceRepository.getById(practiceId);
    if (!existing) throw new Error("Practice not found");
    existing.restore();
    await this.practiceRepository.upsert(existing);
    return existing;
  }

  async addMaterial(input: MaterialInput) {
    if (!getAllowedMaterialDomains().includes(input.sourceDomain)) {
      throw new Error("Material source domain is not allowed");
    }
    const material = new MaterialLink(
      createId(),
      input.practiceId,
      input.title,
      input.url,
      input.type,
      input.sourceDomain,
    );
    await this.materialRepository.upsert(material);
    return material;
  }

  listMaterials(practiceId: string) {
    return this.materialRepository.listByPracticeId(practiceId);
  }
}
