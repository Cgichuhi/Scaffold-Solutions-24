const { Pool } = require("pg");

const pool = new Pool({
    host: "localhost",
    user: "postgres",
    password: "Element@l",
    database: "Scaffolding",
    port: 5432,
});

module.exports = pool;


