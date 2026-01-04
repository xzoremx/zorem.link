# Plan: Sistema de Avatares (Emoji) para Viewers

## Resumen

Sistema completo de avatares emoji para viewers con:
- Lista dinámica de emojis usando `emoji-datasource` (npm)
- Trending: emojis más usados en Zorem
- UI de bubbles en cards de My Rooms mostrando viewers
- Dropdown con lista completa de viewers por room

---

## Librería de Emojis

**Implementado:** `apps/web-next/src/lib/emojis.ts`

Usa `emoji-datasource` (1911 emojis) para:
- `getBaseEmojis(limit)` - Emojis ordenados por popularidad Unicode
- `getRandomEmojis(count)` - Selección aleatoria
- `buildEmojiList(trending, count)` - Combina trending + base + random
- `BASE_EMOJI_LIST` - 48 emojis precalculados para render inicial

Categorías incluidas: Smileys & Emotion, People & Body, Animals & Nature

---

## Fase 1: Backend - Almacenar Avatar

### 1.1 Migración de base de datos

```sql
-- 008_viewer_avatars.sql

-- Agregar columna avatar a viewer_sessions
ALTER TABLE viewer_sessions ADD COLUMN avatar VARCHAR(10);

-- Tabla para tracking de emojis populares
CREATE TABLE emoji_stats (
    emoji VARCHAR(10) PRIMARY KEY,
    use_count INTEGER DEFAULT 1,
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index para obtener trending rápidamente
CREATE INDEX idx_emoji_stats_trending ON emoji_stats(use_count DESC, last_used_at DESC);
```

### 1.2 Modificar endpoint `POST /api/viewer/join`

Request actual:
```json
{ "code": "ABC123", "nickname": "Juan" }
```

Request nuevo:
```json
{ "code": "ABC123", "nickname": "Juan", "avatar": "😎" }
```

Lógica adicional:
1. Guardar avatar en `viewer_sessions.avatar`
2. Upsert en `emoji_stats` para incrementar `use_count`

### 1.3 Nuevo endpoint `GET /api/emojis/trending`

Retorna los 24 emojis más usados en Zorem:
```json
{
  "trending": ["😂", "💀", "😭", "🔥", "✨", ...],
  "updated_at": "2026-01-04T..."
}
```

Query:
```sql
SELECT emoji FROM emoji_stats
ORDER BY use_count DESC, last_used_at DESC
LIMIT 24
```

Si hay menos de 24, completar con defaults.

---

## Fase 2: Backend - Viewers en Stories

> Nota: por privacidad, la implementación actual expone viewers **solo al owner** vía endpoints de `rooms` (para My Rooms). No se incluye lista de viewers en el endpoint público de stories.

### 2.1 Modificar `GET /api/stories/room/:roomId`

Response actual por story:
```json
{
  "id": "...",
  "media_url": "...",
  "like_count": 5,
  "view_count": 12
}
```

Response nuevo:
```json
{
  "id": "...",
  "media_url": "...",
  "like_count": 5,
  "view_count": 12,
  "recent_viewers": [
    { "avatar": "😎", "nickname": "Juan" },
    { "avatar": "💀", "nickname": "Maria" },
    { "avatar": "🔥", "nickname": "Pedro" }
  ]
}
```

Query para recent_viewers (últimos 5 por story):
```sql
SELECT DISTINCT ON (vs.id)
    vs.avatar, vs.nickname
FROM views v
JOIN viewer_sessions vs ON v.viewer_hash = vs.viewer_hash
WHERE v.story_id = $1
ORDER BY vs.id, v.viewed_at DESC
LIMIT 5
```

### 2.2 Nuevo endpoint `GET /api/stories/:storyId/viewers`

Lista completa de viewers de una story:
```json
{
  "viewers": [
    { "avatar": "😎", "nickname": "Juan", "viewed_at": "..." },
    { "avatar": "💀", "nickname": "Maria", "viewed_at": "..." },
    ...
  ],
  "total": 45
}
```

Query:
```sql
SELECT vs.avatar, vs.nickname, v.viewed_at
FROM views v
JOIN viewer_sessions vs ON v.viewer_hash = vs.viewer_hash
WHERE v.story_id = $1
ORDER BY v.viewed_at DESC
```

---

## Fase 3: Frontend - Selector de Emojis Mejorado

### 3.1 Estructura de la lista de emojis

```
[Trending (12)] + [Recent from API (8)] + [Random (4)]
     ↓                    ↓                    ↓
Más usados en       Emojis nuevos/        Shuffle de
Zorem (API)         populares             una lista base
```

### 3.2 Lógica en `nickname/page.tsx`

```typescript
// Al cargar la página:
const [emojis, setEmojis] = useState<string[]>(DEFAULT_EMOJIS);

useEffect(() => {
    async function loadEmojis() {
        try {
            const trending = await emojisAPI.getTrending();
            const random = getRandomEmojis(BASE_EMOJIS, 4);
            setEmojis([...trending.slice(0, 20), ...random]);
        } catch {
            // Fallback a lista estática
            setEmojis(DEFAULT_EMOJIS);
        }
    }
    loadEmojis();
}, []);
```

### 3.3 Librería de emojis base

Usar `emoji-mart` o lista estática curada de ~200 emojis populares.
La lista base solo se usa para el random, no para trending.

---

## Fase 4: Frontend - Bubbles de Viewers en My Rooms

> **Nota:** Bubbles solo aparecen en las cards de My Rooms (stats), NO en el story viewer.

### 4.1 Componente `ViewerBubbles`

```tsx
interface ViewerBubblesProps {
    viewers: Array<{ avatar: string; nickname: string }>;
    totalCount: number;
    onViewAll: () => void;
}

function ViewerBubbles({ viewers, totalCount, onViewAll }: ViewerBubblesProps) {
    return (
        <button onClick={onViewAll} className="flex items-center">
            {/* Bubbles superpuestas */}
            <div className="flex -space-x-2">
                {viewers.slice(0, 5).map((v, i) => (
                    <div
                        key={i}
                        className="w-8 h-8 rounded-full bg-white/10 border-2 border-black flex items-center justify-center text-sm"
                        title={v.nickname}
                    >
                        {v.avatar}
                    </div>
                ))}
            </div>
            {/* Contador si hay más */}
            {totalCount > 5 && (
                <span className="ml-2 text-xs text-neutral-400">
                    +{totalCount - 5} more
                </span>
            )}
        </button>
    );
}
```

### 4.2 Ubicación en la UI

En `my-rooms/page.tsx`, en cada card de room (activo o expirado):
```
┌─────────────────────────────────────┐
│ ACTIVE • Expires in 2h              │
│ ABC123                              │
│ Stories: 8 • Views: 145 • Likes: 32 │
│ [😎][💀][🔥][🥳][😂] +40 more       │ ← Click para ver todos
│ [Copy code] [Copy link]      [Open] │
└─────────────────────────────────────┘
```

### 4.3 Modal de Viewers

Al hacer click en las bubbles:
```
┌─────────────────────────────────────┐
│ Viewers (45)                    [X] │
├─────────────────────────────────────┤
│ 😎 Juan              viewed 2m ago  │
│ 💀 Maria             viewed 5m ago  │
│ 🔥 Pedro             viewed 10m ago │
│ 🥳 Ana               viewed 15m ago │
│ ...                                 │
└─────────────────────────────────────┘
```

---

## Orden de Implementación

| # | Tarea | Tipo | Estado |
|---|-------|------|--------|
| 1 | Migración DB (008_viewer_avatars.sql) | Backend | ✅ Implementado |
| 2 | POST /api/viewer/join (agregar avatar) | Backend | ✅ Implementado |
| 3 | GET /api/emojis/trending | Backend | ✅ Implementado |
| 4 | GET /api/rooms (agregar recent_viewers) | Backend | ✅ Implementado |
| 5 | GET /api/rooms/:roomId/viewers | Backend | ✅ Implementado |
| 6 | Nickname page (enviar avatar al join) | Frontend | ✅ Implementado |
| 7 | Fetch trending al cargar emojis | Frontend | ✅ Implementado |
| 8 | ViewerBubbles component | Frontend | ✅ Implementado |
| 9 | Viewers modal en My Rooms | Frontend | ✅ Implementado |
| 10 | Integrar bubbles en cards | Frontend | ✅ Implementado |

---

## Consideraciones

### Performance
- Cachear trending emojis (actualizar cada hora)
- Limitar recent_viewers a 5 en el response principal
- Lazy load lista completa de viewers

### Fallbacks
- Si no hay trending, usar lista estática
- Si viewer no tiene avatar, mostrar emoji default (😀)
- Si API falla, usar emojis guardados en localStorage

### Futuro
- Avatares custom (imágenes) para usuarios premium
- Badges/frames para avatares
- Avatares animados
