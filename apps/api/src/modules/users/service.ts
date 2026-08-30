import type { SettingsRepository, UserRepository } from "../../../../../packages/database/src";
import type { TelegramUser } from "../../types";
import { createId } from "../../id";

/**
 * Гарантирует, что пользователь существует в таблице `users` (и имеет запись
 * настроек по умолчанию).
 *
 * Это критично для Cloudflare D1: в отличие от локального sql.js, D1 всегда
 * включает внешние ключи. Любая запись практики/расписания/дневника ссылается
 * на `users(id)`, поэтому строка пользователя должна появиться ДО первой такой
 * записи — иначе получим FK-нарушение (500).
 */
export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly settingsRepository: SettingsRepository,
  ) {}

  async ensureUser(telegramUser: TelegramUser): Promise<void> {
    const id = String(telegramUser.id);
    const now = new Date().toISOString();

    const existing = await this.userRepository.getByTelegramId(telegramUser.id);
    if (!existing) {
      await this.userRepository.upsert({
        id,
        telegram_id: telegramUser.id,
        username: telegramUser.username ?? null,
        first_name: telegramUser.first_name ?? null,
        last_name: telegramUser.last_name ?? null,
        language_code: telegramUser.language_code ?? null,
        timezone: "UTC",
        created_at: now,
        updated_at: now,
      });

      await this.settingsRepository.upsert({
        id: createId(),
        user_id: id,
        theme: "light",
        ai_enabled: false,
        ai_provider: null,
        notification_enabled: false,
        morning_notification_time: null,
        day_notification_time: null,
        evening_notification_time: null,
        created_at: now,
        updated_at: now,
      });
      return;
    }

    // Пользователь уже есть — освежим профиль (имя/язык могли измениться в TG).
    await this.userRepository.upsert({
      ...existing,
      username: telegramUser.username ?? null,
      first_name: telegramUser.first_name ?? null,
      last_name: telegramUser.last_name ?? null,
      language_code: telegramUser.language_code ?? null,
      updated_at: now,
    });
  }
}
