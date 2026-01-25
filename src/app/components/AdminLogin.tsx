import React, { useState } from 'react';
import { Shield, Lock, AlertCircle, Loader2 } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

interface AdminLoginProps {
  onClose: () => void;
  onAdminVerified: () => void;
}

// Utility to hash the token using SHA-256
async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function AdminLogin({
  onClose,
  onAdminVerified,
}: AdminLoginProps) {
  const { language } = useLanguage();
  const [token, setToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Handle Escape key to close
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!token) {
      setError(language === 'es' 
        ? 'Por favor ingrese el token de administrador' 
        : 'Please enter the admin token');
      return;
    }

    setIsLoading(true);

    try {
      // Hash the provided token
      const hashedToken = await hashToken(token);
      
      // Get the expected hash from environment variable
      const expectedHash = import.meta.env.VITE_ADMIN_TOKEN_HASH;
      
      if (!expectedHash) {
        setError(language === 'es'
          ? 'Error de configuración: Token de administrador no configurado'
          : 'Configuration error: Admin token not configured');
        setIsLoading(false);
        return;
      }
      
      // Compare hashes
      if (hashedToken === expectedHash) {
        // Success - token is valid
        // Store validation in sessionStorage (only for current session)
        sessionStorage.setItem('admin_authenticated', 'true');
        onAdminVerified();
      } else {
        setError(language === 'es'
          ? 'Token inválido'
          : 'Invalid token');
      }
      
    } catch (err) {
      console.error('Admin authentication error:', err);
      setError(language === 'es'
        ? 'Error al verificar el token. Por favor inténtelo de nuevo.'
        : 'Error verifying token. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md">
        <div className="bg-card rounded-lg shadow-xl border border-border overflow-hidden">
          {/* Header */}
          <div className="bg-primary/10 border-b border-border p-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center">
                  <Shield className="w-6 h-6 text-primary-foreground" aria-hidden="true" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-foreground">
                    {language === 'es' ? 'Panel de Administración' : 'Admin Panel'}
                  </h1>
                  <p className="text-sm text-muted-foreground">
                    Vecinita RAG Chatbot
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-accent transition-colors"
                aria-label={language === 'es' ? 'Volver' : 'Go back'}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-foreground"
                  aria-hidden="true"
                >
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <p className="text-sm text-muted-foreground">
              {language === 'es'
                ? 'Inicie sesión con sus credenciales de administrador'
                : 'Sign in with your admin credentials'}
            </p>

            {/* Token */}
            <div className="space-y-2">
              <label htmlFor="admin-token" className="text-sm text-muted-foreground">
                {language === 'es' ? 'Token de Administrador' : 'Admin Token'}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
                <input
                  id="admin-token"
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  disabled={isLoading}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                  required
                />
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-destructive/10 rounded-lg border border-destructive/20">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" aria-hidden="true" />
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  <span>{language === 'es' ? 'Verificando...' : 'Verifying...'}</span>
                </>
              ) : (
                <>
                  <Shield className="w-4 h-4" aria-hidden="true" />
                  <span>{language === 'es' ? 'Iniciar Sesión' : 'Sign In'}</span>
                </>
              )}
            </button>

            <div className="pt-4 border-t border-border">
              <p className="text-xs text-muted-foreground">
                {language === 'es'
                  ? 'Nota: Solo usuarios con permisos de administrador pueden acceder a este panel.'
                  : 'Note: Only users with admin permissions can access this panel.'}
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}