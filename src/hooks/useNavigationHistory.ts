"use client";

import { useCallback, useRef, useState } from "react";

type HistoryState = { stack: string[]; index: number };

export function useNavigationHistory(onNavigate: (pageId: string) => void) {
  const [state, setState] = useState<HistoryState>({ stack: [], index: -1 });
  const skipNextPush = useRef(false);

  const push = useCallback((pageId: string) => {
    if (skipNextPush.current) {
      skipNextPush.current = false;
      return;
    }
    setState((prev) => {
      if (prev.stack[prev.index] === pageId) return prev;
      const truncated = prev.stack.slice(0, prev.index + 1);
      return { stack: [...truncated, pageId], index: truncated.length };
    });
  }, []);

  const back = useCallback(() => {
    setState((prev) => {
      if (prev.index <= 0) return prev;
      const nextIndex = prev.index - 1;
      skipNextPush.current = true;
      onNavigate(prev.stack[nextIndex]);
      return { ...prev, index: nextIndex };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onNavigate]);

  const forward = useCallback(() => {
    setState((prev) => {
      if (prev.index >= prev.stack.length - 1) return prev;
      const nextIndex = prev.index + 1;
      skipNextPush.current = true;
      onNavigate(prev.stack[nextIndex]);
      return { ...prev, index: nextIndex };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onNavigate]);

  return {
    push,
    back,
    forward,
    canGoBack: state.index > 0,
    canGoForward: state.index < state.stack.length - 1,
  };
}
