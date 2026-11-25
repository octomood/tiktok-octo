'use strict';

/**
 * Логика собственного интерфейса. Никакого доступа к сети и Node —
 * только команды окна через мост window.octo из preload.
 */

const api = window.octo;
const $ = (id) => document.getElementById(id);
// Для строк, которые собираются из нескольких частей: DOM-наблюдатель
// переводит готовый текст, но не умеет переводить его фрагменты.
const tr = (text) => (window.octoI18n ? window.octoI18n.translate(text) : text);

const el = {
  chrome: $('chrome'),
  titlebar: $('titlebar'),
  baronly: $('baronly'),
  barTitle: $('barTitle'),
  barPrev: $('btnBarPrev'),
  barPlay: $('btnBarPlay'),
  barNext: $('btnBarNext'),
  barPip: $('btnBarPip'),
  barExit: $('btnBarExit'),
  barMute: $('btnBarMute'),
  barVolume: $('barVolume'),
  barVolumeValue: $('barVolumeValue'),
  pipbar: $('pipbar'),
  pipTitle: $('pipTitle'),
  pipPrev: $('btnPipPrev'),
  pipPlay: $('btnPipPlay'),
  pipNext: $('btnPipNext'),
  pipAuto: $('btnPipAuto'),
  pipAdaptive: $('btnPipAdaptive'),
  pipClose: $('btnPipClose'),
  pipSeek: $('pipSeek'),
  pipTime: $('pipTime'),
  pipRewind: $('btnPipRewind'),
  back: $('btnBack'),
  forward: $('btnForward'),
  reload: $('btnReload'),
  home: $('btnHome'),
  pip: $('btnPip'),
  mute: $('btnMute'),
  top: $('btnTop'),
  min: $('btnMin'),
  max: $('btnMax'),
  close: $('btnClose'),
  pill: $('pagePill'),
  title: $('pageTitle'),
  unread: $('unreadBadge'),
  progress: $('progress'),
  findbar: $('findbar'),
  findInput: $('findInput'),
  findCount: $('findCount'),
  findPrev: $('btnFindPrev'),
  findNext: $('btnFindNext'),
  findClose: $('btnFindClose'),
  download: $('download'),
  downloadFill: $('downloadFill'),
  panel: $('panel'),
  btnPanel: $('btnPanel'),
  btnStickers: $('btnStickers'),
  btnPluginsActive: $('btnPluginsActive'),
  chat: $('btnChat'),
  chatResize: $('chatResize'),
  rowChatDock: $('rowChatDock'),
  rowNotify: $('rowNotify'),
  rowNotifyQuiet: $('rowNotifyQuiet'),
  rowNotifyDnd: $('rowNotifyDnd'),
  notifyFrom: $('notifyFrom'),
  notifyTo: $('notifyTo'),
  repliesInput: $('repliesInput'),
  librarySearch: $('librarySearch'),
  libraryList: $('libraryList'),
  libraryEmpty: $('libraryEmpty'),
  statsToday: $('statsToday'),
  statsTodayVideos: $('statsTodayVideos'),
  statsWeek: $('statsWeek'),
  statsWeekVideos: $('statsWeekVideos'),
  statsAuthors: $('statsAuthors'),
  statsEmpty: $('statsEmpty'),
  rowFocus: $('rowFocus'),
  focusMinutes: $('focusMinutes'),
  focusBreak: $('focusBreak'),
  rowLibraryAuto: $('rowLibraryAuto'),
  rowFilters: $('rowFilters'),
  filterKeywords: $('filterKeywords'),
  filterHashtags: $('filterHashtags'),
  filterAuthors: $('filterAuthors'),
  rowAdsPip: $('rowAdsPip'),
  adsCount: $('adsCount'),
  adsJournal: $('adsJournal'),
  rowDownloadAuto: $('rowDownloadAuto'),
  rowDownloadFolder: $('rowDownloadFolder'),
  downloadTemplate: $('downloadTemplate'),
  downloadLimit: $('downloadLimit'),
  gifDuration: $('gifDuration'),
  gifFps: $('gifFps'),
  gifWidth: $('gifWidth'),
  rowCustom: $('rowCustom'),
  customCss: $('customCss'),
  customJs: $('customJs'),
  popover: $('popover'),
  stickerPopover: $('stickerPopover'),
  stickerPopoverGrid: $('stickerPopoverGrid'),
  stickerPopoverEmpty: $('stickerPopoverEmpty'),
  stickerPopoverCount: $('stickerPopoverCount'),
  btnStickerAdd: $('btnStickerAdd'),
  btnStickerFolder: $('btnStickerFolder'),
  btnNativeStickers: $('btnNativeStickers'),
  btnStickerPopoverClose: $('btnStickerPopoverClose'),
  pluginsPopover: $('pluginsPopover'),
  pluginsPopoverList: $('pluginsPopoverList'),
  pluginsPopoverEmpty: $('pluginsPopoverEmpty'),
  pluginsPopoverCount: $('pluginsPopoverCount'),
  btnPluginsManager: $('btnPluginsManager'),
  btnPluginsPopoverClose: $('btnPluginsPopoverClose'),
  btnPanelClose: $('btnPanelClose'),
  panelHeadTitle: $('panelHeadTitle'),
  panelVersion: $('panelVersion'),
  panelSearchBar: $('panelSearchBar'),
  panelSearch: $('panelSearch'),
  panelSearchClear: $('btnPanelSearchClear'),
  panelNoResults: $('panelNoResults'),
  panelBody: $('panelBody'),
  panelZoom: $('panelZoom'),
  backupLatest: $('backupLatest'),
  privacySize: $('privacySize'),
  privacyList: $('privacyList'),
  offlineScreen: $('offlineScreen'),
  rowSafeMode: $('rowSafeMode'),
  safeModeNote: $('safeModeNote'),
  rowMemoryGuard: $('rowMemoryGuard'),
  rowEco: $('rowEco'),
  ecoNote: $('ecoNote'),
  uiScaleSelect: $('uiScaleSelect'),
  uiFontSelect: $('uiFontSelect'),
  uiFontCustomNameRow: $('uiFontCustomNameRow'),
  uiFontNameInput: $('uiFontNameInput'),
  uiFontNameApply: $('uiFontNameApply'),
  uiFontCustomFileRow: $('uiFontCustomFileRow'),
  uiFontFileName: $('uiFontFileName'),
  uiFontPickFile: $('uiFontPickFile'),
  rowBackupRestore: $('rowBackupRestore'),
  panelCosmetics: $('panelCosmetics'),
  panelDownloads: $('panelDownloads'),
  downloadsEmpty: $('downloadsEmpty'),
  panelPlugins: $('panelPlugins'),
  panelPluginActions: $('panelPluginActions'),
  panelPluginsEmpty: $('panelPluginsEmpty'),
  panelPluginsCount: $('panelPluginsCount'),
  sleepLabel: $('sleepLabel'),
  rowMute: $('rowMute'),
  volumeRange: $('volumeRange'),
  volumeValue: $('volumeValue'),
  eqSelect: $('eqSelect'),
  rowMono: $('rowMono'),
  audioSinkSelect: $('audioSinkSelect'),
  rowSleepEnd: $('rowSleepEnd'),
  rowSleepFade: $('rowSleepFade'),
  sleepVideosLabel: $('sleepVideosLabel'),
  sleepVideosValue: $('sleepVideosValue'),
  rowPip: $('rowPip'),
  rowPipAuto: $('rowPipAuto'),
  rowPipAdaptive: $('rowPipAdaptive'),
  rowOnTop: $('rowOnTop'),
  rowTray: $('rowTray'),
  rowAutostart: $('rowAutostart'),
  rowStartTray: $('rowStartTray'),
  rowStartMuted: $('rowStartMuted'),
  rowStickySpeed: $('rowStickySpeed'),
  abLoopValue: $('abLoopValue'),
  rowLoop: $('rowLoop'),
  rowPauseBlur: $('rowPauseBlur'),
  rowAdSkip: $('rowAdSkip'),
  rowFeedKeys: $('rowFeedKeys'),
  rowKeepAwake: $('rowKeepAwake'),
  idlePauseSelect: $('idlePauseSelect'),
  keymapProfile: $('keymapProfile'),
  keymapRows: $('keymapRows'),
  rowCaptions: $('rowCaptions'),
  rowCaptionBg: $('rowCaptionBg'),
  rowCaptionOutline: $('rowCaptionOutline'),
  captionSizeRange: $('captionSizeRange'),
  captionSizeValue: $('captionSizeValue'),
  brightnessRange: $('brightnessRange'),
  brightnessValue: $('brightnessValue'),
  contrastRange: $('contrastRange'),
  contrastValue: $('contrastValue'),
  sharpnessRange: $('sharpnessRange'),
  sharpnessValue: $('sharpnessValue'),
  warmthRange: $('warmthRange'),
  warmthValue: $('warmthValue'),
  videoDateValue: $('videoDateValue'),
  videoQualityValue: $('videoQualityValue'),
  videoHevcValue: $('videoHevcValue'),
  rowHardwareVideo: $('rowHardwareVideo'),
  hardwareVideoNote: $('hardwareVideoNote'),
  qrCard: $('qrCard'),
  qrCanvas: $('qrCanvas'),
  qrUrl: $('qrUrl'),
  regionSelect: $('regionSelect'),
  regionProxy: $('regionProxy'),
  regionProxyState: $('regionProxyState'),
  rowDpiBypass: $('rowDpiBypass'),
  regionIpValue: $('regionIpValue'),
  regionIpResult: $('regionIpResult'),
  regionPingValue: $('regionPingValue'),
  regionPingResult: $('regionPingResult'),
  themeModeSelect: $('themeModeSelect'),
  profileSelect: $('profileSelect'),
  profileNewName: $('profileNewName'),
  btnProfileAdd: $('btnProfileAdd'),
  btnProfileDelete: $('btnProfileDelete'),
  historySearch: $('historySearch'),
  historyList: $('historyList'),
  historyEmpty: $('historyEmpty'),
  creatorAuthor: $('creatorAuthor'),
  creatorTags: $('creatorTags'),
  creatorNote: $('creatorNote'),
  btnCreatorSave: $('btnCreatorSave'),
  creatorNotesList: $('creatorNotesList'),
  appLanguageSelect: $('appLanguageSelect'),
  siteLanguageSelect: $('siteLanguageSelect'),
  rowInstallApp: $('rowInstallApp'),
  installAppLabel: $('installAppLabel'),
  palette: $('palette'),
  paletteInput: $('paletteInput'),
  paletteList: $('paletteList'),
};

const state = {
  title: 'TikTok',
  url: '',
  loading: false,
  muted: false,
  onTop: false,
  pip: false,
  pipAuto: true,
  pipAdaptive: false,
  playing: false,
  maximized: false,
  canGoBack: false,
  canGoForward: false,
  chromeHidden: false,
  unread: 0,
  zoom: 100,
  find: { open: false, text: '', matches: 0, active: 0 },
  download: null,
  panel: false,
  popover: null,
  panelWidth: 300,
  palette: false,
  player: {
    speed: 1,
    volume: 1,
    startMuted: false,
    loop: false,
    pauseOnBlur: false,
    sinkId: '',
    equalizer: 'off',
    mono: false,
    brightness: 100,
    contrast: 100,
    warmth: 0,
    sharpness: 0,
    fit: 'auto',
  },
  cosmetics: [],
  closeToTray: false,
  autostart: false,
  startInTray: false,
  adsSkip: false,
  stickers: { items: [], dir: '' },
  region: { preset: 'off', proxy: '' },
  regionCheck: { state: 'idle', text: 'Проверить' },
  regions: [],
  language: 'ru',
  siteLanguage: 'auto',
  languages: [],
  siteLanguages: [],
  appimage: { available: false, installed: false },
  downloads: [],
  sleepTimerEnds: 0,
  sleepTimerMinutes: 0,
  sleepTimerMode: 'off',
  sleepTimerVideos: 3,
  sleepTimerVideosLeft: 0,
  sleepTimerFade: false,
  audioDevices: [],
  pipTime: 0,
  pipDuration: 0,
  feedKeys: true,
  idlePause: 0,
  keepAwake: false,
  keymap: { profile: 'default', profiles: [], rows: [] },
  subtitles: { enabled: false, size: 100, background: true, outline: true },
  videoDate: '',
  videoQuality: { width: 0, height: 0, bitrate: 0, hevc: false },
  hardwareVideo: { enabled: false, supported: false },
  qr: null,
  barOnly: false,
  chat: { open: false, width: 420, dock: true },
  notifications: {
    enabled: false,
    dnd: false,
    dndFrom: '23:00',
    dndTo: '08:00',
    quietFocused: true,
  },
  replies: [],
  library: { items: [], queue: [] },
  stats: {
    today: { minutes: 0, seconds: 0, videos: 0 },
    week: { minutes: 0, videos: 0 },
    topAuthors: [],
  },
  focus: { enabled: false, minutes: 25, breakMinutes: 5, phase: 'off', elapsed: 0, total: 1500 },
  ambient: false,
  filters: { enabled: false, keywords: [], hashtags: [], authors: [] },
  adsInPip: true,
  adsSkipped: 0,
  adJournal: [],
  downloadNaming: {
    auto: false,
    template: '{author}-{date}-{title}',
    folderPerAuthor: false,
    limit: 2,
  },
  gif: { duration: 3, fps: 10, width: 480 },
  customCode: { enabled: false, cssLength: 0, jsLength: 0 },
  version: '',
  plugins: {
    managerOpen: false,
    installedCount: 0,
    enabledCount: 0,
    updateCount: 0,
    errorCount: 0,
    items: [],
    rows: [],
    commands: [],
  },
};

let toastText = '';
let toastTimer = null;
let findWasOpen = false;

// Раздел, открытый как подстраница настроек, и текущий поисковый запрос.
const PANEL_GROUPS = [
  { title: 'Просмотр', cats: ['page', 'picture', 'filters', 'ads'] },
  { title: 'Плеер и звук', cats: ['playback', 'player', 'gif'] },
  { title: 'Управление', cats: ['keys', 'focus'] },
  { title: 'Общение', cats: ['notify', 'replies'] },
  { title: 'Библиотека', cats: ['library', 'stats', 'downloads'] },
  { title: 'Внешний вид', cats: ['cosmetics', 'custom'] },
  { title: 'Система', cats: ['region', 'language', 'plugins', 'data', 'privacy', 'app'] },
];
const panelGroupNodes = [];
let panelCategory = 'page';
let panelQuery = '';
/** Тела разделов перенесены из списка навигации в правую колонку. */
const settingsBodies = new Map();
let settingsContent = null;
let panelWasOpen = false;

buildPanelNav();
buildSettingsLayout();

if (api.ui.platform === 'darwin') document.body.classList.add('mac');

// --- Действия ---------------------------------------------------------------

const actions = [
  [el.back, 'back'],
  [el.forward, 'forward'],
  [el.reload, 'reload'],
  [el.home, 'home'],
  [el.btnStickers, 'stickerPanel'],
  [el.btnPluginsActive, 'pluginsActive'],
  [el.chat, 'chat'],
  [el.pip, 'pip'],
  [el.barPrev, 'feedPrev'],
  [el.barPlay, 'togglePlayback'],
  [el.barNext, 'feedNext'],
  [el.barPip, 'barPip'],
  [el.barExit, 'barExit'],
  [el.barMute, 'mute'],
  [el.pipPrev, 'feedPrev'],
  [el.pipPlay, 'togglePlayback'],
  [el.pipNext, 'feedNext'],
  [el.pipAuto, 'pipAuto'],
  [el.pipAdaptive, 'pipAdaptive'],
  [el.pipRewind, 'pipRewind'],
  [el.pipClose, 'pipClose'],
  [el.mute, 'mute'],
  [el.top, 'onTop'],
  [el.min, 'minimize'],
  [el.max, 'maximize'],
  [el.close, 'close'],
];

for (const [node, command] of actions) {
  node.addEventListener('click', (event) => {
    event.stopPropagation();
    api.cmd(command);
  });
}

el.findPrev.addEventListener('click', () => api.find('prev'));
el.findNext.addEventListener('click', () => api.find('next'));
el.findClose.addEventListener('click', () => api.find('close'));

el.btnPanel.addEventListener('click', (event) => {
  event.stopPropagation();
  api.cmd('panel');
});
el.btnPanelClose.addEventListener('click', () => api.cmd('panel'));

el.panelSearch.addEventListener('input', applyPanelFilter);
el.panelSearch.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape' || !el.panelSearch.value) return;
  event.preventDefault();
  clearPanelSearch();
  applyPanelFilter();
});
el.panelSearchClear.addEventListener('click', () => {
  clearPanelSearch();
  applyPanelFilter();
  el.panelSearch.focus();
});

// Строки панели: действия, переключатели и закрытие по клику на фон-подложку.
el.panel.addEventListener('click', (event) => {
  if (event.target === el.panel) {
    api.cmd('panel');
    return;
  }

  const catHead = event.target.closest('[data-cat-head]');
  if (catHead) {
    openPanelCategory(catHead.dataset.catHead);
    return;
  }

  const sleep = event.target.closest('[data-sleep]');
  if (sleep) {
    api.cmd('sleepTimer', Number(sleep.dataset.sleep));
    return;
  }

  const sleepVideos = event.target.closest('[data-sleep-videos]');
  if (sleepVideos) {
    const raw = sleepVideos.dataset.sleepVideos;
    const preset = Math.min(50, Math.max(1, Number(state.sleepTimerVideos) || 3));
    const value = raw === 'start' ? preset : preset + Number(raw);
    api.cmd('sleepVideos', Math.min(50, Math.max(1, value)));
    return;
  }

  const cancelDownload = event.target.closest('[data-download-cancel]');
  if (cancelDownload) {
    api.cmd('downloadCancel', cancelDownload.dataset.downloadCancel);
    return;
  }

  const showDownload = event.target.closest('[data-download-show]');
  if (showDownload) {
    api.cmd('downloadShow', showDownload.dataset.downloadShow);
    return;
  }

  const speed = event.target.closest('[data-player-speed]');
  if (speed) {
    api.cmd('playerSpeed', Number(speed.dataset.playerSpeed));
    return;
  }

  const fit = event.target.closest('[data-picture-fit]');
  if (fit) {
    api.cmd('pictureFit', fit.dataset.pictureFit);
    return;
  }

  const playerToggle = event.target.closest('[data-player-toggle]');
  if (playerToggle) {
    api.cmd('playerToggle', playerToggle.dataset.playerToggle);
    return;
  }

  const cosmetic = event.target.closest('[data-cosmetic]');
  if (cosmetic) {
    api.cmd('cosmetic', cosmetic.dataset.cosmetic);
    return;
  }

  const pluginToggle = event.target.closest('[data-plugin-toggle]');
  if (pluginToggle) {
    api.cmd('pluginToggle', pluginToggle.dataset.pluginToggle);
    return;
  }

  const row = event.target.closest('[data-cmd]');
  if (!row) return;
  if (row.dataset.cmd === 'sleepMode') {
    api.cmd('sleepMode', state.sleepTimerMode === 'end' ? 'off' : 'end');
    return;
  }
  if (row.dataset.cmd === 'repliesSave') {
    api.cmd('repliesSet', el.repliesInput.value);
    return;
  }
  if (row.dataset.cmd === 'libraryExport') {
    api.cmd('libraryExport', row.dataset.export || 'json');
    return;
  }
  if (row.dataset.cmd === 'privacyDelete') {
    api.cmd('privacyDelete', { id: row.dataset.id });
    return;
  }
  if (row.dataset.cmd === 'customCodeApply') {
    api.cmd('customCodeSet', { css: el.customCss.value, js: el.customJs.value });
    return;
  }
  if (row.dataset.cmd === 'regionProxyApply') {
    api.cmd('regionProxyApply', el.regionProxy.value.trim());
    return;
  }
  api.cmd(row.dataset.cmd);
});

// Быстрые меню под полосой: стикеры и действия активных плагинов.
el.stickerPopover.addEventListener('click', (event) => {
  const stickerSend = event.target.closest('[data-sticker-send]');
  if (stickerSend) {
    api.cmd('stickerSend', stickerSend.dataset.stickerSend);
    return;
  }

  const stickerRemove = event.target.closest('[data-sticker-remove]');
  if (stickerRemove) api.cmd('stickerRemove', stickerRemove.dataset.stickerRemove);
});

el.pluginsPopover.addEventListener('click', (event) => {
  const action = event.target.closest('[data-plugin-action]');
  if (action) api.cmd(action.dataset.pluginAction);
});

el.btnStickerAdd.addEventListener('click', () => api.cmd('stickerAdd'));
el.btnStickerFolder.addEventListener('click', () => api.cmd('stickerFolder'));
el.btnNativeStickers.addEventListener('click', () => api.cmd('nativeStickers'));
el.btnStickerPopoverClose.addEventListener('click', () => api.cmd('stickerPanel'));
el.btnPluginsManager.addEventListener('click', () => api.cmd('plugins'));
el.btnPluginsPopoverClose.addEventListener('click', () => api.cmd('pluginsActive'));

// Громкость: ползунок живёт в панели и меняет volume у видео сайта.
// Выше 100 % громкость усиляет Web Audio-цепочка в странице (см. player.js).
let volumeTimer = null;
el.volumeRange.addEventListener('input', () => {
  const percent = Math.min(200, Math.max(0, Math.round(Number(el.volumeRange.value) || 0)));
  paintVolume(percent);
  clearTimeout(volumeTimer);
  volumeTimer = setTimeout(() => {
    api.cmd('playerVolume', percent / 100);
  }, 40);
});

// Эквалайзер и аудиовыход: селекты применяются сразу.
el.eqSelect.addEventListener('change', () => api.cmd('playerEqualizer', el.eqSelect.value));
el.audioSinkSelect.addEventListener('change', () =>
  api.cmd('playerSink', el.audioSinkSelect.value),
);

// Громкость в режиме «только полоса»: тот же playerVolume.
let barVolumeTimer = null;
el.barVolume.addEventListener('input', () => {
  const percent = Math.min(200, Math.max(0, Math.round(Number(el.barVolume.value) || 0)));
  paintBarVolume(percent);
  clearTimeout(barVolumeTimer);
  barVolumeTimer = setTimeout(() => {
    api.cmd('playerVolume', percent / 100);
  }, 40);
});

// Картинка: яркость, контраст, резкость, тёплый оттенок и размер субтитров.
const pictureTimers = {};
for (const key of ['brightness', 'contrast', 'sharpness', 'warmth']) {
  const range = el[`${key}Range`];
  const value = el[`${key}Value`];
  range.addEventListener('input', () => {
    const number = Number(range.value) || 0;
    paintRange(range, value, number);
    clearTimeout(pictureTimers[key]);
    pictureTimers[key] = setTimeout(() => {
      api.cmd('picture', { [key]: number });
    }, 60);
  });
}

let captionTimer = null;
el.captionSizeRange.addEventListener('input', () => {
  const number = Number(el.captionSizeRange.value) || 100;
  paintRange(el.captionSizeRange, el.captionSizeValue, number);
  clearTimeout(captionTimer);
  captionTimer = setTimeout(() => {
    api.cmd('captionSize', number);
  }, 60);
});

// Питание и простой.
el.idlePauseSelect.addEventListener('change', () =>
  api.cmd('idlePause', Number(el.idlePauseSelect.value) || 0),
);

// Фильтры контента: списки правил сохраняются целиком при любом изменении.
const saveFilters = () =>
  api.cmd('filtersSet', {
    keywords: el.filterKeywords.value,
    hashtags: el.filterHashtags.value,
    authors: el.filterAuthors.value,
  });

el.filterKeywords.addEventListener('change', saveFilters);
el.filterHashtags.addEventListener('change', saveFilters);
el.filterAuthors.addEventListener('change', saveFilters);

// Загрузки: шаблон имени и лимит одновременных.
el.downloadTemplate.addEventListener('change', () =>
  api.cmd('downloadTemplate', el.downloadTemplate.value),
);
el.downloadLimit.addEventListener('change', () =>
  api.cmd('downloadLimit', Number(el.downloadLimit.value) || 2),
);

// GIF: параметры сохраняются сразу.
el.gifDuration.addEventListener('change', () =>
  api.cmd('gifDuration', Number(el.gifDuration.value)),
);
el.gifFps.addEventListener('change', () => api.cmd('gifFps', Number(el.gifFps.value)));
el.gifWidth.addEventListener('change', () => api.cmd('gifWidth', Number(el.gifWidth.value)));

// Focus mode: длительность просмотра и перерыва.
el.focusMinutes.addEventListener('change', () =>
  api.cmd('focusMinutes', Number(el.focusMinutes.value) || 25),
);
el.focusBreak.addEventListener('change', () =>
  api.cmd('focusBreak', Number(el.focusBreak.value) || 5),
);

// Уведомления: расписание «не беспокоить».
el.notifyFrom.addEventListener('change', () => api.cmd('notifyFrom', el.notifyFrom.value));
el.notifyTo.addEventListener('change', () => api.cmd('notifyTo', el.notifyTo.value));

// Библиотека: поиск по сохранённому и заметки.
el.librarySearch.addEventListener('input', () => renderLibrary());

el.libraryList.addEventListener('click', (event) => {
  const item = event.target.closest('.library-item');
  if (!item) return;
  const id = item.dataset.id;
  if (event.target.closest('[data-library-open]')) api.cmd('libraryOpen', id);
  else if (event.target.closest('[data-library-remove]')) api.cmd('libraryRemove', id);
  else if (event.target.closest('[data-library-queue]')) api.cmd('libraryQueue', id);
});

el.libraryList.addEventListener('change', (event) => {
  const note = event.target.closest('[data-library-note]');
  if (!note) return;
  const item = note.closest('.library-item');
  if (!item) return;
  api.cmd('libraryNote', { id: item.dataset.id, note: note.value });
});

el.historySearch.addEventListener('input', () => renderHistory());

el.historyList.addEventListener('click', (event) => {
  const item = event.target.closest('.library-item');
  if (!item) return;
  const id = item.dataset.id;
  if (event.target.closest('[data-history-open]')) api.cmd('historyOpen', id);
  else if (event.target.closest('[data-history-remove]')) api.cmd('historyRemove', id);
});

el.btnCreatorSave.addEventListener('click', () => {
  api.cmd('creatorNoteSet', {
    author: el.creatorAuthor.value,
    tags: el.creatorTags.value,
    note: el.creatorNote.value,
  });
  el.creatorNote.value = '';
  el.creatorTags.value = '';
});

el.creatorNotesList.addEventListener('click', (event) => {
  const item = event.target.closest('.library-item');
  if (!item) return;
  const author = item.dataset.author;
  if (event.target.closest('[data-creator-open]')) api.cmd('creatorNoteOpen', author);
  else if (event.target.closest('[data-creator-remove]')) api.cmd('creatorNoteRemove', author);
});

el.themeModeSelect.addEventListener('change', () => {
  api.cmd('themeMode', el.themeModeSelect.value);
});

el.profileSelect.addEventListener('change', () => {
  api.cmd('profileSwitch', el.profileSelect.value);
});

el.btnProfileAdd.addEventListener('click', () => {
  api.cmd('profileCreate', el.profileNewName.value);
  el.profileNewName.value = '';
});

el.btnProfileDelete.addEventListener('click', () => {
  const active = state.profiles?.active;
  if (active && active !== 'default') api.cmd('profileDelete', active);
});

// Ширина чата: тянем полоску между чатом и лентой, двойной клик — сброс.
let chatDrag = null;

function chatLeftOffset() {
  return 0;
}

function clampChatWidth(value) {
  return Math.min(980, Math.max(300, Math.round(Number(value) || 420)));
}

el.chatResize.addEventListener('pointerdown', (event) => {
  event.preventDefault();
  const width = clampChatWidth(state.chat?.width || 420);
  chatDrag = { startX: event.clientX, startWidth: width, width, timer: null };
  document.body.classList.add('is-resizing-chat');
  try {
    el.chatResize.setPointerCapture(event.pointerId);
  } catch {
    /* синтетическое событие без захвата */
  }
});

el.chatResize.addEventListener('dblclick', () => api.cmd('chatResize', 420));

window.addEventListener('pointermove', (event) => {
  if (!chatDrag) return;
  chatDrag.width = clampChatWidth(chatDrag.startWidth + (event.clientX - chatDrag.startX));
  el.chatResize.style.left = `${chatLeftOffset() + chatDrag.width}px`;
  clearTimeout(chatDrag.timer);
  chatDrag.timer = setTimeout(() => api.cmd('chatResize', chatDrag.width), 40);
});

const endChatDrag = () => {
  if (!chatDrag) return;
  clearTimeout(chatDrag.timer);
  api.cmd('chatResize', chatDrag.width);
  chatDrag = null;
  document.body.classList.remove('is-resizing-chat');
};

window.addEventListener('pointerup', endChatDrag);
window.addEventListener('pointercancel', endChatDrag);

// Редактор горячих клавиш: клик по строке — ждём сочетание.
let capturing = null;
let keymapSignature = '';
let keymapProfileSignature = '';

el.keymapProfile.addEventListener('change', () => api.cmd('keymapProfile', el.keymapProfile.value));

el.keymapRows.addEventListener('click', (event) => {
  const row = event.target.closest('[data-keymap]');
  if (!row) return;
  capturing = row.dataset.keymap;
  api.cmd('keymapCapturing', true);
  renderKeymap();
});

// Раскладка: на русской event.key кириллический, поэтому для нелатинских
// символов берём физический code. Латинскую букву оставляем по key — на
// AZERTY и Dvorak пользователь назначает символ, а не позицию клавиши.
const KEY_BY_CODE = {
  Minus: '-',
  Equal: '=',
  BracketLeft: '[',
  BracketRight: ']',
  Backslash: '\\',
  Semicolon: ';',
  Quote: "'",
  Comma: ',',
  Period: '.',
  Slash: '/',
  Backquote: '`',
};

function keyFromCode(code) {
  if (typeof code !== 'string' || !code) return '';
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit[0-9]$/.test(code)) return code.slice(5);
  if (/^F(?:[1-9]|1[0-9]|2[0-4])$/.test(code)) return code;
  return KEY_BY_CODE[code] || '';
}

function shortcutFromEvent(event) {
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(event.key)) return null;
  const named = {
    ArrowLeft: 'Left',
    ArrowRight: 'Right',
    ArrowUp: 'Up',
    ArrowDown: 'Down',
    ' ': 'Space',
    Spacebar: 'Space',
    Escape: 'Esc',
    Home: 'Home',
    End: 'End',
    PageUp: 'PageUp',
    PageDown: 'PageDown',
    Tab: 'Tab',
    Enter: 'Enter',
  };
  let key = named[event.key];
  if (!key) key = /^[\x20-\x7e]$/.test(event.key) ? event.key : keyFromCode(event.code);
  if (key === '+') key = '=';
  if (key.length === 1) key = key.toUpperCase();
  if (!key || key.length > 10) return null;

  const parts = [];
  if (event.ctrlKey || event.metaKey) parts.push('Ctrl');
  if (event.altKey) parts.push('Alt');
  if (event.shiftKey) parts.push('Shift');
  return [...parts, key].join('+');
}

// Пока ждём сочетание, перехватываем клавиши до остального интерфейса.
window.addEventListener(
  'keydown',
  (event) => {
    if (!capturing) return;
    event.preventDefault();
    event.stopPropagation();

    const id = capturing;
    if (event.key === 'Escape') {
      capturing = null;
      api.cmd('keymapCapturing', false);
      renderKeymap();
      return;
    }
    if (event.key === 'Backspace' || event.key === 'Delete') {
      capturing = null;
      api.cmd('keymapCapturing', false);
      api.cmd('keymapSet', { id, keys: '' });
      return;
    }

    const keys = shortcutFromEvent(event);
    if (!keys) return;
    capturing = null;
    api.cmd('keymapCapturing', false);
    api.cmd('keymapSet', { id, keys });
  },
  true,
);

// Перемотка в PiP: пока тянем ползунок и сразу после перемотки не перебиваем
// его значением из main, иначе он прыгает назад до ответа страницы.
let pipSeeking = false;
let pipSeekHold = 0;

function pipSeekSeconds() {
  const duration = Number(state.pipDuration) || 0;
  return (Math.min(1000, Math.max(0, Number(el.pipSeek.value) || 0)) / 1000) * duration;
}

el.pipSeek.addEventListener('input', () => {
  pipSeeking = true;
  el.pipTime.textContent = `${formatTime(pipSeekSeconds())} / ${formatTime(
    Number(state.pipDuration) || 0,
  )}`;
});

const commitPipSeek = () => {
  if (!pipSeeking) return;
  pipSeeking = false;
  pipSeekHold = Date.now() + 500;
  api.cmd('pipSeek', pipSeekSeconds());
};

el.pipSeek.addEventListener('change', commitPipSeek);
el.pipSeek.addEventListener('pointerup', commitPipSeek);

// Язык: интерфейс перерисовывается сразу, язык сайта — после перезагрузки.
el.appLanguageSelect.addEventListener('change', () =>
  api.cmd('language', el.appLanguageSelect.value),
);
el.siteLanguageSelect.addEventListener('change', () =>
  api.cmd('siteLanguage', el.siteLanguageSelect.value),
);

// Масштаб меняет только нашу полосу и панель, не страницу TikTok.
el.uiScaleSelect.addEventListener('change', () => {
  api.cmd('uiScale', Number(el.uiScaleSelect.value));
});

let pendingFontPreset = '';

function applyCustomFontName() {
  const family = (el.uiFontNameInput.value || '').trim();
  if (!family) return;
  pendingFontPreset = '';
  api.cmd('uiFont', { preset: 'custom-name', family });
}

el.uiFontSelect.addEventListener('change', () => {
  const preset = el.uiFontSelect.value;
  if (preset === 'custom-name' || preset === 'custom-file') {
    pendingFontPreset = preset;
    renderUiFont();
    if (preset === 'custom-name') el.uiFontNameInput.focus();
    return;
  }
  pendingFontPreset = '';
  api.cmd('uiFont', { preset });
});

el.uiFontNameApply.addEventListener('click', applyCustomFontName);
el.uiFontNameInput.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  applyCustomFontName();
});

el.uiFontPickFile.addEventListener('click', () => {
  pendingFontPreset = '';
  api.cmd('uiFontPick');
});

// Регион: выбор страны применяется сразу, прокси — по кнопке или Enter.
el.regionSelect.addEventListener('change', () => api.cmd('region', el.regionSelect.value));
el.regionProxy.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  api.cmd('regionProxyApply', el.regionProxy.value.trim());
});
api.onPanelCategory((id) => {
  if (!id) return;
  openPanelCategory(id);
});

// Палитра команд.
el.paletteInput.addEventListener('input', () => {
  paletteIndex = 0;
  filterPalette();
});

el.palette.addEventListener('keydown', (event) => {
  if (event.key !== 'Tab') return;
  const focusables = [...el.palette.querySelectorAll('button, input, [tabindex]')].filter(
    (node) => node.tabIndex >= 0 && node.offsetParent !== null,
  );
  if (!focusables.length) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
});

el.paletteInput.addEventListener('keydown', (event) => {
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    movePalette(1);
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    movePalette(-1);
  } else if (event.key === 'Enter') {
    event.preventDefault();
    activatePalette(paletteIndex);
  }
});

el.paletteList.addEventListener('click', (event) => {
  const item = event.target.closest('[data-index]');
  if (item) activatePalette(Number(item.dataset.index));
});

el.findInput.addEventListener('input', () => api.find('query', el.findInput.value));
el.findInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    api.find(event.shiftKey ? 'prev' : 'next');
  }
});

// Двойной клик по пустому месту полосы — развернуть/восстановить.
el.titlebar.addEventListener('dblclick', (event) => {
  if (event.target.closest('button')) return;
  api.cmd('maximize');
});

// Средняя кнопка мыши по «Назад» — как в браузерах, ничего не делает,
// поэтому просто гасим автоскролл-жесты внутри полосы.
el.titlebar.addEventListener('mousedown', (event) => {
  if (event.button === 1) event.preventDefault();
});

// --- Высота интерфейса ------------------------------------------------------

let lastChromeHeight = 0;

function syncChromeHeight() {
  const height = Math.round(el.chrome.getBoundingClientRect().height);
  if (!height || height === lastChromeHeight) return;
  lastChromeHeight = height;
  // Панель функций начинается там же, где и контент сайта.
  document.documentElement.style.setProperty('--chrome-h', `${height}px`);
  // Панель поиска меняет высоту — main должен сдвинуть WebContentsView.
  api.setChromeHeight(height);
}

if ('ResizeObserver' in window) {
  new ResizeObserver(syncChromeHeight).observe(el.chrome);
}

// --- Отрисовка --------------------------------------------------------------

function prettyTitle(text) {
  const clean = (text || '')
    .replace(/\s*[|—–]\s*TikTok\s*$/i, '')
    .replace(/^TikTok\s*[-–—]\s*/i, '')
    .trim();
  if (!clean) return 'TikTok';
  return clean.length > 64 ? `${clean.slice(0, 63)}…` : clean;
}

function renderFind() {
  const find = state.find || { open: false, text: '', matches: 0, active: 0 };
  el.findbar.hidden = !find.open || state.pip;

  if (find.open) {
    if (!findWasOpen) {
      el.findInput.value = find.text || '';
      el.findInput.focus();
      el.findInput.select();
    }
    const text = el.findInput.value.trim();
    el.findCount.textContent =
      text === '' ? '' : find.matches > 0 ? `${find.active}/${find.matches}` : 'Нет совпадений';
    el.findCount.classList.toggle('is-empty', text !== '' && find.matches === 0);
  } else if (findWasOpen) {
    el.findInput.value = '';
    el.findInput.blur();
  }

  findWasOpen = Boolean(find.open);
}

function renderDownload() {
  const download = state.download;
  el.download.hidden = !download;
  document.body.classList.toggle('is-downloading', Boolean(download));
  if (!download) return;

  const percent = Math.max(0, Math.min(100, Number(download.percent) || 0));
  el.downloadFill.style.width = `${percent}%`;
  el.download.title = `${download.name} — ${percent}%`;
}

function renderUnread() {
  const count = Number(state.unread) || 0;
  el.unread.hidden = count <= 0;
  el.unread.textContent = count > 99 ? '99+' : String(count);
  el.unread.title = `Непрочитанных: ${count}`;
  el.pill.title = count > 0 ? `${count} непрочитанных` : '';
}

function setSwitch(row, value) {
  row.setAttribute('aria-checked', String(Boolean(value)));
}

function paintVolume(percent) {
  const value = Math.min(200, Math.max(0, Math.round(Number(percent) || 0)));
  // Ползунок идёт до 200 %, заливка трека — в долях от всей шкалы.
  el.volumeRange.style.setProperty('--volume', `${value / 2}%`);
  el.volumeValue.textContent = `${value} %`;
}

function paintBarVolume(percent) {
  const value = Math.min(200, Math.max(0, Math.round(Number(percent) || 0)));
  el.barVolume.style.setProperty('--volume', `${value / 2}%`);
  el.barVolumeValue.textContent = `${value} %`;
}

/** Заливка ползунка для произвольного диапазона (яркость, контраст и т. п.). */
function paintRange(range, valueNode, value) {
  const min = Number(range.min) || 0;
  const max = Number(range.max) || 100;
  const number = Math.min(max, Math.max(min, Math.round(Number(value) || 0)));
  range.style.setProperty('--volume', `${((number - min) / (max - min)) * 100}%`);
  valueNode.textContent = `${number} %`;
}

let cosmeticsSignature = '';
let regionSignature = '';
let pluginsSignature = '';

function renderPlugins(summary) {
  const plugins = summary || state.plugins || {};
  const items = Array.isArray(plugins.items) ? plugins.items : [];
  const updateCount = Number(plugins.updateCount) || 0;

  el.panelPluginsEmpty.hidden = items.length > 0;
  el.panelPluginsCount.textContent = items.length
    ? updateCount > 0
      ? `Плагинов: ${items.length} · обновлений: ${updateCount}`
      : `Плагинов: ${items.length}`
    : '';

  const signature = items
    .map(
      (item) =>
        `${item.id}:${item.version}:${item.enabled}:${item.update}:${item.dev}:${item.error}`,
    )
    .concat(
      (Array.isArray(plugins.rows) ? plugins.rows : []).map(
        (row) => `row:${row.id}:${row.label}:${row.pluginName}`,
      ),
    )
    .join('|');
  if (signature === pluginsSignature) return;
  pluginsSignature = signature;
  el.panelPlugins.replaceChildren();
  el.panelPluginActions.replaceChildren();

  for (const item of items) {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = `panel-row panel-row-plugin${item.error ? ' is-error' : ''}`;
    row.dataset.pluginToggle = item.id;
    row.setAttribute('role', 'switch');
    row.setAttribute('aria-checked', String(Boolean(item.enabled)));
    row.title = item.error || `${item.name} ${item.version || ''}`.trim();

    const label = document.createElement('span');
    label.className = 'panel-row-label';
    label.textContent = item.name;
    row.append(label);

    const badge = document.createElement('span');
    badge.className = 'panel-row-badge';
    if (item.error) {
      badge.textContent = 'ошибка';
      badge.classList.add('is-error');
    } else if (item.dev) {
      badge.textContent = 'dev';
    } else if (item.update) {
      badge.textContent = 'обновление';
      badge.classList.add('is-update');
    } else {
      badge.textContent = item.version || '';
    }
    row.append(badge);

    const toggle = document.createElement('span');
    toggle.className = 'switch';
    toggle.setAttribute('aria-hidden', 'true');
    row.append(toggle);

    el.panelPlugins.append(row);
  }

  for (const command of Array.isArray(plugins.rows) ? plugins.rows : []) {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'panel-row panel-row-plugin';
    row.dataset.cmd = command.id;
    row.title = command.description || '';

    const label = document.createElement('span');
    label.className = 'panel-row-label';
    label.textContent = command.label;
    row.append(label);

    const badge = document.createElement('span');
    badge.className = 'panel-row-badge';
    badge.textContent = command.pluginName;
    row.append(badge);

    el.panelPluginActions.append(row);
  }
}

let stickersSignature = '';

function renderStickerPicker(summary) {
  const items = Array.isArray(summary?.items) ? summary.items : [];

  el.stickerPopoverCount.textContent = items.length ? String(items.length) : '';
  el.stickerPopoverEmpty.hidden = items.length > 0;

  const signature = items.map((item) => item.id).join('|');
  if (signature === stickersSignature) return;
  stickersSignature = signature;
  el.stickerPopoverGrid.replaceChildren();

  for (const item of items) {
    const tile = document.createElement('div');
    tile.className = 'sticker-tile';

    const send = document.createElement('button');
    send.type = 'button';
    send.className = 'sticker-send';
    send.dataset.stickerSend = item.id;
    send.title = `Отправить «${item.name}»`;
    send.setAttribute('aria-label', `Отправить «${item.name}»`);

    const image = document.createElement('img');
    image.src = `octo-sticker://thumb/${encodeURIComponent(item.id)}`;
    image.alt = item.name;
    image.draggable = false;
    image.loading = 'lazy';
    image.addEventListener('error', () => {
      image.remove();
      const fallback = document.createElement('span');
      fallback.className = 'sticker-fallback';
      fallback.textContent = (item.name || '?').slice(0, 1).toUpperCase();
      send.append(fallback);
    });
    send.append(image);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'sticker-remove';
    remove.dataset.stickerRemove = item.id;
    remove.title = 'Удалить';
    remove.setAttribute('aria-label', 'Удалить');
    remove.textContent = '×';

    tile.append(send, remove);
    el.stickerPopoverGrid.append(tile);
  }
}

let activePluginsSignature = '';

/**
 * Меню активных плагинов: только включённые плагины и их действия.
 * Строки панели и команды плагина запускаются тем же диспетчером, что и
 * строки в боковой панели, поэтому отдельного моста не нужно.
 */
function renderActivePlugins(summary) {
  const plugins = summary || state.plugins || {};
  const items = (Array.isArray(plugins.items) ? plugins.items : []).filter((item) => item.enabled);
  const rows = Array.isArray(plugins.rows) ? plugins.rows : [];
  const commands = Array.isArray(plugins.commands) ? plugins.commands : [];

  el.pluginsPopoverCount.textContent = items.length ? String(items.length) : '';
  el.pluginsPopoverEmpty.hidden = items.length > 0;

  const signature = `${items
    .map((item) => `${item.id}:${item.version}:${item.error}`)
    .join('|')}#${rows.map((row) => `${row.id}:${row.label}:${row.pluginId}`).join('|')}#${commands
    .map((command) => `${command.id}:${command.title}:${command.pluginId}`)
    .join('|')}`;
  if (signature === activePluginsSignature) return;
  activePluginsSignature = signature;
  el.pluginsPopoverList.replaceChildren();

  for (const item of items) {
    const card = document.createElement('section');
    card.className = 'active-plugin';

    const head = document.createElement('header');
    head.className = 'active-plugin-head';

    const name = document.createElement('span');
    name.className = 'active-plugin-name';
    name.textContent = item.name;
    name.dataset.i18nSkip = '1';
    head.append(name);

    const badge = document.createElement('span');
    badge.className = 'panel-row-badge';
    if (item.error) {
      badge.textContent = 'ошибка';
      badge.classList.add('is-error');
    } else if (item.dev) {
      badge.textContent = 'dev';
    } else {
      badge.textContent = item.version || '';
    }
    head.append(badge);
    card.append(head);

    const actions = [
      ...rows
        .filter((row) => row.pluginId === item.id)
        .map((row) => ({ id: row.id, label: row.label, description: row.description })),
      ...commands
        .filter((command) => command.pluginId === item.id)
        .map((command) => ({
          id: command.id,
          label: command.title,
          description: command.description,
        })),
    ];

    if (!actions.length) {
      const empty = document.createElement('p');
      empty.className = 'active-plugin-empty';
      empty.textContent = 'Нет действий';
      card.append(empty);
    }

    for (const action of actions) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'active-plugin-action';
      button.dataset.pluginAction = action.id;
      button.dataset.i18nSkip = '1';
      if (action.description) button.title = action.description;
      button.textContent = action.label;
      card.append(button);
    }

    el.pluginsPopoverList.append(card);
  }
}

function renderCosmetics(list) {
  const items = Array.isArray(list) ? list : [];
  const signature = items.map((item) => item.id).join('|');

  if (signature !== cosmeticsSignature) {
    cosmeticsSignature = signature;
    el.panelCosmetics.replaceChildren();

    for (const item of items) {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'panel-row';
      row.dataset.cosmetic = item.id;
      row.setAttribute('role', 'switch');
      row.setAttribute('aria-checked', 'false');

      const label = document.createElement('span');
      label.className = 'panel-row-label';
      label.textContent = item.label;

      const toggle = document.createElement('span');
      toggle.className = 'switch';
      toggle.setAttribute('aria-hidden', 'true');

      row.append(label, toggle);
      el.panelCosmetics.append(row);
    }
  }

  for (const item of items) {
    const row = [...el.panelCosmetics.children].find((node) => node.dataset.cosmetic === item.id);
    if (row) row.setAttribute('aria-checked', String(Boolean(item.enabled)));
  }
}

let downloadsSignature = '';

function downloadStatus(entry) {
  switch (entry.state) {
    case 'progressing':
      return entry.totalBytes > 0 ? `${entry.percent} %` : '…';
    case 'completed':
      return 'готово';
    case 'cancelled':
      return 'отменено';
    default:
      return 'ошибка';
  }
}

function renderDownloads(list) {
  const downloads = Array.isArray(list) ? list : [];
  el.downloadsEmpty.hidden = downloads.length > 0;

  const signature = downloads
    .map((entry) => `${entry.id}:${entry.state}:${entry.percent}`)
    .join('|');
  if (signature === downloadsSignature) return;
  downloadsSignature = signature;

  el.panelDownloads.replaceChildren();

  for (const entry of downloads) {
    const row = document.createElement('div');
    row.className = 'download-row';

    const name = document.createElement('span');
    name.className = 'download-name';
    name.textContent = entry.name;
    name.title = entry.name;

    const meta = document.createElement('span');
    meta.className = 'download-meta';
    meta.textContent = downloadStatus(entry);

    row.append(name, meta);

    if (entry.state === 'progressing') {
      const cancel = document.createElement('button');
      cancel.type = 'button';
      cancel.className = 'download-action';
      cancel.dataset.downloadCancel = entry.id;
      cancel.title = 'Отменить';
      cancel.setAttribute('aria-label', `Отменить загрузку ${entry.name}`);
      cancel.innerHTML =
        '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l8 8M14 6l-8 8"/></svg>';
      row.append(cancel);
    } else if (entry.state === 'completed') {
      const show = document.createElement('button');
      show.type = 'button';
      show.className = 'download-action';
      show.dataset.downloadShow = entry.id;
      show.title = 'Показать в папке';
      show.setAttribute('aria-label', `Показать ${entry.name} в папке`);
      show.innerHTML =
        '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.2h14M4.4 5.2h4l1.2 1.4h6a1.4 1.4 0 0 1 1.4 1.4v6.6a1.4 1.4 0 0 1-1.4 1.4H4.4A1.4 1.4 0 0 1 3 14.6V6.6a1.4 1.4 0 0 1 1.4-1.4z"/></svg>';
      row.append(show);
    }

    el.panelDownloads.append(row);
  }
}

/** Раскладывает разделы по смысловым группам, сохраняя сами разделы в DOM. */
function buildPanelNav() {
  if (!el.panelBody) return;
  const cats = new Map(
    [...el.panelBody.querySelectorAll('.panel-cat')].map((cat) => [cat.dataset.cat, cat]),
  );

  for (const group of PANEL_GROUPS) {
    const label = document.createElement('p');
    label.className = 'panel-group';
    label.textContent = group.title;
    el.panelBody.append(label);

    const members = [];
    for (const id of group.cats) {
      const cat = cats.get(id);
      if (!cat) continue;
      members.push(cat);
      el.panelBody.append(cat);
    }
    panelGroupNodes.push({ label, cats: members });
  }
}

/**
 * Двухколоночная раскладка настроек: слева — список разделов, справа — тело
 * выбранного раздела (или все подходящие при поиске).
 */
function buildSettingsLayout() {
  if (!el.panelBody) return;

  const nav = document.createElement('nav');
  nav.className = 'settings-nav';
  nav.id = 'settingsNav';
  nav.setAttribute('aria-label', tr('Настройки'));

  const content = document.createElement('div');
  content.className = 'settings-content';
  content.id = 'settingsContent';

  for (const node of [...el.panelBody.children]) {
    if (node.classList.contains('panel-group') || node.classList.contains('panel-cat')) {
      nav.append(node);
    }
  }

  el.panelBody.append(nav, content);
  if (el.panelNoResults) content.append(el.panelNoResults);

  for (const cat of nav.querySelectorAll('.panel-cat')) {
    const body = cat.querySelector('.panel-cat-body');
    if (!body) continue;
    const title = cat.querySelector('.panel-cat-title')?.textContent || '';
    body.dataset.settingsTitle = title;
    body.hidden = true;
    settingsBodies.set(cat.dataset.cat, body);
    content.append(body);
  }

  settingsContent = content;
  panelCategory = nav.querySelector('.panel-cat')?.dataset.cat || 'page';
}

function normalizeSearch(text) {
  return (text || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Сбрасывает поиск, чтобы команда «открыть раздел» не упиралась в фильтр. */
function clearPanelSearch() {
  if (!panelQuery && !el.panelSearch.value) return;
  panelQuery = '';
  el.panelSearch.value = '';
  el.panelSearchClear.hidden = true;
}

/**
 * Показывает выбранный раздел в правой колонке, а при поиске — все подходящие
 * категории и строки. В поиске участвуют названия, подсказки и строки настроек.
 */
function applyPanelFilter() {
  const query = normalizeSearch(el.panelSearch.value);
  panelQuery = query;
  el.panelSearchClear.hidden = !query;

  const settingsNav = $('settingsNav');
  if (settingsNav) settingsNav.setAttribute('aria-label', tr('Настройки'));

  el.panel.dataset.view = query ? 'search' : 'settings';

  const cats = [...el.panel.querySelectorAll('.settings-nav .panel-cat')];
  if (!query && !settingsBodies.has(panelCategory)) {
    panelCategory = cats[0]?.dataset.cat || null;
  }

  let visible = 0;
  for (const cat of cats) {
    const id = cat.dataset.cat;
    const body = settingsBodies.get(id);
    const titleText = cat.querySelector('.panel-cat-title')?.textContent || '';
    const title = normalizeSearch(titleText);
    const titleMatch = Boolean(query) && title.includes(query);
    const noteText = normalizeSearch(
      [...(body?.querySelectorAll('.panel-note, .panel-empty') || [])]
        .filter((hint) => !hint.hasAttribute('hidden'))
        .map((hint) => hint.textContent)
        .join(' '),
    );
    const noteMatch = Boolean(query) && noteText.includes(query);
    let rowMatch = false;

    if (body) {
      body.dataset.settingsTitle = titleText;
      for (const row of body.querySelectorAll('.panel-row, .download-row, .panel-field')) {
        const hiddenRow = row.hasAttribute('hidden');
        const label = normalizeSearch(row.textContent);
        const match = !query || titleMatch || noteMatch || (!hiddenRow && label.includes(query));
        row.classList.toggle('is-filtered', !match);
        if (match && !hiddenRow) rowMatch = true;
      }

      for (const hint of body.querySelectorAll('.panel-note, .panel-empty')) {
        hint.classList.toggle('is-filtered', Boolean(query) && !titleMatch && !noteMatch);
        if (!query) hint.classList.remove('is-filtered');
      }
    }

    const catMatch = !query || titleMatch || noteMatch || rowMatch;
    const active = !query && id === panelCategory;
    const expanded = query ? catMatch : active;
    cat.classList.toggle('is-filtered', Boolean(query) && !catMatch);
    cat.classList.toggle('is-current', active);
    const head = cat.querySelector('[data-cat-head]');
    if (head) {
      if (active) head.setAttribute('aria-current', 'true');
      else head.removeAttribute('aria-current');
      head.setAttribute('aria-expanded', String(expanded));
    }

    if (body) {
      body.hidden = !expanded;
      if (catMatch && query) visible += 1;
    }
  }

  for (const group of panelGroupNodes) {
    group.label.hidden = !group.cats.some((cat) => !cat.classList.contains('is-filtered'));
  }

  el.panelNoResults.hidden = !(query && visible === 0);
}

/** Переключает правую колонку на выбранный раздел настроек. */
function openPanelCategory(id) {
  if (!id) return;
  const cat = el.panel.querySelector(`.panel-cat[data-cat="${id}"]`);
  if (!cat) return;

  panelCategory = id;
  clearPanelSearch();
  applyPanelFilter();
  if (settingsContent) settingsContent.scrollTop = 0;
}

function formatRemaining(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** Таймкод ролика: «1:05». */
function formatTime(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function renderSleep() {
  const ends = Number(state.sleepTimerEnds) || 0;
  const mode = state.sleepTimerMode || 'off';
  const active = mode === 'minutes' && ends > Date.now();
  el.sleepLabel.textContent = active
    ? `Таймер сна · ${formatRemaining(ends - Date.now())}`
    : 'Таймер сна';

  const minutes = active ? Number(state.sleepTimerMinutes) || 0 : 0;
  for (const button of el.panel.querySelectorAll('[data-sleep]')) {
    const value = Number(button.dataset.sleep);
    const selected = value !== 0 && value === minutes;
    button.classList.toggle('is-on', selected);
    button.setAttribute('aria-pressed', String(selected));
  }

  setSwitch(el.rowSleepEnd, mode === 'end');
  setSwitch(el.rowSleepFade, Boolean(state.sleepTimerFade));

  const total = Math.max(1, Number(state.sleepTimerVideos) || 3);
  const left = mode === 'videos' ? Math.max(0, Number(state.sleepTimerVideosLeft) || 0) : 0;
  el.sleepVideosLabel.textContent =
    mode === 'videos' ? `Стоп после видео · осталось ${left}` : 'Стоп после видео';
  el.sleepVideosValue.textContent = String(mode === 'videos' ? left : total);
  el.sleepVideosValue.classList.toggle('is-on', mode === 'videos');
}

/** Прогресс и таймкод в полосе PiP. */
function renderPipProgress() {
  if (!state.pip) pipSeeking = false;
  if (pipSeeking || Date.now() < pipSeekHold) return;

  const duration = Math.max(0, Number(state.pipDuration) || 0);
  const time = Math.max(0, Number(state.pipTime) || 0);
  const fraction = duration > 0 ? Math.min(1, time / duration) : 0;

  el.pipSeek.value = String(Math.round(fraction * 1000));
  el.pipSeek.style.setProperty('--progress', `${(fraction * 100).toFixed(1)}%`);
  el.pipTime.textContent = duration > 0 ? `${formatTime(time)} / ${formatTime(duration)}` : '—';
}

// --- Палитра команд ---------------------------------------------------------

let paletteWasOpen = false;
let paletteIndex = 0;
let paletteFiltered = [];

function paletteItems() {
  const items = [
    { label: 'Главная', cmd: 'home' },
    { label: 'Назад', cmd: 'back' },
    { label: 'Вперёд', cmd: 'forward' },
    { label: 'Обновить', cmd: 'reload', hint: 'Ctrl R' },
    { label: 'Обновить без кэша', cmd: 'hardReload', hint: 'Ctrl Shift R' },
    { label: 'Поиск по странице', cmd: 'find', hint: 'Ctrl F' },
    { label: 'Настройки', cmd: 'panel', hint: 'Ctrl ,' },
    { label: 'Чат сбоку', cmd: 'chat', hint: 'Ctrl Shift C' },
    { label: 'Картинки в чат', cmd: 'stickerPanel' },
    { label: 'Добавить картинки…', cmd: 'stickerAdd' },
    { label: 'Папка картинок', cmd: 'stickerFolder' },
    { label: 'Стикеры TikTok', cmd: 'nativeStickers' },
    { label: 'Менеджер плагинов', cmd: 'plugins', hint: 'Ctrl Shift E' },
    { label: 'Активные плагины', cmd: 'pluginsActive' },
    { label: 'Установить плагин из файла', cmd: 'pluginInstallFile' },
    { label: 'Документация по плагинам', cmd: 'pluginDocs' },
    { label: 'Правила публикации плагинов', cmd: 'pluginRules' },
    { label: 'Папка плагинов', cmd: 'pluginFolder' },
    { label: 'Регион и прокси', cmd: 'regionPanel' },
    { label: 'Обход DPI (экспериментально)', cmd: 'dpiToggle' },
    { label: 'Мастер настройки', cmd: 'welcomeOpen' },
    { label: 'Язык', cmd: 'languagePanel' },
    { label: 'Снимок кадра', cmd: 'screenshot', hint: 'Ctrl Shift S' },
    { label: 'Снимок с аннотацией', cmd: 'screenshotAnnotate' },
    { label: 'Открыть в браузере', cmd: 'openInBrowser', hint: 'Ctrl Shift U' },
    { label: 'QR-код видео', cmd: 'qrVideo' },
    { label: 'Экспорт GIF', cmd: 'gifExport' },
    {
      label: tr((state.focus || {}).enabled ? 'Выключить фокус-режим' : 'Включить фокус-режим'),
      cmd: 'focusToggle',
    },
    { label: 'Амбиентный режим', cmd: 'ambientToggle' },
    { label: 'Экспорт архива (ZIP)', cmd: 'archiveExport' },
    { label: 'Сохранить ролик в библиотеку', cmd: 'libraryAdd' },
    { label: 'Добавить в «Посмотреть позже»', cmd: 'libraryQueueAdd' },
    { label: 'Библиотека', cmd: 'libraryPanel' },
    { label: 'Статистика просмотра', cmd: 'statsPanel' },
    { label: 'Режим «только полоса»', cmd: 'barOnly' },
    { label: 'Выйти из режима «только полоса»', cmd: 'barExit' },
    { label: 'Кадр как на сайте', cmd: 'pictureFit', payload: 'auto' },
    { label: 'Вписать кадр', cmd: 'pictureFit', payload: 'contain' },
    { label: 'Заполнить окно', cmd: 'pictureFit', payload: 'cover' },
    { label: 'Улучшить картинку', cmd: 'pictureEnhance' },
    { label: 'Сбросить картинку', cmd: 'pictureReset' },
    {
      label: tr(
        state.subtitles?.enabled
          ? 'Выключить субтитры по умолчанию'
          : 'Включить субтитры по умолчанию',
      ),
      cmd: 'captionToggle',
    },
    { label: 'Клавиши и сочетания', cmd: 'keysPanel' },
    {
      label: tr(state.feedKeys ? 'Выключить клавиатурную ленту' : 'Включить клавиатурную ленту'),
      cmd: 'feedKeys',
    },
    { label: 'Звук вкл/выкл', cmd: 'mute', hint: 'Ctrl Shift M' },
    { label: 'Картинка в картинке', cmd: 'pip', hint: 'Ctrl Shift P' },
    { label: 'Следующее видео', cmd: 'feedNext', hint: 'Ctrl Shift →' },
    { label: 'Предыдущее видео', cmd: 'feedPrev', hint: 'Ctrl Shift ←' },
    { label: 'Автолистание в PiP', cmd: 'pipAuto' },
    { label: 'Адаптивный PiP', cmd: 'pipAdaptive' },
    { label: 'Выйти из PiP', cmd: 'pipClose', hint: 'Esc' },
    { label: 'Поверх всех окон', cmd: 'onTop', hint: 'Ctrl Shift O' },
    { label: 'Полный экран', cmd: 'fullscreen', hint: 'F11' },
    { label: 'Инструменты разработчика', cmd: 'devtools', hint: 'Ctrl Shift I' },
    { label: 'Папка загрузок', cmd: 'openDownloads' },
    { label: 'Проверить обновления', cmd: 'checkUpdates' },
    { label: 'О программе', cmd: 'about' },
    { label: 'Подписки', cmd: 'openUrl', payload: 'https://www.tiktok.com/following' },
    { label: 'Интересное', cmd: 'openUrl', payload: 'https://www.tiktok.com/explore' },
    { label: 'Выход', cmd: 'quit' },
  ];

  for (const rule of state.cosmetics) {
    items.push({
      label: tr(rule.enabled ? `Отключить «${tr(rule.label)}»` : `Включить «${tr(rule.label)}»`),
      cmd: 'cosmetic',
      payload: rule.id,
    });
  }

  for (const minutes of [15, 30, 60]) {
    items.push({ label: `Таймер сна: ${minutes} мин`, cmd: 'sleepTimer', payload: minutes });
  }
  items.push({ label: 'Таймер сна: до конца ролика', cmd: 'sleepMode', payload: 'end' });
  items.push({ label: 'Таймер сна: выключить', cmd: 'sleepTimer', payload: 0 });
  items.push({ label: 'Плавное затухание', cmd: 'sleepFade' });

  for (const speed of [0.5, 1, 1.5, 2]) {
    items.push({ label: `Скорость ${speed}×`, cmd: 'playerSpeed', payload: speed });
  }

  items.push(
    { label: 'Эквалайзер: речь', cmd: 'playerEqualizer', payload: 'speech' },
    { label: 'Эквалайзер: музыка', cmd: 'playerEqualizer', payload: 'music' },
    { label: 'Эквалайзер: выключить', cmd: 'playerEqualizer', payload: 'off' },
    { label: 'Моно для одного наушника', cmd: 'playerToggle', payload: 'mono' },
    { label: 'Обновить аудиовыходы', cmd: 'audioDevices' },
  );

  items.push(
    { label: 'Запускать без звука', cmd: 'playerToggle', payload: 'startMuted' },
    { label: 'Повторять видео', cmd: 'playerToggle', payload: 'loop' },
    { label: 'Пауза в фоне', cmd: 'playerToggle', payload: 'pauseOnBlur' },
    {
      label: tr(state.adsSkip ? 'Выключить пропуск рекламы' : 'Включить пропуск рекламы'),
      cmd: 'adsSkip',
    },
  );

  items.push(
    {
      label: tr(state.notifications?.enabled ? 'Выключить уведомления' : 'Включить уведомления'),
      cmd: 'notifyToggle',
    },
    {
      label: tr(state.chat?.dock !== false ? 'Чат поверх ленты' : 'Чат поджимает ленту'),
      cmd: 'chatDock',
    },
  );

  for (const [index, text] of (Array.isArray(state.replies) ? state.replies : []).entries()) {
    const short = text.length > 48 ? `${text.slice(0, 47)}…` : text;
    items.push({ label: tr(`Быстрый ответ: ${short}`), cmd: 'replyInsert', payload: index });
  }

  if (state.region && state.region.proxy) {
    items.push({ label: 'Сбросить прокси', cmd: 'regionProxyClear' });
  }

  items.push(
    { label: 'Покадрово: −1 кадр', cmd: 'framePrev' },
    { label: 'Покадрово: +1 кадр', cmd: 'frameNext' },
    { label: 'Цикл A–B: поставить точку A', cmd: 'abLoopA' },
    { label: 'Цикл A–B: поставить точку B', cmd: 'abLoopB' },
    { label: 'Цикл A–B: сбросить', cmd: 'abLoopClear' },
    { label: 'Проверить внешний IP', cmd: 'regionCheckIp' },
    { label: 'Проверить связь с TikTok', cmd: 'regionTestProxy' },
    { label: 'Тема: как в системе', cmd: 'themeMode', payload: 'system' },
    { label: 'Тема: тёмная', cmd: 'themeMode', payload: 'dark' },
    { label: 'Тема: светлая', cmd: 'themeMode', payload: 'light' },
    { label: 'Сбросить данные сайта…', cmd: 'regionResetData' },
  );

  for (const profile of state.profiles?.list || []) {
    if (profile.id === state.profiles?.active) continue;
    items.push({
      label: tr(`Переключить профиль: ${profile.name}`),
      cmd: 'profileSwitch',
      payload: profile.id,
    });
  }

  if (state.appimage && state.appimage.available) {
    items.push({
      label: state.appimage.installed
        ? 'Удалить из меню приложений'
        : 'Установить в меню приложений',
      cmd: 'appimageInstall',
    });
  }

  const plugins = state.plugins || {};
  for (const item of Array.isArray(plugins.items) ? plugins.items : []) {
    items.push({
      label: tr(
        item.enabled ? `Выключить плагин «${item.name}»` : `Включить плагин «${item.name}»`,
      ),
      cmd: 'pluginToggle',
      payload: item.id,
    });
  }
  for (const command of Array.isArray(plugins.commands) ? plugins.commands : []) {
    items.push({
      label: `${command.title} · ${command.pluginName}`,
      cmd: command.id,
    });
  }
  for (const row of Array.isArray(plugins.rows) ? plugins.rows : []) {
    items.push({
      label: `${row.label} · ${row.pluginName}`,
      cmd: row.id,
    });
  }

  return items;
}

function renderPaletteList() {
  el.paletteList.replaceChildren();

  if (!paletteFiltered.length) {
    const empty = document.createElement('div');
    empty.className = 'palette-empty';
    empty.textContent = 'Ничего не найдено';
    el.paletteList.append(empty);
    return;
  }

  paletteFiltered.forEach((item, index) => {
    const row = document.createElement('button');
    row.type = 'button';
    row.className = `palette-item${index === paletteIndex ? ' is-active' : ''}`;
    row.dataset.index = String(index);
    row.setAttribute('role', 'option');
    row.setAttribute('aria-selected', String(index === paletteIndex));

    const label = document.createElement('span');
    label.textContent = item.label;
    row.append(label);

    if (item.hint) {
      const kbd = document.createElement('kbd');
      kbd.textContent = item.hint;
      row.append(kbd);
    }

    el.paletteList.append(row);
  });

  const active = el.paletteList.children[paletteIndex];
  if (active && active.scrollIntoView) active.scrollIntoView({ block: 'nearest' });
}

function filterPalette() {
  const query = el.paletteInput.value.trim().toLowerCase();
  const all = paletteItems();
  paletteFiltered = query ? all.filter((item) => item.label.toLowerCase().includes(query)) : all;

  if (paletteIndex >= paletteFiltered.length) {
    paletteIndex = Math.max(0, paletteFiltered.length - 1);
  }
  renderPaletteList();
}

function movePalette(delta) {
  if (!paletteFiltered.length) return;
  paletteIndex = (paletteIndex + delta + paletteFiltered.length) % paletteFiltered.length;
  renderPaletteList();
}

function activatePalette(index) {
  const item = paletteFiltered[index];
  if (!item) return;
  api.cmd('palette');
  api.cmd(item.cmd, item.payload);
}

function renderPalette() {
  el.palette.hidden = !state.palette;

  if (state.palette && !paletteWasOpen) {
    el.paletteInput.value = '';
    paletteIndex = 0;
    filterPalette();
    el.paletteInput.focus();
  } else if (!state.palette && paletteWasOpen) {
    el.paletteInput.blur();
  }

  paletteWasOpen = Boolean(state.palette);
}

function renderPlayer() {
  const player = state.player || { speed: 1 };
  for (const button of el.panel.querySelectorAll('[data-player-speed]')) {
    const value = Number(button.dataset.playerSpeed);
    const active = Math.abs(value - Number(player.speed || 1)) < 0.001;
    button.classList.toggle('is-on', active);
    button.setAttribute('aria-pressed', String(active));
  }

  // Пока пользователь тянет ползунок, не перебиваем его значениями из main.
  if (document.activeElement !== el.volumeRange) {
    const volume = player.volume === undefined ? 1 : Number(player.volume);
    const percent = Math.round(Math.min(2, Math.max(0, volume || 0)) * 100);
    el.volumeRange.value = String(percent);
    paintVolume(percent);
  }

  if (document.activeElement !== el.eqSelect) {
    el.eqSelect.value = player.equalizer || 'off';
  }

  setSwitch(el.rowStartMuted, player.startMuted);
  setSwitch(el.rowStickySpeed, player.stickySpeed !== false);
  setSwitch(el.rowLoop, player.loop);
  const ab = state.abLoop || {};
  if (ab.enabled && ab.a !== null && ab.b !== null) {
    el.abLoopValue.textContent = `${formatTime(ab.a)} – ${formatTime(ab.b)}`;
  } else if (ab.a !== null) {
    el.abLoopValue.textContent = `A: ${formatTime(ab.a)}`;
  } else if (ab.b !== null) {
    el.abLoopValue.textContent = `B: ${formatTime(ab.b)}`;
  } else {
    el.abLoopValue.textContent = 'Выкл';
  }
  setSwitch(el.rowPauseBlur, player.pauseOnBlur);
  setSwitch(el.rowMono, player.mono);
  setSwitch(el.rowKeepAwake, state.keepAwake);
  el.idlePauseSelect.value = String(Number(state.idlePause) || 0);
  renderAudioSinks(player);

  const hardware = state.hardwareVideo || { enabled: false, supported: false };
  el.rowHardwareVideo.hidden = !hardware.supported;
  el.hardwareVideoNote.hidden = !hardware.supported;
  setSwitch(el.rowHardwareVideo, hardware.enabled);

  const quality = state.videoQuality || {};
  const width = Math.max(0, Number(quality.width) || 0);
  const height = Math.max(0, Number(quality.height) || 0);
  const bitrate = Math.max(0, Number(quality.bitrate) || 0);
  if (!width || !height) {
    el.videoQualityValue.textContent = '—';
  } else if (bitrate > 0) {
    const mbps = (bitrate / 1000).toFixed(1).replace('.', ',');
    el.videoQualityValue.textContent = `${width}×${height} · ~${mbps} ${tr('Мбит/с')}`;
  } else {
    el.videoQualityValue.textContent = `${width}×${height}`;
  }
  el.videoHevcValue.textContent = quality.hevc ? tr('поддерживается') : tr('не поддерживается');
}

let sinkSignature = '';

/** Список аудиовыходов приходит из страницы: в main нет mediaDevices. */
function renderAudioSinks(player) {
  const devices = Array.isArray(state.audioDevices) ? state.audioDevices : [];
  const selected = typeof player.sinkId === 'string' ? player.sinkId : '';
  const signature = `${selected}#${devices.map((device) => `${device.id}:${device.label}`).join('|')}`;
  if (signature === sinkSignature) return;
  sinkSignature = signature;

  const label = (index) => tr('Выход {0}').replace('{0}', String(index + 1));
  const options = [{ id: '', label: 'Системный вывод', skip: false }];
  devices.forEach((device, index) => {
    options.push({ id: device.id, label: device.label || label(index), skip: true });
  });
  // Выбранного устройства может уже не быть в системе — не подменяем его чужим.
  if (selected && !options.some((item) => item.id === selected)) {
    options.push({ id: selected, label: 'Выбранное устройство', skip: false });
  }

  el.audioSinkSelect.replaceChildren(
    ...options.map((item) => {
      const option = document.createElement('option');
      option.value = item.id;
      option.textContent = item.label;
      option.selected = item.id === selected;
      if (item.skip) option.dataset.i18nSkip = '1';
      return option;
    }),
  );
  el.audioSinkSelect.value = selected;
}

/** Редактор горячих клавиш: профили, строки команд и подсветка конфликтов. */
function renderKeymap() {
  const keymap = state.keymap || { profile: 'default', profiles: [], rows: [] };
  const profiles = Array.isArray(keymap.profiles) ? keymap.profiles : [];
  const rows = Array.isArray(keymap.rows) ? keymap.rows : [];

  const profileSignature = `${keymap.profile}#${profiles
    .map((profile) => `${profile.id}:${profile.label}`)
    .join('|')}`;
  if (profileSignature !== keymapProfileSignature) {
    keymapProfileSignature = profileSignature;
    el.keymapProfile.replaceChildren(
      ...profiles.map((profile) => {
        const option = document.createElement('option');
        option.value = profile.id;
        option.textContent = profile.label;
        option.selected = profile.id === keymap.profile;
        return option;
      }),
    );
    el.keymapProfile.value = keymap.profile;
  }

  setSwitch(el.rowFeedKeys, state.feedKeys !== false);

  const signature = `${capturing || ''}#${rows.map((row) => `${row.id}:${row.keys}`).join('|')}`;
  if (signature === keymapSignature) return;
  keymapSignature = signature;

  const counts = new Map();
  for (const row of rows) {
    if (!row.keys) continue;
    counts.set(row.keys, (counts.get(row.keys) || 0) + 1);
  }

  el.keymapRows.replaceChildren(
    ...rows.map((row) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'keymap-row';
      button.dataset.keymap = row.id;
      button.classList.toggle('is-capturing', capturing === row.id);
      button.classList.toggle('is-conflict', Boolean(row.keys) && (counts.get(row.keys) || 0) > 1);

      const label = document.createElement('span');
      label.className = 'keymap-label';
      label.textContent = row.label;

      const key = document.createElement('kbd');
      key.className = 'keymap-key';
      key.textContent = capturing === row.id ? 'Нажмите сочетание…' : row.keys || 'Не назначено';

      button.append(label, key);
      return button;
    }),
  );
}

/** Картинка и субтитры: ползунки, «вписать/заполнить» и тумблеры. */
function renderPicture() {
  const player = state.player || {};
  const subtitles = state.subtitles || {};

  if (document.activeElement !== el.brightnessRange) {
    el.brightnessRange.value = String(Math.round(player.brightness ?? 100));
  }
  paintRange(el.brightnessRange, el.brightnessValue, Number(el.brightnessRange.value));

  if (document.activeElement !== el.contrastRange) {
    el.contrastRange.value = String(Math.round(player.contrast ?? 100));
  }
  paintRange(el.contrastRange, el.contrastValue, Number(el.contrastRange.value));

  if (document.activeElement !== el.sharpnessRange) {
    el.sharpnessRange.value = String(Math.round(player.sharpness ?? 0));
  }
  paintRange(el.sharpnessRange, el.sharpnessValue, Number(el.sharpnessRange.value));

  if (document.activeElement !== el.warmthRange) {
    el.warmthRange.value = String(Math.round(player.warmth ?? 0));
  }
  paintRange(el.warmthRange, el.warmthValue, Number(el.warmthRange.value));

  if (document.activeElement !== el.captionSizeRange) {
    el.captionSizeRange.value = String(Math.round(subtitles.size ?? 100));
  }
  paintRange(el.captionSizeRange, el.captionSizeValue, Number(el.captionSizeRange.value));

  const fit = player.fit === 'contain' || player.fit === 'cover' ? player.fit : 'auto';
  for (const button of el.panel.querySelectorAll('[data-picture-fit]')) {
    const active = button.dataset.pictureFit === fit;
    button.classList.toggle('is-on', active);
    button.setAttribute('aria-pressed', String(active));
  }

  setSwitch(el.rowCaptions, subtitles.enabled);
  setSwitch(el.rowCaptionBg, subtitles.background !== false);
  setSwitch(el.rowCaptionOutline, subtitles.outline !== false);

  el.videoDateValue.textContent = state.videoDate || '—';
}

let qrSignature = '';

/** QR рисуем на canvas: CSP не нужно расширять ради картинки из data:. */
function renderQr() {
  const qr = state.qr;
  el.qrCard.hidden = !qr;
  if (!qr) {
    qrSignature = '';
    return;
  }

  el.qrUrl.textContent = qr.url;
  const signature = `${qr.url}#${qr.count}`;
  if (signature === qrSignature) return;
  qrSignature = signature;

  const canvas = el.qrCanvas;
  const context = canvas.getContext('2d');
  if (!context) return;

  const size = canvas.width;
  const cell = size / qr.count;
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, size, size);
  context.fillStyle = '#000000';
  for (let y = 0; y < qr.count; y += 1) {
    const row = qr.rows[y] || '';
    for (let x = 0; x < row.length; x += 1) {
      if (row[x] !== '1') continue;
      context.fillRect(
        Math.floor(x * cell),
        Math.floor(y * cell),
        Math.ceil(cell),
        Math.ceil(cell),
      );
    }
  }
}

/** Компактный пульт: без сайта и видео, только управление. */
function renderBar() {
  const bar = Boolean(state.barOnly);
  document.body.classList.toggle('is-bar', bar);
  el.baronly.hidden = !bar;
  if (!bar) return;

  el.barTitle.textContent = toastText || prettyTitle(state.title);
  el.barTitle.classList.toggle('is-toast', Boolean(toastText));
  el.barPlay.classList.toggle('is-playing', Boolean(state.playing));
  el.barPlay.title = state.playing ? 'Пауза' : 'Играть';
  el.barPlay.setAttribute('aria-label', state.playing ? 'Пауза' : 'Играть');
  el.barMute.classList.toggle('is-on', Boolean(state.muted));
  el.barMute.setAttribute('aria-pressed', String(Boolean(state.muted)));

  if (document.activeElement !== el.barVolume) {
    const percent = Math.round(Math.min(2, Math.max(0, Number(state.player?.volume ?? 1))) * 100);
    el.barVolume.value = String(percent);
    paintBarVolume(percent);
  }
}

/** Полоска ширины чата: видна только когда чат открыт и не в PiP/полосе. */
function renderChatHandle() {
  const chat = state.chat || {};
  const visible = Boolean(chat.open) && !state.pip && !state.barOnly && !state.chromeHidden;
  el.chatResize.hidden = !visible;
  if (!visible) return;
  if (chatDrag) return; // во время перетаскивания позицией управляет pointermove
  el.chatResize.style.left = `${chatLeftOffset() + clampChatWidth(chat.width || 420)}px`;
}

function renderNotifications() {
  const settings = state.notifications || {};
  setSwitch(el.rowNotify, settings.enabled);
  setSwitch(el.rowNotifyQuiet, settings.quietFocused !== false);
  setSwitch(el.rowNotifyDnd, settings.dnd);

  if (document.activeElement !== el.notifyFrom) {
    el.notifyFrom.value = settings.dndFrom || '23:00';
  }
  if (document.activeElement !== el.notifyTo) {
    el.notifyTo.value = settings.dndTo || '08:00';
  }
}

function renderReplies() {
  const replies = Array.isArray(state.replies) ? state.replies : [];
  if (document.activeElement === el.repliesInput) return;
  const text = replies.join('\n');
  if (el.repliesInput.value !== text) el.repliesInput.value = text;
}

let librarySignature = '';
let statsSignature = '';

function createLibraryItem(item, inQueue) {
  const wrapper = document.createElement('div');
  wrapper.className = 'library-item';
  wrapper.dataset.id = item.id;

  const head = document.createElement('div');
  head.className = 'library-head';

  const open = document.createElement('button');
  open.type = 'button';
  open.className = 'library-open';
  open.dataset.libraryOpen = '1';
  open.textContent = item.title || item.url;

  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'library-remove';
  remove.dataset.libraryRemove = '1';
  remove.title = 'Удалить';
  remove.setAttribute('aria-label', 'Удалить');
  remove.textContent = '×';

  head.append(open, remove);

  const meta = document.createElement('div');
  meta.className = 'library-meta';
  meta.textContent = [item.author ? `@${item.author}` : '', formatTime(item.time)]
    .filter(Boolean)
    .join(' · ');

  const note = document.createElement('input');
  note.type = 'text';
  note.className = 'library-note';
  note.dataset.libraryNote = '1';
  note.placeholder = 'Заметка';
  note.setAttribute('aria-label', 'Заметка');
  note.value = item.note || '';

  const actions = document.createElement('div');
  actions.className = 'library-actions';

  const queue = document.createElement('button');
  queue.type = 'button';
  queue.className = `library-chip${inQueue ? ' is-on' : ''}`;
  queue.dataset.libraryQueue = '1';
  queue.textContent = inQueue ? 'Из очереди' : 'В очередь';
  queue.setAttribute('aria-pressed', String(inQueue));

  actions.append(queue);
  wrapper.append(head, meta, note, actions);
  return wrapper;
}

function renderLibrary() {
  const library = state.library || { items: [], queue: [] };
  const items = Array.isArray(library.items) ? library.items : [];
  const queue = new Set(Array.isArray(library.queue) ? library.queue : []);
  const query = el.librarySearch.value.trim().toLowerCase();

  const visible = items.filter((item) => {
    if (!query) return true;
    return `${item.title} ${item.author} ${item.note}`.toLowerCase().includes(query);
  });

  el.libraryEmpty.hidden = visible.length > 0;
  el.libraryEmpty.textContent = items.length
    ? 'Ничего не найдено'
    : 'Пока пусто: сохраните ролик кнопкой выше.';

  const signature = `${query}#${visible
    .map((item) => `${item.id}:${item.note}:${item.title}:${queue.has(item.id) ? 1 : 0}`)
    .join('|')}`;
  if (signature === librarySignature) return;
  librarySignature = signature;

  el.libraryList.replaceChildren(
    ...visible.map((item) => createLibraryItem(item, queue.has(item.id))),
  );
}

let historySignature = '';
let creatorNotesSignature = '';
let profilesSignature = '';

function renderProfiles() {
  const profiles = state.profiles || { active: 'default', list: [] };
  const list = Array.isArray(profiles.list) ? profiles.list : [];
  const signature = `${profiles.active}#${list.map((p) => `${p.id}:${p.name}`).join('|')}`;
  el.btnProfileDelete.disabled = !profiles.active || profiles.active === 'default';
  if (signature === profilesSignature) return;
  profilesSignature = signature;

  el.profileSelect.replaceChildren(
    ...list.map((item) => {
      const opt = document.createElement('option');
      opt.value = item.id;
      opt.textContent = item.name;
      opt.selected = item.id === profiles.active;
      return opt;
    }),
  );
  el.profileSelect.value = profiles.active || 'default';
}

function renderHistory() {
  const list = Array.isArray(state.history) ? state.history : [];
  const query = el.historySearch.value.trim().toLowerCase();
  const visible = list
    .filter((item) => {
      if (!query) return true;
      return `${item.title} ${item.author}`.toLowerCase().includes(query);
    })
    .slice(0, 60);

  el.historyEmpty.hidden = visible.length > 0;
  el.historyEmpty.textContent = list.length
    ? 'Ничего не найдено'
    : 'История просмотров пока пуста.';

  const signature = `${query}#${visible.map((item) => `${item.id}:${item.title}`).join('|')}`;
  if (signature === historySignature) return;
  historySignature = signature;

  el.historyList.replaceChildren(
    ...visible.map((item) => {
      const row = document.createElement('div');
      row.className = 'library-item';
      row.dataset.id = item.id;

      const head = document.createElement('div');
      head.className = 'library-head';

      const openBtn = document.createElement('button');
      openBtn.type = 'button';
      openBtn.className = 'library-open';
      openBtn.dataset.historyOpen = '1';
      openBtn.dataset.i18nSkip = '1';
      openBtn.textContent = item.title || item.author || item.url;

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'library-del';
      removeBtn.dataset.historyRemove = '1';
      removeBtn.setAttribute('aria-label', tr('Удалить'));
      removeBtn.textContent = '×';

      head.append(openBtn, removeBtn);

      if (item.author) {
        const meta = document.createElement('div');
        meta.className = 'library-meta';
        meta.dataset.i18nSkip = '1';
        meta.textContent = `@${item.author}`;
        row.append(head, meta);
      } else {
        row.append(head);
      }
      return row;
    }),
  );
}

function renderCreatorNotes() {
  const list = Array.isArray(state.creatorNotes) ? state.creatorNotes : [];
  const signature = list
    .map((item) => `${item.author}:${item.note}:${(item.tags || []).join(',')}`)
    .join('|');
  if (signature === creatorNotesSignature) return;
  creatorNotesSignature = signature;

  el.creatorNotesList.replaceChildren(
    ...list.map((item) => {
      const row = document.createElement('div');
      row.className = 'library-item';
      row.dataset.author = item.author;

      const head = document.createElement('div');
      head.className = 'library-head';

      const openBtn = document.createElement('button');
      openBtn.type = 'button';
      openBtn.className = 'library-open';
      openBtn.dataset.creatorOpen = '1';
      openBtn.dataset.i18nSkip = '1';
      openBtn.textContent = item.author;

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'library-del';
      removeBtn.dataset.creatorRemove = '1';
      removeBtn.setAttribute('aria-label', tr('Удалить'));
      removeBtn.textContent = '×';

      head.append(openBtn, removeBtn);
      row.append(head);

      const details = [
        ...(Array.isArray(item.tags) && item.tags.length
          ? [item.tags.map((t) => `#${t}`).join(' ')]
          : []),
        ...(item.note ? [item.note] : []),
      ].join(' · ');
      if (details) {
        const meta = document.createElement('div');
        meta.className = 'library-meta';
        meta.dataset.i18nSkip = '1';
        meta.textContent = details;
        row.append(meta);
      }
      return row;
    }),
  );
}

function renderStats() {
  const stats = state.stats || {};
  const today = stats.today || { minutes: 0, videos: 0 };
  const week = stats.week || { minutes: 0, videos: 0 };
  const authors = Array.isArray(stats.topAuthors) ? stats.topAuthors : [];

  el.statsToday.textContent = String(Number(today.minutes) || 0);
  el.statsTodayVideos.textContent = String(Number(today.videos) || 0);
  el.statsWeek.textContent = String(Number(week.minutes) || 0);
  el.statsWeekVideos.textContent = String(Number(week.videos) || 0);

  const signature = authors.map((author) => `${author.name}:${author.videos}`).join('|');
  el.statsEmpty.hidden = authors.length > 0;
  if (signature === statsSignature) return;
  statsSignature = signature;

  el.statsAuthors.replaceChildren(
    ...authors.map((author) => {
      const row = document.createElement('div');
      row.className = 'library-item';

      const head = document.createElement('div');
      head.className = 'library-head';

      const name = document.createElement('span');
      name.className = 'library-open';
      name.dataset.i18nSkip = '1';
      name.textContent = `@${author.name}`;

      const count = document.createElement('span');
      count.className = 'library-chip';
      count.dataset.i18nSkip = '1';
      count.textContent = String(author.videos);

      head.append(name, count);
      row.append(head);
      return row;
    }),
  );
}

let adsSignature = '';

/** Фильтры, пропуск рекламы и настройки загрузок. */
function renderFiltersSettings() {
  const filters = state.filters || {};
  setSwitch(el.rowFilters, filters.enabled === true);

  const fill = (field, list) => {
    if (document.activeElement === field) return;
    const text = (Array.isArray(list) ? list : []).join('\n');
    if (field.value !== text) field.value = text;
  };
  fill(el.filterKeywords, filters.keywords);
  fill(el.filterHashtags, filters.hashtags);
  fill(el.filterAuthors, filters.authors);

  setSwitch(el.rowAdsPip, state.adsInPip !== false);
  el.adsCount.textContent = String(Number(state.adsSkipped) || 0);

  const journal = Array.isArray(state.adJournal) ? state.adJournal : [];
  const signature = journal.join('|');
  if (signature !== adsSignature) {
    adsSignature = signature;
    el.adsJournal.replaceChildren(
      ...journal.map((at) => {
        const date = new Date(Number(at) || Date.now());
        const item = document.createElement('span');
        item.className = 'ad-journal-item';
        item.textContent = `${String(date.getHours()).padStart(2, '0')}:${String(
          date.getMinutes(),
        ).padStart(2, '0')}`;
        item.title = date.toLocaleString();
        return item;
      }),
    );
  }

  const naming = state.downloadNaming || {};
  setSwitch(el.rowDownloadAuto, naming.auto === true);
  setSwitch(el.rowDownloadFolder, naming.folderPerAuthor === true);
  if (document.activeElement !== el.downloadTemplate) {
    el.downloadTemplate.value = naming.template || '{author}-{date}-{title}';
  }
  if (document.activeElement !== el.downloadLimit) {
    el.downloadLimit.value = String(Number(naming.limit) || 2);
  }

  const gif = state.gif || {};
  if (document.activeElement !== el.gifDuration) {
    el.gifDuration.value = String(Number(gif.duration) || 3);
  }
  if (document.activeElement !== el.gifFps) {
    el.gifFps.value = String(Number(gif.fps) || 10);
  }
  if (document.activeElement !== el.gifWidth) {
    el.gifWidth.value = String(Number(gif.width) || 480);
  }
}

let languageSignature = '';
let siteLanguageSignature = '';

function fillLanguageSelect(select, items, selected, native) {
  select.replaceChildren(
    ...(Array.isArray(items) ? items : []).map((item) => {
      const option = document.createElement('option');
      option.value = item.id;
      option.textContent = item.label;
      option.selected = item.id === selected;
      // Названия языков принято показывать на самом языке, не переводим.
      if (native || item.id !== 'auto') option.dataset.i18nSkip = '1';
      return option;
    }),
  );
  select.value = selected;
}

function renderLanguages() {
  const languages = Array.isArray(state.languages) ? state.languages : [];
  const siteLanguages = Array.isArray(state.siteLanguages) ? state.siteLanguages : [];
  const selected = state.language || 'ru';
  const selectedSite = state.siteLanguage || 'auto';

  const signature = `${selected}#${languages.map((item) => `${item.id}:${item.label}`).join('|')}`;
  if (signature !== languageSignature) {
    languageSignature = signature;
    fillLanguageSelect(el.appLanguageSelect, languages, selected, true);
  }

  const siteSignature = `${selectedSite}#${siteLanguages
    .map((item) => `${item.id}:${item.label}`)
    .join('|')}`;
  if (siteSignature !== siteLanguageSignature) {
    siteLanguageSignature = siteSignature;
    fillLanguageSelect(el.siteLanguageSelect, siteLanguages, selectedSite, false);
  }
}

let loadedFontKey = '';
let loadedFontFace = null;

function applyUiFontCss(font) {
  const preset = (font && font.preset) || 'google-sans-medium';
  const root = document.documentElement.style;

  if (preset === 'inter') {
    root.setProperty('--ui-font', 'var(--ui-font-fallback)');
    return;
  }
  if (preset === 'system') {
    root.setProperty(
      '--ui-font',
      "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    );
    return;
  }
  if (preset === 'custom-name' && font.family) {
    root.setProperty('--ui-font', `'${font.family}', var(--ui-font-fallback)`);
    return;
  }
  if (preset === 'custom-file' && font.dataBase64) {
    const key = `${font.fileName || ''}:${font.dataBase64.length}:${font.dataBase64.slice(0, 32)}`;
    if (key === loadedFontKey) {
      root.setProperty('--ui-font', "'OctoCustomFont', var(--ui-font-fallback)");
      return;
    }
    try {
      const bin = window.atob(font.dataBase64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
      const face = new window.FontFace('OctoCustomFont', bytes);
      face
        .load()
        .then((ready) => {
          if (loadedFontFace) document.fonts.delete(loadedFontFace);
          document.fonts.add(ready);
          loadedFontFace = ready;
          loadedFontKey = key;
          root.setProperty('--ui-font', "'OctoCustomFont', var(--ui-font-fallback)");
        })
        .catch(() => {
          root.setProperty(
            '--ui-font',
            "'Google Sans Medium', 'Google Sans', 'Google Sans Flex', var(--ui-font-fallback)",
          );
        });
    } catch {
      /* некорректные данные шрифта — остаётся шрифт по умолчанию */
    }
    return;
  }

  root.setProperty(
    '--ui-font',
    "'Google Sans Medium', 'Google Sans', 'Google Sans Flex', var(--ui-font-fallback)",
  );
}

function renderUiFont() {
  const font = state.uiFont || { preset: 'google-sans-medium', family: '', fileName: '' };
  applyUiFontCss(font);
  const effectivePreset = pendingFontPreset || font.preset || 'google-sans-medium';

  if (document.activeElement !== el.uiFontSelect) {
    el.uiFontSelect.value = effectivePreset;
  }
  el.uiFontCustomNameRow.hidden = effectivePreset !== 'custom-name';
  el.uiFontCustomFileRow.hidden = effectivePreset !== 'custom-file';

  if (document.activeElement !== el.uiFontNameInput && font.family) {
    el.uiFontNameInput.value = font.family;
  }
  el.uiFontFileName.textContent = font.fileName || tr('Файл не выбран');
}

function renderResilience() {
  el.offlineScreen.hidden = state.offline !== true;
  const safeMode = state.safeMode === true;
  el.rowSafeMode.hidden = !safeMode;
  el.safeModeNote.hidden = !safeMode;
  setSwitch(el.rowMemoryGuard, state.memoryGuard !== false);
  setSwitch(el.rowEco, state.ecoOnBattery !== false);

  if (document.activeElement !== el.uiScaleSelect) {
    el.uiScaleSelect.value = String(state.uiScale || 1);
  }
  renderUiFont();

  const parts = [];
  parts.push(state.onBattery === true ? 'Питание: батарея' : 'Питание: сеть');
  if (state.eco === true) parts.push('экономный режим включён');
  el.ecoNote.textContent = parts.join(' · ');
}

function formatSize(bytes) {
  const value = Number(bytes) || 0;
  if (value < 1024) return `${value} Б`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} КБ`;
  return `${(value / 1024 / 1024).toFixed(1)} МБ`;
}

let privacySignature = '';

function renderPrivacy(privacy) {
  const items = Array.isArray(privacy.items) ? privacy.items : [];
  const signature = items
    .map((item) => `${item.id}:${item.bytes}:${item.detail}:${item.deletable}`)
    .join('|');
  el.privacySize.textContent = formatSize(privacy.totalBytes || 0);

  if (signature === privacySignature) return;
  privacySignature = signature;

  el.privacyList.replaceChildren(
    ...items.map((item) => {
      const row = document.createElement('div');
      row.className = 'panel-row panel-row--static privacy-row';

      const main = document.createElement('span');
      main.className = 'privacy-main';
      const label = document.createElement('span');
      label.className = 'panel-row-label';
      label.textContent = item.label;
      const detail = document.createElement('span');
      detail.className = 'privacy-detail';
      detail.textContent = item.detail || '';
      main.append(label, detail);
      row.append(main);

      const size = document.createElement('span');
      size.className = 'panel-value';
      size.textContent = formatSize(item.bytes);
      row.append(size);

      if (item.deletable) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'panel-mini privacy-delete';
        button.dataset.cmd = 'privacyDelete';
        button.dataset.id = item.id;
        button.textContent = 'Удалить';
        button.setAttribute('aria-label', `${tr('Удалить')}: ${tr(item.label)}`);
        row.append(button);
      }
      return row;
    }),
  );
}

function renderBackups(backups) {
  const date = backups.latest ? new Date(backups.latest) : null;
  el.backupLatest.textContent =
    date && !Number.isNaN(date.getTime())
      ? date.toLocaleDateString(state.language || 'ru', { day: '2-digit', month: '2-digit' })
      : '—';
  el.rowBackupRestore.disabled = !(Number(backups.count) > 0);
}

function renderRegion() {
  const region = state.region || { preset: 'off', proxy: '' };
  const regions = Array.isArray(state.regions) ? state.regions : [];
  const signature = `${regions.map((item) => `${item.id}:${item.label}`).join('|')}#${region.preset}`;

  if (signature !== regionSignature) {
    regionSignature = signature;
    el.regionSelect.replaceChildren(
      ...regions.map((item) => {
        const option = document.createElement('option');
        option.value = item.id;
        option.textContent = item.label;
        option.selected = item.id === region.preset;
        return option;
      }),
    );
    el.regionSelect.value = region.preset;
  }

  // Не перебиваем ввод, пока пользователь печатает адрес прокси.
  if (document.activeElement !== el.regionProxy && el.regionProxy.value !== region.proxy) {
    el.regionProxy.value = region.proxy;
  }

  const dpiOn = Boolean(state.dpi && state.dpi.enabled);
  setSwitch(el.rowDpiBypass, dpiOn);
  el.regionProxyState.textContent = dpiOn
    ? 'Обход DPI включён — прокси не используется.'
    : region.proxy
      ? 'Прокси включён — сайт видит IP прокси.'
      : 'Прокси не задан — сайт видит ваш IP.';

  const check = state.regionCheck || { state: 'idle', text: 'Проверить' };
  const checkLabel =
    check.state === 'loading'
      ? 'Проверяю…'
      : check.state === 'done'
        ? 'Готово'
        : check.state === 'error'
          ? 'Ошибка'
          : 'Проверить';
  el.regionIpValue.textContent = checkLabel;
  el.regionIpValue.classList.toggle('is-error', check.state === 'error');
  el.regionIpValue.classList.toggle('is-loading', check.state === 'loading');

  const hasResult = check.state === 'done' || check.state === 'error';
  el.regionIpResult.hidden = !hasResult;
  el.regionIpResult.textContent = hasResult ? check.text : '';
  el.regionIpResult.classList.toggle('is-error', check.state === 'error');

  const ping = state.proxyTest || { state: 'idle', text: 'Проверить' };
  const pingLabel =
    ping.state === 'loading'
      ? 'Проверяю…'
      : ping.state === 'done'
        ? `${ping.ms} мс`
        : ping.state === 'error'
          ? 'Ошибка'
          : 'Проверить';
  el.regionPingValue.textContent = pingLabel;
  el.regionPingValue.classList.toggle('is-error', ping.state === 'error');
  el.regionPingValue.classList.toggle('is-loading', ping.state === 'loading');
  const hasPingResult = ping.state === 'done' || ping.state === 'error';
  el.regionPingResult.hidden = !hasPingResult;
  el.regionPingResult.textContent = hasPingResult ? ping.text : '';
  el.regionPingResult.classList.toggle('is-error', ping.state === 'error');
}

function renderPopovers() {
  const active = state.popover === 'stickers' || state.popover === 'plugins' ? state.popover : null;
  const hidden = !active || state.pip || state.chromeHidden;

  el.popover.hidden = hidden;
  el.stickerPopover.hidden = active !== 'stickers';
  el.pluginsPopover.hidden = active !== 'plugins';

  el.btnStickers.classList.toggle('is-on', active === 'stickers');
  el.btnStickers.setAttribute('aria-pressed', String(active === 'stickers'));
  el.btnPluginsActive.classList.toggle('is-on', active === 'plugins');
  el.btnPluginsActive.setAttribute('aria-pressed', String(active === 'plugins'));
}

function renderPanel() {
  const open = Boolean(state.panel);
  el.panel.hidden = !open;
  el.btnPanel.classList.toggle('is-on', open);
  el.btnPanel.setAttribute('aria-pressed', String(open));

  // Закрытые настройки не хранят прошлый поиск и прокрутку: при следующем
  // открытии пользователь видит чистый первый раздел.
  if (!open) {
    clearPanelSearch();
    panelCategory = $('settingsNav')?.querySelector('.panel-cat')?.dataset.cat || 'page';
    if (settingsContent) settingsContent.scrollTop = 0;
    const nav = $('settingsNav');
    if (nav) nav.scrollTop = 0;
  }

  // Настройки закрыли во время захвата сочетания — отпускаем Esc обратно.
  if (!open && capturing) {
    capturing = null;
    api.cmd('keymapCapturing', false);
  }

  applyPanelFilter();

  if (open && !panelWasOpen && !el.panel.contains(document.activeElement)) {
    el.panelSearch.focus({ preventScroll: true });
  }
  panelWasOpen = open;

  el.panelVersion.textContent = `v${state.version || '—'} · Electron ${api.ui.electron}`;
  el.panelZoom.textContent = `${state.zoom || 100} %`;
  renderBackups(state.backups || {});
  renderPrivacy(state.privacy || {});
  renderResilience();

  setSwitch(el.rowMute, !state.muted);
  setSwitch(el.rowPip, state.pip);
  setSwitch(el.rowPipAuto, state.pipAuto);
  setSwitch(el.rowPipAdaptive, state.pipAdaptive);
  setSwitch(el.rowOnTop, state.onTop);
  setSwitch(el.rowTray, state.closeToTray);
  setSwitch(el.rowAutostart, state.autostart);
  setSwitch(el.rowStartTray, state.startInTray);
  setSwitch(el.rowAdSkip, state.adsSkip);
  setSwitch(el.rowChatDock, (state.chat || {}).dock !== false);
  setSwitch(el.rowLibraryAuto, (state.library || {}).auto === true);

  setSwitch(el.rowCustom, (state.customCode || {}).enabled === true);

  const focus = state.focus || {};
  setSwitch(el.rowFocus, focus.enabled === true);
  if (document.activeElement !== el.focusMinutes) {
    el.focusMinutes.value = String(Number(focus.minutes) || 25);
  }
  if (document.activeElement !== el.focusBreak) {
    el.focusBreak.value = String(Number(focus.breakMinutes) || 5);
  }

  const appimage = state.appimage || { available: false, installed: false };
  el.rowInstallApp.hidden = !appimage.available;
  el.installAppLabel.textContent = appimage.installed
    ? 'Удалить из меню приложений'
    : 'Установить в приложения';

  renderCosmetics(state.cosmetics);
  if (document.activeElement !== el.themeModeSelect && state.themeMode) {
    el.themeModeSelect.value = state.themeMode;
  }
  renderProfiles();
  renderPlugins(state.plugins);
  renderDownloads(state.downloads);
  renderSleep();
  renderPlayer();
  renderKeymap();
  renderPicture();
  renderQr();
  renderNotifications();
  renderReplies();
  renderLibrary();
  renderHistory();
  renderCreatorNotes();
  renderStats();
  renderFiltersSettings();
  renderRegion();
  renderLanguages();
  applyPanelFilter();
}

function render() {
  el.back.disabled = !state.canGoBack;
  el.forward.disabled = !state.canGoForward;

  el.pip.classList.toggle('is-on', Boolean(state.pip));
  el.pip.setAttribute('aria-pressed', String(Boolean(state.pip)));
  const chatOpen = Boolean(state.chat && state.chat.open);
  el.chat.classList.toggle('is-on', chatOpen);
  el.chat.setAttribute('aria-pressed', String(chatOpen));
  el.mute.classList.toggle('is-on', state.muted);
  el.mute.setAttribute('aria-pressed', String(state.muted));
  el.top.classList.toggle('is-on', state.onTop);
  el.top.setAttribute('aria-pressed', String(state.onTop));

  el.title.textContent = toastText || prettyTitle(state.title);

  el.pill.classList.toggle('is-loading', state.loading && !toastText);
  el.pill.classList.toggle('is-toast', Boolean(toastText));
  el.progress.classList.toggle('is-loading', state.loading);

  document.body.classList.toggle('is-muted', state.muted);
  document.body.classList.toggle('is-maximized', state.maximized);
  document.body.classList.toggle('is-ambient', Boolean(state.ambient));

  // Режим PiP: обычная полоса уступает место компактному мини-плееру.
  const pip = Boolean(state.pip);
  document.body.classList.toggle('is-pip', pip);
  el.titlebar.hidden = pip;
  el.pipbar.hidden = !pip;
  el.titlebar.classList.toggle('is-hidden', state.chromeHidden && !pip);
  el.pipTitle.textContent = toastText || prettyTitle(state.title);
  el.pipTitle.classList.toggle('is-toast', Boolean(toastText));
  el.pipPlay.classList.toggle('is-playing', Boolean(state.playing));
  el.pipPlay.title = state.playing ? 'Пауза' : 'Играть';
  el.pipPlay.setAttribute('aria-label', state.playing ? 'Пауза' : 'Играть');
  el.pipAuto.classList.toggle('is-on', Boolean(state.pipAuto));
  el.pipAuto.setAttribute('aria-pressed', String(Boolean(state.pipAuto)));
  el.pipAdaptive.classList.toggle('is-on', Boolean(state.pipAdaptive));
  el.pipAdaptive.setAttribute('aria-pressed', String(Boolean(state.pipAdaptive)));
  renderPipProgress();
  renderBar();
  renderChatHandle();

  el.max.title = state.maximized ? 'Восстановить' : 'Развернуть';
  el.max.setAttribute('aria-label', state.maximized ? 'Восстановить' : 'Развернуть');

  renderUnread();
  renderFind();
  renderDownload();
  renderPanel();
  renderPopovers();
  renderStickerPicker(state.stickers);
  renderActivePlugins(state.plugins);
  renderPalette();
}

function showToast(text) {
  toastText = text;
  render();
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastText = '';
    render();
  }, 1900);
}

function apply(next) {
  const { toast, ...rest } = next;
  Object.assign(state, rest);
  if (toast) {
    showToast(toast.text);
    return;
  }
  render();
}

// Свой CSS/JS в pushState не ездит: забираем один раз при запуске.
const storedCustomCode = api.customCode ? api.customCode() : null;
if (storedCustomCode) {
  el.customCss.value = storedCustomCode.css || '';
  el.customJs.value = storedCustomCode.js || '';
}

api.onState(apply);
api.onI18n?.(() => applyPanelFilter());
api.ready();
render();
syncChromeHeight();

// Обратный отсчёт таймера сна: раз в секунду обновляем подпись, без IPC.
setInterval(() => {
  if (Number(state.sleepTimerEnds) > 0) renderSleep();
}, 1000);
