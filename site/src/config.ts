// Конфиг сайта. Волна Z: значения читаются из src/content/settings.json
// (синглтон Keystatic — заказчик правит через админку); DEFAULTS — fallback.
// Волна AL: контакты — отдельный синглтон src/content/contacts.json
// (страница «Контакты» + футер).
import siteSettings from './content/settings.json';
import contactSettings from './content/contacts.json';
import companySettings from './content/company.json';

const DEFAULTS = {
  name: 'АТОМ СЭИЛС',
  heroTitle: 'Дизайн, который продаёт',
  heroText:
    'Графический дизайн, дизайн упаковки, полиграфия, наружная реклама, оформление социальных сетей, инфографика и карточки товаров для маркетплейсов',
  phone: '+7 (927) 891-08-34',
  email: 'hello@example.com',
  address: '',
  workHours: '',
  telegram: '',
  vk: '',
};

export const SITE = { ...DEFAULTS, ...siteSettings, ...contactSettings, ...companySettings } as const;
