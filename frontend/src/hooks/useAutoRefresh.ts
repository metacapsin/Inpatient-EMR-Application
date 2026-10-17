import { useEffect, useRef, useCallback } from 'react';

interface AutoRefreshOptions {
  enabled: boolean;
  interval: number; // in seconds
  callback: () => void | Promise<void>;
  dependencies?: any[]; // dependencies that should trigger refresh
  onError?: (error: any) => void;
}

interface AutoRefreshReturn {
  isRefreshing: boolean;
  lastRefresh: Date | null;
  refresh: () => void;
  startAutoRefresh: () => void;
  stopAutoRefresh: () => void;
}

export const useAutoRefresh = ({
  enabled,
  interval,
  callback,
  dependencies = [],
  onError
}: AutoRefreshOptions): AutoRefreshReturn => {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isRefreshingRef = useRef(false);
  const lastRefreshRef = useRef<Date | null>(null);
  const callbackRef = useRef(callback);

  // Update callback ref when callback changes
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Memoized refresh function
  const refresh = useCallback(async () => {
    if (isRefreshingRef.current) return;

    try {
      isRefreshingRef.current = true;
      lastRefreshRef.current = new Date();
      await callbackRef.current();
    } catch (error) {
      console.error('Auto refresh error:', error);
      onError?.(error);
    } finally {
      isRefreshingRef.current = false;
    }
  }, [onError]);

  // Start auto refresh
  const startAutoRefresh = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    intervalRef.current = setInterval(() => {
      refresh();
    }, interval * 1000);
  }, [interval, refresh]);

  // Stop auto refresh
  const stopAutoRefresh = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // Effect to manage auto refresh based on enabled state
  useEffect(() => {
    if (enabled && interval > 0) {
      startAutoRefresh();
    } else {
      stopAutoRefresh();
    }

    return () => {
      stopAutoRefresh();
    };
  }, [enabled, interval, startAutoRefresh, stopAutoRefresh]);

  // Effect to handle dependencies changes
  useEffect(() => {
    if (enabled && dependencies.length > 0) {
      refresh();
    }
  }, dependencies);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAutoRefresh();
    };
  }, [stopAutoRefresh]);

  return {
    isRefreshing: isRefreshingRef.current,
    lastRefresh: lastRefreshRef.current,
    refresh,
    startAutoRefresh,
    stopAutoRefresh
  };
};

