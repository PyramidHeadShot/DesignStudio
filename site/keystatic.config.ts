import { collection, config, fields, singleton } from '@keystatic/core';

const categories = [
  'Реклама для ресторанов',
  'Дизайн упаковки',
  'Наружная реклама',
  'Полиграфия',
  'Инфографика и маркетплейсы',
  'Рекламные макеты',
];

export default config({
  storage: { kind: 'local' },
  ui: {
    brand: { name: 'АТОМ СЭИЛС — админка' },
    // группа «Контент» + коллекция «Кейсы» — иначе сайдбар дублирует «Кейсы / Кейсы»
    navigation: { Контент: ['cases'], Настройки: ['settings'] },
  },
  collections: {
    cases: collection({
      label: 'Кейсы',
      slugField: 'slug',
      // маска /* обязательна: файл <slug>.yaml в src/content/cases/
      path: 'src/content/cases/*',
      format: { data: 'yaml' },
      schema: {
        title: fields.text({ label: 'Название' }),
        slug: fields.slug({ name: { label: 'Слаг (адрес страницы)' } }),
        category: fields.select({
          label: 'Категория',
          options: categories.map((c) => ({ label: c, value: c })),
          defaultValue: 'Реклама для ресторанов',
        }),
        order: fields.integer({ label: 'Порядок показа', defaultValue: 99 }),
        cover: fields.image({ label: 'Обложка', directory: 'public/images/cases', publicPath: '/images/cases/' }),
        gallery: fields.array(
          fields.image({ label: 'Фото', directory: 'public/images/cases', publicPath: '/images/cases/' }),
          { label: 'Галерея', description: '2–3 фото, крупные' },
        ),
        body: fields.text({ label: 'Текст кейса', multiline: true }),
      },
    }),
  },
  singletons: {
    settings: singleton({
      label: 'Настройки сайта',
      path: 'src/content/settings',
      format: { data: 'json' },
      schema: {
        name: fields.text({ label: 'Название студии', defaultValue: 'АТОМ СЭИЛС' }),
        heroTitle: fields.text({ label: 'Слоган героя', defaultValue: 'Работы, а не слова.' }),
        heroText: fields.text({ label: 'Бегущая строка — услуги, разделитель ◆' }),
        phone: fields.text({ label: 'Телефон', defaultValue: '+7 (927) 891-08-34' }),
        email: fields.text({ label: 'Email', defaultValue: 'hello@example.com' }),
        // Волна AG (фидбек 2026-09-30): контактный блок — все поля необязательные,
        // пустые не рендерятся в футере
        address: fields.text({ label: 'Адрес (необязательно)' }),
        workHours: fields.text({ label: 'Часы работы (необязательно)' }),
        telegram: fields.text({ label: 'Telegram — @ник или ссылка (необязательно)' }),
        vk: fields.text({ label: 'VK — ссылка (необязательно)' }),
      },
    }),
  },
});
