# Webflow Tres Scenes (Vue 3 + TresJS)

Продакшен‑готовая библиотека для Webflow: один `<script>` (IIFE) + `data-*` атрибуты на контейнерах → автоматически монтируются 3 разные 3D‑сцены на TresJS/Three.js.

Ключевые принципы:
- Сцена рендерит **только 3D** (модели/свет/эффекты/интерактив). HTML‑оверлеи (заголовки/кнопки) **не вставляются** — делайте их обычной Webflow‑вёрсткой поверх.
- Корректный color management: `outputColorSpace = sRGB`, `toneMapping = ACESFilmic`, `toneMappingExposure` управляется атрибутами.
- Свет: если в glTF есть `KHR_lights_punctual` — используем их; если нет — включается fallback light rig + нейтральный environment.
- Производительность: `render-mode="on-demand"` + лимит FPS по quality (max 61fps), `IntersectionObserver` (пауза вне экрана), `ResizeObserver` (табы/аккордеоны/брейкпоинты), `prefers-reduced-motion`, cap на DPR для Retina.

## Сборка

```bash
npm run build
```

Артефакты:
- `dist/webflow-tres-scenes.iife.js`
- `dist/webflow-tres-scenes.css`

## Подключение в Webflow

1) Загрузите `dist/webflow-tres-scenes.iife.js` (и CSS) в Webflow Assets или на свой CDN.

2) Вставьте в Project Settings → Custom Code → Footer (или Page Settings → Before `</body>`):

```html
<link rel="stylesheet" href="https://YOUR_CDN/webflow-tres-scenes.css" />
<script defer src="https://YOUR_CDN/webflow-tres-scenes.iife.js"></script>
```

3) Добавьте контейнеры (обычные `div`) и нужные `data-*` атрибуты:

### Scene A — `hero-duo`

```html
<div
  data-tres="scene"
  data-scene="hero-duo"
  data-model-a="https://YOUR_CDN/models/hero-a.glb"
  data-model-b="https://YOUR_CDN/models/hero-b.glb"
  data-hdr="https://YOUR_CDN/hdr/studio.hdr"
></div>
```

Поведение:
- Idle: subtle sway, glints, emissive pulse.
- Hover (desktop): модель A выезжает вперёд и «проворачивается» (без показа спины), модель B остаётся фоном.
- Touch: tap‑toggle (tap = focus, ещё tap = reset).

### Scene B — `compare-duo`

```html
<div
  data-tres="scene"
  data-scene="compare-duo"
  data-model-a="https://YOUR_CDN/models/compare-a.glb"
  data-model-b="https://YOUR_CDN/models/compare-b.glb"
  data-mode="grid"
></div>
```

Webflow может переключать режим через Interactions, меняя `data-mode`:
- `data-mode="grid"` — обе модели в раскладке.
- `data-mode="focus-a"` — остаётся A по центру, включается drag/rotate (Y + небольшой X).
- `data-mode="focus-b"` — аналогично для B.

### Scene C — `single`

```html
<div
  data-tres="scene"
  data-scene="single"
  data-model="https://YOUR_CDN/models/single.glb"
  data-hdr="https://YOUR_CDN/hdr/studio.hdr"
></div>
```

Поведение:
- Лёгкий параллакс от мыши.
- Auto‑rotation (медленный); при drag останавливается и возвращается через N секунд idle.
- Glints + emissive pulse + аккуратный bloom.

## Публичный API (глобально)

IIFE экспортирует:

```js
window.WebflowTresScenes = { mountAll, unmountAll, refresh }
```

- `mountAll()` — смонтировать все `[data-tres="scene"]`.
- `unmountAll()` — размонтировать все сцены и очистить.
- `refresh()` — смонтировать новые + размонтировать удалённые.

Автомонтирование происходит само (DOMContentLoaded + Webflow hook + MutationObserver).

## Атрибуты и defaults

Общие:
- `data-tres="scene"` — обязательный маркер.
- `data-scene="hero-duo|compare-duo|single"` — обязательный тип сцены.
- `data-hdr="URL(.hdr|.exr)"` — HDR environment (если нет — нейтральный `RoomEnvironment`).
- `data-quality="auto|low|med|high"` — default: `auto`.
- `data-exposure="number"` — default: `1.15`.
- `data-emissive="number"` — default: `1.75`.
- `data-env-intensity="number"` — default: `1.0` (проставляется как `envMapIntensity` материалов).
- `data-bloom="number"` — default: `1.0` (множитель bloom).
- `data-transparent="1|0"` — default: `1` (прозрачный фон канваса).
- `data-background="1|0"` — default: `0` (рендерить environment в background).
- `data-draco="1|0"` — default: `1` (Draco decode включён; decoder встроен в бандл, без CDN).
- `data-debug="1|0"` — default: `0` (диагностика материалов/цветовых пространств в консоли).

Device overrides (суффиксы `-mobile|-tablet|-desktop`):
- Читаются для `data-exposure`, `data-emissive`, `data-env-intensity`, `data-bloom`, `data-transparent`, `data-background`.
  Пример: `data-exposure-mobile="1.3"`.

Scene A (`hero-duo`) hover‑параметры:
- `data-hero-hover-z="number"` — default: `0.35`
- `data-hero-hover-scale="number"` — default: `1.05`
- `data-hero-hover-rotate="deg"` — default: `270` (интерпретируется безопасно: 270° → -90°)
- `data-hero-hover-clamp="deg"` — default: `110` (ограничение, чтобы не показывать «спину»)

Scenes B/C drag limits:
- `data-drag-y-clamp="deg"` — default: `180` (≥179 → без clamp)
- `data-drag-x-clamp="deg"` — default: `25`

Scene C (`single`) parallax:
- `data-parallax="number"` — default: `0.75` (на mobile автоматически сильно уменьшается)
- `data-auto-rotate="1|0"` — default: `1`
- `data-auto-rotate-speed="number"` — default: `0.25`
- `data-idle-resume="seconds"` — default: `2.5`

Состояние загрузки:
- Контейнеру проставляется `data-tres-state="loading|ready|error"`.

## Цвет/свет: что важно

Renderer (TresCanvas):
- `outputColorSpace = SRGBColorSpace`
- `toneMapping = ACESFilmicToneMapping`
- `toneMappingExposure = data-exposure*`

Материалы после загрузки:
- `map` и `emissiveMap` → sRGB
- `normal/roughness/metalness/ao/alpha` → Non‑Color
- `emissiveIntensity` форсится на материалах со screen/emissive по карте/имени (`data-emissive`)
- Параметры rough/metal/opacity clamp в `[0..1]`

## Troubleshooting

**Цвета “серые” / розовый‑синий пропал**
- Включите `data-debug="1"` и проверьте в консоли, что `map`/`emissiveMap` действительно sRGB, а rough/metal/normal — Non‑Color.
- Убедитесь, что `data-exposure` и `data-emissive` не слишком низкие.
- Проверьте, что вы не применяете toneMapping второй раз (доп. пост‑процессоры поверх этого бандла).

**Сцена жрёт CPU когда блок скрыт**
- Рендер останавливается вне viewport автоматически. Если контейнер остаётся “видимым” (например, `display: block` но `opacity:0`), используйте Webflow так, чтобы скрытие влияло на layout (`display:none`) или выносите сцену в отдельный блок.

**GLB не грузится**
- Проверьте CORS (URL должен отдавать `Access-Control-Allow-Origin`).
- Проверьте консоль и `data-tres-state="error"`.

## Локальная проверка моделей

Ваши `.glb` могут лежать где угодно (например, `/Users/dmitry/Downloads/👾 Source Files`), но для dev проще положить их в `public/` и ссылаться как `/models/xxx.glb`.
