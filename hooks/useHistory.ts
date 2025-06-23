
import { useState, useCallback } from 'react';

export interface HistoryState<T> {
  current: T;
  set: (newState: T | ((prevState: T) => T), fromUndoRedo?: boolean) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  reset: (initialState: T) => void;
}

export function useHistory<T,>(initialState: T): HistoryState<T> {
  const [history, setHistory] = useState<T[]>([initialState]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const set = useCallback((newStateOrFn: T | ((prevState: T) => T), fromUndoRedo: boolean = false) => {
    if (fromUndoRedo) {
      // Overwrite the state at the current index.
      // `currentIndex` from the closure is used, which is valid because `currentIndex` is a dependency of this `useCallback`.
      setHistory(currentHistoryArray => {
        const baseState = currentHistoryArray[currentIndex]; 
        const newState = typeof newStateOrFn === 'function'
          ? (newStateOrFn as (prevState: T) => T)(baseState)
          : newStateOrFn;

        const newHistoryArray = [...currentHistoryArray];
        if (currentIndex >= 0 && currentIndex < newHistoryArray.length) {
          newHistoryArray[currentIndex] = newState;
        } else {
          console.error(
            "useHistory (overwrite): currentIndex from closure is out of bounds.",
            { currentIndexFromClosure: currentIndex, historyLength: newHistoryArray.length }
          );
          // Avoid modifying history to prevent further corruption if index is bad.
          return currentHistoryArray; 
        }
        return newHistoryArray;
      });
      // currentIndex does not change via setCurrentIndex for an overwrite.
    } else {
      // Add a new state entry, potentially truncating redo states.
      // This will update currentIndex.
      setCurrentIndex(prevCurrentIndex => {
        setHistory(currentHistoryArray => {
          // `prevCurrentIndex` is guaranteed to be up-to-date for this specific index update.
          // `currentHistoryArray` is guaranteed to be up-to-date.
          const baseState = currentHistoryArray[prevCurrentIndex];
          const newState = typeof newStateOrFn === 'function'
            ? (newStateOrFn as (prevState: T) => T)(baseState)
            : newStateOrFn;
          
          const newHistorySlice = currentHistoryArray.slice(0, prevCurrentIndex + 1);
          newHistorySlice.push(newState);
          return newHistorySlice;
        });
        return prevCurrentIndex + 1; // new current index
      });
    }
  }, [currentIndex]); // `setHistory` and `setCurrentIndex` are stable dispatchers. 
                      // `currentIndex` is needed for the overwrite path to correctly target the state.

  const undo = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  }, [currentIndex]);

  const redo = useCallback(() => {
    if (currentIndex < history.length - 1) {
      setCurrentIndex(prev => prev + 1); // Corrected: increment instead of decrement
    }
  }, [currentIndex, history.length]);

  const reset = useCallback((newInitialState: T) => {
    setHistory([newInitialState]);
    setCurrentIndex(0);
  }, []);

  const currentItem = history[currentIndex];

  // This check can help during development to see if state becomes undefined,
  // but the goal is for `currentItem` to always be valid.
  if (currentItem === undefined && history.length > 0) {
      console.warn(
          `useHistory: history[${currentIndex}] is undefined. History length: ${history.length}. This indicates a potential issue.`,
          history
      );
  }


  return {
    current: currentItem === undefined ? initialState : currentItem, // Fallback to initialState if undefined, though ideally this never happens.
    set,
    undo,
    redo,
    canUndo: currentIndex > 0,
    canRedo: currentIndex < history.length - 1,
    reset,
  };
}