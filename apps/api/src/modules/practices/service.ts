import { getAllowedMaterialDomains, MaterialLink, Practice } from "../../../../../packages/domain/src";
import type { MaterialRepository, PracticeRepository } from "../../../../../packages/database/src";
import { createId } from "../../id";
import { ForbiddenError, NotFoundError, ValidationError } from "../../validation";
import type { MaterialInput, PracticeInput, PracticeUpdateInput } from "./dto";

export class PracticeLibraryService {
  constructor(
    private readonly practiceRepository: PracticeRepository,
    private readonly materialRepository: MaterialRepository,
  ) {}

  list(userId: string) {
    return this.practiceRepository.listByUserId(userId);
  }

  /**
   * Находит практику и проверяет, что она принадлежит указанному пользователю.
   * Это ключевая защита от обращения к чужим данным по известному идентификатору.
   */
  private async requireOwned(practiceId: string, userId: string): Promise<Practice> {
    const practice = await this.practiceRepository.getById(practiceId);
    if (!practice) throw new NotFoundError("Practice not found");
    if (practice.userId !== userId) throw new ForbiddenError("Practice belongs to another user");
    return practice;
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

  async update(input: PracticeUpdateInput, userId: string) {
    const existing = await this.requireOwned(input.practiceId, userId);
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

  async archive(practiceId: string, userId: string) {
    const existing = await this.requireOwned(practiceId, userId);
    existing.archive();
    await this.practiceRepository.upsert(existing);
    return existing;
  }

  async restore(practiceId: string, userId: string) {
    const existing = await this.requireOwned(practiceId, userId);
    existing.restore();
    await this.practiceRepository.upsert(existing);
    return existing;
  }

  async delete(practiceId: string, userId: string) {
    await this.requireOwned(practiceId, userId);
    await this.practiceRepository.delete(practiceId);
    return { deleted: true };
  }

  async addMaterial(input: MaterialInput, userId: string) {
    // Сначала авторизация, потом валидация: иначе чужой пользователь получал бы
    // 400 про домен вместо честного 403 «чужая практика».
    await this.requireOwned(input.practiceId, userId);
    if (!getAllowedMaterialDomains().includes(input.sourceDomain)) {
      throw new ValidationError("Material source domain is not allowed");
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
