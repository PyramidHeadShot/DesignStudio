// Конфиг сайта. Волна Z: значения читаются из src/content/settings.json
// (синглтон Keystatic — заказчик правит через админку); DEFAULTS — fallback.
import siteSettings from './content/settings.json';

const DEFAULTS = {
  name: 'АТОМ СЭИЛС',
  heroTitle: 'Работы, а не слова.',
  heroText:
    'Графический дизайн, дизайн упаковки, полиграфия, наружная реклама, оформление социальных сетей, инфографика и карточки товаров для маркетплейсов',
  phone: '+7 (927) 891-08-34',
  email: 'hello@example.com',
};

export const SITE = { ...DEFAULTS, ...siteSettings } as const;
