const keys = require("./keys");

////// Express App Setup
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");

// this app will rcv an rsp to http requests
const app = express();
// cors is cross origin resource sharing
app.use(cors());
app.use(bodyParser.json());

////// create and connect to Postgres
const { Pool } = require("pg");
const pgClient = new Pool({
    user: keys.pgUser,
    host: keys.pgHost,
    database: keys.pgDatabase,
    password: keys.pgPassword,
    port: keys.pgPort,
});

// create a table to store all of the values
pgClient.on("connect", (client) => {
    client
        .query("CREATE TABLE IF NOT EXISTS values (number INT)")
        .catch(err => console.error(err));
});

////// redis client setup
const redis = require("redis");
const redisClient = redis.createClient({
    host: keys.redisHost,
    port: keys.redisPort,
    password: keys.redisPassword,
    // try to reconnect to redis every 1 second
    retry_strategy: () => 1000,
});
const redisPublisher = redisClient.duplicate();

////// express route handlers
app.get("/", (req, res) => {
    res.send("hi");
});

// return all values in postgres
app.get("/values/all", async (req, res) => {
    const values = await pgClient.query("SELECT * from values");

    res.send(values.rows);
});

// redis doesn"t have promise support, so use callback instead
app.get("/values/current", async (req, res) => {
    redisClient.hgetall("values", (err, values) => {
    res.send(values);
    });
});

// get input from user
app.post("/values", async (req, res) => {
    const index = req.body.index;

    // don"t allow large index, because it takes too long
    if (parseInt(index) > 40) {
        return res.status(422).send("Index too high");
    }

    redisClient.hset("values", index, "Nothing yet!");
    // notify worker
    redisPublisher.publish("insert", index);
    pgClient.query("INSERT INTO values(number) VALUES($1)", [index]);

    res.send({ working: true });
});

app.listen(5000, err => {
    console.log("listening on 5000");
});



