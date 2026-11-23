# Главный пёс — TypeScript/Vite (v2.0.0)

Миграция клиента с JS-монолита (game-core.js 2854 строки, 223 глобала) на
модульный TypeScript со строгой типизацией. Геймплей перенесён 1:1.

## Структура (14 ES-модулей)

| Модуль | Ответственность |
|---|---|
| types.ts | константы мира, математика, интерфейсы сущностей |
| diag.ts | диагностический оверлей (живые ошибки на экране) |
| i18n.ts | 4 локали (RU/EN/ZH/ES) целиком |
| config.ts | сложности, породы, 3 карты, палитры |
| state.ts | состояние партии, save v4, достижения, статистика |
| audio.ts | WebAudio SFX, процедурная музыка, вибрация |
| world.ts | сетка владения, коллизии, запекание слоёв карты |
| fx.ts | частицы, тосты, голуби, косточки, крутые места |
| sprites.ts | процедурные спрайты пса и кота |
| entities.ts | игрок, Рекс, Мурзик, Барбос, схватки, лай |
| game.ts | цикл, старт/финал/пауза, рендер, HUD |
| ui.ts | локализация DOM, превью породы |
| input.ts | клавиатура, тач-джойстик, геймпад |
| mp.ts | мультиплеер (3 пса, WSS-комнаты, тот же сервер) |
| platform.ts | Telegram WebApp, Discord SDK, PWA |

## Команды

```bash
npm install
npm run dev        # dev-сервер
npm run typecheck  # tsc --noEmit (strict)
npm run build      # проверка типов + прод-сборка в dist/
npm run preview    # предпросмотр сборки
```

## Интеграции сохранены

- Discord Activity: тот же DC_APP_ID, /discord/token обмен, автокомната по instance_id
- Telegram Mini App: tg-guard логика, HapticFeedback, CloudStorage, start_param
- Мультиплеер: WSS-протокол комнат тот же (glavny-pes.workers.dev), сервер не менялся
- PWA: manifest+SW сохранены (public/sw.js)
- localStorage-ключи совместимы (topdog-save v4 / best / stats / ach)

## Развёртывание на Cloudflare Pages

1. `npm run build` → папка `dist/`
2. Dashboard Cloudflare Pages → Create project → Upload dist
3. Либо wrangler: `npx wrangler pages deploy dist`
4. Discord URL Mapping и Telegram WebApp URL остаются прежними —
   сервер (glavny-pes-server) не менялся, WS-эндпоинты те же.
