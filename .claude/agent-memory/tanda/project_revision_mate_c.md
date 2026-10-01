---
name: revision-mate-c
description: Revisión documento a documento de Matemática C (22 conversiones + wiki) pedida por Juan el 2026-09-28; hallazgos para el informe, cortada a las 11:48 sin escribir el informe
metadata:
  type: project
---

Juan (2026-09-28): "quiero que Mate C sea perfecta"; **primero un informe con todo, antes de modificar nada.**
**Informe ESCRITO 2026-09-28**: `~/Boveda/Sistema/Informe - revisión de Matemática C.md` (sin commitear; lo commitea bibliotecario/Juan). Decisiones de Juan: núcleo ya + biblio por capítulo; lo no citable → Síntesis; los 2 resumen SON de la cátedra; crear nota central por materia.
Scratch de la sesión 2aa2cd77: `scratchpad/revmc/` (ver/ = salida de `db.py verificar` de los 22; img/ = renders).

**Why:** la próxima ronda arranca de acá sin repetir la revisión.
**How to apply:** escribir el informe (¿en `~/Boveda/Sistema/`? el clasificador de auto mode ya bloqueó escribir en
la bóveda antes: probar y si no, pedir aprobación) con estos hallazgos y las decisiones para Juan al final.

## Conversiones (F3): el "ok" es falso, la matemática no sirve en ninguna
- 20 de 22 PDF son LaTeX (CMMI/CMEX…); las 2 teorías `*_resumen` son apuntes estilo manuscrito (fuente Notewo).
- **Las 8 `verificado: ok` están mal marcadas** (miradas contra la imagen): series_de_taylor (exponente de
  e^{-0.4} suelto, se pierde ° de cos(10°)), autovalores (A² → "A" + "2" suelto, matrices aplanadas),
  espacios_vectoriales (markitdown: tablas inventadas, texto desordenado), proyecciones_ortogonales,
  series_de_potencias, sistemas_lineales_2, y las 2 teorías manuscritas con errores QUE CAMBIAN EL SENTIDO:
  ortonormal `b_i·b_j=0 si i≠j` → "i = j"; `dim V ≤ dim W` → "<"; `≥` → ">"; `L(αv₁+βv₂)` pierde α,β; ∈ desaparece.
- Las 14 `con-errores` son honestas. Texto en prosa completo (sólo faltan palabras por cortes de guion), la
  matemática rota: anydoc ∀→"8", ∈→"2", λ₁≠λ₂→"1*6*=2", R²→"R", acentos partidos ("Num´ericas").
- `mod1_parte_2_algebra_lineal` (markitdown, única posible: anydoc = necesita_ocr): **32 líneas de palabras
  pegadas** (la skill dice "no sirve"), 2172 acentos partidos. Sus 7 págs sin texto (2,5,35,74,75,102,103) son
  portadas de capítulo/blancas: no se pierde nada.
- `mod2_apunte`: 483 imágenes en 44 págs (casi todas 79–134) → se pierden. 222/237 págs marcadas.
- Proceso: obra marcó 222 y 114 páginas como error sin mirarlas (tope visual 10; la skill dice que página no
  mirada no va como error). No hay evidencia de que avisara a Juan de las palabras pegadas.
- `db.py verificar` mide cobertura de palabras: **no detecta matemática rota** → marca ok lo que no lo es (va a forja).

## Enlaces sin resolver 105→119 (CORREGIR lo que le dije a Juan)
- NO son imágenes GoogleShape (esas ya estaban en la base). Son 13 números de ecuación de mod2_apunte que anydoc
  deja como `[…](1.74)` = enlace Markdown a "1.74" (1.74–1.76, 2.30–2.42, 10, 11, 12, 83).
- +1 `[[Matematica C]]`: el frontmatter `materia:` que la skill apuntes define así; no existe nota de la materia.
- `pruebas.csv` sin commitear en ~/Dev/agentes es LO NORMAL: la skill dice no commitear salvo que Juan lo pida.

## Wiki (F4): fórmulas correctas contra la imagen, pero viola reglas de la skill apuntes
- Revisadas las 17 páginas contra las 9 págs de las 3 teorías. LaTeX de la wiki coincide con las imágenes.
- **0 citas dicen ", de la imagen"** (la skill lo exige en páginas con matemática = todas).
- **Afirmaciones sin cita / fuera de la fuente** (skill: "si no la podés citar, no la escribas"): convergencia
  condicional (Convergencia absoluta); descomposición única v=P_S+P_S⊥ (Complemento ortogonal); v−P_S(v)∈S⊥
  (Proyección ortogonal); normalizar u_i=k_i/‖k_i‖ (Gram-Schmidt); "si dim V=dim W iny⇔sobre" (Isomorfismo);
  "Serie-p aplicando el criterio de la integral"; nombre "D'Alembert"; "valores propios" (Resumen TL);
  "A∈ℝ^{m×n}, EC = espacio columna (rango)" (Teorema de la dimensión); "clase 1 del apunte" (Resumen TL);
  las frases de introducción de cada concepto no llevan cita.
- **Citas "textuales" que no lo son**: Gram-Schmidt mete la fórmula general k_j DENTRO de la cita de la cátedra;
  Transformación lineal cambia α→λ y saca ∀; Isomorfismo reescribe la inyectividad (fuente: L(v₁)≠L(v₂) ∀v₁≠v₂)
  y deja "L⁻¹(W)=V también será un isomorfismo" sin sentido; Representación matricial corrige en silencio
  "nulidad(A)=Nu(L)" (fuente) a "dim Nu(L)"; Bases cambia n→m; Resumen series dice "no decreciente/no creciente"
  donde la cátedra dice creciente/decreciente.
- **Omisiones**: cambio de base sin la definición de S=([v₁']_B,…,[vₙ']_B); composición sin L²=A_L²;
  Resumen series omite el caso L=∞ de comparación en el límite (el concepto sí lo tiene).
- **Erratas de la fuente** (no son de la wiki, avisar a Juan): repaso p1 "a_n=1/(2n+1) define 1,1/8,1/27,1/64"
  (es 1/n³); TL p2 "nulidad(A)=Nu(L)"; PO "MÉTODO DE ORGANIZACIÓN"; "S₁" donde va S⊥.
- **Procedencia**: las 2 teorías `*_resumen` parecen apuntes de alumno (estilo cuaderno), no de la cátedra; la
  wiki las cita como "(Matemática C)". Entraron a Teorias/ por D4. Preguntarle a Juan si cuentan como teoría (D2).
- index.md, log.md, enlaces a los PDF (nombres únicos en la bóveda): bien.

## Decisiones que el informe tiene que dejarle a Juan
1. "Perfecta" exige transcribir desde la imagen (ninguna herramienta hace LaTeX). Mi recomendación: teorías +
   prácticas + parciales ya (35 págs); bibliografía por capítulo al ingerirla (encaja con D3). Es un modo nuevo de
   convertir-documentos → forja. También: que verificar nunca marque `ok` un PDF tipo ecuaciones.
2. Reescribir la wiki según las reglas (citas de la imagen, sacar lo no citado o llevarlo a Síntesis como
   inferencia, citas textuales exactas, erratas de la fuente como `> [!note]`).
3. Procedencia de los 2 resúmenes; nota hub `Matematica C` o cambiar el campo `materia:`.
Pendiente aparte: re-verificar `acbdf36` (plan 2a-bóveda) → merge → 2b.

## 2026-09-28 tarde: regla de dos verificaciones (Juan)
Cada .md convertido: verificación del agente (visual, TODAS las páginas o tramo declarado) + la de Juan (casilla
Obsidian). Ingerir/resumir exige la del agente en `ok`; wiki = provisional hasta la de Juan; si su revisión cambia
el .md, la wiki se rehace. Wiki Mate C: BORRAR y re-ingerir. Los 70 marcados (45 ok / 25 con-errores) → pendiente.
Pedido escrito: `~/Boveda/Sistema/Informe para forja - dos verificaciones por conversión.md` (con contraste de
líneas en SKILLs, db.py marcar ~607-612, hook commit-msg 4/29/63, Boveda AGENTS.md 132/151-152). ENVIADO 2026-09-28 a forja lanzada como subagente (etapa 1: skills; sin migrar ni borrar wiki; prueba sobre copia).
Los 2 informes en ~/Boveda/Sistema siguen sin commitear (los commitea Juan o bibliotecario).
Etapa 1 forja = `e016894` en ~/Dev/agentes (claves planas `verificacion_agente*`, `verificacion_juan`; `db.py estado/huella/transcribir/ensamblar`), re-verificada por mí.
Etapa 1b (§7 del informe para forja): tramos de Juan (sólo si él lo dice), Juan no edita → agente corrige, TODA figura = error,
guarda LaTeX estricta, ensamblar conserva resto, hook con excepción sólo-frontmatter. Lanzada a forja nueva (la 1ª no se pudo retomar).
Después: bibliotecario (hook+AGENTS.md) → migrar 70 con `marcar --pendiente` → borrar wiki Mate C → transcribir núcleo.
Etapa 1b = `2d34919` (forja), re-verificada (pruebas.sh idéntico, hook de juguete 5/5). Juan: sin recortes de figuras (bloque [!figura]),
instala libreoffice-fresh él, plantilla no cuenta. Hook nuevo en /tmp/forja-1b/hook/commit-msg (volátil) → bibliotecario lo instala (etapa 2, en curso).
Etapa 2 = `5055971` en ~/Boveda (bibliotecario: hook + AGENTS.md), re-verificada (hook = /tmp/forja-1b, hooksPath ok).
Marqué F3–F5 del `Sistema/Plan - bóveda al 100 y Matemática C.md` como superadas (callout). Etapa 3 (bibliotecario, en curso):
A migrar 70 con marcar --pendiente (md5 cuerpo idéntico), B borrar Wiki/ Mate C, C sacar rama `verificado: ok` del hook.
Después: transcribir núcleo Mate C (teorías/prácticas/parciales) con convertir-documentos §2b + verificador distinto → re-ingerir.
Etapa 3 = `6ea7491` (70→pendiente, md5 cuerpo 70/70), `42d8dd6` (Wiki/ Mate C borrada, 0 enlaces entrantes), `fc0728a` (hook sin esquema viejo); re-verificado.
Núcleo Mate C = 19 PDF / 34 págs (Teorias 9, Practicas 21, Parciales 4); Bibliografía 3 PDF / 436 págs (por capítulo, después).
Sistema docs = `af5538a`. Núcleo transcrito = `dc412f8` (Prácticas 14), `3a0a8b8` (Parciales 2), `e1248f4` (Teorías 3), todos Reconversion: si;
19/19 `estado` exit 0 (control Bibliografía exit 1), verificacion_juan false. Contrasté YO contra imagen las líneas de sentido de los 2 *_resumen: correctas.
Hueco "v ␣ V, w ␣ W" (TL p1) es del PDF original, no de la conversión. Pendiente de Juan: ¿errata? y 0/o a mano PO p2.
Siguiente: re-ingerir wiki Mate C (apuntes, provisional) + nota central; luego Juan verifica conversiones (checkbox).
Menor: memoria de obra `.claude/agent-memory/obra/wiki-materias-apuntes.md:11` usa de ejemplo una página de la wiki borrada.
