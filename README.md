# Contraste Acessível — verifique e corrija o contraste de cores (HTML + JavaScript)

Texto cinza-claro em fundo branco fica bonito no Figma e ilegível para muita gente no celular, no sol ou com a visão cansada. O Contraste Acessível calcula a razão de contraste da WCAG 2.x entre texto e fundo, mostra em quais critérios o par passa e, quando não passa, sugere a cor mais próxima que resolve.

Feito para quem desenvolve, desenha interfaces ou revisa acessibilidade de sites e aplicativos.

**Acesse online:** https://micdog22.github.io/contraste-acessivel/

## Recursos

- Aceita `#rgb`, `#rrggbb`, `#rrggbbaa`, `rgb()`/`rgba()` e `hsl()`/`hsla()` (sintaxe com vírgulas ou com espaços e `/`), além do seletor de cor do navegador e um botão para inverter texto e fundo.
- Razão de contraste com duas casas decimais (ex.: 4,54:1) e resultado para cada critério:
  - texto normal: AA (4,5:1) e AAA (7:1);
  - texto grande: AA (3:1) e AAA (4,5:1);
  - componentes de interface e gráficos: 3:1.
- Transparência levada em conta: o texto é combinado com o fundo, e um fundo transparente é considerado sobre branco.
- Pré-visualização em vários tamanhos, incluindo texto grande e um exemplo de botão e ícone.
- Sugestões quando o par falha: a cor mais próxima que passa em AA e em AAA, mudando só a luminosidade (L do HSL) do texto ou, como alternativa, do fundo. Um clique aplica a cor.
- Simulação de protanopia, deuteranopia e tritanopia.
- Modo paleta: cole várias cores e veja a matriz de contraste entre todas, com aprovação ou reprovação em cada célula.
- As últimas cores ficam salvas no navegador.

## Como usar

1. Digite ou escolha a cor do texto e a do fundo.
2. Veja a razão de contraste e os critérios que passam ou falham.
3. Se falhar, use uma das sugestões (botão **Aplicar**).
4. No **modo paleta**, cole uma cor por linha, com nome opcional:
   ```
   Texto: #1b1f24
   Fundo: #ffffff
   Primária: #2563eb
   ```

## Como rodar localmente

Módulos ES não carregam via `file://`, então sirva a pasta com qualquer servidor estático:

```bash
python3 -m http.server 8000
```

Depois abra http://localhost:8000.

## Testes

```bash
npm test
```

Os testes (com `node:test`, sem dependências) cobrem a luminância relativa (linearização do sRGB), preto e branco = 21:1, `#777777` sobre branco ≈ 4,48 (reprova AA), `#767676` ≈ 4,54 (aprova), a leitura de todos os formatos de cor, a composição de transparência, as sugestões (que sempre atingem o alvo e são as mais próximas), a matriz da paleta e a simulação de daltonismo.

## Como funciona

**Luminância relativa.** Cada canal sRGB (0 a 255) vira um valor de 0 a 1 e é linearizado: `c / 12,92` se `c ≤ 0,04045`, senão `((c + 0,055) / 1,055) ^ 2,4`. A luminância é `0,2126 R + 0,7152 G + 0,0722 B`.

**Razão de contraste.** `(L1 + 0,05) / (L2 + 0,05)`, com L1 a luminância da cor mais clara. O valor exibido nunca é arredondado para cima até um limite que a cor não atinge (4,499 aparece como 4,49:1, e não 4,50:1).

**Sugestões.** A cor é convertida para HSL, matiz e saturação ficam fixos e uma busca binária encontra a luminosidade mais próxima da original que atinge 4,5:1 ou 7:1, tanto escurecendo quanto clareando.

**Daltonismo.** As cores são convertidas para RGB linear e multiplicadas pelas matrizes de Machado, Oliveira e Fernandes (2009) com severidade máxima. É uma aproximação: não substitui testes com pessoas.

**Referências da WCAG:**

- [1.4.3 Contraste (mínimo)](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
- [1.4.6 Contraste (melhorado)](https://www.w3.org/WAI/WCAG22/Understanding/contrast-enhanced.html)
- [1.4.11 Contraste não textual](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)

## Contribuindo

Issues e pull requests são bem-vindos.

## Licença

MIT — veja [LICENSE](LICENSE).
