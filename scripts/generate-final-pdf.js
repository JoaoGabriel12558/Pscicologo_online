const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const root = path.resolve(__dirname, "..");
const outPath = path.join(root, "docs", "projeto-final.pdf");

const PAGE = { w: 595.28, h: 841.89 };
const M = 52;
const usableW = PAGE.w - M * 2;

function esc(text) {
  return String(text)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function latin(text) {
  return Buffer.from(text, "latin1");
}

function wrap(text, size, width) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = "";
  const avg = size * 0.52;
  const max = Math.max(18, Math.floor(width / avg));

  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > max && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }

  if (line) lines.push(line);
  return lines;
}

function readPng(file) {
  const data = fs.readFileSync(file);
  if (data.toString("ascii", 1, 4) !== "PNG") {
    throw new Error(`Arquivo nao e PNG: ${file}`);
  }

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let palette = null;
  let transparency = null;
  const idat = [];

  while (offset < data.length) {
    const length = data.readUInt32BE(offset);
    const type = data.toString("ascii", offset + 4, offset + 8);
    const chunk = data.subarray(offset + 8, offset + 8 + length);

    if (type === "IHDR") {
      width = chunk.readUInt32BE(0);
      height = chunk.readUInt32BE(4);
      bitDepth = chunk[8];
      colorType = chunk[9];
    } else if (type === "IDAT") {
      idat.push(chunk);
    } else if (type === "PLTE") {
      palette = chunk;
    } else if (type === "tRNS") {
      transparency = chunk;
    } else if (type === "IEND") {
      break;
    }

    offset += 12 + length;
  }

  if (bitDepth !== 8 || ![2, 3, 6].includes(colorType)) {
    throw new Error(`PNG nao suportado: bitDepth=${bitDepth}, colorType=${colorType}`);
  }

  const channels = colorType === 6 ? 4 : colorType === 2 ? 3 : 1;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const rgb = Buffer.alloc(width * height * 3);
  let src = 0;
  let dst = 0;
  let prev = Buffer.alloc(stride);

  for (let y = 0; y < height; y += 1) {
    const filter = raw[src];
    src += 1;
    const row = Buffer.from(raw.subarray(src, src + stride));
    src += stride;

    for (let i = 0; i < stride; i += 1) {
      const left = i >= channels ? row[i - channels] : 0;
      const up = prev[i] || 0;
      const upLeft = i >= channels ? prev[i - channels] || 0 : 0;
      let value = row[i];

      if (filter === 1) value = (value + left) & 255;
      if (filter === 2) value = (value + up) & 255;
      if (filter === 3) value = (value + Math.floor((left + up) / 2)) & 255;
      if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        const predictor = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
        value = (value + predictor) & 255;
      }

      row[i] = value;
    }

    for (let x = 0; x < width; x += 1) {
      let r = row[x * channels];
      let g = row[x * channels + 1];
      let b = row[x * channels + 2];
      let a = channels === 4 ? row[x * channels + 3] / 255 : 1;

      if (colorType === 3) {
        const index = row[x];
        r = palette[index * 3];
        g = palette[index * 3 + 1];
        b = palette[index * 3 + 2];
        a = transparency && transparency[index] !== undefined ? transparency[index] / 255 : 1;
      }
      rgb[dst++] = Math.round(r * a + 255 * (1 - a));
      rgb[dst++] = Math.round(g * a + 255 * (1 - a));
      rgb[dst++] = Math.round(b * a + 255 * (1 - a));
    }

    prev = row;
  }

  return { width, height, data: zlib.deflateSync(rgb) };
}

function readJpeg(file) {
  const data = fs.readFileSync(file);
  if (data[0] !== 0xff || data[1] !== 0xd8) {
    throw new Error(`Arquivo nao e JPEG: ${file}`);
  }

  let offset = 2;
  while (offset < data.length) {
    while (data[offset] === 0xff) offset += 1;
    const marker = data[offset++];
    const length = data.readUInt16BE(offset);

    if (marker >= 0xc0 && marker <= 0xc3) {
      const height = data.readUInt16BE(offset + 3);
      const width = data.readUInt16BE(offset + 5);
      return { width, height, data, format: "jpeg" };
    }

    offset += length;
  }

  throw new Error(`Dimensoes JPEG nao encontradas: ${file}`);
}

class PageBuilder {
  constructor() {
    this.parts = [];
    this.y = PAGE.h - M;
  }

  text(text, x, y, size = 11, font = "F1", color = "0 0 0") {
    this.parts.push(`BT /${font} ${size} Tf ${color} rg ${x.toFixed(2)} ${y.toFixed(2)} Td (${esc(text)}) Tj ET\n`);
  }

  paragraph(text, size = 10.5, gap = 5) {
    for (const line of wrap(text, size, usableW)) {
      this.text(line, M, this.y, size);
      this.y -= size + 4;
    }
    this.y -= gap;
  }

  heading(text) {
    this.y -= 8;
    this.text(text, M, this.y, 16, "F2", "0.09 0.42 0.53");
    this.y -= 24;
  }

  subheading(text) {
    this.text(text, M, this.y, 12.5, "F2");
    this.y -= 18;
  }

  bullet(text) {
    for (const [idx, line] of wrap(text, 10.5, usableW - 18).entries()) {
      this.text(idx === 0 ? `• ${line}` : `  ${line}`, M + 8, this.y, 10.5);
      this.y -= 14.5;
    }
  }

  table(rows, colWidths = [70, usableW - 70]) {
    for (const row of rows) {
      const startY = this.y;
      const lineSets = row.map((cell, index) => wrap(cell, 9.5, colWidths[index] - 12));
      const rowH = Math.max(...lineSets.map((lines) => lines.length)) * 13 + 10;
      let x = M;

      this.parts.push(`0.82 0.88 0.92 RG ${M} ${(startY - rowH + 8).toFixed(2)} ${usableW} ${rowH} re S\n`);

      row.forEach((cell, index) => {
        if (index > 0) {
          this.parts.push(`${x.toFixed(2)} ${(startY - rowH + 8).toFixed(2)} m ${x.toFixed(2)} ${(startY + 8).toFixed(2)} l S\n`);
        }
        lineSets[index].forEach((line, lineIndex) => {
          this.text(line, x + 6, startY - 8 - lineIndex * 13, 9.5, row[0] === "Código" || row[0] === "Semana" ? "F2" : "F1");
        });
        x += colWidths[index];
      });

      this.y -= rowH;
    }
    this.y -= 8;
  }

  image(name, x, y, w, h) {
    this.parts.push(`q ${w.toFixed(2)} 0 0 ${h.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm /${name} Do Q\n`);
  }

  stream() {
    return Buffer.from(this.parts.join(""), "latin1");
  }
}

const pages = [];
const images = [
  ["ImUseCase", path.join(root, "docs", "assets", "caso-de-uso.png"), "png"],
  ["ImMer", path.join(root, "docs", "assets", "modelo-entidade-relacionamento.png"), "png"],
  ["ImClasses", path.join(root, "docs", "assets", "diagrama-de-classes.png"), "png"],
  ["ImLayoutBg", path.join(root, "docs", "assets", "layout-sugerido", "layout-01.jpg"), "jpeg"],
  ["ImLayoutAtendimento", path.join(root, "docs", "assets", "layout-sugerido", "layout-03.jpg"), "jpeg"],
  ["ImLayoutProfissional", path.join(root, "docs", "assets", "layout-sugerido", "layout-02.jpg"), "jpeg"]
].map(([name, file, format]) => ({
  name,
  ...(format === "jpeg" ? readJpeg(file) : { ...readPng(file), format: "png" })
}));

function addPage(build) {
  const page = new PageBuilder();
  build(page);
  pages.push(page);
}

addPage((p) => {
  p.text("Projeto Integrador", M, 590, 30, "F2", "0.09 0.42 0.53");
  p.text("Plataforma de Atendimento Psicológico Online", M, 550, 20, "F1");
  p.text("Desenvolvimento de Sistemas Orientado a Dispositivos Móveis e Baseados na Web", M, 500, 11);
  p.text("Prova de Conceito e Documentação Final", M, 480, 11);
  p.text("2026", M, 450, 11);
});

addPage((p) => {
  p.heading("1. Introdução");
  p.paragraph("O presente projeto tem como objetivo o desenvolvimento de uma plataforma web para atendimento psicológico online, permitindo a conexão entre pacientes e psicólogos de forma prática, segura e acessível. A proposta busca ampliar o acesso aos serviços de saúde mental por meio de um ambiente digital no qual os usuários possam realizar cadastros, agendar consultas e acompanhar seus atendimentos sem a necessidade de deslocamento físico.");
  p.paragraph("A plataforma foi planejada com foco em usabilidade, segurança e organização das informações. Pacientes podem localizar profissionais disponíveis e agendar consultas de forma intuitiva, enquanto psicólogos podem gerenciar seus horários, visualizar atendimentos marcados e confirmar consultas.");
  p.heading("2. Objetivo do Projeto");
  ["Cadastro de pacientes e psicólogos.", "Autenticação de usuários.", "Gerenciamento de perfis.", "Definição de horários disponíveis pelos psicólogos.", "Agendamento, confirmação e cancelamento de consultas.", "Troca de mensagens entre pacientes e psicólogos."].forEach((item) => p.bullet(item));
  p.heading("3. Requisitos Funcionais");
  p.table([
    ["Código", "Descrição"],
    ["RF01", "Permitir cadastro de pacientes."],
    ["RF02", "Permitir cadastro de psicólogos."],
    ["RF03", "Permitir login com e-mail e senha."],
    ["RF04", "Permitir atualização de perfil."],
    ["RF05", "Permitir que psicólogos definam horários disponíveis."],
    ["RF06", "Permitir listagem de psicólogos."],
    ["RF07", "Permitir agendamento de consultas."],
    ["RF08", "Permitir visualização das consultas agendadas."],
    ["RF09", "Permitir cancelamento de consultas."],
    ["RF10", "Permitir confirmação da consulta pelo psicólogo."],
    ["RF11", "Permitir troca de mensagens entre usuários."],
    ["RF12", "Permitir logout."]
  ]);
});

addPage((p) => {
  p.heading("4. Requisitos Não Funcionais");
  p.table([
    ["Código", "Descrição"],
    ["RNF01", "Interface responsiva para dispositivos móveis e desktop."],
    ["RNF02", "Senhas armazenadas com criptografia."],
    ["RNF03", "Autenticação via JWT."],
    ["RNF04", "Tempo de resposta de até 3 segundos nas operações principais."],
    ["RNF05", "Compatibilidade com navegadores modernos."],
    ["RNF06", "Utilização de banco de dados relacional MySQL."],
    ["RNF07", "Código versionado no GitHub."]
  ]);
  p.heading("5. Descrição dos Principais Casos de Uso");
  p.subheading("Agendar Consulta");
  p.paragraph("Ator principal: Paciente. Objetivo: permitir ao paciente marcar uma consulta com um psicólogo. Pré-condições: paciente autenticado no sistema. Fluxo principal: seleciona o psicólogo, escolhe data e horário e confirma o agendamento. Pós-condições: consulta registrada no banco de dados. Fluxo alternativo: horário indisponível.");
  p.subheading("Realizar Login");
  p.paragraph("Ator principal: Paciente ou psicólogo. Objetivo: permitir acesso ao sistema. Pré-condições: usuário cadastrado. Fluxo principal: informa e-mail e senha; o sistema valida os dados e inicia a sessão com token JWT.");
  p.heading("6. Tecnologias Utilizadas");
  p.table([
    ["Camada", "Tecnologias"],
    ["Front-end", "HTML5, CSS3 e JavaScript"],
    ["Back-end", "Node.js e Express"],
    ["Banco", "MySQL"],
    ["Segurança", "JWT e bcryptjs"],
    ["Ferramentas", "Git, GitHub, Figma, MySQL Workbench e Visual Studio Code"]
  ], [95, usableW - 95]);
});

addPage((p) => {
  p.heading("7. Diagrama de Casos de Uso");
  p.paragraph("O diagrama apresenta os atores Paciente, Psicólogo e Administrador, além das principais funcionalidades disponíveis para cada perfil.");
  const img = images[0];
  const w = usableW;
  const h = w * img.height / img.width;
  p.image(img.name, M, PAGE.h - M - h - 52, w, h);
});

addPage((p) => {
  p.heading("8. Modelo Entidade-Relacionamento");
  p.paragraph("O MER define as entidades Perfil, Usuario, Disponibilidade, Consulta e Mensagem, com chaves primárias, chaves estrangeiras e cardinalidades.");
  const img = images[1];
  const w = usableW;
  const h = w * img.height / img.width;
  p.image(img.name, M, PAGE.h - M - h - 52, w, h);
});

addPage((p) => {
  p.heading("9. Diagrama de Classes");
  p.paragraph("O diagrama de classes representa os principais objetos de domínio, seus atributos, métodos e associações.");
  const img = images[2];
  const w = usableW;
  const h = w * img.height / img.width;
  p.image(img.name, M, PAGE.h - M - h - 52, w, h);
});

addPage((p) => {
  p.heading("10. Protótipos de Telas");
  ["Tela de login.", "Tela de cadastro.", "Dashboard do paciente.", "Lista de psicólogos.", "Tela de agendamento.", "Agenda do psicólogo.", "Tela de mensagens.", "Área de documentação com diagramas."].forEach((item) => p.bullet(item));
  p.heading("11. Layout Sugerido");
  p.paragraph("O projeto recebeu como referência visual o modelo Portal Terapia - Layout sugerido. A partir desse material, o front-end foi ajustado para utilizar paleta azul e teal, fotos humanizadas de atendimento, cards brancos, botões arredondados e navegação simples.");
  const bg = images.find((img) => img.name === "ImLayoutBg");
  const atendimento = images.find((img) => img.name === "ImLayoutAtendimento");
  p.image(bg.name, M, p.y - 128, 215, 128);
  p.image(atendimento.name, M + 230, p.y - 128, 215, 128);
  p.y -= 152;
  p.paragraph("O arquivo original foi preservado em entrega/originais e as imagens extraídas do modelo foram incorporadas ao protótipo web.");
  p.heading("12. Estrutura do Projeto");
  p.paragraph("A entrega foi organizada em quatro áreas principais: backend, web, docs e entrega/originais. O backend contém a API REST, o web contém o protótipo navegável, docs contém a documentação final e os diagramas, e entrega/originais preserva os arquivos usados como base.");
  p.heading("13. Configuração do Ambiente");
  p.paragraph("Para executar o backend, deve-se acessar a pasta backend, instalar as dependências com npm install, criar o arquivo .env a partir de .env.example, executar npm run db:setup e iniciar o servidor com npm run dev.");
  p.heading("14. Cronograma");
  p.table([
    ["Semana", "Atividade"],
    ["1", "Levantamento de requisitos."],
    ["2", "Modelagem de casos de uso, MER e classes."],
    ["3", "Protótipos de telas."],
    ["4", "Desenvolvimento do backend."],
    ["5", "Desenvolvimento do frontend."],
    ["6", "Testes e ajustes."],
    ["7", "Finalização da documentação."]
  ]);
});

addPage((p) => {
  p.heading("15. Prova de Conceito");
  ["Cadastro de usuários.", "Login com autenticação JWT no backend.", "Cadastro de disponibilidades.", "Agendamento de consultas.", "Cancelamento e confirmação de consultas.", "Envio de mensagens.", "Protótipo web navegável com persistência local."].forEach((item) => p.bullet(item));
  p.paragraph("Essas funcionalidades validam a viabilidade técnica da solução proposta e demonstram a arquitetura planejada para evolução futura.");
  p.heading("16. Conclusão");
  p.paragraph("O projeto propõe uma solução tecnológica para facilitar o acesso ao atendimento psicológico remoto. A plataforma oferece funcionalidades essenciais para conectar pacientes e psicólogos em um ambiente seguro, organizado e acessível. A Prova de Conceito demonstra que a arquitetura escolhida é adequada e permite futuras evoluções, como videochamadas, notificações automáticas, prontuário eletrônico e integração com meios de pagamento.");
});

const objects = [];
function addObject(data) {
  objects.push(data);
  return objects.length;
}

const font1 = addObject(Buffer.from("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"));
const font2 = addObject(Buffer.from("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"));

const imageIds = {};
for (const image of images) {
  const filter = image.format === "jpeg" ? "DCTDecode" : "FlateDecode";
  const header = Buffer.from(`<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /${filter} /Length ${image.data.length} >>\nstream\n`, "latin1");
  const footer = Buffer.from("\nendstream", "latin1");
  imageIds[image.name] = addObject(Buffer.concat([header, image.data, footer]));
}

const contentIds = pages.map((page) => {
  const stream = page.stream();
  return addObject(Buffer.concat([
    Buffer.from(`<< /Length ${stream.length} >>\nstream\n`, "latin1"),
    stream,
    Buffer.from("endstream", "latin1")
  ]));
});

const pageIds = [];
const pagesIdPlaceholder = "PAGES_ID";
for (let i = 0; i < pages.length; i += 1) {
  const resources = `/Font << /F1 ${font1} 0 R /F2 ${font2} 0 R >> /XObject << ${images.map((img) => `/${img.name} ${imageIds[img.name]} 0 R`).join(" ")} >>`;
  pageIds.push(addObject(Buffer.from(`<< /Type /Page /Parent ${pagesIdPlaceholder} 0 R /MediaBox [0 0 ${PAGE.w} ${PAGE.h}] /Resources << ${resources} >> /Contents ${contentIds[i]} 0 R >>`, "latin1")));
}

const pagesObjId = addObject(Buffer.from(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`, "latin1"));
const catalogId = addObject(Buffer.from(`<< /Type /Catalog /Pages ${pagesObjId} 0 R >>`, "latin1"));

for (const id of pageIds) {
  objects[id - 1] = Buffer.from(objects[id - 1].toString("latin1").replace(pagesIdPlaceholder, String(pagesObjId)), "latin1");
}

const parts = [Buffer.from("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n", "binary")];
const offsets = [0];
for (let i = 0; i < objects.length; i += 1) {
  offsets.push(parts.reduce((sum, part) => sum + part.length, 0));
  parts.push(Buffer.from(`${i + 1} 0 obj\n`, "latin1"));
  parts.push(objects[i]);
  parts.push(Buffer.from("\nendobj\n", "latin1"));
}

const xrefOffset = parts.reduce((sum, part) => sum + part.length, 0);
let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
for (let i = 1; i < offsets.length; i += 1) {
  xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
}
xref += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
parts.push(Buffer.from(xref, "latin1"));

fs.writeFileSync(outPath, Buffer.concat(parts));
console.log(outPath);
