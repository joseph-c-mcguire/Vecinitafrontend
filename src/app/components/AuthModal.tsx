import React, { useState } from 'react';
import { X, Mail, Lock, User as UserIcon, AlertCircle, Loader2 } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { useAuth } from '../context/AuthContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type AuthMode = 'signin' | 'signup';

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const { t, language } = useLanguage();
  const { signIn, signUp } = useAuth();
  
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Handle Escape key to close modal
  React.useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Validation
    if (!email || !password) {
      setError(language === 'es' 
        ? 'Por favor complete todos los campos' 
        : 'Please fill in all fields');
      return;
    }

    if (mode === 'signup' && password !== confirmPassword) {
      setError(language === 'es' 
        ? 'Las contraseñas no coinciden' 
        : 'Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError(language === 'es'
        ? 'La contraseña debe tener al menos 6 caracteres'
        : 'Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);

    try {
      if (mode === 'signin') {
        const { error } = await signIn(email, password);
        if (error) {
          setError(language === 'es'
            ? 'Credenciales inválidas'
            : 'Invalid credentials');
        } else {
          handleClose();
        }
      } else {
        const { error } = await signUp(email, password);
        if (error) {
          setError(language === 'es'
            ? 'Error al crear la cuenta. El correo puede estar en uso.'
            : 'Error creating account. Email may already be in use.');
        } else {
          setSuccess(language === 'es'
            ? 'Cuenta creada exitosamente. Por favor revise su correo para verificar.'
            : 'Account created successfully. Please check your email to verify.');
          setTimeout(() => {
            handleClose();
          }, 2000);
        }
      }
    } catch (err) {
      setError(language === 'es'
        ? 'Ocurrió un error. Por favor inténtelo de nuevo.'
        : 'An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setError(null);
    setSuccess(null);
    setMode('signin');
    onClose();
  };

  const toggleMode = () => {
    setMode(mode === 'signin' ? 'signup' : 'signin');
    setError(null);
    setSuccess(null);
  };

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/50 z-50"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        role="dialog"
        aria-labelledby="auth-modal-title"
        aria-modal="true"
      >
        <div className="bg-card rounded-lg shadow-xl w-full max-w-md border border-border">
          {/* Header */}
          <div className="border-b border-border p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                  <UserIcon className="w-5 h-5 text-primary" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 id="auth-modal-title" className="text-lg sm:text-xl text-foreground">
                    {mode === 'signin'
                      ? (language === 'es' ? 'Iniciar Sesión' : 'Sign In')
                      : (language === 'es' ? 'Crear Cuenta' : 'Sign Up')}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {mode === 'signin'
                      ? (language === 'es'
                        ? 'Acceda para guardar su historial de conversaciones'
                        : 'Access your saved conversation history')
                      : (language === 'es'
                        ? 'Cree una cuenta para guardar sus conversaciones'
                        : 'Create an account to save your conversations')}
                  </p>
                </div>
              </div>
              <button
                onClick={handleClose}
                disabled={isLoading}
                className="p-2 rounded-lg hover:bg-accent transition-colors shrink-0 disabled:opacity-50"
                aria-label={t('close')}
              >
                <X className="w-5 h-5 text-foreground" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* Email */}
            <div className="space-y-2">
              <label htmlFor="email" className="text-sm text-muted-foreground">
                {language === 'es' ? 'Correo Electrónico' : 'Email'}
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  placeholder={language === 'es' ? 'su@correo.com' : 'your@email.com'}
                  className="w-full pl-10 pr-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <label htmlFor="password" className="text-sm text-muted-foreground">
                {language === 'es' ? 'Contraseña' : 'Password'}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                  required
                />
              </div>
            </div>

            {/* Confirm Password (Sign Up only) */}
            {mode === 'signup' && (
              <div className="space-y-2">
                <label htmlFor="confirm-password" className="text-sm text-muted-foreground">
                  {language === 'es' ? 'Confirmar Contraseña' : 'Confirm Password'}
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
                  <input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={isLoading}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                    required
                  />
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="p-3 bg-destructive/10 rounded-lg border border-destructive/20">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" aria-hidden="true" />
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
                <p className="text-sm text-primary">{success}</p>
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
                  <span>{language === 'es' ? 'Procesando...' : 'Processing...'}</span>
                </>
              ) : (
                <span>
                  {mode === 'signin'
                    ? (language === 'es' ? 'Iniciar Sesión' : 'Sign In')
                    : (language === 'es' ? 'Crear Cuenta' : 'Sign Up')}
                </span>
              )}
            </button>

            {/* Toggle Mode */}
            <div className="text-center">
              <button
                type="button"
                onClick={toggleMode}
                disabled={isLoading}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              >
                {mode === 'signin'
                  ? (language === 'es'
                    ? '¿No tiene una cuenta? Crear cuenta'
                    : "Don't have an account? Sign up")
                  : (language === 'es'
                    ? '¿Ya tiene una cuenta? Iniciar sesión'
                    : 'Already have an account? Sign in')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}