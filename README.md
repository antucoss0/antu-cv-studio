# Antu CV Studio ✦

Generador de CVs y cartas de presentación a la medida para **Antu Coss**, con una interfaz morada kawaii / bubble gum.

- **Entrada:** link de la vacante, flyer/foto (OCR) o texto pegado.
- **Salida:** CV + carta personalizados y editables → PDF (imprimir) o Word.
- **Base de datos de perfil** sembrada con todos los CVs de Antu (9 perfiles: IA Architect, IA Artist, Game Dev, AR/VR, 3D, Multimedia, Frontend, Diseño, Hospitalidad). Se guarda en el navegador; exporta/importa JSON.
- **+ Nueva experiencia** para agregar información nueva a la base.
- **Modo local** (sin API key): selección por palabras clave + plantilla. **Modo IA** (Anthropic u OpenAI, key guardada solo en tu navegador): lee flyers y redacta todo a la medida.

## Desarrollo

```bash
npm install
npm run dev     # http://localhost:5173
npm run build   # genera dist/
npm run lint
```

Los datos semilla viven en `src/data/seed.ts` (sube `SEED_VERSION` en `src/lib/store.ts` para forzar la recarga en los navegadores).
