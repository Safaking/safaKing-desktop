'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Language, translations } from './translations';
import { useAuth } from './AuthContext';

type LanguageContextType = {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: keyof typeof translations['en']) => string;
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = 'app-language';

/**
 * UI language.
 *
 * The choice belongs to the person, not the machine: it is saved against their
 * user record and restored at login, so someone who works in Hindi gets Hindi
 * on any computer, and a colleague sharing that computer still gets their own.
 *
 * localStorage is kept as a fallback for the login screen, where nobody is
 * signed in yet, and so the page does not flash English before the profile
 * loads.
 */
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [language, setLanguage] = useState<Language>('en');

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Language | null;
    if (saved === 'en' || saved === 'hi') setLanguage(saved);
  }, []);

  // Signing in applies that user's saved preference over whatever the browser
  // was last left on.
  useEffect(() => {
    const preferred = user?.language;
    if (preferred === 'en' || preferred === 'hi') {
      setLanguage(preferred);
      localStorage.setItem(STORAGE_KEY, preferred);
    }
  }, [user?.id, user?.language]);

  const handleSetLanguage = (lang: Language) => {
    setLanguage(lang);
    localStorage.setItem(STORAGE_KEY, lang);

    if (!user?.id) return;

    // Persist against the user so it survives to the next login, anywhere.
    // Fire and forget — the switch has already taken effect on screen.
    fetch('/api/users', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: user.id, language: lang }),
      keepalive: true,
    })
      .then(() => {
        // Keep the cached session in step so a reload does not revert it.
        try {
          const stored = localStorage.getItem('jsh_user');
          if (stored) {
            const parsed = JSON.parse(stored);
            localStorage.setItem('jsh_user', JSON.stringify({ ...parsed, language: lang }));
          }
        } catch {
          /* the server copy is authoritative at next login anyway */
        }
      })
      .catch(() => {
        /* language is a preference, never worth interrupting work over */
      });
  };

  const t = (key: keyof typeof translations['en']) => {
    return translations[language][key] || translations['en'][key];
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage: handleSetLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
