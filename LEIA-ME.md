# Empregador em Dia — site

Site estático de conteúdo informativo sobre obrigações trabalhistas, dividido em duas trilhas: **Empresa (CLT)** e **Empregador doméstico**.

Sem WordPress, sem banco de dados, sem mensalidade. O site é gerado por um script em Node e publicado gratuitamente pelo GitHub Pages.

---

## 1. Antes de publicar

Toda a configuração fica em `conteudo/site.json`.

| Campo | Situação |
| --- | --- |
| `whatsapp` | `5561991880398` — pronto |
| `email` | `jheffersonmario6@gmail.com` — pronto |
| `formularioEndpoint` | **Pendente.** Endereço do Formspree (passo 4 abaixo). Enquanto estiver vazio, o formulário aparece desativado no site |

O gerador avisa no terminal se algo ficou pendente.

---

## 2. Publicar no GitHub Pages

### 2.1 Criar o repositório

1. Entre em [github.com](https://github.com) e crie um repositório **público** chamado `empregadoremdia`.
2. Envie os arquivos deste projeto para ele. Pela interface web: **Add file → Upload files**, arraste tudo e confirme.

> A pasta `_site/` **não** deve ser enviada — ela é gerada automaticamente. O arquivo `.gitignore` já cuida disso.

### 2.2 Ligar o Pages

No repositório: **Settings → Pages → Build and deployment → Source** e selecione **GitHub Actions**.

Pronto. A cada alteração enviada, o GitHub roda o gerador e publica sozinho. O andamento aparece na aba **Actions**.

---

## 3. Apontar o domínio no Registro.br

No painel do Registro.br, abra o domínio `empregadoremdia.com.br` e vá em **Editar zona DNS** (ou "DNS → Configurar endereçamento").

Crie **quatro registros A** no domínio raiz (campo de nome vazio ou `@`):

```
185.199.108.153
185.199.109.153
185.199.110.153
185.199.111.153
```

Opcionalmente, quatro registros **AAAA** para IPv6:

```
2606:50c0:8000::153
2606:50c0:8001::153
2606:50c0:8002::153
2606:50c0:8003::153
```

E um registro **CNAME** para o `www`:

```
www   CNAME   jheffersonmario5.github.io.
```

Depois, no GitHub: **Settings → Pages → Custom domain**, digite `empregadoremdia.com.br` e salve. Marque **Enforce HTTPS** assim que a opção ficar disponível — o certificado leva de alguns minutos a algumas horas para ser emitido.

> A propagação do DNS costuma levar de 30 minutos a algumas horas. Se der erro logo depois de configurar, aguarde antes de mexer de novo.

---

## 4. Ativar o formulário de contato

1. Crie uma conta gratuita em [formspree.io](https://formspree.io).
2. Crie um formulário novo e copie o endereço gerado (algo como `https://formspree.io/f/xxxxxxx`).
3. Cole esse endereço em `formularioEndpoint`, dentro de `conteudo/site.json`.
4. Envie a alteração. O formulário passa a funcionar e as mensagens chegam no seu e-mail.

O plano gratuito tem limite mensal de envios. Se o volume crescer, dá para trocar por outro serviço alterando apenas esse campo.

---

## 5. Publicar um artigo novo

Crie um arquivo `.md` dentro de `conteudo/artigos/`. **O nome do arquivo vira o endereço da página** — use nomes curtos, em minúsculas e com hífens.

Exemplo: `banco-de-horas.md` → `empregadoremdia.com.br/artigos/banco-de-horas/`

```markdown
---
titulo: Banco de horas: quando o acordo é válido
descricao: Uma frase de resumo. Aparece no Google e nos cartões do site.
trilha: empresa
assunto: Contratação
data: 2026-09-10
ordem: 6
destaque: nao
---

Texto de abertura.

## Um subtítulo

Parágrafo com **negrito** e [link](https://exemplo.com.br).

- item de lista
- outro item

::: atencao Título da caixa
Texto de alerta em destaque.
:::
```

### Campos do cabeçalho

| Campo | Para que serve |
| --- | --- |
| `titulo` | Título do artigo |
| `descricao` | Resumo de uma frase (usado no Google e nos cartões) |
| `trilha` | `empresa` ou `domestico` |
| `assunto` | Agrupamento dentro da trilha. Repita o mesmo texto para juntar artigos no mesmo bloco |
| `data` | Data de atualização, no formato `AAAA-MM-DD` |
| `ordem` | Posição dentro da trilha (número menor aparece antes) |
| `destaque` | `sim` coloca o artigo em "Em pauta agora" na página inicial |

### Caixas de destaque disponíveis

```
::: norma Onde conferir
Para citar o dispositivo legal.
:::

::: atencao Título
Para alertar sobre um erro comum.
:::

::: prazo Título
Para destacar uma data ou prazo.
:::
```

### O que o Markdown aceita

Títulos `##` e `###`, negrito `**assim**`, itálico `*assim*`, links `[texto](url)`, listas com `-` ou `1.`, citações com `>`, tabelas com `|` e a linha separadora `---`.

Os títulos `##` viram automaticamente o índice "Nesta página" quando houver três ou mais.

---

## 6. Rodar na sua máquina (opcional)

Só é necessário se você quiser ver o resultado antes de publicar. Requer [Node.js](https://nodejs.org) instalado.

```bash
node build.mjs           # gera o site na pasta _site/
node build.mjs --serve   # gera e abre em http://localhost:4000
```

Se preferir, dá para pular isso: basta enviar o arquivo `.md` pelo GitHub e conferir no site publicado alguns minutos depois.

---

## 7. Estrutura das pastas

```
conteudo/site.json        configuração geral (contato, domínio, identificação)
conteudo/artigos/*.md     os artigos — um arquivo por texto
assets/estilo.css         aparência do site
assets/site.js            menu em telas pequenas
build.mjs                 gerador do site
.github/workflows/        publicação automática no GitHub Pages
_site/                    resultado gerado (não editar, não enviar)
```

---

## 8. Sobre o conteúdo publicado

Os textos deste projeto foram redigidos a partir da legislação vigente e indicam, ao final de cada artigo, os dispositivos correspondentes para conferência.

Dois pontos merecem atenção contínua:

- **Revisão profissional.** O conteúdo deve ser revisto pelo advogado responsável antes da publicação e sempre que a legislação for alterada. A responsabilidade pelo que está no ar é de quem assina.
- **Valores que mudam todo ano.** O salário mínimo e as tabelas de INSS e IR são reajustados anualmente. O artigo sobre o eSocial Doméstico cita o valor vigente em 2026 — atualize-o em janeiro.

O site foi estruturado para observar o Provimento nº 205/2021 do Conselho Federal da OAB: conteúdo de caráter técnico-informativo, identificação profissional com nome e número de inscrição, ausência de promessa de resultado, de menção a honorários, de comparação e de casos concretos. Ao escrever novos artigos, mantenha esse mesmo registro.
