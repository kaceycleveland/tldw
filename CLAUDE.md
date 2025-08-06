# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Chrome extension called "TLDW" built with TypeScript, Vite, and Tailwind CSS. The extension uses Manifest V3 and consists of three main components:

- **Background script** (`src/background.ts`): Service worker handling extension lifecycle and message passing
- **Content script** (`src/content.ts`): Injected into web pages, displays notifications and handles page interactions  
- **Popup** (`src/popup.html` + `src/popup.ts`): Extension popup UI with Tailwind styling

## Development Commands

- `npm run dev` - Build and watch for changes during development
- `npm run build` - Full TypeScript compilation and production build
- `npm run preview` - Preview the built extension

## Architecture

The extension follows Chrome Extension Manifest V3 architecture:

- **Build System**: Vite handles TypeScript compilation and bundling with custom plugins
- **Styling**: Tailwind CSS with PostCSS processing
- **Communication**: Chrome runtime messaging API between popup, content script, and background
- **Output Structure**: Custom Vite plugin moves popup.html to root of dist/ and cleans up directory structure

## Key Build Configuration

The Vite config (`vite.config.ts`) uses multiple entry points and a custom plugin to restructure the built files:
- Popup HTML is moved from `dist/src/popup.html` to `dist/popup.html`
- JavaScript files use clean naming without hashes
- Public directory contents (manifest.json) are copied to dist/

## Extension Permissions

The manifest.json configures:
- `activeTab` permission for current tab access
- `storage` permission for extension data
- Content script runs on `<all_urls>`
- Service worker background script