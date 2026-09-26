---
name: image-gen-flux
description: >
  Генерация изображений на локальном ПК без облаков и без API: FLUX.2-klein-9B
  Q8_0 (+ энкодер Qwen3-8B Q8_0 + flux2-vae) через sd-cli (stable-diffusion.cpp,
  Vulkan, RX 6800 16 ГБ). Три режима: напрямую на ПК; с НОУТА по SSH
  (Vladimir@100.68.240.52) с записью PNG в единый хаб синка `C:\Yandex.Disk\sync-hub\<проект>\outbox\...`; без SSH — task-файл в
  `sync-hub/<проект>/inbox/` (выполнит дежурный агент ПК). Читай, когда
  нужно сгенерировать картинку, иллюстрацию, мокап, концепт-виз, иконку-заготовку
  или любую 512–1024px графику для проекта.
---

# image-gen-flux — локальная генерация картинок (FLUX.2-klein-9B)

Стек установлен 26.09.2026, всё в `C:\AI\image-gen\` (SSD ПК):

| Компонент | Путь | Размер |
|---|---|---|
| sd-cli (win-vulkan, master-2f88688) | `C:\AI\image-gen\bin\sd-bin\sd-cli.exe` | — |
| Диффузор FLUX.2-klein-9B Q8_0 | `C:\AI\image-gen\models\diffusion_models\flux-2-klein-9b-Q8_0.gguf` | 9 978 304 800 |
| Текст-энкодер Qwen3-8B Q8_0 | `C:\AI\image-gen\models\text_encoders\Qwen3-8B-Q8_0.gguf` | 8 709 519 168 |
| VAE | `C:\AI\image-gen\models\vae\flux2-vae.safetensors` | 336 211 292 |

Команда запуска (базовая, также в `C:\AI\image-gen\README.md`):

```
C:\AI\image-gen\bin\sd-bin\sd-cli.exe
  --diffusion-model C:\AI\image-gen\models\diffusion_models\flux-2-klein-9b-Q8_0.gguf
  --vae C:\AI\image-gen\models\vae\flux2-vae.safetensors
  --llm C:\AI\image-gen\models\text_encoders\Qwen3-8B-Q8_0.gguf
  -p "PROMPT" --cfg-scale 1.0 --steps 4 -W 512 -H 512
  --diffusion-fa --offload-to-cpu -o OUT.png
```

- `--offload-to-cpu` ОБЯЗАТЕЛЕН: модели ~17.7 ГБ > 16 ГБ VRAM (RX 6800). Без него — OOM.
- Энкодер для FLUX.2 — Qwen3-8B (флаг `--llm`), НЕ T5. VAE — flux2-vae (один и тот же для klein).
- Проверено 26.09.2026: PNG 512×512 создан, GPU находится автоматически (Vulkan0 = AMD RX 6800).

## Скорость и параметры

- Базовые параметры: `--steps 4 --cfg-scale 1.0` (klein distilled).
- 512px: ≈20 с чистой диффузии; холодный прогон ≈30–40 с (загрузка моделей с SSD).
- 1024px: ≈×4 времени диффузии (~80 с).
- Для лучшего качества: `--steps 8`, 768–1024px; теги качества в промпте.
- FLUX.2-dev (не klein) — НЕ установлен; качать только как явный эксперимент (тяжёлый и медленный).
- Результат — файл. НЕ читать PNG в историю сессии: лимит картинок
  (см. скилл `image-context-limits`: максимум 4 изображения на запрос).

## Режим А: работа на ПК (код выполняется на ПК)

Прогон выше напрямую (из cmd/PowerShell; из Git Bash — обычные слэши `C:/AI/...`).
Выходной PNG пиши в `sync-hub/<проект>/outbox/<задача>/` (хаб синка), если задача пришла через хаб.

## Режим Б: с НОУТА через SSH (основной)

Модели ПК с ноутбука доступны только по SSH: `ssh Vladimir@100.68.240.52`
(ключ настроен, без пароля). PNG пиши в папку синка проекта на ПК — файл сам
приедет на ноут через синк YandexDisk.

```bash
ssh Vladimir@100.68.240.52 "C:\AI\image-gen\bin\sd-bin\sd-cli.exe
  --diffusion-model C:\AI\image-gen\models\diffusion_models\flux-2-klein-9b-Q8_0.gguf
  --vae C:\AI\image-gen\models\vae\flux2-vae.safetensors
  --llm C:\AI\image-gen\models\text_encoders\Qwen3-8B-Q8_0.gguf
  -p \"PROMPT\" --cfg-scale 1.0 --steps 4 -W 512 -H 512
  --diffusion-fa --offload-to-cpu -o C:\Yandex.Disk\sync-hub\<проект>\outbox\<задача>\result.png"
```

YandexDisk синкает только явно указанные папки — обмен идёт через ЕДИНЫЙ хаб
`sync-hub/` (протокол: `C:\Yandex.Disk\sync-hub\README.md`; в папках проектов
`sync/` НЕ создаётся). Пути хаба на обеих машинах:

| Машина | Корень YandexDisk | Путь результата |
|---|---|---|
| ПК | `C:\Yandex.Disk\` | `C:\Yandex.Disk\sync-hub\<проект>\outbox\<задача>\result.png` |
| НОУТ | `C:\Users\y120562\YandexDisk\` | `C:\Users\y120562\YandexDisk\sync-hub\<проект>\outbox\<задача>\result.png` |

Грабли: если команда запускается из Git Bash на ноутбуке — обёртка MSYS
конвертирует флаги вида `/E` и пути; при необходимости ставь `MSYS_NO_PATHCONV=1`.
Внутри `ssh "..."` бэкслэши сохраняются, но `\"` для вложенных кавычек промпта
обязателен.

## Режим В: без SSH — задача через sync-hub/inbox

SSH недоступен → оставь `C:\Yandex.Disk\sync-hub\<проект>\inbox\<YYYYMMDD-hhmm-<slug>>\task.md`
(что нарисовать, размер, шаги, куда класть результат). Дежурный агент ПК
выполнит и положит PNG + маркер в `sync-hub/<проект>/outbox/<имя>/`. Протокол —
`sync-hub/README.md` (корень синка).

## Новые веса и грабли

- Скачивать ТОЛЬКО квант Q8_0 (требование заказчика) и ТОЛЬКО с ModelScope:
  `https://modelscope.cn/models/<owner>/<repo>/resolve/master/<file>`
  (HF CDN резетится провайдером; hf-mirror глючит).
- Загрузчик: `C:\AI\image-gen\tools\gguf-segment-download.mjs` (10 сегментов,
  curl.exe по полному пути, resume по range; PID качалок → `tools/dl.pids`;
  НИКОГДА не убивать процессы по чужим PID).
- Замена текста с бэкслэшами: обёртка bash теряет `\` в `node -e` —
  использовать `String.fromCharCode(92)` (пример: `tools/fix-paths.js`).
- Подробности установки и замеров: `C:\AI\image-gen\README.md`.
