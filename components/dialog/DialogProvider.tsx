import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface DialogConfirmOptions {
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
}

interface DialogContextValue {
  confirm: (options: DialogConfirmOptions) => Promise<boolean>;
}

interface DialogRequest extends DialogConfirmOptions {
  id: number;
  resolve: (accepted: boolean) => void;
}

const DialogContext = createContext<DialogContextValue | undefined>(undefined);

const DialogOverlay: React.FC<{ children: React.ReactNode; tone: 'default' | 'danger' }>
  = ({ children, tone }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
    <div
      className={`w-full max-w-md rounded-lg border shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 ${
        tone === 'danger' ? 'border-red-500 bg-gray-900/95' : 'border-gray-600 bg-gray-900/95'
      }`}
      role="presentation"
    >
      {children}
    </div>
  </div>
);

const DialogView: React.FC<{
  request: DialogRequest;
  onAnswer: (id: number, accepted: boolean) => void;
}> = ({ request, onAnswer }) => {
  if (typeof document === 'undefined') {
    return null;
  }

  const { id, title, description, confirmLabel = 'Confirm', cancelLabel = 'Cancel', tone = 'default' } = request;
  const descriptionId = description ? `dialog-${id}-description` : undefined;

  return createPortal(
    <DialogOverlay tone={tone}>
      <div
        className="flex flex-col gap-4 p-6 text-gray-100"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`dialog-${id}-title`}
        aria-describedby={descriptionId}
      >
        <div className="space-y-2">
          <h2 id={`dialog-${id}-title`} className="text-lg font-semibold text-white">
            {title}
          </h2>
          {description && (
            <div id={descriptionId} className="text-sm text-gray-300">
              {typeof description === 'string' ? <p>{description}</p> : description}
            </div>
          )}
        </div>
        <div className="flex flex-row justify-end gap-2">
          <button
            type="button"
            onClick={() => onAnswer(id, false)}
            className="rounded border border-gray-600 px-4 py-2 text-sm font-medium text-gray-200 transition hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-400"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => onAnswer(id, true)}
            className={`rounded px-4 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-teal-400 ${
              tone === 'danger'
                ? 'bg-red-600 text-white hover:bg-red-500'
                : 'bg-teal-600 text-white hover:bg-teal-500'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </DialogOverlay>,
    document.body
  );
};

export const DialogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [requests, setRequests] = useState<DialogRequest[]>([]);
  const idCounter = useRef(0);

  const handleAnswer = useCallback((id: number, accepted: boolean) => {
    setRequests(prev => {
      const request = prev.find(entry => entry.id === id);
      if (request) {
        request.resolve(accepted);
      }
      return prev.filter(entry => entry.id !== id);
    });
  }, []);

  const confirm = useCallback((options: DialogConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setRequests(prev => {
        const newRequest: DialogRequest = {
          ...options,
          id: idCounter.current++,
          resolve,
        };
        return [...prev, newRequest];
      });
    });
  }, []);

  const contextValue = useMemo<DialogContextValue>(() => ({ confirm }), [confirm]);

  return (
    <DialogContext.Provider value={contextValue}>
      {children}
      {requests.map(request => (
        <DialogView key={request.id} request={request} onAnswer={handleAnswer} />
      ))}
    </DialogContext.Provider>
  );
};

export const useDialog = (): DialogContextValue => {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('useDialog must be used within a DialogProvider');
  }
  return context;
};

export type { DialogConfirmOptions };
