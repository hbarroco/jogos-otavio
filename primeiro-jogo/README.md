# Primeiro Jogo — Aventura de Plataforma 2D

O primeiro jogo do Otávio Barroco! Uma aventura de plataforma 2D feita com HTML5 Canvas puro, sem bibliotecas ou frameworks.

## Como jogar

Abra o arquivo `index.html` diretamente no browser — sem instalação, sem servidor, sem dependências.

O objetivo é chegar até o portal **META** no fim do mapa sem perder todas as vidas.

## Controles

### Teclado

| Tecla | Ação |
|-------|------|
| `←` `→` | Mover |
| `Espaço` / `↑` | Pular |
| `↓` | Agachar |
| `Shift` | Dash |
| `R` | Reiniciar |

### Celular

Botões de toque aparecem automaticamente na tela em dispositivos móveis.

## Mecânicas

- **Moedas** — coletáveis espalhados pelas plataformas elevadas, valem 50 pontos cada
- **Inimigos** — patrulham o chão e perseguem o jogador quando ele se aproxima; pule em cima para eliminar (+100 pontos)
- **Dash** — impulso rápido com cooldown, útil para atravessar gaps
- **Vidas** — você começa com 3; cair num buraco ou ser atingido por inimigo custa uma vida
- **Portal** — chegar ao portal no fim do mapa = vitória

## Pontuação

| Ação | Pontos |
|------|--------|
| Avançar no mapa | +1 por 10px percorridos |
| Coletar moeda | +50 |
| Eliminar inimigo | +100 |

## Estrutura do projeto

```
primeiro-jogo/
├── index.html        # Página principal e overlays de game over / vitória
├── assets/
│   └── angry-face.png  # Sprite dos inimigos
└── src/
    ├── style.css     # Estilo e layout responsivo
    └── game.js       # Toda a lógica do jogo
```

## Tecnologias

- HTML5 Canvas API
- JavaScript puro (sem frameworks)
- CSS responsivo com suporte a mobile
