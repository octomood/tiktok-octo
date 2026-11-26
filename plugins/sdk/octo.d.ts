/**
 * Типы моста window.octo для плагинов TikTok Octo.
 *
 * Плагин — обычный классический скрипт без Node, require, fetch и eval.
 * Единственный доступ к приложению — глобальный объект `octo`.
 * Скопируйте файл в свой проект как octo.d.ts или подключите из plugins/sdk.
 */

export type SettingValue = string | number | boolean;

export interface OctoPluginAuthor {
  readonly name: string;
  readonly url: string;
}

export interface OctoPluginInfo {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly author: OctoPluginAuthor;
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
  badge?: string;
  run?: () => void | Promise<void>;
}

export interface OctoContextMenuContext {
  pageURL: string;
  linkURL: string;
  selectionText: string;
  isEditable: boolean;
  mediaType: string;
  srcURL: string;
}

export interface OctoContextMenuItemSpec {
  id: string;
  title: string;
  description?: string;
  run: (context: OctoContextMenuContext) => void | Promise<void>;
}

export interface OctoShortcutSpec {
  id: string;
  title: string;
  accelerator: string;
  run: () => void | Promise<void>;
}

export interface OctoPageInfo {
  url: string;
  title: string;
}

export interface OctoThemeInfo {
  mode: 'system' | 'dark' | 'light';
  dark: boolean;
  palette: string;
  tokens: Record<string, string>;
}

export interface OctoPlaybackState {
  playing: boolean;
  muted: boolean;
  volume: number;
  speed: number;
  url: string;
}

export interface OctoMediaInfo {
  url: string;
  title: string;
  author: string;
  description: string;
  video: {
    playing: boolean;
    paused: boolean;
    time: number;
    duration: number;
    width: number;
    height: number;
  } | null;
}

export interface OctoWatchEvent {
  id: string;
  count: number;
  matched: boolean;
  texts: string[];
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
  onSettingAction(callback: (key: string) => void): () => void;
  onThemeChange(callback: (theme: OctoThemeInfo) => void): () => void;

  settings: {
    get(): Record<string, SettingValue>;
  };

  theme: {
    get(): Promise<OctoThemeInfo>;
  };

  /** До 256 КБ JSON на плагин. */
  storage: {
    get(key: string): Promise<unknown>;
    set(key: string, value: unknown): Promise<unknown>;
    remove(key: string): Promise<unknown>;
    clear(): Promise<unknown>;
    keys(): Promise<string[]>;
    usage(): Promise<{ bytes: number; limit: number }>;
  };

  commands: {
    add(spec: OctoCommandSpec): Promise<unknown>;
    remove(id: string): Promise<unknown>;
  };

  ui: {
    panelRow(spec: OctoPanelRowSpec): Promise<unknown>;
    updatePanelRow(id: string, patch: Partial<OctoPanelRowSpec>): Promise<unknown>;
    removePanelRow(id: string): Promise<unknown>;
    confirm(spec: {
      title?: string;
      message: string;
      confirmText?: string;
      cancelText?: string;
    }): Promise<boolean>;
    prompt(spec: {
      title?: string;
      message?: string;
      placeholder?: string;
      defaultValue?: string;
      confirmText?: string;
      cancelText?: string;
    }): Promise<string | null>;
    pick(spec: {
      title?: string;
      placeholder?: string;
      items: Array<string | { value: string; label: string; description?: string }>;
    }): Promise<string | null>;
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
    /** Разрешение `page:css`: заменить или удалить именованный блок CSS по id. */
    setCSS(id: string, css: string): Promise<unknown>;
    removeCSS(id: string): Promise<unknown>;
    /** Разрешение `page:script`, изолированный мир, таймаут 10 секунд. */
    run<T = unknown>(code: string): Promise<T>;
    getMediaInfo(): Promise<OctoMediaInfo>;
    watch(
      id: string,
      selector: string,
      callback: (event: OctoWatchEvent) => void,
    ): Promise<() => Promise<unknown>>;
    unwatch(id: string): Promise<unknown>;
  };

  /** Разрешение `network` и `networkHosts` в манифесте. */
  net: {
    fetch(
      url: string,
      options?: {
        method?: string;
        headers?: Record<string, string>;
        body?: string | Record<string, unknown>;
      },
    ): Promise<{
      ok: boolean;
      status: number;
      url: string;
      headers: Record<string, string>;
      text: string;
    }>;
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
    onChange(callback: (state: OctoPlaybackState) => void): () => void;
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
