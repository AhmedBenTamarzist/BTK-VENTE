import { useEffect, useRef } from 'react';

// Serveur bas de gamme : on garde un intervalle assez long pour ne pas le surcharger
// quand plusieurs postes interrogent en même temps.
export const DEFAULT_POLL_INTERVAL_MS = 20000;

/**
 * Ré-exécute périodiquement `callback` tant que l'onglet est visible, pour que les
 * données restent à jour entre plusieurs postes sans que l'utilisateur ait à rafraîchir.
 * `callback` est appelé avec `true` lors des rafraîchissements silencieux (pas de spinner),
 * et sans argument lors de l'appel initial (comportement habituel avec spinner).
 */
export function usePolling(callback, deps = [], intervalMs = DEFAULT_POLL_INTERVAL_MS) {
  const callbackRef = useRef(callback);
  useEffect(() => {
    callbackRef.current = callback;
  });

  useEffect(() => {
    callbackRef.current();

    const tick = () => {
      if (!document.hidden) callbackRef.current(true);
    };
    const intervalId = setInterval(tick, intervalMs);

    const handleVisibility = () => {
      if (!document.hidden) callbackRef.current(true);
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
