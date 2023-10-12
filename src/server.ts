const { Buffer } = require("node:buffer");
import bodyParser from 'body-parser';
import crypto from 'node:crypto';
import express, {Express, Request, Response} from 'express';
import { verify } from '@depay/js-verify-signature';

const app: Express = express();
const port = 3000;
app.use(bodyParser.json());

//
// THE FOLLOWING PLACEHOLDERS NEED TO BE CONFIGURED!

// Identifies your integration
const integrationId:string = "SET_YOUR_INTEGRATION_ID";

// Used to verify communication from DePay APIs to your integration
// Provided by app.depay.com
// ENTER YOUR PUBLIC KEY HERE, FORMAT: "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA5P24ZAKJRkINGTroqKTD\nDLOIXtL1SK9uz6rTFjHBcQdD4zZIlrCIDqxvn1kUelbfR22iEj5RnoN1LRqil3zc\nQDWD03SLxEYHdrJ3zBwN9qJ9mBeEURdmcZOvVLoXug6yRapAqS457AXhAWsacX6j\n06cpN/wLazAZe31uZOb/3xphfe7+C+6NNFzZPi6a2Dt2eSOrRtK/JD6b04RomJKk\n21ptGCxG78kMZMv5m4qqMIP8slBxTzAiTCYNUXimNzAlI793aT2X2NOEaxAKhohT\nbSGJP2xJDvwB2ZuW+WkVPs5Q+uVo0imhlHpH/h7dP1J7JFZQY50HNjhutu3xY5Xm\niQIDAQAB\n-----END PUBLIC KEY-----"
const publicKey =  undefined;

// Used to sign & authenticate communication from your integration to DePay APIs
// Create and provide as documented here: https://depay.com/docs/payments/integrate/widget#create-privatepublic-key
const privateKey:any = process.env.MY_PRIVATE_KEY ? crypto.createPrivateKey(process.env.MY_PRIVATE_KEY.replace(/\\n/g, '\n')) : undefined;

app.get('/', (req: Request, res: Response)=>{

  const payload = {
    itemId: 1,
    quantity: 2,
    userId: '123'
  };

  res.send(`\
  <html>\
    <head>\
      <script defer async src="https://integrate.depay.com/widgets/v12.js"></script>\
    <head>\
    </head>\
    <body style="text-align: center; padding-top: 5rem;">\
      <button style="font-size: 3rem;" onClick="DePayWidgets.Payment({ integration: '${integrationId}', payload: '${JSON.stringify(payload).replace(/"/g, '&quot;')}' });">\
        Pay Now\
      </button>\
    </body>\
  </html>\
  `);
});

const verifyRequest = async(req: Request): Promise<boolean>=>{
  
  return await verify({
    signature: req.headers['x-signature'],
    data: req.body,
    publicKey,
  });
}

const getResponseSignature = (responseString: string): string=>{

  const signature = crypto.sign('sha256', Buffer.from(responseString), {
    key: privateKey,
    padding: crypto.constants.RSA_PKCS1_PSS_PADDING,
    saltLength: 64,
  });

  const urlSafeBase64Signature = signature.toString('base64')
    .replace('+', '-')
    .replace('/', '_')
    .replace(/=+$/, '');

  return urlSafeBase64Signature;
}

app.post('/depay/configuration', async(req: Request, res: Response)=>{

  if(!await verifyRequest(req)){
    return res.status(401).json({ error: "UNAUTHORIZED" });
  };

  const price = 1.00;

  const configuration = {
    accept: [
      { blockchain: 'ethereum', token: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', amount: price*req.body.quantity }
    ]
  };

  // If you need to dynamically set a redirect location after a successfull payment, set forward_to
  //
  // configuration.forward_to = "https://mydomain.com/payment/confirmation/SOMEID"
  //

  res.setHeader('x-signature', getResponseSignature(JSON.stringify(configuration)));
  res.status(200).json(configuration);
});

app.post('/depay/callback', async(req: Request, res: Response)=>{

  if(!await verifyRequest(req)){
    return res.status(401).json({ error: "UNAUTHORIZED" });
  };

  // Do whatever you need to do after a succesfull payment
  //
  // req.body:
  //
  // {
  //   "blockchain": "polygon",
  //   "transaction": "0x053279fcb2f52fd66a9367416910c0bf88ae848dca769231098c4d9e240fcf56",
  //   "sender": "0x317D875cA3B9f8d14f960486C0d1D1913be74e90",
  //   "receiver": "0x08B277154218CCF3380CAE48d630DA13462E3950",
  //   "token": "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
  //   "amount": "0.0985",
  //   "payload": null,
  //   "after_block": "46934392",
  //   "commitment": "confirmed",
  //   "confirmations": 1,
  //   "created_at": "2023-08-30T11:37:30.157555Z",
  //   "confirmed_at": "2023-08-30T11:37:35.492041Z"
  // }

  const responseData = {};

  // If you need to dynamically set a redirect location:
  //
  // responseData.forward_to = "https://mydomain.com/payment/confirmation/SOMEID"
  //

  res.setHeader('x-signature', getResponseSignature(JSON.stringify(responseData)));
  res.status(200).json(responseData);
});

app.listen(port, ()=> {
  console.log(`[Server]: I am running at https://localhost:${port}`);
});
