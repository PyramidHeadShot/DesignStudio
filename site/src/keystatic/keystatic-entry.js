// Волна AO: точка входа UI Keystatic. Конфиг — через virtual:keystatic-config
// (резолвер в astro.config.mjs работает и в dev, и в build) — прямой импорт
// дублирует React/yjs в клиентском графе (проверено 2026-09-30).
// Используется обёрткой src/pages/keystatic.astro (панель предпросмотра).
import { makePage } from '@keystatic/astro/ui';
import config from 'virtual:keystatic-config';

export const Keystatic = makePage(config);
