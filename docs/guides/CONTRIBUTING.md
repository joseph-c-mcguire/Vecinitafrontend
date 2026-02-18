# Frontend Development Guide

## Setup

```bash
cd frontend
npm install
npm run dev
```

The app will be available at `http://localhost:5173`

## 📚 Documentation

Before you start, check out the documentation:

- **[docs/INDEX.md](../INDEX.md)** - Documentation index and overview
- **[README.md](../../README.md)** - Project overview and features
- **[QUICK_START.md](./QUICK_START.md)** - Quick start guide for users
- **[CHATWIDGET_README.md](../reference/CHATWIDGET_README.md)** - ChatWidget component reference
- **[src/examples/WIDGET_USAGE_EXAMPLE.tsx](../../src/examples/WIDGET_USAGE_EXAMPLE.tsx)** - Usage examples

## Testing

```bash
# All tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage

# UI mode
npm run test:ui
```

## Code Standards

### Prettier (Formatter)
```bash
npm run format
```

### ESLint (Linter)
```bash
npm run lint
npm run lint:fix
```

## Project Structure

```
frontend/
├── src/
│   ├── app/                    # React components
│   │   ├── App.tsx             # Root component
│   │   ├── App.css             # Styles
│   │   └── components/
│   │       ├── chat/           # Chat feature
│   │       │   ├── ChatWidget.tsx
│   │       │   ├── MessageBubble.tsx
│   │       │   └── LinkCard.tsx
│   │       └── ui/             # Reusable UI components
│   ├── lib/                    # Utilities & helpers
│   │   ├── api.ts              # API client
│   │   └── utils.ts            # Helper functions
│   ├── styles/                 # Global styles
│   ├── test/                   # Tests
│   └── main.tsx                # Entry point
├── public/                     # Static assets
├── docs/                       # Documentation
├── vite.config.ts              # Vite configuration
├── vitest.config.ts            # Test configuration
├── tsconfig.json               # TypeScript config
├── package.json                # Dependencies
└── README.md
```

## Key Files

- **src/app/App.tsx** - Main React component
- **src/app/components/chat/ChatWidget.tsx** - Chat interface
- **src/lib/api.ts** - Backend API client
- **vite.config.ts** - Build configuration
- **vitest.config.ts** - Test configuration

## Common Tasks

### Add a new component
```bash
# Create component file
touch src/app/components/MyComponent.tsx

# Add test file
touch src/app/components/MyComponent.test.tsx
```

### Update dependencies
```bash
npm install package_name
npm install --save-dev @types/package_name
```

### Run development server
```bash
npm run dev
```

### Build for production
```bash
npm run build
```

### Test with UI
```bash
npm run test:ui
```

## Style Guide

- **Components**: Use functional components with hooks
- **Styling**: Tailwind CSS or CSS modules
- **State**: React hooks (useState, useContext)
- **API**: Use `src/lib/api.ts` for backend calls
- **Types**: Use TypeScript throughout
- **Tests**: Test user interactions, not implementation

## Best Practices

1. **Keep components small and focused**
   - One responsibility per component
   - Extract custom hooks for logic

2. **Use TypeScript properly**
   - Define interfaces for props
   - Use strict mode

3. **Write testable code**
   - Mock API calls
   - Test user interactions
   - Avoid implementation details

4. **Accessibility**
   - Use semantic HTML
   - Add ARIA labels where needed
   - Test keyboard navigation

## Debugging

### React DevTools
```bash
npm install --save-dev @react-devtools/shell
```

### Network debugging
Open browser DevTools → Network tab to inspect API calls

## Environment Variables

Create `.env.local`:
```env
VITE_API_URL=http://localhost:8000
VITE_API_TIMEOUT=10000
```

## Build & Deploy

```bash
# Development build
npm run dev

# Production build
npm run build

# Preview production build locally
npm run preview
```

## Documentation

- [Architecture](../_legacy/ARCHITECTURE_OVERVIEW.md)
- [Backend Integration](../_legacy/BACKEND_INTEGRATION_GUIDE.md)
- [Accessibility](../es/ACCESIBILIDAD.md)
- [Testing Guide](../es/PRUEBAS.md)

## Troubleshooting

### Port 5173 already in use
```bash
npm run dev -- --port 3000
```

### Dependencies out of date
```bash
npm update
npm audit fix
```

### Build fails
```bash
rm -rf node_modules package-lock.json
npm install
npm run build
```
