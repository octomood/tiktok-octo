'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test, expect, _electron: electron } = require('@playwright/test');

/** WebContentsView сайта появляется в списке окон Playwright не сразу. */
async function waitForView(app) {
  let view = app.windows().find((candidate) => candidate.url() === 'about:blank');
  for (let attempt = 0; attempt < 50 && !view; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 50));
    view = app.windows().find((candidate) => candidate.url() === 'about:blank');
  }
  return view;
}

/**
 * Громкость до 200 %, эквалайзер, моно и аудиовыход живут в страничном
 * скрипте плеера. Подменяем AudioContext своим, чтобы проверить цепочку без
 * звуковой карты и без сети.
 */
test('усиление, эквалайзер, моно и выбор выхода', async () => {
  const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'octo-e2e-audio-'));
  let app;

  try {
    app = await electron.launch({
      args: [path.join(__dirname, '..'), '--no-sandbox'],
      env: {
        ...process.env,
        OCTO_E2E: '1',
        OCTO_USER_DATA: userData,
        OCTO_HOME_URL: 'about:blank',
      },
    });

    await app.firstWindow();

    const view = await waitForView(app);
    expect(view, 'страница сайта не появилась').toBeTruthy();
    await expect.poll(() => view.evaluate(() => typeof window.__octoPlayer)).toBe('object');

    const result = await view.evaluate(() => {
      const contexts = [];

      const node = (kind, context) => ({
        kind,
        context,
        outputs: [],
        gain: { value: kind === 'gain' ? 1 : 0 },
        frequency: { value: 0 },
        Q: { value: 0 },
        type: '',
        connect(target) {
          this.outputs.push(target);
          return target;
        },
        disconnect() {
          this.outputs.length = 0;
        },
      });

      class FakeContext {
        constructor() {
          this.state = 'running';
          this.sinks = [];
          this.nodes = [];
          this.destination = node('destination', this);
          contexts.push(this);
        }

        createMediaElementSource(video) {
          const source = node('source', this);
          source.media = video;
          this.nodes.push(source);
          return source;
        }

        createBiquadFilter() {
          const filter = node('biquad', this);
          this.nodes.push(filter);
          return filter;
        }

        createGain() {
          const gain = node('gain', this);
          this.nodes.push(gain);
          return gain;
        }

        createChannelSplitter() {
          const splitter = node('splitter', this);
          this.nodes.push(splitter);
          return splitter;
        }

        createChannelMerger() {
          const merger = node('merger', this);
          this.nodes.push(merger);
          return merger;
        }

        setSinkId(id) {
          this.sinks.push(id);
          return Promise.resolve();
        }

        resume() {
          return Promise.resolve();
        }
      }

      window.AudioContext = FakeContext;

      const makeVideo = (source) => {
        const video = document.createElement('video');
        let volume = 1;
        const sinks = [];
        Object.defineProperty(video, 'currentSrc', { configurable: true, get: () => source });
        Object.defineProperty(video, 'volume', {
          configurable: true,
          get: () => volume,
          set: (value) => {
            volume = value;
          },
        });
        video.setSinkId = (id) => {
          sinks.push(id);
          return Promise.resolve();
        };
        video.getBoundingClientRect = () => ({ width: 320, height: 568, top: 0, left: 0 });
        document.body.append(video);
        return { video, sinks, read: () => volume };
      };

      const player = window.__octoPlayer;
      const gains = () =>
        contexts.flatMap((context) => context.nodes.filter((n) => n.kind === 'gain'));
      const filters = () =>
        contexts.flatMap((context) => context.nodes.filter((n) => n.kind === 'biquad'));

      // --- Громкость выше 100 %: видео на полной, остальное — усиление -------
      const same = makeVideo('blob:https://www.tiktok.com/feed');
      player.update({ volume: 1.5, equalizer: 'off', mono: false, sinkId: '' });
      const boosted = {
        native: same.read(),
        graphs: player.status().graphs,
        blocked: player.status().blocked,
      };
      // Усиливающий узел — тот, что подключён к destination.
      const boostGain = gains().find((node) =>
        node.outputs.some((out) => out.kind === 'destination'),
      );
      boosted.gainValue = boostGain ? boostGain.gain.value : null;

      // --- Возврат ниже 100 % остаётся на той же цепочке ---------------------
      player.update({ volume: 0.4 });
      const quietGain = gains().find((node) =>
        node.outputs.some((out) => out.kind === 'destination'),
      );
      const quiet = { native: same.read(), gain: quietGain ? quietGain.gain.value : null };

      // --- Эквалайзер «речь» ------------------------------------------------
      player.update({ equalizer: 'speech' });
      const speech = filters().map((filter) => ({ type: filter.type, gain: filter.gain.value }));

      // --- Моно: высокие частоты идут в сплиттер, оба канала в мержер --------
      player.update({ mono: true });
      const high = filters().find((filter) => filter.type === 'highshelf');
      const splitter = contexts[0].nodes.find((n) => n.kind === 'splitter');
      const merger = contexts[0].nodes.find((n) => n.kind === 'merger');
      const mono = {
        highToSplitter: Boolean(high && high.outputs.includes(splitter)),
        splitterToMerger:
          splitter && merger
            ? splitter.outputs.filter((out) => out.kind === 'gain').length === 2 &&
              merger.outputs.some((out) => out.kind === 'gain')
            : false,
      };

      // --- Аудиовыход на цепочке -------------------------------------------
      player.update({ sinkId: 'speaker-2' });
      const routed = contexts[0].sinks.slice();

      // --- Чужой домен: цепочку не строим, громкость обычная -----------------
      const foreign = makeVideo('https://cdn.example.test/video.mp4');
      player.update({ volume: 2, mono: false, equalizer: 'off', sinkId: 'speaker-2' });
      const blocked = {
        native: foreign.read(),
        graphs: player.status().graphs,
        flag: player.status().blocked,
        sinks: foreign.sinks.slice(),
      };

      for (const item of [same, foreign]) item.video.remove();
      return { boosted, quiet, speech, mono, routed, blocked };
    });

    // 150 % — видео играет на полной громкости, усиление в GainNode.
    expect(result.boosted.native).toBe(1);
    expect(result.boosted.gainValue).toBeCloseTo(1.5, 3);
    expect(result.boosted.graphs).toBe(1);
    expect(result.boosted.blocked).toBe(false);

    // 40 % — тот же узел, без возврата к громкости элемента.
    expect(result.quiet.native).toBe(1);
    expect(result.quiet.gain).toBeCloseTo(0.4, 3);

    const speech = result.speech.reduce((map, band) => {
      map[band.type] = band.gain;
      return map;
    }, {});
    expect(speech.lowshelf).toBeCloseTo(-5, 3);
    expect(speech.peaking).toBeCloseTo(4, 3);
    expect(speech.highshelf).toBeCloseTo(-2, 3);

    expect(result.mono.highToSplitter).toBe(true);
    expect(result.mono.splitterToMerger).toBe(true);

    // Сетка знает выбранное устройство, и оно же уходит в AudioContext.
    expect(result.routed).toContain('speaker-2');

    // Ролик с чужого домена: без Web Audio, обычная громкость и setSinkId видео.
    expect(result.blocked.native).toBe(1);
    expect(result.blocked.graphs).toBe(1);
    expect(result.blocked.flag).toBe(true);
    expect(result.blocked.sinks).toContain('speaker-2');
  } finally {
    if (app) await app.close();
    fs.rmSync(userData, { recursive: true, force: true });
  }
});
