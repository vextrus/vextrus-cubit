/**
 * A loopback S3-compatible server, for proving SEAM-STORAGE's two drivers are one contract.
 *
 * The Increment Spec's test contract names this file and this export: `startS3Fake()` hands
 * back the env a caller assigns to `process.env` plus the endpoint it is pointed at, and the
 * seam — which reads its env at every call — then talks to it exactly as it would talk to
 * S3. Nothing here is the product: the fake is a stand-in for a bucket, so the same contract
 * suite can run twice and the two drivers can be held to the same answers.
 *
 * Four behaviours are the point, because two acceptance criteria rest on them:
 *
 *   1. The bucket is PRIVATE. An object read that carries no signature at all — neither a
 *      presigned query nor the SigV4 `Authorization` header the seam's own calls sign with —
 *      is refused 403 `AccessDenied`, as real S3 refuses an anonymous GET. R-SPINE-021's
 *      "signed download URLs" and Q-12's "signed URLs expire" are access-control clauses, and
 *      they are only real properties if an unsigned read is refused; a fake that answered one
 *      with 200 would make signing decoration and let a URL stripped of its signature serve.
 *   2. A presigned GET is *verified*, by recomputing SigV4 over the request as it arrived —
 *      not by trusting that a signature is present. A URL whose key, expiry or signature has
 *      been edited therefore fails here the way it would fail at a real bucket.
 *   3. The signature is checked BEFORE the expiry (AC-2). Real S3 does the same, and it is
 *      what makes a forged `X-Amz-Expires` a rejected URL rather than an extended one.
 *   4. The error *text* mirrors S3's, because the seam maps a response to a refusal code by
 *      what the bucket said: `SignatureDoesNotMatch` and `Request has expired` are the two
 *      sentences that separate STORAGE_URL_INVALID from STORAGE_URL_EXPIRED.
 *
 * The recomputation deliberately works from the raw request line rather than from a parsed
 * and re-encoded URL: S3 signs the path and query string as the client wrote them, so the
 * bytes that arrived are the canonical form, and no decode/re-encode round trip can drift
 * from what the presigner signed. Two payload hashes are tried because a presigned GET is
 * signed with `UNSIGNED-PAYLOAD` and some signers use the hash of an empty body; a tampered
 * signature matches neither, so trying both widens what is accepted without weakening what
 * is refused.
 *
 * There is no DELETE. R-SPINE-021 retains every revision forever, and a fake that answered
 * one would let a seam grow a deletion path no test would notice.
 */
import { createHash, createHmac } from 'node:crypto';
import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Socket } from 'node:net';

/** The bucket the fake serves, path-style: every request path starts `/${BUCKET}/`. */
const BUCKET = 'cubit-objects';

/** Credentials and region are the fake's own; they only have to match what it signs with. */
const REGION = 'us-east-1';
const ACCESS_KEY_ID = 'CUBITFAKEACCESSKEYID';
const SECRET_ACCESS_KEY = 'cubit-fake-secret-access-key';

const SERVICE = 's3';
const ALGORITHM = 'AWS4-HMAC-SHA256';

/** Seconds are the unit S3 signs in; the divisor is named so it is not read as a factor. */
const MILLIS_PER_SECOND = 1_000;

/** The payload hashes a presigned GET may have been signed with (see the file header). */
const PAYLOAD_HASHES = ['UNSIGNED-PAYLOAD', createHash('sha256').update('').digest('hex')];

/** What a caller gets: the env to assign, where the fake listens, and how to stop it. */
export interface S3Fake {
  /** `CUBIT_STORAGE_DRIVER=s3` and the five `CUBIT_S3_*` vars, pointed at this server. */
  readonly env: Record<string, string>;
  /** `http://127.0.0.1:<port>` — the same value as `CUBIT_S3_ENDPOINT`. */
  readonly endpoint: string;
  /** Stop listening and drop every kept-alive socket, so the test process can exit. */
  close(): Promise<void>;
}

/** The presigned-GET parameters, decoded. `undefined` when the URL carries no signature. */
interface Presigned {
  readonly signature: string;
  readonly amzDate: string;
  readonly credential: string;
  readonly signedHeaders: string;
  readonly expiresIn: number;
}

function sha256Hex(data: string | Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac('sha256', key).update(data, 'utf8').digest();
}

/** The four-step SigV4 key: secret, then date, region, service, terminator. */
function signingKey(dateStamp: string, region: string): Buffer {
  const forDate = hmac(`AWS4${SECRET_ACCESS_KEY}`, dateStamp);
  const forRegion = hmac(forDate, region);
  const forService = hmac(forRegion, SERVICE);
  return hmac(forService, 'aws4_request');
}

function presignedParams(rawQuery: string): Presigned | undefined {
  const params = new URLSearchParams(rawQuery);
  const signature = params.get('X-Amz-Signature');
  if (signature === null) return undefined;
  return {
    signature,
    amzDate: params.get('X-Amz-Date') ?? '',
    credential: params.get('X-Amz-Credential') ?? '',
    signedHeaders: params.get('X-Amz-SignedHeaders') ?? 'host',
    expiresIn: Number.parseInt(params.get('X-Amz-Expires') ?? '', 10),
  };
}

/**
 * The canonical query string: every pair as it arrived, minus the signature itself, sorted.
 * The pairs are already percent-encoded by the signer, which is the encoding SigV4 wants.
 */
function canonicalQuery(rawQuery: string): string {
  return rawQuery
    .split('&')
    .filter((pair) => pair !== '' && !pair.startsWith('X-Amz-Signature='))
    .map((pair) => (pair.includes('=') ? pair : `${pair}=`))
    .sort()
    .join('&');
}

function canonicalHeaders(req: IncomingMessage, signedHeaders: string): string {
  return signedHeaders
    .split(';')
    .map((name) => {
      const raw = req.headers[name];
      const value = Array.isArray(raw) ? raw.join(',') : (raw ?? '');
      return `${name}:${value.trim()}\n`;
    })
    .join('');
}

function signatureMatches(
  req: IncomingMessage,
  rawPath: string,
  rawQuery: string,
  presigned: Presigned,
): boolean {
  const parts = presigned.credential.split('/');
  const [, dateStamp = '', region = ''] = parts;
  const scope = parts.slice(1).join('/');
  const headers = canonicalHeaders(req, presigned.signedHeaders);
  const query = canonicalQuery(rawQuery);
  const method = req.method ?? 'GET';
  const key = signingKey(dateStamp, region);

  for (const payloadHash of PAYLOAD_HASHES) {
    const canonicalRequest = [
      method,
      rawPath,
      query,
      headers,
      presigned.signedHeaders,
      payloadHash,
    ].join('\n');
    const stringToSign = [ALGORITHM, presigned.amzDate, scope, sha256Hex(canonicalRequest)].join(
      '\n',
    );
    if (createHmac('sha256', key).update(stringToSign).digest('hex') === presigned.signature) {
      return true;
    }
  }
  return false;
}

/**
 * Does this request carry SigV4 in an `Authorization` header? The seam's own calls — `put`
 * and `get`, made through the SDK client — sign that way rather than in the query, so the
 * private bucket has to honour them. The check is deliberately shallow: it asks whether the
 * caller presented this bucket's credential under this algorithm, which is what separates the
 * seam from an anonymous reader. Recomputing a header signature would additionally have to
 * reproduce the SDK's payload-signing choices (whole-buffer, `STREAMING-…`, `aws-chunked`),
 * and a mismatch there would refuse a request that a real bucket accepts.
 */
function hasSignedAuthorization(req: IncomingMessage): boolean {
  const header = String(req.headers.authorization ?? '');
  return header.startsWith(`${ALGORITHM} `) && header.includes(`Credential=${ACCESS_KEY_ID}/`);
}

/** `YYYYMMDDTHHMMSSZ` to unix seconds; `undefined` when the parameter is not that shape. */
function amzDateSeconds(amzDate: string): number | undefined {
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(amzDate);
  if (match === null) return undefined;
  const [, year = '', month = '', day = '', hour = '', minute = '', second = ''] = match;
  const millis = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  );
  return Math.floor(millis / MILLIS_PER_SECOND);
}

function hasExpired(presigned: Presigned): boolean {
  const signedAt = amzDateSeconds(presigned.amzDate);
  if (signedAt === undefined || !Number.isFinite(presigned.expiresIn)) return false;
  return Math.floor(Date.now() / MILLIS_PER_SECOND) > signedAt + presigned.expiresIn;
}

function errorXml(code: string, message: string): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<Error><Code>${code}</Code><Message>${message}</Message>`,
    '<RequestId>cubit-fake</RequestId><HostId>cubit-fake</HostId></Error>',
  ].join('');
}

function refuse(res: ServerResponse, status: number, code: string, message: string): void {
  const body = errorXml(code, message);
  res.writeHead(status, {
    'content-type': 'application/xml',
    'content-length': String(Buffer.byteLength(body)),
    'x-amz-request-id': 'cubit-fake',
  });
  res.end(body);
}

/**
 * `aws-chunked` bodies, unwrapped. A whole-buffer PUT is sent raw, but a client that decides
 * to stream frames it as `<hex-size>;chunk-signature=…\r\n<bytes>\r\n`, and storing those
 * frames would content-address the framing rather than the object.
 */
function dechunk(body: Buffer): Buffer {
  const parts: Buffer[] = [];
  let offset = 0;
  for (;;) {
    const headerEnd = body.indexOf('\r\n', offset);
    if (headerEnd === -1) break;
    const header = body.toString('latin1', offset, headerEnd);
    const size = Number.parseInt(header.split(';')[0] ?? '', 16);
    if (!Number.isFinite(size) || size === 0) break;
    const start = headerEnd + 2;
    parts.push(body.subarray(start, start + size));
    offset = start + size + 2;
  }
  return Buffer.concat(parts);
}

async function readBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const body = Buffer.concat(chunks);
  const encoding = String(req.headers['content-encoding'] ?? '');
  const contentSha = String(req.headers['x-amz-content-sha256'] ?? '');
  if (encoding.includes('aws-chunked') || contentSha.startsWith('STREAMING-')) return dechunk(body);
  return body;
}

/** The object key a path-style request names, or `undefined` when it names another bucket. */
function keyFromPath(rawPath: string): string | undefined {
  const prefix = `/${BUCKET}/`;
  if (!rawPath.startsWith(prefix)) return undefined;
  const rest = rawPath.slice(prefix.length);
  if (rest === '') return undefined;
  return rest.split('/').map(decodeURIComponent).join('/');
}

function etagOf(body: Buffer): string {
  return `"${createHash('md5').update(body).digest('hex')}"`;
}

function listXml(objects: Map<string, Buffer>, prefix: string): string {
  const contents = [...objects.entries()]
    .filter(([key]) => key.startsWith(prefix))
    .map(([key, body]) =>
      [
        '<Contents>',
        `<Key>${key}</Key>`,
        `<LastModified>${new Date().toISOString()}</LastModified>`,
        `<ETag>&quot;${createHash('md5').update(body).digest('hex')}&quot;</ETag>`,
        `<Size>${body.byteLength}</Size>`,
        '<StorageClass>STANDARD</StorageClass>',
        '</Contents>',
      ].join(''),
    );
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/">',
    `<Name>${BUCKET}</Name><Prefix>${prefix}</Prefix><KeyCount>${contents.length}</KeyCount>`,
    '<MaxKeys>1000</MaxKeys><IsTruncated>false</IsTruncated>',
    contents.join(''),
    '</ListBucketResult>',
  ].join('');
}

function respond(res: ServerResponse, body: Buffer, headOnly: boolean): void {
  res.writeHead(200, {
    'content-type': 'application/octet-stream',
    'content-length': String(body.byteLength),
    'accept-ranges': 'bytes',
    etag: etagOf(body),
    'last-modified': new Date().toUTCString(),
    'x-amz-request-id': 'cubit-fake',
  });
  if (headOnly) {
    res.end();
    return;
  }
  res.end(body);
}

async function handle(
  objects: Map<string, Buffer>,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const raw = req.url ?? '/';
  const split = raw.indexOf('?');
  const rawPath = split === -1 ? raw : raw.slice(0, split);
  const rawQuery = split === -1 ? '' : raw.slice(split + 1);
  const method = req.method ?? 'GET';

  const presigned = presignedParams(rawQuery);
  if (presigned !== undefined) {
    // Signature first, expiry second (AC-2): an edited `X-Amz-Expires` is part of what was
    // signed, so a forged one is a broken signature before it is a longer life.
    if (!signatureMatches(req, rawPath, rawQuery, presigned)) {
      refuse(
        res,
        403,
        'SignatureDoesNotMatch',
        'The request signature we calculated does not match the signature you provided. Check your key and signing method.',
      );
      return;
    }
    if (hasExpired(presigned)) {
      refuse(res, 403, 'AccessDenied', 'Request has expired');
      return;
    }
  }

  if (rawPath === `/${BUCKET}` || rawPath === `/${BUCKET}/`) {
    const body = Buffer.from(listXml(objects, new URLSearchParams(rawQuery).get('prefix') ?? ''));
    res.writeHead(200, {
      'content-type': 'application/xml',
      'content-length': String(body.byteLength),
      'x-amz-request-id': 'cubit-fake',
    });
    res.end(method === 'HEAD' ? undefined : body);
    return;
  }

  const key = keyFromPath(rawPath);
  if (key === undefined) {
    refuse(res, 404, 'NoSuchBucket', 'The specified bucket does not exist.');
    return;
  }

  if (method === 'PUT') {
    objects.set(key, await readBody(req));
    res.writeHead(200, { etag: etagOf(objects.get(key) ?? Buffer.alloc(0)), 'content-length': '0' });
    res.end();
    return;
  }

  if (method === 'GET' || method === 'HEAD') {
    // The bucket is private: a read that presented no signature at all is refused before the
    // key is looked up, which is how a real private bucket answers an anonymous GET. This is
    // what makes `sign` an access gate rather than a URL format — R-SPINE-021's signed
    // download URLs and Q-12's expiring ones both rest on the unsigned read being refused.
    if (presigned === undefined && !hasSignedAuthorization(req)) {
      refuse(res, 403, 'AccessDenied', 'Access Denied');
      return;
    }

    const body = objects.get(key);
    if (body === undefined) {
      if (method === 'HEAD') {
        res.writeHead(404, { 'content-length': '0', 'x-amz-request-id': 'cubit-fake' });
        res.end();
        return;
      }
      refuse(res, 404, 'NoSuchKey', 'The specified key does not exist.');
      return;
    }
    respond(res, body, method === 'HEAD');
    return;
  }

  // R-SPINE-021 keeps every revision: there is nothing here that removes an object.
  refuse(res, 405, 'MethodNotAllowed', 'The specified method is not allowed against this resource.');
}

/**
 * Start one. Every call gets its own port and its own empty set of objects, so two suites —
 * or two lanes of the same suite — never see each other's writes.
 */
export async function startS3Fake(): Promise<S3Fake> {
  const objects = new Map<string, Buffer>();
  const sockets = new Set<Socket>();
  const server = createServer((req, res) => {
    handle(objects, req, res).catch(() => {
      refuse(res, 500, 'InternalError', 'The fake failed to handle the request.');
    });
  });
  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const address = server.address();
  const port = typeof address === 'object' && address !== null ? address.port : 0;
  const endpoint = `http://127.0.0.1:${port}`;

  return {
    endpoint,
    env: {
      CUBIT_STORAGE_DRIVER: 's3',
      CUBIT_S3_ENDPOINT: endpoint,
      CUBIT_S3_REGION: REGION,
      CUBIT_S3_BUCKET: BUCKET,
      CUBIT_S3_ACCESS_KEY_ID: ACCESS_KEY_ID,
      CUBIT_S3_SECRET_ACCESS_KEY: SECRET_ACCESS_KEY,
    },
    async close(): Promise<void> {
      for (const socket of sockets) socket.destroy();
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });
    },
  };
}
