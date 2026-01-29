---
id: tech-stack
type: reference
status: canonical
related_ids: []
---

# Tech Stack

## Core Language

```typescript
// TypeScript 5.x+
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true
  }
}
```

**Rationale:** Strict mode catches leak-prone patterns at compile time.

## Build System

**Primary:** Vite 5.x

```typescript
interface BuildConfig {
  manifest: "v3";
  targets: ["chrome", "background", "content", "popup"];
  rollupOptions: {
    input: Record<string, string>;
    output: { format: "esm" };
  };
}
```

**Alternative:** Webpack 5.x + crx plugin

**Constraint:** Must support hot reload for content scripts.

## Chrome Extension

**Manifest:** V3 (mandatory)

```typescript
interface RequiredAPIs {
  debugger: {
    permissions: ["debugger"];
    protocol: "Chrome DevTools Protocol 1.3+";
  };
  runtime: {
    methods: ["sendMessage", "onMessage", "getURL"];
  };
  storage: {
    types: ["local", "session"];
    quota: "10MB per area";
  };
  tabs: {
    methods: ["query", "sendMessage", "onUpdated"];
  };
}
```

**Service Worker:** Required for background context (no DOM access).

## Testing

**Unit:** Vitest 1.x

```typescript
interface TestConfig {
  environment: "jsdom" | "node";
  coverage: {
    provider: "v8";
    threshold: { statements: 80 };
  };
  mockChrome: true; // via vitest-webextension-mock
}
```

**E2E:** Puppeteer + chrome-debugging-client

**Constraint:** Must test CDP interactions in real Chrome instance.

## Code Quality

```typescript
interface LintSetup {
  eslint: {
    extends: ["@typescript-eslint/recommended-type-checked"];
    rules: {
      "@typescript-eslint/no-unused-vars": "error";
      "@typescript-eslint/no-floating-promises": "error";
      "no-console": ["warn", { allow: ["error"] }];
    };
  };
  prettier: {
    printWidth: 100;
    semi: true;
    singleQuote: true;
  };
}
```

## Dependencies

**Runtime:**
- None (zero deps preferred for extension bundle)

**Dev:**
- `@types/chrome`
- `typescript`
- `vite` / `vite-plugin-web-extension`
- `vitest`
- `eslint` + `@typescript-eslint/*`
- `prettier`

## Negative Constraints

**DO NOT:**
- Use CommonJS (breaks service workers)
- Bundle React/Vue (unnecessary weight for popup UI)
- Depend on Node.js APIs (incompatible with extension context)
- Use `eval()` or `Function()` (CSP violation in MV3)
- Store credentials in localStorage (use chrome.storage.local with encryption)

## File Structure

```
/
├── src/
│   ├── background/      # Service worker
│   ├── content/         # Content scripts
│   ├── popup/           # Extension UI
│   └── shared/          # Types, utils
├── public/              # manifest.json, icons
└── tests/
```

**Constraint:** Each context (background/content/popup) has isolated module graph.
