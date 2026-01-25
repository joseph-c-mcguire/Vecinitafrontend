import React, { useState } from 'react';
import { X, Lock, AlertCircle, Loader2, Shield } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { supabase } from '@/lib/supabase';

interface AdminAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthenticated: () => void;
}

export function AdminAuthModal({ isOpen, onClose, onAuthenticated }: AdminAuthModalProps) {
  const { t, language } = useLanguage();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!email || !password) {
      setError(language === 'es' 
        ? 'Por favor complete todos los campos' 
        : 'Please fill in all fields');
      return;
    }

    setIsLoading(true);

    try {
      // TODO: Replace with actual admin authentication
      // See /BACKEND_IMPLEMENTATION.md Section 8 for implementation details
      // 
      // This will involve:
      // 1. Sign in with Supabase Auth
      // 2. Check if user has admin role in database
      // 3. Validate admin permissions via Edge Function or RLS policy
      // 
      // Example implementation:
      // const { data, error } = await supabase.auth.signInWithPassword({
      //   email,
      //   password,
      // });
      // 
      // if (error) throw error;
      // 
      // // Check admin role
      // const { data: profile, error: profileError } = await supabase
      //   .from('user_profiles')
      //   .select('role')
      //   .eq('id', data.user.id)
      //   .single();
      // 
      // if (profileError || profile.role !== 'admin') {
      //   await supabase.auth.signOut();
      //   throw new Error('Unauthorized');
      // }
      // 
      // onAuthenticated();
      // onClose();

      // Mock authentication for now
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // For demo: accept any email/password (REMOVE IN PRODUCTION)
      if (email && password) {
        onAuthenticated();
        handleClose();
      } else {
        throw new Error('Invalid credentials');
      }
      
    } catch (err: any) {
      console.error('Admin auth error:', err);
      
      let errorMessage = language === 'es' 
        ? 'Credenciales de administrador inválidas' 
        : 'Invalid admin credentials';
      
      if (err.message?.includes('Invalid login credentials')) {
        errorMessage = language === 'es' 
          ? 'Credenciales inválidas' 
          : 'Invalid credentials';
      } else if (err.message?.includes('Unauthorized')) {
        errorMessage = language === 'es' 
          ? 'No tiene permisos de administrador' 
          : 'You do not have admin permissions';
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setEmail('');
      setPassword('');
      setError(null);
      onClose();
    }
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
        aria-labelledby="admin-auth-title"
        aria-modal="true"
      >
        <div className="bg-card rounded-lg shadow-xl w-full max-w-md border border-border">
          {/* Header */}
          <div className="border-b border-border p-4 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                  <Shield className="w-5 h-5 text-primary" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 id="admin-auth-title" className="text-lg sm:text-xl text-foreground">
                    {language === 'es' ? 'Panel de Administración' : 'Admin Panel'}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    {language === 'es' 
                      ? 'Ingrese sus credenciales de administrador'
                      : 'Enter your admin credentials'}
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
          <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
            {/* Email Input */}
            <div className="space-y-2">
              <label htmlFor="admin-email" className="text-sm text-muted-foreground">
                {language === 'es' ? 'Correo de Administrador' : 'Admin Email'}
              </label>
              <input
                id="admin-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                placeholder={language === 'es' ? 'admin@vecina.org' : 'admin@vecina.org'}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                required
              />
            </div>

            {/* Password Input */}
            <div className="space-y-2">
              <label htmlFor="admin-password" className="text-sm text-muted-foreground">
                {language === 'es' ? 'Contraseña de Administrador' : 'Admin Password'}
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
                <input
                  id="admin-password"
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
                  <span>{language === 'es' ? 'Acceder' : 'Access'}</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
