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

## 5. Publicar um artigo novo — pelo próprio site

Abra **[empregadoremdia.com.br/publicar/](https://empregadoremdia.com.br/publicar/)**. Essa página não aparece no menu nem no Google (`noindex`), mas fica linkada no rodapé.

### 5.1 Na primeira vez: gerar o token

O painel escreve direto no repositório, e para isso precisa de uma autorização sua no GitHub.

1. Abra [github.com/settings/personal-access-tokens/new](https://github.com/settings/personal-access-tokens/new).
2. Em **Repository access**, marque *Only select repositories* → `empregadoremdia`.
3. Em **Permissions → Repository permissions**, coloque **Contents** em *Read and write*.
4. Escolha a validade, gere e copie o token (começa com `github_pat_`).
5. Cole no campo do painel e clique em **Conectar**.

O token fica guardado só no navegador que você usou — nenhum outro servidor participa, o navegador fala direto com o GitHub. Marque "continuar conectado" apenas em computador seu; em máquina compartilhada, desmarque e ele some quando a aba fechar.

> Quando o token vencer, o painel avisa e pede um novo. Nada se perde.

### 5.2 No dia a dia

- **Novo artigo**: preenche os campos, escreve o texto e clica em **Publicar no site**.
- **Editar**: clica em *Editar* na lista, altera e publica de novo.
- **Excluir**: dentro do editor, botão *Excluir artigo*.

A pré-visualização ao lado usa o mesmo renderizador que gera o site — o que você vê é o que vai ao ar. O endereço da página é sugerido a partir do título, mas pode ser trocado; se você mudar o endereço de um artigo já publicado, o painel avisa que o link antigo vai quebrar.

Depois de publicar, o GitHub reconstrói o site sozinho. Leva de um a dois minutos, e o painel mostra o link para acompanhar.

Se um rascunho ficar pela metade, ele é guardado no navegador e o painel oferece recuperá-lo na próxima vez.

---

## 5-B. Publicar um artigo pelo arquivo (alternativa)

Também dá para criar o `.md` à mão dentro de `conteudo/artigos/`. **O nome do arquivo vira o endereço da página** — use nomes curtos, em minúsculas e com hífens.

Exemplo: `banco-de-horas.md` → `empregadoremdia.com.br/artigos/banco-de-horas/`

```markdown
---
titulo: "Banco de horas: quando o acordo é válido"
descricao: "Uma frase de resumo. Aparece no Google e nos cartões do site."
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

::: dica Título
Para uma orientação prática.
:::
```

No painel `/publicar/` essas quatro caixas estão na barra de ferramentas, é só clicar.

### O que o Markdown aceita

Títulos `##` e `###`, negrito `**assim**`, itálico `*assim*`, links `[texto](url)`, imagens `![descrição](url)`, listas com `-` ou `1.`, citações com `>`, tabelas com `|` e a linha separadora `---`.

Os títulos `##` viram automaticamente o índice "Nesta página" quando houver três ou mais.

> **Dois-pontos no cabeçalho.** Se um `titulo` ou `descricao` tiver `:` ou aspas, ponha o valor **entre aspas**. O gerador aceita sem, mas avisa no terminal — e um editor de YAML não conseguiria abrir o arquivo. O painel `/publicar/` já faz isso sozinho.

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
conteudo/site.json        configuração geral (contato, domínio, repositório, identificação)
conteudo/artigos/*.md     os artigos — um arquivo por texto
assets/estilo.css         aparência do site (claro e escuro)
assets/markdown.js        conversor de Markdown — usado pelo gerador E pelo painel
assets/site.js            menu, tema, busca, sumário e barra de progresso
assets/publicar.js        o painel /publicar/
build.mjs                 gerador do site
.github/workflows/        publicação automática no GitHub Pages
_site/                    resultado gerado (não editar, não enviar)
```

`assets/markdown.js` é o único lugar onde as regras de Markdown existem. O gerador o importa no Node e o painel o importa no navegador — por isso a pré-visualização não pode divergir do resultado final.

---

## 8. Sobre o conteúdo publicado

Os textos deste projeto foram redigidos a partir da legislação vigente e indicam, ao final de cada artigo, os dispositivos correspondentes para conferência.

Dois pontos merecem atenção contínua:

- **Revisão profissional.** O conteúdo deve ser revisto pelo advogado responsável antes da publicação e sempre que a legislação for alterada. A responsabilidade pelo que está no ar é de quem assina.
- **Valores que mudam todo ano.** O salário mínimo e as tabelas de INSS e IR são reajustados anualmente. O artigo sobre o eSocial Doméstico cita o valor vigente em 2026 — atualize-o em janeiro.

O site foi estruturado para observar o Provimento nº 205/2021 do Conselho Federal da OAB: conteúdo de caráter técnico-informativo, identificação profissional com nome e número de inscrição, ausência de promessa de resultado, de menção a honorários, de comparação e de casos concretos. Ao escrever novos artigos, mantenha esse mesmo registro.
