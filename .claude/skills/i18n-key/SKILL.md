---
name: i18n-key
description: Add (or rename/remove) a UI translation key across all three message catalogs (messages/ka.json, en.json, ru.json) so they never drift. Use whenever introducing new user-facing text in the app, or when a "missing message" / next-intl key error appears.
---

# Add an i18n key

This project keeps every UI string in `messages/{ka,en,ru}.json` (next-intl, ICU syntax).
English is the source of truth; **`ka.json` and `ru.json` currently mirror English** as
placeholders until real translations are filled in. The three files must always have the
**same key structure** — a key present in one but missing in another causes a runtime
`MISSING_MESSAGE` error in that locale.

## When invoked

The user wants to add UI text (e.g. a new button label, heading, error message), or a
next-intl key lookup is failing.

## Steps

1. **Pick the key path.** Keys are namespaced by feature: `common`, `nav`, `converter`,
   `order` (incl. `order.status`), `bankStatus`, `username`, `admin`. Reuse an existing
   namespace; only create a new top-level namespace for a genuinely new area. Use
   `camelCase` leaf names (e.g. `converter.maxAmount`).

2. **Add the key to all three files** — `messages/en.json`, `messages/ka.json`,
   `messages/ru.json — at the same JSON path:
   - `en.json`: the real English text.
   - `ka.json` and `ru.json`: **the same English text as a placeholder** (these catalogs
     are intentionally English copies for now), unless the user supplies a real Georgian /
     Russian translation — then use that.
   - Preserve the existing key ordering/structure; insert near related keys.
   - Use ICU placeholders for dynamic values, e.g. `"rateBuy": "1 GEL = {rate} PLUS"`.

3. **Use it in code** with `useTranslations("<namespace>")` (Client Components) or
   `getTranslations("<namespace>")` (Server Components / actions), e.g.
   `const t = useTranslations("converter"); …t("maxAmount")`.

4. **Verify the catalogs stay in lockstep.** Confirm every locale has the new path:

   ```bash
   node -e "const ks=o=>Object.entries(o).flatMap(([k,v])=>v&&typeof v=='object'?ks(v).map(s=>k+'.'+s):[k]).sort(); \
     const a=ks(require('./messages/en.json')),b=ks(require('./messages/ka.json')),c=ks(require('./messages/ru.json')); \
     const eq=JSON.stringify(a)===JSON.stringify(b)&&JSON.stringify(a)===JSON.stringify(c); \
     console.log(eq?'OK: catalogs in sync ('+a.length+' keys)':'DRIFT: '+JSON.stringify({en:a.length,ka:b.length,ru:c.length}))"
   ```

   If it reports DRIFT, a key is missing/misspelled in one file — fix until it prints OK.

## Notes

- Don't hardcode user-facing strings in components — always go through a key.
- Removing or renaming a key: do it in all three files in the same edit, and update every
  `t("…")` call site.
