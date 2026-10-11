---
name: provod
description: >
  Мини-справка по проводнику provod.ai (наш основной API-провайдер): базовый URL,
  Bearer-ключ, форматы Chat Completions / Responses / Anthropic Messages, каталог
  /v1/models с supported_parameters (правило: что модель принимает — решает каталог,
  а не гадание), тарифы в рублях, лимиты расходов. Ключевое для настройки моделей:
  у mimo-v2.6-pro поле вывода — max_tokens (не max_completion_tokens), thinking
  управляется reasoning + reasoning_effort + include_reasoning (thinkingLevelMap →
  reasoning_effort), temperature/top_p в thinking форсится моделью. Читай при настройке
  моделей provod, при ошибках запросов/обрезке, и перед сменой дирижёра/дежурного.
---

# provod.ai — наш проводник (мини-справка)

## Суть
**provod.ai** — российская мультимодальная AI-платформа (чат, API, картинки, видео,
coding-интеграции) с общим предоплаченным балансом **в рублях**. Юрлицо публично,
есть оферта/152-ФЗ — годится для юридически оформленной работы. Работает без VPN.

- **Base URL:** `https://api.provod.ai/v1`
- **Auth:** `Authorization: Bearer <PROVOD_API_KEY>` (ключ из `app.provod.ai/api-keys`, повторно не показывается).
- **Форматы:** OpenAI **Chat Completions**, OpenAI **Responses**, **Anthropic Messages**.
- Один и тот же ключ и одни и те же `model id` для всех форматов.

## Правило №1: каталог решает, а не гадание
Что конкретная модель принимает — смотри в **`GET /v1/models`**, поле `supported_parameters`.
Фильтр для чата: `?output_modalities=text&supported_parameters=max_tokens`. Не копируй
старые списки и не угадывай параметры — сверяйся с живым каталогом.

## Модели, которые мы используем (из каталога проводника)
| Модель | context_length | thinking/reasoning | поле вывода |
|---|---|---|---|
| **mimo-v2.6-pro** (специалист/эскалация) | 1 048 576 | `reasoning`, `reasoning_effort`, `include_reasoning` | `max_tokens` |
| **mimo-v2.6-flash** (дежурный рутины) | 1 048 576 | `reasoning`, `reasoning_effort` (в конфиге reasoning выключен — рутина без размышлений) | `max_tokens` |
| **glm-5.3-flash** (дежурный/cloud-glm) | 1 048 576 | `reasoning`, `reasoning_effort`, `include_reasoning` | `max_tokens` |

Ввод mimo: text / image / **video / audio** (омни). Вывод — text.

## Настройка моделей через проводник (важное для models.json)
- **`max_tokens`** (не `max_completion_tokens`!) — потолок вывода. Ставь высоко (у нас 128000):
  размышление + ответ делят этот лимит, недостаток = «прерывание размышления» / `finish_reason: length`.
- **Thinking** управляется тройкой: `reasoning` (вкл), `reasoning_effort` (глубина),
  `include_reasoning` (вернуть reasoning в выводе). В pi это `reasoning: true` + `thinkingLevelMap`.
- **`thinkingLevelMap` → `reasoning_effort`** (код pi: `effortMap = model.reasoning ? model.thinkingLevelMap : …`).
  Значения `low/high/max` — как у GLM-5.2+ (проверено в каталоге: `reasoning_effort` поддержан и у mimo, и у glm-5.3).
  Поэтому `thinkingLevelMap` для mimo **нужен** (это не temperature).
- **`temperature`/`top_p`** — поддерживаются, но у mimo в thinking-режиме **форсится моделью** (1.0/0.95).
- Прочие: `frequency_penalty`, `presence_penalty`, `repetition_penalty`, `min_p`, `top_k`, `seed`, `stop`, `response_format`, `structured_outputs`, `tools`/`tool_choice`. **Важно (промерено curl, 28.09): каталог и роутинг расходятся.** glm-5.3-flash НЕ принимает ни одного сэмплинг-параметра (`frequency_penalty`, `presence_penalty`, `repetition_penalty`, `top_k`, `min_p`) — каждый даёт 503 MODEL_NOT_AVAILABLE; mimo-v2.6-flash принимает freq/presence, но не repetition (400); mimo-v2.6-pro принимает всю тройку.

## Responses API (отдельный формат, `POST /v1/responses`)
OpenAI-совместимый, `https://api.provod.ai/v1/responses`. Что умеет:
- ввод: текст + графика; `function tools`; структурированный вывод; стрим **SSE**.
- **переносимая история:** `previous_response_id` (продолжить ответ) или `conversation`.
  ⚠️ В одном запросе — либо `previous_response_id`, либо `conversation`, **не оба**.
- управление состоянием: `GET /v1/responses/{id}`, `GET …/input_items`, `DELETE …/{id}`.
- **`Idempotency-Key`** — чтобы повтор после сетевого сбоя не создал дубль-ответ.
- стрим: события Responses SSE; результат финальный только после `response.completed` /
  `response.failed` / `response.incomplete`.
- ответ: текст ассистента в `output[]` (message → `output_text`).

## Быстрый старт (chat)
```bash
export PROVOD_API_KEY="sk_..."
# модель из каталога (не угадывай):
curl -s "https://api.provod.ai/v1/models?output_modalities=text&supported_parameters=max_tokens" \
  -H "Authorization: Bearer $PROVOD_API_KEY"
# запрос:
curl -s https://api.provod.ai/v1/chat/completions \
  -H "Authorization: Bearer $PROVOD_API_KEY" -H "Content-Type: application/json" \
  -d '{"model":"<ID>","messages":[{"role":"user","content":"Reply with ok"}],"max_tokens":64,"stream":false}'
```
Ответ: `choices[0].message.content`. Ошибки — структурированный JSON проводника (виден при `curl --fail-with-body`).

## Тарифы / расходы / лимиты
- Баланс общий, предоплата в рублях; тарифы — `/ru/pricing`, факты по расходу — `/ru/docs/usage-costs`.
- Кэш и **токены рассражений** (reasoning) тарифицируются — глубокие размышления стоят денег.
- **Лимит расходов на ключ:** `/ru/docs/spend-limits` — задать лимит в рублях (для ключа проекта).

## Источники (актуальное брать отсюда)
- Документация: `https://provod.ai/ru/docs` (Chat Completions, **Responses**, Anthropic Messages).
- Каталог моделей: `GET /v1/models` (или `/ru/models`) — id, context_length, supported_parameters, цены.
- В проекте: `provod.md` (быстрый старт), `.tmp/provod-models.json` (снимок каталога).
