/**
 * 兼容：`import ... from '@/pages/Home'` 仍指向主仪表盘（与 @/components/Home/Home 相同）。
 * 应用入口门闸与 Splash / Onboarding 已上移至 @/components/AppEntryGate。
 */
export { default } from '@/components/Home/Home'
