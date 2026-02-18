# Guía de Pruebas para el Chatbot RAG Vecinita

Este documento describe la infraestructura de pruebas y cómo ejecutar las pruebas para la aplicación del chatbot Vecinita.

## Pila de Pruebas

- **Vitest**: Ejecutor de pruebas moderno y rápido para proyectos Vite
- **React Testing Library**: Utilidades para pruebas de componentes
- **jsdom**: Implementación DOM para Node.js
- **MSW (Mock Service Worker)**: Simulación de API para pruebas de integración
- **@testing-library/user-event**: Simula interacciones de usuario

## Ejecutar Pruebas

### Ejecutar todas las pruebas
```bash
npm test
```

### Ejecutar pruebas en modo vigilancia
```bash
npm run test:watch
```

### Ejecutar pruebas con interfaz visual
```bash
npm run test:ui
```

### Ejecutar pruebas con cobertura
```bash
npm run test:coverage
```

## Estructura de Pruebas

```
src/
├── app/
│   ├── components/
│   │   └── __tests__/
│   │       ├── LanguageSelector.test.tsx
│   │       └── ChatInterface.integration.test.tsx
│   └── services/
│       └── __tests__/
│           ├── chatService.test.ts
│           ├── documentService.test.ts
│           └── ragService.test.ts
└── test/
    └── setup.ts
```

## Categorías de Pruebas

### 1. Pruebas Unitarias
Prueban funciones y componentes individuales de forma aislada.

**Ejemplo:**
```typescript
// chatService.test.ts
describe('ChatService', () => {
  it('debería crear una nueva sesión de chat', async () => {
    const session = await ChatService.createSession({ title: 'Prueba' });
    expect(session.title).toBe('Prueba');
  });
});
```

### 2. Pruebas de Componentes
Prueban componentes React con interacciones de usuario.

**Ejemplo:**
```typescript
// LanguageSelector.test.tsx
it('debería cambiar el idioma cuando se selecciona una opción', () => {
  renderWithProvider();
  const select = screen.getByRole('combobox');
  fireEvent.change(select, { target: { value: 'en' } });
  expect(select.value).toBe('en');
});
```

### 3. Pruebas de Integración
Prueban múltiples componentes o servicios trabajando juntos.

**Ejemplo:**
```typescript
// ChatInterface.integration.test.tsx
it('debería enviar mensaje cuando se hace clic en el botón de enviar', async () => {
  // Prueba el flujo completo de envío de mensajes
});
```

## Mejores Prácticas de Pruebas

### 1. Prueba el Comportamiento del Usuario, No la Implementación
```typescript
// ❌ Mal - prueba detalles de implementación
expect(component.state.isOpen).toBe(true);

// ✅ Bien - prueba comportamiento visible para el usuario
expect(screen.getByText('Contenido del Modal')).toBeInTheDocument();
```

### 2. Usa Consultas Semánticas
```typescript
// Preferir en este orden:
screen.getByRole('button', { name: /enviar/i })
screen.getByLabelText('Correo electrónico')
screen.getByPlaceholderText('Ingresa tu correo')
screen.getByText('Bienvenido')
```

### 3. Pruebas Asíncronas
```typescript
// Esperar a que aparezcan elementos
await waitFor(() => {
  expect(screen.getByText('¡Cargado!')).toBeInTheDocument();
});

// O usar consultas findBy (que esperan automáticamente)
const element = await screen.findByText('¡Cargado!');
```

### 4. Simular Dependencias Externas
```typescript
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: { getUser: vi.fn() },
  },
}));
```

## Objetivos de Cobertura

Aspirar a:
- **80%+** de cobertura general de código
- **90%+** para lógica de negocio crítica (servicios)
- **70%+** para componentes UI
- **100%** para funciones utilitarias

## Patrones Comunes de Pruebas

### Probar Formularios
```typescript
it('debería validar la entrada del formulario', async () => {
  const user = userEvent.setup();
  render(<MiFormulario />);
  
  const input = screen.getByLabelText('Correo electrónico');
  await user.type(input, 'correo-invalido');
  await user.click(screen.getByRole('button', { name: /enviar/i }));
  
  expect(screen.getByText('Correo electrónico inválido')).toBeInTheDocument();
});
```

### Probar Operaciones Asíncronas
```typescript
it('debería cargar datos al montar', async () => {
  render(<ComponenteDatos />);
  
  expect(screen.getByText('Cargando...')).toBeInTheDocument();
  
  await waitFor(() => {
    expect(screen.getByText('Datos cargados')).toBeInTheDocument();
  });
});
```

### Probar Estados de Error
```typescript
it('debería mostrar mensaje de error al fallar', async () => {
  vi.mocked(api.obtenerDatos).mockRejectedValue(new Error('Falló'));
  
  render(<Componente />);
  
  await waitFor(() => {
    expect(screen.getByText(/error/i)).toBeInTheDocument();
  });
});
```

## Depurar Pruebas

### 1. Usar screen.debug()
```typescript
it('prueba de depuración', () => {
  render(<Componente />);
  screen.debug(); // Imprime el DOM actual
});
```

### 2. Usar bandera --inspect
```bash
node --inspect-brk ./node_modules/.bin/vitest
```

### 3. Verificar tiempo de espera
```typescript
it('prueba de larga duración', async () => {
  // Aumentar tiempo de espera para esta prueba
}, { timeout: 10000 });
```

## Integración Continua

Las pruebas se ejecutan automáticamente en:
- Pull requests
- Pushes a la rama principal
- Verificaciones pre-despliegue

## Recursos Adicionales

- [Documentación de Vitest](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Mejores Prácticas de Pruebas](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
