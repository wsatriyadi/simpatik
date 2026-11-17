import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "./api";

interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  status: number | null;
}

export function useApi<T>(path: string | null) {
  const [state, setState] = useState<ApiState<T>>({
    data: null,
    loading: Boolean(path),
    error: null,
    status: null,
  });
  const version = useRef(0);

  const reload = useCallback(async () => {
    if (!path) {
      setState({ data: null, loading: false, error: null, status: null });
      return;
    }
    const current = ++version.current;
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const data = await api<T>(path);
      if (current === version.current) {
        setState({ data, loading: false, error: null, status: 200 });
      }
    } catch (error) {
      if (current !== version.current) return;
      const apiError = error as ApiError;
      setState({
        data: null,
        loading: false,
        error: apiError.message || "Data gagal dimuat.",
        status: apiError.status || 500,
      });
    }
  }, [path]);

  useEffect(() => {
    void reload();
    return () => {
      version.current += 1;
    };
  }, [reload]);

  return { ...state, reload, setData: (data: T) => setState((prev) => ({ ...prev, data })) };
}

export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches,
  );
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query]);
  return matches;
}

export function useDebounced<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function useDocumentTitle(title: string) {
  useEffect(() => {
    const previous = document.title;
    document.title = title ? `${title} · SIMPATIK` : "SIMPATIK";
    return () => {
      document.title = previous;
    };
  }, [title]);
}

interface PwaPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function usePwaInstall() {
  const [prompt, setPrompt] = useState<PwaPromptEvent | null>(null);
  const [installed, setInstalled] = useState(
    () =>
      window.matchMedia?.("(display-mode: standalone)")?.matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true,
  );

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      setPrompt(event as PwaPromptEvent);
    };
    const installedHandler = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", installedHandler);
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  const install = async () => {
    if (!prompt) return false;
    await prompt.prompt();
    const choice = await prompt.userChoice;
    if (choice.outcome === "accepted") {
      setInstalled(true);
      setPrompt(null);
      return true;
    }
    return false;
  };

  return { canInstall: Boolean(prompt), installed, install };
}
