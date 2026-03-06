# Multilingual (i18n) – How to Use

## Structure (already created)

- `locales/en.json` – English strings
- `locales/al.json` – Albanian strings (fill in manually)
- `lib/i18n.ts` – helper function `t(locale, key, params)`

## Test in one place first

Example: the bill notification in `app/api/manager/generate-bills/route.ts`.

1. Add your Albanian text to `locales/al.json`:
   ```json
   "billReadyBody": "Fatura juaj e mirëmbajtjes për {month} {year} është gati..."
   ```

2. When you want to use it, change the notification call to use `t()`.
   (You do this step yourself when ready.)

## Using `t()`

```ts
import { t } from "@/lib/i18n";

// Get translated string
const msg = t("al", "notifications.billReadyBody", { month: "Mar", year: "2026" });
```

- First argument: `"en"` or `"al"`
- Second argument: key path (e.g. `"notifications.billReadyBody"`)
- Third argument: optional params for `{month}`, `{year}`, etc.

## Adding new keys

1. Add the key to both `locales/en.json` and `locales/al.json`
2. Use `t("al", "your.new.key")` in your code when you want to use it

You change the strings. The structure is ready.
