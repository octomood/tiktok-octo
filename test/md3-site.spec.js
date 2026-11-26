'use strict';

const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { test, expect, _electron: electron } = require('@playwright/test');

/**
 * Material Design 3 для всего сайта TikTok:
 * проверяем на локальной странице с разметкой основных разделов сайта
 * (навигация, шапка, поиск, вкладки, кнопки, карточки, комментарии, чат,
 * модалка, подфрейм и динамический shadow root), устойчивость при SPA-переходе,
 * переключение светлой/тёмной палитры и мгновенный возврат к обычному виду
 * через настройки.
 */

const MOCK_SITE = `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <title>TikTok MD3 Test</title>
    <style>
      :root {
        --tux-colorBGPrimary: #ffffff;
        --tux-colorPrimary: #fe2c55;
      }
      body {
        margin: 0;
        background: #ffffff;
        color: #161823;
        font-family: system-ui, sans-serif;
      }
      .DivHeaderContainer {
        display: flex;
        align-items: center;
        gap: 12px;
        height: 60px;
        padding: 0 16px;
        background: #ffffff;
      }
      .DivSideNavContainer {
        width: 220px;
        padding: 12px;
        background: #ffffff;
      }
      .DivSideNavScroll {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .DivNavItem {
        display: block;
        padding: 10px 14px;
        background: transparent;
        color: #161823;
        border-radius: 4px;
      }
      .DivNavItem--Interactive {
        background: #252525;
      }
      .ObfuscatedFollowBtn {
        background: #fe2c55;
        color: #ffffff;
        border: 0;
        padding: 6px 14px;
      }
      .ObfuscatedSwitch {
        width: 40px;
        height: 22px;
        background: #25f4ee;
      }
      .ObfuscatedSwitchOff {
        width: 40px;
        height: 22px;
        background: rgb(28, 128, 134);
      }
      .SearchForm {
        display: flex;
        align-items: center;
        padding: 6px 12px;
        background: #f1f1f2;
        border-radius: 4px;
      }
      .SearchForm input {
        border: 0;
        background: transparent;
      }
      .TUXButton--primary {
        padding: 8px 18px;
        background: #fe2c55;
        color: #ffffff;
        border: 0;
        border-radius: 4px;
      }
      .TUXButton--secondary {
        padding: 8px 18px;
        background: #f1f1f2;
        color: #161823;
        border: 0;
        border-radius: 4px;
      }
      .PlayOverlay {
        position: relative;
        width: 120px;
        height: 120px;
        background: transparent;
        border: 0;
      }
      .DivTabItem {
        padding: 8px 16px;
        background: transparent;
        color: #555;
        border: 0;
        border-radius: 0;
      }
      .DivModalContainer {
        padding: 20px;
        background: #ffffff;
        border-radius: 8px;
      }
      .DivConversationItem {
        padding: 10px;
        border-radius: 4px;
      }
    </style>
  </head>
  <body>
    <header class="DivHeaderContainer" id="siteHeader">
      <form class="SearchForm" action="/search" id="searchBox" data-e2e="search-box">
        <input id="searchInput" value="octo" />
        <button type="submit" data-e2e="search-button">Поиск</button>
      </form>
      <div role="tooltip" id="siteTooltip"><span id="siteTooltipText" style="color: var(--tux-colorTextPrimary)">Подсказка</span></div>
      <button type="button" class="TUXButton--primary" id="btnLogin" data-e2e="top-login-button">
        Войти
      </button>
      <button type="button" class="TUXButton--secondary" id="btnEdit" data-e2e="edit-profile-button">
        Профиль
      </button>
    </header>

    <aside class="DivSideNavContainer" id="sideNav">
      <div class="DivSideNavScroll" id="sideNavScroll" style="background: #000000">
        <div role="button" class="DivNavItemWrapper" id="nestedNavWrapper">
          <a href="/foryou" class="DivNavItem IsActive" data-e2e="nav-foryou" aria-current="page" id="navForYou">
            <svg width="20" height="20" viewBox="0 0 20 20"><path id="homeIconPath" fill="#FE2C55" d="M2 10h16" /></svg>
            <span>Рекомендации</span>
          </a>
        </div>
        <div class="TUXTooltip-reference" id="tooltipWrapper">
          <a href="/following" class="DivNavItem DivNavItem--Interactive" data-e2e="nav-following" id="navFollowing">
            <span>Подписки</span>
            <sup data-e2e="inbox-badge" id="navBadge"><span id="navBadgeText" style="color: #ffffff;">16</span></sup>
          </a>
        </div>
        <div class="NavRowOuter" id="spanNavRow">
          <span class="TUXTooltip-reference" id="spanTooltipRef">
            <a href="/friends" class="DivNavItem" data-e2e="nav-friends" id="navFriends">
              <span>Друзья</span>
            </a>
          </span>
        </div>
        <div class="NavRowOuter" id="nestedControlNavRow" style="height: 44px; padding-bottom: 4px;">
          <span class="TUXTooltip-reference" id="nestedControlTooltipRef">
            <a href="/live" class="DivNavItem" data-e2e="nav-live" id="navLive">
              <div role="button">Трансляция</div>
            </a>
          </span>
        </div>
        <button type="submit" class="TUXButton--primary" id="showMoreBtn">Показать все</button>
        <div class="DivLoginContainer" id="sideLoginWrap">
          <button type="button" data-e2e="nav-login-button" id="sideLoginBtn">Войти</button>
        </div>
        <div class="DivMoreContainer" id="moreDrawer" style="position: fixed; left: 72px; top: 12px; width: 320px; height: 420px; background: rgba(0, 0, 0, 0.85);">
          <div class="MoreDrawerItem" id="moreDrawerItem"><a href="/settings">Настройки</a></div>
          <button type="button" class="TUXCard" id="moreDrawerBtn" style="border: 1px solid #444; box-shadow: 0 2px 6px #000;">Русский</button>
        </div>
      </div>
    </aside>

    <main id="main-content-homepage_hot">
      <div id="profileTabBar" style="background: #000000; width: 640px; height: 48px;">
        <div role="tablist" id="profileTabs">
          <button type="button" role="tab" class="DivTabItem IsActive" aria-selected="true" id="tabVideos">
            Видео
          </button>
          <button type="button" role="tab" class="DivTabItem" aria-selected="false" id="tabLiked">
            Понравившиеся
          </button>
        </div>
      </div>

      <button type="button" class="ObfuscatedFollowBtn" id="obfFollow">Подписаться</button>
      <div role="switch" aria-checked="false" class="ObfuscatedSwitch" id="obfSwitch"></div>
      <div role="switch" aria-checked="false" class="ObfuscatedSwitchOff" id="obfSwitchOff"></div>
      <div class="TUXTooltip-reference" id="likeTooltipWrapper">
        <button type="button" class="ButtonActionItem" id="likeActionBtn">
          <span data-e2e="like-icon" id="likeIconCircle"><svg width="20" height="20"></svg></span>
          <strong data-e2e="like-count" id="likeCount">21.9K</strong>
        </button>
      </div>
      <button type="button" class="PlayerActionCustom" id="commentActionBtn">
        <div id="commentIconWrap" style="width: 40px; height: 40px">
          <svg data-e2e="comment-icon" width="20" height="20"></svg>
        </div>
        <strong data-e2e="comment-count">318</strong>
      </button>
      <button type="button" class="ButtonActionItem" id="directSvgActionBtn">
        <svg id="directActionSvg" data-e2e="share-icon" width="24" height="24"></svg>
        <strong data-e2e="share-count">12</strong>
      </button>
      <div class="DivPlayerControls">
        <div id="playerAutoScrollPill" style="width: 36px; height: 20px; background: rgb(25, 85, 88);"></div>
      </div>
      <button type="button" class="PlayOverlay" id="playOverlay">play</button>
      <button type="button" data-e2e="feed-navigation-next" id="feedNext">↓</button>
      <div class="DivVideoCard" id="videoCard">Карточка</div>
      <div class="DivRecommendList" id="feedSlide" style="position: relative; width: 560px; height: 420px; display: flex;">
        <div class="DivBasicPlayerWrapper" id="feedPlayerWrap" style="width: 380px; height: 360px; background: rgb(18, 18, 18);">
          <video id="feedVideo" style="width: 300px; height: 300px;"></video>
        </div>
        <div class="ActionBar" id="feedActions" style="width: 60px;">
          <button type="button" data-e2e="like-icon">L</button>
          <button type="button" data-e2e="comment-icon">C</button>
        </div>
      </div>
      <div class="DivItemContainerV2" id="theaterSlide" style="position: relative; width: 920px; height: 420px;">
        <div class="DivBasicPlayerWrapper" id="theaterPlayerWrap" style="width: 100%; height: 100%; background: rgb(18, 18, 18);">
          <video id="theaterVideo" style="width: 100%; height: 100%;"></video>
        </div>
        <div class="OverlayAll" id="theaterOverlay" style="position: absolute; inset: 0;">
          <div class="DivAuthor" data-e2e="video-author-uniqueid" id="theaterAuthor" style="position: absolute; left: 16px; bottom: 56px;">kksush</div>
          <div class="DivBottomControls" id="theaterControls" style="position: absolute; left: 0; right: 0; bottom: 0;">00:04 / 00:25</div>
          <div class="ActionBar" id="theaterActions" style="position: absolute; right: 16px; bottom: 68px; width: 64px;">
            <button type="button" data-e2e="like-icon">L</button>
            <button type="button" data-e2e="comment-icon">C</button>
          </div>
        </div>
      </div>
      <button type="submit" data-e2e="comment-post" id="commentPostBtn">Опубликовать</button>
      <div class="DivConversationItem Active" id="chatRow">Диалог</div>
      <div role="dialog" class="DivModalContainer" id="siteModal">
        Диалог сайта
        <div id="codeFieldOuter" style="background: rgba(255, 255, 255, 0.12); border-radius: 9999px; height: 44px; padding: 0 12px;">
          <input id="codeFieldInput" placeholder="Код" />
        </div>
        <button type="button" id="resendBtn" style="color: rgb(156, 52, 76); background: transparent;">Отправить код заново</button>
        <button type="submit" id="nextDisabledBtn" disabled style="background: rgba(254, 44, 85, 0.34); color: rgba(255, 255, 255, 0.5);">Далее</button>
      </div>

      <iframe
        id="studioFrame"
        srcdoc="<!doctype html><html><body style='background:#fff'><button class='TUXButton--primary' id='frameBtn'>Опубликовать</button></body></html>"
      ></iframe>

      <div id="shadowHost"></div>
    </main>
  </body>
</html>`;

async function waitForWindow(app, predicate, label) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const found = app.windows().find(predicate);
    if (found) return found;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`окно не появилось: ${label}`);
}

test('MD3 дизайн для всего сайта: все элементы, SPA, светлая/тёмная тема и возврат в настройках', async () => {
  test.setTimeout(90_000);
  const server = http.createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(MOCK_SITE);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}/`;

  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-md3-'));
  let app;

  try {
    app = await electron.launch({
      args: [path.join(__dirname, '..'), '--no-sandbox'],
      env: {
        ...process.env,
        OCTO_E2E: '1',
        OCTO_USER_DATA: userData,
        OCTO_HOME_URL: url,
      },
    });

    await app.firstWindow();
    const page = await waitForWindow(
      app,
      (candidate) => candidate.url().startsWith('file://'),
      'полоса заголовка',
    );
    const site = await waitForWindow(
      app,
      (candidate) => candidate.url().startsWith(url),
      'страница сайта',
    );

    // 1. MD3 включён по умолчанию и красит весь сайт в тёмную MD3-палитру.
    await expect
      .poll(() => site.evaluate(() => document.documentElement.getAttribute('data-octo-md3')))
      .toBe('dark');

    await expect
      .poll(() =>
        site.evaluate(() => ({
          bodyBg: getComputedStyle(document.body).backgroundColor,
          tuxPrimary: getComputedStyle(document.documentElement)
            .getPropertyValue('--tux-colorPrimary')
            .trim(),
          navBg: getComputedStyle(document.getElementById('nestedNavWrapper')).backgroundColor,
          navPaddingTop: getComputedStyle(document.getElementById('nestedNavWrapper')).paddingTop,
          navPaddingBottom: getComputedStyle(document.getElementById('nestedNavWrapper'))
            .paddingBottom,
          navBadgeTextColor: getComputedStyle(document.getElementById('navBadgeText')).color,
          nestedNavInnerBg: getComputedStyle(document.getElementById('navForYou')).backgroundColor,
          navFollowingBg: getComputedStyle(document.getElementById('navFollowing')).backgroundColor,
          tooltipWrapperBg: getComputedStyle(document.getElementById('tooltipWrapper'))
            .backgroundColor,
          likeWrapperBg: getComputedStyle(document.getElementById('likeTooltipWrapper'))
            .backgroundColor,
          likeBtnBg: getComputedStyle(document.getElementById('likeActionBtn')).backgroundColor,
          likeCircleBg: getComputedStyle(document.getElementById('likeIconCircle')).backgroundColor,
          likeCountColor: getComputedStyle(document.getElementById('likeCount')).color,
          sideNavScrollBg: getComputedStyle(document.getElementById('sideNavScroll'))
            .backgroundColor,
          showMoreBg: getComputedStyle(document.getElementById('showMoreBtn')).backgroundColor,
          sideLoginBg: getComputedStyle(document.getElementById('sideLoginBtn')).backgroundColor,
          sideLoginRadius: getComputedStyle(document.getElementById('sideLoginBtn'))
            .borderTopLeftRadius,
          navGapBottom: getComputedStyle(document.getElementById('tooltipWrapper')).marginBottom,
          spanNavGap: Math.round(
            document.getElementById('navFriends').getBoundingClientRect().top -
              document.getElementById('navFollowing').getBoundingClientRect().bottom,
          ),
          nestedControlNavGap: Math.round(
            document.getElementById('navLive').getBoundingClientRect().top -
              document.getElementById('navFriends').getBoundingClientRect().bottom,
          ),
          homeIconFill: getComputedStyle(document.getElementById('homeIconPath')).fill,
          navTopRadius: getComputedStyle(document.getElementById('nestedNavWrapper'))
            .borderTopLeftRadius,
          navBottomRadius: getComputedStyle(document.getElementById('nestedNavWrapper'))
            .borderBottomLeftRadius,
          navFollowingTopRadius: getComputedStyle(document.getElementById('navFollowing'))
            .borderTopLeftRadius,
          obfFollowBg: getComputedStyle(document.getElementById('obfFollow')).backgroundColor,
          obfSwitchBg: getComputedStyle(document.getElementById('obfSwitch')).backgroundColor,
          obfSwitchOffBg: getComputedStyle(document.getElementById('obfSwitchOff')).backgroundColor,
          commentCircleBg: getComputedStyle(document.getElementById('commentIconWrap'))
            .backgroundColor,
          directSvgCircleBg: getComputedStyle(document.getElementById('directActionSvg'))
            .backgroundColor,
          playerAutoScrollBg: getComputedStyle(document.getElementById('playerAutoScrollPill'))
            .backgroundColor,
          moreDrawerBg: getComputedStyle(document.getElementById('moreDrawer')).backgroundColor,
          moreDrawerRadius: getComputedStyle(document.getElementById('moreDrawer'))
            .borderTopLeftRadius,
          moreDrawerItemBg: getComputedStyle(document.getElementById('moreDrawerItem'))
            .backgroundColor,
          moreDrawerItemShadow: getComputedStyle(document.getElementById('moreDrawerItem'))
            .boxShadow,
          moreDrawerBtnBg: getComputedStyle(document.getElementById('moreDrawerBtn'))
            .backgroundColor,
          moreDrawerBtnShadow: getComputedStyle(document.getElementById('moreDrawerBtn')).boxShadow,
          searchRadius: getComputedStyle(document.getElementById('searchBox')).borderTopLeftRadius,
          loginBg: getComputedStyle(document.getElementById('btnLogin')).backgroundColor,
          loginRadius: getComputedStyle(document.getElementById('btnLogin')).borderTopLeftRadius,
          loginInnerRadius: getComputedStyle(document.getElementById('btnLogin'))
            .borderTopRightRadius,
          editBg: getComputedStyle(document.getElementById('btnEdit')).backgroundColor,
          editInnerRadius: getComputedStyle(document.getElementById('btnEdit')).borderTopLeftRadius,
          tabColor: getComputedStyle(document.getElementById('tabVideos')).color,
          tabRadius: getComputedStyle(document.getElementById('tabVideos')).borderTopLeftRadius,
          tabBarBg: getComputedStyle(document.getElementById('profileTabBar')).backgroundColor,
          tabBarRadius: getComputedStyle(document.getElementById('profileTabBar'))
            .borderTopLeftRadius,
          searchInputBg: getComputedStyle(document.getElementById('searchInput')).backgroundColor,
          commentPostBg: getComputedStyle(document.getElementById('commentPostBtn'))
            .backgroundColor,
          commentPostColor: getComputedStyle(document.getElementById('commentPostBtn')).color,
          modalBg: getComputedStyle(document.getElementById('siteModal')).backgroundColor,
          modalRadius: getComputedStyle(document.getElementById('siteModal')).borderTopLeftRadius,
          codeOuterRadius: getComputedStyle(document.getElementById('codeFieldOuter'))
            .borderTopLeftRadius,
          codeInnerBg: getComputedStyle(document.getElementById('codeFieldInput')).backgroundColor,
          codeInnerRadius: getComputedStyle(document.getElementById('codeFieldInput'))
            .borderTopLeftRadius,
          resendColor: getComputedStyle(document.getElementById('resendBtn')).color,
          nextDisabledBg: getComputedStyle(document.getElementById('nextDisabledBtn'))
            .backgroundColor,
          playOverlayBg: getComputedStyle(document.getElementById('playOverlay')).backgroundColor,
          feedNextRadius: getComputedStyle(document.getElementById('feedNext')).borderTopLeftRadius,
          cardRadius: getComputedStyle(document.getElementById('videoCard')).borderTopLeftRadius,
        })),
      )
      .toEqual({
        bodyBg: 'rgb(25, 22, 36)', // #191624
        tuxPrimary: '#8c84a9',
        navBg: 'rgb(86, 78, 112)', // #564e70
        navPaddingTop: '5px',
        navPaddingBottom: '5px',
        navBadgeTextColor: 'rgb(23, 20, 34)', // #171422 — тёмный текст на кнопке/бейдже #8c84a9
        nestedNavInnerBg: 'rgba(0, 0, 0, 0)', // вложенная ссылка не рисует второй овал внутри внешнего
        navFollowingBg: 'rgb(43, 38, 61)', // #2b263d — соединённый неактивный пункт в сайдбаре
        tooltipWrapperBg: 'rgba(0, 0, 0, 0)', // TUXTooltip-reference не красится как тултип
        likeWrapperBg: 'rgba(0, 0, 0, 0)',
        likeBtnBg: 'rgba(0, 0, 0, 0)',
        likeCircleBg: 'rgba(0, 0, 0, 0)', // без лишнего круга вокруг иконки
        likeCountColor: 'rgb(255, 255, 255)', // чёткий белый счётчик под иконкой
        sideNavScrollBg: 'rgba(0, 0, 0, 0)', // внутренняя обёртка не остаётся чёрной
        showMoreBg: 'rgb(43, 38, 61)', // «Показать все» не заливается primary-цветом, использует тональный контейнер MD3 Expressive
        sideLoginBg: 'rgb(140, 132, 169)',
        sideLoginRadius: '24px',
        navGapBottom: '3px',
        spanNavGap: 3,
        nestedControlNavGap: 3,
        homeIconFill: 'rgb(221, 210, 224)', // #ddd2e0 — красный домик перекрашен в тон MD3 Expressive
        navTopRadius: '24px',
        navBottomRadius: '24px',
        navFollowingTopRadius: '6px',
        obfFollowBg: 'rgb(140, 132, 169)', // #8c84a9 — перекрашенный розовый TikTok
        obfSwitchBg: 'rgb(140, 132, 169)', // #8c84a9 — перекрашенный бирюзовый свитч
        obfSwitchOffBg: 'rgb(76, 69, 102)', // #4c4566 — приглушённый свитч выключен
        commentCircleBg: 'rgba(0, 0, 0, 0)',
        directSvgCircleBg: 'rgba(0, 0, 0, 0)',
        playerAutoScrollBg: 'rgb(76, 69, 102)', // #4c4566 — приглушённый свитч в плеере
        moreDrawerBg: 'rgb(43, 38, 61)', // #2b263d — панель «Ещё» непрозрачная в стиле MD3 Expressive
        moreDrawerRadius: '16px',
        moreDrawerItemBg: 'rgba(0, 0, 0, 0)', // внутренние элементы панели без рамок и фона
        moreDrawerItemShadow: 'none',
        moreDrawerBtnBg: 'rgba(0, 0, 0, 0)',
        moreDrawerBtnShadow: 'none',
        searchRadius: '14px',
        loginBg: 'rgb(140, 132, 169)', // #8c84a9
        loginRadius: '14px',
        loginInnerRadius: '5px', // соединённый край пары кнопок в шапке
        editBg: 'rgb(86, 78, 112)', // #564e70
        editInnerRadius: '5px',
        tabColor: 'rgb(197, 189, 219)', // #c5bddb
        tabRadius: '12px',
        tabBarBg: expect.not.stringMatching(/^rgb\(0,\s*0,\s*0\)$/),
        tabBarRadius: '18px',
        searchInputBg: 'rgba(0, 0, 0, 0)',
        commentPostBg: 'rgba(0, 0, 0, 0)',
        commentPostColor: 'rgb(197, 189, 219)',
        modalBg: 'rgb(62, 56, 84)', // #3e3854
        modalRadius: '20px',
        codeOuterRadius: '14px',
        codeInnerBg: 'rgba(0, 0, 0, 0)',
        codeInnerRadius: '0px',
        resendColor: 'rgb(140, 132, 169)',
        nextDisabledBg: expect.not.stringMatching(/254|156|140/),
        playOverlayBg: 'rgba(0, 0, 0, 0)',
        feedNextRadius: '14px',
        cardRadius: '14px',
      });

    await expect
      .poll(() =>
        site.evaluate(() => ({
          rail: document.getElementById('sideNav').getAttribute('data-octo-md3-rail'),
          drawerBtnW: document.getElementById('moreDrawerBtn').getBoundingClientRect().width,
        })),
      )
      .toEqual({ rail: null, drawerBtnW: expect.any(Number) });

    // 2.5. Свёрнутый узкий рельс сайдбара не сжимает кнопки внутри шторки «Ещё» до 44px.
    await site.evaluate(() => {
      document.getElementById('sideNav').style.width = '72px';
    });
    await expect
      .poll(() =>
        site.evaluate(() => ({
          rail: document.getElementById('sideNav').getAttribute('data-octo-md3-rail'),
          navItemW: Math.round(
            document.getElementById('nestedNavWrapper').getBoundingClientRect().width,
          ),
          drawerBtnW: Math.round(
            document.getElementById('moreDrawerBtn').getBoundingClientRect().width,
          ),
          collapsedSpanGap: Math.round(
            document.getElementById('navFriends').getBoundingClientRect().top -
              document.getElementById('navFollowing').getBoundingClientRect().bottom,
          ),
          collapsedNestedGap: Math.round(
            document.getElementById('navLive').getBoundingClientRect().top -
              document.getElementById('navFriends').getBoundingClientRect().bottom,
          ),
        })),
      )
      .toEqual({
        rail: 'collapsed',
        navItemW: 44,
        drawerBtnW: expect.any(Number),
        collapsedSpanGap: 3,
        collapsedNestedGap: 3,
      });
    const drawerBtnWidth = await site.evaluate(
      () => document.getElementById('moreDrawerBtn').getBoundingClientRect().width,
    );
    expect(drawerBtnWidth).toBeGreaterThan(48);
    await site.evaluate(() => {
      document.getElementById('sideNav').style.width = '';

      // 2.6. Шторка «Уведомления» внутри сайдбара: фильтры с переносом не обрезаются
      // и оформляются отдельными MD3-чипами.
      const notif = document.createElement('div');
      notif.id = 'notifDrawer';
      notif.style.cssText =
        'position:fixed;left:72px;top:12px;width:280px;height:420px;padding:16px;background:#161823;';
      notif.innerHTML = `
        <h2 style="margin:0 0 12px;">Уведомления</h2>
        <div id="notifChips" style="display:flex;flex-wrap:wrap;gap:6px;">
          <button type="button" id="notifChipAll" aria-pressed="true" style="padding:6px 12px;background:#fff;color:#161823;">Вся активность</button>
          <button type="button" id="notifChipLikes" style="padding:6px 12px;background:#2f2f2f;color:#fff;">Лайки</button>
          <button type="button" id="notifChipComments" style="padding:6px 12px;background:#2f2f2f;color:#fff;">Комментарии</button>
          <button type="button" id="notifChipMentions" style="padding:6px 12px;background:#2f2f2f;color:#fff;">Упоминания и отметки</button>
          <button type="button" id="notifChipFollowers" style="padding:6px 12px;background:#2f2f2f;color:#fff;">Подписчики</button>
        </div>
      `;
      document.getElementById('sideNavScroll').appendChild(notif);
    });
    await expect
      .poll(() =>
        site.evaluate(() => {
          const bar = document.getElementById('notifChips');
          const all = document.getElementById('notifChipAll');
          const followers = document.getElementById('notifChipFollowers');
          return {
            drawerSurface: document
              .getElementById('notifDrawer')
              ?.getAttribute('data-octo-md3-surface'),
            barSurface: bar?.getAttribute('data-octo-md3-surface'),
            barOverflow: bar ? getComputedStyle(bar).overflow : '',
            barRadius: bar ? getComputedStyle(bar).borderTopLeftRadius : '',
            allSurface: all?.getAttribute('data-octo-md3-surface'),
            allBg: all ? getComputedStyle(all).backgroundColor : '',
            allRadius: all ? getComputedStyle(all).borderTopLeftRadius : '',
            followersSurface: followers?.getAttribute('data-octo-md3-surface'),
            followersBg: followers ? getComputedStyle(followers).backgroundColor : '',
            followersRadius: followers ? getComputedStyle(followers).borderTopLeftRadius : '',
          };
        }),
      )
      .toEqual({
        drawerSurface: 'drawer',
        barSurface: 'chip-bar',
        barOverflow: 'visible',
        barRadius: '0px',
        allSurface: 'chip-active',
        allBg: 'rgb(86, 78, 112)', // #564e70 — active secondary-container
        allRadius: '9999px',
        followersSurface: 'chip',
        followersBg: 'rgb(62, 56, 84)', // #3e3854 — surface-container-high (видимая пилюля)
        followersRadius: '9999px',
      });
    await site.evaluate(() => document.getElementById('notifDrawer')?.remove());

    // 2. Подфрейм и динамический Shadow DOM тоже получают MD3-стили.
    await expect
      .poll(() =>
        site.evaluate(() => {
          const doc = document.getElementById('studioFrame')?.contentDocument;
          const btn = doc?.getElementById('frameBtn');
          return btn ? getComputedStyle(btn).backgroundColor : '';
        }),
      )
      .toBe('rgb(140, 132, 169)');

    await site.evaluate(() => {
      const host = document.getElementById('shadowHost');
      const root = host.attachShadow({ mode: 'open' });
      const style = document.createElement('style');
      style.textContent = '.TUXButton--primary { background: #fe2c55; }';
      const btn = document.createElement('button');
      btn.id = 'shadowBtn';
      btn.className = 'TUXButton--primary';
      btn.textContent = 'Shadow MD3';
      root.append(style, btn);
    });

    await expect
      .poll(() =>
        site.evaluate(() => {
          const root = document.getElementById('shadowHost')?.shadowRoot;
          const btn = root?.getElementById('shadowBtn');
          return btn ? getComputedStyle(btn).backgroundColor : '';
        }),
      )
      .toBe('rgb(140, 132, 169)');

    // 3. SPA-переход (pushState), динамическое переключение свитча и попытка сайта стереть атрибут.
    await site.evaluate(() => {
      window.history.pushState({}, '', '/explore');
      document.documentElement.removeAttribute('data-octo-md3');
      document.getElementById('obfSwitchOff').setAttribute('aria-checked', 'true');
    });
    await expect
      .poll(() => site.evaluate(() => document.documentElement.getAttribute('data-octo-md3')))
      .toBe('dark');
    await expect
      .poll(() =>
        site.evaluate(
          () => getComputedStyle(document.getElementById('obfSwitchOff')).backgroundColor,
        ),
      )
      .toBe('rgb(140, 132, 169)');
    await expect
      .poll(() => site.evaluate(() => getComputedStyle(document.body).backgroundColor))
      .toBe('rgb(25, 22, 36)');

    // 4. Выключение в настройках («Косметика») сразу возвращает обычный вид TikTok.
    await page.click('#btnPanel');
    await page.locator('[data-cat-head="cosmetics"]').click();
    const md3Switch = page.locator('#panelCosmetics [data-cosmetic="md3-design"]');
    await expect(md3Switch).toHaveAttribute('aria-checked', 'true');
    await md3Switch.click();
    await expect(md3Switch).toHaveAttribute('aria-checked', 'false');

    await expect
      .poll(() => site.evaluate(() => document.documentElement.hasAttribute('data-octo-md3')))
      .toBe(false);
    await expect
      .poll(() =>
        site.evaluate(() => ({
          loginBg: getComputedStyle(document.getElementById('btnLogin')).backgroundColor,
          loginRadius: getComputedStyle(document.getElementById('btnLogin')).borderTopLeftRadius,
          tuxPrimary: getComputedStyle(document.documentElement)
            .getPropertyValue('--tux-colorPrimary')
            .trim(),
          shadowBtnBg: getComputedStyle(
            document.getElementById('shadowHost').shadowRoot.getElementById('shadowBtn'),
          ).backgroundColor,
        })),
      )
      .toEqual({
        loginBg: 'rgb(254, 44, 85)', // #fe2c55 — исходный TikTok
        loginRadius: '4px',
        tuxPrimary: '#fe2c55',
        shadowBtnBg: 'rgb(254, 44, 85)', // #fe2c55 — исходная кнопка в shadow root
      });

    // 5. Повторное включение возвращает MD3, а светлая тема переводит на светлую палитру MD3.
    await md3Switch.click();
    await expect(md3Switch).toHaveAttribute('aria-checked', 'true');
    await expect
      .poll(() => site.evaluate(() => document.documentElement.getAttribute('data-octo-md3')))
      .toBe('dark');

    await page.selectOption('#themeModeSelect', 'light');
    await expect
      .poll(async () => {
        try {
          return await site.evaluate(() => document.documentElement.getAttribute('data-octo-md3'));
        } catch {
          return '';
        }
      })
      .toBe('light');
    await expect
      .poll(async () => {
        try {
          return await site.evaluate(() => ({
            bodyBg: getComputedStyle(document.body).backgroundColor,
            loginBg: getComputedStyle(document.getElementById('btnLogin')).backgroundColor,
            likeCountColor: getComputedStyle(document.getElementById('likeCount')).color,
            tooltipTextColor: getComputedStyle(document.getElementById('siteTooltipText')).color,
          }));
        } catch {
          return null;
        }
      })
      .toEqual({
        bodyBg: 'rgb(246, 241, 248)', // #f6f1f8
        loginBg: 'rgb(86, 77, 116)', // #564d74
        likeCountColor: 'rgb(40, 35, 56)', // #282338
        tooltipTextColor: 'rgb(221, 210, 224)', // #ddd2e0
      });

    // Смена палитры обновляет токены как в оболочке, так и на сайте без перезагрузки.
    await page.click('[data-theme-palette="teal-lagoon"]');
    await expect
      .poll(() =>
        site.evaluate(() =>
          getComputedStyle(document.documentElement).getPropertyValue('--octo-md-primary').trim(),
        ),
      )
      .not.toBe('#564d74');
    await page.click('[data-theme-palette="octo-lavender"]');
    await expect
      .poll(() =>
        site.evaluate(() =>
          getComputedStyle(document.documentElement).getPropertyValue('--octo-md-primary').trim(),
        ),
      )
      .toBe('#564d74');

    // 6. Видео не перекрыто фоном EXPRESSIVE_BG, оверлей автора/управления не ломается.
    await expect
      .poll(() =>
        site.evaluate(() => ({
          wrapBgImg: getComputedStyle(document.getElementById('feedPlayerWrap')).backgroundImage,
          theaterAuthorLeft: getComputedStyle(document.getElementById('theaterAuthor')).left,
        })),
      )
      .toEqual({
        wrapBgImg: 'none',
        theaterAuthorLeft: '16px',
      });

    // 7. Страница сообщений (/messages с iframe Business Suite): пустая левая
    // колонка и заглушка 💬 скрываются, iframe занимает всю ширину, а белые
    // шапки, активный диалог, кнопки и тёмный текст перекрашиваются в MD3.
    await page.selectOption('#themeModeSelect', 'dark');
    await expect
      .poll(async () => {
        try {
          return await site.evaluate(() => document.documentElement.getAttribute('data-octo-md3'));
        } catch {
          return '';
        }
      })
      .toBe('dark');
    await page.click('#btnPanel');

    // 6.5. Нижняя панель плеера, прогресс-бар, переключатель автопрокрутки, кнопка «•••»
    // и соединённые стрелки навигации не выцветают и не перекрывают видеокарточку.
    await site.evaluate(() => {
      const stage = document.getElementById('feedSlide');
      const card = document.getElementById('feedPlayerWrap');
      stage.style.width = '760px';
      card.style.position = 'relative';
      card.style.width = '480px';
      card.style.height = '420px';

      const barWrap = document.createElement('div');
      barWrap.id = 'feedBarWrap';
      barWrap.style.cssText = 'position:absolute;left:0;right:0;bottom:0;opacity:0.35;';

      const seekBar = document.createElement('div');
      seekBar.id = 'feedSeekBar';
      seekBar.setAttribute('role', 'slider');
      seekBar.style.cssText = 'position:relative;width:100%;height:6px;opacity:0.35;';
      const seekFill = document.createElement('div');
      seekFill.id = 'feedSeekFill';
      seekFill.style.cssText = 'width:25%;height:100%;background:rgba(255,255,255,0.2);';
      seekBar.appendChild(seekFill);

      const ctrlRow = document.createElement('div');
      ctrlRow.id = 'feedCtrlRow';
      ctrlRow.style.cssText =
        'display:flex;align-items:center;gap:10px;height:40px;padding:0 12px;opacity:0.35;';
      const timeSpan = document.createElement('span');
      timeSpan.id = 'feedTime';
      timeSpan.textContent = '00:03 / 00:14';
      timeSpan.style.color = 'rgba(255,255,255,0.34)';
      const autoLabel = document.createElement('div');
      autoLabel.className = 'AutoScrollBox';
      const autoPill = document.createElement('div');
      autoPill.id = 'feedAutoPill';
      autoPill.style.cssText = 'width:34px;height:18px;background:rgba(255,255,255,0.2);';
      const autoKnob = document.createElement('div');
      autoKnob.style.cssText = 'width:12px;height:12px;';
      autoPill.appendChild(autoKnob);
      autoLabel.appendChild(autoPill);
      const speedBtn = document.createElement('button');
      speedBtn.type = 'button';
      speedBtn.id = 'feedSpeedBtn';
      speedBtn.textContent = '1.0x';
      ctrlRow.append(timeSpan, autoLabel, speedBtn);
      barWrap.append(seekBar, ctrlRow);
      card.appendChild(barWrap);

      const moreBtn = document.createElement('button');
      moreBtn.type = 'button';
      moreBtn.id = 'feedMoreBtn';
      moreBtn.setAttribute('data-e2e', 'feed-more-button');
      moreBtn.style.cssText = 'width:40px;height:40px;opacity:0.35;background:rgba(0,0,0,0.4);';
      moreBtn.innerHTML =
        '<svg width="20" height="20"><circle cx="5" cy="10" r="1.5" fill="rgba(255,255,255,0.35)"></circle><circle cx="10" cy="10" r="1.5" fill="rgba(255,255,255,0.35)"></circle><circle cx="15" cy="10" r="1.5" fill="rgba(255,255,255,0.35)"></circle></svg>';
      document.getElementById('feedActions').appendChild(moreBtn);

      const navGroup = document.createElement('div');
      navGroup.id = 'feedNavGroup';
      navGroup.className = 'DivFeedNavigation';
      navGroup.style.cssText =
        'position:absolute;right:12px;top:16px;width:44px;display:flex;flex-direction:column;gap:8px;';
      const navUp = document.createElement('button');
      navUp.type = 'button';
      navUp.id = 'feedNavUp';
      navUp.setAttribute('data-e2e', 'feed-navigation-prev');
      navUp.style.cssText = 'width:44px;height:44px;';
      const navDown = document.createElement('button');
      navDown.type = 'button';
      navDown.id = 'feedNavDown';
      navDown.setAttribute('data-e2e', 'feed-navigation-next');
      navDown.style.cssText = 'width:44px;height:44px;';
      navGroup.append(navUp, navDown);
      stage.appendChild(navGroup);
    });

    await expect
      .poll(() =>
        site.evaluate(() => ({
          wrapOpacity: getComputedStyle(document.getElementById('feedBarWrap')).opacity,
          ctrlSurface: document.getElementById('feedCtrlRow').getAttribute('data-octo-md3-surface'),
          ctrlOpacity: getComputedStyle(document.getElementById('feedCtrlRow')).opacity,
          timeColor: getComputedStyle(document.getElementById('feedTime')).color,
          seekFillBg: getComputedStyle(document.getElementById('feedSeekFill')).backgroundColor,
          autoPillBg: getComputedStyle(document.getElementById('feedAutoPill')).backgroundColor,
          moreBg: getComputedStyle(document.getElementById('feedMoreBtn')).backgroundColor,
          moreRadius: getComputedStyle(document.getElementById('feedMoreBtn')).borderTopLeftRadius,
          moreOpacity: getComputedStyle(document.getElementById('feedMoreBtn')).opacity,
          navUpTopRadius: getComputedStyle(document.getElementById('feedNavUp'))
            .borderTopLeftRadius,
          navUpBottomRadius: getComputedStyle(document.getElementById('feedNavUp'))
            .borderBottomLeftRadius,
          navDownTopRadius: getComputedStyle(document.getElementById('feedNavDown'))
            .borderTopLeftRadius,
          navDownBottomRadius: getComputedStyle(document.getElementById('feedNavDown'))
            .borderBottomLeftRadius,
        })),
      )
      .toEqual({
        wrapOpacity: '1',
        ctrlSurface: 'player-controls',
        ctrlOpacity: '1',
        timeColor: 'rgb(221, 210, 224)', // #ddd2e0 — без тусклого серого текста
        seekFillBg: 'rgb(140, 132, 169)', // #8c84a9 — акцентный прогресс
        autoPillBg: 'rgb(76, 69, 102)', // #4c4566 — MD3 switch-off для серого тоггла
        moreBg: 'rgb(62, 56, 84)', // #3e3854 — тональная кнопка «•••»
        moreRadius: '24px',
        moreOpacity: '1',
        navUpTopRadius: '20px',
        navUpBottomRadius: '6px',
        navDownTopRadius: '6px',
        navDownBottomRadius: '20px',
      });

    await site.evaluate(() => {
      document.body.innerHTML = `
        <div class="DivBodyContainer" style="display:flex;width:100vw;height:100vh;">
          <div class="DivEmptyLeft" id="emptyLeftCol" style="width:320px;height:100%;"></div>
          <div class="DivChatMain" id="emptyChatPlaceholder" style="width:240px;height:100%;">
            <svg width="48" height="48" viewBox="0 0 24 24"></svg>
          </div>
          <iframe
            id="bsFrame"
            src="about:blank"
            style="width:600px;height:100%;border:0;"
          ></iframe>
        </div>
      `;
      const frame = document.getElementById('bsFrame');
      frame.setAttribute('src', 'about:blank#business-suite/messages');
      const doc = frame.contentDocument;
      doc.open();
      doc.write(`<!doctype html><html><body style="margin:0;background:#ffffff;">
        <div id="root">
          <div id="bsOuter" style="background:#f7f8fd;min-height:100vh;">
            <div id="bsTopBar" style="height:56px;background:#ffffff;display:flex;align-items:center;">
              <svg id="bsLogo" width="90" height="24"><path id="bsLogoPath" fill="#161823" d="M0 0h20v20H0z"/></svg>
            </div>
            <div id="bsSubBar" style="height:48px;background:#ffffff;display:flex;align-items:center;">
              <span id="bsTitle" style="color:#161823;">Сообщения</span>
              <span class="unread-count" id="bsHeaderBadge" style="background:#fe2c55;color:#fff;width:20px;height:20px;">9</span>
            </div>
            <div style="display:flex;">
              <div class="SessionList" id="bsList" style="width:280px;">
                <div class="SessionItem" id="bsActiveRow" style="background:#ffffff;padding:12px;">
                  <span id="bsActiveName" style="color:#161823;">unnamed user</span>
                </div>
                <div class="SessionItem" id="bsOtherRow" style="padding:12px;">
                  <span>qwartt</span>
                  <span class="unread-count" id="bsRowBadge" style="background:#fe2c55;color:#fff;width:18px;height:18px;">2</span>
                </div>
              </div>
              <div class="ChatDetail" id="bsThread" style="flex:1;padding:16px;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                  <span id="bsPeerName" style="color:#161823;">unnamed user</span>
                  <button type="button" id="bsContactBtn" style="background:#ffffff;color:#161823;padding:8px 14px;">Создать контактные данные</button>
                </div>
                <div id="bsComposerWrap" style="margin-top:24px;padding:8px;">
                  <div id="bsComposer" contenteditable="true" style="color:#161823;"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </body></html>`);
      doc.close();
      window.history.pushState({}, '', '/messages');
    });

    await expect
      .poll(() =>
        site.evaluate(() => ({
          emptyDisplay: getComputedStyle(document.getElementById('emptyLeftCol')).display,
          placeholderDisplay: getComputedStyle(document.getElementById('emptyChatPlaceholder'))
            .display,
          frameLeft: Math.round(document.getElementById('bsFrame').getBoundingClientRect().left),
          frameWidth: Math.round(document.getElementById('bsFrame').getBoundingClientRect().width),
          winWidth: window.innerWidth,
        })),
      )
      .toEqual({
        emptyDisplay: 'none',
        placeholderDisplay: 'none',
        frameLeft: 0,
        frameWidth: expect.any(Number),
        winWidth: expect.any(Number),
      });
    const layoutInfo = await site.evaluate(() => ({
      frameWidth: Math.round(document.getElementById('bsFrame').getBoundingClientRect().width),
      winWidth: window.innerWidth,
    }));
    expect(layoutInfo.frameWidth).toBeGreaterThanOrEqual(layoutInfo.winWidth - 2);

    await expect
      .poll(() =>
        site.evaluate(() => {
          const doc = document.getElementById('bsFrame')?.contentDocument;
          if (!doc) return null;
          return {
            topBarBg: getComputedStyle(doc.getElementById('bsTopBar')).backgroundColor,
            subBarBg: getComputedStyle(doc.getElementById('bsSubBar')).backgroundColor,
            outerBg: getComputedStyle(doc.getElementById('bsOuter')).backgroundColor,
            logoFill: getComputedStyle(doc.getElementById('bsLogoPath')).fill,
            activeRowBg: getComputedStyle(doc.getElementById('bsActiveRow')).backgroundColor,
            activeNameColor: getComputedStyle(doc.getElementById('bsActiveName')).color,
            peerNameColor: getComputedStyle(doc.getElementById('bsPeerName')).color,
            contactBtnBg: getComputedStyle(doc.getElementById('bsContactBtn')).backgroundColor,
            contactBtnColor: getComputedStyle(doc.getElementById('bsContactBtn')).color,
            composerBg: getComputedStyle(doc.getElementById('bsComposerWrap')).backgroundColor,
            composerColor: getComputedStyle(doc.getElementById('bsComposer')).color,
            rowBadgeBg: getComputedStyle(doc.getElementById('bsRowBadge')).backgroundColor,
          };
        }),
      )
      .toEqual({
        topBarBg: 'rgb(33, 29, 48)', // #211d30 — шапка Business Suite в MD3
        subBarBg: 'rgb(33, 29, 48)', // #211d30 — подшапка «Сообщения» в MD3
        outerBg: 'rgba(0, 0, 0, 0)', // белая подложка стала прозрачной над #191624
        logoFill: 'rgb(221, 210, 224)', // #ddd2e0 — тёмный логотип виден на тёмной шапке
        activeRowBg: 'rgb(86, 78, 112)', // #564e70 — выбранный диалог без белого фона
        activeNameColor: 'rgb(221, 210, 224)', // #ddd2e0 — читаемый текст на #564e70
        peerNameColor: 'rgb(221, 210, 224)', // #ddd2e0 — имя собеседника в шапке диалога
        contactBtnBg: 'rgb(86, 78, 112)', // #564e70 — тональная кнопка MD3 вместо белой
        contactBtnColor: 'rgb(221, 210, 224)', // #ddd2e0
        composerBg: 'rgb(62, 56, 84)', // #3e3854 — поле ввода сообщения
        composerColor: 'rgb(221, 210, 224)', // #ddd2e0 — читаемый ввод в поле
        rowBadgeBg: 'rgb(140, 132, 169)', // #8c84a9 — бейдж непрочитанных в MD3
      });

    // 8. Страница трансляций (/live и /@user/live, стек live_new + TUX v2):
    // левый сайдбар без DivSideNavContainer, сцена, плашка Recharge и правый чат
    // получают токены и поверхности выбранной MD3-палитры.
    await site.evaluate(() => {
      document.documentElement.setAttribute('data-tux-color-scheme', 'dark');
      const liveCss = document.createElement('style');
      liveCss.id = 'mockLiveCss';
      liveCss.textContent = `
        [data-tux-color-scheme="dark"] {
          --bg-base: #000000;
          --bg-primary: #121212;
          --bg-input: rgba(255, 255, 255, 0.12);
          --ui-shape-primary: #fe2c55;
          --tux-v2-color-live-revenue-recharge-shape-1: #392f25;
          --tux-v2-color-ui-shape-primary: #fe2c55;
        }
        .live-side-bg { background: var(--bg-base); }
        .live-chat-bg { background: rgb(15, 15, 15); }
        .live-recharge-box { background: var(--tux-v2-color-live-revenue-recharge-shape-1); }
        .live-heart-btn { background: var(--tux-v2-color-ui-shape-primary); }
      `;
      document.head.appendChild(liveCss);

      document.body.innerHTML = `
        <div id="liveApp" style="display:flex;width:100vw;height:100vh;">
          <aside id="liveSideNav" class="live-side-bg" style="width:220px;height:100%;padding:12px;display:flex;flex-direction:column;gap:4px;">
            <a href="/" data-e2e="tiktok-logo" style="height:42px;">Logo</a>
            <button type="button" id="liveSearchBtn" class="TUXButton--secondary" style="height:36px;">Поиск</button>
            <a href="/foryou" id="liveNavForYou" class="TUXButton--secondary" style="height:36px;">Рекомендации</a>
            <a href="/explore" id="liveNavExplore" class="TUXButton--secondary" style="height:36px;">Смотреть</a>
            <a href="/live" id="liveNavLive" class="TUXButton--secondary" style="height:36px;">Трансляция</a>
            <a href="/@me" id="liveNavProfile" data-e2e="nav-profile" class="TUXButton--secondary DivUserLink" style="height:36px;">
              <img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" width="24" height="24" alt="" />
              <span>Профиль</span>
            </a>
            <button type="button" id="liveCoinsBtn" class="TUXButton--primary" style="margin-top:24px;height:40px;">Приобрести Монеты</button>
            <a href="/@pilaman/live" id="liveCreatorRow" style="display:flex;align-items:center;gap:8px;height:44px;padding:6px;">
              <img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" width="28" height="28" alt="" />
              <span>pilaman</span>
            </a>
          </aside>
          <div class="live-room-container" id="liveRoom" style="flex:1;display:flex;height:100%;">
            <div data-e2e="live-room-content" id="liveStage" style="flex:1;position:relative;height:100%;background:#121212;">
              <div class="live-recharge-box" id="liveRechargeBar" style="position:absolute;left:16px;right:16px;bottom:16px;height:64px;display:flex;align-items:center;justify-content:space-between;padding:0 12px;">
                <span>Подарки отправляются ведущим</span>
                <button type="button" id="liveRechargeBtn">Recharge</button>
              </div>
            </div>
            <div id="liveChatCol" style="width:320px;height:100%;display:flex;flex-direction:column;">
              <div id="liveChatHeader" class="live-chat-bg" style="height:48px;padding:12px;">Зрители</div>
              <div id="liveChatBody" class="live-chat-bg" style="flex:1;padding:12px;">Загрузка...</div>
              <div id="liveChatFooter" class="live-chat-bg" style="height:60px;display:flex;align-items:center;gap:8px;padding:8px;">
                <div id="liveChatInputWrap" style="flex:1;background:var(--bg-input);padding:6px 10px;">
                  <input id="liveChatInput" placeholder="Загрузка..." style="width:100%;" />
                </div>
                <div id="liveHeartBtn" class="live-heart-btn" style="width:36px;height:36px;">♥</div>
              </div>
            </div>
          </div>
        </div>
      `;
      window.history.pushState({}, '', '/@pilaman/live');
    });

    await expect
      .poll(() =>
        site.evaluate(() => ({
          sideSurface: document
            .getElementById('liveSideNav')
            ?.getAttribute('data-octo-md3-surface'),
          sideBg: getComputedStyle(document.getElementById('liveSideNav')).backgroundColor,
          searchSurface: document
            .getElementById('liveSearchBtn')
            ?.getAttribute('data-octo-md3-surface'),
          searchBg: getComputedStyle(document.getElementById('liveSearchBtn')).backgroundColor,
          forYouBg: getComputedStyle(document.getElementById('liveNavForYou')).backgroundColor,
          liveActive: document.getElementById('liveNavLive')?.getAttribute('data-octo-md3-nav'),
          liveBg: getComputedStyle(document.getElementById('liveNavLive')).backgroundColor,
          profileActive: document
            .getElementById('liveNavProfile')
            ?.getAttribute('data-octo-md3-nav'),
          profileSurface: document
            .getElementById('liveNavProfile')
            ?.getAttribute('data-octo-md3-surface'),
          profilePos: document.getElementById('liveNavProfile')?.getAttribute('data-octo-md3-pos'),
          coinsSurface: document
            .getElementById('liveCoinsBtn')
            ?.getAttribute('data-octo-md3-surface'),
          coinsBg: getComputedStyle(document.getElementById('liveCoinsBtn')).backgroundColor,
          creatorSurface: document
            .getElementById('liveCreatorRow')
            ?.getAttribute('data-octo-md3-surface'),
          rechargeToken: getComputedStyle(document.documentElement)
            .getPropertyValue('--tux-v2-color-live-revenue-recharge-shape-1')
            .trim(),
          rechargeBg: getComputedStyle(document.getElementById('liveRechargeBar')).backgroundColor,
          chatSurface: document
            .getElementById('liveChatCol')
            ?.getAttribute('data-octo-md3-surface'),
          chatBg: getComputedStyle(document.getElementById('liveChatCol')).backgroundColor,
          chatPaneBg: getComputedStyle(document.getElementById('liveChatBody')).backgroundColor,
          chatInputSurface: document
            .getElementById('liveChatInputWrap')
            ?.getAttribute('data-octo-md3-surface'),
          chatInputBg: getComputedStyle(document.getElementById('liveChatInputWrap'))
            .backgroundColor,
          heartBg: getComputedStyle(document.getElementById('liveHeartBtn')).backgroundColor,
        })),
      )
      .toEqual({
        sideSurface: 'sidenav',
        sideBg: 'rgb(33, 29, 48)', // #211d30 — сайдбар трансляции в MD3 вместо #000
        searchSurface: 'sidenav-search',
        searchBg: 'rgb(62, 56, 84)', // #3e3854 — кнопка поиска в сайдбаре
        forYouBg: 'rgb(43, 38, 61)', // #2b263d — неактивный пункт меню
        liveActive: 'active',
        liveBg: 'rgb(86, 78, 112)', // #564e70 — активная капсула «Трансляция» на /@user/live
        profileActive: null,
        profileSurface: null,
        profilePos: 'last',
        coinsSurface: 'sidenav-footer',
        coinsBg: 'rgb(43, 38, 61)', // #2b263d — кнопка монет не заливается ярким primary
        creatorSurface: 'sidenav-creator',
        rechargeToken: '#3e3854',
        rechargeBg: 'rgb(43, 38, 61)', // #2b263d — донатная панель вместо #392f25
        chatSurface: 'live-chat',
        chatBg: 'rgb(33, 29, 48)', // #211d30 — правый чат трансляции в MD3
        chatPaneBg: 'rgba(0, 0, 0, 0)', // внутренние обёртки #0f0f0f не перекрывают фон MD3
        chatInputSurface: 'live-chat-input',
        chatInputBg: 'rgb(62, 56, 84)', // #3e3854 — поле ввода в чате трансляции
        heartBg: 'rgb(140, 132, 169)', // #8c84a9 — кнопка лайка в чате перекрашена в primary
      });
  } finally {
    if (app) await app.close();
    await new Promise((resolve) => server.close(resolve));
    fs.rmSync(userData, { recursive: true, force: true });
  }
});
