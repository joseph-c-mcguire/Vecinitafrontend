# Limpieza Opcional - Archivos no Utilizados

Esta versión simplificada de Vecinita **no utiliza** varios archivos del proyecto original. Estos archivos se han dejado en el proyecto por si deseas restaurar funcionalidades en el futuro, pero puedes eliminarlos de forma segura si deseas un proyecto más limpio.

---

## ⚠️ Advertencia

**No elimines archivos a menos que estés seguro de que no los necesitarás.** Si planeas agregar autenticación o historial de conversaciones en el futuro, es mejor mantenerlos.

---

## 📁 Archivos que Pueden Eliminarse

### Componentes No Utilizados

Ubicación: `/src/app/components/`

```
✓ AuthModal.tsx                    # Modal de autenticación/login
✓ AdminLogin.tsx                   # Login del panel de administrador
✓ AdminAuthModal.tsx               # Modal de autenticación de admin
✓ AdminDashboard.tsx               # Panel de administración completo
✓ ChatHistory.tsx                  # Componente de historial
✓ ChatHistorySidebar.tsx           # Sidebar de historial de chats
✓ AddDocumentModal.tsx             # Modal para agregar documentos (admin)
✓ DocumentViewer.tsx               # Visor de documentos (admin)
✓ PrivacyPolicy.tsx                # Política de privacidad (era para login)
```

**Total a eliminar:** 9 archivos

### Contextos No Utilizados

Ubicación: `/src/app/context/`

```
✓ AuthContext.tsx                  # Contexto de autenticación
```

**Total a eliminar:** 1 archivo

### Hooks No Utilizados

Ubicación: `/src/app/hooks/`

```
✓ useFocusTrap.ts                  # Hook para trap focus (usado en modales de auth)
✓ useKeyboardShortcuts.tsx         # Versión antigua del hook (hay otra versión)
```

**Total a eliminar:** 2 archivos (verificar si useKeyboardShortcuts.tsx se usa)

### Servicios de Backend

Ubicación: `/src/app/services/`

```
✗ chatService.ts                   # MANTENER - Puede ser útil para futura integración
✗ documentService.ts               # MANTENER - Puede ser útil para futura integración
✗ modelRegistry.ts                 # MANTENER - Se usa activamente
✗ ragService.ts                    # MANTENER - Template para futura integración
```

### Configuración de Supabase

Ubicación: `/src/lib/`

```
✗ supabase.ts                      # MANTENER - Necesario para futura integración DB
```

### Documentación de la Versión Original

Ubicación: raíz del proyecto `/`

```
✓ ADMIN_TOKEN_SETUP.md             # Guía de configuración de tokens de admin
✓ BACKEND_INTEGRATION_GUIDE.md     # Guía de integración con DB (versión completa)
✓ ATTRIBUTIONS.md                  # Atribuciones (si es específico de versión completa)
✓ PRUEBAS.md                       # Documentación de pruebas
```

**Nota:** Estos archivos de documentación contienen información valiosa sobre la implementación original. Es mejor mantenerlos como referencia.

### Tests de Funcionalidades Eliminadas

Ubicación: `/src/app/components/__tests__/`

```
? ChatInterface.integration.test.tsx  # Revisar - puede tener tests de auth/historial
✗ LanguageSelector.test.tsx           # MANTENER - Funcionalidad activa
```

Ubicación: `/src/app/services/__tests__/`

```
? chatService.test.ts               # Revisar - puede probar funcionalidad de DB
```

---

## 🔨 Cómo Eliminar de Forma Segura

### Opción 1: Eliminación Manual (Recomendado)

1. **Revisar cada archivo** antes de eliminarlo
2. Buscar si hay importaciones en otros archivos:
   ```bash
   grep -r "AuthModal" src/
   grep -r "AdminDashboard" src/
   ```
3. Eliminar solo si no hay referencias

### Opción 2: Mover a Carpeta de Respaldo

En lugar de eliminar, mueve a una carpeta `_unused/`:

```
mkdir -p _unused/components
mkdir -p _unused/context
mkdir -p _unused/docs

# Mover componentes
mv src/app/components/AuthModal.tsx _unused/components/
mv src/app/components/AdminDashboard.tsx _unused/components/
# ... etc

# Mover contextos
mv src/app/context/AuthContext.tsx _unused/context/

# Mover docs
mv ADMIN_TOKEN_SETUP.md _unused/docs/
mv BACKEND_INTEGRATION_GUIDE.md _unused/docs/
```

---

## ✅ Archivos que DEBES MANTENER

**Nunca elimines estos archivos:**

### Componentes Activos
```
✓ ChatMessage.tsx
✓ MessageFeedback.tsx
✓ SourceCard.tsx
✓ ThemeToggle.tsx
✓ LanguageSelector.tsx
✓ AccessibilityPanel.tsx
✓ BackendSettingsPanel.tsx
✓ KeyboardShortcutsHelp.tsx
✓ SkipToContent.tsx
✓ AccessibleButton.tsx
✓ VisuallyHidden.tsx
```

### Contextos Activos
```
✓ LanguageContext.tsx
✓ AccessibilityContext.tsx
✓ BackendSettingsContext.tsx
```

### Servicios Activos
```
✓ modelRegistry.ts
```

### Configuración del Proyecto
```
✓ package.json
✓ vite.config.ts
✓ vitest.config.ts
✓ postcss.config.mjs
```

### Estilos
```
✓ /src/styles/* (todos los archivos)
```

### Carpeta UI
```
✓ /src/app/components/ui/* (todos los archivos)
```

### Carpeta Figma
```
✓ /src/app/components/figma/* (todos los archivos)
```

### Nueva Documentación
```
✓ README.md (versión nueva)
✓ QUICK_START.md
✓ SIMPLIFICATION_SUMMARY.md
✓ OPTIONAL_CLEANUP.md (este archivo)
```

---

## 📊 Resumen de Espacio

**Espacio potencialmente recuperable:**

- Componentes no usados: ~20-30 KB
- Contextos no usados: ~5 KB
- Documentación antigua: ~50-100 KB
- **Total estimado:** ~75-135 KB

**Nota:** El ahorro de espacio es mínimo. La principal razón para limpiar es mantener el proyecto organizado y reducir confusión.

---

## 🤔 ¿Deberías Limpiar?

### ✅ Sí, si:
- Quieres un proyecto más limpio y fácil de navegar
- Estás seguro de que nunca agregarás autenticación
- Prefieres mantener solo el código activo
- Tienes respaldo del código original

### ❌ No, si:
- Podrías necesitar estas funcionalidades en el futuro
- Quieres referencia del código original
- Prefieres "por si acaso"
- El espacio no es un problema

---

## 💡 Recomendación

**Mantén los archivos por ahora.** El costo de mantenerlos es mínimo y tener el código de referencia puede ser valioso si decides expandir la funcionalidad más adelante.

Si realmente quieres limpiar, usa la **Opción 2** (mover a `_unused/`) en lugar de eliminar permanentemente.

---

## 🔄 Restauración

Si eliminaste archivos y los necesitas:

1. Consulta el historial de Git (si usas control de versiones)
2. Revisa la carpeta `_unused/` si los moviste ahí
3. Consulta el proyecto original de Vecinita completo

---

**Última actualización:** 6 de febrero de 2026
