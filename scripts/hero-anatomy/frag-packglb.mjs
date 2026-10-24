function packGlb(gltf) {
  const binaryChunks = [Buffer.from(gltf.buffers[0].uri.split(',')[1], 'base64')];
  let binaryLength = binaryChunks[0].length;
  for (const image of gltf.images ?? []) {
    while (binaryLength % 4) { binaryChunks.push(Buffer.from([0])); binaryLength++; }
    const png = Buffer.from(image.uri.slice(image.uri.indexOf(',') + 1), 'base64');
    const viewIndex = gltf.bufferViews.length;
    gltf.bufferViews.push({ buffer: 0, byteOffset: binaryLength, byteLength: png.length });
    binaryChunks.push(png);
    binaryLength += png.length;
    image.bufferView = viewIndex;
    delete image.uri;
  }
  gltf.buffers = [{ byteLength: binaryLength }];
  const binary = Buffer.concat(binaryChunks);
  const paddedBinary = binary.length % 4 ? Buffer.concat([binary, Buffer.alloc(4 - binary.length % 4)]) : binary;
  const jsonBytes = Buffer.from(JSON.stringify(gltf), 'utf8');
  const paddedJsonLength = Math.ceil(jsonBytes.length / 4) * 4;
  const jsonChunk = Buffer.concat([jsonBytes, Buffer.alloc(paddedJsonLength - jsonBytes.length, 0x20)]);
  const totalLength = 12 + 8 + jsonChunk.length + 8 + paddedBinary.length;
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(totalLength, 8);
  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(jsonChunk.length, 0);
  jsonHeader.writeUInt32LE(0x4e4f534a, 4);
  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(paddedBinary.length, 0);
  binHeader.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, jsonHeader, jsonChunk, binHeader, paddedBinary]);
}
