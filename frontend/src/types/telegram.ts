export interface TelegramUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
}

export interface TelegramWebApp {
  initDataUnsafe: {
    user?: TelegramUser;
    query_id?: string;
    auth_date?: string;
    hash?: string;
    start_param?: string;
  };
  initData?: string;
  ready: () => void;
  expand?: () => void;
  close: () => void;
  MainButton?: {
    setText: (text: string) => void;
    show: () => void;
    hide: () => void;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
  };
  BackButton?: {
    show: () => void;
    hide: () => void;
    onClick: (callback: () => void) => void;
    offClick: (callback: () => void) => void;
  };
  HapticFeedback?: {
    impactOccurred: (style: 'light'|'medium'|'heavy'|'rigid'|'soft') => void;
    notificationOccurred: (type: 'error'|'success'|'warning') => void;
    selectionChanged: () => void;
  };
  openInvoice?: (link: string, cb?: (status: string) => void) => void;
  onEvent?: (event: string, cb: (data?: any) => void) => void;
  offEvent?: (event: string) => void;
}

export interface TMAContextType {
  user: TelegramUser | null;
  webApp: TelegramWebApp | null;
  isInTelegram: boolean;
  platform: string;
  ready: boolean;
  initData: string | null;
  startParam?: string;
  showMainButton: (text: string, onClick: () => void) => void;
  hideMainButton: () => void;
  showBackButton: (onClick: () => void) => void;
  hideBackButton: () => void;
  impactHaptic: (style: 'light'|'medium'|'heavy'|'rigid'|'soft') => void;
  notificationHaptic: (type: 'error'|'success'|'warning') => void;
  openInvoice: (link: string, cb?: (status: string) => void) => void;
  onInvoiceClosed: (cb: (data?: any) => void) => void;
}