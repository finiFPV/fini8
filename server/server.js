/* eslint-env es6 */
const { stat, writeFile, appendFile, readFile, readFileSync } = require('fs')
const express = require('express');
const bodyParser = require('body-parser');
const { MongoClient } = require('mongodb');
const { pbkdf2, timingSafeEqual, randomBytes } = require('crypto');
const dotEnv = require('dotenv').config({path: './serverAssets/.env'});
const nodeMailer = require('nodemailer');
const compression = require('compression');
const { createServer } = require("https");

const HTTP_PORT = process.env.HTTP_PORT || 80;
const HTTPS_PORT = process.env.HTTPS_PORT || 443;
const startedSuccessfully = false;
const dir = __dirname + "/fini8";
const indexRoutes = ['/', '/login', '/404', '/verify', '/under-construction'];
const credentailsMinLength = {email: 6, pswd: 6};
const WEBSITE = "fini8.eu";
const logiFles = ["./serverAssets/request.log", "./serverAssets/error.log"];
class Loging {
    time() {
        const dateTime = new Date();
        return "[ " + ("0" + dateTime.getDate()).slice(-2) + "/" + ("0" + (dateTime.getMonth() + 1)).slice(-2) + "/" + dateTime.getFullYear() +
        "-" + dateTime.getHours() + ":" + dateTime.getMinutes() + ":" + dateTime.getSeconds() + " ]";
    }
    error(err, msg = "MongoDB connection refused", type = "MongoDB") {
        if (process.env.DEBUG === "true") appendFile("./serverAssets/error.log", `${this.time()} ${type} Error: ${msg}: ` + err, (err) => {if (err) console.error(err)});
        console.error(`${this.time()} ${type} Error: ${msg}: ` + err);
    }
    log(message) {msg = `${this.time()} ${message}`; console.log(msg); appendFile("./serverAssets/request.log", (msg) + "\n", (err) => {if (err) console.error(err)})};
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

app.use((req, res, next) => {
    if (req.protocol !== process.env.HTTP_MODE) return res.redirect(301, process.env.HTTP_MODE+"://"+req.headers.host+req.url);
    next()
})

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
        appendFile("./serverAssets/request.log", (msg) + "\n", (err) => {if (err) console.error(err)}); next();
    });
}

// Main Routes
indexRoutes.forEach(route => app.get(route, (req, res) => res.sendFile(dir + '/index.html')));

//Login and register data proccessing
app.post('/handle_data', async (req, res) => {
    if (
        req.body["type"] === "login" && (!req.body.hasOwnProperty("data") || (typeof req.body["data"] !== "object" || Array.isArray(req.body["data"]) || req.body["data"] === null) ||
            !["email", "pswd"].every(key => req.body["data"].hasOwnProperty(key) && typeof req.body["data"][key] === "string")
        ) ||
        req.body["type"] === "register" && (
            (!req.body.hasOwnProperty("data") || (typeof req.body["data"] !== "object" || Array.isArray(req.body["data"]) || req.body["data"] === null) ||
            !["email", "pswd"].every(key => req.body["data"].hasOwnProperty(key) && typeof req.body["data"][key] === "string")) ||
            (req.body["data"]["email"].length < credentailsMinLength.email || req.body["data"]["pswd"].length < credentailsMinLength.pswd)
        )
    ) return res.status(200).json({status: 400, accepted: false, message: "Bad Request"});
    if (req.body["type"] === "login") {
        const user = await mongoClient.collection('Users').findOne({email: {$eq: req.body["data"]["email"]}});
        if (user === null) return res.status(200).json({status: 401, accepted: false, message: "Invalid Credentials" });
        else if (user["email"] === req.body["data"]["email"]) {
            pbkdf2(req.body["data"]["pswd"], user["pswd"]["salt"], 1000000, 32, 'sha256', async (err, derivedKey) => {
                if (timingSafeEqual(Buffer.from(user["pswd"]["hash"], 'hex'), derivedKey)) {
                    let session = await mongoClient.collection('Sessions').findOne({userDocumentID: {$eq: user._id}, userAgent: {$eq: req.get('User-Agent')}});
                    if (session === null) {
                        await pbkdf2(user._id.id.toString('hex'), randomBytes(Math.ceil(8)).toString('hex').slice(0, 16), 1000, 32, 'sha256', async (err, derivedKey) => {
                            token = derivedKey.toString('hex');
                            await mongoClient.collection('Sessions').insertOne({userDocumentID: user._id, userAgent: req.get('User-Agent'), createdAt: new Date(), token: token});
                            return res.status(200).json({status: 200, accepted: true, authToken: token});
                        });
                    } else return res.status(200).json({status: 200, accepted: true, authToken: session.token});
                }
                else return res.status(200).json({status: 401, accepted: false, message: "Invalid Credentials"});
            });
        } else return res.status(200).json({status: 401, accepted: false, message: "Invalid Credentials"});
    } else if (req.body["type"] === "register") {
        const user = await mongoClient.collection('Users').findOne({email: {$eq: req.body["data"]["email"]}});
        if (user !== null) return res.status(200).json({status: 409, accepted: false, message: "Account With Given Credentials Already Exists"});
        else {
            const salt = randomBytes(Math.ceil(8)).toString('hex').slice(0, 16);
            await pbkdf2(req.body["data"]["pswd"], salt, 1000000, 32, 'sha256', async (err, derivedKey) => {
                const regResults = await mongoClient.collection('Users').insertOne(
                    {email: req.body["data"]["email"], pswd: {hash: derivedKey.toString('hex'), salt: salt}, emailVerified: false, activeVerification: null}
                );
                await pbkdf2(regResults.insertedId.id.toString('hex'), randomBytes(Math.ceil(8)).toString('hex').slice(0, 16), 1000, 32, 'sha256', async (err, derivedKey) => {
                    token = derivedKey.toString('hex')
                    await mongoClient.collection('Sessions').insertOne({userDocumentID: regResults.insertedId, userAgent: req.get('User-Agent'), createdAt: new Date(), token: token});
                    return res.status(200).json({status: 201, accepted: true, authToken: token});
                });
            });
        }
    } else return res.status(200).json({status: 405, accepted: false, message: "Type Not Allowed"});
})

//Email verification system
app.post('/email', async (req, res) => {
    if (
        (req.body["type"] === "sendVerification" || req.body["type"] === "cheackVerification") && (!req.body.hasOwnProperty("authToken") || typeof req.body["authToken"] !== "string") ||
        req.body["type"] === "finishVerification" && !(
            (req.body.hasOwnProperty("id") && typeof req.body["id"] === "string") || ["code", "authToken"].every(key => req.body.hasOwnProperty(key) && typeof req.body[key] === "string")
        )
    ) return res.status(200).json({status: 400, accepted: false, message: "Bad Request"});
    if (req.body["type"] === "sendVerification") {
        const session = await mongoClient.collection('Sessions').findOne({token: {$eq: req.body["authToken"]}});
        if (session === null) return res.status(200).json({status: 401, accepted: false, message: "Invalid Session Token"});
        const user = await mongoClient.collection('Users').findOne({_id: {$eq: session["userDocumentID"]}});
        if (user["emailVerified"] === true) return res.status(200).json({status: 409, accepted: false, message: "Email Already Verified"});
        const send = (code, id) => {
            parseVerifyEmailTemplate(code, process.env.HTTP_MODE + "://" + WEBSITE + "/verify?token=" + id, template => {
                emailService.sendMail({from: {name: "fini8", address: "noreply@fini8.eu"}, to: user["email"], subject: "Confirm your account for fini8", html: template}, (err, data) => {
                    if(err) {logging.error(err, "", "Email"); return res.status(200).json({status: 500, accepted: false, message: "Internal Server Error"})}
                    else return res.status(200).json({status: 200, accepted: true});
                });
            });
        }
        if (user["activeVerification"] !== null) send(user["activeVerification"]["code"], user["activeVerification"]["id"])
        else {
            let id, code; let dataExists = true;
            while(dataExists) {
                id = randomBytes(8).toString('hex'); code = String(Math.floor(100000 + Math.random() * 900000));
                dataExists = (await mongoClient.collection('Users').findOne({$or: [{"activeVerification.id": {$eq: id}}, {"activeVerification.code": {$eq: code}}]})) !== null;
            };
            try { await mongoClient.collection('Users').updateOne({email: user["email"]}, {$set: {activeVerification: {id: id, code: code}}}); send(code.split("").map(Number), id)}
            catch (error) {logging.error(error, "MongoDB document update refused"); return res.status(200).json({status: 500, accepted: false, message: "Internal Server Error"})}
        };
    } else if (req.body["type"] === "finishVerification") {
        if (req.body.hasOwnProperty("id")) {
            if (!(/[0-9A-Fa-f]{16}/.test(req.body.id))) return res.status(200).json({status: 400, accepted: false, message: "Id Not Valid"});
            const session = await mongoClient.collection('Sessions').findOne({token: {$eq: req.body["authToken"]}});
            if (session === null) return res.status(200).json({status: 401, accepted: false, message: "Invalid Session Token"});
            await mongoClient.collection('Users').findOne({_id: {$eq: session["userDocumentID"]}}).then(async (user) => {
                if (user["activeVerification"] === null || user["activeVerification"]["id"] !== req.body.id) return res.status(200).json({status: 406, accepted: false, message: "Id Not Valid"});
                await mongoClient.collection('Users').updateOne({_id: {$eq: session["userDocumentID"]}}, {$set: {emailVerified: true, activeVerification: null}})
                const len = user.email.indexOf("@"); const txtLen = Math.floor(len*.3);
                return res.status(200).json({status: 200, accepted: true, requestedData: "*".repeat(len-(txtLen>=4?4:txtLen)) + user.email.substring(len-(txtLen>=4?4:txtLen))});
            });
        } else if (req.body.hasOwnProperty("code")) {
            if (!(/[0-9]{6}/.test(req.body.code))) return res.status(200).json({status: 400, accepted: false, message: "Code Not Valid"});
            else {
                const session = await mongoClient.collection('Sessions').findOne({token: {$eq: req.body["authToken"]}});
                if (session === null) return res.status(200).json({status: 401, accepted: false, message: "Invalid Session Token"});
                await mongoClient.collection('Users').findOne({_id: {$eq: session["userDocumentID"]}}).then(async (user) => {
                    if (user["activeVerification"] === null || user["activeVerification"]["code"] !== req.body.code) return res.status(200).json({status: 406, accepted: false, message: "Code Not Valid"});
                    await mongoClient.collection('Users').updateOne({_id: {$eq: session["userDocumentID"]}}, {$set: {emailVerified: true, activeVerification: null}})
                    const len = user.email.indexOf("@"); const txtLen = Math.floor(len*.3);
                    return res.status(200).json({status: 200, accepted: true, requestedData: "*".repeat(len-(txtLen>=4?4:txtLen)) + user.email.substring(len-(txtLen>=4?4:txtLen))});
                });
            }
        } else return res.status(200).json({status: 500, accepted: false, message: "Internal Server Error"});
    } else if (req.body["type"] === "cheackVerification") {
        const session = await mongoClient.collection('Sessions').findOne({token: {$eq: req.body["authToken"]}});
        if (session === null) return res.status(200).json({status: 401, accepted: false, message: "Invalid Session Token"});
        return res.status(200).json({status: 200, accepted: true, requestedData: (await mongoClient.collection('Users').findOne({_id: {$eq: session["userDocumentID"]}}))["emailVerified"]});;
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
    console.log(`HTTP server running on port ${HTTP_PORT}`);
    const httpsOptions = process.env.HTTP_MODE === "https" ? {key: readFileSync(__dirname + '/serverAssets/privkey.pem'), cert: readFileSync(__dirname + '/serverAssets/fullchain.pem')} : {};
    createServer(httpsOptions, app).listen(HTTPS_PORT, async () => {
        console.log(`HTTPS server running on port ${HTTPS_PORT}`);
        try {
            const mongo = new MongoClient(process.env.MONGODB_URI);
            await mongo.connect();
            mongoClient = mongo.db("Website");
            console.log('Connected to MongoDB');
        } catch (error) {logging.error(error)};
    });
});