import * as crypto from "node:crypto";
import * as fs from "node:fs";
import path from "node:path";

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 4096,
    publicKeyEncoding: {
        type: 'spki',
        format: 'pem',
    },
    privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
    }
});

const __dirname = new URL('.', import.meta.url).pathname;

fs.writeFileSync(path.join(__dirname, 'private.pem'), privateKey);
fs.writeFileSync(path.join(__dirname, 'public.pem'), publicKey);
