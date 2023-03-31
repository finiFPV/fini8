/* eslint-env es6 */
const { stat, writeFile, appendFile, readFile } = require('fs')
const express = require('express');
const bodyParser = require('body-parser');
const { MongoClient } = require('mongodb');
const { pbkdf2, timingSafeEqual, randomBytes } = require('crypto');
const dotEnv = require('dotenv').config({path: './.env'});
const nodeMailer = require('nodemailer');
const compression = require('compression');
const { createServer } = require("https");

const HTTP_PORT = process.env.HTTP_PORT || 80;
const dir = __dirname + "/fini8";
const indexRoutes = ['/', '/login', '/404', '/verify', '/md'];
const credentailsMinLength = {email: 6, pswd: 6};
const WEBSITE = "fini8.eu";
const logiFles = ["./request.log", "./error.log"];
class Loging {
    time() {
        const dateTime = new Date();
        return "[ " + ("0" + dateTime.getDate()).slice(-2) + "/" + ("0" + (dateTime.getMonth() + 1)).slice(-2) + "/" + dateTime.getFullYear() +
        "-" + dateTime.getHours() + ":" + dateTime.getMinutes() + ":" + dateTime.getSeconds() + " ]";
    }
    error(err, msg = "MongoDB connection refused", type = "MongoDB") {
        if (process.env.DEBUG === "true") appendFile("./error.log", `${this.time()} ${type} Error: ${msg}: ` + err, (err) => {if (err) console.error(err)});
        console.error(`${this.time()} ${type} Error: ${msg}: ` + err);
    }
    log(message) {msg = `${this.time()} ${message}`; console.log(msg); appendFile("./request.log", (msg) + "\n", (err) => {if (err) console.error(err)})};
}
const parseVerifyEmailTemplate = (code, verifyLink, callback) => {
    readFile(__dirname + "/serverAssets/verifyEmail.html", "utf8", (err, data) => {
        if (err) return logging.error(err, "Error reading verifyEmail.html", "File");
        let template = data;
        for (const [key, value] of Object.entries({
            "code0": code[0], "code1": code[1], "code2": code[2], "code3": code[3], "code4": code[4], "code5": code[5],
            "buttonLink": verifyLink, "altLink": verifyLink, "website": WEBSITE, "supportEmail": process.env.SUPPORT_EMAIL
        })) {template = template.replace((new RegExp(`{{${key}}}`, 'g')), value)}
        callback(template);
    });
}

const logging = new Loging;
const app = express();
const emailService = nodeMailer.createTransport({service: 'gmail', auth: {user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS}});
let mongoClient;

app.disable('x-powered-by');
//Headers
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', process.env.INSECURE_HTTP_ACCESS === undefined ?
        `${process.env.HTTP_MODE}://fini8.eu` : process.env.INSECURE_HTTP_ACCESS === "true" ? "*" : `${process.env.HTTP_MODE}://fini8.eu`);
    res.header('Access-Control-Allow-Methods', 'GET, POST');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});
// Rate Limiter
if (process.env.RATE_LIMIT_ENABLED === undefined ? true : process.env.RATE_LIMIT_ENABLED === "true") {
    const rateLimited = {}; const connected = {}; const suspended = [];
    const rateLimit = {requestsLimitTime: 15 * 1000, requestsLimit: 50, responseStatusCode: 429, rateLimitDeleteTime: 3 * 60 * 60 * 1000, rateLimitLimits: 3 , supendTime: 48 * 60 * 1000};
    app.use((req, res, next) => {
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        if (suspended.includes(ip)) return res.status(rateLimit.responseStatusCode).send("You have been suspended from making requests.");
        else if (connected[ip] === undefined) {
            connected[ip] = {requestsCounter: 1};
            setTimeout(() => {delete connected[ip]}, rateLimit.requestsLimitTime);
            if (rateLimited[ip] !== undefined && rateLimited[ip].rateLimited) return res.status(rateLimit.responseStatusCode).sendFile(__dirname + "/serverAssets/rateLimit.html");
            next()
        }
        else {
            const inRateLimited = rateLimited[ip] === undefined
            if (inRateLimited || (!inRateLimited && !rateLimited[ip].rateLimited)) connected[ip].requestsCounter++;
            if (inRateLimited) {
                if (connected[ip].requestsCounter > rateLimit.requestsLimit) {
                    rateLimited[ip] = {rateLimitsCounter: 1, rateLimited: true};
                    logging.log(`Rate limited IP: ${ip.substr(0, 7) == "::ffff:" ? ip.substr(7) : ip}`);
                    setTimeout(() => {delete rateLimited[ip]}, rateLimit.rateLimitDeleteTime);
                    setTimeout(() => {rateLimited[ip].rateLimited = false}, rateLimit.requestsLimitTime);
                    return res.status(rateLimit.responseStatusCode).sendFile(__dirname + "/serverAssets/rateLimit.html");
                }
                next();
            } else {
                if (rateLimited[ip].rateLimitsCounter > rateLimit.rateLimitLimits) {
                    suspended.push(ip);
                    logging.error(`Suspended IP: ${ip.substr(0, 7) == "::ffff:" ? ip.substr(7) : ip}`, "Too many requests", "Rate Limiter");
                    setTimeout(() => {delete suspended[ip]}, rateLimit.suspendTime);
                    return res.status(rateLimit.responseStatusCode).send("You have been temporarily suspended from making requests.");
                }
                else if (rateLimited[ip].rateLimited) return res.status(rateLimit.responseStatusCode).sendFile(__dirname + "/serverAssets/rateLimit.html");
                else if (!rateLimited[ip].rateLimited && connected[ip].requestsCounter > rateLimit.requestsLimit) {
                    rateLimited[ip].rateLimited = true; rateLimited[ip].rateLimitsCounter++;
                    setTimeout(() => {rateLimited[ip].rateLimited = false; delete connected[ip]}, rateLimit.requestsLimitTime);
                } else next();
            }
        }
    })
}

//Compression
app.use(compression());

app.use((req, res, next) => {if (req.method === 'OPTIONS') return res.status(200).json({}); next()});

//Body Parser
app.use(bodyParser.json());
//Logging
if (process.env.DEBUG === "true") {
    logiFles.forEach(file => stat(file, (err, stats) => {if (stats === undefined) writeFile(file, "", (err) => {if (err) console.error("file create err: " + err)})}));
    logiFles.forEach(file => appendFile(file, `\n\n\nServer Started Successfully ${logging.time()}\n\n\n`, (err) => {if (err) console.error("file write start err: " + err)}));
    app.use((req, res, next) => {
        let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        ip = ip.substr(0, 7) == "::ffff:" ? ip.substr(7) : ip;
        msg = logging.time() + " ( " + ip + " ) " + req.protocol + " " + req.method + " " + req.url + (JSON.stringify(req.body) === "{}" ? "" : (" {body: " + JSON.stringify(req.body)) + "}")
        console.log(msg);
        appendFile("./request.log", (msg) + "\n", (err) => {if (err) console.error(err)}); next();
    });
}

// Main Routes
indexRoutes.forEach(route => app.get(route, (req, res) => res.sendFile(dir + '/index.html')));

//Login and register data proccessing
app.post('/handle_data', async (req, res) => {
    if ((req.body["type"] === "login" || req.body["type"] === "register") && (!req.body.hasOwnProperty("data") ||
    !["email", "pswd"].every(key => req.body["data"].hasOwnProperty(key)) ||
    req.body["type"] === "register" && (req.body["data"]["email"].length < credentailsMinLength.email || req.body["data"]["pswd"].length < credentailsMinLength.pswd)
    )) return res.status(200).json({status: 400, accepted: false, message: "Bad Request"});
    if (req.body["type"] === "login") {
        const user = await mongoClient.findOne({email: {$eq: req.body["data"]["email"]}});
        if (user === null) return res.status(200).json({status: 401, accepted: false, message: "Invalid Credentials" });
        else if (user["email"] === req.body["data"]["email"]) {
            pbkdf2(req.body["data"]["pswd"], user["pswd"]["salt"], 1000000, 32, 'sha256', (err, derivedKey) => {
                if (timingSafeEqual(Buffer.from(user["pswd"]["hash"], 'hex'), derivedKey)) return res.status(200).json({status: 200, accepted: true, userData: user});
                else return res.status(200).json({status: 401, accepted: false, message: "Invalid Credentials"});
            });
        } else return res.status(200).json({status: 401, accepted: false, message: "Invalid Credentials"});
    } else if (req.body["type"] === "register") {
        const user = await mongoClient.findOne({email: {$eq: req.body["data"]["email"]}});
        if (user !== null) return res.status(200).json({status: 409, accepted: false, message: "Account With Given Credentials Already Exists"});
        else {
            const salt = randomBytes(Math.ceil(8)).toString('hex').slice(0, 16);
            await pbkdf2(req.body["data"]["pswd"], salt, 1000000, 32, 'sha256', async (err, derivedKey) => {
                const userData = {email: req.body["data"]["email"], pswd: {hash: derivedKey.toString('hex'), salt: salt}, emailVerified: false, activeVerification: null};
                await mongoClient.insertOne(userData);
                return res.status(200).json({status: 201, accepted: true, userData: userData});
            });
        }
    } else return res.status(200).json({status: 405, accepted: false, message: "Type Not Allowed"});
})

//Email verification system
app.post('/email', async (req, res) => {
    if ((req.body["type"] === "sendVerification" && (
        !req.body.hasOwnProperty("userData") || !["email", "pswdHash"].every(key => req.body["userData"].hasOwnProperty(key)) ||
        typeof req.body["userData"]["email"] !== "string" || typeof req.body["userData"]["pswdHash"] !== "string")) ||
        (req.body["type"] === "finishVerification" && !((req.body.hasOwnProperty("id") && typeof req.body["id"] === "string") ||
        ["code", "email"].every(key => req.body.hasOwnProperty(key) && typeof req.body[key] === "string"))) ||
        (req.body["type"] === "cheackVerification" && !req.body.hasOwnProperty("email") && typeof req.body["email"] === "string")
    ) return res.status(200).json({status: 400, accepted: false, message: "Bad Request"});
    if (req.body["type"] === "sendVerification") {
        const user = await mongoClient.findOne({email: {$eq: req.body["userData"]["email"]}});
        if (user === null) return res.status(200).json({status: 401, accepted: false, message: "Invalid Credentials"});
        if (!timingSafeEqual(Buffer.from(user["pswd"]["hash"], 'hex'), Buffer.from(req.body["userData"]["pswdHash"], 'hex'))) {
            return res.status(200).json({status: 401, accepted: false, message: "Invalid Credentials"});
        };
        if (user["emailVerified"] === true) return res.status(200).json({status: 409, accepted: false, message: "Email Already Verified"});
        if (user["activeVerification"] !== null) {
            parseVerifyEmailTemplate(user["activeVerification"]["code"], process.env.HTTP_MODE + "://" + WEBSITE + "/verify?token=" + user["activeVerification"]["id"], template => {
                emailService.sendMail({from: "fini8", to: user["email"], subject: "Confirm your account for fini8", html: template}, (err, data) => {
                    if(err) { logging.error(err, "", "Email"); return res.status(200).json({status: 500, accepted: false, message: "Internal Server Error"})}
                    else return res.status(200).json({status: 200, accepted: true, message: "Email Verification Sent"});
                });
            });
        } else {
            let id, code; let dataExists = true;
            while(dataExists) {
                id = randomBytes(8).toString('hex'); code = String(Math.floor(100000 + Math.random() * 900000));
                dataExists = (await mongoClient.findOne({$or: [{"activeVerification.id": id}, {"activeVerification.code": code}]})) !== null;
            };
            try {
                await mongoClient.updateOne({email: user["email"]}, {$set: {activeVerification: {id: id, code: code}}});
                parseVerifyEmailTemplate(code.split("").map(Number), process.env.HTTP_MODE + "://" + WEBSITE + "/verify?token=" + id, template => {
                    emailService.sendMail({from: "fini8", to: user["email"], subject: "Confirm your account for fini8", html: template}, (err, data) => {
                        if(err) {logging.error(err, "", "Email"); return res.status(200).json({status: 500, accepted: false, message: "Internal Server Error"})}
                        else return res.status(200).json({status: 200, accepted: true, message: "Email Verification Sent"});
                    });
                });
            }
            catch (error) {logging.error(error, "MongoDB document update refused"); return res.status(200).json({status: 500, accepted: false, message: "Internal Server Error"})}
        };
    } else if (req.body["type"] === "finishVerification") {
        if (req.body.hasOwnProperty("id")) {
            if (!(/[0-9A-Fa-f]{16}/.test(req.body.id))) return res.status(200).json({status: 400, accepted: false, message: "Id Not Valid"});
            else {
                await mongoClient.findOne({"activeVerification.id": {$eq: req.body.id}}).then(async (user) => {
                    const resp = await mongoClient.updateOne({"activeVerification.id": {$eq: req.body.id}}, {$set: {emailVerified: true, activeVerification: null}})
                    if (resp.matchedCount > 0 && resp.modifiedCount > 0 && resp.acknowledged) {
                        const len = user.email.indexOf("@"); const txtLen = Math.floor(len*.3);
                        return res.status(200).json({status: 200, accepted: true, email: "*".repeat(len-(txtLen>=4?4:txtLen)) + user.email.substring(len-(txtLen>=4?4:txtLen))});
                    }
                    else if (resp.matchedCount === 0) return res.status(200).json({status: 406, accepted: false, message: "Id Not Valid"});
                    else return res.status(200).json({status: 500, accepted: false, message: "Internal Error"});
                });
            }
        } else if (req.body.hasOwnProperty("code")) {
            if (!(/[0-9]{6}/.test(req.body.code))) return res.status(200).json({status: 400, accepted: false, message: "Code Not Valid"});
            else {
                await mongoClient.findOne({"email": {$eq: req.body.email}}).then(async (user) => {
                    if (user === null || user["activeVerification"]["code"] !== req.body.code) return res.status(200).json({status: 400, accepted: false, message: "Code Not Valid"});
                    const resp = await mongoClient.updateOne({"email": {$eq: req.body.email}}, {$set: {emailVerified: true, activeVerification: null}})
                    if (resp.matchedCount > 0 && resp.modifiedCount > 0 && resp.acknowledged) {
                        const len = user.email.indexOf("@"); const txtLen = Math.floor(len*.3);
                        return res.status(200).json({status: 200, accepted: true, email: "*".repeat(len-(txtLen>=4?4:txtLen)) + user.email.substring(len-(txtLen>=4?4:txtLen))});
                    }
                    else if (resp.matchedCount === 0 && user !== null) return res.status(200).json({status: 400, accepted: false, message: "Code Not Valid"});
                    else return res.status(200).json({status: 500, accepted: false, message: "Internal Error"});
                });
            }
        } else return res.status(200).json({status: 500, accepted: false, message: "Internal Server Error"});
    } else if (req.body["type"] === "cheackVerification") {
        const user = await mongoClient.findOne({email: {$eq: req.body["email"]}});
        if (user === null || !timingSafeEqual(Buffer.from(user["pswd"]["hash"], 'hex'), Buffer.from(req.body["pswdHash"], 'hex'))) return res.status(200).json({status: 400, accepted: false, message: "Invalid Credentials"});
        else if (user.emailVerified) return res.status(200).json({status: 200, accepted: true, message: "Email Verified", userData: user});
        else return res.status(200).json({status: 200, accepted: true, message: "Email Not Verified", userData: user});
    } else return res.status(200).json({status: 405, accepted: false, message: "Type Not Allowed"});
})

// Assets
app.get('/siteMap.xml', (req, res) => res.sendFile(__dirname + '/serverAssets/siteMap.xml'));
app.get('/robots.txt', (req, res) => res.sendFile(__dirname + '/serverAssets/robots.txt'));
app.get('/favicon.ico', (req, res) => res.sendFile(dir + '/favicon.ico'));
app.use('/staticAssets', express.static(dir));
app.use('/assets', express.static(dir + "/assets"));

app.use((req, res) => res.status(404).redirect("/404"));
app.listen(HTTP_PORT, async () => {
    if (process.env.HTTP_PORT === undefined) {
        try {const mongo = new MongoClient(process.env.MONGODB_URI); mongo.connect(); mongoClient = mongo.db("Website").collection('Users')}
        catch (error) {logging.error(error)};
        return console.log('Server running on port ' + HTTP_PORT);
    }
    createServer({
        key: process.env.HTTPS_KEY,
        cert: process.env.HTTPS_CERT},
    app).listen(process.env.HTTPS_PORT, async () => {
        console.log('Server running on port ' + HTTP_PORT + ' and ' + process.env.HTTPS_PORT);
        try {const mongo = new MongoClient(process.env.MONGODB_URI); mongo.connect(); mongoClient = mongo.db("Website").collection('Users')}
        catch (error) {logging.error(error)}
    });
});