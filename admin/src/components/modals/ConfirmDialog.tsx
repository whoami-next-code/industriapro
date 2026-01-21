'use client';

import { Fragment } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { ExclamationTriangleIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  type?: 'danger' | 'warning' | 'success';
  confirmText?: string;
  cancelText?: string;
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  type = 'warning',
  confirmText = 'Confirmar',
  cancelText = 'Cancelar'
}: ConfirmDialogProps) {
  const icons = {
    danger: <XCircleIcon className="h-12 w-12 text-rose-500" />,
    warning: <ExclamationTriangleIcon className="h-12 w-12 text-amber-500" />,
    success: <CheckCircleIcon className="h-12 w-12 text-emerald-500" />,
  };

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const confirmClass = {
    danger: "sp-button-danger",
    warning: "sp-button-warning",
    success: "sp-button-success",
  }[type];

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-[2px]" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl sp-card sp-card-static text-left align-middle transition-all">
                <div className="sp-card-body">
                  <div className="flex items-center gap-4">
                    <div className="flex-shrink-0">
                      {icons[type]}
                    </div>
                    <div className="flex-1">
                      <Dialog.Title
                        as="h3"
                        className="text-lg font-medium leading-6"
                      >
                        {title}
                      </Dialog.Title>
                      <p className="mt-2 text-sm sp-muted">
                        {message}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="px-6 py-4 flex gap-3 justify-end border-t border-[var(--border)]">
                  <button
                    type="button"
                    className="sp-button sp-button-outline"
                    onClick={onClose}
                  >
                    {cancelText}
                  </button>
                  <button
                    type="button"
                    className={`sp-button ${confirmClass}`}
                    onClick={handleConfirm}
                  >
                    {confirmText}
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
