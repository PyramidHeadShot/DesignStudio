---
name: glm-5-3-flash
description: >
  Мини-справка по GLM-5.3-Flash (Zhipu / z.ai): настройки и параметры для pi/models.json
  и API-вызовов. Главное: thinking управляется reasoning_effort (low / high / max),
  max_completion_tokens пробрасывается модели как есть (ставить с запасом под размышление+ответ),
  контекст 1M, омни-модальность, лицензия MIT. В нашей сборке — рабочая лошадь и дежурный
  исполнитель каскада (cloud-glm). Читай при настройке glm-5.3-flash, при проблемах
  с размышлениями/ответом, и перед сменой дирижёра/дежурного на эту модель.
---

# GLM-5.3-Flash — мини-справка

## Что это
**Zhipu / z.ai GLM-5.3-Flash** — первая нативно мультимодальная модель серии GLM-5.
**320B всего / 18B активных** (MoE), гибридная архитектура sparse + linear attention
(дешёвый длинный контекст), контекст **1M токенов**, **омни-модальность**
(текст / изображения / видео / файлы), лицензия **MIT**.

Model code: `glm-5.3-flash` (и `glm-5.3-flashx` — ускоренный FlashX-тир).

В нашей сборке — **рабочая лошадь**: субагент **`cloud-glm`** (`provod/glm-5.3-flash`) —
дирижёр (оркестратор/роутер) каскада: короткие планы и маршруты; ранее был дежурным исполнителем.

## Ключевые параметры (офиц. docs.z.ai — Core Parameters)
| Параметр | Дефолт | Важно |
|---|---|---|
| `do_sample` | `true` | `false` — жадная/детерминированная выдача (для точных предсказуемых правок) |
| `temperature` | model-dependent | 0.2 — факты/детерминизм, 0.8 — творчество. Менять либо его, либо `top_p`, не оба |
| `top_p` | model-dependent | рекоменд. **0.8–0.95** |
| `max_tokens` (в pi = `maxTokens`) | model-dependent | до **128K** (как у GLM-4.6), рекоменд. ≥1024. **Пробрасывается как есть** — ставь с запасом под размышление+ответ (у нас 128000) |
| `thinking` | `{"type":"enabled"}` | chain-of-thought глубокое размышление (GLM-4.5+) |
| `reasoning_effort` | — | **`low` / `high` / `max`** — глубина размышления (GLM-5.2+) |

> Дефолты `temperature`/`top_p`/`max_tokens` — «model dependent». `max_tokens` не имеет
> потолка над моделью: передаётся как есть, без него модель сама останавливается в своей
> точке. Потолок вывода GLM-4.6 — 128K; у GLM-5.3-flash берём 128000 с запасом
> (если провайдер отвергнет — откатить на 64000).

## Thinking (размышления)
Управляется **`reasoning_effort`: `low` / `high` / `max`** (в pi это thinking-уровни).
Соответствие в `thinkingLevelMap`: `{ low:"low", medium:"low", high:"high", max:"max" }`.
Для глубокого анализа — `high` / `max`; для быстрых ответов — `low`.

Особенность: GLM (в отличие от mimo) **уважает `temperature` в thinking-режиме**.
Наш тюнинг `samplingParamsByThinkingLevel: { "high": { "temperature": 0.3 } }` —
для детерминированных, предсказуемых правок кода на уровне `high`.

## Наш конфиг (`dot-pi-agent/models.json` → `provod/glm-5.3-flash`; polza удалён — переход на provod завершён)
```json
"reasoning": true,
"thinkingLevelMap": { "minimal": null, "low": "low", "medium": "low", "high": "high", "xhigh": null, "max": "max" },
"contextWindow": 1048500,
"maxTokens": 128000,
"input": ["text", "image"],
"samplingParamsByThinkingLevel": { "high": { "temperature": 0.3 } }
```

## Чем хороша / когда брать
- Дешёвый длинный контекст (1M) и агентные/кодовые задачи — основная рабочая лошадь.
- Омни-модальность: принимает картинки, видео, файлы (для vision — см. `image-context-limits`).
- MIT — можно использовать в коммерческих проектах (студия).

## Ссылки
- Обзор: https://z.ai/blog/glm-5.3-flash
- Доки Z.AI (Chat Completion API): https://docs.z.ai
- Hugging Face: https://huggingface.co/zai-org/GLM-5.3-Flash
