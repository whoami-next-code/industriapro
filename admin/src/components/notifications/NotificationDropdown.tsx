'use client';

import { Fragment } from 'react';
import { Menu, Transition } from '@headlessui/react';
import {
  BellIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import { useAppStore } from '@/store/useAppStore';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

export default function NotificationDropdown() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearNotifications } = useAppStore();

  const getNotificationIcon = (type: string) => {
    const iconClasses = "h-10 w-10 rounded-2xl flex items-center justify-center";
    switch (type) {
      case 'success':
        return (
          <div className={`${iconClasses} bg-emerald-100 text-emerald-700`}>
            <CheckCircleIcon className="h-5 w-5" aria-hidden="true" />
          </div>
        );
      case 'error':
        return (
          <div className={`${iconClasses} bg-rose-100 text-rose-700`}>
            <XCircleIcon className="h-5 w-5" aria-hidden="true" />
          </div>
        );
      case 'warning':
        return (
          <div className={`${iconClasses} bg-amber-100 text-amber-700`}>
            <ExclamationTriangleIcon className="h-5 w-5" aria-hidden="true" />
          </div>
        );
      default:
        return (
          <div className={`${iconClasses} bg-blue-100 text-blue-700`}>
            <InformationCircleIcon className="h-5 w-5" aria-hidden="true" />
          </div>
        );
    }
  };

  return (
    <Menu as="div" className="relative">
      <Menu.Button className="relative sp-button sp-button-ghost h-10 w-10 !p-0">
        <BellIcon className="h-6 w-6" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 h-5 w-5 bg-rose-400 rounded-full text-[10px] font-semibold text-slate-900 flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </Menu.Button>

      <Transition
        as={Fragment}
        enter="transition ease-out duration-100"
        enterFrom="transform opacity-0 scale-95"
        enterTo="transform opacity-100 scale-100"
        leave="transition ease-in duration-75"
        leaveFrom="transform opacity-100 scale-100"
        leaveTo="transform opacity-0 scale-95"
      >
        <Menu.Items className="absolute right-0 mt-3 w-[22rem] origin-top-right sp-card sp-card-static focus:outline-none z-50">
          <div className="p-4 border-b border-[var(--border)] flex items-center justify-between">
            <h3 className="text-lg font-semibold">
              Notificaciones {unreadCount > 0 && `(${unreadCount})`}
            </h3>
            <div className="flex gap-2">
              {notifications.length > 0 && (
                <>
                  <button
                    onClick={markAllAsRead}
                    className="text-xs text-blue-700 hover:underline"
                  >
                    Marcar todas leídas
                  </button>
                  <button
                    onClick={clearNotifications}
                    className="text-xs text-rose-600 hover:underline"
                  >
                    Limpiar
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center sp-muted">
                No hay notificaciones
              </div>
            ) : (
              notifications.map((notification) => (
                <Menu.Item key={notification.id}>
                  {({ active }) => (
                    <div
                      className={`p-4 border-b border-[var(--border)] cursor-pointer ${
                        active ? 'bg-[var(--surface-2)]' : ''
                      } ${!notification.read ? 'bg-blue-50/60' : ''}`}
                      onClick={() => markAsRead(notification.id)}
                    >
                      <div className="flex gap-3">
                        {getNotificationIcon(notification.type)}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">
                            {notification.title}
                          </p>
                          <p className="text-sm sp-muted mt-1">
                            {notification.message}
                          </p>
                          <p className="text-xs sp-muted mt-2">
                            {formatDistanceToNow(notification.timestamp, { addSuffix: true, locale: es })}
                          </p>
                        </div>
                        {!notification.read && (
                          <div className="h-2 w-2 bg-blue-600 rounded-full mt-2"></div>
                        )}
                      </div>
                    </div>
                  )}
                </Menu.Item>
              ))
            )}
          </div>
        </Menu.Items>
      </Transition>
    </Menu>
  );
}
