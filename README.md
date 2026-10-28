# ORI — Museu Afroturístico 3D (Edição 4)

Projeto em HTML, CSS e JavaScript com Three.js: museu 3D explorável em primeira pessoa, galerias com arcos e colunas, seis obras com textos educativos, jardim externo, espelho d'água, mapa, controles de teclado e de toque, e opção de qualidade gráfica econômica.

## Abrir

**Windows:** extraia o ZIP e execute `INICIAR_MUSEU.bat`. Ele inicia um servidor local com Python e abre o navegador. Mantenha a janela de servidor aberta.

**VS Code:** abra a pasta inteira, instale a extensão Live Server e use `Open with Live Server` sobre `index.html`.

Não abra o arquivo por duplo clique (`file://`), pois os módulos JavaScript podem ser bloqueados pelo navegador. É necessária internet para carregar Three.js via CDN e as fontes opcionais do Google Fonts.

## Controles

- `W A S D` / setas: movimentar
- Mouse: olhar
- `E`: observar a obra para a qual a câmera está apontando
- `M`: abrir/fechar mapa
- `Shift`: andar mais rápido
- `Esc`: liberar o cursor ou fechar um painel
- Celular: direcional virtual e arraste na cena

## Personalização

- `css/style.css`: identidade visual e responsividade
- `js/main.js`: cena 3D, materiais, arquitetura, obras e controles
- `index.html`: conteúdo e interface

A obra é uma interpretação artística e educativa de referências afro-diaspóricas diversas, sem pretender representar um único povo ou tradição.

## Edição 5 — Afrofuturismo, cidades e cultura negra

Seis salas, uma por tema: arquitetos afro, personagens negros, religiosidade e influências, arte afro, movimentos da cultura afro, subculturas e movimento afro. As ilustrações são geradas no navegador. Para usar fotos reais, coloque os arquivos em `img/` e adicione `photo:'img/arquivo.jpg'` ao tema em `stories` (`js/main.js`).

Movimento corrigido: o andar usava o sinal errado de `sin(yaw)` e os lados ficavam espelhados ao girar; agora há aceleração suave, deslizamento nas colisões, parede do fundo sólida (só o portal passa), setas ← → giram e o mouse arrasta o olhar se o cursor não puder ser travado.
