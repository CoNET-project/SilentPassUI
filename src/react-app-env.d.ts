/// <reference types="react-scripts" />
// 确保 @/ 路径下的图片也能被识别（path alias 与 *.png 的匹配顺序问题）
declare module "@/components/assets/*.png" {
  const src: string;
  export default src;
}

