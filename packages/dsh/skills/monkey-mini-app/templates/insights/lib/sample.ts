export type FeedItem = { title: string; link?: string };

// 内置样例源：默认不走网络，保证离线也能跑起来（教"采样走通全链路"）
export const SAMPLE_ITEMS: FeedItem[] = [
  { title: "TypeScript 5.7 发布：更快的类型检查与更好的模块解析", link: "https://example.com/ts57" },
  { title: "Vite 6 默认启用 Rolldown 路线图", link: "https://example.com/vite6" },
  { title: "React 19：Actions 与 useOptimistic 正式稳定", link: "https://example.com/react19" },
  { title: "CSS 原生嵌套全面落地", link: "https://example.com/css-nest" },
  { title: "Node.js 24 默认启用 SQLite 内置模块", link: "https://example.com/node24" },
  { title: "WebGPU 在 Safari 的进展与局限", link: "https://example.com/webgpu-safari" },
  { title: "Rust 1.85：async 生成器仍在打磨", link: "https://example.com/rust185" },
  { title: "Bun 逐步兼容 npm 生态", link: "https://example.com/bun" },
  { title: "新一版 ECMAScript 提案：RegExp 增强", link: "https://example.com/es-proposal" },
  { title: "AI 编程助手对代码质量的实证研究", link: "https://example.com/ai-code" },
  { title: "PostgreSQL 18 的并行查询改进", link: "https://example.com/pg18" },
  { title: "移动端 3D 渲染的实用技巧", link: "https://example.com/mobile3d" },
];
