# 🎨 Personal AI Assistant - Frontend Client

Animated, production-grade React client for the Personal AI Assistant RAG platform. Built using **React 19**, **TypeScript**, **Vite**, **Tailwind CSS**, and **Framer Motion**.

---

## ⚡ Quick Start

To run the frontend locally:

```bash
# 1. Install dependencies (first time only)
npm install

# 2. Start Vite development server
npm run dev
```

The frontend will run at: **[http://localhost:5173](http://localhost:5173)**

> 📖 **Full Stack Startup Guide**: For end-to-end setup instructions including the FastAPI backend, see **[RUN_LOCALLY.md](../RUN_LOCALLY.md)** in the project root.

---

## 🛠️ Available Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts local dev server with Hot Module Replacement (HMR) at port `5173`. |
| `npm run build` | Typechecks with TypeScript (`tsc -b`) and generates production bundle in `dist/`. |
| `npm run preview` | Locally previews the production build. |
| `npm run lint` | Runs the Oxlint linter for high-speed code quality checks. |

---

## 📁 Project Structure

```
frontend/src/
├── components/          # Reusable UI components
│   ├── ChatContainer.tsx
│   ├── MessageBubble.tsx
│   ├── KnowledgeDrawer.tsx
│   ├── SettingsModal.tsx
│   └── TopNav.tsx
├── hooks/               # Custom React hooks (e.g. streaming, settings)
├── types/               # TypeScript definitions
├── utils/
│   └── api.ts           # API service client connecting to http://localhost:8000
├── App.tsx              # Main layout & state coordinator
└── main.tsx             # Application entry point
```

---

## ⚙️ Backend Connection

By default, the frontend connects to the backend at `http://localhost:8000`. You can customize this directly in the application by clicking the **Settings (gear icon)** in the UI or by adjusting `DEFAULT_SETTINGS` in [`src/utils/api.ts`](./src/utils/api.ts).
