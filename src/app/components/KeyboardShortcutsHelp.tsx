import React, { useState } from 'react';
import { useLanguage } from '@/app/context/LanguageContext';
import { Keyboard, X } from 'lucide-react';

interface Shortcut {
  keys: string[];
  description: string;
}

/**
 * Componente de ayuda de atajos de teclado
 */
export function KeyboardShortcutsHelp() {
  const { language } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);

  const shortcuts: Shortcut[] = [
    {
      keys: ['Alt', 'N'],
      description: language === 'es' ? 'Nueva conversación' : 'New conversation',
    },
    {
      keys: ['Alt', 'H'],
      description: language === 'es' ? 'Alternar historial' : 'Toggle history',
    },
    {
      keys: ['Alt', 'S'],
      description: language === 'es' ? 'Abrir configuración' : 'Open settings',
    },
    {
      keys: ['Enter'],
      description: language === 'es' ? 'Enviar mensaje' : 'Send message',
    },
    {
      keys: ['Shift', 'Enter'],
      description: language === 'es' ? 'Nueva línea' : 'New line',
    },
    {
      keys: ['Escape'],
      description: language === 'es' ? 'Cerrar modal/panel' : 'Close modal/panel',
    },
    {
      keys: ['Tab'],
      description: language === 'es' ? 'Navegar adelante' : 'Navigate forward',
    },
    {
      keys: ['Shift', 'Tab'],
      description: language === 'es' ? 'Navegar atrás' : 'Navigate backward',
    },
    {
      keys: ['↑', '↓'],
      description: language === 'es' ? 'Navegar listas' : 'Navigate lists',
    },
    {
      keys: ['?'],
      description: language === 'es' ? 'Mostrar esta ayuda' : 'Show this help',
    },
  ];

  // Escuchar la tecla ? para abrir la ayuda
  React.useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === '?' && !event.ctrlKey && !event.altKey && !event.metaKey) {
        const target = event.target as HTMLElement;
        // Solo abrir si no estamos en un input/textarea
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
          event.preventDefault();
          setIsOpen(true);
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 p-3 bg-[#4DB8B8] text-white rounded-full shadow-lg hover:bg-[#3da8a8] transition-colors focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#4DB8B8]"
        aria-label={language === 'es' ? 'Mostrar atajos de teclado' : 'Show keyboard shortcuts'}
        title={language === 'es' ? 'Atajos de teclado (?)' : 'Keyboard shortcuts (?)'}
      >
        <Keyboard className="w-5 h-5" />
      </button>
    );
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={() => setIsOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-title"
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
          <h2 id="shortcuts-title" className="text-xl font-semibold text-gray-900 dark:text-white">
            <Keyboard className="inline-block w-5 h-5 mr-2" />
            {language === 'es' ? 'Atajos de Teclado' : 'Keyboard Shortcuts'}
          </h2>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-[#4DB8B8]"
            aria-label={language === 'es' ? 'Cerrar' : 'Close'}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <div className="space-y-3">
            {shortcuts.map((shortcut, index) => (
              <div
                key={index}
                className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0"
              >
                <span className="text-gray-700 dark:text-gray-300">
                  {shortcut.description}
                </span>
                <div className="flex items-center gap-1">
                  {shortcut.keys.map((key, keyIndex) => (
                    <span key={keyIndex} className="flex items-center gap-1">
                      <kbd className="px-2 py-1 text-sm font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg dark:bg-gray-700 dark:text-gray-100 dark:border-gray-600">
                        {key}
                      </kbd>
                      {keyIndex < shortcut.keys.length - 1 && (
                        <span className="text-gray-500 dark:text-gray-400">+</span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>
                {language === 'es' ? 'Consejo:' : 'Tip:'}
              </strong>{' '}
              {language === 'es'
                ? 'Presiona ? en cualquier momento para ver esta ayuda.'
                : 'Press ? at any time to see this help.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}