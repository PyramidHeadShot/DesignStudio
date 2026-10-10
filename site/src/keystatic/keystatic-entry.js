// Волна AC: точка входа UI Keystatic (как внутренний keystatic-page.js
// официального плагина, но реэкспортируемая через правильный exports-путь
// '@keystatic/astro/ui' — сам internal/keystatic-page.js из exports-маппы
// пакета не импортируется). Используется обёрткой keystatic-page.astro,
// которая добавляет панель предпросмотра.
import { makePage } from '@keystatic/astro/ui';
import config from 'virtual:keystatic-config';

export const Keystatic = makePage(config);
