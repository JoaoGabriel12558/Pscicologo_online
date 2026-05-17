require("dotenv").config();

const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");

async function setup() {
  const sql = fs.readFileSync(path.join(__dirname, "database.sql"), "utf8");

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    multipleStatements: true
  });

  await connection.query(sql);
  await connection.end();

  console.log("Banco de dados configurado com sucesso.");
}

setup().catch((error) => {
  console.error("Erro ao configurar banco de dados:", error.message);
  process.exit(1);
});

