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

## 3-B. Trancar a área de publicação (Cloudflare Access)

O site é estático: o GitHub Pages só entrega arquivos, não roda código do lado do servidor. Por isso **nenhuma senha escrita dentro deste repositório seria uma tranca de verdade** — ela chegaria ao visitante junto com a página, legível no navegador. Quem controla o acesso à página precisa estar *na frente* dela.

A Cloudflare faz esse papel de graça: o domínio passa a resolver por ela, e a regra do Access exige um código enviado ao seu e-mail antes de deixar a requisição chegar ao GitHub Pages.

### 3-B.1 Colocar o domínio na Cloudflare

1. Crie uma conta em [dash.cloudflare.com](https://dash.cloudflare.com) e escolha **Add a site** → `empregadoremdia.com.br` → plano **Free**.
2. A Cloudflare importa os registros DNS existentes. **Confira** se os quatro `A` do GitHub Pages e o `CNAME` do `www` vieram junto, e deixe todos com a **nuvem laranja** (*Proxied*) — sem o proxy, o Access não tem como interceptar nada.
3. Ela mostrará **dois servidores de nomes** (algo como `xxx.ns.cloudflare.com`). Copie os dois.
4. No Registro.br, no domínio, troque de "usar servidores DNS do Registro.br" para **servidores DNS próprios** e informe os dois endereços da Cloudflare. A troca leva de minutos a algumas horas.
5. Em **SSL/TLS → Overview**, escolha **Full**. Deixar em *Flexible* cria laço infinito de redirecionamento com o GitHub Pages — é o erro mais comum nessa combinação.

### 3-B.2 Criar a regra de acesso

1. No painel da Cloudflare, vá em **Zero Trust** → na primeira vez ele pede para escolher um nome de equipe e o plano **Free** (até 50 pessoas, sem cartão).
2. **Access → Applications → Add an application → Self-hosted**.
3. Em *Application domain*, informe o domínio `empregadoremdia.com.br` com o caminho `publicar` — assim só o painel fica trancado e o site continua aberto ao público.
4. Em *Policies*, crie uma política **Allow** com a regra **Emails** → o seu endereço de e-mail.
5. Em *Login methods*, deixe ligado o **One-time PIN**. É ele que dispensa criar senha: a Cloudflare manda um código ao seu e-mail a cada novo acesso.

Feito isso, abrir `/publicar/` passa a pedir o código antes de mostrar qualquer coisa. O token do GitHub continua sendo exigido depois — são duas trancas em série, e é assim mesmo que deve ser: a Cloudflare diz *quem entra na sala*, o token diz *o que pode ser gravado*.

### 3-B.3 O que essa tranca não cobre

- **O endereço do GitHub Pages continua existindo.** Como há domínio próprio configurado, `jheffersonmario5.github.io/empregadoremdia/` responde com um redirecionamento para o domínio — e aí a Cloudflare pega. Mas se o *Custom domain* for removido nas configurações do Pages, esse caminho volta a servir o conteúdo direto, por fora do Access. Não mexa nessa opção.
- **O repositório é público.** O código do painel (`assets/publicar.js`) pode ser lido por qualquer pessoa no GitHub. Isso não é falha: nada ali funciona sem o seu token. Mas não escreva segredo nenhum nesses arquivos.
- **A tranca é do caminho `/publicar/`.** Se um dia outra página administrativa for criada em endereço diferente, ela precisa ser incluída na regra.

---

## 4. Formulário de contato

O formulário funciona sem serviço externo e sem armazenar dados no site. O visitante preenche nome, canais opcionais, perfil e uma descrição breve; depois escolhe continuar pelo WhatsApp ou pelo aplicativo de e-mail. A mensagem é preparada no próprio dispositivo e só sai quando ele confirma o envio no canal escolhido.

Os destinos vêm dos campos `whatsapp` e `email` de `conteudo/site.json`. Não há conta de Formspree, limite mensal ou endpoint adicional para configurar.

### 4.1 Calculadoras trabalhistas

A página `/calculadoras/` reúne quatro estimativas para o empregador:

- custo médio de uma contratação CLT, com enquadramentos para Simples Nacional, Anexo IV, Lucro Presumido/Real e empregador doméstico;
- férias, terço constitucional, abono pecuniário e adiantamento estimado do 13º;
- 13º salário por avos;
- rescisão CLT, separando o pagamento direto dos recolhimentos de FGTS.

Tudo é calculado no navegador. Os valores digitados não são enviados nem armazenados. As fórmulas puras ficam em `assets/calculadoras.js` e têm testes automatizados em `tests/calculadoras.test.mjs`.

Os resultados são deliberadamente **brutos**: não tentam simular INSS, imposto de renda ou todas as incidências da folha. Isso evita atrelar a ferramenta a tabelas anuais e deixa explícito que norma coletiva, médias, afastamentos e particularidades do contrato precisam ser conferidos fora da estimativa.

Para verificar as fórmulas depois de qualquer alteração:

```bash
npm test
```

---

## 5. Publicar um artigo novo — pelo próprio site

Abra **[empregadoremdia.com.br/publicar/](https://empregadoremdia.com.br/publicar/)**. Essa página não aparece no menu nem no Google (`noindex`), mas fica linkada no rodapé.

### 5.1 Na primeira vez: gerar o token

O painel escreve direto no repositório, e para isso precisa de uma autorização sua no GitHub.

1. Abra [github.com/settings/personal-access-tokens/new](https://github.com/settings/personal-access-tokens/new).
2. Em **Repository access**, marque *Only select repositories* → `empregadoremdia`.
3. Em **Permissions → Repository permissions**, coloque **Contents** em *Read and write* (grava o artigo) e **Actions** em *Read and write* (reconstrói o site). Sem a segunda, o texto entra no repositório e não vai ao ar.
4. Escolha a validade, gere e copie o token (começa com `github_pat_`).
5. Cole no campo do painel e clique em **Conectar**.

O token fica guardado só no navegador que você usou — nenhum outro servidor participa, o navegador fala direto com o GitHub. Marque "continuar conectado" apenas em computador seu; em máquina compartilhada, desmarque e ele some quando a aba fechar.

> Quando o token vencer, o painel avisa e pede um novo. Nada se perde.

O painel recusa três situações, antes de deixar entrar:

- **token de outra conta do GitHub** — só a conta dona do repositório é aceita;
- **token sem permissão de gravação** — recusado na porta, e não na hora de publicar o artigo já escrito;
- **sessão parada por mais de 30 minutos** — o token é apagado do navegador e é preciso conectar de novo. O prazo se renova sozinho enquanto você usa a página.

Sair do painel apaga também o rascunho guardado no navegador.

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
assets/calculadoras.js    fórmulas e interface da página /calculadoras/
assets/publicar.js        o painel /publicar/
tests/                    testes automatizados das fórmulas
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
