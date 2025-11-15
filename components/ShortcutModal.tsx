import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

interface ShortcutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const shortcuts = [
  {
    keys: 'Ctrl/⌘ + Z',
    description: 'Undo the most recent change.',
  },
  {
    keys: 'Ctrl/⌘ + Y',
    description: 'Redo the previously undone change.',
  },
  {
    keys: 'Enter',
    description: 'Finish drawing a forbidden or corridor area when at least three points are placed.',
  },
  {
    keys: 'Escape',
    description: 'Cancel measuring, cancel drawing, clear the current selection, or close this help.',
  },
  {
    keys: 'Delete / Backspace',
    description: 'Delete the currently selected element (when not focused on an input).',
  },
];

export const ShortcutModal: React.FC<ShortcutModalProps> = ({ isOpen, onClose }) => {
  const modalRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocusedElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    previouslyFocusedElement.current = document.activeElement as HTMLElement | null;

    const getFocusableElements = () => {
      if (!modalRef.current) return [] as HTMLElement[];
      const nodes = modalRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      return Array.from(nodes).filter(el => !el.hasAttribute('data-focus-guard'));
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key === 'Tab') {
        const focusableElements = getFocusableElements();
        if (focusableElements.length === 0) {
          event.preventDefault();
          return;
        }

        const currentIndex = focusableElements.indexOf(document.activeElement as HTMLElement);
        let nextIndex = currentIndex;

        if (event.shiftKey) {
          nextIndex = currentIndex <= 0 ? focusableElements.length - 1 : currentIndex - 1;
        } else {
          nextIndex = currentIndex === focusableElements.length - 1 ? 0 : currentIndex + 1;
        }

        event.preventDefault();
        focusableElements[nextIndex]?.focus();
      }
    };

    const focusFirstElement = () => {
      const focusableElements = getFocusableElements();
      if (focusableElements.length > 0) {
        focusableElements[0].focus();
      } else if (modalRef.current) {
        modalRef.current.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    window.requestAnimationFrame(focusFirstElement);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocusedElement.current?.focus();
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60"
      role="presentation"
      onMouseDown={onClose}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcut-modal-title"
        className="max-w-lg w-full mx-4 rounded-lg bg-gray-900 border border-gray-700 shadow-xl focus:outline-none"
        onMouseDown={event => event.stopPropagation()}
        tabIndex={-1}
      >
        <div className="flex items-start justify-between border-b border-gray-700 px-5 py-4">
          <div>
            <h2 id="shortcut-modal-title" className="text-xl font-semibold text-teal-300">Keyboard Shortcuts</h2>
            <p className="text-sm text-gray-400">Speed up your course design workflow with these shortcuts.</p>
          </div>
          <button
            onClick={onClose}
            className="ml-4 rounded-md bg-gray-800 px-3 py-1 text-sm font-medium text-gray-200 transition-colors duration-150 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 focus:ring-offset-gray-900"
            type="button"
          >
            Close
          </button>
        </div>
        <div className="px-5 py-4">
          <ul className="space-y-3">
            {shortcuts.map(shortcut => (
              <li key={shortcut.keys} className="flex flex-col rounded-md bg-gray-800/60 px-4 py-3">
                <span className="font-mono text-sm text-teal-200">{shortcut.keys}</span>
                <span className="text-sm text-gray-300">{shortcut.description}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>,
    document.body
  );
};
