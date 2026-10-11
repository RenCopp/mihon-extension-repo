import fs from "node:fs";
import zlib from "node:zlib";

const root = new URL("./", import.meta.url);
const index = JSON.parse(fs.readFileSync(new URL("index.json", root), "utf8"));

const varint = (value) => {
  let current = BigInt(value);
  const bytes = [];
  while (current > 0x7fn) {
    bytes.push(Number((current & 0x7fn) | 0x80n));
    current >>= 7n;
  }
  bytes.push(Number(current));
  return Buffer.from(bytes);
};

const field = (number, wireType, value) => Buffer.concat([varint(number * 8 + wireType), value]);
const text = (number, value) => field(number, 2, Buffer.concat([varint(Buffer.byteLength(value)), Buffer.from(value)]));
const message = (number, value) => field(number, 2, Buffer.concat([varint(value.length), value]));
const integer = (number, value) => field(number, 0, varint(value));
const concat = (parts) => Buffer.concat(parts.filter(Boolean));

const encodeContact = (contact) => concat([
  text(1, contact.website),
  contact.discord ? text(2, contact.discord) : null,
]);

const encodeResources = (resources) => concat([
  text(1, resources.apkUrl),
  text(2, resources.iconUrl),
]);

const encodeSource = (source) => concat([
  integer(1, source.id),
  text(2, source.name),
  text(3, source.language),
  text(4, source.homeUrl),
  integer(6, 3),
]);

const encodeExtension = (extension) => concat([
  text(1, extension.name),
  text(2, extension.packageName),
  message(3, encodeResources(extension.resources)),
  text(4, extension.extensionLib),
  integer(5, extension.versionCode),
  text(6, extension.versionName),
  ...extension.sources.map((source) => message(7, encodeSource(source))),
]);

const extensionList = concat(index.extensionList.extensions.map((extension) => message(1, encodeExtension(extension))));
const store = concat([
  text(1, index.name),
  text(2, index.badgeLabel),
  text(3, index.signingKey),
  message(4, encodeContact(index.contact)),
  message(101, extensionList),
]);

fs.writeFileSync(new URL("index.pb", root), zlib.gzipSync(store));
