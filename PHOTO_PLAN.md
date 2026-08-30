# PHOTO_PLAN.md — Тематические фотографии для проекта

План фотосессии для Telegram Mini App «Дневник духовной практики» и бота.
Все изображения генерируются в ChatGPT по промптам ниже, затем отдаются мне —
я ужму, разложу по папкам и подключу в код.

**Итого: 16 фотографий.**

---

## Единый стиль (стилевая ДНК)

Приложение использует земляную природную палитру: тёплый песочный фон,
шалфейно-зелёный, терракота и глубокий индиго (#5b5f97) как акцент.
Тёмная тема — глубокий сине-фиолетовый ночной (#0f1117).

**Этот блок добавляется в конец каждого промпта** (в промптах ниже он
обозначен как `[СТИЛЬ]`, вставляй вместо него этот текст):

```
[СТИЛЬ] = Soft diffused natural light, muted earthy color palette of warm
sand beige, sage green, soft terracotta and deep muted indigo. Minimalist
zen aesthetic, calm contemplative mood, cinematic photography, shallow
depth of field, fine natural texture. No text, no letters, no numbers,
no watermarks, no logos, no borders, no frames.
```

Соотношения сторон в ChatGPT: **1:1 (Square, 1024×1024)**, **3:2 (Landscape,
1536×1024)**, **2:3 (Portrait, 1024×1536)**. Точные пропорции 16:9 и 9:16
получатся у меня автоматической обрезкой — не пытайся получить их в генераторе.

Сохраняй файлы **с точными именами** из таблицы. Когда всё будет готово,
сложи файлы в папку `tmp/photos/` в проекте и скажи мне.

---

## Блок A — Аватар Telegram-бота (1 фото)

Загружается вручную через @BotFather → /setuserpic. Telegram обрезает
фото в круг, поэтому композиция должна быть центрированной.

| # | Файл | Соотношение | Куда идёт |
|---|------|-------------|-----------|
| A1 | `bot-avatar.png` | 1:1 (1024×1024) | Аватар бота (круг 400×400, читается от 40px) |

**Промпт A1:**
```
A single delicate pink lotus flower floating on dark still water, viewed
from directly above, perfectly centered in the frame. Gentle ripples
radiating outward from the flower. Deep indigo water background. The
flower and important details occupy the central 60% of the image so the
composition survives a circular crop. [СТИЛЬ]
```

Дополнительно к стилю: высокий контраст цветка и фона, чтобы читалось
в маленьком кружке 40px.

---

## Блок B — Категории практик (8 фото)

Карточки на экране «Сегодня» (обрезка 16:9 в CSS, `object-fit: cover`) и
дефолтные картинки при создании практики. Заменяют текущие 3 фото
(`qigong.jpg`, `pranayama.jpg`, `reading.jpg` — имена сохраняются, чтобы
не ломать ссылки) и добавляют 5 новых категорий.

| # | Файл | Категория (ключевые слова для маппинга) | Соотношение |
|---|------|------------------------------------------|-------------|
| B1 | `meditation.jpg` | Медитация (медит) — и умолчание для новых практик | 3:2 |
| B2 | `pranayama.jpg` | Дыхание / Пранаяма (дых, prana) | 3:2 |
| B3 | `qigong.jpg` | Тело / Йога / Цигун (йог, цигун, тело, qigong) | 3:2 |
| B4 | `reading.jpg` | Чтение / Текст (текст, read, книг) | 3:2 |
| B5 | `mantra.jpg` | Мантры / Джапа (мантр, japa) | 3:2 |
| B6 | `walk.jpg` | Прогулка / Природа (прогул, walk, природ) | 3:2 |
| B7 | `sleep.jpg` | Вечер / Сон / Отдых (сон, evening, sleep, отдых) | 3:2 |
| B8 | `gratitude.jpg` | Дневник / Благодарность (дневник, благодар, gratitude) | 3:2 |

Все — **3:2 Landscape (1536×1024)**, папка `apps/mini-app/public/images/categories/`.

**Промпт B1 — Медитация:**
```
A person meditating in lotus position on a wooden deck by a misty mountain
lake at dawn, seen from behind at a respectful distance, soft golden fog
over the water, layered mountain silhouettes. Wide horizontal composition
with generous negative space in the upper half for text overlay.
[СТИЛЬ]
```

**Промпт B2 — Пранаяма (дыхание):**
```
Close-up of a person standing on a rocky shore breathing deeply, eyes
closed, chest open, gentle morning breeze moving light fabric, soft mist
over calm sea behind. Focus on the feeling of breath and air. Wide
horizontal composition. [СТИЛЬ]
```

**Промпт B3 — Цигун / Йога (тело):**
```
Silhouette of a person practicing qigong tai chi movement in a misty
bamboo grove at sunrise, arms in a slow flowing gesture, sunbeams cutting
through the mist between stalks. Wide horizontal composition.
[СТИЛЬ]
```

**Промпт B4 — Чтение:**
```
A cozy reading corner: an open book on a linen blanket beside a steaming
clay cup of tea, warm morning light from a window, a small stack of books
and a mala beads bracelet on the wooden floor. Blurred plants in the
background. Wide horizontal composition. [СТИЛЬ]
```

**Промпт B5 — Мантры / Джапа:**
```
A wooden mala prayer beads with a tassel wrapped around a person's fingers
holding japa beads, warm candlelight, blurred brass singing bowl in the
background on a dark wooden table. Intimate close-up, tactile texture.
Wide horizontal composition. [СТИЛЬ]
```

**Промпт B6 — Прогулка / Природа:**
```
A footpath through a misty green forest with tall trees, soft god rays
falling through morning fog onto moss and ferns, a winding trail inviting
a slow walk. Wide horizontal composition, path leading the eye forward.
[СТИЛЬ]
```

**Промпт B7 — Вечер / Сон:**
```
A tranquil bedroom scene at dusk seen in soft focus: dimmed warm lamp,
crumpled linen bedding in warm sand tones, a single burning candle and
wisps of incense smoke, deep blue twilight outside the window. Wide
horizontal composition. [СТИЛЬ]
```

**Промпт B8 — Дневник / Благодарность:**
```
An open handwritten journal on a wooden desk with a fountain pen resting
on the page, writing illegible (just soft ink strokes), a small vase with
one dried flower, warm side light. View from a gentle high angle. Wide
horizontal composition. [СТИЛЬ]
```

---

## Блок C — Hero-шапка (2 фото)

Фон большой карточки-заголовка на главном экране. Картинка будет под
полупрозрачным градиентом, поэтому нужен мягкий, не пёстрый кадр.
Один кадр для светлой темы, один для тёмной — переключаются автоматически.

| # | Файл | Тема | Соотношение |
|---|------|------|-------------|
| C1 | `hero-dawn.jpg` | светлая (рассвет, туман) | 3:2 |
| C2 | `hero-night.jpg` | тёмная (ночь, звёзды, индиго) | 3:2 |

Оба — **3:2 Landscape (1536×1024)**, папка `apps/mini-app/public/images/hero/`.

**Промпт C1 — Рассвет (светлая тема):**
```
Serene wide landscape at dawn: layers of soft mist over rolling hills,
pale golden sunlight breaking through haze, a few distant birds, pastel
sand-colored sky. Very soft and airy, low contrast, nothing sharp or
distracting, suitable as a calm background under text. Wide horizontal
composition. [СТИЛЬ]
```

**Промпт C2 — Ночь (тёмная тема):**
```
Deep indigo night landscape: a calm mountain lake reflecting a starry sky
with the Milky Way, a thin crescent moon, dark silhouettes of hills on the
horizon. Dark, quiet, low contrast, suitable as a background under light
text. Wide horizontal composition. [СТИЛЬ]
```

---

## Блок D — Фон оверлея таймера (2 фото)

Полноэкранный фон, который видит человек во время практики (телефон,
портретная ориентация). Выбирается по времени суток: утром — рассвет,
вечером — свеча.

| # | Файл | Время | Соотношение |
|---|------|-------|-------------|
| D1 | `timer-morning.jpg` | утро/день (до 18:00) | 2:3 |
| D2 | `timer-night.jpg` | вечер/ночь (после 18:00) | 2:3 |

Оба — **2:3 Portrait (1024×1536)**, папка `apps/mini-app/public/images/timer/`.

**Промпт D1 — Утро:**
```
Vertical portrait composition: a young pine branch with dew drops in the
foreground, sunlit soft mist over a green valley below, distant gentle
mountains fading into pale gold light. Calm, breathing, spacious mood,
vertical composition with the calm area in the lower half where a timer
interface will sit. [СТИЛЬ]
```

**Промпт D2 — Вечер:**
```
Vertical portrait composition: a single burning candle with a warm steady
flame in deep darkness, faint curl of incense smoke above, soft bokeh of
another distant candle. Intimate, quiet, meditative night mood, most of
the frame is deep calm darkness where a timer interface will sit.
[СТИЛЬ]
```

---

## Блок E — Обложки треков Sound Bath (3 фото)

Появятся в панели плеера поющих чаш — по одной на каждый трек, цвет
соответствует чакре. Показываются маленьким кружком и в списке треков.

| # | Файл | Трек | Цвет | Соотношение |
|---|------|------|------|-------------|
| E1 | `root.jpg` | Корневая чакра (нота C) | терракота/красно-коричневый | 1:1 |
| E2 | `heart.jpg` | Сердечная чакра (нота F) | шалфейно-зелёный | 1:1 |
| E3 | `crown.jpg` | Коронная чакра (нота B) | индиго/фиолетовый | 1:1 |

Все — **1:1 Square (1024×1024)**, папка `apps/mini-app/public/images/soundbath/`.

**Промпт E1 — Корневая чакра:**
```
A single brass Tibetan singing bowl with a wooden mallet on dark reddish
terracotta clay, shot from a slightly elevated angle, one gentle ripple of
incense smoke. Warm terracotta and deep red-brown color mood. Square
composition, bowl centered. [СТИЛЬ]
```

**Промпт E2 — Сердечная чакра:**
```
A brass Tibetan singing bowl on a bed of soft sage green moss with a few
small fresh green leaves, morning dew, shot from a slightly elevated
angle. Sage green and soft warm light color mood. Square composition,
bowl centered. [СТИЛЬ]
```

**Промпт E3 — Коронная чакра:**
```
A brass Tibetan singing bowl on dark slate stone under deep twilight sky
with faint stars, thin wisp of smoke rising toward the sky, moody indigo
and violet color mood, subtle warm glow on the bowl's rim. Square
composition, bowl centered. [СТИЛЬ]
```

---

## Сводная таблица

| Блок | Сколько | Соотношение | Папка в проекте |
|------|---------|-------------|------------------|
| A. Аватар бота | 1 | 1:1 | `assets/` (загрузка в BotFather) |
| B. Категории практик | 8 | 3:2 | `apps/mini-app/public/images/categories/` |
| C. Hero-шапка | 2 | 3:2 | `apps/mini-app/public/images/hero/` |
| D. Фон таймера | 2 | 2:3 | `apps/mini-app/public/images/timer/` |
| E. Обложки Sound Bath | 3 | 1:1 | `apps/mini-app/public/images/soundbath/` |
| **Итого** | **16** | | |

## Порядок действий

1. Генерируешь 16 фото в ChatGPT (важно: стилевой блок `[СТИЛЬ]` вставляй
   в каждый промпт — он держит единую палитру приложения).
2. Если у ChatGPT лимит на генерации — можно делать по несколько сессий,
   порядок не важен. Главное — точные имена файлов.
3. Складываешь файлы в `tmp/photos/` в корне проекта (имена как в таблице).
4. Говоришь мне — и я:
   - пережму картинки под нужные размеры (WebP/JPG, разумный вес);
   - разложу по папкам `public/images/...`;
   - подключу категории (расширю маппинг ключевых слов в `api.ts`,
     обновлю `data.ts`);
   - добавлю фон в hero-шапку с автопереключением светлая/тёмная тема;
   - добавлю фон в оверлей таймера с выбором утро/вечер по времени;
   - добавлю обложки в плеер Sound Bath;
   - проверю в браузере: десктоп + мобильный, обе темы, скриншоты.

Коммиты в git делаю только с твоего явного разрешения.
