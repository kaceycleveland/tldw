# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an NX monorepo called "TLDW" that contains a Chrome extension built with TypeScript, React, Vite, and Tailwind CSS. The project integrates with Supabase for backend services and includes AI-powered features using Google Gemini.

### Monorepo Structure

```
tldw/
├── apps/
│   └── chrome-extension/          # Main Chrome extension application
│       ├── src/
│       │   ├── background.ts      # Service worker
│       │   ├── content.ts         # Content script
│       │   ├── sidepanel.tsx      # React sidepanel UI
│       │   ├── components/        # React components
│       │   ├── contexts/          # React contexts (Auth, etc.)
│       │   └── lib/              # Utilities and Supabase client
│       ├── public/               # Static assets and manifest
│       └── vite.config.ts        # Vite build configuration
├── supabase/
│   ├── functions/                # Supabase Edge Functions
│   │   ├── generate-embeddings/  # AI embedding generation
│   │   └── similarity-search/    # Vector similarity search
│   └── migrations/               # Database schema migrations
├── libs/                         # Shared libraries (empty currently)
├── nx.json                       # NX workspace configuration
├── pnpm-workspace.yaml          # pnpm workspace definition
└── tsconfig.base.json           # Shared TypeScript configuration
```

### Chrome Extension Components

- **Background script** (`apps/chrome-extension/src/background.ts`): Service worker handling extension lifecycle and message passing
- **Content script** (`apps/chrome-extension/src/content.ts`): Injected into web pages, displays notifications and handles page interactions  
- **Sidepanel** (`apps/chrome-extension/src/sidepanel.html` + `apps/chrome-extension/src/sidepanel.tsx`): Extension sidepanel UI with React and Tailwind styling
- **Authentication** (`apps/chrome-extension/src/contexts/AuthContext.tsx`): Supabase Auth integration
- **Embeddings** (`apps/chrome-extension/src/lib/embeddings.ts`): AI-powered text embeddings functionality

## Development Commands

- `pnpm dev` - Build and watch Chrome extension for changes during development
- `pnpm build` - Full TypeScript compilation and production build of Chrome extension
- `pnpm preview` - Preview the built extension
- `nx run chrome-extension:dev` - Direct NX command to run Chrome extension in dev mode
- `nx run chrome-extension:build` - Direct NX command to build Chrome extension

## Architecture

This is an NX monorepo with pnpm workspace management and Supabase backend integration:

### Workspace Management
- **Monorepo Tool**: NX with workspace configuration in `nx.json` (default project: `chrome-extension`)
- **Package Management**: pnpm with workspace definition in `pnpm-workspace.yaml` covering `apps/*` and `libs/*`
- **TypeScript**: Shared base configuration in `tsconfig.base.json` with project-specific overrides

### Chrome Extension Architecture
- **Build System**: Vite handles TypeScript compilation and bundling with custom plugins
- **Styling**: Tailwind CSS with PostCSS processing
- **Frontend Framework**: React with TypeScript for sidepanel UI
- **Communication**: Chrome runtime messaging API between sidepanel, content script, and background
- **Output Structure**: Custom Vite plugin moves sidepanel.html to root of dist/ and cleans up directory structure

### Backend & AI Integration
- **Database**: Supabase PostgreSQL with vector embeddings support
- **Authentication**: Supabase Auth with React UI components
- **Edge Functions**: Deno-based Supabase functions for AI processing:
  - `generate-embeddings`: Creates text embeddings using Google Gemini
  - `similarity-search`: Performs vector similarity searches
- **AI Model**: Google Gemini API for text analysis and embedding generation

## Key Build Configuration

The Chrome extension's Vite config (`apps/chrome-extension/vite.config.ts`) uses multiple entry points and a custom plugin to restructure the built files:
- Sidepanel HTML is moved from `dist/src/sidepanel.html` to `dist/sidepanel.html`
- JavaScript files use clean naming without hashes
- Public directory contents (manifest.json) are copied to dist/

## Extension Permissions

The manifest.json configures:
- `activeTab` permission for current tab access
- `storage` permission for extension data
- `sidePanel` permission for side panel functionality
- Content script runs on `<all_urls>`
- Service worker background script