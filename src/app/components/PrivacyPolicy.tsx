import React, { useEffect } from 'react';
import { X, Shield } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

interface PrivacyPolicyProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PrivacyPolicy({ isOpen, onClose }: PrivacyPolicyProps) {
  const { language } = useLanguage();

  // Handle Escape key to close
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const content = language === 'es' ? {
    title: 'Política de Privacidad',
    lastUpdated: 'Última actualización: 25 de enero de 2026',
    sections: [
      {
        title: 'Qué Recopilamos',
        content: [
          'Contenido de consultas: El texto que envía a los endpoints del agente/chat.',
          'Metadatos operacionales: Registros básicos (marcas de tiempo, rutas de endpoints, estado de respuesta) para confiabilidad y depuración.',
          'Fuentes de contexto: URLs de documentos y títulos utilizados para generar respuestas (contenido ya público).'
        ],
        noCollect: [
          'Identificadores personales sensibles (a menos que los incluya explícitamente en una consulta).',
          'Ubicación precisa o identificadores de dispositivo.'
        ]
      },
      {
        title: 'Cómo Usamos los Datos',
        content: [
          'Generación de respuestas: El texto de la consulta se procesa temporalmente por un proveedor de LLM (por ejemplo, DeepSeek, Groq, OpenAI o Ollama local) para producir una respuesta.',
          'Recuperación: El texto de la consulta se incorpora y se compara con documentos públicos almacenados para encontrar contexto relevante.',
          'Confiabilidad y seguridad: Los registros mínimos nos ayudan a diagnosticar interrupciones y mejorar el rendimiento.'
        ]
      },
      {
        title: 'Retención de Datos',
        content: [
          'Registros de aplicación: Rotados y retenidos por un período limitado, típicamente 30 días.',
          'Contenido de consulta: No se almacena de forma persistente por defecto. Si el rastreo está habilitado, el contenido puede retenerse para depuración con controles de acceso.'
        ]
      },
      {
        title: 'Proveedores de Terceros',
        content: [
          'Podemos enviar el texto de la consulta y metadatos mínimos a proveedores configurados estrictamente para inferencia:',
          'LLM: DeepSeek, Groq, OpenAI o Ollama local.',
          'Embeddings: Modelos locales de HuggingFace, FastEmbed o un servicio de embeddings auto-hospedado.',
          '',
          'Cada proveedor tiene su propia política de privacidad y términos; el uso se limita a la inferencia.'
        ]
      },
      {
        title: 'Sus Opciones',
        content: [
          'No incluya datos personales o sensibles en las consultas.',
          'Solicite la eliminación de cualquier dato de rastreo retenido contactando a los mantenedores.'
        ]
      },
      {
        title: 'Seguridad',
        content: [
          'Los secretos de entorno (claves API) se almacenan del lado del servidor.',
          'El transporte usa HTTPS cuando está desplegado; use canales seguros para producción.'
        ]
      },
      {
        title: 'Contacto',
        content: [
          'Para preguntas o solicitudes relacionadas con la privacidad, contacte a los mantenedores de Vecinita.'
        ]
      }
    ],
    intro: 'Vecinita procesa consultas de usuarios para proporcionar respuestas y citas relacionadas utilizando Generación Aumentada por Recuperación (RAG). Nos preocupamos por la privacidad y la minimización de datos. Esta política describe qué recopilamos, cómo lo usamos y sus opciones.',
    noCollectTitle: 'No recopilamos:',
    close: 'Cerrar'
  } : {
    title: 'Privacy Policy',
    lastUpdated: 'Last updated: January 25, 2026',
    sections: [
      {
        title: 'What We Collect',
        content: [
          'Query content: The text you send to the agent/chat endpoints.',
          'Operational metadata: Basic logs (timestamps, endpoint paths, response status) for reliability and debugging.',
          'Context sources: Document URLs and titles used to generate answers (already public content).'
        ],
        noCollect: [
          'Sensitive personal identifiers (unless you include them explicitly in a query).',
          'Precise location or device identifiers.'
        ]
      },
      {
        title: 'How We Use Data',
        content: [
          'Answer generation: Query text is temporarily processed by an LLM provider (e.g., DeepSeek, Groq, OpenAI, or local Ollama) to produce an answer.',
          'Retrieval: Query text is embedded and matched against stored public documents to find relevant context.',
          'Reliability and security: Minimal logs help us diagnose outages and improve performance.'
        ]
      },
      {
        title: 'Data Retention',
        content: [
          'Application logs: Rotated and retained for a limited period, typically 30 days.',
          'Query content: Not stored persistently by default. If tracing is enabled, content may be retained for debugging with access controls.'
        ]
      },
      {
        title: 'Third-Party Providers',
        content: [
          'We may send query text and minimal metadata to configured providers strictly for inference:',
          'LLM: DeepSeek, Groq, OpenAI, or local Ollama.',
          'Embeddings: Local HuggingFace models, FastEmbed, or a self-hosted embedding service.',
          '',
          'Each provider has its own privacy policy and terms; usage is limited to inference.'
        ]
      },
      {
        title: 'Your Choices',
        content: [
          'Do not include personal or sensitive data in queries.',
          'Request deletion of any retained tracing data by contacting the maintainers.'
        ]
      },
      {
        title: 'Security',
        content: [
          'Environment secrets (API keys) are stored server-side.',
          'Transport uses HTTPS when deployed; use secure channels for production.'
        ]
      },
      {
        title: 'Contact',
        content: [
          'For privacy-related questions or requests, contact the Vecinita maintainers.'
        ]
      }
    ],
    intro: 'Vecinita processes user queries to provide answers and related citations using Retrieval-Augmented Generation (RAG). We care about privacy and data minimization. This policy describes what we collect, how we use it, and your choices.',
    noCollectTitle: 'We do not collect:',
    close: 'Close'
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="privacy-policy-title"
    >
      <div
        className="bg-card rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-card border-b border-border px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary" aria-hidden="true" />
            </div>
            <div>
              <h2 id="privacy-policy-title" className="text-xl font-semibold text-foreground">
                {content.title}
              </h2>
              <p className="text-sm text-muted-foreground">{content.lastUpdated}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-accent transition-colors"
            aria-label={content.close}
          >
            <X className="w-5 h-5 text-foreground" aria-hidden="true" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          <p className="text-foreground leading-relaxed">
            {content.intro}
          </p>

          {content.sections.map((section, index) => (
            <div key={index} className="space-y-3">
              <h3 className="text-lg font-semibold text-foreground">
                {section.title}
              </h3>
              <ul className="space-y-2">
                {section.content.map((item, itemIndex) => (
                  <li key={itemIndex} className="text-muted-foreground leading-relaxed">
                    {item && (
                      <>
                        {item.startsWith('LLM:') || item.startsWith('Embeddings:') ? (
                          <span className="ml-4">• {item}</span>
                        ) : (
                          <>• {item}</>
                        )}
                      </>
                    )}
                    {!item && <br />}
                  </li>
                ))}
              </ul>
              {section.noCollect && (
                <>
                  <p className="font-medium text-foreground mt-4">{content.noCollectTitle}</p>
                  <ul className="space-y-2">
                    {section.noCollect.map((item, itemIndex) => (
                      <li key={itemIndex} className="text-muted-foreground leading-relaxed">
                        • {item}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
