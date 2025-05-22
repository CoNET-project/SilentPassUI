import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// 导入翻译资源（手动或动态导入）
import translationEn from './locales/en/translation.json';
import translationZh from './locales/zh/translation.json';

// 定义资源类型
const resources = {
    en: {
        translation: translationEn,
    },
    zh: {
        translation: translationZh,
    },
} as const;

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources,
        fallbackLng: 'en',
        interpolation: {
            escapeValue: false,
        },
    });

export default i18n;
