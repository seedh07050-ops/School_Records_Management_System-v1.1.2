import React, { useEffect } from 'react';
import { AlertTriangle, Trash2, Archive, CheckCircle, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  detail?: string;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: 'danger' | 'warning' | 'rose' | 'primary';
  children?: React.ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  detail,
  confirmText = '확인',
  cancelText = '취소',
  confirmVariant = 'primary',
  children,
  onConfirm,
  onCancel,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const getVariantStyles = () => {
    switch (confirmVariant) {
      case 'danger':
        return {
          icon: <Trash2 className="w-6 h-6 text-red-600" />,
          iconBg: 'bg-red-100',
          btnClass: 'bg-red-600 hover:bg-red-700 text-white shadow-xs',
        };
      case 'rose':
        return {
          icon: <Archive className="w-6 h-6 text-rose-600" />,
          iconBg: 'bg-rose-100',
          btnClass: 'bg-rose-600 hover:bg-rose-700 text-white shadow-xs',
        };
      case 'warning':
        return {
          icon: <AlertTriangle className="w-6 h-6 text-amber-600" />,
          iconBg: 'bg-amber-100',
          btnClass: 'bg-amber-600 hover:bg-amber-700 text-white shadow-xs',
        };
      case 'primary':
      default:
        return {
          icon: <CheckCircle className="w-6 h-6 text-blue-600" />,
          iconBg: 'bg-blue-100',
          btnClass: 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs',
        };
    }
  };

  const { icon, iconBg, btnClass } = getVariantStyles();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-2xs animate-in fade-in duration-150">
      <div
        className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200"
        role="dialog"
        aria-modal="true"
      >
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-full flex-shrink-0 ${iconBg}`}>
              {icon}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-bold text-slate-900 leading-snug">
                {title}
              </h3>
              <p className="mt-2 text-sm text-slate-600 whitespace-pre-line leading-relaxed">
                {message}
              </p>
              {detail && (
                <div className="mt-3 p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 leading-relaxed">
                  {detail}
                </div>
              )}
              {children && <div className="mt-3.5">{children}</div>}
            </div>
            <button
              onClick={onCancel}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-md transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 bg-white border border-slate-300 rounded-lg transition-colors cursor-pointer"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer ${btnClass}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
