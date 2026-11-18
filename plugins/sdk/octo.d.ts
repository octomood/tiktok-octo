/**
 * Типы моста window.octo для плагинов TikTok octo.
 *
 * Плагин — обычный классический скрипт без Node, require, fetch и eval.
 * Единственный доступ к приложению — глобальный объект `octo`.
 * Скопируйте файл в свой проект как octo.d.ts или подключите из plugins/sdk.
 */

export type SettingValue = string | number | boolean;

export interface OctoPluginInfo {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly author: string;
  readonly permissions: readonly string[];
}

export interface OctoAppInfo {
  readonly version: string;
  readonly electron: string;
  readonly platform: string;
}

export interface OctoCommandSpec {
  id: string;
  title: string;
  description?: string;
  run: (payload?: unknown) => void | Promise<void>;
}

export interface OctoPanelRowSpec {
  id: string;
  label: string;
  description?: string;
  run?: () => void | Promise<void>;
}

export interface OctoContextMenuItemSpec {
  id: string;
  title: string;
  run: (context: { link?: string; selection?: string; media?: string }) => void | Promise<void>;
}

export interface OctoShortcutSpec {
  id: string;
  accelerator: string;
  run: () => void | Promise<void>;
}

export interface OctoPageInfo {
  url: string;
  title: string;
}

export interface Octo {
  readonly apiVersion: 1;
  readonly plugin: OctoPluginInfo;
  readonly app: OctoAppInfo;

  onActivate(callback: () => void | Promise<void>): () => void;
  onDeactivate(callback: () => void | Promise<void>): () => void;
  onPageReady(callback: (page: OctoPageInfo) => void): () => void;
  onPageNavigate(callback: (page: OctoPageInfo) => void): () => void;
  onSettingsChange(callback: (values: Record<string, SettingValue>) => void): () => void;

  settings: {
    get(): Record<string, SettingValue>;
  };

  /** До 256 КБ JSON на плагин. */
  storage: {
    get(key: string): Promise<unknown>;
    set(key: string, value: unknown): Promise<unknown>;
    remove(key: string): Promise<unknown>;
    clear(): Promise<unknown>;
  };

  commands: {
    add(spec: OctoCommandSpec): Promise<unknown>;
    remove(id: string): Promise<unknown>;
  };

  ui: {
    panelRow(spec: OctoPanelRowSpec): Promise<unknown>;
    removePanelRow(id: string): Promise<unknown>;
    contextMenu: {
      add(spec: OctoContextMenuItemSpec): Promise<unknown>;
      remove(id: string): Promise<unknown>;
    };
    /** Разрешение `overlay`: короткая текстовая плашка поверх страницы. */
    overlay: {
      show(spec: { text: string; timeoutMs?: number }): Promise<{ id: string }>;
      hide(id: string): Promise<unknown>;
    };
  };

  /** Требует разрешение `shortcuts` и Ctrl/Cmd/Alt в сочетании. */
  shortcuts: {
    add(spec: OctoShortcutSpec): Promise<unknown>;
    remove(id: string): Promise<unknown>;
  };

  /** Системное хранилище ключей через safeStorage, без обычного storage. */
  secrets: {
    get(key: string): Promise<string | null>;
    set(key: string, value: string): Promise<unknown>;
    remove(key: string): Promise<unknown>;
    clear(): Promise<unknown>;
  };

  page: {
    /** Разрешение `page:css`, до 256 КБ. */
    injectCSS(css: string): Promise<unknown>;
    /** Разрешение `page:script`, изолированный мир, таймаут 10 секунд. */
    run<T = unknown>(code: string): Promise<T>;
  };

  /** Разрешение `network` и `networkHosts` в манифесте. */
  net: {
    fetch(
      url: string,
      options?: { method?: string; headers?: Record<string, string>; body?: string },
    ): Promise<{ status: number; body: string; headers: Record<string, string> }>;
  };

  /** Разрешение `playback`: управление текущим роликом. */
  playback: {
    status(): Promise<{
      playing: boolean;
      muted: boolean;
      time: number;
      duration: number;
      volume: number;
      speed: number;
    }>;
    playPause(): Promise<unknown>;
    seek(seconds: number): Promise<unknown>;
    /** 0…1, как обычная громкость приложения. */
    setVolume(value: number): Promise<unknown>;
    /** 0.5…3. */
    setSpeed(value: number): Promise<unknown>;
  };

  /** Разрешение `feed`: перелистывание ленты. */
  feed: {
    next(): Promise<unknown>;
    prev(): Promise<unknown>;
  };

  /** Разрешение `downloads`: только ссылки tiktok.com и его CDN. */
  downloads: {
    add(url: string): Promise<unknown>;
  };

  /** Разрешение `i18n`: выбранный язык приложения. */
  i18n: {
    get(): Promise<{ locale: string; dir: 'ltr' | 'rtl' }>;
  };

  /** Разрешение `clipboard`: только запись текста. */
  clipboard: {
    write(text: string): Promise<unknown>;
  };

  /** Разрешение `os:notify`: системное уведомление от имени приложения. */
  os: {
    notify(spec: { title?: string; body?: string }): Promise<unknown>;
  };

  /** Разрешение `navigation`: только пути и ссылки tiktok.com. */
  navigate(url: string): Promise<unknown>;
  /** Разрешение `links`: только https. */
  openExternal(url: string): Promise<unknown>;
  notify(text: string): Promise<unknown>;
  log(...args: unknown[]): void;
}

declare global {
  const octo: Octo;
  interface Window {
    octo: Octo;
  }
}
